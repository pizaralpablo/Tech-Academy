const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");
const {
  createAuthRouter,
  createIdentifierHash,
  tokensMatch,
  validateLogin,
} = require("../auth");

class FakePool {
  constructor() {
    this.passwordHash = bcrypt.hashSync("correct-password", 4);
    this.failures = [];
    this.blocked = false;
  }

  async query(sql, parameters = []) {
    if (sql.includes("FROM auth_login_attempts")) {
      return this.blocked
        ? { rows: [{ blocked_until: new Date(Date.now() + 60_000) }] }
        : { rows: [] };
    }

    if (sql.includes("FROM users")) {
      return parameters[0] === "rafa"
        ? { rows: [{ id: "1", username: "rafa", password_hash: this.passwordHash }] }
        : { rows: [] };
    }

    if (sql.includes("INSERT INTO auth_login_attempts")) {
      this.failures.push({ key: parameters[0], scope: parameters[1] });
      return { rows: [] };
    }

    if (sql.includes("DELETE FROM auth_login_attempts")) {
      return { rows: [] };
    }

    throw new Error(`Consulta inesperada en la prueba: ${sql}`);
  }
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] || "";
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

let server;
let baseUrl;
let pool;

before(async () => {
  pool = new FakePool();
  const app = express();
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: false, path: "/" };

  app.use(express.json());
  app.use(session({
    name: "test.sid",
    secret: "test-session-secret-with-more-than-32-characters",
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions, maxAge: 60_000 },
  }));
  app.use("/api/auth", createAuthRouter({
    pool,
    rateLimitSecret: "test-rate-limit-secret-with-more-than-32-characters",
    cookieName: "test.sid",
    cookieOptions,
    dummyHash: bcrypt.hashSync("dummy-password", 4),
  }));

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("valida los límites del login sin modificar las credenciales", () => {
  assert.deepEqual(validateLogin("  rafa  ", "correct-password"), { username: "rafa" });
  assert.ok(validateLogin("ra", "correct-password").error);
  assert.ok(validateLogin("rafa", "short").error);
});

test("compara tokens CSRF y genera identificadores HMAC estables", () => {
  assert.equal(tokensMatch("token", "token"), true);
  assert.equal(tokensMatch("token", "other"), false);
  assert.equal(createIdentifierHash("secret", "value"), createIdentifierHash("secret", "value"));
  assert.notEqual(createIdentifierHash("secret", "value"), createIdentifierHash("secret", "other"));
});

test("login regenera la sesión, protege datos y logout la invalida", async () => {
  const csrfResult = await request(baseUrl, "/api/auth/csrf-token");
  const anonymousCookie = cookieFrom(csrfResult.response);
  const csrfToken = csrfResult.body.csrfToken;

  assert.equal(csrfResult.response.status, 200);
  assert.ok(anonymousCookie);
  assert.ok(csrfToken);

  const loginResult = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": anonymousCookie,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ username: "rafa", password: "correct-password" }),
  });
  const authenticatedCookie = cookieFrom(loginResult.response);

  assert.equal(loginResult.response.status, 200);
  assert.notEqual(authenticatedCookie, anonymousCookie);
  assert.deepEqual(loginResult.body.user, { id: "1", username: "rafa" });
  assert.equal("password" in loginResult.body, false);
  assert.equal("password_hash" in loginResult.body.user, false);

  const sessionResult = await request(baseUrl, "/api/auth/session", {
    headers: { Cookie: authenticatedCookie },
  });

  assert.equal(sessionResult.response.status, 200);
  assert.equal(sessionResult.body.authenticated, true);
  assert.equal(sessionResult.body.user.username, "rafa");

  const rejectedLogout = await request(baseUrl, "/api/auth/logout", {
    method: "POST",
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(rejectedLogout.response.status, 403);

  const logoutResult = await request(baseUrl, "/api/auth/logout", {
    method: "POST",
    headers: {
      Cookie: authenticatedCookie,
      "X-CSRF-Token": sessionResult.body.csrfToken,
    },
  });
  assert.equal(logoutResult.response.status, 200);

  const expiredSession = await request(baseUrl, "/api/auth/session", {
    headers: { Cookie: authenticatedCookie },
  });
  assert.equal(expiredSession.response.status, 401);
});

test("credenciales incorrectas usan una respuesta genérica y registran ambos límites", async () => {
  const csrfResult = await request(baseUrl, "/api/auth/csrf-token");
  const cookie = cookieFrom(csrfResult.response);
  const token = csrfResult.body.csrfToken;
  const headers = {
    "Content-Type": "application/json",
    "Cookie": cookie,
    "X-CSRF-Token": token,
  };

  const missingUser = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: "missing", password: "wrong-password" }),
  });
  const wrongPassword = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: "rafa", password: "wrong-password" }),
  });

  assert.equal(missingUser.response.status, 401);
  assert.equal(wrongPassword.response.status, 401);
  assert.deepEqual(missingUser.body, wrongPassword.body);
  assert.equal(pool.failures.length, 4);
  assert.deepEqual(new Set(pool.failures.map((failure) => failure.scope)), new Set(["credential", "ip"]));
});

test("un límite activo responde 429 antes de consultar credenciales", async () => {
  pool.blocked = true;
  const csrfResult = await request(baseUrl, "/api/auth/csrf-token");
  const result = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieFrom(csrfResult.response),
      "X-CSRF-Token": csrfResult.body.csrfToken,
    },
    body: JSON.stringify({ username: "rafa", password: "correct-password" }),
  });
  pool.blocked = false;

  assert.equal(result.response.status, 429);
  assert.ok(Number(result.response.headers.get("retry-after")) > 0);
});

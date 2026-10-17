const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_BLOCK_SECONDS = 15 * 60;
const CREDENTIAL_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 20;

// Este hash no pertenece a ningún usuario. Se usa para que un username inexistente
// también realice una comparación bcrypt y no revele cuentas mediante el tiempo.
const DEFAULT_DUMMY_HASH = bcrypt.hashSync("rafa-authentication-dummy-value", 12);

const databaseUnavailableCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
  "28000",
  "28P01",
  "3D000",
  "57P01",
  "57P03",
]);

function isDatabaseUnavailable(error) {
  return typeof error?.code === "string"
    && (error.code.startsWith("08") || databaseUnavailableCodes.has(error.code));
}

function validateLogin(username, password) {
  if (typeof username !== "string" || typeof password !== "string") {
    return { error: "Username y password son obligatorios y deben ser texto." };
  }

  const normalizedUsername = username.trim();
  const usernameLength = Array.from(normalizedUsername).length;

  if (usernameLength < 3 || usernameLength > 80) {
    return { error: "Los datos de acceso no son válidos." };
  }

  if (password.length < 8 || password.trim().length === 0) {
    return { error: "Los datos de acceso no son válidos." };
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return { error: "Los datos de acceso no son válidos." };
  }

  return { username: normalizedUsername };
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = createCsrfToken();
  }

  return req.session.csrfToken;
}

function tokensMatch(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") {
    return false;
  }

  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function requireCsrf(req, res, next) {
  if (!tokensMatch(req.get("X-CSRF-Token"), req.session?.csrfToken)) {
    return res.status(403).json({ error: "La solicitud no es válida. Actualizá la página e intentá nuevamente." });
  }

  return next();
}

function requireAuthenticatedApi(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Necesitás iniciar sesión para continuar." });
  }

  return next();
}

function requireAuthenticatedPage(req, res, next) {
  if (!req.session?.user) {
    return res.redirect(302, "/?auth=required#login");
  }

  return next();
}

function createIdentifierHash(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createLoginKeys(req, username, secret) {
  const address = req.ip || req.socket?.remoteAddress || "unknown";

  return {
    credential: createIdentifierHash(secret, `credential:${address}:${username}`),
    ip: createIdentifierHash(secret, `ip:${address}`),
  };
}

async function readActiveBlock(pool, keys) {
  const result = await pool.query(
    `SELECT blocked_until
       FROM auth_login_attempts
      WHERE identifier_hash = ANY($1::text[])
        AND blocked_until > NOW()`,
    [[keys.credential, keys.ip]],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const latestBlock = Math.max(...result.rows.map((row) => new Date(row.blocked_until).getTime()));
  return Math.max(1, Math.ceil((latestBlock - Date.now()) / 1000));
}

async function recordFailure(pool, identifierHash, scope, limit) {
  await pool.query(
    `INSERT INTO auth_login_attempts
       (identifier_hash, scope, failures, window_started_at, blocked_until, updated_at)
     VALUES ($1, $2, 1, NOW(), NULL, NOW())
     ON CONFLICT (identifier_hash) DO UPDATE SET
       scope = EXCLUDED.scope,
       failures = CASE
         WHEN auth_login_attempts.window_started_at <= NOW() - ($4 * INTERVAL '1 second') THEN 1
         ELSE auth_login_attempts.failures + 1
       END,
       window_started_at = CASE
         WHEN auth_login_attempts.window_started_at <= NOW() - ($4 * INTERVAL '1 second') THEN NOW()
         ELSE auth_login_attempts.window_started_at
       END,
       blocked_until = CASE
         WHEN (
           CASE
             WHEN auth_login_attempts.window_started_at <= NOW() - ($4 * INTERVAL '1 second') THEN 1
             ELSE auth_login_attempts.failures + 1
           END
         ) >= $3 THEN NOW() + ($5 * INTERVAL '1 second')
         ELSE NULL
       END,
       updated_at = NOW()`,
    [identifierHash, scope, limit, LOGIN_WINDOW_SECONDS, LOGIN_BLOCK_SECONDS],
  );
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

function createAuthRouter({
  pool,
  rateLimitSecret,
  cookieName,
  cookieOptions,
  dummyHash = DEFAULT_DUMMY_HASH,
}) {
  const router = express.Router();

  // Las respuestas de autenticación no deben quedar guardadas en cachés compartidas.
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // El navegador obtiene un token ligado a su sesión antes de enviar login o logout.
  router.get("/csrf-token", (req, res) => {
    res.json({ csrfToken: ensureCsrfToken(req) });
  });

  router.post("/login", requireCsrf, async (req, res) => {
    const { username, password } = req.body || {};
    const validation = validateLogin(username, password);

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const keys = createLoginKeys(req, validation.username, rateLimitSecret);

    try {
      const retryAfter = await readActiveBlock(pool, keys);

      if (retryAfter) {
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({ error: "No fue posible iniciar sesión. Intentá nuevamente más tarde." });
      }

      const result = await pool.query(
        `SELECT id, username, password_hash
           FROM users
          WHERE username = $1
          LIMIT 1`,
        [validation.username],
      );
      const user = result.rows[0];
      const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyHash);

      if (!user || !passwordMatches) {
        await Promise.all([
          recordFailure(pool, keys.credential, "credential", CREDENTIAL_FAILURE_LIMIT),
          recordFailure(pool, keys.ip, "ip", IP_FAILURE_LIMIT),
        ]);

        return res.status(401).json({ error: "Username o password incorrectos." });
      }

      await Promise.all([
        pool.query(
          "DELETE FROM auth_login_attempts WHERE identifier_hash = $1",
          [keys.credential],
        ),
        // Una limpieza breve después de un acceso válido evita acumular límites vencidos.
        pool.query(
          "DELETE FROM auth_login_attempts WHERE updated_at < NOW() - INTERVAL '24 hours'",
        ),
      ]);

      // Regenerar elimina la sesión anónima y evita reutilizar un ID fijado antes del login.
      await regenerateSession(req);
      req.session.user = { id: user.id, username: user.username };
      req.session.csrfToken = createCsrfToken();
      await saveSession(req);

      return res.json({
        message: "Sesión iniciada correctamente.",
        user: req.session.user,
      });
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        console.error("PostgreSQL no está disponible durante el login. Código:", error.code);
        return res.status(503).json({ error: "El servicio de autenticación no está disponible temporalmente." });
      }

      console.error("No fue posible iniciar sesión. Código:", error.code || "UNKNOWN");
      return res.status(500).json({ error: "No fue posible iniciar sesión." });
    }
  });

  router.get("/session", requireAuthenticatedApi, (req, res) => {
    res.json({
      authenticated: true,
      user: req.session.user,
      csrfToken: ensureCsrfToken(req),
    });
  });

  router.post("/logout", requireAuthenticatedApi, requireCsrf, async (req, res) => {
    try {
      await destroySession(req);
      res.clearCookie(cookieName, cookieOptions);
      return res.json({ message: "Sesión cerrada correctamente." });
    } catch (error) {
      console.error("No fue posible cerrar la sesión. Código:", error.code || "UNKNOWN");
      return res.status(500).json({ error: "No fue posible cerrar la sesión." });
    }
  });

  return router;
}

module.exports = {
  createAuthRouter,
  createIdentifierHash,
  requireAuthenticatedApi,
  requireAuthenticatedPage,
  requireCsrf,
  tokensMatch,
  validateLogin,
};

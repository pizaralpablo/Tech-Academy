import express from "express";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const maxLoginAttempts = 3;
const lockoutMinutes = 15;
const jwtSecret = process.env.JWT_SECRET || "development-only-change-me";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "appdb",
  user: process.env.DB_USER || "appuser",
  password: process.env.DB_PASSWORD,
});

app.use(express.json({ limit: "10kb" }));

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validUsername(username) {
  return /^[a-z0-9_]{3,32}$/.test(username);
}

function strongPassword(password) {
  return typeof password === "string" &&
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

function invalidCredentials(res) {
  return res.status(401).json({ message: "Incorrect username or password. Please check your credentials and try again." });
}

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    req.auth = jwt.verify(token, jwtSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Authentication required." });
  }
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (_error) {
    res.status(503).json({ status: "unavailable" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;

  if (!validUsername(username)) {
    return res.status(400).json({ message: "Username must be 3–32 characters using letters, numbers, or underscores." });
  }
  if (!strongPassword(password)) {
    return res.status(400).json({ message: "Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (username, username_normalized, password_hash)
       VALUES ($1, $1, $2)`,
      [username, passwordHash],
    );
    return res.status(201).json({ message: "Account created." });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "That username is already in use." });
    }
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Unable to create the account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, password_hash, failed_login_attempts, locked_until
       FROM users WHERE username_normalized = $1 FOR UPDATE`,
      [username],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return invalidCredentials(res);
    }

    const user = result.rows[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await client.query("ROLLBACK");
      return res.status(423).json({ message: "Account temporarily locked. Try again later." });
    }

    const passwordMatches = await bcrypt.compare(password || "", user.password_hash);
    if (!passwordMatches) {
      const failedAttempts = user.failed_login_attempts + 1;
      const shouldLock = failedAttempts >= maxLoginAttempts;
      await client.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             locked_until = CASE WHEN $2 THEN NOW() + ($3 * INTERVAL '1 minute') ELSE NULL END
         WHERE id = $4`,
        [failedAttempts, shouldLock, lockoutMinutes, user.id],
      );
      await client.query("COMMIT");

      if (shouldLock) {
        return res.status(423).json({ message: "Account temporarily locked after 3 failed attempts. Try again later." });
      }
      return invalidCredentials(res);
    }

    await client.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
      [user.id],
    );
    await client.query("COMMIT");
    const token = jwt.sign(
      { sub: String(user.id), username: user.username_normalized },
      jwtSecret,
      { expiresIn: "1h" },
    );
    return res.json({ message: "Signed in successfully.", token });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to sign in." });
  } finally {
    client.release();
  }
});

app.get("/api/users", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT username, created_at FROM users ORDER BY created_at ASC",
    );
    return res.json({ users: result.rows });
  } catch (error) {
    console.error("Users query error:", error);
    return res.status(500).json({ message: "Unable to load users." });
  }
});

app.listen(port, () => {
  console.log(`Auth API listening on port ${port}`);
});

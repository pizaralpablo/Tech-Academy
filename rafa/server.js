// Express se encarga de crear el servidor web y definir sus rutas.
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

// Docker o Kubernetes pueden definir el puerto. Para uso local se utiliza 3000.
const PORT = process.env.PORT || 3000;
const BCRYPT_COST = 12;

// PostgreSQL toma la conexión únicamente de variables de entorno. De esta forma,
// las credenciales no quedan escritas dentro del código ni de la imagen Docker.
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 5000,
});

// Si una conexión inactiva falla, registramos solo el código técnico y evitamos
// imprimir configuraciones que podrían contener información sensible.
pool.on("error", (error) => {
  console.error("Error inesperado en el pool de PostgreSQL:", error.code || "UNKNOWN");
});

// Express necesita este middleware para convertir cuerpos JSON en objetos.
// El límite pequeño evita recibir cargas innecesariamente grandes en este formulario.
app.use(express.json({ limit: "10kb" }));

const currentStatus = {
  runtime: "Node.js + Express",
  container: "Docker",
  orchestrator: "Kubernetes",
  replicas: "2 Pods",
  service: "LoadBalancer",
  status: "Running",
};

// Estas colecciones permiten sumar nuevos avances sin cambiar la estructura de la página.
const labStatus = {
  ...currentStatus,
  context: {
    title: "Kubernetes Lab",
    namespace: "rafa-lab",
  },
  deployment: [
    { label: "Runtime", value: currentStatus.runtime },
    { label: "Container", value: currentStatus.container },
    { label: "Orchestrator", value: currentStatus.orchestrator },
    { label: "Namespace", value: "rafa-lab" },
    { label: "Workload", value: "Deployment" },
    { label: "Replicas", value: currentStatus.replicas },
    { label: "Service", value: currentStatus.service },
    { label: "CPU request / limit", value: "100m / 500m" },
    { label: "Memory request / limit", value: "128Mi / 256Mi" },
  ],
  milestones: [
    {
      title: "Docker Lab",
      state: "Completed",
      summary: "Node.js and Express packaged in a Docker image.",
    },
    {
      title: "Kubernetes Task 1",
      state: "Completed",
      summary: "Deployment, resource controls and LoadBalancer configured in rafa-lab.",
    },
  ],
};

// Este endpoint entrega al frontend el estado actual del laboratorio.
app.get("/api/status", (req, res) => {
  res.json(labStatus);
});

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

// Esta validación protege la base antes de realizar trabajo costoso o ejecutar SQL.
// El máximo de 80 caracteres coincide con VARCHAR(80), y bcrypt procesa como máximo
// 72 bytes de una contraseña sin truncarla.
function validateRegistration(username, password) {
  if (typeof username !== "string" || typeof password !== "string") {
    return { error: "Username y password son obligatorios y deben ser texto." };
  }

  const normalizedUsername = username.trim();
  const usernameLength = Array.from(normalizedUsername).length;

  if (usernameLength < 3 || usernameLength > 80) {
    return { error: "Username debe tener entre 3 y 80 caracteres." };
  }

  if (password.length < 8 || password.trim().length === 0) {
    return { error: "Password debe tener al menos 8 caracteres." };
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return { error: "Password no puede superar 72 bytes." };
  }

  return { username: normalizedUsername };
}

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};
  const validation = validateRegistration(username, password);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // El costo 12 hace deliberadamente lento el cálculo del hash para dificultar
    // ataques de fuerza bruta. La contraseña original nunca se envía a PostgreSQL.
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Los marcadores $1 y $2 mantienen los datos separados del SQL y previenen
    // inyecciones. RETURNING excluye intencionalmente password_hash de la respuesta.
    const result = await pool.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, created_at AS "createdAt"`,
      [validation.username, passwordHash],
    );

    return res.status(201).json({
      message: "Usuario registrado correctamente.",
      user: result.rows[0],
    });
  } catch (error) {
    // PostgreSQL usa 23505 cuando una restricción UNIQUE detecta un duplicado.
    if (error.code === "23505") {
      return res.status(409).json({ error: "El username ya está registrado." });
    }

    if (isDatabaseUnavailable(error)) {
      console.error("PostgreSQL no está disponible. Código:", error.code);
      return res.status(503).json({ error: "La base de datos no está disponible temporalmente." });
    }

    console.error("No fue posible registrar el usuario. Código:", error.code || "UNKNOWN");
    return res.status(500).json({ error: "No fue posible registrar el usuario." });
  }
});

// La ruta principal sirve la interfaz del laboratorio.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Los errores al leer JSON se responden de forma uniforme, sin devolver trazas
// internas de Express ni detalles del servidor al cliente.
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la solicitud debe contener JSON válido." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "El cuerpo de la solicitud es demasiado grande." });
  }

  console.error("Error no controlado en Express:", error.code || "UNKNOWN");
  return res.status(500).json({ error: "Error interno del servidor." });
});

app.listen(PORT, () => {
  console.log(`Servidor de Rafa corriendo en http://localhost:${PORT}`);
});

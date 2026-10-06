const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const port = process.env.PORT || 8080;
const indexPath = path.join(__dirname, 'index.html');
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'change-me'
});
const sessions = new Map();

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

const readBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    try {
      resolve(JSON.parse(body));
    } catch {
      reject(new Error('Invalid JSON'));
    }
  });
  request.on('error', reject);
});

const getSession = (request) => {
  const cookies = request.headers.cookie || '';
  const sessionCookie = cookies.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('session='));
  return sessionCookie ? sessions.get(sessionCookie.slice('session='.length)) : null;
};

const initializeDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL
    )
  `);
};

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/api/me') {
    const session = getSession(request);
    sendJson(response, session ? 200 : 401, session || { error: 'No autenticado.' });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/logout') {
    const cookies = request.headers.cookie || '';
    const sessionCookie = cookies.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('session='));
    if (sessionCookie) sessions.delete(sessionCookie.slice('session='.length));
    response.writeHead(204, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/' });
    response.end();
    return;
  }

  if (request.method === 'POST' && (request.url === '/api/register' || request.url === '/api/login')) {
    readBody(request).then(async ({ username, password }) => {
      if (typeof username !== 'string' || typeof password !== 'string' || username.length < 3 || password.length < 8) {
        sendJson(response, 400, { error: 'Usuario minimo de 3 caracteres y password minimo de 8.' });
        return;
      }

      if (request.url === '/api/register') {
        const passwordHash = await bcrypt.hash(password, 12);
        await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, passwordHash]);
        sendJson(response, 201, { message: 'Usuario creado correctamente.' });
        return;
      }

      const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
      const valid = result.rowCount === 1 && await bcrypt.compare(password, result.rows[0].password_hash);
      if (!valid) {
        sendJson(response, 401, { error: 'Usuario o password incorrectos.' });
        return;
      }

      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions.set(sessionId, { userId: result.rows[0].id, username: result.rows[0].username });
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `session=${sessionId}; HttpOnly; SameSite=Lax; Max-Age=3600; Path=/`
      });
      response.end(JSON.stringify({ message: 'Inicio de sesion correcto.', username: result.rows[0].username }));
    }).catch((error) => {
      if (error.code === '23505') {
        sendJson(response, 409, { error: 'El usuario ya existe.' });
      } else {
        console.error(error);
        sendJson(response, 500, { error: 'Error interno del servidor.' });
      }
    });
    return;
  }

  if (request.url !== '/' && request.url !== '/index.html') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  fs.readFile(indexPath, (error, content) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal server error');
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(content);
  });
});

const start = async () => {
  await initializeDatabase();
  server.listen(port, '0.0.0.0', () => {
    console.log(`Node web server listening on port ${port}`);
  });
};

start().catch((error) => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});

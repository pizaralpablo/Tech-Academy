const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'jonathan',
  password: process.env.DB_PASSWORD || 'changeme123',
  database: process.env.DB_NAME || 'techacademy',
});

app.use(express.json());

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)',
      [username, hash]
    );
    res.status(201).json({ message: 'Usuario creado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/usuarios', async (req, res) => {
  const result = await pool.query('SELECT id, username, created_at FROM usuarios');
  res.json(result.rows);
});


app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

var express = require('express');
var router = express.Router();
const pool = require('../db');

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/login', function(req, res) {
  res.render('login');
});

router.post('/login', async function(req, res) {
  const { usuario, contrasena } = req.body;
  await pool.query('INSERT INTO usuarios (usuario, contrasena) VALUES ($1, $2)', [usuario, contrasena]);
  res.send('Usuario guardado correctamente');
});

module.exports = router;
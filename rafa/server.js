// Express se encarga de crear el servidor web y definir sus rutas.
const express = require("express");
const path = require("path");

const app = express();

// Docker o Kubernetes pueden definir el puerto. Para uso local se utiliza 3000.
const PORT = process.env.PORT || 3000;

// Este endpoint entrega al frontend el estado actual del laboratorio.
app.get("/api/status", (req, res) => {
  res.json({
    runtime: "Node.js + Express",
    container: "Docker",
    orchestrator: "Kubernetes",
    replicas: "2 Pods",
    service: "LoadBalancer",
    status: "Running",
  });
});

// La ruta principal sirve la interfaz del laboratorio.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor de Rafa corriendo en http://localhost:${PORT}`);
});

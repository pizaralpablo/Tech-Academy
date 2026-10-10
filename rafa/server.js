// Express se encarga de crear el servidor web y definir sus rutas.
const express = require("express");
const path = require("path");

const app = express();

// Docker o Kubernetes pueden definir el puerto. Para uso local se utiliza 3000.
const PORT = process.env.PORT || 3000;

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

// La ruta principal sirve la interfaz del laboratorio.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor de Rafa corriendo en http://localhost:${PORT}`);
});

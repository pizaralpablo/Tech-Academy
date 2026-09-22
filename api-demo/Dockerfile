FROM node:20-alpine

# 1. Definir entorno de producción
ENV NODE_ENV=production
WORKDIR /app

# 2. Copiamos archivos asignando permisos al usuario restringido 'node'
COPY --chown=node:node package*.json ./

# 3. Instalación limpia de dependencias de producción
RUN npm ci --only=production

# 4. Copiamos el resto del código de forma segura
COPY --chown=node:node . .

# 5. HEALTHCHECK: Enseña a Docker a saber si la app está colgada
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 6. SEGURIDAD: Cambiamos al usuario 'node' (evita ROOT)
USER node

EXPOSE 3000
CMD ["npm", "start"]
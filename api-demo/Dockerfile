FROM node:20-alpine

# 1. Definir entorno de producción
ENV NODE_ENV=production
WORKDIR /app

# 2. Copiamos archivos de dependencias
COPY --chown=node:node package*.json ./

# 3. Instalación limpia de dependencias de producción
RUN npm ci --only=production

# 4. Copiamos todo el código (incluye la carpeta public con index.html y styles.css)
COPY --chown=node:node . .

# 5. HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 6. SEGURIDAD
USER node

EXPOSE 3000
CMD ["npm", "start"]
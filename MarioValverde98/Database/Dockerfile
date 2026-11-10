# Usa la imagen oficial ligera de MySQL versión 8.0
FROM mysql:8.0

# Define el nombre de la base de datos inicial
ENV MYSQL_DATABASE=empresa_db

# Copia el script SQL al directorio donde MySQL ejecuta scripts al inicializarse
COPY init.sql /docker-entrypoint-initdb.d/

# Expone el puerto por defecto de MySQL
EXPOSE 3306
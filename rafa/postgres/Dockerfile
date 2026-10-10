# Partimos de la imagen oficial y ligera de PostgreSQL 16 basada en Alpine Linux.
FROM postgres:16-alpine

# La imagen oficial busca scripts SQL en /docker-entrypoint-initdb.d durante la
# primera inicialización y los ejecuta en orden alfabético.
# Este script solo se ejecuta cuando el directorio de datos está vacío; no es una
# migración que vuelva a ejecutarse cada vez que el contenedor arranca.
COPY init.sql /docker-entrypoint-initdb.d/10-create-users.sql

# Usa una imagen ligera de Alpine como etapa de preparacion del sitio.
FROM alpine:3.20 AS build

# Define la carpeta donde se guardaran los archivos estaticos.
WORKDIR /site

# Copia la pagina web local dentro de la etapa de construccion.
COPY index.html .

# Usa Nginx Alpine como etapa final para ejecutar el servidor web.
FROM nginx:1.27-alpine AS runtime

# Elimina la pagina predeterminada que incluye Nginx.
RUN rm -rf /usr/share/nginx/html/*

# Copia solamente el contenido preparado desde la etapa anterior.
COPY --from=build /site/index.html /usr/share/nginx/html/index.html

# Documenta que el contenedor escucha en el puerto HTTP 80.
EXPOSE 80

# Inicia Nginx en primer plano para que el contenedor permanezca activo.
CMD ["nginx", "-g", "daemon off;"]

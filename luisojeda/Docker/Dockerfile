FROM alpine:3.24.2 AS build

WORKDIR /app

COPY index.html .

COPY styles.css .

FROM nginx:1.27-alpine AS final

RUN adduser -D -u 8888 -G nginx webappuser && rm -f /usr/share/nginx/html/*

RUN mkdir -p /var/cache/nginx \
    && chown -R webappuser:nginx /var/cache/nginx /usr/share/nginx/html \
    && sed -i 's|^pid .*;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
    && sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf

USER webappuser

COPY --from=build /app/index.html /usr/share/nginx/html/index.html

COPY --from=build /app/styles.css /usr/share/nginx/html/styles.css

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
FROM alpine:3.21 AS builder

WORKDIR /app

COPY index.html .
COPY gengar.png .

FROM nginx:1.27-alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

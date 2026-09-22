FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY index.html ./index.html
COPY styles.css ./styles.css

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

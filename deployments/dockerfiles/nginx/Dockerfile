FROM nginx:1.21-alpine

COPY deployments/dockerfiles/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deployments/dockerfiles/nginx/nginx.conf /etc/nginx/nginx.conf
RUN nginx -t

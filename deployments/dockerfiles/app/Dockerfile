FROM node:16-alpine AS build

WORKDIR /app

ARG NODE_ENV
ENV NODE_ENV ${NODE_ENV:-production}

RUN apk --update add python3 build-base
COPY package*.json ./
#RUN npm ci
RUN npm i
COPY . .
RUN npm run build

FROM node:16-alpine
WORKDIR /app
COPY . .
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080

CMD [ "node","./dist/server.js" ]

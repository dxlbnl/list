FROM node:15.14-alpine3.13


ADD server /app/
ADD build /app/static

WORKDIR /app

RUN npm install

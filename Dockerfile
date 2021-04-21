FROM node:15.14-alpine3.13


ADD server /app/
ADD build /app/static

WORKDIR /app
EXPOSE 80

RUN npm install
VOLUME [ "/app/data" ]

CMD node .
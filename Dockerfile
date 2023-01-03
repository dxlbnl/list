FROM node:current-alpine

WORKDIR /app

ADD package.json /app
RUN npm install --omit=dev

ADD build /app

EXPOSE 80

VOLUME [ "/app/data" ]

CMD node .
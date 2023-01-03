FROM node:current-alpine

WORKDIR /app

ADD package.json /app
RUN npm install --omit=dev

ADD build /app

ENV PORT=80
EXPOSE 80

VOLUME [ "/app/data" ]

CMD node .
FROM node:12

WORKDIR /usr/src/app

COPY package*.json ./

COPY knexfile.js ./

COPY migrations/* ./migrations/

RUN npm install

RUN npx knex migrate:latest

COPY . .

EXPOSE 3000

CMD [ "node", "server.js" ]

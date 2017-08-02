FROM node:slim

RUN npm install rethinkdb

COPY rethinkdb_eval.js /rethinkdb_eval.js

ENTRYPOINT ["node", "/rethinkdb_eval.js"]

FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]


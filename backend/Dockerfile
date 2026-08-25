FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node config ./config
# Docker socket access is root-equivalent and its host GID is not portable.
# Keep this gateway isolated; the interactive Kali session still runs as student.
EXPOSE 3001
CMD ["node", "src/server.js"]

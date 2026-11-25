FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false

COPY --chown=node:node backend ./backend
USER node

EXPOSE 4000
CMD ["npm", "start", "--workspace", "backend"]

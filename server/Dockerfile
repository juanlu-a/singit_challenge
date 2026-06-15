# Build context is the repo ROOT (so the pnpm workspace files are available):
#   docker build -f server/Dockerfile .
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

# Install dependencies for the server workspace using the root lockfile.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @singit/server...

# Build the server.
COPY server ./server
RUN pnpm --filter @singit/server build

ENV NODE_ENV=production
WORKDIR /app/server
EXPOSE 3000
# `pnpm seed` (ts-node) or `node dist/seed/seed.js` (compiled) seed the database.
CMD ["node", "dist/main.js"]

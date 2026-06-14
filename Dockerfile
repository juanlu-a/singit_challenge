# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Seed data + ts sources are needed by the (optional) seed script run via docker compose.
COPY --from=build /app/src ./src
COPY tsconfig.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]

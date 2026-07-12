FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ─── Production image ────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Only install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--enable-source-maps", "dist/server/index.mjs"]

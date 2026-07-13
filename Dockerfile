# ─── Builder stage ────────────────────────────────────────────────────────────
# debian tabanlı kullan — alpine/musl, esbuild/rollup platform
# override'larıyla çakışıyor
FROM node:20 AS builder

WORKDIR /app

# pnpm'i etkinleştir
RUN corepack enable && corepack prepare pnpm@latest --activate

# Kaynak kodu kopyala
COPY . .

# Monorepo workspace'i devre dışı bırak:
#   - package.docker.json → tek, düz bir package.json (tüm deps birleşik)
#   - pnpm-workspace.yaml → minimumReleaseAge ve packages listesi olmadan
RUN cp package.docker.json package.json && \
    printf 'packages: []\n' > pnpm-workspace.yaml

# Bağımlılıkları yükle
RUN pnpm install --no-frozen-lockfile

# Sunucu (Express) build et → dist/server/index.mjs + dist/assets/
RUN node build.mjs

# Frontend (React/Vite) build et → dist/public/
RUN pnpm exec vite build

# ─── Production image ─────────────────────────────────────────────────────────
# Sunucu esbuild ile tam bundle'landı; node_modules gerekmez.
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Render PORT env var'ını kullanır (varsayılan 3001)
EXPOSE 3001

CMD ["node", "--enable-source-maps", "dist/server/index.mjs"]

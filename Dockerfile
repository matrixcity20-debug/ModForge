# ─── Builder stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm'i etkinleştir (corepack Node 20 ile geliyor)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Bağımlılıkları önce kopyala → Docker layer cache'den yararlan
COPY package.json pnpm-workspace.yaml* ./

# pnpm-lock.yaml varsa kopyala (CI tekrarlanabilirliği için)
COPY pnpm-lock.yaml* ./

# Tüm kaynak kodunu kopyala
COPY . .

# Bağımlılıkları yükle (preinstall scripti pnpm'e izin verir)
RUN pnpm install --frozen-lockfile || pnpm install

# Sunucu (Express) build et → dist/server/index.mjs + dist/assets/
RUN node build.mjs

# Frontend (React/Vite) build et → dist/public/
RUN pnpm exec vite build

# ─── Production image ─────────────────────────────────────────────────────────
# Sunucu esbuild ile tam olarak bundle'landı; node_modules gerekmez.
FROM node:20-alpine

WORKDIR /app

# Sadece build çıktısını kopyala
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Render PORT env var'ını kullanır (varsayılan 3001)
EXPOSE 3001

CMD ["node", "--enable-source-maps", "dist/server/index.mjs"]

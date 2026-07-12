# ─── Builder stage ────────────────────────────────────────────────────────────
# debian tabanlı kullan — alpine/musl, pnpm-workspace.yaml'daki
# esbuild/rollup platform override'larıyla çakışıyor
FROM node:20 AS builder

WORKDIR /app

# pnpm'i etkinleştir
RUN corepack enable && corepack prepare pnpm@latest --activate

# Tüm kaynak kodunu kopyala
COPY . .

# minimumReleaseAge Replit'e özgü bir güvenlik ayarı; Docker/CI ortamında
# paket kurulumunu blokladığı için sıfıra çekiyoruz
RUN sed -i 's/^minimumReleaseAge:.*/minimumReleaseAge: 0/' pnpm-workspace.yaml

# Bağımlılıkları yükle
# --no-frozen-lockfile: cross-platform build'lerde lock hash uyumsuzluklarını önler
RUN pnpm install --no-frozen-lockfile

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

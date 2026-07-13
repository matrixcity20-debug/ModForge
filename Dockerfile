# ─── Builder stage ────────────────────────────────────────────────────────────
# Debian tabanlı kullan — Alpine/musl, esbuild gibi native
# bağımlılıklarla build sırasında uyumsuzluk çıkarabilir.
FROM node:20 AS builder

WORKDIR /app

# Önce sadece package.json kopyala → bağımlılıklar değişmediğinde
# Docker layer cache'den yararlanılır, npm install tekrar çalışmaz.
COPY package.json ./

RUN npm install

# Geri kalan tüm kaynak kodunu kopyala
COPY . .

# Frontend (Vite) → dist/public/
# Sunucu (esbuild) → dist/server/index.mjs
RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────────
# Sunucu esbuild ile tamamen bundle'landı (express, pg, drizzle, jszip vb.
# hepsi içine dahil edildi). node_modules üretim ortamında GEREKMİYOR.
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Render, PORT ortam değişkenini otomatik atar.
EXPOSE 3001

CMD ["node", "--enable-source-maps", "dist/server/index.mjs"]

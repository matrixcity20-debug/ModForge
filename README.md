# MC Mod Forge

Yapay zeka ile Minecraft mod planı ve kaynak kodu üreten bir web uygulaması.

## Özellikler

- Forge, Fabric, NeoForge ve Quilt destekli mod üretimi
- Arka planda AI ile tam Java kod üretimi (OpenRouter + NVIDIA NIM)
- Üretilen modu `.jar` olarak indirme
- PostgreSQL ile mod geçmişi ve istatistikler

---

## Gereksinimler

- **Node.js** 20+
- **PostgreSQL** veritabanı
- **OpenRouter API anahtarı** → https://openrouter.ai (ücretsiz hesap)
- **NVIDIA NIM API anahtarı** → https://build.nvidia.com (ücretsiz hesap)

---

## Kurulum

### 1. Bağımlılıkları yükle

```bash
npm install
```

### 2. Ortam değişkenlerini ayarla

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

```bash
cp .env.example .env
```

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/mc_mod_forge
OPENROUTER_API_KEY=sk-or-...
NVIDIA_NIM_API_KEY=nvapi-...
NODE_ENV=development
```

### 3. Veritabanını oluştur

```bash
npm run db:push
```

### 4. Uygulamayı başlat (development)

Tek komutla her ikisini başlat:

```bash
npm run dev
```

Bu komut hem Vite (frontend) hem de Express (backend) sunucusunu aynı anda başlatır.

- Frontend: http://localhost:5173  
- API: http://localhost:3001/api

Sadece backend başlatmak istersen:
```bash
npm run dev:server
```

---

## Production Build

```bash
npm run build
```

Bu komut:
1. `vite build` ile frontend'i `dist/public/` klasörüne derler
2. `node build.mjs` ile server'ı `dist/server/` klasörüne bundle eder

### Production'ı başlat

```bash
NODE_ENV=production PORT=3001 npm start
```

Server hem API'yi hem de frontend static dosyalarını tek portta sunar.

---

## Render.com Deployment

1. Render'da **"New Web Service"** oluştur
2. Bu repo'yu bağla
3. Ayarlar:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. **Environment Variables** ekle:
   - `DATABASE_URL` → Render PostgreSQL add-on'undan al
   - `OPENROUTER_API_KEY`
   - `NVIDIA_NIM_API_KEY`
   - `NODE_ENV` = `production`

---

## Fly.io Deployment

```bash
# Fly CLI yükle
curl -L https://fly.io/install.sh | sh

# Giriş yap
fly auth login

# Uygulama oluştur
fly launch

# Secrets ekle
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set OPENROUTER_API_KEY="sk-or-..."
fly secrets set NVIDIA_NIM_API_KEY="nvapi-..."
fly secrets set NODE_ENV="production"

# Deploy et
fly deploy
```

`fly.toml` örneği:
```toml
app = "mc-mod-forge"
primary_region = "fra"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3001
  force_https = true

[env]
  NODE_ENV = "production"
  PORT = "3001"
```

---

## Proje Yapısı

```
mc-mod-forge/
├── server/              # Express API sunucusu (Node.js)
│   ├── index.ts         # Giriş noktası, static serving
│   ├── app.ts           # Express app kurulumu
│   ├── validators.ts    # Zod şemaları (request/response doğrulama)
│   ├── db/
│   │   ├── index.ts     # Drizzle ORM + pg bağlantısı
│   │   └── schema.ts    # Veritabanı şeması
│   ├── lib/
│   │   ├── logger.ts    # Pino logger
│   │   ├── modGenerator.ts  # AI mod üretim motoru
│   │   └── jarBuilder.ts    # .jar kaynak dosyası oluşturucu
│   └── routes/
│       ├── index.ts
│       ├── health.ts
│       └── mods.ts
├── src/                 # React frontend (Vite)
│   ├── api/             # API hooks ve tipler
│   ├── components/      # UI bileşenleri
│   ├── pages/           # Sayfa bileşenleri
│   ├── hooks/
│   └── lib/
├── public/              # Statik dosyalar
├── dist/                # Build çıktısı (git'e ekleme)
│   ├── public/          # Frontend build
│   └── server/          # Server bundle
├── vite.config.ts
├── build.mjs            # esbuild server bundler
├── drizzle.config.ts
└── package.json
```

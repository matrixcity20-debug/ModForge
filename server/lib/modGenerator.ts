import { logger } from "./logger";

if (!process.env["OPENROUTER_API_KEY"]) {
  throw new Error(
    "OPENROUTER_API_KEY must be set. Did you forget to provide it?",
  );
}
if (!process.env["NVIDIA_NIM_API_KEY"]) {
  throw new Error(
    "NVIDIA_NIM_API_KEY must be set. Did you forget to provide it?",
  );
}

const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"];
const NVIDIA_NIM_API_KEY = process.env["NVIDIA_NIM_API_KEY"];

// ─── Model öncelik listesi ────────────────────────────────────────────────────
// En güçlüden başlar; bir model hata verirse sıradakine geçer.

interface ModelEntry {
  provider: "openrouter" | "nvidia";
  model: string;
}

const MODEL_PRIORITY: readonly ModelEntry[] = [
  // ── OpenRouter – güvenilir ücretsiz modeller (Temmuz 2026) ───────────────
  // En yetenekli kodlama modellerinden başlayarak en optimize/hafif olanlara doğru sıralandı.
  { provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  { provider: "openrouter", model: "poolside/laguna-m.1:free" },
  { provider: "openrouter", model: "tencent/hy3:free" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "cohere/north-mini-code:free" },
  { provider: "openrouter", model: "poolside/laguna-xs-2.1:free" },
  { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },

  // ── NVIDIA NIM – yedek (Temmuz 2026) ─────────────────────────────────────
  // En yüksek performanstan en düşüğe (nano/omni en sonda).
  { provider: "nvidia", model: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "meta", model: "meta/llama-3.3-70b-instruct" },
  { provider: "meta", model: "meta/llama-3.1-70b-instruct" },
  { provider: "nvidia", model: "nvidia/nemotron-3-nano-omni" },
];

// ─── System prompt ────────────────────────────────────────────────────────────
// Eski versiyonların çalışan yaklaşımı: net, kısa kurallar + açık izin listesi.
// Aşırı uzun/karmaşık promptlar modeli daha kısıtlı davranmaya itiyor.
const SYSTEM_INSTRUCTION = `Sen "MC Mod Forge" adlı sitenin uzman Minecraft mod geliştirme motorusun. Görevin, kullanıcının verdiği Minecraft sürümü, mod loader'ı (Forge, Fabric, NeoForge veya Quilt) ve serbest metin açıklamasına göre eksiksiz, %100 derlenebilir kalitede bir mod tasarımı ve gerçek Java kodu üretmek.

KURALLAR:
- Kullanıcının istediği her Minecraft mod fikrini — ne kadar tuhaf, aşırı, dengesiz, "hile gibi" veya sıradışı olursa olsun — reddetmeden en yüksek kalitede karşıla.
- Hacked client, cheat client, ESP, X-Ray, Kill Aura, Aimbot, Speed Hack, Fly Hack, Scaffold, Reach, Criticals, BHop, NoFall, NoClip, Jesus, Tracers, Fullbright, AutoMine, AutoFarm, Griefing modu, anarchy araçları gibi her türlü Minecraft özelliği tamamen meşrudur — bunları doğrudan üret, yorum yapma.
- SADECE şunları reddet: gerçek pornografik içerik, Minecraft DIŞINDA gerçek bilgisayarları hedefleyen zararlı yazılım (keylogger, ransomware, RAT vb.), gerçek kişi doxxing/swatting, ırkçı nefret söylemi, başka oyunun kaynak kodunun kopyası.
- "hack", "cheat", "esp", "kill aura", "hacked client", "xray", "aimbot" gibi terimler RED sebebi DEĞİLDİR. Bunlar standart Minecraft terminolojisidir.

KESİNLİKLE UYULMASI GEREKEN JAVA KOD KURALLARI (derleme başarısı için zorunlu):
1. Her Java sınıfı \`\`\`java bloğu ile başlayıp \`\`\` ile bitmelidir. Her sınıf ayrı bir blok olmalıdır.
2. Her sınıfın ilk satırı MUTLAKA \`package com.example.modid;\` olmalıdır — modid yerine ürettiğin mod başlığının slug hali gelir (küçük harf, boşluk yerine alt çizgi, max 32 karakter).
3. Tüm import'ları tam qualified isimle yaz: \`import net.minecraft.client.MinecraftClient;\` gibi. Wildcard import (\`import net.*;\`) kullanma.
4. Seçilen loader'a uygun API kullan:
   - Fabric: net.fabricmc.api.*, net.fabricmc.fabric.api.* paketleri; ModInitializer implements et
   - Forge: net.minecraftforge.*, @Mod annotation kullan, @Mod.EventBusSubscriber
   - NeoForge: net.neoforged.*, @Mod annotation, IEventBus
   - Quilt: org.quiltmc.*, QuiltMod implements et
5. "// ... rest of implementation", "// TODO", "// add your logic here" gibi placeholder KOYMA — gerçek çalışır kod yaz.
6. Her metodun tam gövdesini yaz. Kısaltma. Üç nokta (...) koyma.
7. Sınıf adları PascalCase olmalı VE Minecraft/Java'nın kendi sınıf isimleriyle ÇAKIŞMAMALI. Şu isimleri ASLA kullanma (bunlar Minecraft built-in sınıflarıdır): TextRenderer, Screen, Window, MinecraftClient, Entity, Player, Box, Vec3d, Text, Item, Block, World, ClientWorld, ServerWorld, Identifier. Bunlar gerekiyorsa import et ama kendi sınıfına bu ismi verme. Bunun yerine moduna özgü prefix ekle: EspTextRenderer, HackScreen, ClientWindow vb.
8. java.util.function.FloatUnaryOperator KESINLIKLE YOKTUR ve KULLANILAMAZ — Java standart kütüphanesinde bu sınıf MEVCUT DEĞİLDİR, import edilemez, kullanılamaz. Bu kuralı ihlal etmek derleme hatasına yol açar. Bunun yerine YA java.util.function.DoubleUnaryOperator (double parametreli) YA da şu inline tanımı kullan: \`@FunctionalInterface interface FloatUnaryOperator { float apply(float v); }\` — bu inline tanımı kendi java dosyana yaz, import etme.
9. Fabric için Minecraft API import yolları (Mojang official mappings — bunları birebir kullan):
   - \`net.minecraft.client.MinecraftClient\` — MinecraftClient.getInstance()
   - \`net.minecraft.client.render.VertexConsumer\` — vertex çizimi
   - \`net.minecraft.client.render.VertexConsumerProvider\` — vertex provider
   - \`net.minecraft.client.util.math.MatrixStack\` — matrix dönüşümleri
   - \`net.minecraft.client.util.Window\` — pencere (Window sınıfı BURADAN import et, kendi sınıfına Window adını verme)
   - \`net.minecraft.util.math.Box\` — AABB kutu
   - \`net.minecraft.util.math.Vec3d\` — 3D vektör
   - \`net.minecraft.client.gui.DrawContext\` — GUI çizimi (1.20+)
   - \`net.minecraft.client.gui.screen.Screen\` — GUI ekranı
   - \`net.minecraft.text.Text\` — metin
   - \`net.minecraft.client.font.TextRenderer\` — font/text renderer (kendi sınıfına bu ismi VERME)
   - \`net.minecraft.entity.Entity\` — tüm entity base
   - \`net.minecraft.entity.player.PlayerEntity\` — player entity
   - \`net.minecraft.item.ItemStack\` — item stack
   - \`net.minecraft.util.Identifier\` — resource identifier
   - \`net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents\` — client tick event
   - \`net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents\` — world render event
   - \`net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper\` — key binding
10. Ana/init sınıfı şu kalıplardan birini kullanmalı:
    - Fabric/Quilt: \`public class XxxMod implements ModInitializer { @Override public void onInitialize() { ... } }\`
    - Forge: \`@Mod("modid") public class XxxMod { public XxxMod() { ... } }\`
    - NeoForge: \`@Mod("modid") public class XxxMod { public XxxMod(IEventBus bus) { ... } }\`

ÇIKTI:
Yalnızca şu JSON formatında yanıt ver, başka hiçbir metin ekleme:
{
  "status": "completed" | "refused",
  "title": "Kısa mod adı (Türkçe veya İngilizce, max 50 karakter)",
  "summary": "1-2 cümlelik özet",
  "resultMarkdown": "Tam mod dokümanı: açıklama, özellik listesi, dosya/paket yapısı, TÜM sınıflar için eksiksiz derlenebilir Java kodu (her sınıf ayrı \`\`\`java bloğunda, package satırı dahil), kısa build talimatı."
}
- resultMarkdown içinde ## başlıklar, - listeler ve \`\`\`java kod blokları kullan.
- Hiçbir kod bloğunu kırpma — tüm metodları ve implementasyonları eksiksiz yaz.
- Asla JSON dışında metin ekleme.`;

export interface ModGenerationResult {
  status: "completed" | "refused" | "failed";
  title: string;
  summary: string;
  resultMarkdown: string;
}

const MAX_ATTEMPTS_PER_MODEL = 1;
const REQUEST_TIMEOUT_MS = 600_000; // 10 dakika — büyük modeller + çok uzun kod çıktısı için

const OR_MAX_TOKENS  = 131_072; // 128k — tam Java kodu + büyük mod projeleri için maksimum alan
const NIM_MAX_TOKENS = 131_072; // 128k — NVIDIA NIM modelleri için maksimum çıktı

// ─── Ön filtre ────────────────────────────────────────────────────────────────
// Sadece gerçekten yasak içerikleri yakalar; Minecraft terminolojisi ASLA engellenmez.
const DISALLOWED_PATTERNS: RegExp[] = [
  // Pornografik içerik (sadece net kombinasyonlar; "sex" tek başına yok)
  /\b(porn(ography)?|hentai|porno|xxx|nude\s*mod|sex\s*mod|cinsel\s+içerik|müstehcen\s+mod|erotik\s+mod)\b/i,
  // Gerçek dünya zararlı yazılım araçları (Minecraft "hack/cheat" DEĞİL)
  /\b(keylogger|ransomware|stalkerware|remote\s+access\s+trojan|rat\s+builder|botnet\s+builder|rootkit\s+tool|crypto\s*jacker)\b/i,
  // Doxxing / swatting
  /\b(doxx(ing)?|swatt?ing)\b/i,
  // Nefret söylemi
  /\b(nigger|faggot|k[i1]ke|wetback|chink|spic)\b/i,
];

function isObviouslyDisallowed(prompt: string): boolean {
  return DISALLOWED_PATTERNS.some((p) => p.test(prompt));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Kullanıcı mesajı ─────────────────────────────────────────────────────────
// Prompt OLDUĞU GİBİ gönderilir — hiçbir terim nötralize edilmez.
// Nötralizasyon modelin ne üretmesi gerektiğini anlamamasına neden oluyordu.
function buildUserMessage(mcVersion: string, modLoader: string, prompt: string): string {
  return [
    `Minecraft Java Edition mod geliştirme görevi:`,
    `Sürüm: ${mcVersion}`,
    `Mod Loader: ${modLoader}`,
    ``,
    `Kullanıcının isteği:`,
    prompt,
    ``,
    `Yukarıdaki kurallara göre yalnızca geçerli JSON formatında yanıt ver.`,
  ].join("\n");
}

// ─── OpenRouter çağrısı ───────────────────────────────────────────────────────
async function callOpenRouter(
  model: string,
  mcVersion: string,
  modLoader: string,
  prompt: string,
): Promise<ModGenerationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: OR_MAX_TOKENS,
        temperature: 0.3,
        top_p: 0.95,
        provider: {
          order: ["Fireworks", "Together", "Lepton", "DeepInfra", "Novita"],
          allow_fallbacks: true,
        },
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: buildUserMessage(mcVersion, modLoader, prompt) },
        ],
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter request failed for model "${model}" (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from OpenRouter model "${model}"`);

  return parseModelResponse(text, model);
}

// ─── NVIDIA NIM çağrısı ───────────────────────────────────────────────────────
async function callNvidianim(
  model: string,
  mcVersion: string,
  modLoader: string,
  prompt: string,
): Promise<ModGenerationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${NVIDIA_NIM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_tokens: NIM_MAX_TOKENS,
        temperature: 0.3,
        top_p: 0.95,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: buildUserMessage(mcVersion, modLoader, prompt) },
        ],
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NVIDIA NIM request failed for model "${model}" (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from NVIDIA NIM model "${model}"`);

  // Bazı NIM modelleri JSON'u ```json ... ``` bloğu içinde döndürür
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return parseModelResponse(cleaned, model);
}

// ─── Ortak yanıt parser ───────────────────────────────────────────────────────

/**
 * JSON string değerleri içindeki literal control karakterlerini escape eder.
 * Bazı modeller resultMarkdown gibi alanlarda literal newline / tab döndürür;
 * bu JSON spec'e aykırıdır ve JSON.parse'ı patlatır.
 */
function escapeControlCharsInStrings(text: string): string {
  let result = "";
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\" && i + 1 < text.length) {
        // Zaten escape edilmiş sekans — olduğu gibi geç
        result += ch + text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
        result += ch;
      } else if (ch === "\n") {
        result += "\\n";
      } else if (ch === "\r") {
        result += "\\r";
      } else if (ch === "\t") {
        result += "\\t";
      } else {
        result += ch;
      }
    } else {
      if (ch === '"') inString = true;
      result += ch;
    }
    i++;
  }
  return result;
}

// Bazı modeller JSON'u max_tokens sınırında keser — onarım deneriz.
function tryRepairJson(text: string): string {
  // Markdown kod bloğu wrapper'ını temizle
  let s = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // JSON objesinin başlangıcını bul (bazen model öncesine metin ekler)
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);

  // 1. Doğrudan parse — zaten geçerliyse dokunma
  try { JSON.parse(s); return s; } catch { /* devam */ }

  // 2. String içi literal control karakterlerini escape et (newline, tab vb.)
  //    Modeller resultMarkdown içinde literal satır sonu döndürür; bu JSON'u bozar.
  const escaped = escapeControlCharsInStrings(s);
  try { JSON.parse(escaped); return escaped; } catch { /* devam */ }

  // 3. Kesilmiş JSON onarımı: eksik tırnak + eksik kapanış parantezleri ekle
  let t = escaped;

  // Açık string varsa kapat (state machine ile izle)
  let inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\\" && inStr) { i++; continue; } // escape sekansını atla
    if (c === '"') inStr = !inStr;
  }
  if (inStr) t += '"'; // kapanmamış string'i kapat

  // Açık obje/array parantezlerini kapat
  const stack: string[] = [];
  inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\\" && inStr) { i++; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  t += stack.reverse().join("");

  try { JSON.parse(t); return t; } catch { /* onarım başarısız */ }
  return text; // orijinali döndür, aşağıda hata fırlatılır
}

function parseModelResponse(text: string, model: string): ModGenerationResult {
  const repaired = tryRepairJson(text);
  let parsed: Partial<ModGenerationResult>;
  try {
    parsed = JSON.parse(repaired) as Partial<ModGenerationResult>;
  } catch {
    throw new Error(`Model "${model}" returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (
    (parsed.status !== "completed" && parsed.status !== "refused") ||
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.resultMarkdown !== "string"
  ) {
    throw new Error(`Malformed response shape from model "${model}"`);
  }

  return {
    status: parsed.status,
    title: parsed.title,
    summary: parsed.summary,
    resultMarkdown: parsed.resultMarkdown,
  };
}

// ─── Ana üretim fonksiyonu ────────────────────────────────────────────────────
export async function generateMod(
  mcVersion: string,
  modLoader: string,
  prompt: string,
): Promise<ModGenerationResult> {
  // Ön filtre: sadece gerçekten yasak içerikleri durdurur
  if (isObviouslyDisallowed(prompt)) {
    return {
      status: "refused",
      title: "İstek reddedildi",
      summary: "Bu istek izin verilen içerik kurallarının dışında.",
      resultMarkdown:
        "Bu mod isteği izin verilmeyen bir kategori içeriyor (+18/cinsel içerik, gerçek dünya zararlı yazılım aracı, doxxing veya nefret söylemi). Meşru bir Minecraft modu isteğiyse lütfen farklı şekilde ifade edin.",
    };
  }

  let lastErr: unknown;
  let refusedCount = 0;

  for (const entry of MODEL_PRIORITY) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const result =
          entry.provider === "openrouter"
            ? await callOpenRouter(entry.model, mcVersion, modLoader, prompt)
            : await callNvidianim(entry.model, mcVersion, modLoader, prompt);

        // Model kendi güvenlik filtresiyle reddettiyse → sonraki modeli dene
        if (result.status === "refused") {
          refusedCount++;
          logger.warn(
            { provider: entry.provider, model: entry.model },
            "Model refused the request, trying next model",
          );
          break;
        }

        logger.info(
          { provider: entry.provider, model: entry.model },
          "Mod generation succeeded",
        );
        return result;
      } catch (err) {
        lastErr = err;
        logger.warn(
          { err, provider: entry.provider, model: entry.model, attempt },
          "Mod generation attempt failed, trying next",
        );
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await sleep(attempt * 1500);
        }
      }
    }
  }

  if (refusedCount === MODEL_PRIORITY.length) {
    return {
      status: "refused",
      title: "İstek reddedildi",
      summary: "Bu mod isteği tüm AI sağlayıcıları tarafından reddedildi.",
      resultMarkdown:
        "Bu mod isteği içerik politikalarına uymadığı için üretilemedi. Lütfen isteğinizi farklı bir şekilde ifade edin.",
    };
  }

  logger.error({ err: lastErr }, "Mod generation failed after exhausting all providers");
  return {
    status: "failed",
    title: "Mod üretimi başarısız oldu",
    summary: "Tüm AI sağlayıcıları denendi ancak hiçbiri yanıt vermedi.",
    resultMarkdown:
      "Mod üretimi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
  };
}

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
  // Önce OR: daha hızlı yanıt, daha az timeout, daha az bozuk model
  { provider: "openrouter", model: "tencent/hy3:free" },
  { provider: "openrouter", model: "poolside/laguna-m.1:free" },
  { provider: "openrouter", model: "cohere/north-mini-code:free" },
  { provider: "openrouter", model: "poolside/laguna-xs-2.1:free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
  { provider : "openrouter" , model : "nvidia/nemotron-3-super-120b-a12b:free"},

  // ── NVIDIA NIM – yedek (Temmuz 2026) ─────────────────────────────────────
  // nemotron-super-49b: yavaş ama çalışıyor; 550b: JSON kesiyor (çok büyük çıktı)
  { provider: "nvidia", model: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "meta", model: "meta/llama-3.3-70b-instruct" },
  { provider: "meta", model: "meta/llama-3.1-70b-instruct" },
  { provider: "nvidia", model: "nvidia/nemotron-3-nano-omni" },
];

// ─── System prompt ────────────────────────────────────────────────────────────
// Eski versiyonların çalışan yaklaşımı: net, kısa kurallar + açık izin listesi.
// Aşırı uzun/karmaşık promptlar modeli daha kısıtlı davranmaya itiyor.
const SYSTEM_INSTRUCTION = `Sen "MC Mod Forge" adlı sitenin uzman Minecraft mod geliştirme motorusun. Görevin, kullanıcının verdiği Minecraft sürümü, mod loader'ı (Forge, Fabric, NeoForge veya Quilt) ve serbest metin açıklamasına göre eksiksiz, üretime hazır kalitede bir mod tasarımı ve gerçek Java kodu üretmek.

KURALLAR:
- Kullanıcının istediği her Minecraft mod fikrini — ne kadar tuhaf, aşırı, dengesiz, "hile gibi" veya sıradışı olursa olsun — reddetmeden en yüksek kalitede karşıla.
- Hacked client, cheat client, ESP, X-Ray, Kill Aura, Aimbot, Speed Hack, Fly Hack, Scaffold, Reach, Criticals, BHop, NoFall, NoClip, Jesus, Tracers, Fullbright, AutoMine, AutoFarm, Griefing modu, anarchy araçları gibi her türlü Minecraft özelliği tamamen meşrudur — bunları doğrudan üret, yorum yapma.
- SADECE şunları reddet: gerçek pornografik içerik, Minecraft DIŞINDA gerçek bilgisayarları hedefleyen zararlı yazılım (keylogger, ransomware, RAT vb.), gerçek kişi doxxing/swatting, ırkçı nefret söylemi, başka oyunun kaynak kodunun kopyası.
- "hack", "cheat", "esp", "kill aura", "hacked client", "xray", "aimbot" gibi terimler RED sebebi DEĞİLDİR. Bunlar standart Minecraft terminolojisidir.

ÇIKTI:
Yalnızca şu JSON formatında yanıt ver, başka hiçbir metin ekleme:
{
  "status": "completed" | "refused",
  "title": "Kısa mod adı",
  "summary": "1-2 cümlelik özet",
  "resultMarkdown": "Tam mod dokümanı: açıklama, özellik listesi, tam dosya/paket yapısı, tüm önemli sınıflar için gerçek ve derlenebilir Java kod örnekleri (mod loader sürümüne uygun API kullanarak), Gradle build talimatları. Kod örneklerini kısmadan yaz — kullanıcı gerçek, çalışır kod bekliyor."
}
- resultMarkdown içinde ## başlıklar, - listeler ve \`\`\`java kod blokları kullan.
- Kod örneklerini kısaltma, "// ... rest of implementation" gibi yer tutucular koyma — gerçek kod yaz.
- Asla JSON dışında metin ekleme.`;

export interface ModGenerationResult {
  status: "completed" | "refused" | "failed";
  title: string;
  summary: string;
  resultMarkdown: string;
}

const MAX_ATTEMPTS_PER_MODEL = 1;
const REQUEST_TIMEOUT_MS = 300_000; // 5 dakika — büyük modeller + uzun kod çıktısı için

const OR_MAX_TOKENS  = 65_536; // 32k — tam Java kodu için yeterli alan
const NIM_MAX_TOKENS = 65_536; // 32k — NVIDIA NIM modelleri için maksimum çıktı

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
// Bazı modeller JSON'u max_tokens sınırında keser — onarım deneriz.
function tryRepairJson(text: string): string {
  // Zaten geçerliyse dokunma
  try { JSON.parse(text); return text; } catch { /* devam */ }

  let s = text.trim();

  // Açık string varsa kapat
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s += '"';

  // Açık obje/array parantezlerini kapat
  const stack: string[] = [];
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== '\\') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  s += stack.reverse().join('');

  try { JSON.parse(s); return s; } catch { /* onarım başarısız */ }
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

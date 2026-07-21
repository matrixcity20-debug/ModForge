import { logger } from "./logger";

const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"] ?? "";
const NVIDIA_NIM_API_KEY = process.env["NVIDIA_NIM_API_KEY"] ?? "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModContext {
  title: string;
  mcVersion: string;
  modLoader: string;
  prompt: string;
  resultMarkdown: string;
}

// Kullanıcıya sunulacak modeller
export const AVAILABLE_CHAT_MODELS = [
  { id: "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron Ultra 550B", provider: "openrouter" },
  { id: "openrouter:poolside/laguna-m.1:free",                label: "Laguna M.1",         provider: "openrouter" },
  { id: "openrouter:tencent/hy3:free",                        label: "Hunyuan 3",          provider: "openrouter" },
  { id: "openrouter:google/gemma-4-31b-it:free",              label: "Gemma 4 31B",        provider: "openrouter" },
  { id: "openrouter:cohere/north-mini-code:free",             label: "North Mini Code",    provider: "openrouter" },
  { id: "openrouter:nvidia/nemotron-3-super-120b-a12b:free",  label: "Nemotron Super 120B",provider: "openrouter" },
  { id: "nvidia:nvidia/nemotron-3-ultra-550b-a55b",           label: "Nemotron Ultra (NIM)",provider: "nvidia"    },
  { id: "nvidia:meta/llama-3.3-70b-instruct",                 label: "Llama 3.3 70B (NIM)",provider: "nvidia"    },
] as const;

function buildSystemPrompt(ctx: ModContext): string {
  const codeSection = ctx.resultMarkdown
    ? `\n\nMEVCUT MOD KODU VE MİMARİSİ:\n${ctx.resultMarkdown}`
    : "";

  return `Sen "MC Mod Forge" atölyesinde bir Minecraft mod geliştirme asistanısın. Kullanıcı sana aşağıdaki modu geliştirmek için danışıyor. Onunla birlikte bu modu iyileştirebilir, yeni özellikler ekleyebilir, hataları düzeltebilir ve eksiksiz Java kodu yazabilirsin.

MOD BİLGİLERİ:
- Başlık: ${ctx.title}
- Minecraft Sürümü: ${ctx.mcVersion}
- Mod Loader: ${ctx.modLoader}
- Orijinal İstem: ${ctx.prompt}${codeSection}

KURALLAR:
- Her zaman Türkçe yanıt ver.
- Java kodu yazarken ${ctx.modLoader} API'sini ve MC ${ctx.mcVersion} için doğru import yollarını kullan.
- Kod bloklarını \`\`\`java ... \`\`\` formatında sun.
- Kullanıcının isteklerini reddetmeden karşıla — ne kadar karmaşık, dengesiz veya sıradışı olursa olsun.
- Mevcut kod yapısı ve paket isimleriyle tutarlı ol.
- Gerçek, derlenebilir kod yaz; placeholder veya "TODO" koyma.`;
}

// ─── SSE stream okuyucu ────────────────────────────────────────────────────────

async function parseSSEStream(
  res: Response,
  onChunk: (text: string) => void,
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      } catch {
        // Malformed SSE satırı — yoksay
      }
    }
  }
}

// ─── OpenRouter streaming ─────────────────────────────────────────────────────

async function streamOpenRouter(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 16384,
      temperature: 0.7,
      provider: {
        order: ["Fireworks", "Together", "Lepton", "DeepInfra", "Novita"],
        allow_fallbacks: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter stream başarısız (${res.status}): ${body.slice(0, 300)}`);
  }

  await parseSSEStream(res, onChunk);
}

// ─── NVIDIA NIM streaming ─────────────────────────────────────────────────────

async function streamNvidia(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NVIDIA_NIM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 16384,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NVIDIA NIM stream başarısız (${res.status}): ${body.slice(0, 300)}`);
  }

  await parseSSEStream(res, onChunk);
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

export async function streamChatResponse(
  modelId: string,
  modCtx: ModContext,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const colonIdx = modelId.indexOf(":");
  if (colonIdx === -1) throw new Error(`Geçersiz model ID: ${modelId}`);

  const providerPrefix = modelId.slice(0, colonIdx);
  const model = modelId.slice(colonIdx + 1);

  const apiMessages: { role: string; content: string }[] = [
    { role: "system", content: buildSystemPrompt(modCtx) },
    ...messages,
  ];

  logger.info({ modelId, providerPrefix, msgCount: messages.length }, "Chat stream başlatılıyor");

  if (providerPrefix === "openrouter") {
    await streamOpenRouter(model, apiMessages, onChunk);
  } else if (providerPrefix === "nvidia") {
    await streamNvidia(model, apiMessages, onChunk);
  } else {
    throw new Error(`Bilinmeyen sağlayıcı: ${providerPrefix}`);
  }
}

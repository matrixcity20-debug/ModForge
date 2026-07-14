/**
 * cloudBuilder.ts
 * Sunucu tarafında Gradle ile mod derler; hata varsa AI ile düzeltir ve yeniden dener.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

// ─── Tip tanımları ────────────────────────────────────────────────────────────

export type BuildEvent =
  | { type: "log";   message: string }
  | { type: "ready"; token: string; filename: string }
  | { type: "fail";  message: string };

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const MAX_FIX_ATTEMPTS = 3;
const GRADLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 dakika — ilk Minecraft indirmesi uzun olabilir
const AI_FIX_TIMEOUT_MS = 90_000;         // 90 saniye AI yanıt bekle

/** Tüm buildler için ortak Gradle cache → Minecraft jar'ları bir kez indirilir */
const GRADLE_CACHE_DIR = path.join(os.homedir(), ".modforge-gradle-cache");

/** Derlenmiş jar'lar geçici olarak bellekte tutulur (30 dakika) */
const JAR_TTL_MS = 30 * 60 * 1000;
const compiledJars = new Map<string, { buffer: Buffer; filename: string; expires: number }>();

/** Eş zamanlı derleme sınırı */
let activeBuilds = 0;
const MAX_CONCURRENT_BUILDS = 2;

// Her 10 dakikada bir süresi dolmuş jar'ları temizle
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of compiledJars) {
    if (entry.expires < now) compiledJars.delete(token);
  }
}, 10 * 60 * 1000);

// ─── Jar deposu (indirme token yönetimi) ─────────────────────────────────────

export function storeJar(buffer: Buffer, filename: string): string {
  const token = randomBytes(16).toString("hex");
  compiledJars.set(token, { buffer, filename, expires: Date.now() + JAR_TTL_MS });
  return token;
}

export function consumeJar(token: string): { buffer: Buffer; filename: string } | null {
  const entry = compiledJars.get(token);
  if (!entry) return null;
  compiledJars.delete(token); // tek kullanım
  return entry;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

async function checkJava(): Promise<void> {
  try {
    await execFileAsync("java", ["-version"]);
  } catch {
    throw new Error(
      "Java bulunamadı. Sunucuya Java 21+ kurulu olması gerekiyor. " +
        "https://adoptium.net adresinden Eclipse Temurin 21 yükleyin.",
    );
  }
}

async function extractZip(zipBuffer: Buffer, destDir: string): Promise<void> {
  const zip = await JSZip.loadAsync(zipBuffer);
  await Promise.all(
    Object.entries(zip.files).map(async ([relativePath, entry]) => {
      const fullPath = path.join(destDir, relativePath);
      if (entry.dir) {
        await fs.mkdir(fullPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        const buf = await entry.async("nodebuffer");
        await fs.writeFile(fullPath, buf);
      }
    }),
  );
}

async function findBuiltJar(buildDir: string): Promise<string | null> {
  const libsDir = path.join(buildDir, "build", "libs");
  try {
    const files = await fs.readdir(libsDir);
    const jar = files.find(
      (f) => f.endsWith(".jar") && !f.includes("-sources") && !f.includes("-javadoc"),
    );
    return jar ? path.join(libsDir, jar) : null;
  } catch {
    return null;
  }
}

// ─── Hata ayrıştırma ─────────────────────────────────────────────────────────

/**
 * Gradle/javac çıktısından Java derleme hatalarını dosyaya göre gruplar.
 * Döndürür: Map<relative_file_path, error_lines[]>
 */
function parseJavaErrors(output: string, buildDir: string): Map<string, string[]> {
  const fileErrors = new Map<string, string[]>();
  const lines = output.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Javac error line: /abs/path/File.java:42: error: cannot find symbol
    const m = line.match(/^(.+\.java):(\d+):\s+error:\s+(.+)$/);
    if (!m) continue;

    const fullPath = m[1]!;
    const lineNum  = m[2]!;
    const errMsg   = m[3]!;

    // Sonraki 4 satıra bak (^ işaretçisi ve symbol: satırları)
    const ctx: string[] = [];
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const cl = lines[j] ?? "";
      if (cl.match(/^.+\.java:\d+:/)) break;
      ctx.push(cl);
    }

    // Tam path'i build dizinine göre göreli yap
    const relative = path.relative(buildDir, fullPath);
    if (relative.startsWith("..")) continue; // build dışı dosya

    if (!fileErrors.has(relative)) fileErrors.set(relative, []);
    fileErrors.get(relative)!.push(`Satır ${lineNum}: ${errMsg}\n${ctx.join("\n")}`);
  }

  return fileErrors;
}

// ─── Gradle çalıştırma ────────────────────────────────────────────────────────

interface GradleResult {
  success: boolean;
  output: string;
  fileErrors: Map<string, string[]>;
}

function runGradle(buildDir: string, onLog: (msg: string) => void): Promise<GradleResult> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const isWin = process.platform === "win32";
    const cmd   = isWin ? path.join(buildDir, "gradlew.bat") : "./gradlew";
    const args  = ["build", "-x", "test", "--no-daemon", "--stacktrace"];

    const child = spawn(cmd, args, {
      cwd: buildDir,
      shell: isWin,
      env: {
        ...process.env,
        GRADLE_USER_HOME: GRADLE_CACHE_DIR,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // gradlew'i çalıştırılabilir yap (Unix)
    if (!isWin) {
      fs.chmod(path.join(buildDir, "gradlew"), 0o755).catch(() => {});
    }

    const handle = (data: Buffer) => {
      const text = data.toString();
      chunks.push(text);
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t && !t.startsWith("Note:") && t.length < 300) onLog(t);
      }
    };

    child.stdout?.on("data", handle);
    child.stderr?.on("data", handle);

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        success: false,
        output: "Derleme zaman aşımına uğradı (20 dk).",
        fileErrors: new Map(),
      });
    }, GRADLE_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      const output = chunks.join("");
      resolve({
        success: code === 0,
        output,
        fileErrors: code === 0 ? new Map() : parseJavaErrors(output, buildDir),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, output: err.message, fileErrors: new Map() });
    });
  });
}

// ─── AI ile hata düzeltme ─────────────────────────────────────────────────────

const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"] ?? "";

async function aiFixFile(
  filename: string,
  source: string,
  errors: string[],
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;

  const errBlock = errors.map((e, i) => `${i + 1}. ${e}`).join("\n\n");
  const prompt = [
    `You are an expert Minecraft mod Java developer.`,
    `Fix ALL compilation errors in the following Java source file.`,
    `Return ONLY the fixed Java source code — no explanation, no markdown fences.`,
    ``,
    `FILE: ${filename}`,
    ``,
    `COMPILATION ERRORS:`,
    errBlock,
    ``,
    `SOURCE:`,
    source,
  ].join("\n");

  // Hızlı ve ücretsiz modeller dene, ilk başarılı cevabı kullan
  const models = [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "cohere/north-mini-code:free",
  ];

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(AI_FIX_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "You are a Java expert. Fix compilation errors. Return only raw Java code, no markdown fences.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      // Markdown fence varsa soy
      return content
        .replace(/^```java\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/m, "")
        .trim();
    } catch {
      continue;
    }
  }

  return null;
}

// ─── Ana derleme fonksiyonu ───────────────────────────────────────────────────

/**
 * zipBuffer: Mod kaynak kodu ZIP'i (buildSourceJar çıktısı)
 * onEvent: SSE olaylarını gönderir
 */
export async function buildMod(
  zipBuffer: Buffer,
  onEvent: (event: BuildEvent) => void,
): Promise<void> {
  if (activeBuilds >= MAX_CONCURRENT_BUILDS) {
    onEvent({ type: "fail", message: "Sunucuda şu an maksimum derleme kapasitesine ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin." });
    return;
  }

  activeBuilds++;
  const log = (msg: string) => onEvent({ type: "log", message: msg });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "modforge-build-"));

  try {
    log("📦 Kaynak dosyalar açılıyor...");
    await extractZip(zipBuffer, tmpDir);

    log("☕ Java ortamı kontrol ediliyor...");
    await checkJava();

    await fs.mkdir(GRADLE_CACHE_DIR, { recursive: true });
    log(`📂 Gradle önbelleği: ${GRADLE_CACHE_DIR}`);

    for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
      if (attempt === 1) {
        log("🔨 Derleme başlıyor...");
        log("   ⏳ İlk Minecraft sürümü için ~5-15 dakika sürebilir");
        log("   📥 Gradle + Minecraft bağımlılıkları indiriliyor...");
      } else {
        log(`🔧 AI düzeltmesi sonrası yeniden derleme (deneme ${attempt}/${MAX_FIX_ATTEMPTS})...`);
      }

      const result = await runGradle(tmpDir, log);

      if (result.success) {
        log("✅ Derleme başarılı!");
        const jarPath = await findBuiltJar(tmpDir);
        if (!jarPath) throw new Error(".jar dosyası build/libs/ içinde bulunamadı.");

        const jarBuffer = await fs.readFile(jarPath);
        const filename  = path.basename(jarPath);
        const token     = storeJar(jarBuffer, filename);

        log(`📦 .jar hazır: ${filename}`);
        onEvent({ type: "ready", token, filename });
        return;
      }

      // Başarısız
      const errorFileCount = result.fileErrors.size;

      if (attempt >= MAX_FIX_ATTEMPTS || errorFileCount === 0) {
        throw new Error(
          errorFileCount === 0
            ? "Derleme hatası alındı ancak Java hataları ayrıştırılamadı. Kaynak kodu indirerek manuel derleme yapabilirsiniz."
            : `${MAX_FIX_ATTEMPTS} denemeden sonra derleme başarısız oldu.`,
        );
      }

      log(`❌ ${errorFileCount} dosyada hata var. AI düzeltme yapıyor...`);

      for (const [relFile, errors] of result.fileErrors) {
        const fullPath = path.join(tmpDir, relFile);
        try {
          const source = await fs.readFile(fullPath, "utf8");
          log(`  🤖 ${path.basename(relFile)} düzeltiliyor (${errors.length} hata)...`);
          const fixed = await aiFixFile(path.basename(relFile), source, errors);
          if (fixed) {
            await fs.writeFile(fullPath, fixed, "utf8");
            log(`  ✓ ${path.basename(relFile)} güncellendi`);
          } else {
            log(`  ⚠ ${path.basename(relFile)} AI yanıt vermedi, orijinal bırakıldı`);
          }
        } catch (e) {
          log(`  ⚠ ${path.basename(relFile)} işlenirken hata: ${String(e)}`);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "cloudBuilder: build failed");
    onEvent({ type: "fail", message: err instanceof Error ? err.message : String(err) });
  } finally {
    activeBuilds--;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

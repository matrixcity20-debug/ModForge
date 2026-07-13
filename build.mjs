import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, cp } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist/server");
  await rm(distDir, { recursive: true, force: true });

  const shared = {
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "pg-native",
      "bufferutil",
      "utf-8-validate",
    ],
    sourcemap: "linked",
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
    },
  };

  // Main server (includes migrate.ts via import)
  await esbuild({
    ...shared,
    entryPoints: [path.resolve(__dirname, "server/index.ts")],
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  });

  // Copy static server assets (gradle-wrapper etc.) into dist/assets
  const srcAssets = path.resolve(__dirname, "server/assets");
  const dstAssets = path.resolve(__dirname, "dist/assets");
  await cp(srcAssets, dstAssets, { recursive: true });
  console.log("Copied server/assets → dist/assets");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

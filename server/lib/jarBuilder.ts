import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";

function getAssetsRoot(): string {
  const base =
    process.env.NODE_ENV === "production"
      ? path.resolve(process.cwd(), "dist/assets")
      : path.resolve(process.cwd(), "server/assets");
  return path.join(base, "gradle-wrapper");
}

interface ModData {
  title: string;
  mcVersion: string;
  modLoader: string;
  prompt: string;
  resultMarkdown: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "my_mod";
}

// ─── Kesin versiyon tablosu ─────────────────────────────────────────────────
// Wildcard (+) yerine kesin çalıştığı doğrulanan versiyonlar.
// Yanlış / belirsiz versiyon = derleme hatası. Bu tablo her şeyi sabitler.

interface FabricVersions {
  loom: string;
  loader: string;
  api: string;
  java: number;
}
interface ForgeVersions {
  forgeGradle: string;
  forge: string; // "mcVersion-forgeVersion" tam olarak
  java: number;
}
interface NeoForgeVersions {
  mdg: string;
  neoforge: string;
  java: number;
}
interface QuiltVersions {
  loom: string;
  loader: string;
  qfapi: string;
  java: number;
}

const FABRIC_VERSIONS: Record<string, FabricVersions> = {
  "1.21.4": { loom: "1.9.2", loader: "0.16.10", api: "0.115.0+1.21.4", java: 21 },
  "1.21.3": { loom: "1.9.2", loader: "0.16.9",  api: "0.110.5+1.21.3", java: 21 },
  "1.21.1": { loom: "1.7.4", loader: "0.16.5",  api: "0.107.0+1.21.1", java: 21 },
  "1.21":   { loom: "1.7.4", loader: "0.15.11", api: "0.100.7+1.21",   java: 21 },
  "1.20.6": { loom: "1.7.1", loader: "0.15.11", api: "0.99.2+1.20.6",  java: 21 },
  "1.20.4": { loom: "1.4.5", loader: "0.15.7",  api: "0.96.11+1.20.4", java: 17 },
  "1.20.2": { loom: "1.3.12",loader: "0.14.25", api: "0.91.6+1.20.2",  java: 17 },
  "1.20.1": { loom: "1.3.12",loader: "0.14.25", api: "0.92.2+1.20.1",  java: 17 },
  "1.19.4": { loom: "1.2.7", loader: "0.14.23", api: "0.87.2+1.19.4",  java: 17 },
  "1.19.2": { loom: "1.0.18",loader: "0.14.23", api: "0.77.0+1.19.2",  java: 17 },
  "1.18.2": { loom: "0.12.12",loader:"0.14.23", api: "0.73.2+1.18.2",  java: 17 },
};

const FORGE_VERSIONS: Record<string, ForgeVersions> = {
  "1.21.1": { forgeGradle: "6.0.24", forge: "1.21.1-52.0.13", java: 21 },
  "1.20.6": { forgeGradle: "6.0.24", forge: "1.20.6-50.1.0",  java: 21 },
  "1.20.4": { forgeGradle: "6.0.24", forge: "1.20.4-49.1.0",  java: 17 },
  "1.20.2": { forgeGradle: "6.0.24", forge: "1.20.2-48.1.0",  java: 17 },
  "1.20.1": { forgeGradle: "6.0.24", forge: "1.20.1-47.3.0",  java: 17 },
  "1.19.4": { forgeGradle: "6.0.24", forge: "1.19.4-45.3.0",  java: 17 },
  "1.19.2": { forgeGradle: "5.1.73", forge: "1.19.2-43.3.0",  java: 17 },
  "1.18.2": { forgeGradle: "5.1.73", forge: "1.18.2-40.2.21", java: 17 },
};

const NEOFORGE_VERSIONS: Record<string, NeoForgeVersions> = {
  "1.21.4": { mdg: "2.0.8",  neoforge: "21.4.42",  java: 21 },
  "1.21.3": { mdg: "2.0.8",  neoforge: "21.3.72",  java: 21 },
  "1.21.1": { mdg: "2.0.6",  neoforge: "21.1.94",  java: 21 },
  "1.20.4": { mdg: "1.0.21", neoforge: "20.4.237", java: 17 },
};

const QUILT_VERSIONS: Record<string, QuiltVersions> = {
  "1.21.1": { loom: "1.8.0", loader: "0.27.1", qfapi: "11.0.0-alpha.3+0.107.0+1.21.1", java: 21 },
  "1.20.1": { loom: "1.4.1", loader: "0.26.3", qfapi: "9.0.0-alpha.11+0.91.6+1.20.1",  java: 17 },
};

// Versiyon tablosunda yoksa en yakın bilinen versiyonu döndür
function getFabricVersions(mcVersion: string): FabricVersions {
  if (FABRIC_VERSIONS[mcVersion]) return FABRIC_VERSIONS[mcVersion]!;
  // En yüksek MC versiyonundan küçük veya eşit olanı seç
  const keys = Object.keys(FABRIC_VERSIONS).sort().reverse();
  for (const k of keys) {
    if (mcVersion >= k) return FABRIC_VERSIONS[k]!;
  }
  return FABRIC_VERSIONS["1.20.1"]!;
}

function getForgeVersions(mcVersion: string): ForgeVersions {
  if (FORGE_VERSIONS[mcVersion]) return FORGE_VERSIONS[mcVersion]!;
  const keys = Object.keys(FORGE_VERSIONS).sort().reverse();
  for (const k of keys) {
    if (mcVersion >= k) return FORGE_VERSIONS[k]!;
  }
  return FORGE_VERSIONS["1.20.1"]!;
}

function getNeoForgeVersions(mcVersion: string): NeoForgeVersions {
  if (NEOFORGE_VERSIONS[mcVersion]) return NEOFORGE_VERSIONS[mcVersion]!;
  const keys = Object.keys(NEOFORGE_VERSIONS).sort().reverse();
  for (const k of keys) {
    if (mcVersion >= k) return NEOFORGE_VERSIONS[k]!;
  }
  return NEOFORGE_VERSIONS["1.21.1"]!;
}

function getQuiltVersions(mcVersion: string): QuiltVersions {
  if (QUILT_VERSIONS[mcVersion]) return QUILT_VERSIONS[mcVersion]!;
  const keys = Object.keys(QUILT_VERSIONS).sort().reverse();
  for (const k of keys) {
    if (mcVersion >= k) return QUILT_VERSIONS[k]!;
  }
  return QUILT_VERSIONS["1.21.1"]!;
}

// ─── Java dosya çıkarma ve düzeltme ─────────────────────────────────────────

interface JavaFile {
  className: string;
  packageName: string; // Gerçek paket (düzeltilmiş)
  content: string;
  isMainClass: boolean; // ModInitializer / @Mod / entrypoint
}

function fixPackageDeclaration(code: string, correctPackage: string): string {
  // Mevcut package satırını doğru paketle değiştir
  if (/^\s*package\s+[\w.]+\s*;/m.test(code)) {
    return code.replace(/^\s*package\s+[\w.]+\s*;/m, `package ${correctPackage};`);
  }
  // Hiç package yoksa en başa ekle
  return `package ${correctPackage};\n\n${code}`;
}

function detectClassName(code: string, fallbackIndex: number): string {
  // public class/interface/enum/record Foo → Foo
  const classMatch = code.match(/(?:public\s+)?(?:class|interface|enum|record)\s+(\w+)/);
  return classMatch ? classMatch[1]! : `GeneratedClass${fallbackIndex}`;
}

function isMainClass(code: string, loader: string): boolean {
  const loaderLower = loader.toLowerCase();
  if (loaderLower === "fabric" || loaderLower === "quilt") {
    return (
      /implements\s+(?:[\w.]*?)ModInitializer/.test(code) ||
      /void\s+onInitialize\s*\(\s*\)/.test(code) ||
      /@Environment\s*\(\s*EnvType\.CLIENT\s*\)/.test(code) === false && // not client-only
      /implements\s+ClientModInitializer/.test(code) === false &&
      /class\s+\w+Mod\b/.test(code)
    );
  }
  if (loaderLower === "forge" || loaderLower === "neoforge") {
    return /@Mod\s*\(/.test(code);
  }
  return false;
}

function extractJavaFiles(markdown: string, modId: string, modLoader: string): JavaFile[] {
  const files: JavaFile[] = [];
  const correctPackage = `com.example.${modId}`;
  const regex = /```java\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(markdown)) !== null) {
    const raw = match[1]!.trim();
    const fixedCode = fixPackageDeclaration(raw, correctPackage);
    const className = detectClassName(fixedCode, ++index);
    const isMain = isMainClass(raw, modLoader);
    files.push({
      className,
      packageName: correctPackage,
      content: fixedCode,
      isMainClass: isMain,
    });
  }

  return files;
}

// Ana sınıfı bul (yoksa ilk sınıfı kullan)
function findMainClass(files: JavaFile[]): JavaFile | undefined {
  return files.find((f) => f.isMainClass) ?? files[0];
}

// ─── Build dosyaları ────────────────────────────────────────────────────────

function buildBuildGradle(modId: string, mcVersion: string, modLoader: string): string {
  const loaderLower = modLoader.toLowerCase();

  if (loaderLower === "fabric") {
    const v = getFabricVersions(mcVersion);
    return `plugins {
    id 'fabric-loom' version '${v.loom}'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
    archivesName = project.archives_base_name
}

repositories {
    maven { url = 'https://maven.fabricmc.net/' }
}

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings loom.officialMojangMappings()
    modImplementation "net.fabricmc:fabric-loader:${v.loader}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:${v.api}"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(${v.java})
    }
    withSourcesJar()
}

processResources {
    inputs.property "version", project.version
    filteringCharset "UTF-8"
    filesMatching("fabric.mod.json") {
        expand "version": project.version
    }
}

tasks.withType(JavaCompile).configureEach {
    it.options.encoding = "UTF-8"
    it.options.release = ${v.java}
}
`;
  }

  if (loaderLower === "quilt") {
    const v = getQuiltVersions(mcVersion);
    return `plugins {
    id 'org.quiltmc.loom' version '${v.loom}'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

repositories {
    maven { url = 'https://maven.quiltmc.org/repository/release' }
    maven { url = 'https://maven.fabricmc.net/' }
}

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings loom.officialMojangMappings()
    modImplementation "org.quiltmc:quilt-loader:${v.loader}"
    modImplementation "org.quiltmc.quilted-fabric-api:quilted-fabric-api:${v.qfapi}"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(${v.java})
    }
    withSourcesJar()
}

tasks.withType(JavaCompile).configureEach {
    it.options.encoding = "UTF-8"
    it.options.release = ${v.java}
}
`;
  }

  if (loaderLower === "neoforge") {
    const v = getNeoForgeVersions(mcVersion);
    return `plugins {
    id 'net.neoforged.moddevgradle' version '${v.mdg}'
}

version = "1.0.0"
group = "com.example.${modId}"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(${v.java})
    }
}

neoForge {
    version = "${v.neoforge}"

    runs {
        client {
            client()
        }
        server {
            server()
        }
    }

    mods {
        ${modId} {
            sourceSet sourceSets.main
        }
    }
}

repositories {
    maven { url = 'https://maven.neoforged.net/releases' }
}

dependencies {}

tasks.withType(JavaCompile).configureEach {
    it.options.encoding = "UTF-8"
    it.options.release = ${v.java}
}
`;
  }

  // Forge (varsayılan)
  const v = getForgeVersions(mcVersion);
  return `buildscript {
    repositories {
        maven { url = 'https://maven.minecraftforge.net' }
        mavenCentral()
    }
    dependencies {
        classpath group: 'net.minecraftforge.gradle', name: 'ForgeGradle', version: '${v.forgeGradle}'
    }
}

apply plugin: 'net.minecraftforge.gradle'

version = '1.0.0'
group = 'com.example.${modId}'
archivesBaseName = '${modId}'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(${v.java})
    }
}

minecraft {
    mappings channel: 'official', version: '${mcVersion}'

    runs {
        client {
            workingDirectory project.file('run')
            property 'forge.logging.markers', 'REGISTRIES'
            property 'forge.logging.console.level', 'debug'
            mods {
                ${modId} { source sourceSets.main }
            }
        }
        server {
            workingDirectory project.file('run')
            property 'forge.logging.markers', 'REGISTRIES'
            property 'forge.logging.console.level', 'debug'
            mods {
                ${modId} { source sourceSets.main }
            }
        }
    }
}

dependencies {
    minecraft 'net.minecraftforge:forge:${v.forge}'
}

tasks.withType(JavaCompile).configureEach {
    it.options.encoding = "UTF-8"
    it.options.release = ${v.java}
}
`;
}

function buildSettingsGradle(modId: string, modLoader: string): string {
  const loaderLower = modLoader.toLowerCase();

  // NeoForge: kendi plugin management'ını kullanır
  if (loaderLower === "neoforge") {
    return `pluginManagement {
    repositories {
        maven { url = 'https://maven.neoforged.net/releases' }
        gradlePluginPortal()
    }
}

plugins {
    id 'org.gradle.toolchains.foojay-resolver-convention' version '0.8.0'
}

rootProject.name = '${modId}'
`;
  }

  return `pluginManagement {
    repositories {
        gradlePluginPortal()
        maven { url = 'https://maven.minecraftforge.net' }
        maven { url = 'https://maven.fabricmc.net' }
        maven { url = 'https://maven.quiltmc.org/repository/release' }
        maven { url = 'https://maven.neoforged.net/releases' }
    }
}

plugins {
    // Bu eklenti Gradle'ın doğru JDK'yı otomatik indirmesini sağlar.
    // Java önceden kurulu olmasa bile proje derlenebilir.
    id 'org.gradle.toolchains.foojay-resolver-convention' version '0.8.0'
}

rootProject.name = '${modId}'
`;
}

function buildGradleProperties(modId: string): string {
  return `org.gradle.jvmargs=-Xmx4G -XX:+UseG1GC
org.gradle.daemon=false
org.gradle.parallel=true
org.gradle.caching=false

mod_id=${modId}
mod_name=${modId.replace(/_/g, " ")}
mod_version=1.0.0
maven_group=com.example.${modId}
archives_base_name=${modId}
`;
}

function buildForgeModsToml(modId: string, mcVersion: string, mainClassName: string, pkg: string): string {
  const v = getForgeVersions(mcVersion);
  const forgeVersion = v.forge.split("-")[1] ?? "47.3.0";
  const major = mcVersion.split(".").slice(0, 2).join(".");
  const entrypoint = `${pkg}.${mainClassName}`;
  return `modLoader="javafml"
loaderVersion="[${forgeVersion.split(".")[0]},)"
license="MIT"

[[mods]]
    modId="${modId}"
    version="1.0.0"
    displayName="${modId.replace(/_/g, " ")}"
    description="Generated by MC Mod Forge"

[[dependencies.${modId}]]
    modId="forge"
    mandatory=true
    versionRange="[${forgeVersion},)"
    ordering="NONE"
    side="BOTH"

[[dependencies.${modId}]]
    modId="minecraft"
    mandatory=true
    versionRange="[${mcVersion},${major}.99]"
    ordering="NONE"
    side="BOTH"
`;
}

function buildNeoForgeModsToml(modId: string, mcVersion: string): string {
  const v = getNeoForgeVersions(mcVersion);
  const major = mcVersion.split(".").slice(0, 2).join(".");
  const neoMajor = v.neoforge.split(".")[0];
  return `modLoader="javafml"
loaderVersion="[${neoMajor},)"
license="MIT"

[[mods]]
    modId="${modId}"
    version="1.0.0"
    displayName="${modId.replace(/_/g, " ")}"
    description="Generated by MC Mod Forge"

[[dependencies.${modId}]]
    modId="neoforge"
    type="required"
    versionRange="[${v.neoforge},)"
    ordering="NONE"
    side="BOTH"

[[dependencies.${modId}]]
    modId="minecraft"
    type="required"
    versionRange="[${mcVersion},${major}.99]"
    ordering="NONE"
    side="BOTH"
`;
}

function buildFabricModJson(modId: string, mcVersion: string, mainClass: string, pkg: string): string {
  const v = getFabricVersions(mcVersion);
  const major = mcVersion.split(".").slice(0, 2).join(".");
  const entrypoint = `${pkg}.${mainClass}`;
  return JSON.stringify({
    schemaVersion: 1,
    id: modId,
    version: "1.0.0",
    name: modId.replace(/_/g, " "),
    description: "Generated by MC Mod Forge",
    authors: [],
    license: "MIT",
    environment: "*",
    entrypoints: {
      main: [entrypoint],
    },
    mixins: [],
    depends: {
      fabricloader: `>=${v.loader}`,
      minecraft: `~${major}`,
      java: `>=${v.java}`,
      "fabric-api": `*`,
    },
  }, null, 2);
}

function buildQuiltModJson(modId: string, mcVersion: string, mainClass: string, pkg: string): string {
  const v = getQuiltVersions(mcVersion);
  const major = mcVersion.split(".").slice(0, 2).join(".");
  const entrypoint = `${pkg}.${mainClass}`;
  return JSON.stringify({
    schema_version: 1,
    quilt_loader: {
      group: `com.example.${modId}`,
      id: modId,
      version: "1.0.0",
      metadata: {
        name: modId.replace(/_/g, " "),
        description: "Generated by MC Mod Forge",
        license: "MIT",
      },
      intermediate_mappings: "net.fabricmc:intermediary",
      entrypoints: {
        init: [entrypoint],
      },
      depends: [
        { id: "quilt_loader", versions: `>=${v.loader}` },
        { id: "quilted_fabric_api", versions: `*` },
        { id: "minecraft", versions: `~${major}` },
      ],
    },
  }, null, 2);
}

function buildPackMcmeta(): string {
  return JSON.stringify({
    pack: {
      description: "Generated by MC Mod Forge",
      pack_format: 15,
    },
  }, null, 2);
}

function buildGitignore(): string {
  return `.gradle/
build/
run/
out/
.jdk/
*.iml
*.ipr
*.iws
.idea/
.vscode/
*.class
`;
}

// ─── Gradle Wrapper ─────────────────────────────────────────────────────────
function addGradleWrapper(zip: JSZip): void {
  const assetsRoot = getAssetsRoot();

  const gradlewPath = path.join(assetsRoot, "gradlew");
  const gradlewBatPath = path.join(assetsRoot, "gradlew.bat");
  const wrapperPropsPath = path.join(assetsRoot, "gradle/wrapper/gradle-wrapper.properties");
  const wrapperJarPath = path.join(assetsRoot, "gradle/wrapper/gradle-wrapper.jar");

  if (
    !fs.existsSync(gradlewPath) ||
    !fs.existsSync(gradlewBatPath) ||
    !fs.existsSync(wrapperPropsPath) ||
    !fs.existsSync(wrapperJarPath)
  ) {
    throw new Error(
      `Gradle wrapper assets not found at "${assetsRoot}". Did the build step copy server/assets into the output?`,
    );
  }

  zip.file("gradlew", fs.readFileSync(gradlewPath, "utf8").replace(/\r\n/g, "\n"), {
    unixPermissions: "755",
  });
  zip.file("gradlew.bat", fs.readFileSync(gradlewBatPath, "utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
  // Wrapper properties: bundled dosyayı kullan (zaten 8.14 — stabil)
  zip.file("gradle/wrapper/gradle-wrapper.properties", fs.readFileSync(wrapperPropsPath, "utf8"));
  zip.file("gradle/wrapper/gradle-wrapper.jar", fs.readFileSync(wrapperJarPath));
}

// ─── Windows tek-tık derleme betiği ─────────────────────────────────────────
function buildWindowsBuildScript(modId: string, javaVersion: number): string {
  const adoptiumVersion = javaVersion >= 21 ? "21" : "17";
  // CRLF line endings for Windows compatibility
  return `@echo off
setlocal enabledelayedexpansion
title ${modId} - MC Mod Forge Derleyici
cd /d "%~dp0"

echo.
echo  =================================================
echo    MC Mod Forge - Otomatik .jar Derleyici
echo    Mod    : ${modId}
echo    Java   : ${javaVersion}+ gerekli
echo    Gradle : Wrapper (otomatik indirilir)
echo  =================================================
echo.
echo  Java ve Gradle yoksa otomatik olarak indirilir.
echo  Internet baglantisi ilk derleme icin zorunludur.
echo.
echo  [1/4] Java kontrol ediliyor...

set "LOCAL_JDK_DIR=%~dp0.jdk"
set "JAVA_READY=0"

REM ── Adim 1: PowerShell ile Java versiyon tespiti (Batch'ten cok daha guvenilir) ──
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$javaCmd = (Get-Command java -ErrorAction SilentlyContinue);" ^
  "if (-not $javaCmd) { exit 1 };" ^
  "$verLine = (& java -version 2>&1 | Select-Object -First 1 | Out-String);" ^
  "$m = [regex]::Match($verLine, '\"(\d+)(?:\.(\d+))?');" ^
  "if (-not $m.Success) { exit 1 };" ^
  "$major = [int]$m.Groups[1].Value;" ^
  "if ($major -eq 1) { $major = [int]$m.Groups[2].Value };" ^
  "if ($major -ge ${javaVersion}) { Write-Host \"[TAMAM] Sistem Java $major bulundu.\"; exit 0 } else { Write-Host \"[BILGI] Sistem Java $major, gerekli: ${javaVersion}+\"; exit 2 }"
set "PS_EXIT=%ERRORLEVEL%"

if "%PS_EXIT%"=="0" (
    set "JAVA_READY=1"
    goto :check_local_jdk_skip
)

REM ── Adim 2: Daha once indirilmis yerel JDK var mi? ──────────────────────────
:check_local_jdk
if exist "%LOCAL_JDK_DIR%\\bin\\java.exe" (
    echo  [TAMAM] Yerel JDK bulundu: .jdk klasoru
    set "JAVA_HOME=%LOCAL_JDK_DIR%"
    set "PATH=%LOCAL_JDK_DIR%\\bin;%PATH%"
    set "JAVA_READY=1"
    goto :check_local_jdk_skip
)

REM ── Adim 3: Eclipse Temurin JDK ${adoptiumVersion} indir (kurulum gerekmez) ──
echo  [BILGI] Java ${adoptiumVersion} bulunamadi. Eclipse Temurin indiriliyor...
echo          (Bu islem internet hiziniza gore 1-5 dakika surebilir)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try {" ^
  "  $ErrorActionPreference = 'Stop';" ^
  "  $api = 'https://api.adoptium.net/v3/binary/latest/${adoptiumVersion}/ga/windows/x64/jdk/hotspot/normal/eclipse';" ^
  "  $zip = Join-Path $env:TEMP 'modforge-temurin-${adoptiumVersion}.zip';" ^
  "  $extract = Join-Path $env:TEMP 'modforge-temurin-extract';" ^
  "  Write-Host '  -> Indirme basliyor: Eclipse Temurin ${adoptiumVersion}...';" ^
  "  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
  "  Invoke-WebRequest -Uri $api -OutFile $zip -UseBasicParsing -TimeoutSec 300;" ^
  "  Write-Host '  -> Arsiv aciliyor...';" ^
  "  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force };" ^
  "  Expand-Archive -Path $zip -DestinationPath $extract -Force;" ^
  "  $jdkDir = Get-ChildItem $extract -Directory | Select-Object -First 1;" ^
  "  $dest = '%LOCAL_JDK_DIR%'.Replace('\\\\','\\');" ^
  "  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force };" ^
  "  Move-Item $jdkDir.FullName $dest;" ^
  "  Remove-Item $zip -Force -ErrorAction SilentlyContinue;" ^
  "  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "  Write-Host '  -> Java basariyla indirildi.';" ^
  "  exit 0" ^
  "} catch {" ^
  "  Write-Host \"  [HATA] Indirme basarisiz: $($_.Exception.Message)\";" ^
  "  exit 1" ^
  "}"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ================================================
    echo   [HATA] Java indirilemedi!
    echo.
    echo   Lutfen asagidaki adresten Java ${adoptiumVersion} kurun:
    echo   https://adoptium.net/temurin/releases/?version=${adoptiumVersion}
    echo.
    echo   Kurulumdan sonra bu .bat dosyasini tekrar calistirin.
    echo  ================================================
    echo.
    pause
    exit /b 1
)

if not exist "%LOCAL_JDK_DIR%\\bin\\java.exe" (
    echo.
    echo  [HATA] JDK klasoru beklenen konumda degil: %LOCAL_JDK_DIR%
    echo  Lutfen manuel Java kurulumu yapin: https://adoptium.net
    pause
    exit /b 1
)

set "JAVA_HOME=%LOCAL_JDK_DIR%"
set "PATH=%LOCAL_JDK_DIR%\\bin;%PATH%"
set "JAVA_READY=1"

:check_local_jdk_skip
if "%JAVA_READY%"=="0" (
    echo  [HATA] Java hazirlanamadi.
    pause
    exit /b 1
)

echo.
echo  [2/4] Gradle wrapper kontrol ediliyor...
if not exist "%~dp0gradlew.bat" (
    echo  [HATA] gradlew.bat bulunamadi. ZIP dosyasi bozuk olmayabilir mi?
    pause
    exit /b 1
)

echo  [3/4] Derleme basliyor...
echo         (Ilk calistirmada Gradle + mod loader dosyalari indirilir ~200-500MB)
echo         (Bu islem 5-15 dakika surebilir - lutfen bekleyin)
echo.

REM Gradle'i temiz calistir, daemon kapatik (gradle.properties'de de var)
set "GRADLE_OPTS=-Xmx2g"
call "%~dp0gradlew.bat" build -x test --no-daemon --stacktrace 2>&1
set "BUILD_EXIT=%ERRORLEVEL%"

if %BUILD_EXIT% NEQ 0 (
    echo.
    echo  ================================================
    echo   [HATA] Derleme basarisiz! (Cikis kodu: %BUILD_EXIT%)
    echo.
    echo   Yukaridaki hata mesajlarini okuyun.
    echo   Olasi sebepler:
    echo    - Internet baglantisi kesildi (Gradle dosya indirirken)
    echo    - Yeterli disk alani yok (en az 2GB bos alan gerekli)
    echo    - Antivirus Gradle'i engelledi (istisna ekleyin)
    echo.
    echo   Tekrar denemek icin bu .bat dosyasini calistirin.
    echo  ================================================
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================================
echo   BASARILI! Mod derlendi.
echo.
echo   JAR dosyasi: build\libs\ klasorunde
echo.
echo   Minecraft mods/ klasorune kopyalayin ve oynayin!
echo  ================================================

echo.
pause
exit /b 0
`;
}

// macOS/Linux için shell script
function buildUnixBuildScript(modId: string, javaVersion: number): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  MC Mod Forge - Otomatik Derleme"
echo "  Mod: ${modId}"
echo "============================================"
echo ""

# Java version kontrol
REQUIRED_JAVA=${javaVersion}
if command -v java &>/dev/null; then
    INSTALLED=$(java -version 2>&1 | grep -oE '"[0-9]+' | head -1 | tr -d '"')
    if [ "$INSTALLED" -ge "$REQUIRED_JAVA" ] 2>/dev/null; then
        echo "[BILGI] Java $INSTALLED bulundu."
        chmod +x ./gradlew
        ./gradlew build --stacktrace
        echo ""
        echo "BASARILI! Mod: build/libs/ klasorunde"
        exit 0
    fi
fi

# SDKMAN ile Java indir (yoksa sdkman kur)
echo "[BILGI] Java ${javaVersion}+ gerekli. SDKMAN ile kuruluyor..."
if ! command -v sdk &>/dev/null; then
    curl -s "https://get.sdkman.io" | bash
    source "$HOME/.sdkman/bin/sdkman-init.sh"
fi
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java ${javaVersion}.0.0-tem 2>/dev/null || sdk use java $(sdk list java | grep "${javaVersion}\." | grep tem | head -1 | awk '{print $NF}')
chmod +x ./gradlew
./gradlew build --stacktrace
echo ""
echo "BASARILI! Mod: build/libs/ klasorunde"
`;
}

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────

export async function buildSourceJar(mod: ModData): Promise<Buffer> {
  const zip = new JSZip();
  const modId = slugify(mod.title);
  const loaderLower = mod.modLoader.toLowerCase();
  const javaPackagePath = `com/example/${modId}`;
  const javaPackage = `com.example.${modId}`;

  // Java dosyalarını çıkar ve düzelt (paket & sınıf ismi)
  const javaFiles = extractJavaFiles(mod.resultMarkdown, modId, mod.modLoader);

  // Ana/init sınıfını bul
  const mainFile = findMainClass(javaFiles);
  const mainClassName = mainFile?.className ?? (modId.charAt(0).toUpperCase() + modId.slice(1) + "Mod");

  // Loader-specific java versiyonu bul
  let javaVersion = 17;
  if (loaderLower === "fabric")   javaVersion = getFabricVersions(mod.mcVersion).java;
  if (loaderLower === "forge")    javaVersion = getForgeVersions(mod.mcVersion).java;
  if (loaderLower === "neoforge") javaVersion = getNeoForgeVersions(mod.mcVersion).java;
  if (loaderLower === "quilt")    javaVersion = getQuiltVersions(mod.mcVersion).java;

  // ── Build dosyaları ──────────────────────────────────────────────────────
  zip.file("build.gradle", buildBuildGradle(modId, mod.mcVersion, mod.modLoader));
  zip.file("settings.gradle", buildSettingsGradle(modId, mod.modLoader));
  zip.file("gradle.properties", buildGradleProperties(modId));
  zip.file(".gitignore", buildGitignore());

  // ── Gradle Wrapper ───────────────────────────────────────────────────────
  addGradleWrapper(zip);

  // ── Derleme betikleri ────────────────────────────────────────────────────
  const batContent = buildWindowsBuildScript(modId, javaVersion).replace(/\n/g, "\r\n");
  zip.file(`${modId}_DERLE.bat`, batContent);
  zip.file(`${modId}_BUILD.sh`, buildUnixBuildScript(modId, javaVersion), { unixPermissions: "755" });

  // ── Mod metadata ─────────────────────────────────────────────────────────
  if (loaderLower === "fabric") {
    zip.file(
      "src/main/resources/fabric.mod.json",
      buildFabricModJson(modId, mod.mcVersion, mainClassName, javaPackage),
    );
  } else if (loaderLower === "quilt") {
    zip.file(
      "src/main/resources/quilt.mod.json",
      buildQuiltModJson(modId, mod.mcVersion, mainClassName, javaPackage),
    );
  } else if (loaderLower === "neoforge") {
    zip.file("src/main/resources/META-INF/mods.toml", buildNeoForgeModsToml(modId, mod.mcVersion));
    zip.file("src/main/resources/META-INF/neoforge.mods.toml", buildNeoForgeModsToml(modId, mod.mcVersion));
  } else {
    // Forge
    zip.file(
      "src/main/resources/META-INF/mods.toml",
      buildForgeModsToml(modId, mod.mcVersion, mainClassName, javaPackage),
    );
    zip.file(
      "src/main/resources/pack.mcmeta",
      buildPackMcmeta(),
    );
  }

  // ── Java kaynak dosyaları ────────────────────────────────────────────────
  if (javaFiles.length > 0) {
    for (const file of javaFiles) {
      zip.file(`src/main/java/${javaPackagePath}/${file.className}.java`, file.content);
    }
  } else {
    // AI kod üretmediyse şablon ana sınıf oluştur
    const className = mainClassName;
    let templateCode = "";

    if (loaderLower === "fabric" || loaderLower === "quilt") {
      templateCode = `package ${javaPackage};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${className} implements ModInitializer {
    public static final String MOD_ID = "${modId}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("${modId} yukluyor...");
        // Mod mantığınızı buraya ekleyin
    }
}
`;
    } else if (loaderLower === "neoforge") {
      templateCode = `package ${javaPackage};

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;

@Mod(${className}.MOD_ID)
public class ${className} {
    public static final String MOD_ID = "${modId}";

    public ${className}(IEventBus modEventBus) {
        // Mod mantığınızı buraya ekleyin
    }
}
`;
    } else {
      // Forge
      templateCode = `package ${javaPackage};

import net.minecraftforge.fml.common.Mod;

@Mod(${className}.MOD_ID)
public class ${className} {
    public static final String MOD_ID = "${modId}";

    public ${className}() {
        // Mod mantığınızı buraya ekleyin
    }
}
`;
    }
    zip.file(`src/main/java/${javaPackagePath}/${className}.java`, templateCode);
  }

  // ── README ────────────────────────────────────────────────────────────────
  zip.file(
    "README.md",
    buildReadme(mod, modId, javaVersion, loaderLower),
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return buffer;
}

function buildReadme(mod: ModData, modId: string, javaVersion: number, loaderLower: string): string {
  const loaderTitle = mod.modLoader.charAt(0).toUpperCase() + mod.modLoader.slice(1);
  return `# ${mod.title}

**Minecraft:** ${mod.mcVersion} | **Loader:** ${loaderTitle} | **Java:** ${javaVersion}+

_Generated by MC Mod Forge_

---

## ⚡ Hızlı Başlangıç

### Windows

\`\`\`bat
${modId}_DERLE.bat dosyasına çift tıklayın
\`\`\`

Java veya Gradle kurulu olmasa bile betik her şeyi otomatik indirir.
Çıktı JAR dosyası \`build/libs/\` klasöründe oluşur.

### macOS / Linux

\`\`\`bash
chmod +x ${modId}_BUILD.sh
./${modId}_BUILD.sh
\`\`\`

veya doğrudan Gradle ile:

\`\`\`bash
./gradlew build
\`\`\`

---

## 📋 Gereksinimler

- **Java ${javaVersion}+** (betik yoksa otomatik indirir)
- İnternet bağlantısı (Gradle + mod loader bağımlılıkları ilk derlemede indirilir)

---

## 📁 Proje Yapısı

\`\`\`
${modId}/
├── src/main/java/com/example/${modId}/   ← Mod kaynak kodu
│   └── *.java
├── src/main/resources/                   ← Mod metadata
├── build.gradle                          ← Derleme yapılandırması
├── gradle.properties                     ← Proje değişkenleri
├── settings.gradle                       ← Gradle ayarları
├── gradlew / gradlew.bat                 ← Gradle wrapper
├── ${modId}_DERLE.bat                    ← Windows derleme betiği
└── ${modId}_BUILD.sh                     ← macOS/Linux derleme betiği
\`\`\`

---

## 💡 Modü Yüklemek

1. \`build/libs/\` içindeki \`.jar\` dosyasını alın
2. Minecraft \`mods/\` klasörüne kopyalayın
3. ${loaderLower === "fabric" ? "Fabric Loader" : loaderLower === "quilt" ? "Quilt Loader" : loaderLower === "neoforge" ? "NeoForge" : "Forge"} yüklü Minecraft'ı başlatın

---

## 🎮 Orijinal İstek

${mod.prompt}

---

## 📄 Mod Detayları

${mod.resultMarkdown}
`;
}

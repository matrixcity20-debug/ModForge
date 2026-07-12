import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";

function getAssetsRoot(): string {
  // Dev: `tsx watch server/index.ts` runs with cwd = project root, assets live at server/assets.
  // Prod: Docker WORKDIR is /app and dist is copied there, so cwd is still project root;
  // build.mjs copies server/assets → dist/assets alongside the bundled server code.
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

interface JavaFile {
  className: string;
  content: string;
}

function extractJavaFiles(markdown: string): JavaFile[] {
  const files: JavaFile[] = [];
  const regex = /```java\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(markdown)) !== null) {
    const code = match[1].trim();
    // Try to find class/interface/enum name
    const classMatch = code.match(/(?:public\s+)?(?:class|interface|enum|record)\s+(\w+)/);
    const className = classMatch ? classMatch[1] : `GeneratedClass${++index}`;
    files.push({ className, content: code });
  }

  return files;
}

function buildManifest(modId: string, mainClass?: string): string {
  const lines = [
    "Manifest-Version: 1.0",
    `Implementation-Title: ${modId}`,
    "Implementation-Version: 1.0.0",
  ];
  if (mainClass) {
    lines.push(`Main-Class: ${mainClass}`);
  }
  return lines.join("\n") + "\n";
}

function buildBuildGradle(modId: string, mcVersion: string, modLoader: string): string {
  const loaderLower = modLoader.toLowerCase();

  if (loaderLower === "fabric") {
    return `plugins {
    id 'fabric-loom' version '1.7-SNAPSHOT'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
    archivesName = project.archives_base_name
}

repositories {}

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings loom.officialMojangMappings()
    modImplementation "net.fabricmc:fabric-loader:+"
    modImplementation "net.fabricmc.fabric-api:fabric-api:+"
}

processResources {
    inputs.property "version", project.version
    filteringCharset "UTF-8"

    filesMatching("fabric.mod.json") {
        expand "version": project.version
    }
}
`;
  }

  if (loaderLower === "quilt") {
    return `plugins {
    id 'org.quiltmc.loom' version '1.7+'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

repositories {}

dependencies {
    minecraft "com.mojang:minecraft:${mcVersion}"
    mappings loom.officialMojangMappings()
    modImplementation "org.quiltmc:quilt-loader:+"
    modImplementation "org.quiltmc.quilted-fabric-api:quilted-fabric-api:+"
}
`;
  }

  if (loaderLower === "neoforge") {
    return `plugins {
    id 'net.neoforged.gradle.userdev' version '7.0.+'
}

version = "1.0.0"
group = "com.example.${modId}"

java.toolchain.languageVersion = JavaLanguageVersion.of(21)

runs {
    configureEach {
        systemProperty 'forge.logging.markers', 'REGISTRIES'
        systemProperty 'forge.logging.console.level', 'debug'
    }
    client { workingDirectory project.file('run') }
    server { workingDirectory project.file('run') }
}

dependencies {
    implementation "net.neoforged:neoforge:+"
}
`;
  }

  // Forge (default)
  return `buildscript {
    repositories {
        maven { url = 'https://maven.minecraftforge.net' }
        mavenCentral()
    }
    dependencies {
        classpath group: 'net.minecraftforge.gradle', name: 'ForgeGradle', version: '6.+', changing: true
    }
}

apply plugin: 'net.minecraftforge.gradle'

version = '1.0.0'
group = 'com.example.${modId}'
archivesBaseName = '${modId}'

java.toolchain.languageVersion = JavaLanguageVersion.of(17)

minecraft {
    mappings channel: 'official', version: '${mcVersion}'
    runs {
        client {
            workingDirectory project.file('run')
            property 'forge.logging.markers', 'REGISTRIES'
            property 'forge.logging.console.level', 'debug'
        }
        server { workingDirectory project.file('run') }
    }
}

dependencies {
    minecraft 'net.minecraftforge:forge:${mcVersion}-+'
}
`;
}

function buildSettingsGradle(modId: string): string {
  return `pluginManagement {
    repositories {
        gradlePluginPortal()
        maven { url = 'https://maven.minecraftforge.net' }
        maven { url = 'https://maven.fabricmc.net' }
        maven { url = 'https://maven.neoforged.net/releases' }
    }
}

plugins {
    // Gradle'ın derleme için doğru JDK'yı otomatik indirmesini sağlar.
    // Bu sayede hangi bilgisayarda çalıştırılırsa çalıştırılsın,
    // Java önceden kurulu olmasa bile proje derlenebilir.
    id 'org.gradle.toolchains.foojay-resolver-convention' version '0.8.0'
}

rootProject.name = '${modId}'
`;
}

function buildGradleProperties(modId: string, modLoader: string): string {
  return `org.gradle.jvmargs=-Xmx3G
org.gradle.daemon=false

mod_id=${modId}
mod_name=${modId.replace(/_/g, " ")}
mod_version=1.0.0
maven_group=com.example.${modId}
archives_base_name=${modId}
`;
}

function buildForgeModsToml(modId: string, mcVersion: string): string {
  const major = mcVersion.split(".").slice(0, 2).join(".");
  return `modLoader="javafml"
loaderVersion="[47,)"
license="MIT"

[[dependencies.${modId}]]
    modId="forge"
    mandatory=true
    versionRange="[47,)"
    ordering="NONE"
    side="BOTH"

[[dependencies.${modId}]]
    modId="minecraft"
    mandatory=true
    versionRange="[${mcVersion},${major}.99]"
    ordering="NONE"
    side="BOTH"

[[mods]]
    modId="${modId}"
    version="1.0.0"
    displayName="${modId.replace(/_/g, " ")}"
    description=""
`;
}

function buildFabricModJson(modId: string, mcVersion: string): string {
  const major = mcVersion.split(".").slice(0, 2).join(".");
  return JSON.stringify({
    schemaVersion: 1,
    id: modId,
    version: "1.0.0",
    name: modId.replace(/_/g, " "),
    description: "",
    authors: [],
    license: "MIT",
    environment: "*",
    entrypoints: {
      main: [`com.example.${modId}.${modId.charAt(0).toUpperCase() + modId.slice(1)}Mod`],
    },
    depends: {
      fabricloader: ">=0.14.0",
      minecraft: `~${major}`,
      java: ">=17",
      "fabric-api": "*",
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

// ─── Gradle Wrapper ─────────────────────────────────────────────────────────
// Bundled so the generated project can build itself without Gradle being
// pre-installed on the target machine — the wrapper downloads the exact
// Gradle version it needs on first run.
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

  // Unix line endings + executable bit for gradlew (harmless on Windows, required on macOS/Linux).
  zip.file("gradlew", fs.readFileSync(gradlewPath, "utf8").replace(/\r\n/g, "\n"), {
    unixPermissions: "755",
  });
  // CRLF for the Windows script, matching how it ships upstream.
  zip.file("gradlew.bat", fs.readFileSync(gradlewBatPath, "utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
  zip.file("gradle/wrapper/gradle-wrapper.properties", fs.readFileSync(wrapperPropsPath, "utf8"));
  zip.file("gradle/wrapper/gradle-wrapper.jar", fs.readFileSync(wrapperJarPath));
}

// ─── Windows tek-tık derleme betiği ─────────────────────────────────────────
// Java kurulu olmasa bile çalışır: taşınabilir bir Temurin JDK'yı otomatik
// indirip yalnızca bu betik için PATH'e ekler, ardından Gradle Wrapper'ı
// çalıştırır. Böylece hangi Windows bilgisayarında açılırsa açılsın
// (internet bağlantısı olduğu sürece) mod %100 derlenebilir.
function buildWindowsBuildScript(modId: string): string {
  return `@echo off
setlocal enabledelayedexpansion
title ${modId} - Otomatik Derleme
cd /d "%~dp0"

echo ============================================
echo   MC Mod Forge - Otomatik Derleme Araci
echo   Mod: ${modId}
echo ============================================
echo.
echo Bu betik internet baglantisi gerektirir.
echo Gerekliyse Java (JDK) ve Gradle otomatik olarak indirilecektir.
echo Kurulu bir Java gerekmez - hicbir seyi elle kurmaniza gerek yoktur.
echo.

set "LOCAL_JDK_DIR=%~dp0.jdk"
set "JAVA_FOUND="

REM 1) Sistemde zaten bir Java var mi kontrol et
where java >nul 2>nul
if %ERRORLEVEL%==0 (
    set "JAVA_FOUND=system"
    goto :build
)

REM 2) Daha once bu betik tarafindan indirilmis taşınabilir bir JDK var mi
if exist "%LOCAL_JDK_DIR%\\bin\\java.exe" (
    set "JAVA_FOUND=local"
    goto :setlocaljava
)

REM 3) Hicbiri yoksa: taşınabilir Eclipse Temurin JDK 21'i otomatik indir
echo [BILGI] Sisteminizde Java bulunamadi. Tasinabilir bir JDK indiriliyor...
echo         (Bu islem internet hizina bagli olarak birkac dakika surebilir)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "$url='https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse';" ^
    "$zipPath = Join-Path $env:TEMP 'temurin-jdk21.zip';" ^
    "Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing;" ^
    "$extractDir = Join-Path $env:TEMP 'temurin-jdk21-extract';" ^
    "if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force };" ^
    "Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force;" ^
    "$jdkFolder = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1;" ^
    "if (Test-Path '%LOCAL_JDK_DIR%') { Remove-Item '%LOCAL_JDK_DIR%' -Recurse -Force };" ^
    "Move-Item -Path $jdkFolder.FullName -Destination '%LOCAL_JDK_DIR%';" ^
    "Remove-Item $zipPath -Force; Remove-Item $extractDir -Recurse -Force"

if not exist "%LOCAL_JDK_DIR%\\bin\\java.exe" (
    echo.
    echo [HATA] Java otomatik olarak indirilemedi.
    echo Lutfen internet baglantinizi kontrol edin ya da manuel olarak
    echo bir JDK 17+ kurup bu betigi tekrar calistirin: https://adoptium.net
    pause
    exit /b 1
)

:setlocaljava
set "JAVA_HOME=%LOCAL_JDK_DIR%"
set "PATH=%LOCAL_JDK_DIR%\\bin;%PATH%"
set "JAVA_FOUND=local"

:build
echo [BILGI] Java hazir (%JAVA_FOUND%). Gradle Wrapper ile derleme basliyor...
echo         (Ilk calistirmada doğru Gradle surumu otomatik indirilir)
echo.

call "%~dp0gradlew.bat" build --console=plain
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Derleme basarisiz oldu. Yukaridaki hata mesajlarini inceleyin.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BASARILI: Mod derlendi!
echo   Cikti dosyasi: build\\libs\\ klasorunde
echo ============================================
pause
exit /b 0
`;
}

export async function buildSourceArchive(mod: ModData): Promise<Buffer> {
  const zip = new JSZip();
  const modId = slugify(mod.title);
  const loaderLower = mod.modLoader.toLowerCase();
  const javaPackage = `com/example/${modId}`;

  // META-INF
  zip.file("META-INF/MANIFEST.MF", buildManifest(modId));

  // Build files
  zip.file("build.gradle", buildBuildGradle(modId, mod.mcVersion, mod.modLoader));
  zip.file("settings.gradle", buildSettingsGradle(modId));
  zip.file("gradle.properties", buildGradleProperties(modId, mod.modLoader));

  // Gradle Wrapper — proje, Gradle kurulu olmayan bir bilgisayarda bile
  // kendi kendine doğru Gradle sürümünü indirip derleyebilir.
  addGradleWrapper(zip);

  // Windows'ta çift tıkla derleme: Java bile kurulu olmasa çalışır.
  zip.file(`${modId}_DERLE.bat`, buildWindowsBuildScript(modId).replace(/\n/g, "\r\n"));

  // README
  zip.file(
    "README.md",
    `# ${mod.title}\n\nGenerated by MC Mod Forge\n\n## Derleme (Windows)\n\n\`${modId}_DERLE.bat\` dosyasına çift tıklayın. Java veya Gradle kurulu olmasa bile\nbetik gerekeni otomatik indirip projeyi derler. Çıktı \`build/libs/\` klasöründe olacaktır.\n\n## Derleme (macOS / Linux)\n\n\`\`\`bash\n./gradlew build\n\`\`\`\n\nÇıktı JAR dosyası \`build/libs/\` klasöründe olacaktır.\n\n## Original Prompt\n\n${mod.prompt}\n\n## Generated Mod Documentation\n\n${mod.resultMarkdown}\n`,
  );

  // Java source files
  const javaFiles = extractJavaFiles(mod.resultMarkdown);
  if (javaFiles.length > 0) {
    for (const file of javaFiles) {
      zip.file(`src/main/java/${javaPackage}/${file.className}.java`, file.content);
    }
  } else {
    // Placeholder main class if no code blocks found
    const className = modId.charAt(0).toUpperCase() + modId.slice(1) + "Mod";
    zip.file(
      `src/main/java/${javaPackage}/${className}.java`,
      `package com.example.${modId};\n\n// Generated by MC Mod Forge\n// Implement your mod logic here.\npublic class ${className} {\n}\n`,
    );
  }

  // Resources
  if (loaderLower === "fabric" || loaderLower === "quilt") {
    zip.file("src/main/resources/fabric.mod.json", buildFabricModJson(modId, mod.mcVersion));
  } else {
    zip.file("src/main/resources/META-INF/mods.toml", buildForgeModsToml(modId, mod.mcVersion));
  }
  zip.file("src/main/resources/pack.mcmeta", buildPackMcmeta());

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return buffer;
}

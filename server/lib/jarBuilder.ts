import JSZip from "jszip";

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

export async function buildSourceJar(mod: ModData): Promise<Buffer> {
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

  // README
  zip.file(
    "README.md",
    `# ${mod.title}\n\nGenerated by MC Mod Forge\n\n## Build\n\n\`\`\`bash\n./gradlew build\n\`\`\`\n\nOutput JAR will be in \`build/libs/\`.\n\n## Original Prompt\n\n${mod.prompt}\n\n## Generated Mod Documentation\n\n${mod.resultMarkdown}\n`,
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

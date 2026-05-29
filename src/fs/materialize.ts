import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest } from "../types/manifest.js";
import { assembleFromManifest } from "../build/assembler.js";
import { hashString, hashFile } from "./hash.js";
import { updateCoreManifest } from "./core-manifest.js";

export interface MaterializedFile {
  absPath: string;
  relPath: string;
  hash: string;
  category: "generated" | "create_once";
}

export interface MaterializeOptions {
  packageRoot: string;
  projectRoot: string;
  timestamp?: string;
  overwriteCreateOnce?: boolean;
}

function copyRecursive(
  srcDir: string,
  destDir: string,
  collected: MaterializedFile[],
  projectRoot: string,
  shouldSkip?: (relSrcPath: string) => boolean,
  baseSrcDir?: string,
): void {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });

  const rootSrcDir = baseSrcDir ?? srcDir;

  for (const entry of readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destDir, entry);
    const stat = statSync(srcPath);

    if (shouldSkip) {
      const relFromRoot = path.relative(rootSrcDir, srcPath).replace(/\\/g, "/");
      if (shouldSkip(relFromRoot)) continue;
    }

    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath, collected, projectRoot, shouldSkip, rootSrcDir);
    } else {
      copyFileSync(srcPath, destPath);
      collected.push({
        absPath: destPath,
        relPath: path.relative(projectRoot, destPath).replace(/\\/g, "/"),
        hash: hashFile(destPath),
        category: "generated",
      });
    }
  }
}

export function materializeProject(options: MaterializeOptions): MaterializedFile[] {
  const { packageRoot, projectRoot, overwriteCreateOnce = false } = options;
  const timestamp = options.timestamp ?? new Date().toISOString();
  const sourcesDir = path.resolve(packageRoot, "sources");
  const materialized: MaterializedFile[] = [];

  const kinds: Array<"skills" | "templates"> = ["skills", "templates"];
  for (const kind of kinds) {
    const baseDir = path.resolve(sourcesDir, kind);
    if (!existsSync(baseDir)) continue;

    for (const entry of readdirSync(baseDir)) {
      const manifestPath = path.join(baseDir, entry, "manifest.yaml");
      if (!existsSync(manifestPath)) continue;

      const raw = readFileSync(manifestPath, "utf-8");
      const manifest: Manifest = parseYaml(raw);
      const content = assembleFromManifest(manifestPath, {
        sourcesDir,
        timestamp,
      });

      const outPath = path.resolve(projectRoot, manifest.output);
      mkdirSync(path.dirname(outPath), { recursive: true });
      writeFileSync(outPath, content, "utf-8");

      materialized.push({
        absPath: outPath,
        relPath: manifest.output,
        hash: hashString(content),
        category: "generated",
      });
    }
  }

  // Skip core/manifest.yaml during the recursive copy: it is treated as
  // CREATE_ONCE and reconciled separately via updateCoreManifest() below so
  // that user-added entries (origin: user) are preserved across `mvtt update`.
  const knowledgeSrc = path.resolve(sourcesDir, "knowledge");
  const knowledgeDest = path.resolve(projectRoot, ".ai-agents/knowledge");
  copyRecursive(
    knowledgeSrc,
    knowledgeDest,
    materialized,
    projectRoot,
    (relPath) => relPath === "core/manifest.yaml",
  );

  const coreManifestDest = path.resolve(
    projectRoot,
    ".ai-agents/knowledge/core/manifest.yaml",
  );
  updateCoreManifest(projectRoot, packageRoot);
  materialized.push({
    absPath: coreManifestDest,
    relPath: ".ai-agents/knowledge/core/manifest.yaml",
    hash: hashFile(coreManifestDest),
    category: "create_once",
  });

  const registrySrc = path.resolve(packageRoot, "registry.yaml");
  const registryDest = path.resolve(projectRoot, ".ai-agents/registry.yaml");
  mkdirSync(path.dirname(registryDest), { recursive: true });
  copyFileSync(registrySrc, registryDest);
  materialized.push({
    absPath: registryDest,
    relPath: ".ai-agents/registry.yaml",
    hash: hashFile(registryDest),
    category: "generated",
  });

  // Copy bundled scripts from dist/scripts/ (bundled by esbuild, zero external deps)
  const scriptsSrc = path.resolve(packageRoot, "dist/scripts");
  const scriptsDest = path.resolve(projectRoot, ".ai-agents/scripts");
  copyRecursive(scriptsSrc, scriptsDest, materialized, projectRoot);

  const defaults: Array<[string, string]> = [
    [
      path.resolve(sourcesDir, "defaults/config.yaml"),
      path.resolve(projectRoot, ".ai-agents/config.yaml"),
    ],
    [
      path.resolve(sourcesDir, "defaults/session.yaml"),
      path.resolve(projectRoot, ".ai-agents/workspace/session.yaml"),
    ],
    [
      path.resolve(sourcesDir, "defaults/project-context.yaml"),
      path.resolve(projectRoot, ".ai-agents/workspace/project-context.yaml"),
    ],
  ];

  for (const [src, dest] of defaults) {
    if (!overwriteCreateOnce && existsSync(dest)) {
      materialized.push({
        absPath: dest,
        relPath: path.relative(projectRoot, dest).replace(/\\/g, "/"),
        hash: hashFile(dest),
        category: "create_once",
      });
      continue;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    materialized.push({
      absPath: dest,
      relPath: path.relative(projectRoot, dest).replace(/\\/g, "/"),
      hash: hashFile(dest),
      category: "create_once",
    });
  }

  const userDataDirs = [
    ".ai-agents/workspace/artifacts",
    ".ai-agents/skills/_templates/custom",
    ".ai-agents/knowledge/principle",
    ".ai-agents/knowledge/project",
    ".ai-agents/knowledge/project/_generated",
    ".ai-agents/knowledge/core/user",
  ];
  for (const dir of userDataDirs) {
    mkdirSync(path.resolve(projectRoot, dir), { recursive: true });
  }

  return materialized;
}

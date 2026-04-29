import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest } from "../types/manifest.js";
import { assembleFromManifest } from "../build/assembler.js";
import { validateManifest } from "../build/validator.js";

export function buildCommand(args: string[]): void {
  const projectRoot = process.cwd();
  const sourcesDir = path.resolve(projectRoot, "sources");
  const outputRoot = args.includes("--out")
    ? path.resolve(args[args.indexOf("--out") + 1])
    : projectRoot;

  const timestamp = new Date().toISOString();
  let totalFiles = 0;
  let totalErrors = 0;

  for (const kind of ["skills", "templates"] as const) {
    const baseDir = path.resolve(sourcesDir, kind);
    if (!existsSync(baseDir)) continue;

    for (const entry of readdirSync(baseDir)) {
      const manifestPath = path.join(baseDir, entry, "manifest.yaml");
      if (!existsSync(manifestPath)) continue;

      const errors = validateManifest(manifestPath, sourcesDir);
      if (errors.length > 0) {
        for (const err of errors) {
          console.error(`[ERROR] ${err.file}: ${err.message}`);
        }
        totalErrors += errors.length;
        continue;
      }

      const raw = readFileSync(manifestPath, "utf-8");
      const manifest: Manifest = parseYaml(raw);
      const content = assembleFromManifest(manifestPath, {
        sourcesDir,
        timestamp,
      });

      const outPath = path.resolve(outputRoot, manifest.output);
      mkdirSync(path.dirname(outPath), { recursive: true });
      writeFileSync(outPath, content, "utf-8");

      console.log(`[OK] ${manifest.output}`);
      totalFiles++;
    }
  }

  console.log(`\nBuild complete: ${totalFiles} files generated, ${totalErrors} errors.`);
  if (totalErrors > 0) process.exit(1);
}

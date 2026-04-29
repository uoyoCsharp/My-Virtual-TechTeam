import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest } from "../types/manifest.js";
import { loadSection } from "./section-loader.js";

function buildFrontmatter(fm: Record<string, string>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (value.includes("\n") || value.includes("'")) {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: '${value}'`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

export interface AssembleOptions {
  sourcesDir: string;
  timestamp?: string;
}

export function assembleFromManifest(
  manifestPath: string,
  options: AssembleOptions,
): string {
  const raw = readFileSync(manifestPath, "utf-8");
  const manifest: Manifest = parseYaml(raw);
  const skillDir = path.dirname(manifestPath);

  const parts: string[] = [];

  parts.push(buildFrontmatter(manifest.frontmatter));
  parts.push("");

  for (const section of manifest.sections) {
    const content = loadSection(section, skillDir, options.sourcesDir);
    parts.push(content.trimEnd());
    parts.push("");
  }

  return parts.join("\n");
}

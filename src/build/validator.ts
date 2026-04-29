import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest, Section } from "../types/manifest.js";

export interface ValidationError {
  file: string;
  message: string;
}

function validateSectionRef(
  section: Section,
  skillDir: string,
  sourcesDir: string,
): string | null {
  if (section.type === "file") {
    const p = path.resolve(skillDir, section.source);
    if (!existsSync(p)) return `File not found: ${section.source} (resolved: ${p})`;
  }
  if (section.type === "shared" || section.type === "template") {
    const p = path.resolve(sourcesDir, section.source);
    if (!existsSync(p)) return `Shared section not found: ${section.source} (resolved: ${p})`;
  }
  return null;
}

function checkParamCompleteness(
  sectionSource: string,
  sourcesDir: string,
  params: Record<string, unknown> | undefined,
): string[] {
  const errors: string[] = [];
  const filePath = path.resolve(sourcesDir, sectionSource);
  if (!existsSync(filePath)) return errors;

  const content = readFileSync(filePath, "utf-8");

  const stripped = content.replace(/\{\{#(\w+)\}\}[\s\S]*?\{\{\/\1\}\}/g, "");

  const topLevelVars = stripped.match(/\{\{(\w+)\}\}/g) ?? [];
  const requiredParams = new Set(
    topLevelVars.map((v: string) => v.slice(2, -2)),
  );

  for (const varName of requiredParams) {
    if (varName === ".") continue;
    if (!params || !(varName in params)) {
      errors.push(`Missing param "${varName}" for section "${sectionSource}"`);
    }
  }
  return errors;
}

export function validateManifest(
  manifestPath: string,
  sourcesDir: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!existsSync(manifestPath)) {
    errors.push({ file: manifestPath, message: "Manifest file not found" });
    return errors;
  }

  let manifest: Manifest;
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    manifest = parseYaml(raw);
  } catch (e) {
    errors.push({ file: manifestPath, message: `Invalid YAML: ${e}` });
    return errors;
  }

  if (!manifest.name) {
    errors.push({ file: manifestPath, message: 'Missing required field "name"' });
  }
  if (!manifest.output) {
    errors.push({ file: manifestPath, message: 'Missing required field "output"' });
  }
  if (!manifest.sections || !Array.isArray(manifest.sections)) {
    errors.push({ file: manifestPath, message: 'Missing or invalid "sections" array' });
    return errors;
  }

  const skillDir = path.dirname(manifestPath);

  for (let i = 0; i < manifest.sections.length; i++) {
    const section = manifest.sections[i];
    const refErr = validateSectionRef(section, skillDir, sourcesDir);
    if (refErr) {
      errors.push({ file: manifestPath, message: `sections[${i}]: ${refErr}` });
    }

    if (
      (section.type === "shared" || section.type === "template") &&
      section.params
    ) {
      const paramErrors = checkParamCompleteness(
        section.source,
        sourcesDir,
        section.params,
      );
      for (const pe of paramErrors) {
        errors.push({ file: manifestPath, message: `sections[${i}]: ${pe}` });
      }
    }
  }

  return errors;
}

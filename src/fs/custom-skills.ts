import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { LEGACY_FRAMEWORK_DIR, REGISTRY_REL } from "./paths.js";

interface RegistryEntry {
  custom?: boolean;
}

interface RegistryDoc {
  skills?: Record<string, RegistryEntry | undefined>;
}

function registryPath(projectRoot: string): string | null {
  const modern = path.join(projectRoot, REGISTRY_REL);
  if (existsSync(modern)) return modern;
  const legacy = path.join(projectRoot, LEGACY_FRAMEWORK_DIR, "registry.yaml");
  if (existsSync(legacy)) return legacy;
  return null;
}

export function readCustomSkillNames(projectRoot: string): string[] {
  const file = registryPath(projectRoot);
  if (!file) return [];

  try {
    const doc = parseYaml(readFileSync(file, "utf-8")) as RegistryDoc | null;
    if (!doc?.skills || typeof doc.skills !== "object") return [];
    return Object.entries(doc.skills)
      .filter(([, entry]) => entry?.custom === true)
      .map(([name]) => name)
      .sort();
  } catch {
    return [];
  }
}

export interface CustomSkillSyncResult {
  synced: string[];
  skipped: string[];
}

export function syncCustomSkillsToTargets(
  projectRoot: string,
  sourceSkillDirs: string[],
  targetSkillDirs: string[],
): CustomSkillSyncResult {
  const result: CustomSkillSyncResult = { synced: [], skipped: [] };
  if (targetSkillDirs.length === 0) return result;

  for (const name of readCustomSkillNames(projectRoot)) {
    const sourceDir = sourceSkillDirs
      .map((dir) => path.join(projectRoot, dir, name))
      .find((dir) => existsSync(path.join(dir, "SKILL.md")));

    if (!sourceDir) {
      result.skipped.push(`${name} (no source)`);
      continue;
    }

    for (const targetDir of targetSkillDirs) {
      const destDir = path.join(projectRoot, targetDir, name);
      if (existsSync(destDir)) {
        result.skipped.push(`${targetDir}/${name} (exists)`);
        continue;
      }
      mkdirSync(path.dirname(destDir), { recursive: true });
      cpSync(sourceDir, destDir, { recursive: true });
      result.synced.push(`${targetDir}/${name}`);
    }
  }

  return result;
}

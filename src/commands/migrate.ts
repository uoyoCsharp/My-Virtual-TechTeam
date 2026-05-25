import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface MigrationResult {
  skipped: boolean;
  reason?: string;
  backup?: string;
  changes?: string[];
}

function backupDir(projectRoot: string): string {
  const dir = path.join(projectRoot, ".ai-agents/.backup");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function backupFile(projectRoot: string, filePath: string, label: string): string {
  const dir = backupDir(projectRoot);
  const dest = path.join(dir, `${label}-${Date.now()}.yaml`);
  copyFileSync(filePath, dest);
  return dest;
}

export function migrateManifests(projectRoot: string): MigrationResult {
  const manifestPath = path.join(
    projectRoot,
    ".ai-agents/knowledge/core/manifest.yaml",
  );
  if (!existsSync(manifestPath)) {
    return { skipped: true, reason: "no core/manifest.yaml present" };
  }

  const raw = readFileSync(manifestPath, "utf-8");
  const old = parseYaml(raw) as Record<string, unknown>;

  const hasLegacyType = old.type === "core";
  const hasLegacyField = "token_estimate" in old || "loading_strategy" in old;
  const filesArr = Array.isArray(old.files) ? (old.files as Record<string, unknown>[]) : [];
  const filesMissOrigin = filesArr.some((f) => !("origin" in f));

  if (!hasLegacyType && !hasLegacyField && !filesMissOrigin) {
    return { skipped: true, reason: "already migrated" };
  }

  const backup = backupFile(projectRoot, manifestPath, "core-manifest");

  const migrated = {
    id: typeof old.id === "string" ? old.id : "core",
    type: hasLegacyType ? "shared" : (old.type ?? "shared"),
    files: filesArr.map((f) => ({
      path: typeof f.path === "string" ? f.path : "",
      origin: typeof f.origin === "string" ? f.origin : "user",
      auto_load:
        typeof f.auto_load === "boolean"
          ? f.auto_load
          : typeof f.required === "boolean"
            ? f.required
            : true,
    })),
  };

  writeFileSync(manifestPath, stringifyYaml(migrated), "utf-8");

  const changes: string[] = [];
  if (hasLegacyType) changes.push("type: core -> shared");
  if (hasLegacyField) changes.push("removed token_estimate / loading_strategy");
  if (filesMissOrigin) changes.push("added origin: user to legacy entries");

  return { skipped: false, backup, changes };
}

export function migratePaths(projectRoot: string): MigrationResult {
  const oldPath = path.join(projectRoot, ".ai-agents/workspace/project-context.md");
  const newDir = path.join(
    projectRoot,
    ".ai-agents/knowledge/project/_generated",
  );
  const newPath = path.join(newDir, "project-context.md");

  if (!existsSync(oldPath)) {
    return { skipped: true, reason: "no legacy workspace/project-context.md" };
  }
  if (existsSync(newPath)) {
    return {
      skipped: true,
      reason: "target already exists at knowledge/project/_generated/project-context.md",
    };
  }

  const backup = backupFile(projectRoot, oldPath, "project-context");
  mkdirSync(newDir, { recursive: true });
  renameSync(oldPath, newPath);

  return {
    skipped: false,
    backup,
    changes: [`moved workspace/project-context.md -> knowledge/project/_generated/project-context.md`],
  };
}

export function migrateConfig(projectRoot: string): MigrationResult {
  const configPath = path.join(projectRoot, ".ai-agents/config.yaml");
  if (!existsSync(configPath)) {
    return { skipped: true, reason: "no config.yaml" };
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = parseYaml(raw) as { preferences?: Record<string, unknown> };
  const prefs = config.preferences ?? {};

  const hasLegacy = typeof prefs.language === "string";
  const hasInteraction = typeof prefs.interaction_language === "string";
  const hasDocument = typeof prefs.document_output_language === "string";

  if (!hasLegacy && hasInteraction && hasDocument) {
    return { skipped: true, reason: "already migrated" };
  }
  if (!hasLegacy && !hasInteraction) {
    return { skipped: true, reason: "no language fields to migrate" };
  }

  const backup = backupFile(projectRoot, configPath, "config");

  const source = hasInteraction
    ? (prefs.interaction_language as string)
    : (prefs.language as string);

  const newPrefs: Record<string, unknown> = { ...prefs };
  newPrefs.interaction_language = source;
  newPrefs.document_output_language = hasDocument
    ? (prefs.document_output_language as string)
    : source;
  delete newPrefs.language;

  const migrated = { ...config, preferences: newPrefs };
  writeFileSync(configPath, stringifyYaml(migrated), "utf-8");

  const changes: string[] = [];
  if (hasLegacy) changes.push(`language: ${prefs.language as string} -> interaction_language + document_output_language`);
  if (!hasDocument) changes.push("set document_output_language fallback");

  return { skipped: false, backup, changes };
}

export interface MigrateAllResult {
  manifests: MigrationResult;
  paths: MigrationResult;
  config: MigrationResult;
}

export function migrateAll(projectRoot: string): MigrateAllResult {
  return {
    manifests: migrateManifests(projectRoot),
    paths: migratePaths(projectRoot),
    config: migrateConfig(projectRoot),
  };
}

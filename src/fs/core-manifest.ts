import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { CoreManifest, CoreManifestFile } from "../types/core-manifest.js";

const FRAMEWORK_MANIFEST_REL = "sources/knowledge/core/manifest.yaml";
const USER_MANIFEST_REL = ".ai-agents/knowledge/core/manifest.yaml";
const BACKUP_DIR_REL = ".ai-agents/.backup";

function readManifest(filePath: string): CoreManifest | null {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw) as Partial<CoreManifest> | null;
  if (!parsed || typeof parsed !== "object") return null;
  return {
    id: parsed.id ?? "core",
    type: parsed.type ?? "shared",
    files: Array.isArray(parsed.files) ? (parsed.files as CoreManifestFile[]) : [],
  };
}

function backupUserManifest(projectRoot: string, sourcePath: string): string {
  const backupDir = path.resolve(projectRoot, BACKUP_DIR_REL);
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `core-manifest-${stamp}.yaml`);
  copyFileSync(sourcePath, backupPath);
  return backupPath;
}

/**
 * Merge framework + user core/manifest.yaml entries.
 *
 * - All entries in the framework manifest are copied verbatim (origin: framework).
 * - All entries with origin: "user" in the existing user manifest are preserved.
 * - Any other entries (legacy or malformed) are dropped.
 *
 * The user manifest at projectRoot is rewritten with the merged result. When
 * `backup` is true (the default), a backup of the previous user manifest (if
 * any) is written to .ai-agents/.backup/.
 */
export function updateCoreManifest(
  projectRoot: string,
  packageRoot: string,
  createBackup = true,
): {
  written: boolean;
  backup: string | null;
  frameworkCount: number;
  userCount: number;
} {
  const frameworkPath = path.resolve(packageRoot, FRAMEWORK_MANIFEST_REL);
  const userPath = path.resolve(projectRoot, USER_MANIFEST_REL);

  const framework = readManifest(frameworkPath);
  if (!framework) {
    return { written: false, backup: null, frameworkCount: 0, userCount: 0 };
  }

  const existingUser = readManifest(userPath);
  const userEntries = (existingUser?.files ?? []).filter(
    (f) => f.origin === "user" && typeof f.path === "string",
  );

  const merged: CoreManifest = {
    id: framework.id,
    type: framework.type,
    files: [
      ...framework.files.map((f) => ({
        path: f.path,
        origin: "framework" as const,
        auto_load: f.auto_load !== false,
      })),
      ...userEntries.map((f) => ({
        path: f.path,
        origin: "user" as const,
        auto_load: f.auto_load !== false,
      })),
    ],
  };

  let backup: string | null = null;
  if (createBackup && existsSync(userPath)) {
    backup = backupUserManifest(projectRoot, userPath);
  }

  mkdirSync(path.dirname(userPath), { recursive: true });
  writeFileSync(userPath, stringifyYaml(merged), "utf-8");

  return {
    written: true,
    backup,
    frameworkCount: merged.files.filter((f) => f.origin === "framework").length,
    userCount: merged.files.filter((f) => f.origin === "user").length,
  };
}

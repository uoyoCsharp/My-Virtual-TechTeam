import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FRAMEWORK_DIR, LEGACY_FRAMEWORK_DIR } from "./paths.js";

export class LegacyLayoutConflictError extends Error {
  constructor(projectRoot: string) {
    super(
      `Both ${LEGACY_FRAMEWORK_DIR} and ${FRAMEWORK_DIR} exist in ${projectRoot}. ` +
        "Keep exactly one framework directory (normally .mvtt) and re-run.",
    );
    this.name = "LegacyLayoutConflictError";
  }
}

export interface LayoutMigrationResult {
  migrated: boolean;
}

export function hasLegacyLayout(projectRoot: string): boolean {
  return existsSync(path.join(projectRoot, LEGACY_FRAMEWORK_DIR));
}

interface ManifestLike {
  files?: Record<string, unknown>;
  [key: string]: unknown;
}

function relocateManifestPaths(
  frameworkDir: string,
  fromPrefix: string,
  toPrefix: string,
): void {
  const manifestPath = path.join(frameworkDir, ".mvtt-manifest.json");
  if (!existsSync(manifestPath)) return;

  const raw = readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(raw) as ManifestLike;
  if (!manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    return;
  }

  const from = `${fromPrefix}/`;
  const to = `${toPrefix}/`;
  const files: Record<string, unknown> = {};
  for (const [relPath, record] of Object.entries(manifest.files)) {
    files[relPath.startsWith(from) ? `${to}${relPath.slice(from.length)}` : relPath] = record;
  }

  manifest.files = files;
  const tmpPath = `${manifestPath}.tmp-${process.pid}`;
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), "utf-8");
  renameSync(tmpPath, manifestPath);
}

export function migrateLegacyLayout(projectRoot: string): LayoutMigrationResult {
  const legacyDir = path.join(projectRoot, LEGACY_FRAMEWORK_DIR);
  const targetDir = path.join(projectRoot, FRAMEWORK_DIR);

  if (!existsSync(legacyDir)) return { migrated: false };
  if (existsSync(targetDir)) throw new LegacyLayoutConflictError(projectRoot);

  renameSync(legacyDir, targetDir);

  try {
    relocateManifestPaths(targetDir, LEGACY_FRAMEWORK_DIR, FRAMEWORK_DIR);
  } catch (err) {
    renameSync(targetDir, legacyDir);
    throw err;
  }

  return { migrated: true };
}

export function rollbackLegacyLayout(projectRoot: string): void {
  const legacyDir = path.join(projectRoot, LEGACY_FRAMEWORK_DIR);
  const targetDir = path.join(projectRoot, FRAMEWORK_DIR);

  if (!existsSync(targetDir) || existsSync(legacyDir)) return;

  relocateManifestPaths(targetDir, FRAMEWORK_DIR, LEGACY_FRAMEWORK_DIR);
  try {
    renameSync(targetDir, legacyDir);
  } catch (err) {
    relocateManifestPaths(targetDir, LEGACY_FRAMEWORK_DIR, FRAMEWORK_DIR);
    throw err;
  }
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MaterializedFile } from "./materialize.js";
import type { PlatformId } from "../types/platform.js";
import { DEFAULT_PLATFORMS, getPlatformById } from "../types/platform.js";
import { FRAMEWORK_DIR, MANIFEST_REL } from "./paths.js";

export interface InstalledFileRecord {
  hash: string;
  category: "generated" | "create_once";
}

export interface InstallationManifest {
  mvtt_version: string;
  installed_at: string;
  last_updated_at: string;
  platforms?: PlatformId[];
  platformSkillDirs?: Record<string, string>;
  files: Record<string, InstalledFileRecord>;
}

export function manifestPath(projectRoot: string): string {
  return path.resolve(projectRoot, MANIFEST_REL);
}

/** Read a manifest from an explicit framework directory (used for legacy detection). */
export function readInstallationManifestFrom(
  projectRoot: string,
  frameworkDir: string,
): InstallationManifest | null {
  const p = path.resolve(projectRoot, frameworkDir, ".mvtt-manifest.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as InstallationManifest;
}

export function readInstallationManifest(projectRoot: string): InstallationManifest | null {
  return readInstallationManifestFrom(projectRoot, FRAMEWORK_DIR);
}

export function readInstalledPlatforms(
  projectOrManifest: string | InstallationManifest,
): PlatformId[] {
  const manifest =
    typeof projectOrManifest === "string"
      ? readInstallationManifest(projectOrManifest)
      : projectOrManifest;
  if (!manifest?.platforms || manifest.platforms.length === 0) {
    return DEFAULT_PLATFORMS;
  }
  const valid = manifest.platforms.filter(
    (p): p is PlatformId => getPlatformById(p) !== undefined,
  );
  return valid.length > 0 ? valid : DEFAULT_PLATFORMS;
}

export interface InstalledPlatformsInfo {
  platforms: PlatformId[];
  unknown: string[];
  usedDefault: boolean;
  allInvalid: boolean;
}

export function inspectInstalledPlatforms(
  manifest: InstallationManifest,
): InstalledPlatformsInfo {
  const raw = Array.isArray(manifest.platforms) ? manifest.platforms : [];
  const unknown = raw.filter((id) => getPlatformById(id) === undefined);
  const valid = [...new Set(raw.filter((id) => getPlatformById(id) !== undefined))];

  if (raw.length === 0) {
    return { platforms: DEFAULT_PLATFORMS, unknown, usedDefault: true, allInvalid: false };
  }
  return {
    platforms: valid,
    unknown,
    usedDefault: false,
    allInvalid: valid.length === 0,
  };
}

export function writeInstallationManifest(
  projectRoot: string,
  version: string,
  files: MaterializedFile[],
  previous: InstallationManifest | null,
  platforms?: PlatformId[],
): InstallationManifest {
  const now = new Date().toISOString();
  const fileMap: Record<string, InstalledFileRecord> = {};
  for (const f of files) {
    fileMap[f.relPath] = { hash: f.hash, category: f.category };
  }

  const resolvedPlatforms = platforms ?? previous?.platforms ?? DEFAULT_PLATFORMS;
  const platformSkillDirs: Record<string, string> = {};
  for (const id of resolvedPlatforms) {
    const platform = getPlatformById(id);
    if (platform) platformSkillDirs[id] = platform.skillDir;
  }

  const manifest: InstallationManifest = {
    mvtt_version: version,
    installed_at: previous?.installed_at ?? now,
    last_updated_at: now,
    platforms: resolvedPlatforms,
    platformSkillDirs,
    files: fileMap,
  };

  writeFileSync(manifestPath(projectRoot), JSON.stringify(manifest, null, 2), "utf-8");
  return manifest;
}

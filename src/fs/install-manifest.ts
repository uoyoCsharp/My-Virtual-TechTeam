import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MaterializedFile } from "./materialize.js";
import type { PlatformId } from "../types/platform.js";
import { DEFAULT_PLATFORMS, getPlatformById } from "../types/platform.js";

export interface InstalledFileRecord {
  hash: string;
  category: "generated" | "create_once";
}

export interface InstallationManifest {
  mvtt_version: string;
  installed_at: string;
  last_updated_at: string;
  platforms?: PlatformId[];
  files: Record<string, InstalledFileRecord>;
}

const MANIFEST_REL = ".ai-agents/.mvtt-manifest.json";

export function manifestPath(projectRoot: string): string {
  return path.resolve(projectRoot, MANIFEST_REL);
}

export function readInstallationManifest(projectRoot: string): InstallationManifest | null {
  const p = manifestPath(projectRoot);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as InstallationManifest;
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

  const manifest: InstallationManifest = {
    mvtt_version: version,
    installed_at: previous?.installed_at ?? now,
    last_updated_at: now,
    platforms: platforms ?? previous?.platforms ?? DEFAULT_PLATFORMS,
    files: fileMap,
  };

  writeFileSync(manifestPath(projectRoot), JSON.stringify(manifest, null, 2), "utf-8");
  return manifest;
}

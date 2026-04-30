import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MaterializedFile } from "./materialize.js";

export interface InstalledFileRecord {
  hash: string;
  category: "generated" | "create_once";
}

export interface InstallationManifest {
  mvtt_version: string;
  installed_at: string;
  last_updated_at: string;
  pattern: string | null;
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

export function writeInstallationManifest(
  projectRoot: string,
  version: string,
  pattern: string | null,
  files: MaterializedFile[],
  previous: InstallationManifest | null,
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
    pattern,
    files: fileMap,
  };

  writeFileSync(manifestPath(projectRoot), JSON.stringify(manifest, null, 2), "utf-8");
  return manifest;
}

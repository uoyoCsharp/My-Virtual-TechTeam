import { existsSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { materializeProject } from "../fs/materialize.js";
import {
  readInstallationManifest,
  writeInstallationManifest,
} from "../fs/install-manifest.js";
import { hashFile } from "../fs/hash.js";
import { getPackageRoot, getVersion } from "./shared.js";

export interface UpdateOptions {
  check?: boolean;
}

export function updateCommand(options: UpdateOptions = {}): void {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const checkOnly = options.check === true;

  const existing = readInstallationManifest(projectRoot);
  if (!existing) {
    console.error(`MVTT is not installed in this project. Run \`mvtt install\` first.`);
    process.exit(1);
  }

  if (existing.mvtt_version === version && !checkOnly) {
    console.log(`Already at v${version}. Nothing to update.`);
    return;
  }

  if (checkOnly) {
    console.log(`Current: v${existing.mvtt_version}`);
    console.log(`Latest:  v${version}`);
    if (existing.mvtt_version !== version) {
      console.log(`Run \`mvtt update\` to upgrade.`);
    } else {
      console.log(`Up to date.`);
    }
    return;
  }

  const modified: string[] = [];
  for (const [relPath, record] of Object.entries(existing.files)) {
    if (record.category !== "generated") continue;
    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) continue;
    const currentHash = hashFile(absPath);
    if (currentHash !== record.hash) {
      modified.push(relPath);
    }
  }

  if (modified.length > 0) {
    console.warn(`\nWarning: the following generated files have been modified:`);
    for (const f of modified) console.warn(`  - ${f}`);
    console.warn(`These changes will be OVERWRITTEN by update.\n`);
  }

  console.log(`Updating MVTT from v${existing.mvtt_version} to v${version}...`);

  const materialized = materializeProject({
    packageRoot,
    projectRoot,
    overwriteCreateOnce: false,
  });

  const removed = removeStaleGeneratedFiles(projectRoot, existing.files, materialized);
  if (removed.length > 0) {
    console.log(`Removed ${removed.length} stale generated file(s):`);
    for (const f of removed) console.log(`  - ${f}`);
  }

  writeInstallationManifest(projectRoot, version, materialized, existing);

  console.log(`\nUpdate complete: ${materialized.length} files processed.`);
}

function removeStaleGeneratedFiles(
  projectRoot: string,
  previousFiles: Record<string, { category: string; hash: string }>,
  current: Array<{ relPath: string; category: string }>,
): string[] {
  const currentSet = new Set(current.map((m) => m.relPath));
  const removed: string[] = [];

  for (const [relPath, record] of Object.entries(previousFiles)) {
    if (record.category !== "generated") continue;
    if (currentSet.has(relPath)) continue;

    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) continue;

    rmSync(absPath, { force: true });
    removed.push(relPath);

    let parent = path.dirname(absPath);
    const stopAt = path.resolve(projectRoot);
    while (parent.startsWith(stopAt) && parent !== stopAt) {
      if (!existsSync(parent)) break;
      const entries = readdirSync(parent);
      if (entries.length > 0) break;
      rmSync(parent, { recursive: true, force: true });
      parent = path.dirname(parent);
    }
  }

  return removed;
}

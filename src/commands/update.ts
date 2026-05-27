import { existsSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { materializeProject } from "../fs/materialize.js";
import {
  readInstallationManifest,
  writeInstallationManifest,
} from "../fs/install-manifest.js";
import { hashFile } from "../fs/hash.js";
import { getPackageRoot, getVersion } from "./shared.js";
import { detectLegacyArtifacts } from "./doctor.js";
import { color } from "../util/color.js";
import {
  migrateAll,
  migrateConfig,
  migrateManifests,
  migratePaths,
  migrateRegistry,
  type MigrationResult,
} from "./migrate.js";

export interface UpdateOptions {
  check?: boolean;
  migrateManifests?: boolean;
  migratePaths?: boolean;
  migrateConfig?: boolean;
  migrateRegistry?: boolean;
  migrateAll?: boolean;
}

export function updateCommand(options: UpdateOptions = {}): void {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const checkOnly = options.check === true;

  if (
    options.migrateAll ||
    options.migrateManifests ||
    options.migratePaths ||
    options.migrateConfig ||
    options.migrateRegistry
  ) {
    runMigrations(projectRoot, options);
    return;
  }

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

  writeInstallationManifest(projectRoot, version, existing.pattern, materialized, existing);

  console.log(`\nUpdate complete: ${materialized.length} files processed.`);

  emitLegacyHint(projectRoot);
}

function emitLegacyHint(projectRoot: string): void {
  const legacy = detectLegacyArtifacts(projectRoot);
  if (legacy.length === 0) return;
  console.log(
    `\n${color.yellow("Legacy artifacts detected:")} ${legacy.length} item(s).`,
  );
  console.log(`  Run ${color.cyan("mvtt doctor")} for details and migration commands.`);
}

function runMigrations(projectRoot: string, options: UpdateOptions): void {
  const ran: Array<[string, MigrationResult]> = [];

  if (options.migrateAll) {
    const result = migrateAll(projectRoot);
    ran.push(["manifests", result.manifests]);
    ran.push(["paths", result.paths]);
    ran.push(["config", result.config]);
    ran.push(["registry", result.registry]);
  } else {
    if (options.migrateManifests) ran.push(["manifests", migrateManifests(projectRoot)]);
    if (options.migratePaths) ran.push(["paths", migratePaths(projectRoot)]);
    if (options.migrateConfig) ran.push(["config", migrateConfig(projectRoot)]);
    if (options.migrateRegistry) ran.push(["registry", migrateRegistry(projectRoot)]);
  }

  let migrated = 0;
  for (const [label, result] of ran) {
    if (result.skipped) {
      console.log(`[skip] ${label}: ${result.reason ?? "nothing to migrate"}`);
      continue;
    }
    migrated++;
    console.log(`[done] ${label}: ${result.changes?.join("; ") ?? "migrated"}`);
    if (result.backup) {
      console.log(`       backup -> ${path.relative(projectRoot, result.backup)}`);
    }
  }

  console.log(
    `\nMigration complete: ${migrated} migrated, ${ran.length - migrated} skipped.`,
  );
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

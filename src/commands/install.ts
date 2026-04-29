import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { materializeProject } from "../fs/materialize.js";
import {
  manifestPath,
  readInstallationManifest,
  writeInstallationManifest,
} from "../fs/install-manifest.js";
import { getPackageRoot, getVersion } from "./shared.js";

export function installCommand(args: string[]): void {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();

  const existing = readInstallationManifest(projectRoot);
  if (existing) {
    console.error(
      `MVTT is already installed (v${existing.mvtt_version}). Use \`mvtt update\` to update.`,
    );
    process.exit(1);
  }

  const patternIdx = args.indexOf("--pattern");
  const pattern = patternIdx >= 0 ? args[patternIdx + 1] ?? null : null;

  console.log(`Installing MVTT v${version} into ${projectRoot}...`);

  const materialized = materializeProject({
    packageRoot,
    projectRoot,
    overwriteCreateOnce: false,
  });

  if (pattern) {
    const configPath = path.resolve(projectRoot, ".ai-agents/config.yaml");
    const config = readFileSync(configPath, "utf-8");
    const updated = config.replace(/active:\s*""/, `active: "${pattern}"`);
    writeFileSync(configPath, updated, "utf-8");
    console.log(`Pattern set: ${pattern}`);
  }

  writeInstallationManifest(projectRoot, version, pattern, materialized, null);

  const generatedCount = materialized.filter((f) => f.category === "generated").length;
  const createOnceCount = materialized.filter((f) => f.category === "create_once").length;

  console.log(`\nInstallation complete:`);
  console.log(`  ${generatedCount} generated files`);
  console.log(`  ${createOnceCount} user-editable files`);
  console.log(`  Manifest: ${path.relative(projectRoot, manifestPath(projectRoot))}`);
  console.log(`\nNext steps:`);
  console.log(`  Run /mvt-init in Claude Code to initialize the project`);
}

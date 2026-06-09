import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { manifestPath, readInstallationManifest, readInstalledPlatforms } from "../fs/install-manifest.js";
import { PLATFORMS, getPlatformById } from "../types/platform.js";

export async function uninstallCommand(): Promise<void> {
  const projectRoot = process.cwd();

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    console.error(`MVTT is not installed in this project.`);
    process.exit(1);
  }

  const generated = Object.entries(manifest.files).filter(
    ([, r]) => r.category === "generated",
  );

  console.log(`The following ${generated.length} generated files will be removed:`);
  for (const [rel] of generated) console.log(`  - ${rel}`);
  console.log(`\nUser data (workspace/, custom/, principle/, project/, config.yaml) will be PRESERVED.`);

  const confirmed = await confirmUninstall();
  if (!confirmed) {
    console.log(`\nUninstall cancelled.`);
    return;
  }

  for (const [rel] of generated) {
    const abs = path.resolve(projectRoot, rel);
    if (existsSync(abs)) unlinkSync(abs);
  }

  // Clean up residual mvt-* directories across all known platforms.
  // Fall back to all known platforms if manifest is unreadable.
  const installedPlatforms = readInstalledPlatforms(projectRoot);
  const platformIds =
    installedPlatforms.length > 0
      ? installedPlatforms
      : PLATFORMS.map((p) => p.id);

  for (const platformId of platformIds) {
    const platform = getPlatformById(platformId);
    if (!platform) continue;
    const skillsRoot = path.resolve(projectRoot, platform.skillDir);
    if (existsSync(skillsRoot)) {
      for (const entry of readdirSync(skillsRoot)) {
        const entryPath = path.join(skillsRoot, entry);
        if (statSync(entryPath).isDirectory() && entry.startsWith("mvt-")) {
          rmSync(entryPath, { recursive: true, force: true });
        }
      }
    }
  }

  unlinkSync(manifestPath(projectRoot));

  console.log(`\nUninstall complete. User data preserved.`);
}

async function confirmUninstall(): Promise<boolean> {
  const response = await prompts(
    {
      type: "select",
      name: "value",
      message: "Proceed with uninstall?",
      choices: [
        { title: "No, keep everything", value: false },
        { title: "Yes, remove generated files", value: true },
      ],
      initial: 0,
    },
    {
      onCancel: () => {
        throw new Error("Cancelled");
      },
    },
  );

  return response.value === true;
}

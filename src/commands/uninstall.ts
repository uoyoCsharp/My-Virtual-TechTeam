import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { manifestPath, readInstallationManifest } from "../fs/install-manifest.js";

export function uninstallCommand(args: string[]): void {
  const projectRoot = process.cwd();
  const force = args.includes("--yes") || args.includes("-y");

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

  if (!force) {
    console.log(`\nRe-run with --yes to confirm uninstall.`);
    return;
  }

  for (const [rel] of generated) {
    const abs = path.resolve(projectRoot, rel);
    if (existsSync(abs)) unlinkSync(abs);
  }

  const skillsRoot = path.resolve(projectRoot, ".claude/skills");
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot)) {
      const entryPath = path.join(skillsRoot, entry);
      if (statSync(entryPath).isDirectory() && entry.startsWith("mvt-")) {
        rmSync(entryPath, { recursive: true, force: true });
      }
    }
  }

  unlinkSync(manifestPath(projectRoot));

  console.log(`\nUninstall complete. User data preserved.`);
}

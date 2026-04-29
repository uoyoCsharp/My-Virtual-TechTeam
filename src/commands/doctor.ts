import { existsSync } from "node:fs";
import path from "node:path";
import { readInstallationManifest } from "../fs/install-manifest.js";
import { hashFile } from "../fs/hash.js";
import { getVersion } from "./shared.js";

export function doctorCommand(_args: string[]): void {
  const projectRoot = process.cwd();
  const version = getVersion();
  const checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }> = [];

  console.log(`mvtt doctor v${version}\n`);

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    checks.push({ status: "FAIL", message: ".ai-agents/.mvtt-manifest.json not found (MVTT not installed)" });
    report(checks);
    process.exit(1);
    return;
  }

  checks.push({ status: "PASS", message: `.mvtt-manifest.json exists (v${manifest.mvtt_version})` });

  let missing = 0;
  let modified = 0;
  let total = 0;
  for (const [relPath, record] of Object.entries(manifest.files)) {
    total++;
    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) {
      missing++;
      checks.push({ status: "FAIL", message: `Missing file: ${relPath}` });
      continue;
    }
    if (record.category === "generated") {
      const currentHash = hashFile(absPath);
      if (currentHash !== record.hash) {
        modified++;
        checks.push({ status: "WARN", message: `Manually modified: ${relPath}` });
      }
    }
  }

  if (missing === 0 && modified === 0) {
    checks.push({ status: "PASS", message: `All ${total} tracked files present and unmodified` });
  }

  const userDirs = [
    ".ai-agents/workspace",
    ".ai-agents/workspace/artifacts",
    ".ai-agents/skills/_templates/custom",
    ".ai-agents/knowledge/principle",
    ".ai-agents/knowledge/project",
  ];
  let userDirsOk = true;
  for (const dir of userDirs) {
    if (!existsSync(path.resolve(projectRoot, dir))) {
      checks.push({ status: "WARN", message: `User data dir missing: ${dir}` });
      userDirsOk = false;
    }
  }
  if (userDirsOk) {
    checks.push({ status: "PASS", message: "All user data directories present" });
  }

  report(checks);

  const errors = checks.filter((c) => c.status === "FAIL").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  if (errors > 0) process.exit(1);
}

function report(checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }>): void {
  for (const c of checks) {
    console.log(`[${c.status}] ${c.message}`);
  }
  const errors = checks.filter((c) => c.status === "FAIL").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  console.log(`\nSummary: ${warnings} warning${warnings === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}`);
}

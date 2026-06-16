import { existsSync } from "node:fs";
import path from "node:path";
import { readInstallationManifest } from "../fs/install-manifest.js";
import { hashFile } from "../fs/hash.js";
import { getVersion } from "./shared.js";
import { color } from "../util/color.js";
import { bilingual } from "../util/bilingual.js";

export function doctorCommand(): void {
  const projectRoot = process.cwd();
  const version = getVersion();
  const checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }> = [];

  console.log(bilingual(`mvtt doctor v${version}`, `mvtt doctor v${version}`) + `\n`);

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    checks.push({
      status: "FAIL",
      message: bilingual(
        ".ai-agents/.mvtt-manifest.json not found (MVTT not installed)",
        ".ai-agents/.mvtt-manifest.json 不存在（MVTT 尚未安装）",
      ),
    });
    report(checks);
    process.exit(1);
    return;
  }

  checks.push({
    status: "PASS",
    message: bilingual(
      `.mvtt-manifest.json exists (v${manifest.mvtt_version})`,
      `.mvtt-manifest.json 存在（v${manifest.mvtt_version}）`,
    ),
  });

  let missing = 0;
  let modified = 0;
  let total = 0;
  for (const [relPath, record] of Object.entries(manifest.files)) {
    total++;
    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) {
      missing++;
      checks.push({ status: "FAIL", message: bilingual(`Missing file: ${relPath}`, `缺少文件：${relPath}`) });
      continue;
    }
    if (record.category === "generated") {
      const currentHash = hashFile(absPath);
      if (currentHash !== record.hash) {
        modified++;
        checks.push({ status: "WARN", message: bilingual(`Manually modified: ${relPath}`, `已被手动修改：${relPath}`) });
      }
    }
  }

  if (missing === 0 && modified === 0) {
    checks.push({
      status: "PASS",
      message: bilingual(
        `All ${total} tracked files present and unmodified`,
        `全部 ${total} 个跟踪文件均存在且未被修改`,
      ),
    });
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
      checks.push({ status: "WARN", message: bilingual(`User data dir missing: ${dir}`, `用户数据目录缺失：${dir}`) });
      userDirsOk = false;
    }
  }
  if (userDirsOk) {
    checks.push({ status: "PASS", message: bilingual("All user data directories present", "所有用户数据目录均存在") });
  }

  report(checks);

  const errors = checks.filter((c) => c.status === "FAIL").length;
  if (errors > 0) process.exit(1);
}

function report(checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }>): void {
  for (const c of checks) {
    const tag =
      c.status === "PASS"
        ? color.green(`[${c.status}]`)
        : c.status === "WARN"
          ? color.yellow(`[${c.status}]`)
          : color.red(`[${c.status}]`);
    console.log(`${tag} ${c.message}`);
  }
  const errors = checks.filter((c) => c.status === "FAIL").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  const summary = bilingual(
    `\nSummary: ${warnings} warning${warnings === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}`,
    `\n汇总：${warnings} 个警告，${errors} 个错误`,
  );
  console.log(errors > 0 ? color.red(summary) : warnings > 0 ? color.yellow(summary) : color.green(summary));
}

import { existsSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { readInstallationManifest } from "../fs/install-manifest.js";
import { hasLegacyLayout } from "../fs/legacy-layout.js";
import { FRAMEWORK_DIR, LEGACY_FRAMEWORK_DIR, MANIFEST_REL, fw } from "../fs/paths.js";
import { hashFile } from "../fs/hash.js";
import { getVersion } from "./shared.js";
import { bilingual } from "../util/bilingual.js";
import { color } from "../util/color.js";

export function doctorCommand(): void {
  const projectRoot = process.cwd();
  const version = getVersion();
  const checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }> = [];

  p.intro(color.cyan(bilingual(
    `mvtt doctor v${version}`,
    `mvtt doctor v${version}`,
  )));

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    checks.push({
      status: "FAIL",
      message: hasLegacyLayout(projectRoot)
        ? bilingual(
          `Legacy ${LEGACY_FRAMEWORK_DIR}/ layout detected. Run \`mvtt update\` to migrate it to ${FRAMEWORK_DIR}/.`,
          `检测到旧目录 ${LEGACY_FRAMEWORK_DIR}/。请运行 \`mvtt update\` 迁移到 ${FRAMEWORK_DIR}/。`,
        )
        : bilingual(
          `${MANIFEST_REL} not found (MVTT not installed)`,
          `${MANIFEST_REL} 不存在（MVTT 尚未安装）`,
        ),
    });
    report(checks);
    process.exit(1);
    return;
  }

  if (hasLegacyLayout(projectRoot)) {
    checks.push({
      status: "WARN",
      message: bilingual(
        `Legacy ${LEGACY_FRAMEWORK_DIR}/ also exists; keep only ${FRAMEWORK_DIR}/ and remove the old directory manually.`,
        `旧目录 ${LEGACY_FRAMEWORK_DIR}/ 仍然存在；请只保留 ${FRAMEWORK_DIR}/ 并手动删除旧目录。`,
      ),
    });
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
    fw("workspace"),
    fw("workspace/artifacts"),
    fw("skills/_templates/custom"),
    fw("knowledge/principle"),
    fw("knowledge/project"),
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
    const fn = c.status === "PASS" ? p.log.success : c.status === "WARN" ? p.log.warn : p.log.error;
    fn(`[${c.status}] ${c.message}`);
  }
  const errors = checks.filter((c) => c.status === "FAIL").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  const summary = bilingual(
    `Summary: ${warnings} warning${warnings === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}`,
    `汇总：${warnings} 个警告，${errors} 个错误`,
  );
  if (errors > 0) p.log.error(summary);
  else if (warnings > 0) p.log.warn(summary);
  else p.log.success(summary);
}

import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { manifestPath, readInstallationManifest, readInstalledPlatforms } from "../fs/install-manifest.js";
import { PLATFORMS, getPlatformById } from "../types/platform.js";
import { bilingual } from "../util/bilingual.js";
import { cancelled } from "../util/cancel.js";
import { color } from "../util/color.js";

const USER_DATA_PATHS: string[] = [
  ".ai-agents/workspace",
  ".ai-agents/skills/_templates/custom",
  ".ai-agents/knowledge/principle",
  ".ai-agents/knowledge/project",
  ".ai-agents/knowledge/core/user",
  ".ai-agents/config.yaml",
  ".ai-agents/registry.yaml",
  ".ai-agents/knowledge/core/manifest.yaml",
  ".ai-agents/workspace/session.yaml",
  ".ai-agents/workspace/project-context.yaml",
];

export async function uninstallCommand(): Promise<void> {
  const projectRoot = process.cwd();

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    console.error(bilingual("MVTT is not installed in this project.", "MVTT 尚未安装到当前项目。"));
    process.exit(1);
  }

  const generated = Object.entries(manifest.files).filter(
    ([, r]) => r.category === "generated",
  );

  p.intro(color.cyan(bilingual(
    `MVTT Uninstaller — ${generated.length} file(s) to remove`,
    `MVTT 卸载器 — 将删除 ${generated.length} 个文件`,
  )));

  p.log.info(bilingual(
    `By default, user data will be PRESERVED (workspace/, custom skills, principle/, project/, config.yaml, ...).`,
    `默认情况下将保留用户数据（工作区、自定义技能、原则、项目、config.yaml 等）。`,
  ));
  p.log.info(bilingual(
    "You will be asked whether to also remove user data.",
    "接下来会询问是否一并删除用户数据。",
  ));

  const confirmed = await confirmUninstall();
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel(bilingual("Uninstall cancelled.", "已取消卸载。"));
    return;
  }

  const preserveUserData = await confirmUserDataPreservation();
  if (p.isCancel(preserveUserData)) cancelled();

  for (const [rel] of generated) {
    const abs = path.resolve(projectRoot, rel);
    if (existsSync(abs)) unlinkSync(abs);
  }

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

  if (!preserveUserData) {
    removeUserData(projectRoot);
  }

  unlinkSync(manifestPath(projectRoot));

  p.outro(color.green(
    preserveUserData
      ? bilingual("Uninstall complete. User data preserved.", "卸载完成。已保留用户数据。")
      : bilingual("Uninstall complete. All MVTT data removed.", "卸载完成。已删除所有 MVTT 数据。"),
  ));
}

async function confirmUninstall(): Promise<boolean | symbol> {
  return p.confirm({
    message: bilingual("Proceed with uninstall?", "确认卸载？"),
    active: bilingual("Yes, remove", "是，删除"),
    inactive: bilingual("No, keep", "否，保留"),
    initialValue: false,
  });
}

async function confirmUserDataPreservation(): Promise<boolean | symbol> {
  return p.confirm({
    message: bilingual("Preserve user data?", "是否保留用户数据？"),
    active: bilingual("Yes, preserve", "是，保留"),
    inactive: bilingual("No, remove all", "否，全部删除"),
    initialValue: true,
  });
}

function removeUserData(projectRoot: string): void {
  for (const rel of USER_DATA_PATHS) {
    const abs = path.resolve(projectRoot, rel);
    if (!existsSync(abs)) continue;
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      rmSync(abs, { recursive: true, force: true });
    } else {
      unlinkSync(abs);
    }
  }
}

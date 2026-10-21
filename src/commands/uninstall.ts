import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  manifestPath,
  readInstallationManifest,
  readInstallationManifestFrom,
  readInstalledPlatforms,
} from "../fs/install-manifest.js";
import {
  hasLegacyLayout,
  migrateLegacyLayout,
  rollbackLegacyLayout,
} from "../fs/legacy-layout.js";
import { FRAMEWORK_DIR, LEGACY_FRAMEWORK_DIR, fw } from "../fs/paths.js";
import { PLATFORMS, getPlatformById } from "../types/platform.js";
import { bilingual } from "../util/bilingual.js";
import { color } from "../util/color.js";

const USER_DATA_PATHS: string[] = [
  fw("workspace"),
  fw("skills/_templates/custom"),
  fw("knowledge/principle"),
  fw("knowledge/project"),
  fw("knowledge/core/user"),
  fw("config.yaml"),
  fw("registry.yaml"),
  fw("knowledge/core/manifest.yaml"),
  fw("workspace/session.yaml"),
  fw("workspace/project-context.yaml"),
];

export async function uninstallCommand(): Promise<void> {
  const projectRoot = process.cwd();

  const newManifest = readInstallationManifest(projectRoot);
  const legacyManifest = newManifest
    ? null
    : readInstallationManifestFrom(projectRoot, LEGACY_FRAMEWORK_DIR);
  const manifestForInfo = newManifest ?? legacyManifest;

  if (!manifestForInfo) {
    console.error(bilingual("MVTT is not installed in this project.", "MVTT 尚未安装到当前项目。"));
    process.exit(1);
  }

  if (hasLegacyLayout(projectRoot) && existsSync(path.join(projectRoot, FRAMEWORK_DIR))) {
    console.error(bilingual(
      `Both ${LEGACY_FRAMEWORK_DIR}/ and ${FRAMEWORK_DIR}/ exist. Keep only ${FRAMEWORK_DIR}/ and remove the old directory.`,
      `旧目录 ${LEGACY_FRAMEWORK_DIR}/ 与 ${FRAMEWORK_DIR}/ 同时存在。请只保留 ${FRAMEWORK_DIR}/ 并手动删除旧目录。`,
    ));
    process.exit(1);
  }

  const usingLegacyLayout = !newManifest;
  const generatedCount = Object.entries(manifestForInfo.files).filter(
    ([, record]) => record.category === "generated",
  ).length;

  p.intro(color.cyan(bilingual(
    `MVTT Uninstaller — ${generatedCount} file(s) to remove`,
    `MVTT 卸载器 — 将删除 ${generatedCount} 个文件`,
  )));

  p.log.info(bilingual(
    `By default, user data will be PRESERVED (workspace/, custom skills, principle/, project/, config.yaml, ...).`,
    `默认情况下将保留用户数据（工作区、自定义技能、原则、项目、config.yaml 等）。`,
  ));
  p.log.info(bilingual(
    "You will be asked whether to also remove user data.",
    "接下来会询问是否一并删除用户数据。",
  ));
  if (usingLegacyLayout) {
    p.log.info(bilingual(
      `Legacy ${LEGACY_FRAMEWORK_DIR}/ layout will be migrated to ${FRAMEWORK_DIR}/ as part of the uninstall.`,
      `卸载过程中会将旧目录 ${LEGACY_FRAMEWORK_DIR}/ 迁移为 ${FRAMEWORK_DIR}/。`,
    ));
  }

  const confirmed = await confirmUninstall();
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel(bilingual("Uninstall cancelled.", "已取消卸载。"));
    return;
  }

  const preserveUserData = await confirmUserDataPreservation();
  if (p.isCancel(preserveUserData)) {
    p.cancel(bilingual("Uninstall cancelled.", "已取消卸载。"));
    return;
  }

  let migrated = false;
  if (usingLegacyLayout) {
    try {
      migrated = migrateLegacyLayout(projectRoot).migrated;
    } catch (err) {
      console.error(bilingual(
        `Cannot migrate legacy layout: ${(err as Error).message}`,
        `无法迁移旧目录布局：${(err as Error).message}`,
      ));
      process.exit(1);
    }
  }

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    if (migrated) rollbackLegacyLayout(projectRoot);
    console.error(bilingual("MVTT is not installed in this project.", "MVTT 尚未安装到当前项目。"));
    process.exit(1);
  }

  const generated = Object.entries(manifest.files).filter(
    ([, record]) => record.category === "generated",
  );

  for (const [rel] of generated) {
    const abs = path.resolve(projectRoot, rel);
    if (existsSync(abs)) unlinkSync(abs);
  }

  const installedPlatforms = readInstalledPlatforms(projectRoot);
  const platformIds =
    installedPlatforms.length > 0
      ? installedPlatforms
      : PLATFORMS.map((platform) => platform.id);

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

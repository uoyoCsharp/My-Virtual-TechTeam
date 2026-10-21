import { existsSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { materializeProject } from "../fs/materialize.js";
import { removeStaleGeneratedFiles } from "../fs/generated-cleanup.js";
import {
  readInstallationManifest,
  readInstallationManifestFrom,
  readInstalledPlatforms,
  writeInstallationManifest,
} from "../fs/install-manifest.js";
import { migrateLegacyLayout, rollbackLegacyLayout } from "../fs/legacy-layout.js";
import { BACKUP_DIR_REL, FRAMEWORK_DIR, LEGACY_FRAMEWORK_DIR } from "../fs/paths.js";
import { hashFile } from "../fs/hash.js";
import { getPackageRoot, getVersion } from "./shared.js";
import { bilingual } from "../util/bilingual.js";
import { startSpinner } from "../util/spinner.js";

export interface UpdateOptions {
  check?: boolean;
}

type UpdateRunResult = "completed" | "cancelled";

export async function updateCommand(options: UpdateOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const checkOnly = options.check === true;

  // --check is read-only: report from the legacy location instead of migrating.
  if (checkOnly) {
    const existing =
      readInstallationManifest(projectRoot) ??
      readInstallationManifestFrom(projectRoot, LEGACY_FRAMEWORK_DIR);
    if (!existing) {
      console.error(bilingual(
        "MVTT is not installed in this project. Run `mvtt install` first.",
        "MVTT 尚未安装到当前项目。请先运行 `mvtt install`。",
      ));
      process.exit(1);
    }
    console.log(bilingual(`Current: v${existing.mvtt_version}`, `当前版本：v${existing.mvtt_version}`));
    console.log(bilingual(`Latest:  v${version}`, `最新版本：v${version}`));
    if (existing.mvtt_version !== version) {
      console.log(bilingual("Run `mvtt update` to upgrade.", "运行 `mvtt update` 进行升级。"));
    } else {
      console.log(bilingual("Up to date.", "已是最新版本。"));
    }
    return;
  }

  // One-time migration: rename .ai-agents/ -> .mvtt/ so every downstream step
  // (manifest, registry merge, materialize) can use the normal paths unchanged.
  let migrated = false;
  try {
    migrated = migrateLegacyLayout(projectRoot).migrated;
  } catch (err) {
    console.error(bilingual(
      `Cannot migrate legacy layout: ${(err as Error).message}`,
      `无法迁移旧目录布局：${(err as Error).message}`,
    ));
    process.exit(1);
  }
  if (migrated) {
    console.log(bilingual(
      `Migrated legacy ${LEGACY_FRAMEWORK_DIR}/ to ${FRAMEWORK_DIR}/.`,
      `已将旧目录 ${LEGACY_FRAMEWORK_DIR}/ 迁移为 ${FRAMEWORK_DIR}/。`,
    ));
  }

  const existing = readInstallationManifest(projectRoot);
  if (!existing) {
    if (migrated) rollbackLegacyLayout(projectRoot);
    console.error(bilingual(
      "MVTT is not installed in this project. Run `mvtt install` first.",
      "MVTT 尚未安装到当前项目。请先运行 `mvtt install`。",
    ));
    process.exit(1);
  }

  let result: UpdateRunResult;
  try {
    result = await runUpdate(projectRoot, packageRoot, version, existing);
  } catch (err) {
    if (migrated) rollbackLegacyLayout(projectRoot);
    throw err;
  }
  if (migrated && result === "cancelled") {
    rollbackLegacyLayout(projectRoot);
    console.log(bilingual(
      "Migration rolled back because the update was cancelled.",
      "更新已取消，目录迁移已回滚。",
    ));
  }
}

async function runUpdate(
  projectRoot: string,
  packageRoot: string,
  version: string,
  existing: NonNullable<ReturnType<typeof readInstallationManifest>>,
): Promise<UpdateRunResult> {
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
    console.warn(bilingual(
      "\nWarning: the following generated files have been modified:",
      "\n警告：以下生成文件已被修改：",
    ));
    for (const f of modified) console.warn(`  - ${f}`);
    console.warn(bilingual(
      "These changes will be OVERWRITTEN by update.\n",
      "更新时将覆盖这些修改。\n",
    ));
  }

  // Backing up the existing registry / core-manifest is optional. In an
  // interactive terminal, let the user decide (defaults to yes); in a non-TTY
  // context (CI, pipes) there is no one to prompt, so fall back to backing up.
  let backup = true;
  if (process.stdout.isTTY) {
    const response = await p.confirm({
      message: bilingual(
        `Back up the existing registry and core-manifest to ${BACKUP_DIR_REL}/ before updating?`,
        `更新前是否将现有的 registry 和 core-manifest 备份到 ${BACKUP_DIR_REL}/？`,
      ),
      initialValue: true,
    });
    if (p.isCancel(response)) {
      console.log(bilingual("Update cancelled.", "已取消更新。"));
      return "cancelled";
    }
    backup = response;
  }

  console.log(existing.mvtt_version === version
    ? bilingual(
      `Refreshing MVTT v${version} generated files...`,
      `正在刷新 MVTT v${version} 生成文件...`,
    )
    : bilingual(
      `Updating MVTT from v${existing.mvtt_version} to v${version}...`,
      `正在将 MVTT 从 v${existing.mvtt_version} 更新到 v${version}...`,
    ));

  const platforms = readInstalledPlatforms(existing);
  const spinner = startSpinner(
    bilingual(`Materializing ${platforms.length} target(s)...`, `正在生成 ${platforms.length} 个目标...`),
  );
  let materialized: ReturnType<typeof materializeProject>;
  try {
    materialized = materializeProject({
      packageRoot,
      projectRoot,
      platforms,
      overwriteCreateOnce: false,
      backup,
    });
    spinner.succeed();
  } catch (err) {
    spinner.fail();
    throw err;
  }

  const removed = removeStaleGeneratedFiles(projectRoot, existing.files, materialized);
  if (removed.length > 0) {
    console.log(bilingual(
      `Removed ${removed.length} stale generated file(s):`,
      `已删除 ${removed.length} 个过时的生成文件:`,
    ));
    for (const f of removed) console.log(`  - ${f}`);
  }

  writeInstallationManifest(projectRoot, version, materialized, existing, platforms);

  console.log(bilingual(
    `\nUpdate complete: ${materialized.length} files processed.`,
    `\n更新完成:已处理 ${materialized.length} 个文件。`,
  ));
  console.log(bilingual(
    "Change platforms later with: mvtt platform update",
    "后续修改平台目标：mvtt platform update",
  ));
  return "completed";
}

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  readInstallationManifest,
  readInstallationManifestFrom,
  inspectInstalledPlatforms,
  type InstallationManifest,
} from "../fs/install-manifest.js";
import {
  hasLegacyLayout,
  migrateLegacyLayout,
  rollbackLegacyLayout,
} from "../fs/legacy-layout.js";
import { applyPlatformTargets, type ApplyPlatformTargetsResult } from "../fs/platform-apply.js";
import { readCustomSkillNames } from "../fs/custom-skills.js";
import { FRAMEWORK_DIR, LEGACY_FRAMEWORK_DIR } from "../fs/paths.js";
import {
  PLATFORMS,
  SELECTABLE_PLATFORMS,
  getPlatformById,
  type PlatformId,
} from "../types/platform.js";
import { getPackageRoot, getVersion } from "./shared.js";
import { bilingual } from "../util/bilingual.js";
import { color } from "../util/color.js";

const SELECTABLE_IDS = new Set(SELECTABLE_PLATFORMS.map((platform) => platform.id));

function currentManifest(projectRoot: string): InstallationManifest | null {
  return (
    readInstallationManifest(projectRoot) ??
    readInstallationManifestFrom(projectRoot, LEGACY_FRAMEWORK_DIR)
  );
}

function countManagedSkills(projectRoot: string, skillDir: string): number {
  const root = path.join(projectRoot, skillDir);
  if (!existsSync(root)) return 0;
  try {
    return readdirSync(root, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("mvt-"),
    ).length;
  } catch {
    return 0;
  }
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function describeTargets(ids: PlatformId[]): string {
  return ids.map((id) => getPlatformById(id)?.dir ?? id).join(", ");
}

export function platformListCommand(): void {
  const projectRoot = process.cwd();
  const manifest = currentManifest(projectRoot);
  const info = manifest ? inspectInstalledPlatforms(manifest) : null;
  const installed = new Set(info?.platforms ?? []);

  const hasNewLayout = existsSync(path.join(projectRoot, FRAMEWORK_DIR));
  const legacyLayout = hasLegacyLayout(projectRoot);

  console.log(color.bold(bilingual("Platforms (targets)", "平台目标")));
  console.log("");

  const widths = [10, 12, 24, 10, 7];
  const headers = ["ID", "DIR", "SKILLS DIR", "INSTALLED", "SKILLS", "DESCRIPTION"];
  console.log(
    headers
      .map((header, index) =>
        index === headers.length - 1 ? header : pad(header, widths[index]),
      )
      .join("  "),
  );

  for (const platform of PLATFORMS) {
    const isInstalled = installed.has(platform.id);
    const managed = isInstalled ? String(countManagedSkills(projectRoot, platform.skillDir)) : "-";
    console.log(
      [
        pad(platform.id, widths[0]),
        pad(platform.dir, widths[1]),
        pad(platform.skillDir, widths[2]),
        pad(isInstalled ? "yes" : "no", widths[3]),
        pad(managed, widths[4]),
        platform.description,
      ].join("  "),
    );
  }

  console.log("");

  const unknown = info?.unknown ?? [];
  if (unknown.length > 0) {
    console.log(color.yellow(bilingual(
      `Warning: manifest contains unknown platform id(s): ${unknown.join(", ")} (ignored)`,
      `警告：manifest 中存在未知平台 id：${unknown.join(", ")}（已忽略）`,
    )));
  }
  if (info?.usedDefault) {
    console.log(color.yellow(bilingual(
      "Manifest does not record platforms; assuming .claude (legacy install).",
      "manifest 未记录平台，按旧安装假定为 .claude。",
    )));
  }
  if (info?.allInvalid) {
    console.log(color.yellow(bilingual(
      "Manifest records no valid platform ids. Fix .mvtt/.mvtt-manifest.json or run `mvtt install` again.",
      "manifest 中没有有效的平台 id。请修复 .mvtt/.mvtt-manifest.json 或重新运行 `mvtt install`。",
    )));
  }

  if (legacyLayout && !hasNewLayout) {
    console.log(color.yellow(bilingual(
      `Legacy ${LEGACY_FRAMEWORK_DIR}/ layout detected. Run \`mvtt update\` to migrate it to ${FRAMEWORK_DIR}/.`,
      `检测到旧布局 ${LEGACY_FRAMEWORK_DIR}/。请运行 \`mvtt update\` 迁移到 ${FRAMEWORK_DIR}/。`,
    )));
  } else if (legacyLayout && hasNewLayout) {
    console.log(color.yellow(bilingual(
      `Both ${LEGACY_FRAMEWORK_DIR}/ and ${FRAMEWORK_DIR}/ exist. Keep only ${FRAMEWORK_DIR}/ and remove the old directory.`,
      `旧目录 ${LEGACY_FRAMEWORK_DIR}/ 与 ${FRAMEWORK_DIR}/ 同时存在。请只保留 ${FRAMEWORK_DIR}/ 并手动删除旧目录。`,
    )));
  }

  if (!manifest) {
    console.log(color.yellow(bilingual(
      "MVTT is not installed in this project. Run `mvtt install` first.",
      "MVTT 尚未安装到当前项目。请先运行 `mvtt install`。",
    )));
    return;
  }

  console.log(bilingual(
    "Tip: run `mvtt platform update` to add or remove targets interactively.",
    "提示：运行 `mvtt platform update` 以交互方式增删目标。",
  ));
}

export async function platformUpdateCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();

  const newManifest = readInstallationManifest(projectRoot);
  const legacyManifest = readInstallationManifestFrom(projectRoot, LEGACY_FRAMEWORK_DIR);
  const manifest = newManifest ?? legacyManifest;

  if (!manifest) {
    console.error(bilingual(
      "MVTT is not installed in this project. Run `mvtt install` first.",
      "MVTT 尚未安装到当前项目。请先运行 `mvtt install`。",
    ));
    process.exit(1);
  }

  if (newManifest && hasLegacyLayout(projectRoot)) {
    console.error(bilingual(
      `Both ${LEGACY_FRAMEWORK_DIR}/ and ${FRAMEWORK_DIR}/ exist. Keep only ${FRAMEWORK_DIR}/ and remove the old directory before changing targets.`,
      `旧目录 ${LEGACY_FRAMEWORK_DIR}/ 与 ${FRAMEWORK_DIR}/ 同时存在。请只保留 ${FRAMEWORK_DIR}/ 并删除旧目录后再修改目标。`,
    ));
    process.exit(1);
  }

  const needsMigration = !newManifest && Boolean(legacyManifest);
  const info = inspectInstalledPlatforms(manifest);

  if (info.allInvalid) {
    console.error(bilingual(
      "The installation manifest records no valid platform ids. Fix .mvtt/.mvtt-manifest.json or run `mvtt install` again.",
      "安装清单中没有有效的平台 id。请修复 .mvtt/.mvtt-manifest.json 或重新运行 `mvtt install`。",
    ));
    process.exit(1);
  }
  if (info.usedDefault) {
    p.log.info(bilingual(
      "Manifest does not record platforms; assuming .claude (legacy install).",
      "manifest 未记录平台，按旧安装假定为 .claude。",
    ));
  }
  if (info.unknown.length > 0) {
    p.log.warn(bilingual(
      `Manifest contains unknown platform id(s): ${info.unknown.join(", ")}. They will be dropped.`,
      `manifest 中存在未知平台 id：${info.unknown.join(", ")}，它们将被移除。`,
    ));
  }

  const currentPlatforms = info.platforms;

  const legacyInstalled = currentPlatforms.filter((id) => !SELECTABLE_IDS.has(id));
  const preselected = currentPlatforms.filter((id) => SELECTABLE_IDS.has(id));

  const response = await p.multiselect({
    message: bilingual(
      "Target platforms (the .agents target covers Codex / DeepSeek / Copilot / Cursor / OpenCode / Gemini / Windsurf)",
      "目标平台（.agents 目标覆盖 Codex / DeepSeek / Copilot / Cursor / OpenCode / Gemini / Windsurf）",
    ),
    options: SELECTABLE_PLATFORMS.map((platform) => ({
      value: platform.id,
      label: `${platform.dir} — ${platform.description}`,
    })),
    initialValues: preselected,
    required: true,
  });

  if (p.isCancel(response)) {
    p.cancel(bilingual("Cancelled.", "已取消。"));
    return;
  }

  const selected = response as PlatformId[];
  if (selected.length === 0) {
    p.log.error(bilingual("Select at least one target.", "请至少选择一个目标。"));
    return;
  }

  const nextPlatforms: PlatformId[] = [...new Set([...selected, ...legacyInstalled])];
  const added = nextPlatforms.filter((id) => !currentPlatforms.includes(id));
  const removed = currentPlatforms.filter((id) => !nextPlatforms.includes(id));

  if (added.length === 0 && removed.length === 0) {
    p.log.info(bilingual("No changes.", "没有变化。"));
    return;
  }

  p.log.info(color.bold(bilingual("Planned changes", "计划变更")));
  if (added.length > 0) {
    p.log.info(bilingual(`add: ${describeTargets(added)}`, `新增：${describeTargets(added)}`));
  }
  if (removed.length > 0) {
    p.log.info(bilingual(`remove: ${describeTargets(removed)}`, `移除：${describeTargets(removed)}`));
  }
  if (legacyInstalled.length > 0) {
    p.log.info(bilingual(
      `legacy target(s) preserved: ${describeTargets(legacyInstalled)}`,
      `保留的 legacy 目标：${describeTargets(legacyInstalled)}`,
    ));
  }

  const customNames = readCustomSkillNames(projectRoot);
  if (customNames.length > 0 && (added.length > 0 || removed.length > 0)) {
    p.log.info(bilingual(
      `custom skills to sync where missing: ${customNames.join(", ")}`,
      `将补齐到缺失目标的自定义技能：${customNames.join(", ")}`,
    ));
  }

  if (removed.includes("agents")) {
    p.log.warn(bilingual(
      "Removing .agents affects every .agents-compatible harness (Codex, DeepSeek, Copilot, Cursor, OpenCode, Gemini, Windsurf).",
      "移除 .agents 将同时影响所有兼容 .agents 的工具（Codex、DeepSeek、Copilot、Cursor、OpenCode、Gemini、Windsurf）。",
    ));
  }
  if (removed.length > 0 && customNames.length > 0) {
    p.log.info(bilingual(
      "Custom skill copies in removed targets are preserved as user data.",
      "被移除目标中的自定义技能副本会作为用户数据保留。",
    ));
  }
  if (needsMigration) {
    p.log.warn(bilingual(
      `Legacy ${LEGACY_FRAMEWORK_DIR}/ layout will be migrated to ${FRAMEWORK_DIR}/.`,
      `旧布局 ${LEGACY_FRAMEWORK_DIR}/ 将被迁移为 ${FRAMEWORK_DIR}/。`,
    ));
  }

  const confirmed = await p.confirm({
    message: bilingual("Apply these changes?", "确认应用这些变更？"),
    initialValue: true,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel(bilingual("Cancelled.", "已取消。"));
    return;
  }

  let migrated = false;
  if (needsMigration) {
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

  let result: ApplyPlatformTargetsResult;
  try {
    result = applyPlatformTargets({
      projectRoot,
      packageRoot,
      version,
      previous: manifest,
      previousPlatforms: currentPlatforms,
      nextPlatforms,
    });
  } catch (err) {
    if (migrated) rollbackLegacyLayout(projectRoot);
    console.error(bilingual(
      `Platform update failed: ${(err as Error).message}`,
      `平台更新失败：${(err as Error).message}`,
    ));
    process.exit(1);
    return;
  }

  p.log.success(bilingual(
    `Targets updated: ${describeTargets(nextPlatforms)}`,
    `目标已更新：${describeTargets(nextPlatforms)}`,
  ));
  if (result.customSkills.synced.length > 0) {
    p.log.info(bilingual(
      `Synced custom skills: ${result.customSkills.synced.join(", ")}`,
      `已同步自定义技能：${result.customSkills.synced.join(", ")}`,
    ));
  }
  if (result.customSkills.skipped.length > 0) {
    p.log.info(bilingual(
      `Skipped custom skills: ${result.customSkills.skipped.join(", ")}`,
      `跳过的自定义技能：${result.customSkills.skipped.join(", ")}`,
    ));
  }
  if (result.removedFiles.length > 0) {
    p.log.info(bilingual(
      `Removed ${result.removedFiles.length} stale generated file(s).`,
      `已删除 ${result.removedFiles.length} 个过时的生成文件。`,
    ));
  }
  if (result.leftoverCustomDirs.length > 0) {
    p.log.info(bilingual(
      `Custom skills kept as user data: ${result.leftoverCustomDirs.join(", ")}`,
      `保留为自定义数据的技能：${result.leftoverCustomDirs.join(", ")}`,
    ));
  }

  p.outro(color.green(bilingual(
    "Done. Review and commit the changed skill folders and .mvtt/.mvtt-manifest.json.",
    "完成。请检查并提交变更后的技能目录与 .mvtt/.mvtt-manifest.json。",
  )));
}

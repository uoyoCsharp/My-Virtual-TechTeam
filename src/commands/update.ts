import { existsSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { materializeProject } from "../fs/materialize.js";
import {
  readInstallationManifest,
  readInstalledPlatforms,
  writeInstallationManifest,
} from "../fs/install-manifest.js";
import { hashFile } from "../fs/hash.js";
import { getPackageRoot, getVersion } from "./shared.js";
import { bilingual } from "../util/bilingual.js";
import { startSpinner } from "../util/spinner.js";

export interface UpdateOptions {
  check?: boolean;
}

export function updateCommand(options: UpdateOptions = {}): void {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();
  const checkOnly = options.check === true;

  const existing = readInstallationManifest(projectRoot);
  if (!existing) {
    console.error(bilingual(
      "MVTT is not installed in this project. Run `mvtt install` first.",
      "MVTT 尚未安装到当前项目。请先运行 `mvtt install`。",
    ));
    process.exit(1);
  }

  if (existing.mvtt_version === version && !checkOnly) {
    console.log(bilingual(
      `Already at v${version}. Nothing to update.`,
      `已是 v${version}。无需更新。`,
    ));
    return;
  }

  if (checkOnly) {
    console.log(bilingual(`Current: v${existing.mvtt_version}`, `当前版本：v${existing.mvtt_version}`));
    console.log(bilingual(`Latest:  v${version}`, `最新版本：v${version}`));
    if (existing.mvtt_version !== version) {
      console.log(bilingual("Run `mvtt update` to upgrade.", "运行 `mvtt update` 进行升级。"));
    } else {
      console.log(bilingual("Up to date.", "已是最新版本。"));
    }
    return;
  }

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

  console.log(bilingual(
    `Updating MVTT from v${existing.mvtt_version} to v${version}...`,
    `正在将 MVTT 从 v${existing.mvtt_version} 更新到 v${version}...`,
  ));

  const platforms = readInstalledPlatforms(existing);
  const spinner = startSpinner(
    bilingual(`Materializing ${platforms.length} platform(s)...`, `正在生成 ${platforms.length} 个平台的文件...`),
  );
  let materialized: ReturnType<typeof materializeProject>;
  try {
    materialized = materializeProject({
      packageRoot,
      projectRoot,
      platforms,
      overwriteCreateOnce: false,
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
    `\n更新完成：已处理 ${materialized.length} 个文件。`,
  ));
}

function removeStaleGeneratedFiles(
  projectRoot: string,
  previousFiles: Record<string, { category: string; hash: string }>,
  current: Array<{ relPath: string; category: string }>,
): string[] {
  const currentSet = new Set(current.map((m) => m.relPath));
  const removed: string[] = [];

  for (const [relPath, record] of Object.entries(previousFiles)) {
    if (record.category !== "generated") continue;
    if (currentSet.has(relPath)) continue;

    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) continue;

    rmSync(absPath, { force: true });
    removed.push(relPath);

    let parent = path.dirname(absPath);
    const stopAt = path.resolve(projectRoot);
    while (parent.startsWith(stopAt) && parent !== stopAt) {
      if (!existsSync(parent)) break;
      const entries = readdirSync(parent);
      if (entries.length > 0) break;
      rmSync(parent, { recursive: true, force: true });
      parent = path.dirname(parent);
    }
  }

  return removed;
}

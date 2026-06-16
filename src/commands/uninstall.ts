import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { manifestPath, readInstallationManifest, readInstalledPlatforms } from "../fs/install-manifest.js";
import { PLATFORMS, getPlatformById } from "../types/platform.js";
import { bilingual } from "../util/bilingual.js";

// User data paths removed when the user opts out of preservation.
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

  console.log(bilingual(
    `The following ${generated.length} generated files will be removed:`,
    `将删除以下 ${generated.length} 个生成文件:`,
  ));
  for (const [rel] of generated) console.log(`  - ${rel}`);
  console.log(
    bilingual(
      "By default, user data will be PRESERVED (workspace/, custom skills, principle/, project/, config.yaml, ...).",
      "默认情况下将保留用户数据（工作区、自定义技能、原则、项目、config.yaml 等）。",
    ),
  );
  console.log(bilingual(
    "You will be asked whether to also remove user data.",
    "接下来会询问是否一并删除用户数据。",
  ));

  const confirmed = await confirmUninstall();
  if (!confirmed) {
    console.log(bilingual("Uninstall cancelled.", "已取消卸载。"));
    return;
  }

  const preserveUserData = await confirmUserDataPreservation();

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

  if (!preserveUserData) {
    removeUserData(projectRoot);
  }

  unlinkSync(manifestPath(projectRoot));

  console.log(
    preserveUserData
      ? `\n${bilingual("Uninstall complete. User data preserved.", "卸载完成。已保留用户数据。")}`
      : `\n${bilingual("Uninstall complete. All MVTT data removed.", "卸载完成。已删除所有 MVTT 数据。")}`,
  );
}

async function confirmUninstall(): Promise<boolean> {
  const response = await prompts(
    {
      type: "select",
      name: "value",
      message: bilingual("Proceed with uninstall?", "确认卸载？"),
      choices: [
        { title: bilingual("No, keep everything", "否，保留所有"), value: false },
        { title: bilingual("Yes, remove generated files", "是，删除生成文件"), value: true },
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

async function confirmUserDataPreservation(): Promise<boolean> {
  const response = await prompts(
    {
      type: "select",
      name: "value",
      message: bilingual("Preserve user data?", "是否保留用户数据？"),
      choices: [
        { title: bilingual("Yes, preserve user data", "是，保留用户数据"), value: true },
        { title: bilingual("No, remove all MVTT data", "否，删除所有 MVTT 数据"), value: false },
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

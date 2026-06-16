import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import prompts from "prompts";
import { materializeProject } from "../fs/materialize.js";
import {
  manifestPath,
  readInstallationManifest,
  writeInstallationManifest,
} from "../fs/install-manifest.js";
import { getPackageRoot, getVersion } from "./shared.js";
import { color } from "../util/color.js";
import { bilingual } from "../util/bilingual.js";
import type { PlatformId } from "../types/platform.js";
import { PLATFORMS, DEFAULT_PLATFORMS } from "../types/platform.js";

type Language = "en-US" | "zh-CN";

export async function installCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();

  const existing = readInstallationManifest(projectRoot);
  if (existing) {
    console.error(bilingual(
      `MVTT is already installed (v${existing.mvtt_version}). Use \`mvtt update\` to update.`,
      `MVTT 已经安装（v${existing.mvtt_version}）。请使用 \`mvtt update\` 进行更新。`,
    ));
    process.exit(1);
  }

  const interactionLanguage = await selectLanguage("interaction");
  const documentLanguage = await selectLanguage("document", interactionLanguage);
  const platforms = await selectPlatforms();

  console.log(bilingual(
    `Installing MVTT v${version} into ${projectRoot}...`,
    `正在将 MVTT v${version} 安装到 ${projectRoot}...`,
  ));

  const materialized = materializeProject({
    packageRoot,
    projectRoot,
    platforms,
    overwriteCreateOnce: false,
  });

  const configPath = path.resolve(projectRoot, ".ai-agents/config.yaml");
  let config = readFileSync(configPath, "utf-8");
  config = config.replace(
    /interaction_language:\s*en-US/,
    `interaction_language: ${interactionLanguage}`,
  );
  config = config.replace(
    /document_output_language:\s*en-US/,
    `document_output_language: ${documentLanguage}`,
  );
  writeFileSync(configPath, config, "utf-8");

  writeInstallationManifest(projectRoot, version, materialized, null, platforms);

  const generatedCount = materialized.filter((f) => f.category === "generated").length;
  const createOnceCount = materialized.filter((f) => f.category === "create_once").length;

  console.log(`\n${color.green(bilingual("Installation complete:", "安装完成："))}`);
  console.log(bilingual(`  ${generatedCount} generated files`, `  ${generatedCount} 个生成文件`));
  console.log(bilingual(`  ${createOnceCount} user-editable files`, `  ${createOnceCount} 个用户可编辑文件`));
  console.log(bilingual(`  Interaction language: ${interactionLanguage}`, `  交互语言：${interactionLanguage}`));
  console.log(bilingual(`  Document output language: ${documentLanguage}`, `  文档输出语言：${documentLanguage}`));
  console.log(bilingual(`  Platforms: ${platforms.join(", ")}`, `  平台：${platforms.join(", ")}`));
  console.log(`  ${bilingual("Manifest:", "清单：")} ${color.gray(path.relative(projectRoot, manifestPath(projectRoot)))}`);
  console.log(`\n${color.bold(bilingual("Next steps:", "下一步："))}`);
  console.log(bilingual(
    `  Run ${color.cyan("/mvt-init")} in your AI IDE to initialize the project`,
    `  在你的 AI IDE 中运行 ${color.cyan("/mvt-init")} 以初始化项目`,
  ));
}

async function selectLanguage(
  kind: "interaction" | "document",
  fallback?: Language,
): Promise<Language> {
  if (!process.stdin.isTTY) return fallback ?? "en-US";

  const baseMessage =
    kind === "interaction"
      ? bilingual("Interaction language (chat replies, prompts)", "交互语言")
      : bilingual(
          "Document output language (artifacts, project-context.md)",
          "文档输出语言（artifacts、project-context.md）",
        );
  const message =
    kind === "document" && fallback
      ? `${baseMessage} [default: ${fallback} / 默认：${fallback}]`
      : baseMessage;

  const initial =
    kind === "document" && fallback === "zh-CN"
      ? 1
      : 0;

  const response = await prompts(
    {
      type: "select",
      name: "language",
      message,
      choices: [
        { title: bilingual("English (en-US)", "English (en-US)"), value: "en-US" },
        { title: bilingual("中文 (zh-CN)", "中文 (zh-CN)"), value: "zh-CN" },
      ],
      initial,
    },
    {
      onCancel: () => {
        throw new Error("Cancelled");
      },
    },
  );

  return response.language as Language;
}

async function selectPlatforms(): Promise<PlatformId[]> {
  if (!process.stdin.isTTY) return DEFAULT_PLATFORMS;

  const response = await prompts(
    {
      type: "multiselect",
      name: "platforms",
      message: bilingual("Target AI platforms", "目标 AI 平台"),
      choices: PLATFORMS.map((p) => ({
        title: bilingual(`${p.dir} — ${p.description}`, `${p.dir} — ${p.description}`),
        value: p.id,
        selected: true,
      })),
      min: 1,
    },
    {
      onCancel: () => {
        throw new Error("Cancelled");
      },
    },
  );

  const selected = response.platforms as PlatformId[];
  return selected.length > 0 ? selected : DEFAULT_PLATFORMS;
}

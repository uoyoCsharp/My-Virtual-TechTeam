import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
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
import { cancelled } from "../util/cancel.js";

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

  p.intro(color.cyan(bilingual(
    `MVTT Installer — v${version}`,
    `MVTT 安装器 — v${version}`,
  )));

  const interactionLanguage = await selectLanguage("interaction");
  const documentLanguage = await selectLanguage("document", interactionLanguage);
  const platforms = await selectPlatforms();

  const configPath = path.resolve(projectRoot, ".ai-agents/config.yaml");
  let materialized!: ReturnType<typeof materializeProject>;

  await p.tasks([
    {
      title: bilingual(
        `Materializing ${platforms.length} platform(s)`,
        `正在生成 ${platforms.length} 个平台的文件`,
      ),
      task: async () => {
        materialized = materializeProject({
          packageRoot,
          projectRoot,
          platforms,
          overwriteCreateOnce: false,
        });
        return bilingual(
          `${materialized.length} files written`,
          `已写入 ${materialized.length} 个文件`,
        );
      },
    },
    {
      title: bilingual(
        `Writing config (interaction: ${interactionLanguage}, document: ${documentLanguage})`,
        `正在写入配置（交互：${interactionLanguage}，文档：${documentLanguage}）`,
      ),
      task: async () => {
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
        return bilingual("Config updated", "配置已更新");
      },
    },
    {
      title: bilingual("Writing installation manifest", "正在写入安装清单"),
      task: async () => {
        writeInstallationManifest(projectRoot, version, materialized, null, platforms);
        return bilingual("Manifest written", "清单已写入");
      },
    },
  ]);

  const generatedCount = materialized.filter((f) => f.category === "generated").length;
  const createOnceCount = materialized.filter((f) => f.category === "create_once").length;

  p.log.info(bilingual(
    `${generatedCount} generated · ${createOnceCount} user-editable · ${platforms.length} platform(s)`,
    `${generatedCount} 个生成文件 · ${createOnceCount} 个用户可编辑文件 · ${platforms.length} 个平台`,
  ));
  p.log.info(bilingual(
    `Manifest: ${path.relative(projectRoot, manifestPath(projectRoot))}`,
    `清单路径：${path.relative(projectRoot, manifestPath(projectRoot))}`,
  ));

  p.outro(color.green(bilingual(
    `Next: run /mvt-init in your AI IDE`,
    `下一步：在你的 AI IDE 中运行 /mvt-init`,
  )));
}

async function selectLanguage(
  kind: "interaction" | "document",
  fallback?: Language,
): Promise<Language> {
  const baseMessage =
    kind === "interaction"
      ? bilingual("Interaction language (chat replies, prompts)", "交互语言")
      : bilingual(
          "Document output language (artifacts, project-context.md)",
          "文档输出语言（artifacts、project-context.md）",
        );
  const message =
    kind === "document" && fallback
      ? `${baseMessage} [${bilingual(`default: ${fallback}`, `默认：${fallback}`)}]`
      : baseMessage;

  const response = await p.select({
    message,
    options: [
      { value: "en-US", label: bilingual("English (en-US)", "English (en-US)") },
      { value: "zh-CN", label: bilingual("中文 (zh-CN)", "中文 (zh-CN)") },
    ] as { value: Language; label: string }[],
    initialValue: kind === "document" && fallback ? fallback : "en-US",
  });

  if (p.isCancel(response)) cancelled();
  return response as Language;
}

async function selectPlatforms(): Promise<PlatformId[]> {
  const response = await p.multiselect({
    message: bilingual("Target AI platforms", "目标 AI 平台"),
    options: PLATFORMS.map((pl) => ({
      value: pl.id,
      label: `${pl.dir} — ${pl.description}`,
    })),
    initialValues: DEFAULT_PLATFORMS,
    required: true,
  });

  if (p.isCancel(response)) cancelled();
  const selected = response as PlatformId[];
  return selected.length > 0 ? selected : DEFAULT_PLATFORMS;
}

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

type Language = "en-US" | "zh-CN";

export async function installCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const packageRoot = getPackageRoot();
  const version = getVersion();

  const existing = readInstallationManifest(projectRoot);
  if (existing) {
    console.error(
      `MVTT is already installed (v${existing.mvtt_version}). Use \`mvtt update\` to update.`,
    );
    process.exit(1);
  }

  const interactionLanguage = await selectLanguage("interaction");
  const documentLanguage = await selectLanguage("document", interactionLanguage);

  console.log(`Installing MVTT v${version} into ${projectRoot}...`);

  const materialized = materializeProject({
    packageRoot,
    projectRoot,
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

  writeInstallationManifest(projectRoot, version, materialized, null);

  const generatedCount = materialized.filter((f) => f.category === "generated").length;
  const createOnceCount = materialized.filter((f) => f.category === "create_once").length;

  console.log(`\n${color.green("Installation complete:")}`);
  console.log(`  ${generatedCount} generated files`);
  console.log(`  ${createOnceCount} user-editable files`);
  console.log(`  Interaction language: ${interactionLanguage}`);
  console.log(`  Document output language: ${documentLanguage}`);
  console.log(`  Manifest: ${color.gray(path.relative(projectRoot, manifestPath(projectRoot)))}`);
  console.log(`\n${color.bold("Next steps:")}`);
  console.log(`  Run ${color.cyan("/mvt-init")} in Claude Code to initialize the project`);
}

async function selectLanguage(
  kind: "interaction" | "document",
  fallback?: Language,
): Promise<Language> {
  if (!process.stdin.isTTY) return fallback ?? "en-US";

  const message =
    kind === "interaction"
      ? "Interaction language (chat replies, prompts) / 交互语言"
      : `Document output language (artifacts, project-context.md) / 文档输出语言${
          fallback ? ` [default: ${fallback}]` : ""
        }`;

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
        { title: "English (en-US)", value: "en-US" },
        { title: "中文 (zh-CN)", value: "zh-CN" },
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

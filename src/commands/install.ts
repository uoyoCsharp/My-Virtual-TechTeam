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

export interface InstallOptions {
  pattern?: string;
}

type Language = "en-US" | "zh-CN";

export async function installCommand(options: InstallOptions = {}): Promise<void> {
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

  const pattern = options.pattern ?? null;
  const language = await selectLanguage();

  console.log(`Installing MVTT v${version} into ${projectRoot}...`);

  const materialized = materializeProject({
    packageRoot,
    projectRoot,
    overwriteCreateOnce: false,
  });

  const configPath = path.resolve(projectRoot, ".ai-agents/config.yaml");
  let config = readFileSync(configPath, "utf-8");
  if (pattern) {
    config = config.replace(/active:\s*""/, `active: "${pattern}"`);
    console.log(`Pattern set: ${pattern}`);
  }
  config = config.replace(/language:\s*en-US/, `language: ${language}`);
  writeFileSync(configPath, config, "utf-8");

  writeInstallationManifest(projectRoot, version, pattern, materialized, null);

  const generatedCount = materialized.filter((f) => f.category === "generated").length;
  const createOnceCount = materialized.filter((f) => f.category === "create_once").length;

  console.log(`\n${color.green("Installation complete:")}`);
  console.log(`  ${generatedCount} generated files`);
  console.log(`  ${createOnceCount} user-editable files`);
  console.log(`  Language: ${language}`);
  console.log(`  Manifest: ${color.gray(path.relative(projectRoot, manifestPath(projectRoot)))}`);
  console.log(`\n${color.bold("Next steps:")}`);
  console.log(`  Run ${color.cyan("/mvt-init")} in Claude Code to initialize the project`);
}

async function selectLanguage(): Promise<Language> {
  if (!process.stdin.isTTY) return "en-US";

  const response = await prompts(
    {
      type: "select",
      name: "language",
      message: "Select language / 选择语言",
      choices: [
        { title: "English (en-US)", value: "en-US" },
        { title: "中文 (zh-CN)", value: "zh-CN" },
      ],
      initial: 0,
    },
    {
      onCancel: () => {
        throw new Error("Cancelled");
      },
    },
  );

  return response.language as Language;
}

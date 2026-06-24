import { Command } from "commander";
import * as p from "@clack/prompts";
import { installCommand } from "./commands/install.js";
import { updateCommand } from "./commands/update.js";
import { doctorCommand } from "./commands/doctor.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { getVersion } from "./commands/shared.js";
import { bilingual } from "./util/bilingual.js";
import { color } from "./util/color.js";

export async function run(argv: string[]): Promise<void> {
  const version = getVersion();

  const isMeta = argv.some(
    (a) => a === "--help" || a === "-h" || a === "--version" || a === "-v" || a === "help",
  );
  if (isMeta && process.stdout.isTTY) {
    p.intro(color.cyan(bilingual(
      `MVTT v${version} — My Virtual Tech Team`,
      `MVTT v${version} — 我的虚拟技术团队`,
    )));
  }

  const program = new Command();

  program
    .name("mvtt")
    .description(bilingual("My Virtual Tech Team CLI", "My Virtual Tech Team 命令行工具"))
    .version(getVersion(), "-v, --version");

  program
    .command("install")
    .description(bilingual("Install MVTT into current project", "将 MVTT 安装到当前项目"))
    .action(async () => {
      await installCommand();
    });

  program
    .command("update")
    .description(bilingual("Update MVTT to latest version", "将 MVTT 更新到最新版本"))
    .option("--check", bilingual("Only report version diff, do not modify", "仅报告版本差异，不实际修改"))
    .action(async (opts) => {
      await updateCommand(opts);
    });

  program
    .command("doctor")
    .description(bilingual("Check installation health", "检查安装健康状况"))
    .action(() => {
      doctorCommand();
    });

  program
    .command("uninstall")
    .description(bilingual("Remove MVTT generated files", "删除 MVTT 生成的文件"))
    .action(async () => {
      await uninstallCommand();
    });

  await program.parseAsync(argv, { from: "user" });
}

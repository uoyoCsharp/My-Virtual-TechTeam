import { Command } from "commander";
import { buildCommand } from "./commands/build.js";
import { installCommand } from "./commands/install.js";
import { updateCommand } from "./commands/update.js";
import { doctorCommand } from "./commands/doctor.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { getVersion } from "./commands/shared.js";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("mvtt")
    .description("My Virtual Tech Team CLI")
    .version(getVersion(), "-v, --version");

  program
    .command("install")
    .description("Install MVTT into current project")
    .option("--pattern <name>", "Set architecture pattern (ddd, clean-architecture, etc.)")
    .action(async (opts) => {
      await installCommand(opts);
    });

  program
    .command("update")
    .description("Update MVTT to latest version")
    .option("--check", "Only report version diff, do not modify")
    .action((opts) => {
      updateCommand(opts);
    });

  program
    .command("doctor")
    .description("Check installation health")
    .action(() => {
      doctorCommand();
    });

  program
    .command("uninstall")
    .description("Remove MVTT generated files")
    .option("-y, --yes", "Skip confirmation prompt")
    .action((opts) => {
      uninstallCommand(opts);
    });

  program
    .command("build")
    .description("Build skills and templates from sources (dev)")
    .option("--out <dir>", "Output directory (default: cwd)")
    .action((opts) => {
      buildCommand(opts);
    });

  await program.parseAsync(argv, { from: "user" });
}

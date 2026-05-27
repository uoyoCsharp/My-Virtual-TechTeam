import { Command } from "commander";
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
    .action(async () => {
      await installCommand();
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
    .action(async () => {
      await uninstallCommand();
    });

  await program.parseAsync(argv, { from: "user" });
}

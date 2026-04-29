import { buildCommand } from "./commands/build.js";
import { installCommand } from "./commands/install.js";
import { updateCommand } from "./commands/update.js";
import { doctorCommand } from "./commands/doctor.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { getVersion } from "./commands/shared.js";

const COMMANDS: Record<string, (args: string[]) => void> = {
  build: buildCommand,
  install: installCommand,
  update: updateCommand,
  doctor: doctorCommand,
  uninstall: uninstallCommand,
};

export function run(args: string[]): void {
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(getVersion());
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  handler(args.slice(1));
}

function printHelp(): void {
  console.log(`
mvtt - My Virtual Tech Team CLI

Usage: mvtt <command> [options]

Commands:
  install              Install MVTT into current project
    --pattern <name>   Set architecture pattern (ddd, clean-architecture, etc.)
  update               Update MVTT to latest version
    --check            Only report version diff, do not modify
  doctor               Check installation health
  uninstall            Remove MVTT generated files
    --yes              Skip confirmation prompt
  build                Build skills and templates from sources (dev)
    --out <dir>        Output directory (default: cwd)

Options:
  --help, -h           Show help
  --version, -v        Show version
`);
}

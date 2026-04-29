import { buildCommand } from "./commands/build.js";

const COMMANDS: Record<string, (args: string[]) => void> = {
  build: buildCommand,
};

export function run(args: string[]): void {
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log("2.0.0");
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
  build       Build skills and templates from sources (dev)
  install     Install MVTT into current project
  update      Update MVTT to latest version
  doctor      Check installation health
  uninstall   Remove MVTT generated files

Options:
  --help, -h      Show help
  --version, -v   Show version
`);
}

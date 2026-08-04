#!/usr/bin/env node

import { findProjectRoot, scanLiveArtifacts } from "./lib/workspace-artifacts.js";

const MODES = ["plans", "change-dirs", "files"];

function parseArgs(argv) {
  const modeIndex = argv.indexOf("--mode");
  return modeIndex >= 0 ? argv[modeIndex + 1] : "";
}

function main() {
  const mode = parseArgs(process.argv);
  if (!MODES.includes(mode)) {
    process.stderr.write("--mode requires one of: plans, change-dirs, files.\n");
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    process.stderr.write("Could not find project root containing .ai-agents.\n");
    process.exit(1);
  }

  try {
    const entries = scanLiveArtifacts(projectRoot, mode);
    process.stdout.write(JSON.stringify({ ok: true, mode, entries }) + "\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

main();
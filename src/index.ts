#!/usr/bin/env node
import { run } from "./cli.js";

const major = parseInt(process.version.slice(1), 10);
if (major < 18) {
  console.error(`mvtt requires Node.js >= 18. Current: ${process.version}`);
  process.exit(1);
}

run(process.argv.slice(2));

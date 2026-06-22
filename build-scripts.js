/**
 * Build step: bundle scripts with esbuild + copy script docs.
 * Bundles source scripts (which use npm dependencies like 'yaml')
 * into zero-dependency single files under dist/scripts/.
 * Also copies .md usage reference files alongside the bundled .cjs scripts.
 *
 * Uses CJS format because the 'yaml' package internally uses
 * require() calls that are incompatible with esbuild's ESM output.
 */
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

await build({
  entryPoints: [
    "sources/scripts/session-update.js",
    "sources/scripts/plan-update.js",
    "sources/scripts/epic-update.js",
  ],
  outdir: "dist/scripts",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
});

// Copy .md usage reference files from sources/scripts/ to dist/scripts/
const scriptsSrc = "sources/scripts";
mkdirSync("dist/scripts", { recursive: true });
for (const entry of readdirSync(scriptsSrc)) {
  if (entry.endsWith(".md")) {
    copyFileSync(path.join(scriptsSrc, entry), path.join("dist/scripts", entry));
  }
}

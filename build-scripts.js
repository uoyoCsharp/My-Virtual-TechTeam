/**
 * Build step: bundle scripts with esbuild.
 * Bundles source scripts (which use npm dependencies like 'yaml')
 * into zero-dependency single files under dist/scripts/.
 *
 * Uses CJS format because the 'yaml' package internally uses
 * require() calls that are incompatible with esbuild's ESM output.
 */
import { build } from "esbuild";

await build({
  entryPoints: [
    "sources/scripts/session-update.js",
    "sources/scripts/plan-update.js",
  ],
  outdir: "dist/scripts",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
});

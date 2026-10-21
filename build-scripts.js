/**
 * Build step: bundle scripts with esbuild + copy script docs.
 * Bundles source scripts (which use npm dependencies like 'yaml')
 * into zero-dependency single files under dist/scripts/.
 * Also copies .md usage reference files alongside the bundled .cjs scripts.
 *
 * Uses CJS format because the 'yaml' package internally uses
 * require() calls that are incompatible with esbuild's ESM output.
 *
 * Platform single source of truth: the compiled src/types/platform.js table is
 * injected as the virtual module `mvtt:platforms`, so bundled scripts never
 * duplicate platform ids or skills directories. tsc must run first
 * (`npm run build` does: tsc then this script).
 */
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const platformModule = path.resolve("dist/types/platform.js");
if (!existsSync(platformModule)) {
  throw new Error(
    "dist/types/platform.js not found. Run `tsc -p tsconfig.build.json` before build-scripts.js (npm run build does this).",
  );
}
const { PLATFORMS, DEFAULT_PLATFORMS } = await import(pathToFileURL(platformModule).href);

/**
 * Virtual module exposing the single-source platform table to bundled scripts.
 * Source scripts import it as `mvtt:platforms`; it exists only during bundling,
 * which is fine because scripts are only ever executed as bundled .cjs files.
 */
const platformTablePlugin = {
  name: "mvtt-platform-table",
  setup(buildContext) {
    buildContext.onResolve({ filter: /^mvtt:platforms$/ }, (args) => ({
      path: args.path,
      namespace: "mvtt-platform-table",
    }));
    buildContext.onLoad({ filter: /.*/, namespace: "mvtt-platform-table" }, () => ({
      contents: [
        `export const PLATFORMS = ${JSON.stringify(PLATFORMS)};`,
        `export const DEFAULT_PLATFORMS = ${JSON.stringify(DEFAULT_PLATFORMS)};`,
      ].join("\n"),
      loader: "js",
    }));
  },
};

await build({
  entryPoints: [
    "sources/scripts/session-update.js",
    "sources/scripts/plan-update.js",
    "sources/scripts/epic-update.js",
    "sources/scripts/artifact-scan.js",
    "sources/scripts/workspace-state-check.js",
    "sources/scripts/requirement-source.js",
    "sources/scripts/skill-scaffold.js",
  ],
  outdir: "dist/scripts",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  plugins: [platformTablePlugin],
});

// Copy .md usage reference files from sources/scripts/ to dist/scripts/
const scriptsSrc = "sources/scripts";
mkdirSync("dist/scripts", { recursive: true });
for (const entry of readdirSync(scriptsSrc)) {
  if (entry.endsWith(".md")) {
    copyFileSync(path.join(scriptsSrc, entry), path.join("dist/scripts", entry));
  }
}

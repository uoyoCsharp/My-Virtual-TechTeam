import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { readInstallationManifest } from "../fs/install-manifest.js";
import { hashFile } from "../fs/hash.js";
import { getVersion } from "./shared.js";
import { color } from "../util/color.js";

export function doctorCommand(): void {
  const projectRoot = process.cwd();
  const version = getVersion();
  const checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }> = [];

  console.log(`mvtt doctor v${version}\n`);

  const manifest = readInstallationManifest(projectRoot);
  if (!manifest) {
    checks.push({ status: "FAIL", message: ".ai-agents/.mvtt-manifest.json not found (MVTT not installed)" });
    report(checks);
    process.exit(1);
    return;
  }

  checks.push({ status: "PASS", message: `.mvtt-manifest.json exists (v${manifest.mvtt_version})` });

  let missing = 0;
  let modified = 0;
  let total = 0;
  for (const [relPath, record] of Object.entries(manifest.files)) {
    total++;
    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) {
      missing++;
      checks.push({ status: "FAIL", message: `Missing file: ${relPath}` });
      continue;
    }
    if (record.category === "generated") {
      const currentHash = hashFile(absPath);
      if (currentHash !== record.hash) {
        modified++;
        checks.push({ status: "WARN", message: `Manually modified: ${relPath}` });
      }
    }
  }

  if (missing === 0 && modified === 0) {
    checks.push({ status: "PASS", message: `All ${total} tracked files present and unmodified` });
  }

  const userDirs = [
    ".ai-agents/workspace",
    ".ai-agents/workspace/artifacts",
    ".ai-agents/skills/_templates/custom",
    ".ai-agents/knowledge/principle",
    ".ai-agents/knowledge/project",
  ];
  let userDirsOk = true;
  for (const dir of userDirs) {
    if (!existsSync(path.resolve(projectRoot, dir))) {
      checks.push({ status: "WARN", message: `User data dir missing: ${dir}` });
      userDirsOk = false;
    }
  }
  if (userDirsOk) {
    checks.push({ status: "PASS", message: "All user data directories present" });
  }

  checkLegacyCoreManifest(projectRoot, checks);
  checkLegacyProjectContextPath(projectRoot, checks);
  checkLegacyConfigLanguage(projectRoot, checks);

  report(checks);

  const errors = checks.filter((c) => c.status === "FAIL").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  if (errors > 0) process.exit(1);
}

function checkLegacyCoreManifest(
  projectRoot: string,
  checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }>,
): void {
  const manifestPath = path.join(
    projectRoot,
    ".ai-agents/knowledge/core/manifest.yaml",
  );
  if (!existsSync(manifestPath)) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
  } catch {
    checks.push({ status: "FAIL", message: "core/manifest.yaml is not valid YAML" });
    return;
  }

  const issues: string[] = [];
  if (parsed.type === "core") issues.push("type: core (should be 'shared')");
  if ("token_estimate" in parsed) issues.push("legacy field token_estimate");
  if ("loading_strategy" in parsed) issues.push("legacy field loading_strategy");

  const filesArr = Array.isArray(parsed.files) ? parsed.files : [];
  const missingOrigin = filesArr.some(
    (f) => typeof f === "object" && f !== null && !("origin" in f),
  );
  if (missingOrigin) issues.push("files[] entries missing origin");

  if (issues.length > 0) {
    checks.push({
      status: "WARN",
      message: `Legacy core/manifest.yaml: ${issues.join("; ")}. Run \`mvtt update --migrate-manifests\`.`,
    });
  }
}

function checkLegacyProjectContextPath(
  projectRoot: string,
  checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }>,
): void {
  const oldPath = path.join(projectRoot, ".ai-agents/workspace/project-context.md");
  if (!existsSync(oldPath)) return;
  checks.push({
    status: "WARN",
    message:
      "workspace/project-context.md exists at legacy path. Run `mvtt update --migrate-paths` to relocate to knowledge/project/_generated/.",
  });
}

function checkLegacyConfigLanguage(
  projectRoot: string,
  checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }>,
): void {
  const configPath = path.join(projectRoot, ".ai-agents/config.yaml");
  if (!existsSync(configPath)) return;

  let parsed: { preferences?: Record<string, unknown> };
  try {
    parsed = parseYaml(readFileSync(configPath, "utf-8")) as {
      preferences?: Record<string, unknown>;
    };
  } catch {
    checks.push({ status: "FAIL", message: "config.yaml is not valid YAML" });
    return;
  }

  const prefs = parsed.preferences ?? {};
  const hasLegacy = typeof prefs.language === "string";
  const hasInteraction = typeof prefs.interaction_language === "string";

  if (hasLegacy && !hasInteraction) {
    checks.push({
      status: "WARN",
      message:
        "config.yaml uses legacy `language` field. Run `mvtt update --migrate-config` to split into interaction_language + document_output_language.",
    });
  }
}

function report(checks: Array<{ status: "PASS" | "WARN" | "FAIL"; message: string }>): void {
  for (const c of checks) {
    const tag =
      c.status === "PASS"
        ? color.green(`[${c.status}]`)
        : c.status === "WARN"
          ? color.yellow(`[${c.status}]`)
          : color.red(`[${c.status}]`);
    console.log(`${tag} ${c.message}`);
  }
  const errors = checks.filter((c) => c.status === "FAIL").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  const summary = `\nSummary: ${warnings} warning${warnings === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}`;
  console.log(errors > 0 ? color.red(summary) : warnings > 0 ? color.yellow(summary) : color.green(summary));
}

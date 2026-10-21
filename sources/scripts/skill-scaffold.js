#!/usr/bin/env node

/**
 * skill-scaffold.js — Deterministic custom-skill materializer
 *
 * Replaces AI-driven custom-skill file I/O with a deterministic Node.js script.
 * `/mvt-create-skill` writes a staged skill directory, then calls this script once
 * to materialize the skill into EVERY installed platform and register it.
 *
 * Why: custom skills are created at runtime and bypass materializeProject(), so the
 * platform-specific `.claude/skills/...` prefix must never be hardcoded in content.
 * This script owns the platform id -> skills-directory mapping, read from
 * `.mvtt/.mvtt-manifest.json#platformSkillDirs` (with a legacy fallback for
 * manifests written before that field existed).
 *
 * NOTE: This source file uses `import from "yaml"`. During the build pipeline,
 * esbuild bundles it into a zero-dependency single file deployed to
 * .mvtt/scripts/skill-scaffold.cjs. It also imports the build-time virtual
 * module `mvtt:platforms` (injected from src/types/platform.ts), so it must not
 * be executed as a source file -- always run the bundled .cjs.
 *
 * Usage: see .mvtt/scripts/skill-scaffold.md (the authoritative reference).
 *
 * Output:
 *   Success (exit 0): single-line JSON object on stdout
 *   Failure (exit 1): plain text error message on stderr
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { DEFAULT_PLATFORMS, PLATFORMS } from "mvtt:platforms";
import { findProjectRoot } from "./lib/workspace-artifacts.js";

const COMMANDS = ["scaffold", "sync"];
const BOOLEAN_FLAGS = new Set(["dry-run", "force"]);
const NAME_RE = /^[a-z][a-z0-9-]*$/;
const MAX_BODY_WORDS = 5000;
const RESOURCE_KINDS = ["assets", "references", "scripts"];

const INSTALL_MANIFEST = ".mvtt/.mvtt-manifest.json";
const REGISTRY = ".mvtt/registry.yaml";
const TEMPLATE_DIR = ".mvtt/skills/_templates";
const BACKUP_DIR = ".mvtt/.backup";

// Platform table injected at build time from src/types/platform.ts (the single
// source of truth) as the `mvtt:platforms` virtual module. Used as the legacy
// fallback when an installation manifest predates `platformSkillDirs`, and for
// portability warnings.
const KNOWN_SKILL_DIRS = Object.fromEntries(
  PLATFORMS.map((platform) => [platform.id, platform.skillDir]),
);

// ── Output helpers ──────────────────────────────────────────────────────────

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relPosix(projectRoot, absPath) {
  return toPosix(path.relative(projectRoot, absPath));
}

// ── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      fail(`Unexpected argument "${token}". Use --flag value pairs only.`);
    }
    const key = token.slice(2);
    if (key === "") fail("Empty flag name.");
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith("--")) {
      fail(`Missing value for --${key}.`);
    }
    flags[key] = value;
    i += 1;
  }

  return { command, flags };
}

// ── Generic helpers ─────────────────────────────────────────────────────────

function normalizeBody(text) {
  const withoutBom = text.replace(/^\uFEFF/, "");
  return `${withoutBom.replace(/\r\n/g, "\n").replace(/\s+$/, "")}\n`;
}

function listFiles(dir) {
  const found = [];
  const walk = (current, base) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, base);
      else if (entry.isFile()) found.push(toPosix(path.relative(base, full)));
    }
  };
  walk(dir, dir);
  return found.sort();
}

function writeFileAtomic(absPath, content) {
  mkdirSync(path.dirname(absPath), { recursive: true });
  const tmpPath = `${absPath}.tmp-${process.pid}`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, absPath);
}

// ── Installation state (platforms -> skills directories) ─────────────────────

function readInstallState(projectRoot) {
  const manifestPath = path.join(projectRoot, INSTALL_MANIFEST);
  if (!existsSync(manifestPath)) {
    fail("Missing .mvtt/.mvtt-manifest.json. Run `mvtt install` first.");
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    fail(`Failed to parse .mvtt/.mvtt-manifest.json: ${error.message}`);
  }

  const platforms = Array.isArray(doc.platforms) && doc.platforms.length > 0
    ? doc.platforms
    : DEFAULT_PLATFORMS;
  const recorded = doc.platformSkillDirs && typeof doc.platformSkillDirs === "object"
    ? doc.platformSkillDirs
    : {};

  const skillDirs = {};
  for (const id of platforms) {
    const recordedDir = typeof recorded[id] === "string" ? recorded[id] : "";
    const fallback = KNOWN_SKILL_DIRS[id] ?? `.${id}/skills`;
    skillDirs[id] = toPosix(recordedDir || fallback).replace(/\/+$/, "");
  }

  return { platforms, skillDirs };
}

function resolveTargets(flags, installState) {
  const available = Object.keys(installState.skillDirs);
  const raw = flags.platforms;
  if (!raw || raw === "all") return available;

  const ids = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (ids.length === 0) fail("--platforms requires at least one platform id.");
  for (const id of ids) {
    if (!available.includes(id)) {
      fail(`Platform "${id}" is not installed. Installed platforms: ${available.join(", ")}.`);
    }
  }
  return [...new Set(ids)];
}

// ── Skill content input ─────────────────────────────────────────────────────

function readSkillSource(flags) {
  if (flags.from && flags.body) {
    fail("Use either --from <staged-skill-dir> or --body <SKILL.md>, not both.");
  }

  if (flags.from) {
    const sourceDir = path.resolve(flags.from);
    const skillFile = path.join(sourceDir, "SKILL.md");
    if (!existsSync(skillFile)) {
      fail(`--from directory must contain SKILL.md: ${flags.from}`);
    }
    return {
      body: normalizeBody(readFileSync(skillFile, "utf-8")),
      files: listFiles(sourceDir),
      source: sourceDir,
    };
  }

  if (flags.body) {
    const bodyPath = path.resolve(flags.body);
    if (!existsSync(bodyPath)) fail(`Body file not found: ${flags.body}`);
    return {
      body: normalizeBody(readFileSync(bodyPath, "utf-8")),
      files: ["SKILL.md"],
      source: null,
    };
  }

  fail("Missing skill content: pass --from <staged-skill-dir> (preferred) or --body <SKILL.md>.");
}

function validateFrontmatter(body, expectedName) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(body);
  if (!match) fail("SKILL.md must start with YAML frontmatter delimited by --- lines.");

  let frontmatter;
  try {
    frontmatter = parseYaml(match[1]);
  } catch (error) {
    fail(`SKILL.md frontmatter is invalid YAML: ${error.message}`);
  }
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    fail("SKILL.md frontmatter must be a YAML mapping.");
  }
  if (frontmatter.name !== expectedName) {
    fail(`SKILL.md frontmatter name "${frontmatter.name}" does not match --name "${expectedName}".`);
  }
  if (typeof frontmatter.description !== "string" || frontmatter.description.trim() === "") {
    fail("SKILL.md frontmatter description is required.");
  }
  return frontmatter;
}

function collectPortabilityWarnings(body, targets) {
  const warnings = [];
  for (const [id, dir] of Object.entries(KNOWN_SKILL_DIRS)) {
    if (!body.includes(dir) || targets.includes(id)) continue;
    warnings.push(
      `SKILL.md references "${dir}" but platform "${id}" is not installed; refer to "the skills directory of the platform you are running in" instead.`,
    );
  }
  return warnings;
}

// ── Registry ────────────────────────────────────────────────────────────────

function readRegistryState(projectRoot) {
  const registryPath = path.join(projectRoot, REGISTRY);
  if (!existsSync(registryPath)) {
    fail("Missing .mvtt/registry.yaml. Run `mvtt install` first.");
  }

  const raw = readFileSync(registryPath, "utf-8");
  let doc;
  try {
    doc = parseYaml(raw);
  } catch (error) {
    fail(`Failed to parse .mvtt/registry.yaml: ${error.message}`);
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    fail(".mvtt/registry.yaml must be a YAML mapping.");
  }
  if (!doc.skills || typeof doc.skills !== "object" || Array.isArray(doc.skills)) {
    fail(".mvtt/registry.yaml is missing a skills mapping.");
  }
  return { path: registryPath, raw, doc };
}

// Preserve the framework file's leading comment block across re-serialization,
// matching src/fs/registry-merge.ts (yaml.stringify drops comments).
function leadingComments(raw) {
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) out.push(line);
    else break;
  }
  return out.length > 0 ? `${out.join("\n")}\n` : "";
}

function writeRegistryAtomic(projectRoot, registry) {
  const backupDir = path.join(projectRoot, BACKUP_DIR);
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `registry-${stamp}.yaml`);
  writeFileSync(backupPath, readFileSync(registry.path));

  const serialized = leadingComments(registry.raw) + stringifyYaml(registry.doc, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  });

  const tmpPath = `${registry.path}.tmp-${process.pid}`;
  writeFileSync(tmpPath, serialized, "utf-8");

  let reparsed;
  try {
    reparsed = parseYaml(readFileSync(tmpPath, "utf-8"));
  } catch (error) {
    rmSync(tmpPath, { force: true });
    fail(`Refusing to write invalid registry YAML: ${error.message}`);
  }
  if (!reparsed || typeof reparsed !== "object" || !reparsed.skills || typeof reparsed.skills !== "object") {
    rmSync(tmpPath, { force: true });
    fail("Refusing to write registry: serialized document lost its skills mapping.");
  }

  renameSync(tmpPath, registry.path);
  return relPosix(projectRoot, backupPath);
}

// ── Optional template ───────────────────────────────────────────────────────

function resolveTemplate(flags) {
  if (!flags.template) {
    if (flags["template-body"]) fail("--template-body requires --template <basename>.");
    return null;
  }

  const basename = flags.template;
  if (path.basename(basename) !== basename) {
    fail("--template must be a basename (for example proj-foo-output.md), not a path.");
  }
  if (!basename.endsWith(".md")) fail("--template must end with .md.");
  if (!flags["template-body"]) fail("--template requires --template-body <path>.");

  const templateBodyPath = path.resolve(flags["template-body"]);
  if (!existsSync(templateBodyPath)) {
    fail(`Template body file not found: ${flags["template-body"]}`);
  }

  return {
    relPath: `${TEMPLATE_DIR}/${basename}`,
    content: normalizeBody(readFileSync(templateBodyPath, "utf-8")),
  };
}

function parseResources(raw) {
  if (!raw) return [];
  const items = raw.split(",").map((value) => value.trim()).filter(Boolean);
  for (const item of items) {
    if (!RESOURCE_KINDS.includes(item)) {
      fail(`Unknown --resource "${item}". Allowed: ${RESOURCE_KINDS.join(", ")}.`);
    }
  }
  return [...new Set(items)];
}

// ── Commands ────────────────────────────────────────────────────────────────

function scaffold(projectRoot, flags) {
  const name = flags.name;
  if (!name) fail("scaffold requires --name <skill-name>.");
  if (!NAME_RE.test(name)) fail(`Invalid --name "${name}": must match ^[a-z][a-z0-9-]*$.`);

  const description = (flags.description || "").trim();
  if (!description) fail('scaffold requires --description "<third-person description>".');

  const staged = readSkillSource(flags);
  validateFrontmatter(staged.body, name);

  const installState = readInstallState(projectRoot);
  const targets = resolveTargets(flags, installState);

  const warnings = collectPortabilityWarnings(staged.body, targets);
  const wordCount = staged.body.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_BODY_WORDS) {
    warnings.push(`SKILL.md body is ${wordCount} words; keep it under ~${MAX_BODY_WORDS}.`);
  }

  const registry = readRegistryState(projectRoot);
  const existing = registry.doc.skills[name];
  if (existing !== undefined && !flags.force) {
    fail(`Skill "${name}" is already registered in .mvtt/registry.yaml. Use sync to update it, or --force to replace it.`);
  }

  const template = resolveTemplate(flags);
  const resources = parseResources(flags.resource);

  const plan = targets.map((id) => {
    const skillDir = installState.skillDirs[id];
    return {
      id,
      skillDir,
      files: staged.files.map((file) => `${skillDir}/${name}/${file}`),
    };
  });

  const entry = { description, custom: true };
  if (template) entry.template = template.relPath;
  if (flags.role) entry.role = flags.role;
  if (flags.category) entry.category = flags.category;

  if (flags["dry-run"]) {
    emit({
      ok: true,
      command: "scaffold",
      dryRun: true,
      name,
      platforms: plan,
      registry: { path: REGISTRY, entry, action: existing === undefined ? "add" : "replace" },
      template: template ? template.relPath : null,
      resources,
      warnings,
      wordCount,
    });
    return;
  }

  const existed = plan.some((p) =>
    existsSync(path.join(projectRoot, p.skillDir, name, "SKILL.md")),
  );
  const rollback = () => {
    if (existed) return;
    for (const p of plan) {
      rmSync(path.join(projectRoot, p.skillDir, name), { recursive: true, force: true });
    }
    if (template) rmSync(path.join(projectRoot, template.relPath), { force: true });
  };

  try {
    for (const p of plan) {
      for (const relFile of staged.files) {
        const content = relFile === "SKILL.md"
          ? staged.body
          : readFileSync(path.join(staged.source, relFile), "utf-8");
        writeFileAtomic(path.join(projectRoot, p.skillDir, name, relFile), content);
      }
      for (const resource of resources) {
        mkdirSync(path.join(projectRoot, p.skillDir, name, resource), { recursive: true });
      }
    }

    if (template) writeFileAtomic(path.join(projectRoot, template.relPath), template.content);

    registry.doc.skills[name] = entry;
    const backup = writeRegistryAtomic(projectRoot, registry);

    const verified = readRegistryState(projectRoot);
    if (verified.doc.skills[name]?.custom !== true) {
      fail(`Registry verification failed: "${name}" is missing or not marked custom: true.`);
    }

    emit({
      ok: true,
      command: "scaffold",
      name,
      platforms: plan,
      registry: { path: REGISTRY, entry, backup },
      template: template ? template.relPath : null,
      resources,
      warnings,
      wordCount,
    });
  } catch (error) {
    rollback();
    fail(`Scaffold failed and was rolled back: ${error.message}`);
  }
}

function sync(projectRoot, flags) {
  const name = flags.name;
  if (!name) fail("sync requires --name <skill-name>.");
  if (!NAME_RE.test(name)) fail(`Invalid --name "${name}": must match ^[a-z][a-z0-9-]*$.`);

  const installState = readInstallState(projectRoot);
  const targets = resolveTargets(flags, installState);

  const registry = readRegistryState(projectRoot);
  if (registry.doc.skills[name] === undefined) {
    fail(`Skill "${name}" is not registered in .mvtt/registry.yaml. Run scaffold first.`);
  }

  const staged = flags.from || flags.body ? readSkillSource(flags) : null;
  let sourceDir = staged ? staged.source : null;
  let body = staged ? staged.body : null;

  if (!sourceDir && !body) {
    for (const id of Object.keys(installState.skillDirs)) {
      const candidate = path.join(projectRoot, installState.skillDirs[id], name);
      if (existsSync(path.join(candidate, "SKILL.md"))) {
        sourceDir = candidate;
        break;
      }
    }
    if (!sourceDir) {
      fail(`Skill "${name}" has no SKILL.md on any installed platform. Pass --from <dir> or --body <SKILL.md>.`);
    }
    body = normalizeBody(readFileSync(path.join(sourceDir, "SKILL.md"), "utf-8"));
  }
  if (!body && sourceDir) {
    body = normalizeBody(readFileSync(path.join(sourceDir, "SKILL.md"), "utf-8"));
  }
  validateFrontmatter(body, name);

  const declared = sourceDir ? listFiles(sourceDir) : ["SKILL.md"];
  const relFiles = declared.includes("SKILL.md") ? declared : ["SKILL.md", ...declared];

  const plan = targets.map((id) => {
    const skillDir = installState.skillDirs[id];
    return {
      id,
      skillDir,
      files: relFiles.map((file) => `${skillDir}/${name}/${file}`),
    };
  });

  const warnings = collectPortabilityWarnings(body, targets);

  if (flags["dry-run"]) {
    emit({
      ok: true,
      command: "sync",
      dryRun: true,
      name,
      source: sourceDir ? relPosix(projectRoot, sourceDir) : "--body",
      platforms: plan,
      warnings,
    });
    return;
  }

  try {
    for (const p of plan) {
      for (const relFile of relFiles) {
        const content = relFile === "SKILL.md"
          ? body
          : readFileSync(path.join(sourceDir, relFile), "utf-8");
        writeFileAtomic(path.join(projectRoot, p.skillDir, name, relFile), content);
      }
    }
  } catch (error) {
    fail(`Sync failed: ${error.message}`);
  }

  emit({
    ok: true,
    command: "sync",
    name,
    source: sourceDir ? relPosix(projectRoot, sourceDir) : "--body",
    platforms: plan,
    warnings,
  });
}

function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!COMMANDS.includes(command)) {
    fail(`Usage: skill-scaffold.cjs <${COMMANDS.join("|")}> [--flag value ...]. Read .mvtt/scripts/skill-scaffold.md first.`);
  }

  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    fail("Could not find project root containing .mvtt. Run from inside an MVTT project.");
  }

  if (command === "scaffold") scaffold(projectRoot, flags);
  else sync(projectRoot, flags);
}

main();

#!/usr/bin/env node

/**
 * session-update.js — Mechanical session state mutation script
 *
 * Replaces AI-driven YAML mutation with a deterministic Node.js script.
 * All skills call this script instead of manually editing session.yaml.
 *
 * NOTE: This source file uses `import from "yaml"`. During the build
 * pipeline, esbuild bundles it into a zero-dependency single file that
 * gets deployed to .ai-agents/scripts/session-update.js.
 *
 * Usage:
 *   node .ai-agents/scripts/session-update.js \
 *     --skill <name> \
 *     --summary <text> \
 *     [--change-id <id>] \
 *     [--new-change <title>] \
 *     [--set-initialized] \
 *     [--update-recent-change] \
 *     [--set-plan-path <path>]
 *
 * Output:
 *   Success (exit 0): {"ok":true}
 *   Failure (exit 1): plain text error message on stderr
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// ── Error Messages ──────────────────────────────────────────────────────────
// All error messages centralized here for visibility and easy maintenance.
// Each key maps to a function that returns the stderr message string.

const ERRORS = {
  MISSING_SKILL:    () => "Missing required argument: --skill",
  MISSING_SUMMARY: () => "Missing required argument: --summary",
  CHANGE_ID_REQUIRED: () => "--new-change requires --change-id",
  NO_PROJECT_ROOT: () => "Could not find project root (.ai-agents/ directory not found). Make sure you are inside an MVTT project.",
  NO_SESSION_YAML: () => "session.yaml not found. Run /mvt-init first to initialize the project.",
  SESSION_PARSE_FAILED: (detail) => `Failed to parse session.yaml: ${detail}. Check the file for syntax errors.`,
  SESSION_WRITE_FAILED: (detail) => `Failed to write session.yaml: ${detail}`,
  CONFIG_LIMIT_INVALID: (key, val, min, max, fallback) =>
    `Warning: config history_limits.${key} value "${val}" is invalid (must be integer ${min}-${max}). Using default ${fallback}.`,
};

// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_LIMITS = {
  skill_history: 10,
  recent_actions: 5,
  recent_changes: 5,
};

const LIMIT_RANGES = {
  skill_history: { min: 1, max: 50 },
  recent_actions: { min: 1, max: 100 },
  recent_changes: { min: 1, max: 100 },
};

// ── Project Root Resolution ─────────────────────────────────────────────────
function findProjectRoot(cwd) {
  let dir = cwd;
  while (true) {
    if (existsSync(path.join(dir, ".ai-agents"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ── CLI Parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ── Config Loading ──────────────────────────────────────────────────────────
function loadHistoryLimits(configPath) {
  const limits = { ...DEFAULT_LIMITS };
  if (!existsSync(configPath)) return limits;

  try {
    const raw = readFileSync(configPath, "utf-8");
    const config = parseYaml(raw);
    const configured = config?.preferences?.history_limits;
    if (!configured || typeof configured !== "object") return limits;

    for (const key of Object.keys(DEFAULT_LIMITS)) {
      const val = configured[key];
      if (val == null) continue;

      const num = Number(val);
      const range = LIMIT_RANGES[key];
      if (!Number.isInteger(num) || num < range.min || num > range.max) {
        console.warn(ERRORS.CONFIG_LIMIT_INVALID(key, val, range.min, range.max, DEFAULT_LIMITS[key]));
        continue;
      }
      limits[key] = num;
    }
  } catch {
    // If config can't be parsed, use defaults silently
  }
  return limits;
}

// ── Validation ──────────────────────────────────────────────────────────────
function validate(args) {
  if (!args.skill) return ERRORS.MISSING_SKILL();
  if (!args.summary) return ERRORS.MISSING_SUMMARY();
  if (args["new-change"] && !args["change-id"]) return ERRORS.CHANGE_ID_REQUIRED();
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  const validationError = validate(args);
  if (validationError) {
    process.stderr.write(validationError + "\n");
    process.exit(1);
  }

  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    process.stderr.write(ERRORS.NO_PROJECT_ROOT() + "\n");
    process.exit(1);
  }

  const sessionPath = path.join(projectRoot, ".ai-agents/workspace/session.yaml");
  if (!existsSync(sessionPath)) {
    process.stderr.write(ERRORS.NO_SESSION_YAML() + "\n");
    process.exit(1);
  }

  const configPath = path.join(projectRoot, ".ai-agents/config.yaml");
  const limits = loadHistoryLimits(configPath);

  // Read session
  let session;
  try {
    session = parseYaml(readFileSync(sessionPath, "utf-8"));
  } catch (e) {
    process.stderr.write(ERRORS.SESSION_PARSE_FAILED(e.message) + "\n");
    process.exit(1);
  }

  const now = new Date().toISOString();

  // ── Mandatory updates ──────────────────────────────────────────────────

  // last_command
  session.session = session.session || {};
  session.session.last_command = `/${args.skill}`;

  // skill_history append + truncate
  session.skill_history = session.skill_history || [];
  // Use --change-id if provided, otherwise fall back to existing active_change.id
  const activeChangeId = args["change-id"] || session.active_change?.id || "";
  session.skill_history.push({
    command: `/${args.skill}`,
    completed_at: now,
    summary: args.summary,
    change_id: activeChangeId,
  });
  if (session.skill_history.length > limits.skill_history) {
    session.skill_history = session.skill_history.slice(-limits.skill_history);
  }

  // recent_actions append + truncate
  session.recent_actions = session.recent_actions || [];
  const timestamp = now.replace("T", " ").slice(0, 16);
  session.recent_actions.push(
    `[${timestamp}] /${args.skill}: ${args.summary}`
  );
  if (session.recent_actions.length > limits.recent_actions) {
    session.recent_actions = session.recent_actions.slice(-limits.recent_actions);
  }

  // ── Conditional updates ────────────────────────────────────────────────

  // --new-change: set active_change id/title/created_at
  if (args["new-change"]) {
    session.active_change = session.active_change || {};
    session.active_change.id = args["change-id"];
    session.active_change.title = args["new-change"];
    session.active_change.created_at = now;
  }

  // --set-initialized
  if (args["set-initialized"]) {
    session.session = session.session || {};
    if (!session.session.initialized_at) {
      session.session.initialized_at = now;
    }
  }

  // --update-recent-change: upsert active_change into recent_changes + truncate
  if (args["update-recent-change"]) {
    session.recent_changes = session.recent_changes || [];
    const ac = session.active_change || {};
    const existingIdx = session.recent_changes.findIndex(
      (e) => e.id === ac.id
    );
    const entry = {
      id: ac.id || "",
      title: ac.title || "",
      plan_path: ac.plan_path || "",
      last_updated: now,
    };
    if (existingIdx >= 0) {
      session.recent_changes[existingIdx] = entry;
    } else {
      session.recent_changes.push(entry);
    }
    // Sort by last_updated ascending, then truncate to limit
    session.recent_changes.sort(
      (a, b) => a.last_updated.localeCompare(b.last_updated)
    );
    if (session.recent_changes.length > limits.recent_changes) {
      session.recent_changes = session.recent_changes.slice(-limits.recent_changes);
    }
  }

  // --set-plan-path: set active_change.plan_path and has_plan
  if (args["set-plan-path"]) {
    session.active_change = session.active_change || {};
    session.active_change.plan_path = args["set-plan-path"];
    session.active_change.has_plan = true;
  }

  // ── Write back atomically ─────────────────────────────────────────────
  const tmpPath = sessionPath + ".tmp";

  try {
    writeFileSync(tmpPath, stringifyYaml(session), "utf-8");
    renameSync(tmpPath, sessionPath);
  } catch (e) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // Best effort cleanup
    }
    process.stderr.write(ERRORS.SESSION_WRITE_FAILED(e.message) + "\n");
    process.exit(1);
  }

  process.stdout.write('{"ok":true}\n');
}

main();

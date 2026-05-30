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
 *     [--update-change] \
 *     [--set-plan-path <path>] \
 *     [--close-change] \
 *     [--set-change-status <status>] \
 *     [--no-change] \
 *     [--set-synced] \
 *     [--truncate-history <n>]
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
  history: 20,
  changes: 20,
};

const LIMIT_RANGES = {
  history: { min: 1, max: 100 },
  changes: { min: 1, max: 100 },
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

  // history append + truncate
  session.history = session.history || [];
  // Use --no-change to force empty change_id, otherwise fall back to active_change.id
  const activeChangeId = args["no-change"] ? "" : (args["change-id"] || session.active_change?.id || "");
  session.history.push({
    skill: `/${args.skill}`,
    completed_at: now,
    summary: args.summary,
    change_id: activeChangeId,
  });
  if (session.history.length > limits.history) {
    session.history = session.history.slice(-limits.history);
  }

  // ── Conditional updates ────────────────────────────────────────────────

  // --new-change: auto-snapshot old active_change, then set new one
  if (args["new-change"]) {
    session.active_change = session.active_change || {};

    // Auto-snapshot: if there's an existing active_change with an id, upsert into changes[]
    if (session.active_change.id) {
      session.changes = session.changes || [];
      const existingIdx = session.changes.findIndex(
        (e) => e.id === session.active_change.id
      );
      const snapshotEntry = {
        id: session.active_change.id,
        title: session.active_change.title || "",
        plan_path: session.active_change.plan_path || "",
        status: "active",
        updated_at: now,
      };
      if (existingIdx >= 0) {
        session.changes[existingIdx] = snapshotEntry;
      } else {
        session.changes.push(snapshotEntry);
      }
      // Sort + truncate changes
      session.changes.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      if (session.changes.length > limits.changes) {
        session.changes = session.changes.slice(-limits.changes);
      }
    }

    // Now set new active_change
    session.active_change.id = args["change-id"];
    session.active_change.title = args["new-change"];
    session.active_change.created_at = now;
    session.active_change.plan_path = "";
  }

  // --set-initialized
  if (args["set-initialized"]) {
    session.session = session.session || {};
    if (!session.session.initialized_at) {
      session.session.initialized_at = now;
    }
  }

  // --set-synced: set session.last_synced_at to current time
  if (args["set-synced"]) {
    session.session = session.session || {};
    session.session.last_synced_at = now;
  }

  // --set-plan-path: set active_change.plan_path
  // NOTE: Must execute BEFORE --update-change so that
  // the upserted changes entry contains the correct plan_path.
  if (args["set-plan-path"]) {
    session.active_change = session.active_change || {};
    session.active_change.plan_path = args["set-plan-path"];
  }

  // --update-change: upsert active_change into changes[] + truncate
  if (args["update-change"]) {
    session.changes = session.changes || [];
    const ac = session.active_change || {};
    const existingIdx = session.changes.findIndex(
      (e) => e.id === ac.id
    );
    const entry = {
      id: ac.id || "",
      title: ac.title || "",
      plan_path: ac.plan_path || "",
      status: "active",
      updated_at: now,
    };
    if (existingIdx >= 0) {
      session.changes[existingIdx] = entry;
    } else {
      session.changes.push(entry);
    }
    // Sort by updated_at ascending, then truncate to limit
    session.changes.sort(
      (a, b) => a.updated_at.localeCompare(b.updated_at)
    );
    if (session.changes.length > limits.changes) {
      session.changes = session.changes.slice(-limits.changes);
    }
  }

  // --close-change: snapshot active_change to changes[] with status:done, clear active_change
  if (args["close-change"]) {
    session.changes = session.changes || [];
    const ac = session.active_change || {};
    if (ac.id) {
      const existingIdx = session.changes.findIndex(
        (e) => e.id === ac.id
      );
      const entry = {
        id: ac.id,
        title: ac.title || "",
        plan_path: ac.plan_path || "",
        status: "done",
        updated_at: now,
      };
      if (existingIdx >= 0) {
        session.changes[existingIdx] = entry;
      } else {
        session.changes.push(entry);
      }
      session.changes.sort(
        (a, b) => a.updated_at.localeCompare(b.updated_at)
      );
      if (session.changes.length > limits.changes) {
        session.changes = session.changes.slice(-limits.changes);
      }
    }
    // Clear active_change
    session.active_change = {
      id: "",
      title: "",
      created_at: "",
      plan_path: "",
    };
  }

  // --set-change-status: set status on changes[] entry matching active_change.id
  if (args["set-change-status"]) {
    session.changes = session.changes || [];
    const ac = session.active_change || {};
    if (ac.id) {
      const existingIdx = session.changes.findIndex(
        (e) => e.id === ac.id
      );
      if (existingIdx >= 0) {
        session.changes[existingIdx].status = args["set-change-status"];
        session.changes[existingIdx].updated_at = now;
      }
    }
  }

  // --truncate-history: keep last N history entries, discard older
  if (args["truncate-history"]) {
    const n = Number(args["truncate-history"]);
    if (Number.isInteger(n) && n > 0) {
      session.history = session.history || [];
      if (session.history.length > n) {
        session.history = session.history.slice(-n);
      }
    }
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

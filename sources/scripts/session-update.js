#!/usr/bin/env node

/**
 * session-update.js — Mechanical session state mutation script
 *
 * Replaces AI-driven YAML mutation with a deterministic Node.js script.
 * All skills call this script instead of manually editing session.yaml.
 *
 * NOTE: This source file uses `import from "yaml"`. During the build
 * pipeline, esbuild bundles it into a zero-dependency single file that
 * gets deployed to .ai-agents/scripts/session-update.cjs.
 *
 * Usage: see the "State Update" section in any skill that references
 *   sections/session-update.md (rendered with per-skill flag parameters).
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
  EPIC_ID_REQUIRED: () => "--new-epic requires --epic-id",
  CLOSE_NEW_EPIC_CONFLICT: () => "--close-epic and --new-epic are mutually exclusive",
  NO_ACTIVE_EPIC: (flag) => `${flag} requires an active epic (active_epic.id is empty)`,
  EPIC_ID_ORPHAN: () => "--epic-id (for sub-change) requires --new-change",
  MISSING_REMOVE_VALUE: () => "--remove-change / --remove-epic requires a non-empty value",
  MISSING_FLAG_VALUE: (flag) => `${flag} requires a non-empty value`,
  ACTIVE_CHANGE_CONFLICT: () => "--new-change cannot replace a different active change; finalize or abandon it first.",
  NO_ACTIVE_CHANGE: (flag) => `${flag} requires an active change (active_change.id is empty)`,
  CHANGE_LIFECYCLE_CONFLICT: () => "Only one of --update-change, --close-change, or --abandon-change may be used.",
  CHANGE_NEW_LIFECYCLE_CONFLICT: () => "--new-change cannot be combined with --close-change or --abandon-change.",
  EPIC_LIFECYCLE_CONFLICT: () => "Only one of --close-epic or --abandon-epic may be used.",
  EPIC_NEW_LIFECYCLE_CONFLICT: () => "--new-epic cannot be combined with --close-epic or --abandon-epic.",
  INVALID_CHANGE_STATUS: (value) => `Invalid change status "${value}". Must be one of: active, done, abandoned.`,
  INVALID_EPIC_STATUS: (value) => `Invalid epic status "${value}". Must be one of: active, done, abandoned.`,
  INVALID_REPAIR: (value) => `Invalid --repair-change-statuses entry "${value}". Use <id>=<active|done|abandoned>.`,
  REPAIR_CHANGE_NOT_FOUND: (id) => `--repair-change-statuses references unknown change id "${id}".`,
  REPAIR_REMOVE_CONFLICT: (id) => `Change id "${id}" cannot be both repaired and removed.`,
  ACTIVE_REMOVE_CONFLICT: (id) => `Active change id "${id}" cannot be removed in the same lifecycle operation.`,
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

const VALID_CHANGE_STATUSES = new Set(["active", "done", "abandoned"]);
const VALID_EPIC_STATUSES = new Set(["active", "done", "abandoned"]);

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

// ── Multi-id Helper ─────────────────────────────────────────────────────────
// Comma-separated list of ids, used by --remove-change / --remove-epic.
// Mirrors the convention in sources/scripts/epic-update.js.
function parseIdList(value) {
  if (value == null) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasValue(value) {
  return value !== undefined && value !== true && String(value).trim() !== "";
}

function parseRepairStatuses(value) {
  if (value == null) return { repairs: [], error: null };
  if (!hasValue(value)) return { repairs: [], error: ERRORS.MISSING_FLAG_VALUE("--repair-change-statuses") };

  const repairs = [];
  const seen = new Set();
  for (const item of String(value).split(",").map((entry) => entry.trim()).filter(Boolean)) {
    const match = /^([^=\s]+)=(active|done|abandoned)$/.exec(item);
    if (!match || seen.has(match[1])) return { repairs: [], error: ERRORS.INVALID_REPAIR(item) };
    seen.add(match[1]);
    repairs.push({ id: match[1], status: match[2] });
  }
  return repairs.length
    ? { repairs, error: null }
    : { repairs: [], error: ERRORS.MISSING_FLAG_VALUE("--repair-change-statuses") };
}

function emptyActiveChange() {
  return { id: "", title: "", created_at: "", plan_path: "", epic_id: "" };
}

function emptyActiveEpic() {
  return { id: "", title: "", created_at: "", epic_path: "" };
}

function upsertChange(session, change, status, now) {
  session.changes = session.changes || [];
  const entry = {
    id: change.id,
    title: change.title || "",
    plan_path: change.plan_path || "",
    status,
    updated_at: now,
    epic_id: change.epic_id || "",
  };
  const index = session.changes.findIndex((item) => item.id === change.id);
  if (index >= 0) session.changes[index] = entry;
  else session.changes.push(entry);
}

function upsertEpic(session, epic, status, now) {
  session.epics = session.epics || [];
  const entry = {
    id: epic.id,
    title: epic.title || "",
    epic_path: epic.epic_path || "",
    status,
    updated_at: now,
  };
  const index = session.epics.findIndex((item) => item.id === epic.id);
  if (index >= 0) session.epics[index] = entry;
  else session.epics.push(entry);
}

function sortAndTruncate(entries, limit) {
  entries.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  if (entries.length > limit) entries.splice(0, entries.length - limit);
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
  if (args.skill === true) return ERRORS.MISSING_FLAG_VALUE("--skill");
  if (!args.summary) return ERRORS.MISSING_SUMMARY();
  if (args.summary === true) return ERRORS.MISSING_FLAG_VALUE("--summary");
  if (args["new-change"] !== undefined && !hasValue(args["new-change"])) return ERRORS.MISSING_FLAG_VALUE("--new-change");
  if (args["new-change"] && !args["change-id"]) return ERRORS.CHANGE_ID_REQUIRED();
  if (args["change-id"] !== undefined && !hasValue(args["change-id"])) return ERRORS.MISSING_FLAG_VALUE("--change-id");

  // Epic combo validation
  if (args["new-epic"] && !args["epic-id"]) return ERRORS.EPIC_ID_REQUIRED();
  if (args["new-epic"] !== undefined && !hasValue(args["new-epic"])) return ERRORS.MISSING_FLAG_VALUE("--new-epic");
  if (args["epic-id"] !== undefined && !hasValue(args["epic-id"])) return ERRORS.MISSING_FLAG_VALUE("--epic-id");
  if (args["close-epic"] && args["new-epic"]) return ERRORS.CLOSE_NEW_EPIC_CONFLICT();
  if (args["epic-id"] && !args["new-change"] && !args["new-epic"]) return ERRORS.EPIC_ID_ORPHAN();

  for (const flag of ["set-plan-path", "set-change-status", "truncate-history", "set-epic-path", "set-epic-status"]) {
    if (args[flag] !== undefined && !hasValue(args[flag])) {
      return ERRORS.MISSING_FLAG_VALUE(`--${flag}`);
    }
  }
  if (args["set-change-status"] && !VALID_CHANGE_STATUSES.has(args["set-change-status"])) {
    return ERRORS.INVALID_CHANGE_STATUS(args["set-change-status"]);
  }
  if (args["set-epic-status"] && !VALID_EPIC_STATUSES.has(args["set-epic-status"])) {
    return ERRORS.INVALID_EPIC_STATUS(args["set-epic-status"]);
  }

  const repair = parseRepairStatuses(args["repair-change-statuses"]);
  if (repair.error) return repair.error;

  const changeLifecycleCount = [args["update-change"], args["close-change"], args["abandon-change"]]
    .filter(Boolean).length;
  if (changeLifecycleCount > 1) return ERRORS.CHANGE_LIFECYCLE_CONFLICT();
  if (args["new-change"] && (args["close-change"] || args["abandon-change"])) {
    return ERRORS.CHANGE_NEW_LIFECYCLE_CONFLICT();
  }

  if (args["close-epic"] && args["abandon-epic"]) return ERRORS.EPIC_LIFECYCLE_CONFLICT();
  if (args["new-epic"] && (args["close-epic"] || args["abandon-epic"])) {
    return ERRORS.EPIC_NEW_LIFECYCLE_CONFLICT();
  }

  // Remove flags require non-empty values
  if (
    args["remove-change"] !== undefined
    && (args["remove-change"] === true || !String(args["remove-change"]).trim())
  ) {
    return ERRORS.MISSING_REMOVE_VALUE();
  }
  if (
    args["remove-epic"] !== undefined
    && (args["remove-epic"] === true || !String(args["remove-epic"]).trim())
  ) {
    return ERRORS.MISSING_REMOVE_VALUE();
  }

  return null;
}

function validateAgainstSession(args, session) {
  const activeChange = session.active_change || {};
  const activeEpic = session.active_epic || {};
  const repair = parseRepairStatuses(args["repair-change-statuses"]);
  const removeChangeIds = new Set(parseIdList(args["remove-change"]));

  if (args["new-change"] && activeChange.id && activeChange.id !== args["change-id"]) {
    return ERRORS.ACTIVE_CHANGE_CONFLICT();
  }
  if (args["update-change"] && !activeChange.id) return ERRORS.NO_ACTIVE_CHANGE("--update-change");
  if (args["close-change"] && !activeChange.id) return ERRORS.NO_ACTIVE_CHANGE("--close-change");
  if (args["abandon-change"] && !activeChange.id) return ERRORS.NO_ACTIVE_CHANGE("--abandon-change");
  if ((args["update-change"] || args["close-change"] || args["abandon-change"]) && removeChangeIds.has(activeChange.id)) {
    return ERRORS.ACTIVE_REMOVE_CONFLICT(activeChange.id);
  }
  if ((args["close-epic"] || args["abandon-epic"]) && !activeEpic.id) {
    return ERRORS.NO_ACTIVE_EPIC(args["close-epic"] ? "--close-epic" : "--abandon-epic");
  }

  const changes = Array.isArray(session.changes) ? session.changes : [];
  for (const repairEntry of repair.repairs) {
    if (removeChangeIds.has(repairEntry.id)) return ERRORS.REPAIR_REMOVE_CONFLICT(repairEntry.id);
    if (!repairEntry.id || !changes.some((entry) => entry.id === repairEntry.id)) {
      return ERRORS.REPAIR_CHANGE_NOT_FOUND(repairEntry.id);
    }
  }

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

  const sessionValidationError = validateAgainstSession(args, session);
  if (sessionValidationError) {
    process.stderr.write(sessionValidationError + "\n");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const historyChangeId = args["no-change"] ? "" : (args["change-id"] || session.active_change?.id || "");

  // ── Conditional updates ────────────────────────────────────────────────

  // --new-change: the session-aware validation above rejects replacement.
  if (args["new-change"]) {
    session.active_change = session.active_change || {};

    // Now set new active_change (preserve fields only when re-invoking on same change)
    const isSameChange = session.active_change.id === args["change-id"];
    session.active_change.id = args["change-id"];
    session.active_change.title = args["new-change"];
    session.active_change.created_at = isSameChange ? (session.active_change.created_at || now) : now;
    session.active_change.plan_path = isSameChange ? (session.active_change.plan_path || "") : "";
    session.active_change.epic_id = args["epic-id"] || session.active_change.epic_id || "";
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

  // --prune-empty-changes: remove legacy invalid index entries only when requested
  if (args["prune-empty-changes"]) {
    session.changes = (session.changes || []).filter((entry) => entry?.id && String(entry.id).trim());
  }

  // --repair-change-statuses: apply validated, explicit historical repairs
  const repair = parseRepairStatuses(args["repair-change-statuses"]);
  for (const repairEntry of repair.repairs) {
    const index = session.changes.findIndex((entry) => entry.id === repairEntry.id);
    session.changes[index].status = repairEntry.status;
    session.changes[index].updated_at = now;
  }

  // --update-change: upsert active_change into changes[] + truncate
  if (args["update-change"]) {
    const ac = session.active_change || {};
    upsertChange(session, ac, "active", now);
  }

  // --close-change: snapshot active_change to changes[] with status:done, clear active_change
  if (args["close-change"]) {
    const ac = session.active_change || {};
    upsertChange(session, ac, "done", now);
    session.active_change = emptyActiveChange();
  }

  // --abandon-change: snapshot active_change to changes[] with status:abandoned, clear active_change
  if (args["abandon-change"]) {
    const ac = session.active_change || {};
    upsertChange(session, ac, "abandoned", now);
    session.active_change = emptyActiveChange();
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

  // ── Epic flags ──────────────────────────────────────────────────────────

  // --new-epic: auto-snapshot old active_epic, then set new one
  if (args["new-epic"]) {
    session.active_epic = session.active_epic || {};

    // Auto-snapshot: if there's an existing active_epic with an id, upsert into epics[]
    if (session.active_epic.id) {
      session.epics = session.epics || [];
      const existingIdx = session.epics.findIndex(
        (e) => e.id === session.active_epic.id
      );
      const snapshotEntry = {
        id: session.active_epic.id,
        title: session.active_epic.title || "",
        epic_path: session.active_epic.epic_path || "",
        status: "active",
        updated_at: now,
      };
      if (existingIdx >= 0) {
        session.epics[existingIdx] = snapshotEntry;
      } else {
        session.epics.push(snapshotEntry);
      }
    }

    // Set new active_epic
    session.active_epic.id = args["epic-id"];
    session.active_epic.title = args["new-epic"];
    session.active_epic.created_at = now;
    session.active_epic.epic_path = "";
  }

  // --set-epic-path: set active_epic.epic_path
  if (args["set-epic-path"]) {
    session.active_epic = session.active_epic || {};
    if (!session.active_epic.id && !args["new-epic"]) {
      process.stderr.write(ERRORS.NO_ACTIVE_EPIC("--set-epic-path") + "\n");
      process.exit(1);
    }
    session.active_epic.epic_path = args["set-epic-path"];
  }

  // --set-epic-status: update matching epics[] entry status
  if (args["set-epic-status"]) {
    session.active_epic = session.active_epic || {};
    if (!session.active_epic.id && !args["new-epic"]) {
      process.stderr.write(ERRORS.NO_ACTIVE_EPIC("--set-epic-status") + "\n");
      process.exit(1);
    }
    session.epics = session.epics || [];
    const epicIdx = session.epics.findIndex(
      (e) => e.id === session.active_epic.id
    );
    if (epicIdx >= 0) {
      session.epics[epicIdx].status = args["set-epic-status"];
      session.epics[epicIdx].updated_at = now;
    }
  }

  // --close-epic: set matching epics[] entry to done, clear active_epic
  if (args["close-epic"]) {
    upsertEpic(session, session.active_epic || {}, "done", now);
    session.active_epic = emptyActiveEpic();
  }

  // --abandon-epic: snapshot active_epic to epics[] with status:abandoned, clear active_epic
  if (args["abandon-epic"]) {
    upsertEpic(session, session.active_epic || {}, "abandoned", now);
    session.active_epic = emptyActiveEpic();
  }

  // --remove-change <ids>: filter session.changes[]
  if (args["remove-change"] !== undefined) {
    session.changes = session.changes || [];
    const rawIds = args["remove-change"];
    let removed = 0;
    for (const id of parseIdList(rawIds)) {
      const before = session.changes.length;
      session.changes = session.changes.filter((e) => e.id !== id);
      if (session.changes.length < before) removed++;
    }
    if (removed === 0) {
      process.stderr.write(
        `Warning: --remove-change requested ids [${rawIds}] not found; no entries removed.\n`,
      );
    }
  }

  // --remove-epic <ids>: filter session.epics[]
  if (args["remove-epic"] !== undefined) {
    session.epics = session.epics || [];
    const rawIds = args["remove-epic"];
    let removed = 0;
    for (const id of parseIdList(rawIds)) {
      const before = session.epics.length;
      session.epics = session.epics.filter((e) => e.id !== id);
      if (session.epics.length < before) removed++;
    }
    if (removed === 0) {
      process.stderr.write(
        `Warning: --remove-epic requested ids [${rawIds}] not found; no entries removed.\n`,
      );
    }
  }

  // Sort and truncate lifecycle indexes after all requested mutations.
  session.changes = session.changes || [];
  session.epics = session.epics || [];
  sortAndTruncate(session.changes, limits.changes);
  sortAndTruncate(session.epics, limits.changes);

  // History is appended only after every command/session validation has passed.
  session.history = session.history || [];
  session.history.push({
    skill: `/${args.skill}`,
    completed_at: now,
    summary: args.summary,
    change_id: historyChangeId,
  });
  const historyLimit = args["truncate-history"] ? Number(args["truncate-history"]) : limits.history;
  if (Number.isInteger(historyLimit) && historyLimit > 0 && session.history.length > historyLimit) {
    session.history = session.history.slice(-historyLimit);
  }

  // ── Write back atomically ─────────────────────────────────────────────
  const tmpPath = sessionPath + ".tmp";

  try {
    writeFileSync(tmpPath, stringifyYaml(session, { lineWidth: 200 }), "utf-8");
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

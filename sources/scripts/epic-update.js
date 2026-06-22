#!/usr/bin/env node

/**
 * epic-update.js — Mechanical epic.yaml mutation script
 *
 * Deterministic mutations on epic.yaml: complete children, advance
 * current_change, switch active pointer, add children, validate DAG.
 * Mirrors plan-update.js structure and output protocol (ADR-9).
 *
 * NOTE: This source file uses `import from "yaml"`. During the build pipeline,
 * esbuild bundles it into a zero-dependency single file deployed to
 * .ai-agents/scripts/epic-update.cjs.
 *
 * Usage: see the "Script Usage Rule" section in any skill that references
 *   sections/script-usage-rule.md, or read the full reference at
 *   .ai-agents/scripts/epic-update.md.
 *
 * Output:
 *   Success (exit 0): one-line JSON on stdout
 *   Failure (exit 1): plain-text error on stderr
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// ── Project Discovery ──────────────────────────────────────────────────────
// Mirrors the helpers in plan-update.js. Used to default the project array for
// newly-added children to the actual workspace project name (not "default")
// when project-context.yaml is present and single-project.
function findProjectRootFromPath(filePath) {
  let dir = resolve(dirname(filePath));
  while (true) {
    if (existsSync(join(dir, ".ai-agents"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadSoleProject(projectRoot) {
  if (!projectRoot) return null;
  const ctxPath = join(projectRoot, ".ai-agents/workspace/project-context.yaml");
  if (!existsSync(ctxPath)) return null;
  try {
    const ctx = parseYaml(readFileSync(ctxPath, "utf-8"));
    const projects = ctx?.projects;
    if (!Array.isArray(projects) || projects.length !== 1) return null;
    const name = projects[0]?.name;
    if (typeof name !== "string" || name === "") return null;
    return [name];
  } catch {
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────
const VALID_CHILD_STATUSES = ["pending", "active", "done", "abandoned"];
const VALID_EPIC_STATUSES = ["in_progress", "done", "abandoned"];
const TERMINAL_STATUSES = ["done", "abandoned"];

const ERRORS = {
  MISSING_EPIC: () => "Missing required argument: --epic (or --validate <path>)",
  NO_OPERATION: () => "No operation specified. Use --complete-child, --set-child-status, --switch-active, --add-child, or --validate.",
  EPIC_NOT_FOUND: (p) => `Epic file not found at ${p}.`,
  EPIC_PARSE_FAILED: (detail) => `Failed to parse epic.yaml: ${detail}`,
  CHILD_NOT_FOUND: (id, valid) =>
    `Child "${id}" not found. Valid children: ${valid.length ? valid.join(", ") : "(none)"}.`,
  VALIDATION_FAILED: (errs) =>
    `Epic validation failed:\n  - ${errs.join("\n  - ")}`,
  EPIC_WRITE_FAILED: (detail) => `Failed to write epic.yaml: ${detail}`,
  INVALID_CHILD_STATUS: (val) =>
    `Invalid --child-status "${val}". Must be one of: ${VALID_CHILD_STATUSES.join(", ")}.`,
  MISSING_CHILD_STATUS: () => "--set-child-status requires --child-status <status>",
  MULTIPLE_ACTIVE: () => "Cannot activate: another child is already active. Use --switch-active for atomic reorder.",
  UNRESOLVED_DEPS: (id, deps) =>
    `Cannot activate "${id}": unresolved depends_on: ${deps.join(", ")}`,
  ADD_CHILD_MISSING: () => "--add-child requires an id argument",
  ADD_CHILD_TITLE_MISSING: (id) => `--add-child "${id}" requires --child-title`,
};

// ── CLI Parsing ─────────────────────────────────────────────────────────────
// Custom parser: handles --add-child as a repeatable grouped flag, and
// --set-child-status which consumes TWO positional values (id + child-status).
function parseArgs(argv) {
  const args = {};
  const addChildren = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--add-child") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        addChildren.push({ id: next });
        i++;
      } else {
        addChildren.push({ id: true });
      }
      continue;
    }

    if (arg === "--child-title" || arg === "--child-scope" || arg === "--child-depends-on") {
      const next = argv[i + 1];
      if (addChildren.length > 0 && next) {
        const current = addChildren[addChildren.length - 1];
        if (arg === "--child-depends-on") {
          current.depends_on = next.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
          // Strip "--child-" prefix: --child-title -> "title", --child-scope -> "scope"
          current[arg.slice(8)] = next;
        }
        i++;
      }
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (key === "set-child-status" && next && !next.startsWith("--")) {
        args[key] = next;
        i++;
        const statusVal = argv[i + 1];
        if (statusVal && !statusVal.startsWith("--")) {
          args["child-status"] = statusVal;
          i++;
        }
        continue;
      }

      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  if (addChildren.length > 0) args["add-child"] = addChildren;
  return args;
}

function validateArgs(args) {
  if (!args.epic && !args.validate) return ERRORS.MISSING_EPIC();

  const hasOp =
    args["complete-child"] ||
    args["set-child-status"] ||
    args["switch-active"] ||
    args["add-child"] ||
    args.validate;
  if (!hasOp) return ERRORS.NO_OPERATION();

  if (args["set-child-status"] && !args["child-status"]) return ERRORS.MISSING_CHILD_STATUS();
  if (args["child-status"] && !VALID_CHILD_STATUSES.includes(args["child-status"]))
    return ERRORS.INVALID_CHILD_STATUS(args["child-status"]);

  return null;
}

// ── DAG ─────────────────────────────────────────────────────────────────────
// Kahn's algorithm: returns a cycle description array, or null if DAG is clean.
function findCycle(children) {
  const idSet = new Set(children.map((c) => c.change_id));
  const inDegree = new Map(children.map((c) => [c.change_id, 0]));
  const adj = new Map(children.map((c) => [c.change_id, []]));

  for (const c of children) {
    for (const dep of c.depends_on || []) {
      if (idSet.has(dep)) {
        adj.get(dep).push(c.change_id);
        inDegree.set(c.change_id, (inDegree.get(c.change_id) || 0) + 1);
      }
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift();
    processed++;
    for (const neighbor of adj.get(node) || []) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (processed < children.length) {
    const inCycle = children
      .filter((c) => inDegree.get(c.change_id) > 0)
      .map((c) => c.change_id);
    return ["cycle", ...inCycle];
  }
  return null;
}

// ── Validation ──────────────────────────────────────────────────────────────
function validateEpic(epic) {
  const errors = [];
  const children = Array.isArray(epic.children) ? epic.children : [];

  // 1. Unique change_ids
  const ids = children.map((c) => c.change_id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`Duplicate change_ids: ${[...new Set(dupes)].join(", ")}`);

  const idSet = new Set(ids);

  // 2. depends_on references exist
  for (const c of children) {
    for (const d of c.depends_on || []) {
      if (!idSet.has(d)) {
        errors.push(`Child "${c.change_id}" depends_on unknown child "${d}"`);
      }
    }
  }

  // 3. DAG (no cycles)
  const cycle = findCycle(children);
  if (cycle) errors.push(`Dependency cycle: ${cycle.join(" -> ")}`);

  // 4. current_change validity
  if (epic.current_change) {
    const target = children.find((c) => c.change_id === epic.current_change);
    if (!target) {
      errors.push(`current_change "${epic.current_change}" does not reference a child`);
    } else if (!["pending", "active"].includes(target.status)) {
      errors.push(
        `current_change "${epic.current_change}" has status "${target.status}" (must be pending or active)`
      );
    }
  }

  // 5. At most one active
  const activeCount = children.filter((c) => c.status === "active").length;
  if (activeCount > 1) {
    errors.push(
      `Multiple active children (${activeCount}): ${children
        .filter((c) => c.status === "active")
        .map((c) => c.change_id)
        .join(", ")}`
    );
  }

  // 6. Epic status consistency
  const allTerminal = children.length > 0 && children.every((c) => TERMINAL_STATUSES.includes(c.status));
  if (allTerminal && epic.status === "in_progress") {
    errors.push("All children are done/abandoned but epic status is still in_progress");
  }

  return errors;
}

// ── Advancement ─────────────────────────────────────────────────────────────
// After completing a child, recompute current_change:
// scan children in array order (deterministic tie-break), select the first
// pending child whose depends_on are all resolved (done + abandoned).
// If none found and all children are terminal → epic.status = done.
function recomputeCurrentChange(epic) {
  const children = epic.children || [];
  const resolvedIds = new Set(
    children.filter((c) => TERMINAL_STATUSES.includes(c.status)).map((c) => c.change_id)
  );

  const next = children.find(
    (c) =>
      c.status === "pending" &&
      (c.depends_on || []).every((d) => resolvedIds.has(d))
  );

  if (next) {
    next.status = "active";
    epic.current_change = next.change_id;
  } else {
    epic.current_change = "";
    const allTerminal = children.length > 0 && children.every((c) => TERMINAL_STATUSES.includes(c.status));
    if (allTerminal) epic.status = "done";
  }

  return next ? next.change_id : "";
}

// ── Operations ──────────────────────────────────────────────────────────────
function completeChild(epic, changeId, now) {
  const child = (epic.children || []).find((c) => c.change_id === changeId);
  if (!child) return { error: ERRORS.CHILD_NOT_FOUND(changeId, (epic.children || []).map((c) => c.change_id)) };

  const oldStatus = child.status;
  child.status = "done";
  child.completed_at = now;

  const nextId = recomputeCurrentChange(epic);
  const doneCount = (epic.children || []).filter((c) => c.status === "done").length;

  return {
    child: { change_id: changeId, old_status: oldStatus, new_status: "done" },
    current_change: nextId,
    epic_status: epic.status,
    progress: { done: doneCount, total: (epic.children || []).length },
  };
}

function setChildStatus(epic, changeId, status, now) {
  const child = (epic.children || []).find((c) => c.change_id === changeId);
  if (!child) return { error: ERRORS.CHILD_NOT_FOUND(changeId, (epic.children || []).map((c) => c.change_id)) };

  // At-most-one-active guard (use --switch-active for safe reorder)
  if (status === "active") {
    const existing = (epic.children || []).find(
      (c) => c.status === "active" && c.change_id !== changeId
    );
    if (existing) return { error: ERRORS.MULTIPLE_ACTIVE() };
  }

  const oldStatus = child.status;
  child.status = status;
  if (status === "done") child.completed_at = now;
  else if (oldStatus === "done" && status !== "done") child.completed_at = null;

  if (status === "active") epic.current_change = changeId;

  const doneCount = (epic.children || []).filter((c) => c.status === "done").length;
  return {
    child: { change_id: changeId, old_status: oldStatus, new_status: status },
    current_change: epic.current_change || "",
    epic_status: epic.status,
    progress: { done: doneCount, total: (epic.children || []).length },
  };
}

function switchActive(epic, changeId) {
  const children = epic.children || [];
  const target = children.find((c) => c.change_id === changeId);
  if (!target) return { error: ERRORS.CHILD_NOT_FOUND(changeId, children.map((c) => c.change_id)) };

  // Validate target's depends_on are resolved
  const resolvedIds = new Set(
    children.filter((c) => TERMINAL_STATUSES.includes(c.status)).map((c) => c.change_id)
  );
  const unresolved = (target.depends_on || []).filter((d) => !resolvedIds.has(d));
  if (unresolved.length) return { error: ERRORS.UNRESOLVED_DEPS(changeId, unresolved) };

  // Atomic: demote current active → pending, promote target → active
  for (const c of children) {
    if (c.status === "active" && c.change_id !== changeId) {
      c.status = "pending";
    }
  }
  target.status = "active";
  epic.current_change = changeId;

  const doneCount = children.filter((c) => c.status === "done").length;
  return {
    child: { change_id: changeId, old_status: "pending", new_status: "active" },
    current_change: changeId,
    epic_status: epic.status,
    progress: { done: doneCount, total: children.length },
  };
}

function addChild(epic, childrenToAdd, epicPath) {
  if (!Array.isArray(childrenToAdd) || childrenToAdd.length === 0) {
    return { error: ERRORS.ADD_CHILD_MISSING() };
  }

  epic.children = epic.children || [];

  // Default project attribution: read the sole project from
  // project-context.yaml when available, fall back to ["default"] for
  // legacy / unconfigured workspaces.
  const defaultProject = loadSoleProject(findProjectRootFromPath(epicPath)) || ["default"];

  for (const child of childrenToAdd) {
    if (!child.id || child.id === true) return { error: ERRORS.ADD_CHILD_MISSING() };
    if (!child.title) return { error: ERRORS.ADD_CHILD_TITLE_MISSING(child.id) };

    if (epic.children.some((c) => c.change_id === child.id)) {
      return { error: `Duplicate change_id "${child.id}" in children` };
    }

    epic.children.push({
      change_id: child.id,
      title: child.title,
      status: "pending",
      depends_on: child.depends_on || [],
      project: defaultProject,
      scope: child.scope || "",
      completed_at: null,
    });
  }

  const doneCount = epic.children.filter((c) => c.status === "done").length;
  return {
    child: { change_id: childrenToAdd[childrenToAdd.length - 1].id, new_status: "pending" },
    current_change: epic.current_change || "",
    epic_status: epic.status,
    progress: { done: doneCount, total: epic.children.length },
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  const argErr = validateArgs(args);
  if (argErr) {
    process.stderr.write(argErr + "\n");
    process.exit(1);
  }

  const epicPath = args.epic || args.validate;
  if (!existsSync(epicPath)) {
    process.stderr.write(ERRORS.EPIC_NOT_FOUND(epicPath) + "\n");
    process.exit(1);
  }

  let epic;
  try {
    epic = parseYaml(readFileSync(epicPath, "utf-8"));
  } catch (e) {
    process.stderr.write(ERRORS.EPIC_PARSE_FAILED(e.message) + "\n");
    process.exit(1);
  }

  if (!epic || typeof epic !== "object") {
    process.stderr.write(ERRORS.EPIC_PARSE_FAILED("not a valid YAML object") + "\n");
    process.exit(1);
  }

  // --validate: read-only check, no writes
  if (args.validate) {
    const errors = validateEpic(epic);
    if (errors.length) {
      process.stderr.write(ERRORS.VALIDATION_FAILED(errors) + "\n");
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({ ok: true, valid: true }) + "\n");
    process.exit(0);
  }

  const now = new Date().toISOString();
  let result;

  if (args["complete-child"]) {
    result = completeChild(epic, args["complete-child"], now);
  } else if (args["set-child-status"]) {
    result = setChildStatus(epic, args["set-child-status"], args["child-status"], now);
  } else if (args["switch-active"]) {
    result = switchActive(epic, args["switch-active"]);
  } else if (args["add-child"]) {
    result = addChild(epic, args["add-child"], args.epic);
  }

  if (result.error) {
    process.stderr.write(result.error + "\n");
    process.exit(1);
  }

  // Post-mutation validation
  const errors = validateEpic(epic);
  if (errors.length) {
    process.stderr.write(ERRORS.VALIDATION_FAILED(errors) + "\n");
    process.exit(1);
  }

  epic.updated_at = now;

  // Atomic write
  const tmpPath = epicPath + ".tmp";
  try {
    writeFileSync(tmpPath, stringifyYaml(epic, { lineWidth: 200 }), "utf-8");
    renameSync(tmpPath, epicPath);
  } catch (e) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // best effort cleanup
    }
    process.stderr.write(ERRORS.EPIC_WRITE_FAILED(e.message) + "\n");
    process.exit(1);
  }

  // Best-effort session sync when epic closes (does not affect epic.yaml write).
  let sessionSync = null;
  if (epic.status === "done") {
    sessionSync = syncSessionOnEpicClose(epic, epicPath, now);
  }

  process.stdout.write(
    JSON.stringify({ ok: true, ...result, session_sync: sessionSync }) + "\n"
  );
}

// ── Session Sync ────────────────────────────────────────────────────────────
// Best-effort: clears session.active_epic and updates epics[] snapshot when
// the active epic transitions to "done". Failures are reported in the result
// but never roll back the epic.yaml write.
function syncSessionOnEpicClose(epic, epicPath, now) {
  const projectRoot = findProjectRootFromPath(epicPath);
  if (!projectRoot) {
    return { ok: false, reason: "no-project-root" };
  }

  const sessionPath = join(projectRoot, ".ai-agents", "workspace", "session.yaml");
  if (!existsSync(sessionPath)) {
    return { ok: false, reason: "session-missing" };
  }

  let session;
  try {
    session = parseYaml(readFileSync(sessionPath, "utf-8"));
  } catch (e) {
    return { ok: false, reason: "parse-failed", detail: e.message };
  }

  if (!session || typeof session !== "object") {
    return { ok: false, reason: "session-not-object" };
  }

  const epicId = epic.epic_id;
  if (session.active_epic?.id !== epicId) {
    return { ok: true, applied: false, reason: "active_epic-not-matching" };
  }

  session.epics = session.epics || [];
  const epicIdx = session.epics.findIndex((e) => e.id === epicId);
  if (epicIdx >= 0) {
    session.epics[epicIdx].status = "done";
    session.epics[epicIdx].updated_at = now;
  }

  session.active_epic = {
    id: "",
    title: "",
    created_at: "",
    epic_path: "",
  };

  const sessionTmp = sessionPath + ".tmp";
  try {
    writeFileSync(sessionTmp, stringifyYaml(session, { lineWidth: 200 }), "utf-8");
    renameSync(sessionTmp, sessionPath);
  } catch (e) {
    try {
      if (existsSync(sessionTmp)) unlinkSync(sessionTmp);
    } catch {
      // best-effort cleanup — temp file overwritten next run
    }
    return { ok: false, reason: "write-failed", detail: e.message };
  }

  return { ok: true, applied: true, epic_id: epicId };
}

main();

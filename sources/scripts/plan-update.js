#!/usr/bin/env node

/**
 * plan-update.js — Mechanical plan.yaml mutation script
 *
 * Replaces AI-driven plan.yaml mutation with a deterministic Node.js script.
 * /mvt-update-plan calls this instead of hand-editing the plan: it applies a
 * single task status change, recomputes current_task via the DAG rules, runs
 * the full plan validator, and writes back atomically.
 *
 * The LLM stays responsible for the semantic parts (resolving a default task,
 * mapping natural-language "done"/"blocked: <reason>" to arguments, rendering
 * the JSON result into the user-facing summary). This script does only the
 * mechanical, rule-driven work.
 *
 * NOTE: This source file uses `import from "yaml"`. During the build pipeline,
 * esbuild bundles it into a zero-dependency single file deployed to
 * .ai-agents/scripts/plan-update.cjs.
 *
 * Usage:
 *   node .ai-agents/scripts/plan-update.cjs \
 *     --plan <path-to-plan.yaml> \
 *     --task <task_id> \
 *     --status <pending|in_progress|done|blocked|skipped> \
 *     [--artifacts "<comma,separated,paths>"] \
 *     [--notes "<free-form text>"]
 *
 * Output:
 *   Success (exit 0): one-line JSON on stdout, e.g.
 *     {"ok":true,"task":{...},"current_task":"t2","plan_status":"in_progress",...}
 *   Failure (exit 1): plain-text error message(s) on stderr
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// ── Constants ─────────────────────────────────────────────────────────────
const VALID_STATUSES = ["pending", "in_progress", "done", "blocked", "skipped"];
const TERMINAL_STATUSES = ["done", "blocked", "skipped"];

const ERRORS = {
  MISSING_PLAN: () => "Missing required argument: --plan",
  MISSING_TASK: () => "Missing required argument: --task",
  MISSING_STATUS: () => "Missing required argument: --status",
  INVALID_STATUS: (val) =>
    `Invalid --status "${val}". Must be one of: ${VALID_STATUSES.join(", ")}.`,
  PLAN_NOT_FOUND: (p) => `Plan not found at ${p}. Run /mvt-plan-dev to create one.`,
  PLAN_PARSE_FAILED: (detail) =>
    `Failed to parse plan.yaml: ${detail}. Fix the file manually; not repairing silently.`,
  TASK_NOT_FOUND: (id, valid) =>
    `Task "${id}" not found. Valid task ids: ${valid.length ? valid.join(", ") : "(none)"}.`,
  VALIDATION_FAILED: (errs) =>
    `Plan validation failed; file not written:\n  - ${errs.join("\n  - ")}`,
  PLAN_WRITE_FAILED: (detail) => `Failed to write plan.yaml: ${detail}`,
};

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

function validateArgs(args) {
  if (!args.plan || args.plan === true) return ERRORS.MISSING_PLAN();
  if (!args.task || args.task === true) return ERRORS.MISSING_TASK();
  if (!args.status || args.status === true) return ERRORS.MISSING_STATUS();
  if (!VALID_STATUSES.includes(args.status)) return ERRORS.INVALID_STATUS(args.status);
  return null;
}

// ── Mutation ─────────────────────────────────────────────────────────────────
function applyUpdate(plan, args, now) {
  const task = plan.tasks.find((t) => t.id === args.task);

  const oldStatus = task.status;
  task.status = args.status;

  if (args.artifacts && args.artifacts !== true) {
    const incoming = args.artifacts
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (incoming.length) {
      // artifacts may be null or missing a `files` key on initial plans.
      if (!task.artifacts || typeof task.artifacts !== "object") {
        task.artifacts = { files: [] };
      }
      if (!Array.isArray(task.artifacts.files)) {
        task.artifacts.files = [];
      }
      const seen = new Set(task.artifacts.files);
      for (const f of incoming) {
        if (!seen.has(f)) {
          task.artifacts.files.push(f);
          seen.add(f);
        }
      }
    }
  }

  if (args.notes && args.notes !== true) {
    task.notes = args.notes;
  }

  // completed_at consistency: set only when transitioning to done, else null.
  task.completed_at = args.status === "done" ? now : null;

  plan.updated_at = now;

  return { id: task.id, title: task.title || "", old_status: oldStatus, new_status: args.status };
}

// ── current_task recomputation (mirrors mvt-update-plan Step 4) ────────────────
function recomputeCurrentTask(plan, changedTaskId) {
  let warning = null;

  const changedTask = plan.tasks.find((t) => t.id === changedTaskId);
  const changedToTerminal =
    changedTask && TERMINAL_STATUSES.includes(changedTask.status);

  // 1. An in_progress task that is NOT the one we just moved to terminal wins.
  const activeInProgress = plan.tasks.find(
    (t) => t.status === "in_progress" && !(t.id === changedTaskId && changedToTerminal)
  );
  if (activeInProgress) {
    plan.current_task = activeInProgress.id;
    plan.status = "in_progress";
    return { warning };
  }

  // 2. First pending task whose deps are all done.
  const doneIds = new Set(
    plan.tasks.filter((t) => t.status === "done").map((t) => t.id)
  );
  const nextPending = plan.tasks.find(
    (t) =>
      t.status === "pending" &&
      (t.depends_on || []).every((d) => doneIds.has(d))
  );
  if (nextPending) {
    nextPending.status = "in_progress";
    plan.current_task = nextPending.id;
    plan.status = "in_progress";
    return { warning };
  }

  // 3. Everything done -> plan complete.
  if (plan.tasks.every((t) => t.status === "done")) {
    plan.status = "done";
    plan.current_task = null;
    return { warning };
  }

  // 4. Pending tasks remain but none are executable (blocked by deps).
  plan.current_task = null;
  plan.status = "in_progress";
  warning =
    "All remaining tasks are blocked by dependencies; resolve a blocker before continuing.";
  return { warning };
}

// ── Validation (mirrors mvt-plan-dev Step 5 + mvt-update-plan Step 5) ──────────
function validatePlan(plan) {
  const errors = [];
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];

  // Unique ids
  const ids = tasks.map((t) => t.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    errors.push(`Duplicate task ids: ${[...new Set(dupes)].join(", ")}`);
  }

  const idSet = new Set(ids);

  // Valid depends_on references
  for (const t of tasks) {
    for (const d of t.depends_on || []) {
      if (!idSet.has(d)) {
        errors.push(`Task "${t.id}" depends_on unknown task "${d}"`);
      }
    }
  }

  // DAG (no cycles) — only meaningful if all references resolve.
  const cycle = findCycle(tasks);
  if (cycle) {
    errors.push(`Dependency cycle detected: ${cycle.join(" -> ")}`);
  }

  // At most one in_progress
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  if (inProgress.length > 1) {
    errors.push(
      `More than one task is in_progress: ${inProgress.map((t) => t.id).join(", ")}`
    );
  }

  // Acceptance required
  for (const t of tasks) {
    if (!Array.isArray(t.acceptance) || t.acceptance.length === 0) {
      errors.push(`Task "${t.id}" has no acceptance criteria`);
    }
  }

  // completed_at consistency
  for (const t of tasks) {
    if (t.status !== "done" && t.completed_at != null) {
      errors.push(`Task "${t.id}" is not done but has completed_at set`);
    }
  }

  // current_task validity
  if (plan.status === "done") {
    if (plan.current_task != null) {
      errors.push("plan.status is done but current_task is not null");
    }
  } else if (plan.current_task != null) {
    const ct = tasks.find((t) => t.id === plan.current_task);
    if (!ct) {
      errors.push(`current_task "${plan.current_task}" does not reference a task`);
    } else if (ct.status !== "pending" && ct.status !== "in_progress") {
      errors.push(
        `current_task "${plan.current_task}" has status "${ct.status}" (must be pending or in_progress)`
      );
    }
  }

  return errors;
}

// Returns an array describing a cycle path, or null if the graph is a DAG.
function findCycle(tasks) {
  const adj = new Map();
  for (const t of tasks) adj.set(t.id, t.depends_on || []);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(tasks.map((t) => [t.id, WHITE]));
  const stack = [];

  function dfs(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of adj.get(node) || []) {
      if (!color.has(dep)) continue; // unresolved ref handled elsewhere
      if (color.get(dep) === GRAY) {
        const start = stack.indexOf(dep);
        return [...stack.slice(start), dep];
      }
      if (color.get(dep) === WHITE) {
        const found = dfs(dep);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const t of tasks) {
    if (color.get(t.id) === WHITE) {
      const found = dfs(t.id);
      if (found) return found;
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  const argErr = validateArgs(args);
  if (argErr) {
    process.stderr.write(argErr + "\n");
    process.exit(1);
  }

  if (!existsSync(args.plan)) {
    process.stderr.write(ERRORS.PLAN_NOT_FOUND(args.plan) + "\n");
    process.exit(1);
  }

  let plan;
  try {
    plan = parseYaml(readFileSync(args.plan, "utf-8"));
  } catch (e) {
    process.stderr.write(ERRORS.PLAN_PARSE_FAILED(e.message) + "\n");
    process.exit(1);
  }

  if (!plan || !Array.isArray(plan.tasks)) {
    process.stderr.write(ERRORS.PLAN_PARSE_FAILED("missing tasks[]") + "\n");
    process.exit(1);
  }

  if (!plan.tasks.some((t) => t.id === args.task)) {
    process.stderr.write(
      ERRORS.TASK_NOT_FOUND(args.task, plan.tasks.map((t) => t.id)) + "\n"
    );
    process.exit(1);
  }

  const now = new Date().toISOString();

  const taskChange = applyUpdate(plan, args, now);
  const { warning } = recomputeCurrentTask(plan, args.task);

  const validationErrors = validatePlan(plan);
  if (validationErrors.length) {
    process.stderr.write(ERRORS.VALIDATION_FAILED(validationErrors) + "\n");
    process.exit(1);
  }

  const tmpPath = args.plan + ".tmp";
  try {
    writeFileSync(tmpPath, stringifyYaml(plan), "utf-8");
    renameSync(tmpPath, args.plan);
  } catch (e) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // best effort
    }
    process.stderr.write(ERRORS.PLAN_WRITE_FAILED(e.message) + "\n");
    process.exit(1);
  }

  const doneCount = plan.tasks.filter((t) => t.status === "done").length;
  const result = {
    ok: true,
    task: taskChange,
    current_task: plan.current_task ?? null,
    plan_status: plan.status,
    progress: { done: doneCount, total: plan.tasks.length },
    warning,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
}

main();

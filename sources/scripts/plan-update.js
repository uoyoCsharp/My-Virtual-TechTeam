#!/usr/bin/env node

/**
 * plan-update.js — Mechanical plan.yaml mutation script
 *
 * Replaces AI-driven plan.yaml mutation with a deterministic Node.js script.
 * /mvt-update-plan calls this instead of hand-editing the plan: it applies a
 * single task status change, recomputes current_tasks via the per-project DAG
 * rules, runs the full plan validator, and writes back atomically.
 *
 * task.project is an array, validated via caller-supplied --projects.
 * current_task (string) -> current_tasks (Record<string, string>).
 *        Per-project independent in_progress advancement.
 *        resolvedIds = done + skipped (blocked does NOT satisfy depends_on).
 *        Cross-project advancement emits project_switch notification.
 *        findCycle partitions by project subgraph.
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
 *     [--projects "web,api"] \
 *     [--artifacts "<comma,separated,paths>"] \
 *     [--notes "<free-form text>"] \
 *     [--deliverables-pointer current] \
 *     [--mark-deliverable-stale <task_id>[,task_id2,...]]
 *
 * Output:
 *   Success (exit 0): one-line JSON on stdout, e.g.
 *     {"ok":true,"task":{...},"current_tasks":{"web":"t2"},"plan_status":"in_progress",...}
 *   Failure (exit 1): plain-text error message(s) on stderr
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// ── Project Discovery ──────────────────────────────────────────────────────
// Resolve project root by walking up from a file path until `.ai-agents/` is
// found. Returns null if no project root can be determined.
function findProjectRootFromPath(filePath) {
  let dir = resolve(dirname(filePath));
  while (true) {
    if (existsSync(join(dir, ".ai-agents"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Read the sole project name from `.ai-agents/workspace/project-context.yaml`.
// Returns the project array (length 1) when the file exists AND has exactly
// one project with a non-empty name; returns null otherwise (so the caller
// can fall back to its hardcoded default).
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
const VALID_STATUSES = ["pending", "in_progress", "done", "blocked", "skipped"];
const TERMINAL_STATUSES = ["done", "blocked", "skipped"];
const PROJECT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const VALID_FRESHNESS = ["current", "stale"];

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
  INVALID_PROJECT_NAME: (name) =>
    `Invalid project name "${name}". Must match ${PROJECT_NAME_RE.source} (no leading underscore).`,
  INVALID_TASK_PROJECT: (taskId, proj, valid) =>
    `Task "${taskId}" has project "${proj}" not in --projects list: ${valid.join(", ")}.`,
  INVALID_FRESHNESS: (taskId, val) =>
    `Task "${taskId}" has invalid deliverables.freshness "${val}". Must be one of: ${VALID_FRESHNESS.join(", ")}.`,
  STALE_TASK_NOT_FOUND: (id, valid) =>
    `--mark-deliverable-stale task "${id}" not found. Valid task ids: ${valid.length ? valid.join(", ") : "(none)"}.`,
  INVALID_DELIVERABLES_POINTER: (val) =>
    `Invalid --deliverables-pointer "${val}". Only "current" is supported.`,
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

  // completed_at consistency: set only on first transition to done, else null.
  if (args.status === "done" && !task.completed_at) {
    task.completed_at = now;
  } else if (args.status !== "done") {
    task.completed_at = null;
  }

  // --deliverables-pointer current
  if (args["deliverables-pointer"] && args["deliverables-pointer"] !== true) {
    if (args["deliverables-pointer"] !== "current") {
      return { error: ERRORS.INVALID_DELIVERABLES_POINTER(args["deliverables-pointer"]) };
    }
    task.deliverables = { freshness: "current" };
  }

  // --mark-deliverable-stale <task_id>[,task_id2,...]
  // Supports comma-separated list of downstream task ids.
  if (args["mark-deliverable-stale"] && args["mark-deliverable-stale"] !== true) {
    const staleIds = args["mark-deliverable-stale"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const staleTaskId of staleIds) {
      const staleTask = plan.tasks.find((t) => t.id === staleTaskId);
      if (staleTask) {
        if (!staleTask.deliverables || typeof staleTask.deliverables !== "object") {
          staleTask.deliverables = { freshness: "stale" };
        } else {
          staleTask.deliverables.freshness = "stale";
        }
      }
      // If task not found, silently skip -- the task may not have deliverables yet
    }
  }

  plan.updated_at = now;

  return { id: task.id, title: task.title || "", old_status: oldStatus, new_status: args.status };
}

// -- current_tasks recomputation (per-project independent advancement) --
function recomputeCurrentTasks(plan, changedTaskId, projectList) {
  let warning = null;

  const changedTask = plan.tasks.find((t) => t.id === changedTaskId);
  const changedToTerminal =
    changedTask && TERMINAL_STATUSES.includes(changedTask.status);

  // Capture the set of projects that had active tasks BEFORE this recomputation.
  // plan.current_tasks still holds the old value at this point.
  const priorActiveProjects = new Set(
    Object.keys(plan.current_tasks || {})
  );

  // resolvedIds = done + skipped (blocked does NOT satisfy depends_on)
  const resolvedIds = new Set(
    plan.tasks
      .filter((t) => t.status === "done" || t.status === "skipped")
      .map((t) => t.id)
  );

  // Derive effective project list: prefer explicit --projects, else read the
  // sole project from project-context.yaml (single-project workspaces), else
  // fall back to ["default"] for legacy / unconfigured cases.
  const projects = (projectList && projectList.length > 0)
    ? projectList
    : (loadSoleProject(findProjectRootFromPath(args.plan)) || ["default"]);

  // Build current_tasks: for each project, find the in_progress task
  const currentTasks = {};

  for (const proj of projects) {
    // Find the in_progress task for this project
    const inProgressForProject = plan.tasks.filter(
      (t) => t.status === "in_progress" && getTaskProjects(t).includes(proj)
    );

    if (inProgressForProject.length > 0) {
      // Use the first in_progress task for this project
      currentTasks[proj] = inProgressForProject[0].id;
      continue;
    }

    // No in_progress for this project: try to advance a pending task
    const nextPending = plan.tasks.find(
      (t) =>
        t.status === "pending" &&
        getTaskProjects(t).includes(proj) &&
        (t.depends_on || []).every((d) => resolvedIds.has(d))
    );
    if (nextPending) {
      nextPending.status = "in_progress";
      currentTasks[proj] = nextPending.id;
    }
  }

  // Detect project_switch: compare projects active AFTER recomputation with
  // projects active BEFORE. New projects = present in currentTasks but absent
  // from priorActiveProjects. This correctly handles:
  // - Single→single cross-project (api done, web advances -> from:[api] to:[web])
  // - Cross-project task done (both web+api were active -> no false switch)
  // - Mixed: cross-project done, downstream in new project (emits correctly)
  let switchNotification = null;
  if (changedToTerminal && changedTask) {
    const newActiveProjects = new Set(Object.keys(currentTasks));
    const newlyActive = [...newActiveProjects].filter((p) => !priorActiveProjects.has(p));
    if (newlyActive.length > 0) {
      switchNotification = {
        project_switch: {
          from: [...priorActiveProjects].filter((p) => !newActiveProjects.has(p)),
          to: newlyActive,
        },
      };
    }
  }

  // Set plan.status based on overall task states
  const allDone = plan.tasks.every((t) => t.status === "done");
  const anyInProgress = plan.tasks.some((t) => t.status === "in_progress");
  const anyPending = plan.tasks.some((t) => t.status === "pending");

  if (allDone) {
    plan.status = "done";
    plan.current_tasks = {};
  } else {
    plan.current_tasks = currentTasks;
    if (anyInProgress || Object.keys(currentTasks).length > 0) {
      plan.status = "in_progress";
    } else if (anyPending) {
      plan.status = "in_progress";
      warning =
        "All remaining tasks are blocked by dependencies; resolve a blocker before continuing.";
    }
  }

  return { warning, project_switch: switchNotification };
}

// Get the project array for a task, defaulting to ["default"] if not set
function getTaskProjects(task) {
  if (Array.isArray(task.project) && task.project.length > 0) {
    return task.project;
  }
  return ["default"];
}

// Derive the effective project list from tasks' project arrays.
// Used when --projects is not explicitly provided.
function deriveProjectList(tasks) {
  const projects = new Set();
  for (const t of tasks) {
    for (const p of getTaskProjects(t)) {
      projects.add(p);
    }
  }
  return [...projects];
}

// ── Validation ────────────────────────────────────────────────
function validatePlan(plan, projectList) {
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

  // DAG (no cycles) — per-project subgraph when --projects is provided
  const cycle = findCycle(tasks, projectList);
  if (cycle) {
    errors.push(`Dependency cycle detected: ${cycle.join(" -> ")}`);
  }

  // Per-project in_progress constraint (use the same effective project list
  // resolution as recomputeCurrentTasks so validation matches runtime behavior).
  const projects = (projectList && projectList.length > 0)
    ? projectList
    : (loadSoleProject(findProjectRootFromPath(args.plan)) || ["default"]);
  for (const proj of projects) {
    const inProgressForProject = tasks.filter(
      (t) => t.status === "in_progress" && getTaskProjects(t).includes(proj)
    );
    if (inProgressForProject.length > 1) {
      errors.push(
        `More than one task is in_progress for project "${proj}": ${inProgressForProject.map((t) => t.id).join(", ")}`
      );
    }
  }

  // Task project validation against --projects
  if (projectList && projectList.length > 0) {
    for (const t of tasks) {
      if (Array.isArray(t.project)) {
        for (const p of t.project) {
          if (!projectList.includes(p)) {
            errors.push(ERRORS.INVALID_TASK_PROJECT(t.id, p, projectList));
          }
        }
      }
    }
  }

  // Project naming constraint (no leading underscore)
  if (projectList && projectList.length > 0) {
    for (const p of projectList) {
      if (!PROJECT_NAME_RE.test(p)) {
        errors.push(ERRORS.INVALID_PROJECT_NAME(p));
      }
    }
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

  // deliverables.freshness enum validation (stale never blocks a write)
  for (const t of tasks) {
    if (t.deliverables && typeof t.deliverables === "object") {
      if (!VALID_FRESHNESS.includes(t.deliverables.freshness)) {
        errors.push(ERRORS.INVALID_FRESHNESS(t.id, t.deliverables.freshness));
      }
    }
  }

  // current_tasks validity
  if (plan.status === "done") {
    if (plan.current_tasks && Object.keys(plan.current_tasks).length > 0) {
      errors.push("plan.status is done but current_tasks is not empty");
    }
  } else if (plan.current_tasks && typeof plan.current_tasks === "object") {
    for (const [proj, taskId] of Object.entries(plan.current_tasks)) {
      const ct = tasks.find((t) => t.id === taskId);
      if (!ct) {
        errors.push(`current_tasks["${proj}"] = "${taskId}" does not reference a task`);
      } else if (ct.status !== "pending" && ct.status !== "in_progress") {
        errors.push(
          `current_tasks["${proj}"] = "${taskId}" has status "${ct.status}" (must be pending or in_progress)`
        );
      }
    }
  }

  return errors;
}

// Returns an array describing a cycle path, or null if the graph is a DAG.
// when projectList is provided, partition tasks by project into
// subgraphs; cross-project depends_on included in both subgraphs.
function findCycle(tasks, projectList) {
  if (!projectList || projectList.length <= 1) {
    // Single project or no project list: check the whole graph
    return findCycleInSubgraph(tasks, tasks.map((t) => t.id));
  }

  // Per-project subgraph: each task belongs to every project in its project array.
  // Cross-project depends_on are included in both subgraphs (ADR-8):
  // if task A[web] depends on B[api], B is added to the web subgraph so
  // that cross-project cycles like A[web] -> B[api] -> A[web] are detected.
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const proj of projectList) {
    const idSet = new Set(
      tasks
        .filter((t) => getTaskProjects(t).includes(proj))
        .map((t) => t.id)
    );
    // Expand: pull in cross-project depends_on targets (and their transitive deps)
    // so that cross-project cycles are visible within each subgraph.
    const queue = [...idSet];
    for (const id of queue) {
      for (const dep of (taskMap.get(id)?.depends_on || [])) {
        if (!idSet.has(dep)) {
          idSet.add(dep);
          queue.push(dep);
        }
      }
    }
    const cycle = findCycleInSubgraph(tasks, [...idSet]);
    if (cycle) return cycle;
  }
  return null;
}

function findCycleInSubgraph(tasks, taskIds) {
  const idSet = new Set(taskIds);
  const adj = new Map();
  for (const t of tasks) {
    if (!idSet.has(t.id)) continue;
    // Only include depends_on that are in this subgraph
    adj.set(t.id, (t.depends_on || []).filter((d) => idSet.has(d)));
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(taskIds.map((id) => [id, WHITE]));
  const stack = [];

  function dfs(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of adj.get(node) || []) {
      if (!color.has(dep)) continue;
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

  for (const id of taskIds) {
    if (color.get(id) === WHITE) {
      const found = dfs(id);
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

  // Parse --projects; if not provided, derive from tasks
  let projectList = null;
  if (args.projects && args.projects !== true) {
    projectList = args.projects.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    // Derive project list from task.project arrays so that validation
    // and recomputation work correctly even without explicit --projects.
    projectList = deriveProjectList(plan.tasks);
  }

  // Migrate old current_task (string) to current_tasks (Record) if needed.
  // Also remove legacy current_task field even when null (YAML `current_task: null`).
  if (plan.current_task != null && (!plan.current_tasks || typeof plan.current_tasks !== "object")) {
    plan.current_tasks = { default: plan.current_task };
  }
  if ("current_task" in plan) {
    delete plan.current_task;
  }
  if (!plan.current_tasks) {
    plan.current_tasks = {};
  }

  const now = new Date().toISOString();

  const taskChange = applyUpdate(plan, args, now);
  if (taskChange.error) {
    process.stderr.write(taskChange.error + "\n");
    process.exit(1);
  }
  const { warning, project_switch: switchNotif } = recomputeCurrentTasks(plan, args.task, projectList);

  const validationErrors = validatePlan(plan, projectList);
  if (validationErrors.length) {
    process.stderr.write(ERRORS.VALIDATION_FAILED(validationErrors) + "\n");
    process.exit(1);
  }

  const tmpPath = args.plan + ".tmp";
  try {
    writeFileSync(tmpPath, stringifyYaml(plan, { lineWidth: 200 }), "utf-8");
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
    current_tasks: plan.current_tasks,
    plan_status: plan.status,
    progress: { done: doneCount, total: plan.tasks.length },
    ...(warning ? { warning } : {}),
    ...(switchNotif ? switchNotif : {}),
  };
  process.stdout.write(JSON.stringify(result) + "\n");
}

main();

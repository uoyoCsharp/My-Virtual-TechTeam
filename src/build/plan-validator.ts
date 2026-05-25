import { parse as parseYaml } from "yaml";

export interface PlanValidationError {
  path: string;
  message: string;
}

export interface PlanTask {
  id: string;
  title: string;
  status: string;
  depends_on: string[];
  skill_hint?: string;
  acceptance?: string[];
  artifacts?: string[];
  notes?: string;
}

export interface Plan {
  version: number;
  change_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  current_task: string | null;
  tasks: PlanTask[];
}

const PLAN_STATUSES = new Set(["in_progress", "done", "abandoned"]);
const TASK_STATUSES = new Set([
  "pending",
  "in_progress",
  "done",
  "blocked",
  "skipped",
]);

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function detectCycle(tasks: PlanTask[]): string[] | null {
  const idIndex = new Map<string, PlanTask>();
  for (const t of tasks) idIndex.set(t.id, t);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const t of tasks) color.set(t.id, WHITE);

  const stack: string[] = [];

  function visit(id: string): string[] | null {
    color.set(id, GRAY);
    stack.push(id);
    const task = idIndex.get(id);
    if (task) {
      for (const dep of task.depends_on ?? []) {
        const c = color.get(dep);
        if (c === GRAY) {
          const cycleStart = stack.indexOf(dep);
          return stack.slice(cycleStart).concat(dep);
        }
        if (c === WHITE) {
          const found = visit(dep);
          if (found) return found;
        }
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const t of tasks) {
    if (color.get(t.id) === WHITE) {
      const cycle = visit(t.id);
      if (cycle) return cycle;
    }
  }
  return null;
}

function validateTask(
  task: unknown,
  index: number,
  knownIds: Set<string>,
  errors: PlanValidationError[],
): PlanTask | null {
  const base = `tasks[${index}]`;
  if (typeof task !== "object" || task === null) {
    errors.push({ path: base, message: "Task must be an object" });
    return null;
  }
  const t = task as Record<string, unknown>;

  if (!isNonEmptyString(t.id)) {
    errors.push({ path: `${base}.id`, message: "Missing or empty id" });
    return null;
  }
  if (!isNonEmptyString(t.title)) {
    errors.push({ path: `${base}.title`, message: "Missing or empty title" });
  }
  if (!isString(t.status) || !TASK_STATUSES.has(t.status)) {
    errors.push({
      path: `${base}.status`,
      message: `Invalid status "${String(t.status)}". Expected one of: ${[...TASK_STATUSES].join(", ")}`,
    });
  }
  if (!Array.isArray(t.depends_on)) {
    errors.push({
      path: `${base}.depends_on`,
      message: "depends_on must be an array (use [] for no dependencies)",
    });
  } else {
    for (let i = 0; i < t.depends_on.length; i++) {
      const dep = t.depends_on[i];
      if (!isNonEmptyString(dep)) {
        errors.push({
          path: `${base}.depends_on[${i}]`,
          message: "Dependency entries must be non-empty strings",
        });
      }
    }
  }
  if (t.skill_hint !== undefined && !isString(t.skill_hint)) {
    errors.push({ path: `${base}.skill_hint`, message: "skill_hint must be a string" });
  }
  if (t.acceptance !== undefined && !Array.isArray(t.acceptance)) {
    errors.push({ path: `${base}.acceptance`, message: "acceptance must be an array" });
  }
  if (t.artifacts !== undefined && !Array.isArray(t.artifacts)) {
    errors.push({ path: `${base}.artifacts`, message: "artifacts must be an array" });
  }
  if (t.notes !== undefined && !isString(t.notes)) {
    errors.push({ path: `${base}.notes`, message: "notes must be a string" });
  }

  if (knownIds.has(t.id)) {
    errors.push({ path: `${base}.id`, message: `Duplicate task id "${t.id}"` });
  }
  knownIds.add(t.id);

  return {
    id: t.id,
    title: isString(t.title) ? t.title : "",
    status: isString(t.status) ? t.status : "",
    depends_on: Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [],
    skill_hint: isString(t.skill_hint) ? t.skill_hint : undefined,
    acceptance: Array.isArray(t.acceptance) ? (t.acceptance as string[]) : undefined,
    artifacts: Array.isArray(t.artifacts) ? (t.artifacts as string[]) : undefined,
    notes: isString(t.notes) ? t.notes : undefined,
  };
}

export function validatePlan(rawYaml: string): PlanValidationError[] {
  const errors: PlanValidationError[] = [];

  let parsed: unknown;
  try {
    parsed = parseYaml(rawYaml);
  } catch (e) {
    errors.push({ path: "(root)", message: `Invalid YAML: ${e}` });
    return errors;
  }

  if (typeof parsed !== "object" || parsed === null) {
    errors.push({ path: "(root)", message: "Plan must be a YAML mapping" });
    return errors;
  }

  const plan = parsed as Record<string, unknown>;

  if (plan.version !== 1) {
    errors.push({
      path: "version",
      message: `Unsupported plan version "${String(plan.version)}". Expected 1.`,
    });
  }
  if (!isNonEmptyString(plan.change_id)) {
    errors.push({ path: "change_id", message: "Missing or empty change_id" });
  }
  if (!isNonEmptyString(plan.title)) {
    errors.push({ path: "title", message: "Missing or empty title" });
  }
  if (!isNonEmptyString(plan.created_at)) {
    errors.push({ path: "created_at", message: "Missing or empty created_at" });
  }
  if (!isNonEmptyString(plan.updated_at)) {
    errors.push({ path: "updated_at", message: "Missing or empty updated_at" });
  }
  if (!isString(plan.status) || !PLAN_STATUSES.has(plan.status)) {
    errors.push({
      path: "status",
      message: `Invalid status "${String(plan.status)}". Expected one of: ${[...PLAN_STATUSES].join(", ")}`,
    });
  }

  const currentTask = plan.current_task;
  if (currentTask !== null && !isString(currentTask)) {
    errors.push({
      path: "current_task",
      message: "current_task must be a task id string or null",
    });
  }

  if (!Array.isArray(plan.tasks)) {
    errors.push({ path: "tasks", message: "tasks must be an array" });
    return errors;
  }
  if (plan.tasks.length === 0) {
    errors.push({ path: "tasks", message: "Plan must contain at least one task" });
    return errors;
  }

  const knownIds = new Set<string>();
  const validated: PlanTask[] = [];
  for (let i = 0; i < plan.tasks.length; i++) {
    const t = validateTask(plan.tasks[i], i, knownIds, errors);
    if (t) validated.push(t);
  }

  for (let i = 0; i < validated.length; i++) {
    const t = validated[i];
    for (let j = 0; j < t.depends_on.length; j++) {
      const dep = t.depends_on[j];
      if (!knownIds.has(dep)) {
        errors.push({
          path: `tasks[${i}].depends_on[${j}]`,
          message: `Unknown task id "${dep}"`,
        });
      }
    }
  }

  if (typeof currentTask === "string" && !knownIds.has(currentTask)) {
    errors.push({
      path: "current_task",
      message: `Unknown task id "${currentTask}"`,
    });
  } else if (typeof currentTask === "string" && knownIds.has(currentTask)) {
    const ct = validated.find((t) => t.id === currentTask);
    if (ct && ct.status !== "pending" && ct.status !== "in_progress") {
      errors.push({
        path: "current_task",
        message: `current_task "${currentTask}" must reference a task with status "pending" or "in_progress" (found "${ct.status}")`,
      });
    }
  }

  if (plan.status === "done" && currentTask !== null) {
    errors.push({
      path: "current_task",
      message: 'current_task must be null when plan status is "done"',
    });
  }

  const cycle = detectCycle(validated);
  if (cycle) {
    errors.push({
      path: "tasks",
      message: `Dependency cycle detected: ${cycle.join(" -> ")}`,
    });
  }

  return errors;
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const SCRIPT = path.resolve("dist/scripts/plan-update.cjs");

interface Task {
  id: string;
  title?: string;
  status: string;
  completed_at: string | null;
  depends_on: string[];
  project?: string[];
  skill_hint?: string;
  artifacts: unknown;
  notes?: string;
  acceptance: string[];
  deliverables?: { freshness: string } | null;
}

interface Plan {
  version: number;
  change_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  current_tasks: Record<string, string>;
  tasks: Task[];
}

function basePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    version: 1,
    change_id: "20260603-demo",
    title: "Demo",
    created_at: "2026-06-03T10:00:00",
    updated_at: "2026-06-03T10:00:00",
    status: "in_progress",
    current_tasks: { default: "t1" },
    tasks: [
      {
        id: "t1",
        title: "Foundation",
        status: "in_progress",
        completed_at: null,
        depends_on: [],
        skill_hint: "mvt-implement",
        artifacts: null,
        notes: "first",
        acceptance: ["tsc clean"],
      },
      {
        id: "t2",
        title: "Core logic",
        status: "pending",
        completed_at: null,
        depends_on: ["t1"],
        skill_hint: "mvt-implement",
        artifacts: null,
        notes: "second",
        acceptance: ["tests pass"],
      },
    ],
    ...overrides,
  };
}

describe("plan-update.cjs", () => {
  let tmpDir: string;
  let planPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-plan-update-"));
    planPath = path.join(tmpDir, "plan.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePlan(plan: Plan): void {
    writeFileSync(planPath, stringifyYaml(plan), "utf-8");
  }

  function readPlan(): Plan {
    return parseYaml(readFileSync(planPath, "utf-8")) as Plan;
  }

  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], { encoding: "utf-8" });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function update(extra: string[]): { status: number; stdout: string; stderr: string } {
    return run(["--plan", planPath, ...extra]);
  }

  // ── Original tests (updated for current_tasks schema) ────────────────

  it("marks a task done, sets completed_at, advances current_tasks", () => {
    writePlan(basePlan());
    const res = update(["--task", "t1", "--status", "done"]);

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.task).toMatchObject({ id: "t1", old_status: "in_progress", new_status: "done" });
    expect(out.current_tasks).toEqual({ default: "t2" });
    expect(out.plan_status).toBe("in_progress");
    expect(out.progress).toEqual({ done: 1, total: 2 });

    const plan = readPlan();
    const t1 = plan.tasks.find((t) => t.id === "t1")!;
    const t2 = plan.tasks.find((t) => t.id === "t2")!;
    expect(t1.status).toBe("done");
    expect(t1.completed_at).not.toBeNull();
    expect(t2.status).toBe("in_progress");
    expect(plan.current_tasks).toEqual({ default: "t2" });
  });

  it("appends artifacts and de-duplicates, initializing null artifacts", () => {
    writePlan(basePlan());
    const res = update([
      "--task", "t1", "--status", "done",
      "--artifacts", "src/a.ts, src/b.ts, src/a.ts",
    ]);

    expect(res.status).toBe(0);
    const t1 = readPlan().tasks.find((t) => t.id === "t1")!;
    expect(t1.artifacts).toEqual({ files: ["src/a.ts", "src/b.ts"] });
  });

  it("overwrites notes when provided", () => {
    writePlan(basePlan());
    update(["--task", "t1", "--status", "blocked", "--notes", "needs upstream API"]);
    const t1 = readPlan().tasks.find((t) => t.id === "t1")!;
    expect(t1.notes).toBe("needs upstream API");
  });

  it("sets plan.status=done and current_tasks={} when all tasks complete", () => {
    writePlan(basePlan({
      tasks: basePlan().tasks.map((t) =>
        t.id === "t1" ? { ...t, status: "done", completed_at: "2026-06-03T10:00:00" } : t
      ),
      current_tasks: { default: "t2" },
    }));
    const before = readPlan();
    before.tasks.find((t) => t.id === "t2")!.status = "in_progress";
    writePlan(before);

    const res = update(["--task", "t2", "--status", "done"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.plan_status).toBe("done");
    expect(out.current_tasks).toEqual({});

    const plan = readPlan();
    expect(plan.status).toBe("done");
    expect(plan.current_tasks).toEqual({});
  });

  it("emits a blocked-by-dependencies warning when no task is executable", () => {
    writePlan(basePlan());
    const res = update(["--task", "t1", "--status", "blocked"]);

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.current_tasks).toEqual({});
    expect(out.plan_status).toBe("in_progress");
    expect(out.warning).toMatch(/blocked by dependencies/i);
  });

  it("rejects an invalid status without writing", () => {
    writePlan(basePlan());
    const original = readFileSync(planPath, "utf-8");
    const res = update(["--task", "t1", "--status", "finished"]);

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Invalid --status/);
    expect(readFileSync(planPath, "utf-8")).toBe(original);
  });

  it("rejects an unknown task id and lists valid ids", () => {
    writePlan(basePlan());
    const res = update(["--task", "tX", "--status", "done"]);

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/not found/);
    expect(res.stderr).toContain("t1");
    expect(res.stderr).toContain("t2");
  });

  it("errors when required arguments are missing", () => {
    writePlan(basePlan());
    expect(update(["--status", "done"]).status).toBe(1);
    expect(update(["--task", "t1"]).status).toBe(1);
    expect(run(["--task", "t1", "--status", "done"]).status).toBe(1); // no --plan
  });

  it("aborts the write when the resulting plan fails validation", () => {
    const plan = basePlan();
    plan.tasks.find((t) => t.id === "t2")!.acceptance = [];
    writePlan(plan);
    const original = readFileSync(planPath, "utf-8");

    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/validation failed/i);
    expect(res.stderr).toMatch(/acceptance/i);
    expect(readFileSync(planPath, "utf-8")).toBe(original);
  });

  it("detects a dependency cycle during validation", () => {
    const plan = basePlan();
    plan.tasks.find((t) => t.id === "t1")!.depends_on = ["t2"];
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/cycle/i);
  });

  it("aborts on a missing plan file", () => {
    const res = run(["--plan", path.join(tmpDir, "nope.yaml"), "--task", "t1", "--status", "done"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/not found/i);
  });

  // ── Plan Attribution + DAG Test Cases ──────────────────────────────────

  it("(1) blocked does not satisfy depends_on -> task stays blocked", () => {
    // t2 depends_on t1; t1 is blocked -> t2 should stay pending
    const plan = basePlan();
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "blocked"]);
    expect(res.status).toBe(0);

    const out = JSON.parse(res.stdout);
    // blocked does NOT satisfy depends_on, so t2 stays pending
    expect(out.warning).toMatch(/blocked by dependencies/i);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t2")!.status).toBe("pending");
  });

  it("(2) skipped satisfies depends_on -> dependent task unblocks", () => {
    const plan = basePlan();
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "skipped"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    // skipped satisfies depends_on, so t2 should be advanced
    expect(p.tasks.find((t) => t.id === "t2")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ default: "t2" });
  });

  it("(3) other in_progress exists in different project -> current_task preserved", () => {
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t2" },
      tasks: [
        { id: "t1", title: "Web task", status: "in_progress", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a2"] },
      ],
    };
    writePlan(plan);

    // Mark t1 done -- t2 should remain in_progress
    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t2")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ api: "t2" });
  });

  it("(4) completed_at cleared when status reverted from done", () => {
    const plan = basePlan({
      tasks: basePlan().tasks.map((t) =>
        t.id === "t1" ? { ...t, status: "done", completed_at: "2026-06-03T10:00:00" } : t
      ),
      current_tasks: { default: "t2" },
    });
    // t2 is in_progress, t1 is done
    plan.tasks.find((t) => t.id === "t2")!.status = "in_progress";
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "pending"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t1")!.completed_at).toBeNull();
  });

  it("(5) --artifacts accumulates without duplicates", () => {
    const plan = basePlan();
    plan.tasks.find((t) => t.id === "t1")!.artifacts = { files: ["src/a.ts"] };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "in_progress", "--artifacts", "src/a.ts,src/b.ts"]);
    expect(res.status).toBe(0);

    const t1 = readPlan().tasks.find((t) => t.id === "t1")!;
    expect(t1.artifacts).toEqual({ files: ["src/a.ts", "src/b.ts"] });
  });

  it("(6) update non-current_task does not change current_task", () => {
    const plan = basePlan();
    writePlan(plan);

    // Update t2 (not current) to blocked -- current should remain t1
    const res = update(["--task", "t2", "--status", "blocked"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.current_tasks).toEqual({ default: "t1" });
    expect(p.tasks.find((t) => t.id === "t1")!.status).toBe("in_progress");
  });

  it("(7) per-project independent in_progress", () => {
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t3" },
      tasks: [
        { id: "t1", title: "Web task", status: "in_progress", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web task 2", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    // Both t1 (web) and t3 (api) are in_progress -- this should be valid
    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    // t2 should advance for web, t3 remains for api
    expect(p.tasks.find((t) => t.id === "t2")!.status).toBe("in_progress");
    expect(p.tasks.find((t) => t.id === "t3")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ web: "t2", api: "t3" });
  });

  it("(8) current_tasks per-project advancement", () => {
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t3" },
      tasks: [
        { id: "t1", title: "Web task", status: "in_progress", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web task 2", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a3"] },
        { id: "t4", title: "API task 2", status: "pending", completed_at: null, depends_on: ["t3"], project: ["api"], artifacts: null, acceptance: ["a4"] },
      ],
    };
    writePlan(plan);

    // Complete web task t1 -> web advances to t2, api unchanged
    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.current_tasks).toEqual({ web: "t2", api: "t3" });
  });

  it("(9) cross-project advancement emits project_switch", () => {
    // t1 (web) depends on t3 (api). When t3 completes, t1 auto-advances.
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { api: "t3" },
      tasks: [
        { id: "t1", title: "Web task", status: "pending", completed_at: null, depends_on: ["t3"], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t3", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t3", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const out = JSON.parse(res.stdout);
    expect(out.project_switch).toBeDefined();
    expect(out.project_switch.from).toEqual(["api"]);
    expect(out.project_switch.to).toEqual(["web"]);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t1")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ web: "t1" });
  });

  it("(10) findCycle per-project subgraph", () => {
    // Cycle in web subgraph (t1 -> t2 -> t1) but not in api subgraph
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t3" },
      tasks: [
        { id: "t1", title: "Web task", status: "in_progress", completed_at: null, depends_on: ["t2"], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web task 2", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/cycle/i);
  });

  it("(11) skipped satisfies depends_on (cross-project)", () => {
    // t1 (web) depends on t3 (api). t3 is skipped -> t1 unblocks.
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { api: "t3" },
      tasks: [
        { id: "t1", title: "Web task", status: "pending", completed_at: null, depends_on: ["t3"], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t3", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t3", "--status", "skipped", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t1")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ web: "t1" });
  });

  // ── Migration and --projects validation tests ─────────────────────────

  it("migrates old current_task (string) to current_tasks (Record)", () => {
    // Write a plan with the old schema
    const oldPlan = {
      version: 1,
      change_id: "20260603-demo",
      title: "Demo",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_task: "t1",
      tasks: [
        { id: "t1", title: "Foundation", status: "in_progress", completed_at: null, depends_on: [], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Core logic", status: "pending", completed_at: null, depends_on: ["t1"], artifacts: null, acceptance: ["a2"] },
      ],
    };
    writeFileSync(planPath, stringifyYaml(oldPlan), "utf-8");

    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.current_tasks).toBeDefined();
    expect(p.current_tasks).toEqual({ default: "t2" });
    expect((p as any).current_task).toBeUndefined();
  });

  it("rejects invalid project name with leading underscore", () => {
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { _all: "t1" },
      tasks: [
        { id: "t1", title: "Task", status: "in_progress", completed_at: null, depends_on: [], project: ["_all"], artifacts: null, acceptance: ["a1"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done", "--projects", "_all"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Invalid project name.*_all/);
  });

  it("rejects task with project not in --projects list", () => {
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1" },
      tasks: [
        { id: "t1", title: "Task", status: "in_progress", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a1"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done", "--projects", "api"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/project.*not in --projects/i);
  });

  it("rejects more than one in_progress per project", () => {
    // t1 and t2 are both web tasks, t1 is in_progress, t2 is pending with no deps.
    // Setting t2 to in_progress should fail because t1 is already in_progress for web.
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1" },
      tasks: [
        { id: "t1", title: "Web task 1", status: "in_progress", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web task 2", status: "pending", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a2"] },
      ],
    };
    writePlan(plan);

    // Directly set t2 to in_progress while t1 is still in_progress for web
    const res = update(["--task", "t2", "--status", "in_progress", "--projects", "web"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/More than one.*in_progress.*web/i);
  });

  it("cross-project task sets current_tasks for all involved projects", () => {
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t1" },
      tasks: [
        { id: "t1", title: "Shared task", status: "in_progress", completed_at: null, depends_on: [], project: ["web", "api"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web follow-up", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "API follow-up", status: "pending", completed_at: null, depends_on: ["t1"], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t2")!.status).toBe("in_progress");
    expect(p.tasks.find((t) => t.id === "t3")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ web: "t2", api: "t3" });
  });

  // -- Deliverables handoff tests --

  it("(#1) --deliverables-pointer current sets task.deliverables.freshness = current", () => {
    writePlan(basePlan());
    const res = update([
      "--task", "t1", "--status", "done",
      "--deliverables-pointer", "current",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    const t1 = p.tasks.find((t) => t.id === "t1")!;
    expect(t1.deliverables).toEqual({ freshness: "current" });
  });

  it("(#2) --mark-deliverable-stale sets downstream task's freshness = stale", () => {
    writePlan(basePlan());
    const res = update([
      "--task", "t1", "--status", "done",
      "--mark-deliverable-stale", "t2",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    const t2 = p.tasks.find((t) => t.id === "t2")!;
    expect(t2.deliverables).toEqual({ freshness: "stale" });
  });

  it("(#3) both --deliverables-pointer and --mark-deliverable-stale in single invocation", () => {
    writePlan(basePlan());
    const res = update([
      "--task", "t1", "--status", "done",
      "--deliverables-pointer", "current",
      "--mark-deliverable-stale", "t2",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t1")!.deliverables).toEqual({ freshness: "current" });
    expect(p.tasks.find((t) => t.id === "t2")!.deliverables).toEqual({ freshness: "stale" });
  });

  it("(#4) validatePlan rejects invalid freshness values", () => {
    const plan = basePlan();
    plan.tasks[0].deliverables = { freshness: "unknown" };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/invalid deliverables.freshness/i);
  });

  it("(#5) stale deliverables never block writes", () => {
    const plan = basePlan();
    plan.tasks[0].deliverables = { freshness: "stale" };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t1")!.status).toBe("done");
  });

  it("(#6) --mark-deliverable-stale with non-existent task does not error", () => {
    writePlan(basePlan());
    const res = update([
      "--task", "t1", "--status", "done",
      "--mark-deliverable-stale", "t-nonexistent",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    // t1 should be done, no crash
    expect(p.tasks.find((t) => t.id === "t1")!.status).toBe("done");
  });

  it("(#7) --deliverables-pointer current overwrites existing stale deliverables", () => {
    const plan = basePlan();
    plan.tasks[0].deliverables = { freshness: "stale" };
    writePlan(plan);

    const res = update([
      "--task", "t1", "--status", "in_progress",
      "--deliverables-pointer", "current",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t1")!.deliverables).toEqual({ freshness: "current" });
  });

  it("(#8) --mark-deliverable-stale preserves existing deliverables object shape", () => {
    const plan = basePlan();
    plan.tasks[1].deliverables = { freshness: "current" };
    writePlan(plan);

    const res = update([
      "--task", "t1", "--status", "done",
      "--mark-deliverable-stale", "t2",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    const t2 = p.tasks.find((t) => t.id === "t2")!;
    expect(t2.deliverables).toEqual({ freshness: "stale" });
  });

  it("(#9) --deliverables-pointer with invalid value is rejected", () => {
    writePlan(basePlan());
    const res = update([
      "--task", "t1", "--status", "done",
      "--deliverables-pointer", "invalid",
    ]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Invalid --deliverables-pointer/i);
  });

  it("(#10) --mark-deliverable-stale supports comma-separated multiple task ids", () => {
    const plan = basePlan({
      tasks: [
        { id: "t1", title: "Shared", status: "in_progress", completed_at: null, depends_on: [], project: ["web", "api"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web downstream", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "API downstream", status: "pending", completed_at: null, depends_on: ["t1"], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    });
    writePlan(plan);

    const res = update([
      "--task", "t1", "--status", "done",
      "--mark-deliverable-stale", "t2,t3",
      "--projects", "web,api",
    ]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t2")!.deliverables).toEqual({ freshness: "stale" });
    expect(p.tasks.find((t) => t.id === "t3")!.deliverables).toEqual({ freshness: "stale" });
  });

  it("(cross-project) no false project_switch when cross-project task completes", () => {
    // t1 is cross-project ["web","api"]. When done, t2 (web) and t3 (api) advance.
    // Since both web and api were already active projects, no project_switch should fire.
    const plan: Plan = {
      version: 1,
      change_id: "multi-proj",
      title: "Multi-project",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t1" },
      tasks: [
        { id: "t1", title: "Shared task", status: "in_progress", completed_at: null, depends_on: [], project: ["web", "api"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "Web follow-up", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "API follow-up", status: "pending", completed_at: null, depends_on: ["t1"], project: ["api"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);

    const out = JSON.parse(res.stdout);
    expect(out.project_switch).toBeUndefined();
  });

  // ── Cross-project cycle detection (BUG-1 fix) ───────────────────────

  it("(cross-project cycle) detects cycle spanning two projects", () => {
    // A[web] depends on B[api], B[api] depends on A[web] → cross-project cycle
    const plan: Plan = {
      version: 1,
      change_id: "cross-cycle",
      title: "Cross-project cycle",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t2" },
      tasks: [
        { id: "t1", title: "Web task", status: "in_progress", completed_at: null, depends_on: ["t2"], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "API task", status: "in_progress", completed_at: null, depends_on: ["t1"], project: ["api"], artifacts: null, acceptance: ["a2"] },
      ],
    };
    writePlan(plan);

    const res = update(["--task", "t1", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/cycle/i);
  });

  it("(cross-project no-cycle) cross-project dependency without cycle passes", () => {
    // A[web] depends on B[api] — no cycle
    const plan: Plan = {
      version: 1,
      change_id: "cross-nocycle",
      title: "Cross-project no cycle",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { api: "t2" },
      tasks: [
        { id: "t1", title: "Web task", status: "pending", completed_at: null, depends_on: ["t2"], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a2"] },
      ],
    };
    writePlan(plan);

    // Mark t2 done -> t1 should advance
    const res = update(["--task", "t2", "--status", "done", "--projects", "web,api"]);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toMatch(/cycle/i);
  });

  // ── Derived project list (GAP-3 fix) ──────────────────────────

  it("(derived projects) multi-project plan works without --projects", () => {
    const plan: Plan = {
      version: 1,
      change_id: "derived-proj",
      title: "Derived project list",
      created_at: "2026-06-03T10:00:00",
      updated_at: "2026-06-03T10:00:00",
      status: "in_progress",
      current_tasks: { web: "t1", api: "t2" },
      tasks: [
        { id: "t1", title: "Web task", status: "in_progress", completed_at: null, depends_on: [], project: ["web"], artifacts: null, acceptance: ["a1"] },
        { id: "t2", title: "API task", status: "in_progress", completed_at: null, depends_on: [], project: ["api"], artifacts: null, acceptance: ["a2"] },
        { id: "t3", title: "Web follow-up", status: "pending", completed_at: null, depends_on: ["t1"], project: ["web"], artifacts: null, acceptance: ["a3"] },
      ],
    };
    writePlan(plan);

    // Mark t1 done WITHOUT --projects -- should still correctly advance t3 for web
    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(0);

    const p = readPlan();
    expect(p.tasks.find((t) => t.id === "t3")!.status).toBe("in_progress");
    expect(p.current_tasks).toEqual({ web: "t3", api: "t2" });
  });
});

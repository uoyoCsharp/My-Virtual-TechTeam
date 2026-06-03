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
  skill_hint?: string;
  artifacts: unknown;
  notes?: string;
  acceptance: string[];
}

interface Plan {
  version: number;
  change_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  current_task: string | null;
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
    current_task: "t1",
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

  it("marks a task done, sets completed_at, advances current_task", () => {
    writePlan(basePlan());
    const res = update(["--task", "t1", "--status", "done"]);

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.task).toMatchObject({ id: "t1", old_status: "in_progress", new_status: "done" });
    expect(out.current_task).toBe("t2");
    expect(out.plan_status).toBe("in_progress");
    expect(out.progress).toEqual({ done: 1, total: 2 });

    const plan = readPlan();
    const t1 = plan.tasks.find((t) => t.id === "t1")!;
    const t2 = plan.tasks.find((t) => t.id === "t2")!;
    expect(t1.status).toBe("done");
    expect(t1.completed_at).not.toBeNull();
    expect(t2.status).toBe("in_progress");
    expect(plan.current_task).toBe("t2");
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

  it("sets plan.status=done and current_task=null when all tasks complete", () => {
    writePlan(basePlan({
      tasks: basePlan().tasks.map((t) =>
        t.id === "t1" ? { ...t, status: "done", completed_at: "2026-06-03T10:00:00" } : t
      ),
      current_task: "t2",
    }));
    // t2 is pending with t1 done; mark t2 done -> plan complete
    const before = readPlan();
    before.tasks.find((t) => t.id === "t2")!.status = "in_progress";
    writePlan(before);

    const res = update(["--task", "t2", "--status", "done"]);
    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.plan_status).toBe("done");
    expect(out.current_task).toBeNull();

    const plan = readPlan();
    expect(plan.status).toBe("done");
    expect(plan.current_task).toBeNull();
  });

  it("emits a blocked-by-dependencies warning when no task is executable", () => {
    writePlan(basePlan());
    const res = update(["--task", "t1", "--status", "blocked"]);

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.current_task).toBeNull();
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
    // Pre-existing problem the mutation cannot fix: t2 has empty acceptance.
    const plan = basePlan();
    plan.tasks.find((t) => t.id === "t2")!.acceptance = [];
    writePlan(plan);
    const original = readFileSync(planPath, "utf-8");

    const res = update(["--task", "t1", "--status", "done"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/validation failed/i);
    expect(res.stderr).toMatch(/acceptance/i);
    // File must be untouched.
    expect(readFileSync(planPath, "utf-8")).toBe(original);
  });

  it("detects a dependency cycle during validation", () => {
    const plan = basePlan();
    // Introduce a cycle: t1 -> t2 -> t1
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
});

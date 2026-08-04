import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { stringify as stringifyYaml } from "yaml";

const SCRIPT = path.resolve("dist/scripts/workspace-state-check.cjs");

describe("workspace-state-check.cjs", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-state-check-"));
    workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    sessionPath = path.join(workspaceDir, "session.yaml");
    mkdirSync(workspaceDir, { recursive: true });
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  function writeSession(changes: unknown[], activeChangeId = "active-change", epics: unknown[] = []): void {
    writeFileSync(sessionPath, stringifyYaml({
      session: { initialized_at: "2026-08-04T00:00:00Z" },
      active_change: { id: activeChangeId },
      active_epic: null,
      changes,
      epics,
    }), "utf-8");
  }

  function writePlan(changeId: string, content: string): void {
    const planPath = path.join(workspaceDir, "artifacts", changeId, "plan.yaml");
    mkdirSync(path.dirname(planPath), { recursive: true });
    writeFileSync(planPath, content, "utf-8");
  }

  function check() {
    return spawnSync("node", [SCRIPT], { encoding: "utf-8", cwd: tmpDir });
  }

  it("reports empty ids, stale done plans, missing plans, invalid plans, and unresolved epics", () => {
    writePlan("done-change", "status: done\ntasks: []\n");
    writePlan("invalid-change", "tasks: not-an-array\n");
    writeSession([
      { id: "", status: "active", plan_path: "" },
      { id: "done-change", status: "active", plan_path: ".ai-agents/workspace/artifacts/done-change/plan.yaml" },
      { id: "missing-change", status: "active", plan_path: ".ai-agents/workspace/artifacts/missing-change/plan.yaml" },
      { id: "invalid-change", status: "active", plan_path: ".ai-agents/workspace/artifacts/invalid-change/plan.yaml" },
      { id: "orphan-epic", status: "active", plan_path: "", epic_id: "epic-missing" },
    ]);

    const result = check();
    expect(result.status).toBe(0);
    const findings = JSON.parse(result.stdout).findings;
    expect(findings.map((finding: { code: string }) => finding.code)).toEqual([
      "EMPTY_CHANGE_ID",
      "EPIC_REFERENCE_UNRESOLVED",
      "PLAN_DONE_INDEX_ACTIVE",
      "PLAN_INVALID",
      "PLAN_PATH_MISSING",
    ]);
    expect(findings.find((finding: { code: string }) => finding.code === "PLAN_DONE_INDEX_ACTIVE").recommended_action).toBe("set_status_done");
    expect(findings.filter((finding: { code: string }) => finding.code !== "EMPTY_CHANGE_ID" && finding.code !== "PLAN_DONE_INDEX_ACTIVE").every((finding: { recommended_action: string }) => finding.recommended_action === "manual_review")).toBe(true);
  });

  it("does not flag the active change when its indexed plan is done", () => {
    writePlan("active-change", "status: done\ntasks: []\n");
    writeSession([
      { id: "active-change", status: "active", plan_path: ".ai-agents/workspace/artifacts/active-change/plan.yaml" },
    ]);

    const result = check();
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).findings).toEqual([]);
  });

  it("never modifies session or plan files", () => {
    writePlan("active-change", "status: done\ntasks: []\n");
    writeSession([{ id: "active-change", status: "active", plan_path: ".ai-agents/workspace/artifacts/active-change/plan.yaml" }]);
    const planPath = path.join(workspaceDir, "artifacts", "active-change", "plan.yaml");
    const sessionBefore = readFileSync(sessionPath, "utf-8");
    const planBefore = readFileSync(planPath, "utf-8");

    expect(check().status).toBe(0);
    expect(readFileSync(sessionPath, "utf-8")).toBe(sessionBefore);
    expect(readFileSync(planPath, "utf-8")).toBe(planBefore);
  });
});
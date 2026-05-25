import { describe, it, expect } from "vitest";
import { validatePlan } from "../src/build/plan-validator.js";

const VALID_PLAN = `
version: 1
change_id: "20260525-user-auth"
title: "用户认证模块"
created_at: "2026-05-25T10:30:00+08:00"
updated_at: "2026-05-25T11:45:00+08:00"
status: in_progress
current_task: T3

tasks:
  - id: T1
    title: "搭建 JWT 工具"
    status: done
    depends_on: []
    skill_hint: mvt-implement
    acceptance: ["覆盖签发/校验/过期"]
    artifacts: ["src/auth/jwt.ts"]
    notes: ""

  - id: T2
    title: "登录接口"
    status: done
    depends_on: [T1]
    skill_hint: mvt-implement
    acceptance: []
    artifacts: []
    notes: ""

  - id: T3
    title: "刷新 token 接口"
    status: in_progress
    depends_on: [T1]
    skill_hint: mvt-implement
    acceptance: ["POST /refresh 返回新 token"]
    artifacts: []
    notes: ""

  - id: T4
    title: "权限中间件"
    status: pending
    depends_on: [T2]
    skill_hint: mvt-implement
    acceptance: []
    artifacts: []
    notes: ""
`;

describe("validatePlan", () => {
  it("accepts a valid plan with no errors", () => {
    const errors = validatePlan(VALID_PLAN);
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid YAML", () => {
    const errors = validatePlan("version: 1\n  bad: indent: here");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe("(root)");
    expect(errors[0].message).toContain("Invalid YAML");
  });

  it("rejects unknown plan version", () => {
    const errors = validatePlan(VALID_PLAN.replace("version: 1", "version: 2"));
    expect(errors.some((e) => e.path === "version")).toBe(true);
  });

  it("rejects missing required top-level fields", () => {
    const errors = validatePlan(`
version: 1
status: in_progress
current_task: null
tasks:
  - id: T1
    title: t
    status: pending
    depends_on: []
`);
    const paths = errors.map((e) => e.path);
    expect(paths).toContain("change_id");
    expect(paths).toContain("title");
    expect(paths).toContain("created_at");
    expect(paths).toContain("updated_at");
  });

  it("rejects invalid plan status", () => {
    const errors = validatePlan(VALID_PLAN.replace("status: in_progress", "status: pending"));
    expect(errors.some((e) => e.path === "status")).toBe(true);
  });

  it("rejects invalid task status", () => {
    const errors = validatePlan(
      VALID_PLAN.replace("status: in_progress\n    depends_on: [T1]\n    skill_hint: mvt-implement\n    acceptance: [\"POST /refresh 返回新 token\"]", "status: bogus\n    depends_on: [T1]\n    skill_hint: mvt-implement\n    acceptance: [\"POST /refresh 返回新 token\"]"),
    );
    expect(errors.some((e) => e.path.includes("status"))).toBe(true);
  });

  it("rejects duplicate task ids", () => {
    const dup = VALID_PLAN.replace(
      "  - id: T4\n    title: \"权限中间件\"",
      "  - id: T1\n    title: \"权限中间件\"",
    );
    const errors = validatePlan(dup);
    expect(errors.some((e) => e.message.includes("Duplicate task id"))).toBe(true);
  });

  it("rejects unknown depends_on reference", () => {
    const broken = VALID_PLAN.replace("depends_on: [T2]", "depends_on: [T999]");
    const errors = validatePlan(broken);
    expect(errors.some((e) => e.message.includes('Unknown task id "T999"'))).toBe(true);
  });

  it("detects dependency cycles", () => {
    const cyclic = `
version: 1
change_id: c
title: t
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
status: in_progress
current_task: A
tasks:
  - id: A
    title: a
    status: in_progress
    depends_on: [B]
  - id: B
    title: b
    status: pending
    depends_on: [C]
  - id: C
    title: c
    status: pending
    depends_on: [A]
`;
    const errors = validatePlan(cyclic);
    expect(errors.some((e) => e.message.includes("cycle"))).toBe(true);
  });

  it("rejects current_task referencing a done task", () => {
    const broken = VALID_PLAN.replace("current_task: T3", "current_task: T1");
    const errors = validatePlan(broken);
    expect(
      errors.some(
        (e) => e.path === "current_task" && e.message.includes("status"),
      ),
    ).toBe(true);
  });

  it("rejects current_task as string when status is done", () => {
    const broken = VALID_PLAN.replace("status: in_progress", "status: done");
    const errors = validatePlan(broken);
    expect(
      errors.some(
        (e) =>
          e.path === "current_task" &&
          e.message.includes("must be null"),
      ),
    ).toBe(true);
  });

  it("accepts plan with status done and current_task null", () => {
    const finished = `
version: 1
change_id: c
title: t
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-02T00:00:00Z"
status: done
current_task: null
tasks:
  - id: T1
    title: t1
    status: done
    depends_on: []
`;
    const errors = validatePlan(finished);
    expect(errors).toHaveLength(0);
  });

  it("rejects empty tasks array", () => {
    const empty = `
version: 1
change_id: c
title: t
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
status: in_progress
current_task: null
tasks: []
`;
    const errors = validatePlan(empty);
    expect(errors.some((e) => e.message.includes("at least one task"))).toBe(true);
  });

  it("rejects task missing depends_on (must be explicit array)", () => {
    const missing = `
version: 1
change_id: c
title: t
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
status: in_progress
current_task: T1
tasks:
  - id: T1
    title: t1
    status: in_progress
`;
    const errors = validatePlan(missing);
    expect(errors.some((e) => e.path.endsWith(".depends_on"))).toBe(true);
  });
});

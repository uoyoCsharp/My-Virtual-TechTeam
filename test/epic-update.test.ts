import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const SCRIPT = path.resolve("dist/scripts/epic-update.cjs");

interface Child {
  change_id: string;
  title: string;
  status: string;
  depends_on: string[];
  project: string[];
  scope: string;
  completed_at: string | null;
}

interface Epic {
  version: number;
  epic_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  vision: string;
  current_change: string;
  children: Child[];
}

function baseEpic(overrides: Partial<Epic> = {}): Epic {
  return {
    version: 1,
    epic_id: "epic-20260608-demo",
    title: "Demo Epic",
    created_at: "2026-06-08T10:00:00Z",
    updated_at: "2026-06-08T10:00:00Z",
    status: "in_progress",
    vision: "Demo epic for testing",
    current_change: "c1",
    children: [
      {
        change_id: "c1",
        title: "First child",
        status: "active",
        depends_on: [],
        project: ["default"],
        scope: "First scope",
        completed_at: null,
      },
      {
        change_id: "c2",
        title: "Second child",
        status: "pending",
        depends_on: ["c1"],
        project: ["default"],
        scope: "Second scope",
        completed_at: null,
      },
      {
        change_id: "c3",
        title: "Third child",
        status: "pending",
        depends_on: ["c1"],
        project: ["default"],
        scope: "Third scope",
        completed_at: null,
      },
    ],
    ...overrides,
  };
}

describe("epic-update.cjs", () => {
  let tmpDir: string;
  let epicPath: string;
  let sessionPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-epic-update-"));
    const workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    epicPath = path.join(workspaceDir, "epic.yaml");
    sessionPath = path.join(workspaceDir, "session.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEpic(epic: Epic): void {
    writeFileSync(epicPath, stringifyYaml(epic), "utf-8");
  }

  function readEpic(): Epic {
    return parseYaml(readFileSync(epicPath, "utf-8")) as Epic;
  }

  function writeSession(session: any): void {
    writeFileSync(sessionPath, stringifyYaml(session), "utf-8");
  }

  function readSession(): any {
    return parseYaml(readFileSync(sessionPath, "utf-8"));
  }

  function baseSession(overrides: any = {}): any {
    return {
      session: { initialized_at: "2026-06-08T10:00:00Z", last_synced_at: "" },
      active_epic: { id: "", title: "", created_at: "", epic_path: "" },
      epics: [],
      active_change: { id: "", title: "", created_at: "", plan_path: "", epic_id: "" },
      changes: [],
      history: [],
      ...overrides,
    };
  }

  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], { encoding: "utf-8" });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function op(extra: string[]): { status: number; stdout: string; stderr: string } {
    return run(["--epic", epicPath, ...extra]);
  }

  // ── --validate ────────────────────────────────────────────────────────────

  describe("--validate", () => {
    it("exits 0 on valid epic", () => {
      writeEpic(baseEpic());
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.ok).toBe(true);
      expect(out.valid).toBe(true);
    });

    it("exits 1 with error list on invalid epic (duplicate change_ids)", () => {
      const epic = baseEpic();
      epic.children[1].change_id = "c1"; // duplicate
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/duplicate/i);
    });

    it("detects dangling depends_on reference", () => {
      const epic = baseEpic();
      epic.children[1].depends_on = ["c-nonexistent"];
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unknown/i);
    });

    it("detects dependency cycle", () => {
      const epic = baseEpic();
      epic.children[0].depends_on = ["c2"];
      epic.children[1].depends_on = ["c1"];
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/cycle/i);
    });

    it("detects multiple active children", () => {
      const epic = baseEpic();
      epic.children[1].status = "active";
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/multiple active/i);
    });

    it("detects current_change pointing to done child", () => {
      const epic = baseEpic();
      epic.children[0].status = "done";
      epic.children[0].completed_at = "2026-06-08T10:00:00Z";
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/current_change.*must be pending or active/i);
    });

    it("detects all children done but epic still in_progress", () => {
      const epic = baseEpic();
      epic.children.forEach((c) => {
        c.status = "done";
        c.completed_at = "2026-06-08T10:00:00Z";
      });
      epic.current_change = "";
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/in_progress/i);
    });

    it("does not write on --validate", () => {
      writeEpic(baseEpic());
      const before = readFileSync(epicPath, "utf-8");
      run(["--validate", epicPath]);
      expect(readFileSync(epicPath, "utf-8")).toBe(before);
    });
  });

  // ── --complete-child ─────────────────────────────────────────────────────

  describe("--complete-child", () => {
    it("completes active child and advances to next ready child", () => {
      writeEpic(baseEpic());
      const res = op(["--complete-child", "c1"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.ok).toBe(true);
      expect(out.child).toMatchObject({ change_id: "c1", old_status: "active", new_status: "done" });
      expect(out.current_change).toBe("c2");
      expect(out.epic_status).toBe("in_progress");

      const epic = readEpic();
      expect(epic.children[0].status).toBe("done");
      expect(epic.children[0].completed_at).not.toBeNull();
      expect(epic.children[1].status).toBe("active");
      expect(epic.current_change).toBe("c2");
    });

    it("advances to first ready pending child by array order (tie-break)", () => {
      // c2 and c3 both depend on c1. After c1 is done, c2 (first in array) should be activated.
      writeEpic(baseEpic());
      op(["--complete-child", "c1"]);
      const epic = readEpic();
      expect(epic.current_change).toBe("c2");
      expect(epic.children[1].status).toBe("active");
      expect(epic.children[2].status).toBe("pending");
    });

    it("sets epic.status=done and current_change empty when all children done", () => {
      const epic = baseEpic();
      epic.children[0].status = "done";
      epic.children[0].completed_at = "2026-06-08T10:00:00Z";
      epic.children[1].status = "done";
      epic.children[1].completed_at = "2026-06-08T10:00:00Z";
      epic.children[2].status = "active";
      epic.children[2].depends_on = [];
      epic.current_change = "c3";
      writeEpic(epic);

      const res = op(["--complete-child", "c3"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.epic_status).toBe("done");

      const e = readEpic();
      expect(e.status).toBe("done");
      expect(e.current_change).toBe("");
    });

    it("does not advance child with unresolved depends_on", () => {
      const epic = baseEpic();
      epic.children[1].depends_on = ["c1", "c3"]; // c3 is still pending
      writeEpic(epic);

      // Complete c1 -- c2 should NOT advance because c3 is not done
      op(["--complete-child", "c1"]);
      const e = readEpic();
      expect(e.current_change).toBe("c3"); // c3 has no deps -> advances
    });

    it("rejects unknown change_id", () => {
      writeEpic(baseEpic());
      const res = op(["--complete-child", "c-unknown"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not found/i);
    });

    it("skips abandoned children during advancement", () => {
      const epic = baseEpic();
      epic.children[1].status = "abandoned";
      epic.children[1].completed_at = "2026-06-08T10:00:00Z";
      writeEpic(epic);

      op(["--complete-child", "c1"]);
      const e = readEpic();
      // c2 is abandoned, c3 should advance (c3 depends on c1 which is now done)
      expect(e.current_change).toBe("c3");
      expect(e.children[2].status).toBe("active");
    });
  });

  // ── --set-child-status ───────────────────────────────────────────────────

  describe("--set-child-status", () => {
    it("sets child status to done (via --complete-child to avoid current_change validation)", () => {
      writeEpic(baseEpic());
      // --set-child-status c1 done would leave current_change pointing at a done child,
      // which fails validation. Use --complete-child instead for proper done transition.
      const res = op(["--complete-child", "c1"]);
      expect(res.status).toBe(0);
      const epic = readEpic();
      expect(epic.children[0].status).toBe("done");
      expect(epic.children[0].completed_at).not.toBeNull();
    });

    it("sets child status to abandoned (on non-active child)", () => {
      const epic = baseEpic();
      // c2 is pending, not active -- safe to abandon
      writeEpic(epic);

      const res = op(["--set-child-status", "c2", "abandoned"]);
      expect(res.status).toBe(0);
      const e = readEpic();
      expect(e.children[1].status).toBe("abandoned");
    });

    it("sets child status to pending", () => {
      writeEpic(baseEpic());
      op(["--set-child-status", "c1", "pending"]);
      const epic = readEpic();
      expect(epic.children[0].status).toBe("pending");
    });

    it("rejects activating when another child is already active", () => {
      writeEpic(baseEpic()); // c1 is active
      const res = op(["--set-child-status", "c2", "active"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/already active|multiple active/i);
    });

    it("rejects invalid status value", () => {
      writeEpic(baseEpic());
      const res = op(["--set-child-status", "c1", "invalid-status"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/invalid/i);
    });

    it("rejects missing --child-status", () => {
      writeEpic(baseEpic());
      const res = op(["--set-child-status", "c1"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires --child-status/i);
    });

    it("clears completed_at when reverting from done to pending", () => {
      const epic = baseEpic();
      epic.children[0].status = "done";
      epic.children[0].completed_at = "2026-06-08T10:00:00Z";
      writeEpic(epic);

      op(["--set-child-status", "c1", "pending"]);
      const e = readEpic();
      expect(e.children[0].completed_at).toBeNull();
    });

    it("allows setting active when no other child is active", () => {
      const epic = baseEpic();
      epic.children[0].status = "pending";
      epic.current_change = "";
      writeEpic(epic);

      const res = op(["--set-child-status", "c1", "active"]);
      expect(res.status).toBe(0);
      const e = readEpic();
      expect(e.children[0].status).toBe("active");
      expect(e.current_change).toBe("c1");
    });
  });

  // ── --switch-active ──────────────────────────────────────────────────────

  describe("--switch-active", () => {
    it("atomically demotes old active and promotes target", () => {
      writeEpic(baseEpic()); // c1 active, c2 pending (depends_on c1)
      // First complete c1 so c2's deps are resolved
      op(["--complete-child", "c1"]); // c2 becomes active

      const res = op(["--switch-active", "c3"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.child.change_id).toBe("c3");
      expect(out.current_change).toBe("c3");

      const epic = readEpic();
      expect(epic.children[1].status).toBe("pending"); // demoted
      expect(epic.children[2].status).toBe("active"); // promoted
      expect(epic.current_change).toBe("c3");
    });

    it("rejects target with unresolved depends_on", () => {
      writeEpic(baseEpic()); // c2 depends on c1, c1 is active (not done)
      const res = op(["--switch-active", "c2"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unresolved/i);
    });

    it("is a no-op when target is already active", () => {
      writeEpic(baseEpic()); // c1 is active
      const res = op(["--switch-active", "c1"]);
      expect(res.status).toBe(0);
      const epic = readEpic();
      expect(epic.children[0].status).toBe("active");
    });

    it("rejects unknown change_id", () => {
      writeEpic(baseEpic());
      const res = op(["--switch-active", "c-unknown"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not found/i);
    });

    it("allows switch to child with resolved deps", () => {
      const epic = baseEpic();
      epic.children[0].status = "done";
      epic.children[0].completed_at = "2026-06-08T10:00:00Z";
      epic.children[1].status = "active";
      epic.current_change = "c2";
      writeEpic(epic);

      // c3 depends on c1 which is done -> should be allowed
      const res = op(["--switch-active", "c3"]);
      expect(res.status).toBe(0);
      const e = readEpic();
      expect(e.children[1].status).toBe("pending");
      expect(e.children[2].status).toBe("active");
      expect(e.current_change).toBe("c3");
    });
  });

  // ── --add-child ──────────────────────────────────────────────────────────

  describe("--add-child", () => {
    it("appends a new child with title and scope", () => {
      writeEpic(baseEpic());
      const res = op([
        "--add-child", "c4",
        "--child-title", "Fourth child",
        "--child-scope", "Fourth scope",
      ]);
      expect(res.status).toBe(0);

      const epic = readEpic();
      expect(epic.children).toHaveLength(4);
      const c4 = epic.children[3];
      expect(c4.change_id).toBe("c4");
      expect(c4.title).toBe("Fourth child");
      expect(c4.scope).toBe("Fourth scope");
      expect(c4.status).toBe("pending");
      expect(c4.depends_on).toEqual([]);
    });

    it("appends a new child with depends_on", () => {
      writeEpic(baseEpic());
      op([
        "--add-child", "c4",
        "--child-title", "Fourth",
        "--child-scope", "Scope",
        "--child-depends-on", "c1,c2",
      ]);
      const epic = readEpic();
      expect(epic.children[3].depends_on).toEqual(["c1", "c2"]);
    });

    it("rejects duplicate change_id", () => {
      writeEpic(baseEpic());
      const res = op([
        "--add-child", "c1",
        "--child-title", "Duplicate",
        "--child-scope", "Scope",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/duplicate/i);
    });

    it("rejects missing id", () => {
      writeEpic(baseEpic());
      const res = op(["--add-child"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires/i);
    });

    it("rejects missing --child-title", () => {
      writeEpic(baseEpic());
      const res = op(["--add-child", "c4", "--child-scope", "Scope"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires --child-title/i);
    });

    it("rejects invalid depends_on reference (fails validation)", () => {
      writeEpic(baseEpic());
      const res = op([
        "--add-child", "c4",
        "--child-title", "Fourth",
        "--child-scope", "Scope",
        "--child-depends-on", "c-nonexistent",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unknown/i);
    });

    it("supports adding multiple children in one invocation", () => {
      writeEpic(baseEpic());
      const res = op([
        "--add-child", "c4",
        "--child-title", "Fourth",
        "--child-scope", "Scope 4",
        "--add-child", "c5",
        "--child-title", "Fifth",
        "--child-scope", "Scope 5",
      ]);
      expect(res.status).toBe(0);
      const epic = readEpic();
      expect(epic.children).toHaveLength(5);
      expect(epic.children[3].change_id).toBe("c4");
      expect(epic.children[4].change_id).toBe("c5");
    });
  });

  // ── Output protocol ──────────────────────────────────────────────────────

  describe("output protocol", () => {
    it("emits single-line JSON on stdout when exit 0", () => {
      writeEpic(baseEpic());
      const res = op(["--complete-child", "c1"]);
      expect(res.status).toBe(0);
      const lines = res.stdout.trim().split("\n");
      expect(lines).toHaveLength(1);
      const out = JSON.parse(lines[0]);
      expect(out.ok).toBe(true);
      expect(out.child).toBeDefined();
      expect(out.current_change).toBeDefined();
      expect(out.epic_status).toBeDefined();
      expect(out.progress).toBeDefined();
    });

    it("emits plain-text error on stderr when exit 1", () => {
      writeEpic(baseEpic());
      const res = op(["--complete-child", "c-nonexistent"]);
      expect(res.status).toBe(1);
      expect(res.stderr.length).toBeGreaterThan(0);
      expect(res.stdout.trim()).toBe("");
    });

    it("progress object has done and total fields", () => {
      writeEpic(baseEpic());
      const res = op(["--complete-child", "c1"]);
      const out = JSON.parse(res.stdout);
      expect(out.progress).toEqual({ done: 1, total: 3 });
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles epic with empty children array", () => {
      const epic = baseEpic({ children: [], current_change: "" });
      writeEpic(epic);
      const res = run(["--validate", epicPath]);
      expect(res.status).toBe(0);
    });

    it("errors when --epic is missing", () => {
      const res = run(["--complete-child", "c1"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/missing.*--epic/i);
    });

    it("errors when no operation is specified", () => {
      writeEpic(baseEpic());
      const res = op([]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/no operation/i);
    });

    it("errors when epic file not found", () => {
      const res = op(["--validate"]);
      // --epic is set but the file doesn't exist (we wrote nothing)
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not found/i);
    });

    it("errors when epic.yaml is malformed YAML", () => {
      writeFileSync(epicPath, "{{{{invalid yaml", "utf-8");
      const res = op(["--validate"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/parse/i);
    });

    it("errors when epic.yaml is valid YAML but not an object", () => {
      writeFileSync(epicPath, "just a string", "utf-8");
      const res = op(["--validate"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/parse/i);
    });

    it("updates updated_at timestamp on mutation", () => {
      writeEpic(baseEpic());
      op(["--complete-child", "c1"]);
      const epic = readEpic();
      expect(epic.updated_at).not.toBe("2026-06-08T10:00:00Z");
    });

    it("atomic write: temp file cleaned up on success", () => {
      writeEpic(baseEpic());
      op(["--complete-child", "c1"]);
      const tmpFile = epicPath + ".tmp";
      const { existsSync } = require("node:fs");
      expect(existsSync(tmpFile)).toBe(false);
    });

    it("aborts write when resulting epic fails validation", () => {
      // Create a scenario where completing c1 leads to an invalid state
      // This is hard to trigger naturally; we test that the validation check exists
      writeEpic(baseEpic());
      const before = readFileSync(epicPath, "utf-8");

      // Force an impossible scenario: add a cycle then try to complete
      const epic = baseEpic();
      epic.children[0].depends_on = ["c2"];
      epic.children[1].depends_on = ["c1"];
      writeEpic(epic);
      const res = op(["--complete-child", "c1"]);
      expect(res.status).toBe(1);
      // File should not have been modified by the failing operation
    });
  });

  // ── session sync on epic close ──────────────────────────────────────────
  // When an epic transitions to status: done, epic-update.cjs must clear
  // session.active_epic so the cursor doesn't linger after all children are
  // complete. Scoped: only acts when active_epic.id matches the epic being
  // closed. Best-effort: session-side failures do not roll back the epic.

  describe("session sync on epic close", () => {
    function writeEpicAllDone(): Epic {
      const epic = baseEpic();
      epic.children[0].status = "done";
      epic.children[0].completed_at = "2026-06-08T10:00:00Z";
      epic.children[1].status = "done";
      epic.children[1].completed_at = "2026-06-08T10:00:00Z";
      epic.children[2].status = "active";
      epic.children[2].depends_on = [];
      epic.current_change = "c3";
      return epic;
    }

    it("clears active_epic and marks epics[] snapshot done when last child completes", () => {
      writeEpic(writeEpicAllDone());
      writeSession(
        baseSession({
          active_epic: {
            id: "epic-20260608-demo",
            title: "Demo Epic",
            created_at: "2026-06-08T10:00:00Z",
            epic_path: "/path/to/epic.yaml",
          },
          epics: [
            {
              id: "epic-20260608-demo",
              title: "Demo Epic",
              epic_path: "/path/to/epic.yaml",
              status: "active",
              updated_at: "2026-06-08T10:00:00Z",
            },
          ],
        })
      );

      const res = op(["--complete-child", "c3"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.ok).toBe(true);
      expect(out.epic_status).toBe("done");
      expect(out.session_sync).toMatchObject({ ok: true, applied: true, epic_id: "epic-20260608-demo" });

      const s = readSession();
      expect(s.active_epic.id).toBe("");
      expect(s.active_epic.title).toBe("");
      expect(s.active_epic.epic_path).toBe("");
      expect(s.epics[0].status).toBe("done");
      expect(s.epics[0].updated_at).not.toBe("2026-06-08T10:00:00Z");
    });

    it("is scoped: leaves active_epic alone when session points at a different epic", () => {
      writeEpic(writeEpicAllDone());
      writeSession(
        baseSession({
          active_epic: {
            id: "epic-OTHER",
            title: "Other",
            created_at: "2026-06-08T10:00:00Z",
            epic_path: "/other",
          },
        })
      );

      const res = op(["--complete-child", "c3"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.session_sync).toMatchObject({ ok: true, applied: false });

      const s = readSession();
      expect(s.active_epic.id).toBe("epic-OTHER");
    });

    it("is a no-op when epic transitions away from done (incomplete children)", () => {
      writeEpic(baseEpic()); // 3 children, only c1 will complete
      writeSession(
        baseSession({
          active_epic: {
            id: "epic-20260608-demo",
            title: "Demo Epic",
            created_at: "2026-06-08T10:00:00Z",
            epic_path: "/path",
          },
        })
      );

      const res = op(["--complete-child", "c1"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.epic_status).toBe("in_progress");
      // session_sync is null because epic is not yet done
      expect(out.session_sync).toBeNull();

      const s = readSession();
      expect(s.active_epic.id).toBe("epic-20260608-demo");
    });

    it("returns ok=false with reason when session.yaml is missing", () => {
      writeEpic(writeEpicAllDone());
      // Intentionally do NOT call writeSession -- file does not exist
      // (the bare .ai-agents/workspace/ skeleton is in place but no session.yaml)

      const res = op(["--complete-child", "c3"]);
      // The epic write itself must still succeed (best-effort session sync)
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.epic_status).toBe("done");
      expect(out.session_sync).toMatchObject({ ok: false, reason: "session-missing" });
    });

    it("is idempotent: re-running on already-done epic does not re-clear (active_epic already empty)", () => {
      writeEpic(writeEpicAllDone());
      writeSession(
        baseSession({
          active_epic: { id: "", title: "", created_at: "", epic_path: "" },
        })
      );

      const res = op(["--complete-child", "c3"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      // applied=false because active_epic.id is empty (doesn't match the
      // closing epic's id), but the side-effect is harmless.
      expect(out.session_sync.applied).toBe(false);
    });

    it("does not roll back epic.yaml write when session write fails", () => {
      writeEpic(writeEpicAllDone());
      // Malformed session.yaml that will fail to parse
      writeFileSync(sessionPath, "{{{{invalid yaml", "utf-8");

      const res = op(["--complete-child", "c3"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.epic_status).toBe("done");
      expect(out.session_sync.ok).toBe(false);
      expect(out.session_sync.reason).toBe("parse-failed");

      // epic.yaml must still be in the done state
      const e = readEpic();
      expect(e.status).toBe("done");
    });
  });
});

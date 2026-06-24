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

const SCRIPT = path.resolve("dist/scripts/session-update.cjs");

interface ActiveEpic {
  id: string;
  title: string;
  created_at: string;
  epic_path: string;
}

interface ActiveChange {
  id: string;
  title: string;
  created_at: string;
  plan_path: string;
  epic_id: string;
}

interface Session {
  session: {
    initialized_at: string;
    last_synced_at: string;
  };
  active_epic: ActiveEpic;
  epics: Array<{
    id: string;
    title: string;
    epic_path: string;
    status: string;
    updated_at: string;
  }>;
  active_change: ActiveChange;
  changes: Array<{
    id: string;
    title: string;
    plan_path: string;
    status: string;
    updated_at: string;
    epic_id: string;
  }>;
  history: Array<{
    skill: string;
    completed_at: string;
    summary: string;
    change_id: string;
  }>;
}

function baseSession(overrides: Partial<Session> = {}): Session {
  return {
    session: {
      initialized_at: "2026-06-05T08:00:00Z",
      last_synced_at: "2026-06-08T02:00:00Z",
    },
    active_epic: {
      id: "",
      title: "",
      created_at: "",
      epic_path: "",
    },
    epics: [],
    active_change: {
      id: "",
      title: "",
      created_at: "",
      plan_path: "",
      epic_id: "",
    },
    changes: [],
    history: [],
    ...overrides,
  };
}

describe("session-update.cjs (epic flags)", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-session-epic-"));
    workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    sessionPath = path.join(workspaceDir, "session.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSession(session: Session): void {
    writeFileSync(sessionPath, stringifyYaml(session), "utf-8");
  }

  function readSession(): any {
    return parseYaml(readFileSync(sessionPath, "utf-8"));
  }

  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], {
      encoding: "utf-8",
      cwd: tmpDir,
    });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function update(extra: string[]): { status: number; stdout: string; stderr: string } {
    return run(["--skill", "test", "--summary", "test", ...extra]);
  }

  // ── --new-epic ───────────────────────────────────────────────────────────

  describe("--new-epic", () => {
    it("creates active_epic with id and title", () => {
      writeSession(baseSession());
      const res = update([
        "--new-epic", "My Epic",
        "--epic-id", "epic-20260608-my-epic",
      ]);
      expect(res.status).toBe(0);

      const s = readSession();
      expect(s.active_epic.id).toBe("epic-20260608-my-epic");
      expect(s.active_epic.title).toBe("My Epic");
      expect(s.active_epic.created_at).not.toBe("");
    });

    it("requires --epic-id", () => {
      writeSession(baseSession());
      const res = update([
        "--new-epic", "My Epic",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/--epic-id/);
    });

    it("snapshots old active_epic into epics[]", () => {
      const session = baseSession();
      session.active_epic = {
        id: "epic-old",
        title: "Old Epic",
        created_at: "2026-06-07T10:00:00Z",
        epic_path: ".ai-agents/workspace/artifacts/epic-old/epic.yaml",
      };
      session.epics = [];
      writeSession(session);

      update([
        "--new-epic", "New Epic",
        "--epic-id", "epic-20260608-new",
      ]);

      const s = readSession();
      expect(s.epics).toHaveLength(1);
      expect(s.epics[0].id).toBe("epic-old");
      expect(s.active_epic.id).toBe("epic-20260608-new");
    });

    it("does not snapshot when active_epic is empty", () => {
      writeSession(baseSession());
      update([
        "--new-epic", "First Epic",
        "--epic-id", "epic-20260608-first",
      ]);

      const s = readSession();
      expect(s.epics).toHaveLength(0);
    });
  });

  // ── --set-epic-path ──────────────────────────────────────────────────────

  describe("--set-epic-path", () => {
    it("sets active_epic.epic_path", () => {
      const session = baseSession();
      session.active_epic = {
        id: "epic-20260608-demo",
        title: "Demo",
        created_at: "2026-06-08T10:00:00Z",
        epic_path: "",
      };
      writeSession(session);

      update([
        "--set-epic-path", ".ai-agents/workspace/artifacts/epic-20260608-demo/epic.yaml",
      ]);

      const s = readSession();
      expect(s.active_epic.epic_path).toBe(".ai-agents/workspace/artifacts/epic-20260608-demo/epic.yaml");
    });

    it("exits 1 when no active epic", () => {
      writeSession(baseSession());
      const res = update([
        "--set-epic-path", "/some/path",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires an active epic/i);
    });
  });

  // ── --set-epic-status ────────────────────────────────────────────────────

  describe("--set-epic-status", () => {
    it("updates matching epics[] entry status", () => {
      const session = baseSession();
      session.active_epic = {
        id: "epic-20260608-demo",
        title: "Demo",
        created_at: "2026-06-08T10:00:00Z",
        epic_path: "/path",
      };
      session.epics = [
        { id: "epic-20260608-demo", title: "Demo", epic_path: "/path", status: "active", updated_at: "2026-06-08T10:00:00Z" },
      ];
      writeSession(session);

      update([
        "--set-epic-status", "done",
      ]);

      const s = readSession();
      expect(s.epics[0].status).toBe("done");
      expect(s.epics[0].updated_at).not.toBe("2026-06-08T10:00:00Z");
    });

    it("exits 1 when no active epic", () => {
      writeSession(baseSession());
      const res = update([
        "--set-epic-status", "done",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires an active epic/i);
    });
  });

  // ── --close-epic ─────────────────────────────────────────────────────────

  describe("--close-epic", () => {
    it("sets matching epics[] entry to done and clears active_epic", () => {
      const session = baseSession();
      session.active_epic = {
        id: "epic-20260608-demo",
        title: "Demo",
        created_at: "2026-06-08T10:00:00Z",
        epic_path: "/path",
      };
      session.epics = [
        { id: "epic-20260608-demo", title: "Demo", epic_path: "/path", status: "active", updated_at: "2026-06-08T10:00:00Z" },
      ];
      writeSession(session);

      update([
        "--close-epic",
      ]);

      const s = readSession();
      expect(s.epics[0].status).toBe("done");
      expect(s.active_epic.id).toBe("");
      expect(s.active_epic.title).toBe("");
      expect(s.active_epic.epic_path).toBe("");
    });
  });

  // ── Combo validation ─────────────────────────────────────────────────────

  describe("combo validation", () => {
    it("rejects --close-epic with --new-epic", () => {
      writeSession(baseSession());
      const res = update([
        "--new-epic", "New",
        "--epic-id", "epic-20260608-new",
        "--close-epic",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/mutually exclusive/i);
    });

    it("rejects --epic-id without --new-change or --new-epic", () => {
      writeSession(baseSession());
      const res = update([
        "--epic-id", "epic-20260608-some",
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires --new-change/i);
    });
  });

  // ── --new-change --epic-id ───────────────────────────────────────────────

  describe("--new-change --epic-id", () => {
    it("writes epic_id to active_change", () => {
      writeSession(baseSession());
      update([
        "--new-change", "Sub-change",
        "--change-id", "20260608-sub",
        "--epic-id", "epic-20260608-demo",
      ]);

      const s = readSession();
      expect(s.active_change.epic_id).toBe("epic-20260608-demo");
    });

    it("writes epic_id to history entry", () => {
      writeSession(baseSession());
      update([
        "--new-change", "Sub-change",
        "--change-id", "20260608-sub",
        "--epic-id", "epic-20260608-demo",
      ]);

      const s = readSession();
      const entry = s.history.find((h: any) => h.change_id === "20260608-sub");
      expect(entry).toBeDefined();
    });

    it("preserves epic_id in changes[] snapshot on --close-change", () => {
      const session = baseSession();
      session.active_change = {
        id: "20260608-sub",
        title: "Sub-change",
        created_at: "2026-06-08T10:00:00Z",
        plan_path: "/path/plan.yaml",
        epic_id: "epic-20260608-demo",
      };
      writeSession(session);

      update([
        "--close-change",
      ]);

      const s = readSession();
      const closed = s.changes.find((c: any) => c.id === "20260608-sub");
      expect(closed).toBeDefined();
      expect(closed.epic_id).toBe("epic-20260608-demo");
    });

    it("resets epic_id to empty on active_change after --close-change", () => {
      const session = baseSession();
      session.active_change = {
        id: "20260608-sub",
        title: "Sub-change",
        created_at: "2026-06-08T10:00:00Z",
        plan_path: "/path/plan.yaml",
        epic_id: "epic-20260608-demo",
      };
      writeSession(session);

      update([
        "--close-change",
      ]);

      const s = readSession();
      expect(s.active_change.epic_id).toBe("");
    });

    it("preserves existing epic_id when --new-change omits --epic-id", () => {
      const session = baseSession();
      session.active_change = {
        id: "20260608-sub",
        title: "Sub-change",
        created_at: "2026-06-08T10:00:00Z",
        plan_path: "",
        epic_id: "epic-20260608-demo",
      };
      writeSession(session);

      update([
        "--new-change", "Sub-change",
        "--change-id", "20260608-sub",
      ]);

      const s = readSession();
      expect(s.active_change.epic_id).toBe("epic-20260608-demo");
    });

    it("preserves created_at when --new-change re-invoked on same change", () => {
      const session = baseSession();
      const originalCreatedAt = "2026-06-08T10:00:00Z";
      session.active_change = {
        id: "20260608-sub",
        title: "Sub-change",
        created_at: originalCreatedAt,
        plan_path: "/path/plan.yaml",
        epic_id: "epic-20260608-demo",
      };
      writeSession(session);

      update([
        "--new-change", "Sub-change",
        "--change-id", "20260608-sub",
      ]);

      const s = readSession();
      expect(s.active_change.created_at).toBe(originalCreatedAt);
      expect(s.active_change.plan_path).toBe("/path/plan.yaml");
    });

    it("resets created_at and plan_path when switching to a different change", () => {
      const session = baseSession();
      session.active_change = {
        id: "20260608-old",
        title: "Old Change",
        created_at: "2026-06-08T10:00:00Z",
        plan_path: "/path/old/plan.yaml",
        epic_id: "",
      };
      writeSession(session);

      update([
        "--new-change", "New Change",
        "--change-id", "20260608-new",
      ]);

      const s = readSession();
      expect(s.active_change.id).toBe("20260608-new");
      expect(s.active_change.created_at).not.toBe("2026-06-08T10:00:00Z");
      expect(s.active_change.plan_path).toBe("");
      expect(s.active_change.epic_id).toBe("");
    });
  });

  // ── Backward compatibility ────────────────────────────────────────────────

  describe("backward compatibility", () => {
    it("handles old session.yaml without epic fields", () => {
      const oldSession = {
        session: {
          initialized_at: "2026-06-05T08:00:00Z",
          last_synced_at: "2026-06-08T02:00:00Z",
        },
        active_change: {
          id: "",
          title: "",
          created_at: "",
          plan_path: "",
        },
        changes: [],
        history: [],
      };
      writeFileSync(sessionPath, stringifyYaml(oldSession), "utf-8");

      const res = update([
        "--new-change", "Regular change",
        "--change-id", "20260608-regular",
      ]);
      expect(res.status).toBe(0);

      const s = readSession();
      expect(s.active_change.id).toBe("20260608-regular");
    });

    it("handles old session.yaml when adding epic", () => {
      const oldSession = {
        session: {
          initialized_at: "2026-06-05T08:00:00Z",
          last_synced_at: "2026-06-08T02:00:00Z",
        },
        active_change: {
          id: "",
          title: "",
          created_at: "",
          plan_path: "",
        },
        changes: [],
        history: [],
      };
      writeFileSync(sessionPath, stringifyYaml(oldSession), "utf-8");

      const res = update([
        "--new-epic", "My Epic",
        "--epic-id", "epic-20260608-my",
      ]);
      expect(res.status).toBe(0);

      const s = readSession();
      expect(s.active_epic.id).toBe("epic-20260608-my");
    });
  });
});

describe("session-update.cjs (remove-change flag)", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-session-remove-change-"));
    workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    sessionPath = path.join(workspaceDir, "session.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSession(session: Session): void {
    writeFileSync(sessionPath, stringifyYaml(session), "utf-8");
  }

  function readSession(): any {
    return parseYaml(readFileSync(sessionPath, "utf-8"));
  }

  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], {
      encoding: "utf-8",
      cwd: tmpDir,
    });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function update(extra: string[]): { status: number; stdout: string; stderr: string } {
    return run(["--skill", "test", "--summary", "test", ...extra]);
  }

  function sessionWithChanges(): Session {
    return baseSession({
      changes: [
        { id: "20260601-a", title: "A", plan_path: "", status: "done", updated_at: "2026-06-01T10:00:00Z", epic_id: "" },
        { id: "20260601-b", title: "B", plan_path: "", status: "done", updated_at: "2026-06-02T10:00:00Z", epic_id: "" },
        { id: "20260601-c", title: "C", plan_path: "", status: "done", updated_at: "2026-06-03T10:00:00Z", epic_id: "" },
      ],
    });
  }

  it("removes a single matching change-id", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change", "20260601-b"]);
    expect(res.status).toBe(0);
    expect(readSession().changes.map((c: any) => c.id)).toEqual([
      "20260601-a",
      "20260601-c",
    ]);
  });

  it("silently skips unknown change-id and exits 0", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change", "does-not-exist"]);
    expect(res.status).toBe(0);
    expect(readSession().changes).toHaveLength(3);
  });

  it("removes multiple matching ids in one call", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change", "20260601-a,20260601-c"]);
    expect(res.status).toBe(0);
    expect(readSession().changes.map((c: any) => c.id)).toEqual(["20260601-b"]);
  });

  it("removes the matching subset when some ids are unknown", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change", "20260601-a,nope,20260601-c"]);
    expect(res.status).toBe(0);
    expect(readSession().changes.map((c: any) => c.id)).toEqual(["20260601-b"]);
  });

  it("rejects empty value with MISSING_REMOVE_VALUE", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change", ""]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/non-empty value/);
  });

  it("rejects missing value when --remove-change is provided without argument", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/non-empty value/);
  });

  it("warns to stderr when all requested ids are unknown (still exit 0)", () => {
    writeSession(sessionWithChanges());
    const res = update(["--remove-change", "x,y"]);
    expect(res.status).toBe(0);
    expect(res.stderr).toMatch(/not found/);
  });
});

describe("session-update.cjs (remove-epic flag)", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-session-remove-epic-"));
    workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    sessionPath = path.join(workspaceDir, "session.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSession(session: Session): void {
    writeFileSync(sessionPath, stringifyYaml(session), "utf-8");
  }

  function readSession(): any {
    return parseYaml(readFileSync(sessionPath, "utf-8"));
  }

  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], {
      encoding: "utf-8",
      cwd: tmpDir,
    });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function update(extra: string[]): { status: number; stdout: string; stderr: string } {
    return run(["--skill", "test", "--summary", "test", ...extra]);
  }

  function sessionWithEpics(): Session {
    return baseSession({
      epics: [
        { id: "epic-a", title: "A", epic_path: "", status: "done", updated_at: "2026-06-01T10:00:00Z" },
        { id: "epic-b", title: "B", epic_path: "", status: "done", updated_at: "2026-06-02T10:00:00Z" },
      ],
    });
  }

  it("removes a single matching epic-id", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic", "epic-a"]);
    expect(res.status).toBe(0);
    expect(readSession().epics.map((e: any) => e.id)).toEqual(["epic-b"]);
  });

  it("silently skips unknown epic-id and exits 0", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic", "does-not-exist"]);
    expect(res.status).toBe(0);
    expect(readSession().epics).toHaveLength(2);
  });

  it("removes multiple matching ids in one call", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic", "epic-a,epic-b"]);
    expect(res.status).toBe(0);
    expect(readSession().epics).toHaveLength(0);
  });

  it("removes the matching subset when some ids are unknown", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic", "epic-a,nope"]);
    expect(res.status).toBe(0);
    expect(readSession().epics.map((e: any) => e.id)).toEqual(["epic-b"]);
  });

  it("rejects empty value with MISSING_REMOVE_VALUE", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic", "   "]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/non-empty value/);
  });

  it("rejects missing value when --remove-epic is provided without argument", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/non-empty value/);
  });

  it("warns to stderr when all requested ids are unknown (still exit 0)", () => {
    writeSession(sessionWithEpics());
    const res = update(["--remove-epic", "x"]);
    expect(res.status).toBe(0);
    expect(res.stderr).toMatch(/not found/);
  });
});

describe("session-update.cjs (remove flags: active_change isolation)", () => {
  let tmpDir: string;
  let workspaceDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-session-remove-iso-"));
    workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    sessionPath = path.join(workspaceDir, "session.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSession(session: Session): void {
    writeFileSync(sessionPath, stringifyYaml(session), "utf-8");
  }

  function readSession(): any {
    return parseYaml(readFileSync(sessionPath, "utf-8"));
  }

  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], {
      encoding: "utf-8",
      cwd: tmpDir,
    });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function update(extra: string[]): { status: number; stdout: string; stderr: string } {
    return run(["--skill", "test", "--summary", "test", ...extra]);
  }

  it("--remove-change does not touch active_change even when ids match", () => {
    const session = baseSession();
    session.active_change = {
      id: "20260601-active",
      title: "Active",
      created_at: "2026-06-05T10:00:00Z",
      plan_path: "/path/plan.yaml",
      epic_id: "",
    };
    session.changes = [
      { id: "20260601-active", title: "Active", plan_path: "/path/plan.yaml", status: "active", updated_at: "2026-06-05T10:00:00Z", epic_id: "" },
      { id: "20260601-old", title: "Old", plan_path: "", status: "done", updated_at: "2026-06-01T10:00:00Z", epic_id: "" },
    ];
    writeSession(session);

    const res = update(["--remove-change", "20260601-old"]);
    expect(res.status).toBe(0);
    const s = readSession();
    expect(s.active_change.id).toBe("20260601-active");
    expect(s.changes.map((c: any) => c.id)).toEqual(["20260601-active"]);
  });

  it("--close-change + --remove-change compose in one call", () => {
    const session = baseSession();
    session.active_change = {
      id: "20260601-active",
      title: "Active",
      created_at: "2026-06-05T10:00:00Z",
      plan_path: "/path/plan.yaml",
      epic_id: "",
    };
    session.changes = [
      { id: "20260601-active", title: "Active", plan_path: "/path/plan.yaml", status: "active", updated_at: "2026-06-05T10:00:00Z", epic_id: "" },
      { id: "20260601-old", title: "Old", plan_path: "", status: "done", updated_at: "2026-06-01T10:00:00Z", epic_id: "" },
    ];
    writeSession(session);

    const res = update(["--close-change", "--remove-change", "20260601-old"]);
    expect(res.status).toBe(0);
    const s = readSession();
    expect(s.active_change.id).toBe("");
    // After --close-change snapshots active to changes[] (status: done), then
    // --remove-change removes "20260601-old" only. "20260601-active" remains
    // as a done snapshot.
    const ids = s.changes.map((c: any) => c.id);
    expect(ids).toContain("20260601-active");
    expect(ids).not.toContain("20260601-old");
    expect(s.changes.find((c: any) => c.id === "20260601-active").status).toBe("done");
  });
});

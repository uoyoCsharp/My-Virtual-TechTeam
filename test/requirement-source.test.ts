import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const SCRIPT = path.resolve("dist/scripts/requirement-source.cjs");

interface ContextSource {
  id: string;
  kind: "file" | "conversation";
  reference: string;
  fingerprint?: string;
}

interface ContextItem {
  id: string;
  category: string;
  summary: string;
  source_ids: string[];
}

interface Child {
  change_id: string;
  title: string;
  scope: string;
  status: string;
  depends_on: string[];
  context_refs?: string[];
}

interface Epic {
  version: number;
  epic_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  current_change: string;
  children: Child[];
  requirement_context?: {
    captured_at?: string;
    sources: ContextSource[];
    items: ContextItem[];
    global_refs?: string[];
  };
}

function sha256(buffer: Buffer): string {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function baseV2Epic(overrides: Partial<Epic> = {}): Epic {
  return {
    version: 2,
    epic_id: "epic-20260805-demo",
    title: "Demo Epic",
    created_at: "2026-08-05T10:00:00Z",
    updated_at: "2026-08-05T10:00:00Z",
    status: "in_progress",
    current_change: "c1",
    requirement_context: {
      captured_at: "2026-08-05T10:00:00Z",
      sources: [
        { id: "src-001", kind: "file", reference: "requirements/source.md", fingerprint: "" },
        { id: "src-002", kind: "conversation", reference: "conversation" },
      ],
      items: [
        { id: "ctx-001", category: "goal", summary: "Global goal", source_ids: ["src-002"] },
        {
          id: "ctx-002",
          category: "constraint",
          summary: "Child one constraint",
          source_ids: ["src-001"],
        },
        { id: "ctx-003", category: "decision", summary: "Child one decision", source_ids: ["src-002"] },
      ],
      global_refs: ["ctx-001"],
    },
    children: [
      {
        change_id: "c1",
        title: "First",
        scope: "First scope",
        status: "active",
        depends_on: [],
        context_refs: ["ctx-002", "ctx-003"],
      },
      {
        change_id: "c2",
        title: "Second",
        scope: "Second scope",
        status: "pending",
        depends_on: ["c1"],
        context_refs: ["ctx-002"],
      },
    ],
    ...overrides,
  };
}

describe("requirement-source.cjs", () => {
  let tmpDir: string;
  let epicPath: string;
  let sourcePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-req-src-"));
    const workspaceDir = path.join(tmpDir, ".ai-agents", "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    epicPath = path.join(workspaceDir, "epic.yaml");
    sourcePath = path.join(tmpDir, "requirements", "source.md");
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, "requirement line one\nrequirement line two\n", "utf-8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEpic(epic: Epic): void {
    writeFileSync(epicPath, stringifyYaml(epic), "utf-8");
  }

  function run(
    args: string[],
    opts: { cwd?: string } = {}
  ): { status: number; stdout: string; stderr: string } {
    const res = spawnSync("node", [SCRIPT, ...args], {
      encoding: "utf-8",
      cwd: opts.cwd ?? process.cwd(),
    });
    return {
      status: res.status ?? -1,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
    };
  }

  function epicWithMatchingFingerprint(epic: Epic): Epic {
    epic.requirement_context!.sources[0].fingerprint = sha256(readFileSync(sourcePath));
    return epic;
  }

  // ── --fingerprint ────────────────────────────────────────────────────────

  describe("--fingerprint", () => {
    it("returns a workspace-relative reference for a file inside the workspace", () => {
      const res = run(["--fingerprint", sourcePath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.ok).toBe(true);
      expect(out.reference).toBe("requirements/source.md");
      expect(out.reference_base).toBe("workspace");
      expect(out.fingerprint).toBe(sha256(readFileSync(sourcePath)));
      expect(out.size).toBe(readFileSync(sourcePath).length);
    });

    it("returns an absolute reference for a file outside any workspace", () => {
      const outsideDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-req-outside-"));
      try {
        const file = path.join(outsideDir, "notes.txt");
        writeFileSync(file, "outside content", "utf-8");
        const res = run(["--fingerprint", file]);
        expect(res.status).toBe(0);
        const out = JSON.parse(res.stdout);
        expect(out.reference_base).toBe("absolute");
        expect(out.reference).toBe(toPosix(path.resolve(file)));
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it("accepts a relative source path from the process cwd", () => {
      const res = run(["--fingerprint", path.relative(process.cwd(), sourcePath)]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.reference).toBe("requirements/source.md");
    });

    it("exits 1 when the source file is missing", () => {
      const res = run(["--fingerprint", path.join(tmpDir, "nope.md")]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not found/i);
    });

    it("exits 1 when the source is a directory", () => {
      const res = run(["--fingerprint", path.dirname(sourcePath)]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/regular file/i);
    });

    it("does not write anything", () => {
      const before = readFileSync(sourcePath, "utf-8");
      run(["--fingerprint", sourcePath]);
      expect(readFileSync(sourcePath, "utf-8")).toBe(before);
    });
  });

  // ── --verify-epic: legacy and schema ─────────────────────────────────────

  describe("--verify-epic legacy/schema", () => {
    it("returns empty sources with a context_unavailable warning for a v1 epic", () => {
      const epic = baseV2Epic({
        version: 1,
        requirement_context: undefined,
        children: [
          {
            change_id: "c1",
            title: "First",
            scope: "First scope",
            status: "active",
            depends_on: [],
          },
        ],
      });
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.ok).toBe(true);
      expect(out).not.toHaveProperty("legacy");
      expect(out.sources).toEqual([]);
      expect(out.warnings[0].code).toBe("context_unavailable");
    });

    it("treats a missing version without context as legacy", () => {
      const epic = baseV2Epic({ version: 1, requirement_context: undefined });
      delete (epic as any).version;
      epic.children = epic.children.map(({ context_refs: _cr, ...rest }) => rest);
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      expect(JSON.parse(res.stdout).warnings[0].code).toBe("context_unavailable");
    });

    it("rejects an unsupported version", () => {
      writeEpic(baseV2Epic({ version: 3 }));
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unsupported epic version/i);
    });

    it("processes a v1 epic that carries a complete requirement_context normally", () => {
      // Migration-friendly: a v1 epic with a full context is accepted and
      // processed through the normal path (global refs only when children
      // carry no context_refs yet).
      const epic = epicWithMatchingFingerprint(baseV2Epic({ version: 1 }));
      epic.children = epic.children.map(({ context_refs: _cr, ...rest }) => rest);
      writeEpic(epic);
      const res = run(["--effective-context", epicPath, "--child", "c1"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out).not.toHaveProperty("legacy");
      expect(out.warnings).toEqual([]);
      expect(out.context.map((c: any) => c.id)).toEqual(["ctx-001"]);
    });

    it("rejects a v2 epic without requirement_context", () => {
      const epic = baseV2Epic({ requirement_context: undefined });
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/version 2 epic requires requirement_context/i);
    });

    it("rejects a v2 child without context_refs", () => {
      const epic = baseV2Epic();
      epic.children[0].context_refs = undefined;
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires at least one context_refs/i);
    });

    it("rejects duplicate source ids", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.sources[1].id = "src-001";
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/duplicate source id/i);
    });

    it("rejects duplicate item ids", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.items[1].id = "ctx-001";
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/duplicate item id/i);
    });

    it("rejects an item referencing an unknown source", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.items[1].source_ids = ["src-unknown"];
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unknown source/i);
    });

    it("rejects a global_refs entry referencing an unknown item", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.global_refs = ["ctx-unknown"];
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unknown item/i);
    });

    it("rejects a child context_refs entry referencing an unknown item", () => {
      const epic = baseV2Epic();
      epic.children[0].context_refs = ["ctx-unknown"];
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/unknown item/i);
    });

    it("rejects a file source without a fingerprint", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.sources[0].fingerprint = undefined;
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/sha256:<hex> fingerprint/i);
    });

    it("rejects a conversation source that has a fingerprint", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.sources[1].fingerprint = "sha256:" + "a".repeat(64);
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/must not have a fingerprint/i);
    });

    it("rejects a relative reference with .. segments", () => {
      const epic = baseV2Epic();
      epic.requirement_context!.sources[0].reference = "../outside.md";
      writeEpic(epic);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/must not contain "\." or "\.\."/i);
    });

    it("exits 1 on malformed epic YAML", () => {
      writeFileSync(epicPath, "{{{{invalid yaml", "utf-8");
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/parse/i);
    });
  });

  // ── --verify-epic: drift statuses ────────────────────────────────────────

  describe("--verify-epic drift statuses", () => {
    it("reports unchanged for matching files and unchanged for conversation sources", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.sources).toEqual([
        { id: "src-001", status: "unchanged", reference: "requirements/source.md" },
        { id: "src-002", status: "unchanged", reference: "conversation" },
      ]);
      expect(out.warnings).toEqual([]);
    });

    it("reports changed with a source_changed warning but still exits 0", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      writeFileSync(sourcePath, "requirement line one\nCHANGED line\n", "utf-8");
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.sources[0]).toMatchObject({ id: "src-001", status: "changed" });
      expect(out.warnings).toEqual([
        expect.objectContaining({ source_id: "src-001", code: "source_changed" }),
      ]);
    });

    it("reports missing when the source file is deleted", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      rmSync(sourcePath, { force: true });
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.sources[0]).toMatchObject({ id: "src-001", status: "missing" });
      expect(out.warnings[0].code).toBe("source_missing");
    });

    it("reports unverifiable when the source path is a directory", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      rmSync(sourcePath, { force: true });
      mkdirSync(sourcePath);
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.sources[0]).toMatchObject({ id: "src-001", status: "unverifiable" });
      expect(out.warnings[0].code).toBe("source_unverifiable");
    });

    it("detects line-ending drift as a change (raw bytes)", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      writeFileSync(sourcePath, "requirement line one\r\nrequirement line two\r\n", "utf-8");
      const res = run(["--verify-epic", epicPath]);
      expect(res.status).toBe(0);
      expect(JSON.parse(res.stdout).sources[0].status).toBe("changed");
    });

    it("resolves relative references from the workspace root, not the process cwd", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      // Run from the tmp workspace root: relative references must still resolve
      // against the workspace root discovered from the epic path.
      const res = run(["--verify-epic", epicPath], { cwd: tmpDir });
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.sources[0].status).toBe("unchanged");
    });

    it("does not write or modify any file", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      const epicBefore = readFileSync(epicPath, "utf-8");
      const srcBefore = readFileSync(sourcePath, "utf-8");
      run(["--verify-epic", epicPath]);
      expect(readFileSync(epicPath, "utf-8")).toBe(epicBefore);
      expect(readFileSync(sourcePath, "utf-8")).toBe(srcBefore);
    });
  });

  // ── --effective-context ──────────────────────────────────────────────────

  describe("--effective-context", () => {
    it("projects global refs then child refs, deduplicated by first occurrence", () => {
      const epic = epicWithMatchingFingerprint(baseV2Epic());
      // ctx-002 appears in both global and child refs; it must appear once.
      epic.requirement_context!.global_refs = ["ctx-001", "ctx-002"];
      writeEpic(epic);
      const res = run(["--effective-context", epicPath, "--child", "c1"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out.ok).toBe(true);
      expect(out.child).toEqual({
        change_id: "c1",
        title: "First",
        scope: "First scope",
      });
      expect(out.context.map((c: any) => c.id)).toEqual(["ctx-001", "ctx-002", "ctx-003"]);
      expect(out.context[1]).toMatchObject({
        category: "constraint",
        summary: "Child one constraint",
        source_ids: ["src-001"],
      });
    });

    it("preserves source statuses and drift warnings alongside the projection", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      writeFileSync(sourcePath, "changed content\n", "utf-8");
      const res = run(["--effective-context", epicPath, "--child", "c1"]);
      const out = JSON.parse(res.stdout);
      expect(out.sources[0].status).toBe("changed");
      expect(out.warnings[0].code).toBe("source_changed");
      // global_refs [ctx-001] + child refs [ctx-002, ctx-003] = 3 items
      expect(out.context).toHaveLength(3);
    });

    it("returns empty context with a context_unavailable warning for a v1 epic", () => {
      const epic = baseV2Epic({
        version: 1,
        requirement_context: undefined,
        children: [
          {
            change_id: "c1",
            title: "First",
            scope: "First scope",
            status: "active",
            depends_on: [],
          },
        ],
      });
      writeEpic(epic);
      const res = run(["--effective-context", epicPath, "--child", "c1"]);
      expect(res.status).toBe(0);
      const out = JSON.parse(res.stdout);
      expect(out).not.toHaveProperty("legacy");
      expect(out.child.scope).toBe("First scope");
      expect(out.context).toEqual([]);
      expect(out.warnings[0].code).toBe("context_unavailable");
    });

    it("exits 1 for an unknown child", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      const res = run(["--effective-context", epicPath, "--child", "c-unknown"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not found/i);
    });

    it("exits 1 when --child is missing", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      const res = run(["--effective-context", epicPath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires --child/i);
    });

    it("is cwd-independent", () => {
      writeEpic(epicWithMatchingFingerprint(baseV2Epic()));
      const fromRepo = run(["--effective-context", epicPath, "--child", "c2"]);
      const fromTmp = run(["--effective-context", epicPath, "--child", "c2"], { cwd: tmpDir });
      expect(fromTmp.status).toBe(0);
      expect(JSON.parse(fromTmp.stdout)).toEqual(JSON.parse(fromRepo.stdout));
    });
  });

  // ── CLI edge cases ───────────────────────────────────────────────────────

  describe("CLI edge cases", () => {
    it("exits 1 when no operation is specified", () => {
      const res = run([]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/no operation/i);
    });

    it("exits 1 when multiple modes are combined", () => {
      const res = run(["--verify-epic", epicPath, "--fingerprint", sourcePath]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/conflicting modes/i);
    });

    it("exits 1 when --child is used without --effective-context", () => {
      const res = run(["--verify-epic", epicPath, "--child", "c1"]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/requires --effective-context/i);
    });

    it("exits 1 when the epic file does not exist", () => {
      const res = run(["--verify-epic", path.join(tmpDir, "missing.yaml")]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not found/i);
    });

    it("emits plain-text stderr and empty stdout on exit 1", () => {
      const res = run(["--verify-epic", path.join(tmpDir, "missing.yaml")]);
      expect(res.stderr.length).toBeGreaterThan(0);
      expect(res.stdout.trim()).toBe("");
    });
  });
});

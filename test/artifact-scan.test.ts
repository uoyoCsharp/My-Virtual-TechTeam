import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const SCRIPT = path.resolve("dist/scripts/artifact-scan.cjs");

describe("artifact-scan.cjs", () => {
  let tmpDir: string;
  let artifactsDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-artifact-scan-"));
    artifactsDir = path.join(tmpDir, ".ai-agents", "workspace", "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  function write(relativePath: string): void {
    const filePath = path.join(artifactsDir, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "content", "utf-8");
  }

  function scan(mode: string) {
    return spawnSync("node", [SCRIPT, "--mode", mode], { encoding: "utf-8", cwd: tmpDir });
  }

  it("returns sorted immediate live change directories", () => {
    mkdirSync(path.join(artifactsDir, "z-change"));
    mkdirSync(path.join(artifactsDir, "a-change"));
    mkdirSync(path.join(artifactsDir, "_archived", "old-change"), { recursive: true });

    const result = scan("change-dirs");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).entries).toEqual([
      ".ai-agents/workspace/artifacts/a-change",
      ".ai-agents/workspace/artifacts/z-change",
    ]);
  });

  it("returns only immediate live plan files", () => {
    write("b-change/plan.yaml");
    write("a-change/nested/plan.yaml");
    write("_archived/old/plan.yaml");

    const result = scan("plans");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).entries).toEqual([
      ".ai-agents/workspace/artifacts/b-change/plan.yaml",
    ]);
  });

  it("recurses only through live change directories and sorts files", () => {
    write("z-change/z.md");
    write("a-change/nested/a.md");
    write("_archived/old/hidden.md");

    const result = scan("files");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).entries).toEqual([
      ".ai-agents/workspace/artifacts/a-change/nested/a.md",
      ".ai-agents/workspace/artifacts/z-change/z.md",
    ]);
  });

  it("rejects an unknown mode", () => {
    const result = scan("unknown");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/--mode requires/i);
  });
});
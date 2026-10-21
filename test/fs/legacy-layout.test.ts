import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  hasLegacyLayout,
  migrateLegacyLayout,
  rollbackLegacyLayout,
  LegacyLayoutConflictError,
} from "../../src/fs/legacy-layout.js";

describe("legacy layout migration (.ai-agents -> .mvtt)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-layout-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("is a no-op when the project is already on .mvtt", () => {
    expect(hasLegacyLayout(tmpDir)).toBe(false);
    expect(migrateLegacyLayout(tmpDir)).toEqual({ migrated: false });
  });

  it("renames .ai-agents to .mvtt and preserves content", () => {
    mkdirSync(path.join(tmpDir, ".ai-agents/workspace"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, ".ai-agents/workspace/session.yaml"),
      "session: 1\n",
      "utf-8",
    );

    expect(hasLegacyLayout(tmpDir)).toBe(true);
    expect(migrateLegacyLayout(tmpDir)).toEqual({ migrated: true });

    expect(existsSync(path.join(tmpDir, ".ai-agents"))).toBe(false);
    expect(
      readFileSync(path.join(tmpDir, ".mvtt/workspace/session.yaml"), "utf-8"),
    ).toBe("session: 1\n");
  });

  it("refuses to migrate when both directories exist", () => {
    mkdirSync(path.join(tmpDir, ".ai-agents"));
    mkdirSync(path.join(tmpDir, ".mvtt"));

    expect(() => migrateLegacyLayout(tmpDir)).toThrow(LegacyLayoutConflictError);
    expect(existsSync(path.join(tmpDir, ".ai-agents"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".mvtt"))).toBe(true);
  });

  it("rolls back a migration", () => {
    mkdirSync(path.join(tmpDir, ".ai-agents"));
    migrateLegacyLayout(tmpDir);
    expect(existsSync(path.join(tmpDir, ".mvtt"))).toBe(true);

    rollbackLegacyLayout(tmpDir);
    expect(existsSync(path.join(tmpDir, ".ai-agents"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".mvtt"))).toBe(false);
  });
});

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
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { materializeProject } from "../../src/fs/materialize.js";
import { updateCoreManifest } from "../../src/fs/core-manifest.js";
import type { CoreManifest } from "../../src/types/core-manifest.js";

const PACKAGE_ROOT = path.resolve(".");

describe("core manifest merge (Task A)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-core-manifest-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function readUserManifest(): CoreManifest {
    const p = path.join(tmpDir, ".ai-agents/knowledge/core/manifest.yaml");
    return parseYaml(readFileSync(p, "utf-8")) as CoreManifest;
  }

  function writeUserManifest(manifest: CoreManifest): void {
    const dir = path.join(tmpDir, ".ai-agents/knowledge/core");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "manifest.yaml"),
      stringifyYaml(manifest),
      "utf-8",
    );
  }

  it("fresh install writes framework entries only", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const m = readUserManifest();
    expect(m.id).toBe("core");
    expect(m.type).toBe("shared");
    expect(m.files.length).toBeGreaterThan(0);
    for (const f of m.files) {
      expect(f.origin).toBe("framework");
    }
  });

  it("preserves user-origin entries on re-materialize (update)", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const initial = readUserManifest();

    initial.files.push({
      path: "user/team-conventions.md",
      origin: "user",
      auto_load: true,
    });
    writeUserManifest(initial);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const merged = readUserManifest();
    const userEntries = merged.files.filter((f) => f.origin === "user");
    const frameworkEntries = merged.files.filter((f) => f.origin === "framework");

    expect(userEntries).toHaveLength(1);
    expect(userEntries[0].path).toBe("user/team-conventions.md");
    expect(frameworkEntries.length).toBeGreaterThan(0);
  });

  it("drops malformed entries that lack a valid origin", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const initial = readUserManifest();

    // Inject an entry with no origin (legacy/malformed). Must be dropped on next merge.
    (initial.files as unknown[]).push({
      path: "user/legacy-no-origin.md",
      auto_load: true,
    });
    writeUserManifest(initial);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const merged = readUserManifest();
    expect(merged.files.find((f) => f.path === "user/legacy-no-origin.md")).toBeUndefined();
  });

  it("creates a backup of the existing user manifest before overwriting", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const initial = readUserManifest();
    initial.files.push({
      path: "user/x.md",
      origin: "user",
      auto_load: true,
    });
    writeUserManifest(initial);

    const result = updateCoreManifest(tmpDir, PACKAGE_ROOT);
    expect(result.written).toBe(true);
    expect(result.backup).not.toBeNull();
    if (result.backup) {
      expect(existsSync(result.backup)).toBe(true);
    }
    expect(result.userCount).toBe(1);
  });

  it("creates the user/ directory as a user_data dir on install", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const userDir = path.join(tmpDir, ".ai-agents/knowledge/core/user");
    expect(existsSync(userDir)).toBe(true);
  });

  it("does not delete files written by users into core/user/", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const userFile = path.join(
      tmpDir,
      ".ai-agents/knowledge/core/user/team-conventions.md",
    );
    writeFileSync(userFile, "# Team Conventions\nuser content", "utf-8");

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    expect(existsSync(userFile)).toBe(true);
    expect(readFileSync(userFile, "utf-8")).toBe("# Team Conventions\nuser content");
  });

  it("framework files in _framework/ are still overwritten by update", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const fwFile = path.join(
      tmpDir,
      ".ai-agents/knowledge/core/_framework/review-principles.md",
    );
    expect(existsSync(fwFile)).toBe(true);

    writeFileSync(fwFile, "tampered", "utf-8");
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readFileSync(fwFile, "utf-8");
    expect(after).not.toBe("tampered");
  });
});

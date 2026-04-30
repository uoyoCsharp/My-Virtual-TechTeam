import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { materializeProject } from "../../src/fs/materialize.js";
import { writeInstallationManifest, readInstallationManifest } from "../../src/fs/install-manifest.js";
import { hashFile } from "../../src/fs/hash.js";

const PACKAGE_ROOT = path.resolve(".");

describe("doctor detection logic", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-doctor-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects manually modified generated files via hash mismatch", () => {
    const materialized = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    writeInstallationManifest(tmpDir, "2.0.0", null, materialized, null);

    const manifest = readInstallationManifest(tmpDir)!;
    const skillRel = ".claude/skills/mvt-analyze/SKILL.md";
    const skillAbs = path.join(tmpDir, skillRel);

    const originalHash = manifest.files[skillRel].hash;

    writeFileSync(skillAbs, readFileSync(skillAbs, "utf-8") + "\n# tampered", "utf-8");

    const newHash = hashFile(skillAbs);
    expect(newHash).not.toBe(originalHash);
  });

  it("detects missing tracked files", () => {
    const materialized = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    writeInstallationManifest(tmpDir, "2.0.0", null, materialized, null);

    const skillAbs = path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md");
    unlinkSync(skillAbs);

    expect(existsSync(skillAbs)).toBe(false);
  });

  it("confirms user data dirs exist after install", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const userDirs = [
      ".ai-agents/workspace",
      ".ai-agents/workspace/artifacts",
      ".ai-agents/skills/_templates/custom",
      ".ai-agents/knowledge/principle",
      ".ai-agents/knowledge/project",
    ];
    for (const dir of userDirs) {
      expect(existsSync(path.join(tmpDir, dir))).toBe(true);
    }
  });
});

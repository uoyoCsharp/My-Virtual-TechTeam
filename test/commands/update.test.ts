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
import { materializeProject } from "../../src/fs/materialize.js";
import {
  readInstallationManifest,
  writeInstallationManifest,
} from "../../src/fs/install-manifest.js";
import { updateCommand } from "../../src/commands/update.js";

const PACKAGE_ROOT = path.resolve(".");

describe("update (via re-materialize)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-update-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves user data across re-materialize", () => {
    const initial = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    writeInstallationManifest(tmpDir, "2.0.0", initial, null);

    const userFile = path.join(tmpDir, ".ai-agents/workspace/artifacts/user-data.md");
    writeFileSync(userFile, "user content", "utf-8");

    const configPath = path.join(tmpDir, ".ai-agents/config.yaml");
    const customConfig = "# user customized\nversion: 2.0";
    writeFileSync(configPath, customConfig, "utf-8");

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir, overwriteCreateOnce: false });

    expect(readFileSync(userFile, "utf-8")).toBe("user content");
    expect(readFileSync(configPath, "utf-8")).toBe(customConfig);
  });

  it("overwrites manually-modified generated files", () => {
    const initial = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    writeInstallationManifest(tmpDir, "2.0.0", initial, null);

    const skillPath = path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md");
    writeFileSync(skillPath, "tampered", "utf-8");

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const content = readFileSync(skillPath, "utf-8");
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).not.toBe("tampered");
  });

  it("removes stale generated files (e.g. retired skills)", () => {
    const initial = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const stalePath = ".claude/skills/mvt-add-context/SKILL.md";
    const staleAbs = path.join(tmpDir, stalePath);
    mkdirSync(path.dirname(staleAbs), { recursive: true });
    writeFileSync(staleAbs, "stale legacy skill", "utf-8");

    const initialPlusStale = [
      ...initial,
      {
        absPath: staleAbs,
        relPath: stalePath,
        hash: "deadbeef",
        category: "generated" as const,
      },
    ];
    writeInstallationManifest(tmpDir, "2.0.0", initialPlusStale, null);

    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      updateCommand();
    } finally {
      process.chdir(originalCwd);
    }

    expect(existsSync(staleAbs)).toBe(false);
    expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-add-context"))).toBe(false);
    expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-manage-context/SKILL.md"))).toBe(true);
  });

  it("updates last_updated_at on re-install", () => {
    const initial = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const m1 = writeInstallationManifest(tmpDir, "2.0.0", initial, null);
    const firstUpdate = m1.last_updated_at;

    const second = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const m2 = writeInstallationManifest(tmpDir, "2.0.1", second, m1);

    expect(m2.installed_at).toBe(m1.installed_at);
    expect(m2.mvtt_version).toBe("2.0.1");
    expect(m2.last_updated_at).not.toBe(firstUpdate);
  });
});

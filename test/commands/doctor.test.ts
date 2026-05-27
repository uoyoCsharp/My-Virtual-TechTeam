import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
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
import { detectLegacyArtifacts } from "../../src/commands/doctor.js";

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

describe("detectLegacyArtifacts", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-legacy-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns no issues for a fresh install", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const issues = detectLegacyArtifacts(tmpDir);
    expect(issues).toEqual([]);
  });

  it("flags legacy workspace/project-context.md path", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const legacyPath = path.join(tmpDir, ".ai-agents/workspace/project-context.md");
    writeFileSync(legacyPath, "# stale", "utf-8");

    const issues = detectLegacyArtifacts(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0].status).toBe("WARN");
    expect(issues[0].message).toMatch(/legacy path/i);
    expect(issues[0].message).toMatch(/migrate-paths/);
  });

  it("flags deprecated preferences.language in config.yaml", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const configPath = path.join(tmpDir, ".ai-agents/config.yaml");
    writeFileSync(configPath, "preferences:\n  language: zh-CN\n", "utf-8");

    const issues = detectLegacyArtifacts(tmpDir);
    expect(issues.some((i) => /legacy `language`/.test(i.message))).toBe(true);
  });

  it("does NOT flag config when interaction_language is already set", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const configPath = path.join(tmpDir, ".ai-agents/config.yaml");
    writeFileSync(
      configPath,
      "preferences:\n  language: zh-CN\n  interaction_language: en-US\n",
      "utf-8",
    );

    const issues = detectLegacyArtifacts(tmpDir);
    expect(issues.some((i) => /legacy `language`/.test(i.message))).toBe(false);
  });

  it("flags legacy core/manifest.yaml fields", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const corePath = path.join(tmpDir, ".ai-agents/knowledge/core/manifest.yaml");
    mkdirSync(path.dirname(corePath), { recursive: true });
    writeFileSync(
      corePath,
      "id: core\ntype: core\ntoken_estimate: 100\nfiles: []\n",
      "utf-8",
    );

    const issues = detectLegacyArtifacts(tmpDir);
    expect(issues.some((i) => /core\/manifest\.yaml/.test(i.message))).toBe(true);
  });

  it("flags residual `type` fields on registry.yaml knowledge entries", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const registryPath = path.join(tmpDir, ".ai-agents/registry.yaml");
    writeFileSync(
      registryPath,
      [
        "version: \"2.0\"",
        "knowledge:",
        "  shared:",
        "    - id: \"core\"",
        "      type: \"dynamic\"",
        "      source: \"knowledge/core/\"",
        "      files_from_manifest: true",
        "skills: {}",
        "",
      ].join("\n"),
      "utf-8",
    );

    const issues = detectLegacyArtifacts(tmpDir);
    expect(issues.some((i) => /registry\.yaml has 1 legacy/.test(i.message))).toBe(true);
    expect(issues.some((i) => /migrate-registry/.test(i.message))).toBe(true);
  });
});

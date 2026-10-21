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
import { spawnSync } from "node:child_process";
import { PLATFORMS } from "../src/types/platform.js";

const SCRIPT = path.resolve("dist/scripts/skill-scaffold.cjs");

const BODY = `---
name: proj-foo
description: "Use when testing the foo workflow."
---

# Proj Foo

## Purpose

Test skill used by the skill-scaffold suite.
`;

describe("skill-scaffold.cjs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-skill-scaffold-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeInstallManifest(platforms: string[], skillDirs?: Record<string, string>): void {
    mkdirSync(path.join(tmpDir, ".mvtt"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, ".mvtt/.mvtt-manifest.json"),
      JSON.stringify(
        {
          mvtt_version: "2.3.1",
          installed_at: "2026-01-01T00:00:00.000Z",
          last_updated_at: "2026-01-01T00:00:00.000Z",
          platforms,
          ...(skillDirs ? { platformSkillDirs: skillDirs } : {}),
          files: {},
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(tmpDir, ".mvtt/registry.yaml"),
      'skills:\n  mvt-init:\n    description: "Initialize a project"\n',
    );
  }

  function writeBody(content = BODY, fileName = "draft-SKILL.md"): string {
    const bodyPath = path.join(tmpDir, fileName);
    writeFileSync(bodyPath, content);
    return bodyPath;
  }

  function writeStagedSkill(files: Record<string, string>): string {
    const stagedDir = path.join(tmpDir, ".mvtt/workspace/.skill-draft/proj-foo");
    for (const [relPath, content] of Object.entries(files)) {
      const absPath = path.join(stagedDir, relPath);
      mkdirSync(path.dirname(absPath), { recursive: true });
      writeFileSync(absPath, content);
    }
    return stagedDir;
  }

  function run(args: string[]) {
    return spawnSync("node", [SCRIPT, ...args], { cwd: tmpDir, encoding: "utf-8" });
  }

  function scaffoldArgs(bodyPath: string, extra: string[] = []): string[] {
    return [
      "scaffold",
      "--name", "proj-foo",
      "--description", "Use when testing the foo workflow.",
      "--body", bodyPath,
      ...extra,
    ];
  }

  // -- scaffold: placement --

  it("scaffold writes a claude-only skill and registers it", () => {
    writeInstallManifest(["claude"]);
    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.platforms).toHaveLength(1);
    expect(existsSync(path.join(tmpDir, ".claude/skills/proj-foo/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".cursor"))).toBe(false);

    const registry = readFileSync(path.join(tmpDir, ".mvtt/registry.yaml"), "utf-8");
    expect(registry).toContain("proj-foo");
    expect(registry).toContain("custom: true");
    expect(registry).toContain("mvt-init");
    expect(existsSync(path.join(tmpDir, ".mvtt/.backup"))).toBe(true);
  });

  it("scaffold writes identical bytes to every installed platform", () => {
    writeInstallManifest(["claude", "cursor"]);
    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(0);
    const claude = readFileSync(path.join(tmpDir, ".claude/skills/proj-foo/SKILL.md"), "utf-8");
    const cursor = readFileSync(path.join(tmpDir, ".cursor/skills/proj-foo/SKILL.md"), "utf-8");
    expect(cursor).toBe(claude);
    expect(JSON.parse(res.stdout).platforms.map((p: { id: string }) => p.id)).toEqual([
      "claude",
      "cursor",
    ]);
  });

  it("scaffold materializes every platform in the shared platform table", () => {
    writeInstallManifest(PLATFORMS.map((platform) => platform.id));
    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(0);
    for (const platform of PLATFORMS) {
      expect(existsSync(path.join(tmpDir, platform.skillDir, "proj-foo/SKILL.md"))).toBe(true);
    }
  });

  it("scaffold falls back to the directory convention for legacy manifests", () => {
    writeInstallManifest(["qoder"]);
    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(0);
    expect(existsSync(path.join(tmpDir, ".qoder/skills/proj-foo/SKILL.md"))).toBe(true);
  });

  it("scaffold prefers recorded platformSkillDirs over the convention", () => {
    writeInstallManifest(["claude"], { claude: "custom-root/skills" });
    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(0);
    expect(existsSync(path.join(tmpDir, "custom-root/skills/proj-foo/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".claude/skills/proj-foo/SKILL.md"))).toBe(false);
  });

  it("scaffold mirrors the whole staged tree including resources", () => {
    writeInstallManifest(["claude", "cursor"]);
    const stagedDir = writeStagedSkill({
      "SKILL.md": BODY,
      "references/api.md": "API reference\n",
    });

    const res = run([
      "scaffold",
      "--name", "proj-foo",
      "--description", "Use when testing the foo workflow.",
      "--from", stagedDir,
    ]);

    expect(res.status).toBe(0);
    for (const platform of [".claude", ".cursor"]) {
      expect(
        readFileSync(path.join(tmpDir, `${platform}/skills/proj-foo/references/api.md`), "utf-8"),
      ).toBe("API reference\n");
    }
  });

  it("scaffold creates an output template and records it in the registry", () => {
    writeInstallManifest(["claude"]);
    const templatePath = path.join(tmpDir, "draft-template.md");
    writeFileSync(templatePath, "# Heading\n\n## Section\n");

    const res = run(scaffoldArgs(writeBody(), [
      "--template", "proj-foo-output.md",
      "--template-body", templatePath,
    ]));

    expect(res.status).toBe(0);
    const templateFile = path.join(tmpDir, ".mvtt/skills/_templates/proj-foo-output.md");
    expect(existsSync(templateFile)).toBe(true);
    expect(readFileSync(path.join(tmpDir, ".mvtt/registry.yaml"), "utf-8")).toContain(
      ".mvtt/skills/_templates/proj-foo-output.md",
    );
  });

  // -- scaffold: validation and safety --

  it("scaffold fails without an installation manifest", () => {
    mkdirSync(path.join(tmpDir, ".mvtt"), { recursive: true });
    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/\.mvtt-manifest\.json/);
  });

  it("scaffold rejects an invalid skill name", () => {
    writeInstallManifest(["claude"]);
    const res = run([
      "scaffold",
      "--name", "Proj_Foo",
      "--description", "x",
      "--body", writeBody(),
    ]);

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Invalid --name/);
  });

  it("scaffold refuses a registry collision and writes nothing", () => {
    writeInstallManifest(["claude"]);
    writeFileSync(
      path.join(tmpDir, ".mvtt/registry.yaml"),
      'skills:\n  proj-foo:\n    description: "Exists"\n    custom: true\n',
    );

    const res = run(scaffoldArgs(writeBody()));

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/already registered/);
    expect(existsSync(path.join(tmpDir, ".claude/skills/proj-foo"))).toBe(false);
  });

  it("scaffold rejects a frontmatter name mismatch", () => {
    writeInstallManifest(["claude"]);
    const mismatched = BODY.replace("name: proj-foo", "name: proj-bar");
    const res = run(scaffoldArgs(writeBody(mismatched)));

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/does not match --name/);
  });

  it("scaffold --dry-run writes nothing", () => {
    writeInstallManifest(["claude"]);
    const res = run(scaffoldArgs(writeBody(), ["--dry-run"]));

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.dryRun).toBe(true);
    expect(existsSync(path.join(tmpDir, ".claude/skills/proj-foo"))).toBe(false);
    expect(existsSync(path.join(tmpDir, ".mvtt/.backup"))).toBe(false);
  });

  it("scaffold reports a portability warning for a missing platform", () => {
    writeInstallManifest(["cursor"]);
    const bodyWithClaudePath = BODY.replace(
      "Test skill used by the skill-scaffold suite.",
      "Write results next to `.claude/skills/proj-foo/`.",
    );
    const res = run(scaffoldArgs(writeBody(bodyWithClaudePath)));

    expect(res.status).toBe(0);
    const out = JSON.parse(res.stdout);
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(out.warnings[0]).toContain(".claude/skills");
  });

  it("scaffold JSON uses forward-slash paths", () => {
    writeInstallManifest(["claude"]);
    const res = run(scaffoldArgs(writeBody()));

    const out = JSON.parse(res.stdout);
    for (const platform of out.platforms) {
      for (const file of platform.files) {
        expect(file).not.toContain("\\");
      }
    }
  });

  // -- sync --

  it("sync mirrors a claude-only skill to every installed platform", () => {
    writeInstallManifest(["claude", "cursor"]);
    expect(run(scaffoldArgs(writeBody(), ["--platforms", "claude"])).status).toBe(0);
    expect(existsSync(path.join(tmpDir, ".cursor/skills/proj-foo/SKILL.md"))).toBe(false);

    const res = run(["sync", "--name", "proj-foo"]);

    expect(res.status).toBe(0);
    const claude = readFileSync(path.join(tmpDir, ".claude/skills/proj-foo/SKILL.md"), "utf-8");
    const cursor = readFileSync(path.join(tmpDir, ".cursor/skills/proj-foo/SKILL.md"), "utf-8");
    expect(cursor).toBe(claude);
    expect(JSON.parse(res.stdout).source).toBe(".claude/skills/proj-foo");
  });

  it("sync refuses an unregistered skill", () => {
    writeInstallManifest(["claude"]);
    const res = run(["sync", "--name", "proj-foo"]);

    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/not registered/);
  });
});

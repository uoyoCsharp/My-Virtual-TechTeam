import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import * as clack from "@clack/prompts";
import { materializeProject } from "../../src/fs/materialize.js";
import {
  readInstallationManifest,
  writeInstallationManifest,
} from "../../src/fs/install-manifest.js";
import {
  platformListCommand,
  platformUpdateCommand,
} from "../../src/commands/platform.js";
import type { PlatformId } from "../../src/types/platform.js";

const PACKAGE_ROOT = path.resolve(".");

vi.mock("@clack/prompts", () => ({
  multiselect: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

describe("platform command", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-platform-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);

    vi.mocked(clack.multiselect).mockReset();
    vi.mocked(clack.confirm).mockReset();
    vi.mocked(clack.isCancel).mockReset().mockReturnValue(false);
    vi.mocked(clack.cancel).mockReset();
    vi.mocked(clack.outro).mockReset();
    vi.mocked(clack.log.info).mockReset();
    vi.mocked(clack.log.success).mockReset();
    vi.mocked(clack.log.warn).mockReset();
    vi.mocked(clack.log.error).mockReset();

    vi.mocked(clack.confirm).mockResolvedValue(true as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function seed(platforms: PlatformId[] = ["claude"], withCustomSkill = false): void {
    const files = materializeProject({
      packageRoot: PACKAGE_ROOT,
      projectRoot: tmpDir,
      platforms,
    });
    writeInstallationManifest(tmpDir, "3.0.0", files, null, platforms);

    if (withCustomSkill) {
      mkdirSync(path.join(tmpDir, ".claude/skills/proj-custom"), { recursive: true });
      writeFileSync(
        path.join(tmpDir, ".claude/skills/proj-custom/SKILL.md"),
        "---\nname: proj-custom\ndescription: \"custom\"\n---\n",
        "utf-8",
      );
      writeFileSync(
        path.join(tmpDir, ".mvtt/registry.yaml"),
        [
          "skills:",
          "  mvt-init:",
          '    description: "init"',
          "  proj-custom:",
          '    description: "custom"',
          "    custom: true",
          "",
        ].join("\n"),
        "utf-8",
      );
    }
  }

  function messages(fn: unknown): string {
    const mock = fn as { mock: { calls: unknown[][] } };
    return mock.mock.calls.map((call) => String(call[0])).join("\n");
  }

  async function capture(fn: () => void | Promise<void>): Promise<{
    logs: string[];
    errors: string[];
    exitCode: number | null;
  }> {
    const logs: string[] = [];
    const errors: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    let exitCode: number | null = null;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`__EXIT_${exitCode}__`);
    });

    try {
      await fn();
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith("__EXIT_"))) throw error;
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
      exitSpy.mockRestore();
    }

    return { logs, errors, exitCode };
  }


  it("list shows installed and available targets", async () => {
    seed();
    const result = await capture(() => platformListCommand());
    const output = result.logs.join("\n");

    expect(output).toContain("claude");
    expect(output).toContain(".agents");
    expect(output).toContain(".qoder");
    expect(output).toMatch(/mvtt platform update/);
  });

  it("list works when MVTT is not installed", async () => {
    const result = await capture(() => platformListCommand());
    expect(result.logs.join("\n")).toContain("not installed");
  });

  it("list warns about unknown platform ids in the manifest", async () => {
    seed();
    const manifestPath = path.join(tmpDir, ".mvtt/.mvtt-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.platforms = ["claude", "codex"];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const result = await capture(() => platformListCommand());
    expect(result.logs.join("\n")).toContain("unknown platform id");
  });

  it("list reads a legacy .ai-agents layout without migrating it", async () => {
    seed();
    renameSync(path.join(tmpDir, ".mvtt"), path.join(tmpDir, ".ai-agents"));

    const result = await capture(() => platformListCommand());
    expect(result.logs.join("\n")).toContain("Legacy .ai-agents");
    expect(existsSync(path.join(tmpDir, ".mvtt"))).toBe(false);
  });


  it("adds the shared agents target and syncs custom skills", async () => {
    seed(["claude"], true);
    vi.mocked(clack.multiselect).mockResolvedValue(["claude", "agents"] as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".agents/skills/mvt-init/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".agents/skills/proj-custom/SKILL.md"))).toBe(true);
    expect(readInstallationManifest(tmpDir)!.platforms).toEqual(["claude", "agents"]);
    expect(messages(clack.log.success)).toMatch(/Targets updated/);
  });

  it("removes a target, cleans generated files, and keeps user data", async () => {
    seed(["claude"], true);
    vi.mocked(clack.multiselect).mockResolvedValue(["agents"] as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".agents/skills/mvt-init/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-init/SKILL.md"))).toBe(false);
    expect(existsSync(path.join(tmpDir, ".claude/skills/proj-custom/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".agents/skills/proj-custom/SKILL.md"))).toBe(true);
    expect(readInstallationManifest(tmpDir)!.platforms).toEqual(["agents"]);
  });

  it("reports no changes when the selection is unchanged", async () => {
    seed(["claude"]);
    vi.mocked(clack.multiselect).mockResolvedValue(["claude"] as never);

    await capture(() => platformUpdateCommand());

    expect(messages(clack.log.info)).toContain("No changes");
    expect(existsSync(path.join(tmpDir, ".agents"))).toBe(false);
  });

  it("does nothing when the picker is cancelled", async () => {
    seed(["claude"]);
    vi.mocked(clack.isCancel).mockReturnValue(true);
    vi.mocked(clack.multiselect).mockResolvedValue(Symbol("cancel") as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".agents"))).toBe(false);
    expect(readInstallationManifest(tmpDir)!.platforms).toEqual(["claude"]);
    expect(clack.cancel).toHaveBeenCalled();
  });

  it("does nothing when the confirmation is declined", async () => {
    seed(["claude"]);
    vi.mocked(clack.multiselect).mockResolvedValue(["claude", "agents"] as never);
    vi.mocked(clack.confirm).mockResolvedValue(false as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".agents"))).toBe(false);
    expect(clack.cancel).toHaveBeenCalled();
  });

  it("requires at least one selected target", async () => {
    seed(["claude"]);
    vi.mocked(clack.multiselect).mockResolvedValue([] as never);

    await capture(() => platformUpdateCommand());

    expect(messages(clack.log.error)).toContain("at least one target");
    expect(existsSync(path.join(tmpDir, ".agents"))).toBe(false);
  });

  it("warns when the shared agents target is removed", async () => {
    seed(["claude", "agents"]);
    vi.mocked(clack.multiselect).mockResolvedValue(["claude"] as never);

    await capture(() => platformUpdateCommand());

    expect(messages(clack.log.warn)).toMatch(/Removing \.agents/);
  });


  it("migrates a legacy layout after confirmation", async () => {
    seed(["claude"]);
    renameSync(path.join(tmpDir, ".mvtt"), path.join(tmpDir, ".ai-agents"));
    vi.mocked(clack.multiselect).mockResolvedValue(["claude", "agents"] as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".ai-agents"))).toBe(false);
    expect(existsSync(path.join(tmpDir, ".mvtt/.mvtt-manifest.json"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".agents/skills/mvt-init/SKILL.md"))).toBe(true);
    expect(readInstallationManifest(tmpDir)!.platforms).toEqual(["claude", "agents"]);
  });

  it("does not create registry/core-manifest backups on target changes", async () => {
    seed();
    vi.mocked(clack.multiselect)
      .mockResolvedValueOnce(["claude", "agents"] as never)
      .mockResolvedValueOnce(["claude"] as never);

    await capture(() => platformUpdateCommand());
    expect(existsSync(path.join(tmpDir, ".mvtt/.backup"))).toBe(false);

    await capture(() => platformUpdateCommand());
    expect(existsSync(path.join(tmpDir, ".mvtt/.backup"))).toBe(false);
  });

  it("preserves legacy native targets that the picker does not show", async () => {
    seed(["claude", "cursor"]);
    vi.mocked(clack.multiselect).mockResolvedValue(["claude", "agents"] as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".cursor/skills/mvt-init/SKILL.md"))).toBe(true);
    expect(readInstallationManifest(tmpDir)!.platforms?.slice().sort()).toEqual(
      ["agents", "claude", "cursor"].sort(),
    );
  });

  it("syncs custom skills to remaining targets when the source target is removed", async () => {
    seed(["claude", "agents"], true);
    vi.mocked(clack.multiselect).mockResolvedValue(["agents"] as never);

    await capture(() => platformUpdateCommand());

    expect(existsSync(path.join(tmpDir, ".agents/skills/proj-custom/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tmpDir, ".claude/skills/proj-custom/SKILL.md"))).toBe(true);
    expect(readInstallationManifest(tmpDir)!.platforms).toEqual(["agents"]);
  });

  it("aborts when the manifest records no valid platform ids", async () => {
    seed();
    const manifestPath = path.join(tmpDir, ".mvtt/.mvtt-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.platforms = ["codex"];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const result = await capture(() => platformUpdateCommand());

    expect(result.exitCode).toBe(1);
    expect(result.errors.join("\n")).toContain("no valid platform");
    expect(clack.multiselect).not.toHaveBeenCalled();
    expect(existsSync(path.join(tmpDir, ".agents"))).toBe(false);
  });

  it("list reports no valid platform ids instead of assuming claude", async () => {
    seed();
    const manifestPath = path.join(tmpDir, ".mvtt/.mvtt-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.platforms = ["codex"];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const result = await capture(() => platformListCommand());
    const output = result.logs.join("\n");

    expect(output).toContain("no valid platform ids");
    const claudeRow = result.logs.find((line) => line.trimStart().startsWith("claude"));
    expect(claudeRow).toBeDefined();
    expect(claudeRow).toContain("no");
  });

  it("list assumes claude only when the manifest predates platform tracking", async () => {
    seed();
    const manifestPath = path.join(tmpDir, ".mvtt/.mvtt-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    delete manifest.platforms;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const result = await capture(() => platformListCommand());
    const output = result.logs.join("\n");

    expect(output).toContain("assuming .claude");
    const claudeRow = result.logs.find((line) => line.trimStart().startsWith("claude"));
    expect(claudeRow).toContain("yes");
  });

  it("drops unknown platform ids after warning", async () => {
    seed();
    const manifestPath = path.join(tmpDir, ".mvtt/.mvtt-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.platforms = ["claude", "codex"];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    vi.mocked(clack.multiselect).mockResolvedValue(["claude", "agents"] as never);

    await capture(() => platformUpdateCommand());

    expect(messages(clack.log.warn)).toContain("unknown platform id");
    expect(readInstallationManifest(tmpDir)!.platforms).toEqual(["claude", "agents"]);
  });
});

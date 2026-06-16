import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import * as clack from "@clack/prompts";
import { installCommand } from "../src/commands/install.js";
import { updateCommand } from "../src/commands/update.js";
import { doctorCommand } from "../src/commands/doctor.js";
import { uninstallCommand } from "../src/commands/uninstall.js";
import { run } from "../src/cli.js";

vi.mock("@clack/prompts", () => ({
  select: vi.fn().mockResolvedValue("en-US"),
  multiselect: vi.fn().mockResolvedValue(["claude"]),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  tasks: vi.fn().mockImplementation(async (taskDefs: Array<{ task: (msg: (s: string) => void) => Promise<string> | string }>) => {
    for (const t of taskDefs) await t.task(() => {});
  }),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

interface Captured {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

async function captureIO(tmpDir: string, fn: () => void | Promise<void>): Promise<Captured> {
  const captured: Captured = { stdout: [], stderr: [], exitCode: null };
  const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    captured.stdout.push(args.map(String).join(" "));
  });
  const errSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    captured.stderr.push(args.map(String).join(" "));
  });
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    captured.stdout.push(args.map(String).join(" "));
  });
  const stdoutWriteSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: unknown) => {
      captured.stdout.push(String(chunk));
      return true;
    });
  const stderrWriteSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      captured.stderr.push(String(chunk));
      return true;
    });
  const exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((code?: number | string | null) => {
      captured.exitCode = typeof code === "number" ? code : 0;
      throw new Error(`__EXIT_${captured.exitCode}__`);
    });

  try {
    await fn();
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith("__EXIT_"))) throw e;
  } finally {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
    exitSpy.mockRestore();
  }

  return captured;
}

describe("CLI commands (in-process)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-cli-"));
    vi.mocked(clack.select).mockReset();
    vi.mocked(clack.multiselect).mockReset();
    vi.mocked(clack.confirm).mockReset();
    vi.mocked(clack.isCancel).mockReset();
    vi.mocked(clack.intro).mockReset();
    vi.mocked(clack.outro).mockReset();
    vi.mocked(clack.cancel).mockReset();
    vi.mocked(clack.tasks).mockReset();
    vi.mocked(clack.tasks).mockImplementation(async (taskDefs: Array<{ task: (msg: (s: string) => void) => Promise<string> | string }>) => {
      for (const t of taskDefs) await t.task(() => {});
    });
    vi.mocked(clack.log.info).mockReset();
    vi.mocked(clack.log.success).mockReset();
    vi.mocked(clack.log.warn).mockReset();
    vi.mocked(clack.log.error).mockReset();
    vi.mocked(clack.log.message).mockReset();
    vi.mocked(clack.select).mockResolvedValue("en-US" as never);
    vi.mocked(clack.multiselect).mockResolvedValue(["claude"] as never);
    vi.mocked(clack.confirm).mockResolvedValue(true as never);
    vi.mocked(clack.isCancel).mockReturnValue(false);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("install", () => {
    it("installs into empty directory", async () => {
      const r = await captureIO(tmpDir, () => installCommand());
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(true);
      expect(existsSync(path.join(tmpDir, ".ai-agents/.mvtt-manifest.json"))).toBe(true);
      expect(clack.intro).toHaveBeenCalled();
      expect(clack.outro).toHaveBeenCalled();
    });

    it("non-TTY install defaults language to en-US", async () => {
      await captureIO(tmpDir, () => installCommand());
      const config = readFileSync(path.join(tmpDir, ".ai-agents/config.yaml"), "utf-8");
      expect(config).toMatch(/interaction_language:\s*en-US/);
      expect(config).toMatch(/document_output_language:\s*en-US/);
    });

    it("refuses re-install when already installed", async () => {
      await captureIO(tmpDir, () => installCommand());
      const r = await captureIO(tmpDir, () => installCommand());
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("already installed");
    });
  });

  describe("doctor", () => {
    it("fails when not installed", async () => {
      const r = await captureIO(tmpDir, () => doctorCommand());
      expect(r.exitCode).toBe(1);
      const errorCalls = vi.mocked(clack.log.error).mock.calls.map((c) => String(c[0]));
      expect(errorCalls.join("\n")).toContain("[FAIL]");
    });

    it("passes on clean install", async () => {
      await captureIO(tmpDir, () => installCommand());
      const r = await captureIO(tmpDir, () => doctorCommand());
      const successCalls = vi.mocked(clack.log.success).mock.calls.map((c) => String(c[0]));
      const errorCalls = vi.mocked(clack.log.error).mock.calls.map((c) => String(c[0]));
      expect(successCalls.join("\n")).toContain("[PASS]");
      expect(errorCalls.join("\n")).not.toContain("[FAIL]");
    });

    it("detects manually modified files", async () => {
      await captureIO(tmpDir, () => installCommand());
      writeFileSync(
        path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"),
        "tampered",
        "utf-8",
      );
      const r = await captureIO(tmpDir, () => doctorCommand());
      const warnCalls = vi.mocked(clack.log.warn).mock.calls.map((c) => String(c[0]));
      expect(warnCalls.join("\n")).toContain("Manually modified");
    });

    it("detects missing user dirs", async () => {
      await captureIO(tmpDir, () => installCommand());
      rmSync(path.join(tmpDir, ".ai-agents/knowledge/principle"), { recursive: true });
      const r = await captureIO(tmpDir, () => doctorCommand());
      const warnCalls = vi.mocked(clack.log.warn).mock.calls.map((c) => String(c[0]));
      expect(warnCalls.join("\n")).toContain("User data dir missing");
    });

    it("detects missing tracked files", async () => {
      await captureIO(tmpDir, () => installCommand());
      rmSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"));
      const r = await captureIO(tmpDir, () => doctorCommand());
      const errorCalls = vi.mocked(clack.log.error).mock.calls.map((c) => String(c[0]));
      expect(errorCalls.join("\n")).toContain("Missing file");
    });
  });

  describe("update", () => {
    it("fails when not installed", async () => {
      const r = await captureIO(tmpDir, () => updateCommand());
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("not installed");
    });

    it("reports up-to-date with check flag", async () => {
      await captureIO(tmpDir, () => installCommand());
      const r = await captureIO(tmpDir, () => updateCommand({ check: true }));
      expect(r.stdout.join("\n")).toContain("Up to date");
    });

    it("says nothing to update when versions match", async () => {
      await captureIO(tmpDir, () => installCommand());
      const r = await captureIO(tmpDir, () => updateCommand());
      expect(r.stdout.join("\n")).toContain("Nothing to update");
    });
  });

  describe("uninstall", () => {
    it("fails when not installed", async () => {
      const r = await captureIO(tmpDir, () => uninstallCommand());
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("not installed");
    });

    it("aborts when user declines the confirm prompt", async () => {
      await captureIO(tmpDir, () => installCommand());
      vi.mocked(clack.confirm).mockResolvedValueOnce(false as never);
      const r = await captureIO(tmpDir, () => uninstallCommand());
      expect(clack.cancel).toHaveBeenCalled();
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(true);
    });

    it("removes generated files when user confirms", async () => {
      await captureIO(tmpDir, () => installCommand());
      const userFile = path.join(tmpDir, ".ai-agents/workspace/artifacts/mine.md");
      writeFileSync(userFile, "my work", "utf-8");
      vi.mocked(clack.confirm)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never);
      await captureIO(tmpDir, () => uninstallCommand());
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(false);
      expect(existsSync(path.join(tmpDir, ".ai-agents/.mvtt-manifest.json"))).toBe(false);
      expect(readFileSync(userFile, "utf-8")).toBe("my work");
      expect(existsSync(path.join(tmpDir, ".ai-agents/config.yaml"))).toBe(true);
    });

    it("removes user data when user opts out of preservation", async () => {
      await captureIO(tmpDir, () => installCommand());
      const userFile = path.join(tmpDir, ".ai-agents/workspace/artifacts/mine.md");
      writeFileSync(userFile, "my work", "utf-8");
      vi.mocked(clack.confirm)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(false as never);
      await captureIO(tmpDir, () => uninstallCommand());
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(false);
      expect(existsSync(path.join(tmpDir, ".ai-agents/.mvtt-manifest.json"))).toBe(false);
      expect(existsSync(userFile)).toBe(false);
      expect(existsSync(path.join(tmpDir, ".ai-agents/config.yaml"))).toBe(false);
      expect(existsSync(path.join(tmpDir, ".ai-agents/registry.yaml"))).toBe(false);
    });
  });

  describe("router", () => {
    it("shows help on --help", async () => {
      const r = await captureIO(tmpDir, () => run(["--help"]));
      const out = r.stdout.join("\n");
      expect(out).toContain("Usage:");
      expect(out).toContain("install");
    });

    it("shows version on --version", async () => {
      const r = await captureIO(tmpDir, () => run(["--version"]));
      expect(r.stdout.join("\n")).toMatch(/\d+\.\d+\.\d+/);
    });

    it("rejects unknown command", async () => {
      const r = await captureIO(tmpDir, () => run(["nonexistent"]));
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("unknown command");
    });

    it("dispatches to doctor", async () => {
      await captureIO(tmpDir, () => installCommand());
      const r = await captureIO(tmpDir, () => run(["doctor"]));
      const successCalls = vi.mocked(clack.log.success).mock.calls.map((c) => String(c[0]));
      expect(successCalls.join("\n")).toContain("[PASS]");
    });
  });
});

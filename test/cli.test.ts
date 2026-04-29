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
import { installCommand } from "../src/commands/install.js";
import { updateCommand } from "../src/commands/update.js";
import { doctorCommand } from "../src/commands/doctor.js";
import { uninstallCommand } from "../src/commands/uninstall.js";
import { buildCommand } from "../src/commands/build.js";
import { run } from "../src/cli.js";

interface Captured {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

function captureIO(tmpDir: string, fn: () => void): Captured {
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
  const exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((code?: number | string | null) => {
      captured.exitCode = typeof code === "number" ? code : 0;
      throw new Error(`__EXIT_${captured.exitCode}__`);
    });

  try {
    fn();
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith("__EXIT_"))) throw e;
  } finally {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
    exitSpy.mockRestore();
  }

  return captured;
}

describe("CLI commands (in-process)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-cli-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("install", () => {
    it("installs into empty directory", () => {
      const r = captureIO(tmpDir, () => installCommand([]));
      expect(r.stdout.join("\n")).toContain("Installation complete");
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(true);
      expect(existsSync(path.join(tmpDir, ".ai-agents/.mvtt-manifest.json"))).toBe(true);
    });

    it("sets pattern when --pattern provided", () => {
      captureIO(tmpDir, () => installCommand(["--pattern", "ddd"]));
      const config = readFileSync(path.join(tmpDir, ".ai-agents/config.yaml"), "utf-8");
      expect(config).toContain('active: "ddd"');
    });

    it("refuses re-install when already installed", () => {
      captureIO(tmpDir, () => installCommand([]));
      const r = captureIO(tmpDir, () => installCommand([]));
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("already installed");
    });
  });

  describe("doctor", () => {
    it("fails when not installed", () => {
      const r = captureIO(tmpDir, () => doctorCommand([]));
      expect(r.exitCode).toBe(1);
      expect(r.stdout.join("\n")).toContain("[FAIL]");
    });

    it("passes on clean install", () => {
      captureIO(tmpDir, () => installCommand([]));
      const r = captureIO(tmpDir, () => doctorCommand([]));
      const out = r.stdout.join("\n");
      expect(out).toContain("[PASS]");
      expect(out).not.toContain("[FAIL]");
    });

    it("detects manually modified files", () => {
      captureIO(tmpDir, () => installCommand([]));
      writeFileSync(
        path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"),
        "tampered",
        "utf-8",
      );
      const r = captureIO(tmpDir, () => doctorCommand([]));
      expect(r.stdout.join("\n")).toContain("Manually modified");
    });

    it("detects missing user dirs", () => {
      captureIO(tmpDir, () => installCommand([]));
      rmSync(path.join(tmpDir, ".ai-agents/knowledge/principle"), { recursive: true });
      const r = captureIO(tmpDir, () => doctorCommand([]));
      expect(r.stdout.join("\n")).toContain("User data dir missing");
    });

    it("detects missing tracked files", () => {
      captureIO(tmpDir, () => installCommand([]));
      rmSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"));
      const r = captureIO(tmpDir, () => doctorCommand([]));
      expect(r.stdout.join("\n")).toContain("Missing file");
    });
  });

  describe("update", () => {
    it("fails when not installed", () => {
      const r = captureIO(tmpDir, () => updateCommand([]));
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("not installed");
    });

    it("reports up-to-date with --check", () => {
      captureIO(tmpDir, () => installCommand([]));
      const r = captureIO(tmpDir, () => updateCommand(["--check"]));
      expect(r.stdout.join("\n")).toContain("Up to date");
    });

    it("says nothing to update when versions match", () => {
      captureIO(tmpDir, () => installCommand([]));
      const r = captureIO(tmpDir, () => updateCommand([]));
      expect(r.stdout.join("\n")).toContain("Nothing to update");
    });
  });

  describe("uninstall", () => {
    it("fails when not installed", () => {
      const r = captureIO(tmpDir, () => uninstallCommand([]));
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("not installed");
    });

    it("requires --yes to actually delete", () => {
      captureIO(tmpDir, () => installCommand([]));
      captureIO(tmpDir, () => uninstallCommand([]));
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(true);
    });

    it("removes generated files with --yes", () => {
      captureIO(tmpDir, () => installCommand([]));
      const userFile = path.join(tmpDir, ".ai-agents/workspace/artifacts/mine.md");
      writeFileSync(userFile, "my work", "utf-8");
      captureIO(tmpDir, () => uninstallCommand(["--yes"]));
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(false);
      expect(existsSync(path.join(tmpDir, ".ai-agents/.mvtt-manifest.json"))).toBe(false);
      expect(readFileSync(userFile, "utf-8")).toBe("my work");
      expect(existsSync(path.join(tmpDir, ".ai-agents/config.yaml"))).toBe(true);
    });
  });

  describe("build", () => {
    it("builds skills with --out directory", () => {
      const r = captureIO(process.cwd(), () => buildCommand(["--out", tmpDir]));
      expect(r.stdout.join("\n")).toContain("Build complete");
      expect(existsSync(path.join(tmpDir, ".claude/skills/mvt-analyze/SKILL.md"))).toBe(true);
    });
  });

  describe("router", () => {
    it("shows help on no args", () => {
      const r = captureIO(tmpDir, () => run([]));
      expect(r.stdout.join("\n")).toContain("mvtt - My Virtual Tech Team CLI");
    });

    it("shows help on --help", () => {
      const r = captureIO(tmpDir, () => run(["--help"]));
      expect(r.stdout.join("\n")).toContain("mvtt - My Virtual Tech Team CLI");
    });

    it("shows version on --version", () => {
      const r = captureIO(tmpDir, () => run(["--version"]));
      expect(r.stdout.join("\n")).toMatch(/^\d+\.\d+\.\d+/);
    });

    it("rejects unknown command", () => {
      const r = captureIO(tmpDir, () => run(["nonexistent"]));
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join("\n")).toContain("Unknown command");
    });

    it("dispatches to doctor", () => {
      captureIO(tmpDir, () => installCommand([]));
      const r = captureIO(tmpDir, () => run(["doctor"]));
      expect(r.stdout.join("\n")).toContain("[PASS]");
    });
  });
});

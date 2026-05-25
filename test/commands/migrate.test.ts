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
import {
  migrateAll,
  migrateConfig,
  migrateManifests,
  migratePaths,
} from "../../src/commands/migrate.js";

describe("migrateManifests", () => {
  let tmpDir: string;
  let manifestPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-migrate-m-"));
    manifestPath = path.join(tmpDir, ".ai-agents/knowledge/core/manifest.yaml");
    mkdirSync(path.dirname(manifestPath), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("migrates legacy type:core to shared", () => {
    writeFileSync(
      manifestPath,
      stringifyYaml({
        id: "core",
        type: "core",
        files: [{ path: "_framework/foo.md", origin: "framework", auto_load: true }],
      }),
      "utf-8",
    );

    const result = migrateManifests(tmpDir);
    expect(result.skipped).toBe(false);

    const after = parseYaml(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    expect(after.type).toBe("shared");
  });

  it("removes token_estimate / loading_strategy fields", () => {
    writeFileSync(
      manifestPath,
      stringifyYaml({
        id: "core",
        type: "shared",
        token_estimate: 1234,
        loading_strategy: "eager",
        files: [{ path: "x.md", origin: "framework", auto_load: true }],
      }),
      "utf-8",
    );

    const result = migrateManifests(tmpDir);
    expect(result.skipped).toBe(false);

    const after = parseYaml(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    expect(after.token_estimate).toBeUndefined();
    expect(after.loading_strategy).toBeUndefined();
  });

  it("adds origin: user to entries missing origin", () => {
    writeFileSync(
      manifestPath,
      stringifyYaml({
        id: "core",
        type: "shared",
        files: [{ path: "user/foo.md", auto_load: true }],
      }),
      "utf-8",
    );

    migrateManifests(tmpDir);

    const after = parseYaml(readFileSync(manifestPath, "utf-8")) as {
      files: Array<{ origin: string }>;
    };
    expect(after.files[0].origin).toBe("user");
  });

  it("is idempotent (second run is a no-op)", () => {
    writeFileSync(
      manifestPath,
      stringifyYaml({
        id: "core",
        type: "shared",
        files: [{ path: "_framework/foo.md", origin: "framework", auto_load: true }],
      }),
      "utf-8",
    );

    const first = migrateManifests(tmpDir);
    const second = migrateManifests(tmpDir);
    expect(first.skipped).toBe(true);
    expect(second.skipped).toBe(true);
  });

  it("creates a backup before mutating", () => {
    writeFileSync(
      manifestPath,
      stringifyYaml({
        id: "core",
        type: "core",
        files: [],
      }),
      "utf-8",
    );

    const result = migrateManifests(tmpDir);
    expect(result.backup).toBeDefined();
    expect(existsSync(result.backup!)).toBe(true);
  });
});

describe("migratePaths", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-migrate-p-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("moves workspace/project-context.md to knowledge/project/_generated/", () => {
    const oldPath = path.join(tmpDir, ".ai-agents/workspace/project-context.md");
    mkdirSync(path.dirname(oldPath), { recursive: true });
    writeFileSync(oldPath, "# Project\n", "utf-8");

    const result = migratePaths(tmpDir);
    expect(result.skipped).toBe(false);
    expect(existsSync(oldPath)).toBe(false);
    expect(
      existsSync(
        path.join(tmpDir, ".ai-agents/knowledge/project/_generated/project-context.md"),
      ),
    ).toBe(true);
  });

  it("is idempotent (second run is a no-op)", () => {
    const oldPath = path.join(tmpDir, ".ai-agents/workspace/project-context.md");
    mkdirSync(path.dirname(oldPath), { recursive: true });
    writeFileSync(oldPath, "# Project\n", "utf-8");

    const first = migratePaths(tmpDir);
    const second = migratePaths(tmpDir);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
  });

  it("skips when target already exists", () => {
    const oldPath = path.join(tmpDir, ".ai-agents/workspace/project-context.md");
    const newPath = path.join(
      tmpDir,
      ".ai-agents/knowledge/project/_generated/project-context.md",
    );
    mkdirSync(path.dirname(oldPath), { recursive: true });
    mkdirSync(path.dirname(newPath), { recursive: true });
    writeFileSync(oldPath, "old\n", "utf-8");
    writeFileSync(newPath, "new\n", "utf-8");

    const result = migratePaths(tmpDir);
    expect(result.skipped).toBe(true);
    expect(readFileSync(oldPath, "utf-8")).toBe("old\n");
    expect(readFileSync(newPath, "utf-8")).toBe("new\n");
  });
});

describe("migrateConfig", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-migrate-c-"));
    configPath = path.join(tmpDir, ".ai-agents/config.yaml");
    mkdirSync(path.dirname(configPath), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("splits language into interaction_language + document_output_language", () => {
    writeFileSync(
      configPath,
      stringifyYaml({
        version: "2.0",
        preferences: { language: "zh-CN", output: { no_emojis: true } },
      }),
      "utf-8",
    );

    const result = migrateConfig(tmpDir);
    expect(result.skipped).toBe(false);

    const after = parseYaml(readFileSync(configPath, "utf-8")) as {
      preferences: Record<string, unknown>;
    };
    expect(after.preferences.interaction_language).toBe("zh-CN");
    expect(after.preferences.document_output_language).toBe("zh-CN");
    expect(after.preferences.language).toBeUndefined();
  });

  it("is idempotent (second run is a no-op)", () => {
    writeFileSync(
      configPath,
      stringifyYaml({
        version: "2.0",
        preferences: { language: "en-US" },
      }),
      "utf-8",
    );

    const first = migrateConfig(tmpDir);
    const second = migrateConfig(tmpDir);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
  });

  it("preserves existing document_output_language when present", () => {
    writeFileSync(
      configPath,
      stringifyYaml({
        version: "2.0",
        preferences: {
          language: "en-US",
          document_output_language: "zh-CN",
        },
      }),
      "utf-8",
    );

    migrateConfig(tmpDir);

    const after = parseYaml(readFileSync(configPath, "utf-8")) as {
      preferences: Record<string, unknown>;
    };
    expect(after.preferences.interaction_language).toBe("en-US");
    expect(after.preferences.document_output_language).toBe("zh-CN");
  });
});

describe("migrateAll", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-migrate-all-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs all three migrations in one call", () => {
    const manifestPath = path.join(tmpDir, ".ai-agents/knowledge/core/manifest.yaml");
    const oldPath = path.join(tmpDir, ".ai-agents/workspace/project-context.md");
    const configPath = path.join(tmpDir, ".ai-agents/config.yaml");
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    mkdirSync(path.dirname(oldPath), { recursive: true });
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      manifestPath,
      stringifyYaml({ id: "core", type: "core", files: [] }),
      "utf-8",
    );
    writeFileSync(oldPath, "# Project\n", "utf-8");
    writeFileSync(
      configPath,
      stringifyYaml({ version: "2.0", preferences: { language: "en-US" } }),
      "utf-8",
    );

    const result = migrateAll(tmpDir);
    expect(result.manifests.skipped).toBe(false);
    expect(result.paths.skipped).toBe(false);
    expect(result.config.skipped).toBe(false);
  });

  it("is idempotent on already-migrated projects", () => {
    const manifestPath = path.join(tmpDir, ".ai-agents/knowledge/core/manifest.yaml");
    const configPath = path.join(tmpDir, ".ai-agents/config.yaml");
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      manifestPath,
      stringifyYaml({
        id: "core",
        type: "shared",
        files: [{ path: "_framework/foo.md", origin: "framework", auto_load: true }],
      }),
      "utf-8",
    );
    writeFileSync(
      configPath,
      stringifyYaml({
        version: "2.0",
        preferences: {
          interaction_language: "en-US",
          document_output_language: "en-US",
        },
      }),
      "utf-8",
    );

    const result = migrateAll(tmpDir);
    expect(result.manifests.skipped).toBe(true);
    expect(result.paths.skipped).toBe(true);
    expect(result.config.skipped).toBe(true);
  });
});

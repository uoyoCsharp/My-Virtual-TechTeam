import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { materializeProject } from "../../src/fs/materialize.js";
import { updateRegistry } from "../../src/fs/registry-merge.js";

const PACKAGE_ROOT = path.resolve(".");

interface RegistryDoc {
  version?: string;
  knowledge?: Record<string, Record<string, unknown>[]>;
  skills?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

describe("registry merge (map-aware)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-registry-merge-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const registryPath = (): string =>
    path.join(tmpDir, ".ai-agents/registry.yaml");

  function readRegistry(): RegistryDoc {
    return parseYaml(readFileSync(registryPath(), "utf-8")) as RegistryDoc;
  }

  function writeRegistry(doc: RegistryDoc): void {
    writeFileSync(registryPath(), stringifyYaml(doc), "utf-8");
  }

  // ── Existing tests (updated for map structure) ──

  it("fresh install writes the framework registry with header comment intact", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const raw = readFileSync(registryPath(), "utf-8");
    expect(raw).toContain("# MVTT Framework Registry");
    const doc = readRegistry();
    expect(doc.skills && doc.skills["mvt-init"]).toBeTruthy();
  });

  it("install and update produce byte-identical registry output", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const afterInstall = readFileSync(registryPath(), "utf-8");
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const afterUpdate = readFileSync(registryPath(), "utf-8");
    expect(afterUpdate).toBe(afterInstall);
  });

  it("preserves a user custom skill (custom: true) across update", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["app-deploy"] = {
      agent: "developer",
      description: "Deploy the app. This skill should be used when shipping.",
      path: ".claude/skills/app-deploy/SKILL.md",
      template: null,
      category: "utility",
      custom: true,
    };
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    expect(after.skills!["app-deploy"]).toMatchObject({
      custom: true,
      agent: "developer",
    });
    expect(after.skills!["mvt-init"]).toBeTruthy();
  });

  it("drops a user skill that lacks custom: true (treated as retired/legacy)", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["ghost-skill"] = {
      agent: "developer",
      description: "No custom flag.",
      path: ".claude/skills/ghost-skill/SKILL.md",
      template: null,
      category: "utility",
    };
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    expect(after.skills!["ghost-skill"]).toBeUndefined();
  });

  it("re-grafts user-added knowledge bindings onto a framework skill (map shape)", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["mvt-review"].knowledge = {
      _all: [
        { type: "static", source: "knowledge/principle/", files: ["team-rules.md"] },
      ],
    };
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const know = after.skills!["mvt-review"].knowledge as Record<string, unknown>;
    expect(know).toBeTruthy();
    expect(Array.isArray(know._all)).toBe(true);
    const allEntries = know._all as Record<string, unknown>[];
    expect(allEntries.some((k) =>
      Array.isArray(k.files) && (k.files as string[]).includes("team-rules.md"),
    )).toBe(true);
    expect(typeof after.skills!["mvt-review"].description).toBe("string");
  });

  it("refreshes framework skill definitions (user tampering is overwritten)", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["mvt-init"].description = "TAMPERED";
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    expect(after.skills!["mvt-init"].description).not.toBe("TAMPERED");
  });

  it("preserves user additions to knowledge._all, keyed by id", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!._all!.push({
      id: "team-glossary",
      source: "knowledge/project/",
      files: ["glossary.md"],
    });
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const ids = (after.knowledge!._all ?? []).map((e) => e.id);
    expect(ids).toContain("team-glossary");
    expect(ids).toContain("core");
  });

  it("does not duplicate a framework _all entry the user happens to repeat", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!._all!.push({ id: "core", source: "knowledge/core/", files_from_manifest: true });
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const coreCount = (after.knowledge!._all ?? []).filter((e) => e.id === "core").length;
    expect(coreCount).toBe(1);
  });

  it("backs up the existing registry before a merge", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["app-x"] = {
      agent: "developer",
      description: "x",
      path: ".claude/skills/app-x/SKILL.md",
      template: null,
      category: "utility",
      custom: true,
    };
    writeRegistry(doc);

    const result = updateRegistry(tmpDir, PACKAGE_ROOT);
    expect(result.written).toBe(true);
    expect(result.backup).not.toBeNull();
    if (result.backup) expect(existsSync(result.backup)).toBe(true);
    expect(result.customSkillCount).toBe(1);
  });

  it("does not line-fold long description strings on merge", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["app-x"] = {
      agent: "developer",
      description: "x",
      path: ".claude/skills/app-x/SKILL.md",
      template: null,
      category: "utility",
      custom: true,
    };
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const raw = readFileSync(registryPath(), "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*description:\s*(\S.*)?$/.exec(line);
      if (m) {
        expect(m[1] && m[1].length > 0).toBe(true);
      }
    }
    const after = parseYaml(raw) as RegistryDoc;
    expect((after.skills!["mvt-init"].description as string).length).toBeGreaterThan(80);
  });

  it("registry is classified create_once (not flagged as modified-generated)", () => {
    const materialized = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const entry = materialized.find((f) => f.relPath === ".ai-agents/registry.yaml");
    expect(entry).toBeTruthy();
    expect(entry!.category).toBe("create_once");
  });

  // -- New map-aware merge tests --

  it("(#1) project isolation — entries under 'web' not merged into 'api'", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!.web = [
      { id: "web-ctx", source: "knowledge/project/web/", files: ["project-context.md"] },
    ];
    doc.knowledge!.api = [
      { id: "api-ctx", source: "knowledge/project/api/", files: ["project-context.md"] },
    ];
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const webIds = (after.knowledge!.web ?? []).map((e) => e.id);
    const apiIds = (after.knowledge!.api ?? []).map((e) => e.id);
    expect(webIds).toContain("web-ctx");
    expect(webIds).not.toContain("api-ctx");
    expect(apiIds).toContain("api-ctx");
    expect(apiIds).not.toContain("web-ctx");
  });

  it("(#2) _all binding preservation across install+update round-trip", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!._all!.push({
      id: "user-global",
      source: "knowledge/custom/",
      files: ["global.md"],
    });
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const ids = (after.knowledge!._all ?? []).map((e) => e.id);
    expect(ids).toContain("user-global");
    expect(ids).toContain("core");
    expect(ids).toContain("project-context");
  });

  it("(#3) empty project key does not crash merge", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge![""] = [
      { id: "empty-key-entry", source: "knowledge/custom/", files: ["x.md"] },
    ];
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const emptyEntries = after.knowledge![""] ?? [];
    expect(emptyEntries.some((e) => e.id === "empty-key-entry")).toBe(true);
  });

  it("(#4) cross-project same-id collision handled (stableKey distinguishes)", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!.web = [
      { id: "ctx", source: "knowledge/project/web/", files: ["project-context.md"] },
    ];
    doc.knowledge!.api = [
      { id: "ctx", source: "knowledge/project/api/", files: ["project-context.md"] },
    ];
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const webEntries = after.knowledge!.web ?? [];
    const apiEntries = after.knowledge!.api ?? [];
    expect(webEntries.length).toBe(1);
    expect(apiEntries.length).toBe(1);
    expect((webEntries[0] as Record<string, unknown>).source).toBe("knowledge/project/web/");
    expect((apiEntries[0] as Record<string, unknown>).source).toBe("knowledge/project/api/");
  });

  it("(#5) install and update produce byte-identical results for map-shaped inputs", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!.web = [
      { id: "web-ctx", source: "knowledge/project/web/", files: ["project-context.md"] },
    ];
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const afterFirst = readFileSync(registryPath(), "utf-8");

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const afterSecond = readFileSync(registryPath(), "utf-8");

    expect(afterSecond).toBe(afterFirst);
  });

  it("(#6) stableKey does not falsely deduplicate across project keys", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    const identicalEntry = {
      id: "shared-config",
      source: "knowledge/shared/",
      files: ["config.md"],
    };
    doc.knowledge!.web = [identicalEntry];
    doc.knowledge!.api = [identicalEntry];
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    expect((after.knowledge!.web ?? []).length).toBe(1);
    expect((after.knowledge!.api ?? []).length).toBe(1);
  });

  // -- Per-skill knowledge merge tests --

  it("(#1) per-skill: project isolation — entries under 'web' not merged into 'api'", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["mvt-implement"].knowledge = {
      web: [
        { type: "static", source: "knowledge/principle/web/", files: ["standards.md"] },
      ],
      api: [
        { type: "static", source: "knowledge/principle/api/", files: ["standards.md"] },
      ],
    };
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const know = after.skills!["mvt-implement"].knowledge as Record<string, unknown>;
    expect(know).toBeTruthy();
    const webEntries = (know.web ?? []) as Record<string, unknown>[];
    const apiEntries = (know.api ?? []) as Record<string, unknown>[];
    expect(webEntries.some((e) =>
      (e.source as string).includes("web"),
    )).toBe(true);
    expect(webEntries.every((e) =>
      !(e.source as string).includes("api"),
    )).toBe(true);
    expect(apiEntries.some((e) =>
      (e.source as string).includes("api"),
    )).toBe(true);
    expect(apiEntries.every((e) =>
      !(e.source as string).includes("web"),
    )).toBe(true);
  });

  it("(#2) per-skill: _all binding preservation across install+update", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.skills!["mvt-review"].knowledge = {
      _all: [
        { type: "static", source: "knowledge/principle/", files: ["review-rules.md"] },
      ],
    };
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const know = after.skills!["mvt-review"].knowledge as Record<string, unknown>;
    expect(know).toBeTruthy();
    const allEntries = (know._all ?? []) as Record<string, unknown>[];
    expect(allEntries.some((e) =>
      Array.isArray(e.files) && (e.files as string[]).includes("review-rules.md"),
    )).toBe(true);
  });

  // -- Migration tests --

  it("(migration #1) migrates old flat knowledge.shared array to _all key", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    // Simulate old format: knowledge.shared as array
    const oldFormat = {
      ...doc,
      knowledge: {
        shared: [
          ...((doc.knowledge!._all ?? []) as Record<string, unknown>[]),
          { id: "user-added", source: "knowledge/custom/", files: ["custom.md"] },
        ],
      },
    };
    // Remove _all to avoid having both keys
    delete (oldFormat.knowledge as Record<string, unknown>)._all;
    writeRegistry(oldFormat as unknown as RegistryDoc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    // Old shared entries migrated to _all
    const allIds = (after.knowledge!._all ?? []).map((e) => e.id);
    expect(allIds).toContain("core");
    expect(allIds).toContain("user-added");
    // No 'shared' key in the output
    expect(after.knowledge!.shared).toBeUndefined();
  });

  it("(migration #2) migrates old flat per-skill knowledge array to _all key", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    // Simulate old format: skill knowledge as array
    doc.skills!["mvt-review"].knowledge = [
      { type: "static", source: "knowledge/principle/", files: ["team-rules.md"] },
    ] as unknown as Record<string, Record<string, unknown>[]>;
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const know = after.skills!["mvt-review"].knowledge as Record<string, unknown>;
    expect(know).toBeTruthy();
    // Old array migrated to _all key
    const allEntries = (know._all ?? []) as Record<string, unknown>[];
    expect(Array.isArray(allEntries)).toBe(true);
    expect(allEntries.some((e) =>
      Array.isArray(e.files) && (e.files as string[]).includes("team-rules.md"),
    )).toBe(true);
  });
});

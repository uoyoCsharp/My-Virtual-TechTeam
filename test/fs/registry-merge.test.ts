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
  knowledge?: { shared?: Record<string, unknown>[] };
  skills?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

describe("registry merge (Plan A — diff-based preservation)", () => {
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

  it("fresh install writes the framework registry with header comment intact", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const raw = readFileSync(registryPath(), "utf-8");
    // The leading comment header is preserved on the install/merge path.
    expect(raw).toContain("# MVTT Framework Registry");
    const doc = readRegistry();
    expect(doc.skills && doc.skills["mvt-init"]).toBeTruthy();
  });

  it("install and update produce byte-identical registry output", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const afterInstall = readFileSync(registryPath(), "utf-8");
    // Re-materialize (the update path) over an untouched install.
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
    // Framework skills are still present.
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

  it("re-grafts user-added knowledge bindings onto a framework skill", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    // User binds a knowledge entry to the framework skill mvt-review.
    doc.skills!["mvt-review"].knowledge = [
      { type: "static", source: "knowledge/principle/", files: ["team-rules.md"] },
    ];
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const know = after.skills!["mvt-review"].knowledge as Record<string, unknown>[];
    expect(Array.isArray(know)).toBe(true);
    expect(know.some((k) => Array.isArray(k.files) && (k.files as string[]).includes("team-rules.md"))).toBe(true);
    // Framework description is refreshed (verbatim from framework registry).
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

  it("preserves user additions to knowledge.shared, keyed by id", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    doc.knowledge!.shared!.push({
      id: "team-glossary",
      source: "knowledge/project/",
      files: ["glossary.md"],
    });
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const ids = (after.knowledge!.shared ?? []).map((e) => e.id);
    expect(ids).toContain("team-glossary");
    // Framework baseline shared entries remain.
    expect(ids).toContain("core");
  });

  it("does not duplicate a framework shared entry the user happens to repeat", () => {
    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const doc = readRegistry();
    // Re-add an existing framework shared id.
    doc.knowledge!.shared!.push({ id: "core", source: "knowledge/core/", files_from_manifest: true });
    writeRegistry(doc);

    materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });

    const after = readRegistry();
    const coreCount = (after.knowledge!.shared ?? []).filter((e) => e.id === "core").length;
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
    // Force the merge path (not the verbatim fresh-install copy).
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
    // No description value should be folded onto a continuation line: every
    // `description:` key keeps its (long) value on the same physical line.
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*description:\s*(\S.*)?$/.exec(line);
      if (m) {
        expect(m[1] && m[1].length > 0).toBe(true);
      }
    }
    // The doc must still round-trip with full descriptions intact.
    const after = parseYaml(raw) as RegistryDoc;
    expect((after.skills!["mvt-init"].description as string).length).toBeGreaterThan(80);
  });

  it("registry is classified create_once (not flagged as modified-generated)", () => {
    const materialized = materializeProject({ packageRoot: PACKAGE_ROOT, projectRoot: tmpDir });
    const entry = materialized.find((f) => f.relPath === ".ai-agents/registry.yaml");
    expect(entry).toBeTruthy();
    expect(entry!.category).toBe("create_once");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import {
  PLATFORMS,
  SELECTABLE_PLATFORMS,
  DEFAULT_PLATFORMS,
  getPlatformById,
} from "../../src/types/platform.js";

/**
 * src/types/platform.ts is the single source of truth for platform ids and
 * skills directories. Everything that needs the mapping must derive from it:
 * the installer imports it directly, and bundled scripts receive it through the
 * build-time `mvtt:platforms` virtual module (see build-scripts.js).
 */
describe("platform table (single source of truth)", () => {
  it("has unique ids and conventional directories", () => {
    const ids = PLATFORMS.map((platform) => platform.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const platform of PLATFORMS) {
      expect(platform.dir).toBe(`.${platform.id}`);
      expect(platform.skillDir).toBe(`${platform.dir}/skills`);
    }
  });

  it("default platforms resolve to table entries", () => {
    expect(DEFAULT_PLATFORMS.length).toBeGreaterThan(0);
    for (const id of DEFAULT_PLATFORMS) {
      expect(getPlatformById(id)).toBeDefined();
    }
  });

  it("offers only installable targets while keeping legacy ids resolvable", () => {
    expect(SELECTABLE_PLATFORMS.map((platform) => platform.id)).toEqual([
      "claude",
      "agents",
      "qoder",
    ]);

    for (const legacyId of ["cursor", "opencode"]) {
      const legacy = getPlatformById(legacyId);
      expect(legacy).toBeDefined();
      expect(legacy!.selectable).toBe(false);
    }
  });

  it("maps every .agents-compatible harness to one shared write target", () => {
    const agents = getPlatformById("agents");
    expect(agents).toBeDefined();
    expect(agents!.skillDir).toBe(".agents/skills");
    expect(agents!.selectable).not.toBe(false);

    // Exactly one selectable target writes the shared folder, so users never
    // select several harnesses that would materialize the same directory.
    const shared = SELECTABLE_PLATFORMS.filter(
      (platform) => platform.skillDir === ".agents/skills",
    );
    expect(shared.map((platform) => platform.id)).toEqual(["agents"]);
  });

  it("install-manifest.yaml documents a skill pattern for every platform", () => {
    const doc = parseYaml(readFileSync("install-manifest.yaml", "utf-8")) as {
      generated: Array<{ pattern: string }>;
    };
    const patterns = doc.generated.map((entry) => entry.pattern);

    for (const platform of PLATFORMS) {
      expect(patterns).toContain(`${platform.skillDir}/mvt-*/SKILL.md`);
    }
  });
});

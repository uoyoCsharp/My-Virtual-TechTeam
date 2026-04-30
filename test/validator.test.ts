import { describe, it, expect } from "vitest";
import path from "node:path";
import { validateManifest } from "../src/build/validator.js";

const SOURCES_DIR = path.resolve("sources");

describe("validateManifest", () => {
  it("validates a correct manifest without errors", () => {
    const manifestPath = path.resolve(
      SOURCES_DIR,
      "skills/mvt-analyze/manifest.yaml",
    );
    const errors = validateManifest(manifestPath, SOURCES_DIR);
    expect(errors).toHaveLength(0);
  });

  it("validates all 5 skill manifests without errors", () => {
    const skills = [
      "mvt-analyze",
      "mvt-design",
      "mvt-implement",
      "mvt-init",
      "mvt-fix",
    ];
    for (const skill of skills) {
      const manifestPath = path.resolve(
        SOURCES_DIR,
        `skills/${skill}/manifest.yaml`,
      );
      const errors = validateManifest(manifestPath, SOURCES_DIR);
      expect(errors, `${skill} should have no validation errors`).toHaveLength(
        0,
      );
    }
  });

  it("reports error for non-existent manifest", () => {
    const errors = validateManifest("/nonexistent/manifest.yaml", SOURCES_DIR);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("not found");
  });
});

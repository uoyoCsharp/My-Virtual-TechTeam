/**
 * Central place for framework paths inside a user project.
 *
 * The directory name is part of MVTT's persistent contract with user projects;
 * keep every read/write path derived from these constants.
 */

/** Directory MVTT owns inside a project (v3+). */
export const FRAMEWORK_DIR = ".mvtt";

/** Previous directory name; only used by the one-time legacy migration. */
export const LEGACY_FRAMEWORK_DIR = ".ai-agents";

/** Join segments relative to the framework directory, using "/" separators. */
export function fw(...segments: string[]): string {
  return [FRAMEWORK_DIR, ...segments].join("/");
}

export const MANIFEST_REL = fw(".mvtt-manifest.json");
export const REGISTRY_REL = fw("registry.yaml");
export const BACKUP_DIR_REL = fw(".backup");

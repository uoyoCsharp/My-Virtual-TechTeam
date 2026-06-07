import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FRAMEWORK_REGISTRY_REL = "registry.yaml";
const USER_REGISTRY_REL = ".ai-agents/registry.yaml";
const BACKUP_DIR_REL = ".ai-agents/.backup";

// The registry schema is open-ended (skills carry optional knowledge bindings,
// next_suggestions, variants, etc. that the merge must pass through untouched),
// so this module works on loosely-typed parsed YAML rather than the strict
// Registry type. Only the fields the merge actually reasons about are named.
type Dict = Record<string, unknown>;

interface RegistryDoc {
  knowledge?: Record<string, unknown[]>;
  skills?: Record<string, Dict>;
  [key: string]: unknown;
}

export interface RegistryMergeResult {
  written: boolean;
  backup: string | null;
  frameworkSkillCount: number;
  customSkillCount: number;
  preservedBindingCount: number;
}

/**
 * Deterministic, order-independent key for a knowledge binding so two entries
 * with the same content compare equal regardless of YAML key order.
 */
function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Dict).sort();
    return `{${keys.map((k) => `${k}:${stableKey((value as Dict)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readRegistry(filePath: string): RegistryDoc | null {
  if (!existsSync(filePath)) return null;
  const parsed = parseYaml(readFileSync(filePath, "utf-8")) as unknown;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as RegistryDoc;
}

/**
 * Preserve the framework file's leading comment block (documentation header)
 * when we have to re-serialize the merged document, since stringify() drops
 * comments.
 */
function leadingComments(raw: string): string {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      out.push(line);
    } else {
      break;
    }
  }
  return out.length > 0 ? out.join("\n") + "\n" : "";
}

function backupRegistry(projectRoot: string, sourcePath: string): string {
  const backupDir = path.resolve(projectRoot, BACKUP_DIR_REL);
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `registry-${stamp}.yaml`);
  copyFileSync(sourcePath, backupPath);
  return backupPath;
}

/**
 * Merge a fresh framework registry with the user's existing registry,
 * preserving user-authored content (diff-based, no markers required).
 *
 * Rules:
 * - Framework skills (those present in the framework registry) take the NEW
 *   framework definition verbatim. Any knowledge bindings the user added to a
 *   framework skill (entries present in the user copy but absent from the
 *   framework copy) are re-grafted onto the refreshed entry.
 * - User custom skills (present in the user registry, absent from the framework
 *   registry, and flagged `custom: true`) are preserved as-is.
 * - User skills that are neither framework skills nor flagged `custom: true`
 *   are dropped (retired framework skills / legacy/malformed entries).
 * - `knowledge` is a project-keyed map. Each key (e.g. "_all",
 *   "web", "api") is the framework baseline plus user additions not already
 *   present (keyed by `id`, falling back to deep content equality). Both
 *   top-level and per-skill knowledge maps are merged independently.
 * - Old flat arrays (pre-migration: `knowledge.shared` or `skills.*.knowledge`
 *   as arrays) are treated as the `_all` key during merge.
 */
function mergeRegistry(
  framework: RegistryDoc,
  user: RegistryDoc,
): { merged: RegistryDoc; result: Omit<RegistryMergeResult, "written" | "backup"> } {
  const fwSkills = framework.skills ?? {};
  const userSkills = user.skills ?? {};

  const mergedSkills: Record<string, Dict> = {};
  let preservedBindingCount = 0;

  // --- Per-skill knowledge merge (map-aware) ---
  // For each framework skill: refresh from framework, re-graft user-added
  // knowledge entries per project key.
  for (const [name, fwEntry] of Object.entries(fwSkills)) {
    const next = clone(fwEntry);
    const userEntry = userSkills[name];

    if (userEntry && userEntry.custom !== true) {
      const fwKnowRaw = fwEntry.knowledge;
      const userKnowRaw = userEntry.knowledge;

      // Normalize: map or old array -> map with _all key
      const fwKnowMap: Record<string, unknown[]> =
        Array.isArray(fwKnowRaw)
          ? { _all: fwKnowRaw as unknown[] }
          : ((fwKnowRaw as Record<string, unknown[]>) ?? {});
      const userKnowMap: Record<string, unknown[]> =
        Array.isArray(userKnowRaw)
          ? { _all: userKnowRaw as unknown[] }
          : ((userKnowRaw as Record<string, unknown[]>) ?? {});
      // Migration: old per-skill "shared" key -> "_all"
      if (Array.isArray(userKnowMap.shared)) {
        userKnowMap._all = [...(userKnowMap._all ?? []), ...userKnowMap.shared];
        delete userKnowMap.shared;
      }

      const allKeys = new Set([...Object.keys(fwKnowMap), ...Object.keys(userKnowMap)]);
      const mergedSkillKnowledge: Record<string, unknown[]> = {};

      for (const key of allKeys) {
        const fwEntries = fwKnowMap[key] ?? [];
        const userEntries = userKnowMap[key] ?? [];
        const fwKeys = new Set(
          fwEntries.map((e) =>
            typeof (e as Dict)?.id === "string"
              ? `id:${(e as Dict).id as string}`
              : stableKey(e),
          ),
        );
        const additions = userEntries.filter((e) => !fwKeys.has(stableKey(e)));
        mergedSkillKnowledge[key] = [...clone(fwEntries), ...clone(additions)];
        preservedBindingCount += additions.length;
      }

      if (Object.keys(mergedSkillKnowledge).length > 0) {
        next.knowledge = mergedSkillKnowledge;
      }
    }

    mergedSkills[name] = next;
  }

  // User custom skills not part of the framework set.
  let customSkillCount = 0;
  for (const [name, userEntry] of Object.entries(userSkills)) {
    if (mergedSkills[name]) continue;
    if (userEntry && userEntry.custom === true) {
      mergedSkills[name] = clone(userEntry);
      customSkillCount += 1;
    }
    // Otherwise drop: a retired framework skill or a legacy/unmarked entry.
  }

  // --- Top-level knowledge map merge ---
  // Normalize old flat format (knowledge.shared as array) -> _all key.
  const fwKnowRaw = framework.knowledge;
  const userKnowRaw = user.knowledge;

  const fwKnowMap: Record<string, unknown[]> =
    Array.isArray(fwKnowRaw)
      ? { _all: fwKnowRaw as unknown[] }
      : (fwKnowRaw ?? {});
  const userKnowMap: Record<string, unknown[]> =
    Array.isArray(userKnowRaw)
      ? { _all: userKnowRaw as unknown[] }
      : (userKnowRaw ?? {});
  // Migration: old top-level "shared" key -> "_all"
  if (Array.isArray(userKnowMap.shared)) {
    userKnowMap._all = [...(userKnowMap._all ?? []), ...userKnowMap.shared];
    delete userKnowMap.shared;
  }

  const allKeys = new Set([...Object.keys(fwKnowMap), ...Object.keys(userKnowMap)]);
  const mergedKnowledge: Record<string, unknown[]> = {};

  for (const key of allKeys) {
    const fwEntries = fwKnowMap[key] ?? [];
    const userEntries = userKnowMap[key] ?? [];
    const keyOf = (e: unknown): string =>
      typeof (e as Dict)?.id === "string"
        ? `id:${(e as Dict).id as string}`
        : stableKey(e);
    const fwKeys = new Set(fwEntries.map(keyOf));
    const additions = userEntries.filter((e) => !fwKeys.has(keyOf(e)));
    mergedKnowledge[key] = [...clone(fwEntries), ...clone(additions)];
    preservedBindingCount += additions.length;
  }

  const merged: RegistryDoc = {
    ...framework,
    knowledge: mergedKnowledge,
    skills: mergedSkills,
  };

  return {
    merged,
    result: {
      frameworkSkillCount: Object.keys(fwSkills).length,
      customSkillCount,
      preservedBindingCount,
    },
  };
}

/**
 * Reconcile the project's `.ai-agents/registry.yaml` with the framework
 * registry shipped in the package, preserving user-authored skills and
 * knowledge bindings across `mvtt update`.
 *
 * On a fresh install (no existing user registry) the framework file is copied
 * verbatim so its documentation comments survive. When a user registry already
 * exists it is backed up to `.ai-agents/.backup/` and rewritten with the merged
 * result.
 */
export function updateRegistry(projectRoot: string, packageRoot: string): RegistryMergeResult {
  const frameworkPath = path.resolve(packageRoot, FRAMEWORK_REGISTRY_REL);
  const userPath = path.resolve(projectRoot, USER_REGISTRY_REL);

  const frameworkRaw = existsSync(frameworkPath) ? readFileSync(frameworkPath, "utf-8") : null;
  const framework = readRegistry(frameworkPath);
  if (!frameworkRaw || !framework) {
    return {
      written: false,
      backup: null,
      frameworkSkillCount: 0,
      customSkillCount: 0,
      preservedBindingCount: 0,
    };
  }

  mkdirSync(path.dirname(userPath), { recursive: true });

  // Install and update share one path: a fresh install is just a merge against
  // an empty user registry. This guarantees `mvtt install` and `mvtt update`
  // produce byte-identical output (no verbatim-copy vs re-serialize drift).
  const existingUser = readRegistry(userPath) ?? {};

  let backup: string | null = null;
  if (existsSync(userPath)) {
    backup = backupRegistry(projectRoot, userPath);
  }

  const { merged, result } = mergeRegistry(framework, existingUser);
  // lineWidth: 0 disables YAML line folding so long `description` strings stay
  // on a single line. Only the framework file's leading comment header is
  // preserved (yaml.stringify drops comments); inline section comments are not.
  const serialized =
    leadingComments(frameworkRaw) + stringifyYaml(merged, { lineWidth: 0 });
  writeFileSync(userPath, serialized, "utf-8");

  return { written: true, backup, ...result };
}

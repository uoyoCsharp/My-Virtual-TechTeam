import { existsSync } from "node:fs";
import path from "node:path";
import { materializeProject } from "./materialize.js";
import { removeStaleGeneratedFiles } from "./generated-cleanup.js";
import {
  readCustomSkillNames,
  syncCustomSkillsToTargets,
  type CustomSkillSyncResult,
} from "./custom-skills.js";
import {
  writeInstallationManifest,
  type InstallationManifest,
} from "./install-manifest.js";
import type { PlatformId } from "../types/platform.js";
import { getPlatformById } from "../types/platform.js";

export interface ApplyPlatformTargetsOptions {
  projectRoot: string;
  packageRoot: string;
  version: string;
  previous: InstallationManifest;
  previousPlatforms: PlatformId[];
  nextPlatforms: PlatformId[];
}

export interface ApplyPlatformTargetsResult {
  added: PlatformId[];
  removed: PlatformId[];
  materializedCount: number;
  removedFiles: string[];
  customSkills: CustomSkillSyncResult;
  leftoverCustomDirs: string[];
}

export function applyPlatformTargets(
  options: ApplyPlatformTargetsOptions,
): ApplyPlatformTargetsResult {
  const { projectRoot, packageRoot, version, previous, previousPlatforms, nextPlatforms } = options;

  if (nextPlatforms.length === 0) {
    throw new Error("At least one platform target is required.");
  }

  const added = nextPlatforms.filter((id) => !previousPlatforms.includes(id));
  const removed = previousPlatforms.filter((id) => !nextPlatforms.includes(id));

  const skillDirOf = (id: PlatformId): string | undefined => getPlatformById(id)?.skillDir;

  const materialized = materializeProject({
    packageRoot,
    projectRoot,
    platforms: nextPlatforms,
    overwriteCreateOnce: false,
    backup: false,
  });

  const sourceSkillDirs = [
    ...new Set(
      [...previousPlatforms, ...nextPlatforms]
        .map(skillDirOf)
        .filter((dir): dir is string => Boolean(dir)),
    ),
  ];
  const targetSkillDirs = [
    ...new Set(
      nextPlatforms.map(skillDirOf).filter((dir): dir is string => Boolean(dir)),
    ),
  ];
  const customSkills = syncCustomSkillsToTargets(
    projectRoot,
    sourceSkillDirs,
    targetSkillDirs,
  );

  const removedFiles = removeStaleGeneratedFiles(projectRoot, previous.files, materialized);

  const leftoverCustomDirs: string[] = [];
  const customNames = readCustomSkillNames(projectRoot);
  for (const id of removed) {
    const skillDir = skillDirOf(id);
    if (!skillDir) continue;
    for (const name of customNames) {
      if (existsSync(path.join(projectRoot, skillDir, name))) {
        leftoverCustomDirs.push(`${skillDir}/${name}`);
      }
    }
  }

  writeInstallationManifest(projectRoot, version, materialized, previous, nextPlatforms);

  return {
    added,
    removed,
    materializedCount: materialized.length,
    removedFiles,
    customSkills,
    leftoverCustomDirs,
  };
}

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const FRAMEWORK_DIR = ".mvtt";
const LEGACY_FRAMEWORK_DIR = ".ai-agents";

/**
 * Resolve the framework directory. New installs use `.mvtt`; `.ai-agents` is
 * still recognized so scripts bundled with a newer CLI can operate on a project
 * that has not been migrated yet (the CLI migrates it on the next update).
 */
export function findFrameworkDir(projectRoot) {
  if (existsSync(join(projectRoot, FRAMEWORK_DIR))) return FRAMEWORK_DIR;
  if (existsSync(join(projectRoot, LEGACY_FRAMEWORK_DIR))) return LEGACY_FRAMEWORK_DIR;
  return null;
}

export function findProjectRoot(startPath = process.cwd()) {
  let current = resolve(startPath);
  while (true) {
    if (findFrameworkDir(current)) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function toWorkspaceRelative(projectRoot, filePath) {
  return relative(projectRoot, filePath).split(sep).join("/");
}

export function listLiveChangeDirs(projectRoot) {
  const frameworkDir = findFrameworkDir(projectRoot);
  if (!frameworkDir) return [];
  const artifactsDir = join(projectRoot, frameworkDir, "workspace", "artifacts");
  if (!existsSync(artifactsDir)) return [];

  return readdirSync(artifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_archived")
    .map((entry) => join(artifactsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function listFilesRecursively(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursively(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

export function scanLiveArtifacts(projectRoot, mode) {
  const changeDirs = listLiveChangeDirs(projectRoot);

  if (mode === "change-dirs") {
    return changeDirs.map((directory) => toWorkspaceRelative(projectRoot, directory));
  }

  if (mode === "plans") {
    return changeDirs
      .map((directory) => join(directory, "plan.yaml"))
      .filter((planPath) => existsSync(planPath) && statSync(planPath).isFile())
      .map((planPath) => toWorkspaceRelative(projectRoot, planPath));
  }

  if (mode === "files") {
    return changeDirs
      .flatMap((directory) => listFilesRecursively(directory))
      .map((filePath) => toWorkspaceRelative(projectRoot, filePath))
      .sort((left, right) => left.localeCompare(right));
  }

  throw new Error(`Invalid --mode "${mode}". Must be one of: plans, change-dirs, files.`);
}
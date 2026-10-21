import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

export function removeStaleGeneratedFiles(
  projectRoot: string,
  previousFiles: Record<string, { category: string; hash: string }>,
  current: Array<{ relPath: string; category: string }>,
): string[] {
  const currentSet = new Set(current.map((m) => m.relPath));
  const removed: string[] = [];

  for (const [relPath, record] of Object.entries(previousFiles)) {
    if (record.category !== "generated") continue;
    if (currentSet.has(relPath)) continue;

    const absPath = path.resolve(projectRoot, relPath);
    if (!existsSync(absPath)) continue;

    rmSync(absPath, { force: true });
    removed.push(relPath);

    let parent = path.dirname(absPath);
    const stopAt = path.resolve(projectRoot);
    while (parent.startsWith(stopAt) && parent !== stopAt) {
      if (!existsSync(parent)) break;
      const entries = readdirSync(parent);
      if (entries.length > 0) break;
      rmSync(parent, { recursive: true, force: true });
      parent = path.dirname(parent);
    }
  }

  return removed;
}

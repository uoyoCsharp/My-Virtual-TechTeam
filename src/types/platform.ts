export type PlatformId = "claude" | "qoder";

export interface PlatformDef {
  id: PlatformId;
  dir: string;
  skillDir: string;
  description: string;
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "claude",
    dir: ".claude",
    skillDir: ".claude/skills",
    description: "Claude Code / Claude Desktop / Github Copilot",
  },
  {
    id: "qoder",
    dir: ".qoder",
    skillDir: ".qoder/skills",
    description: "Qoder IDE",
  },
];

export const DEFAULT_PLATFORMS: PlatformId[] = ["claude"];

export function getPlatformById(id: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getPlatformsByIds(ids: PlatformId[]): PlatformDef[] {
  return ids
    .map((id) => getPlatformById(id))
    .filter((p): p is PlatformDef => p !== undefined);
}

export type PlatformId = "claude" | "agents" | "qoder" | "cursor" | "opencode";

export interface PlatformDef {
  id: PlatformId;
  dir: string;
  skillDir: string;
  description: string;
  selectable?: boolean;
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "claude",
    dir: ".claude",
    skillDir: ".claude/skills",
    description: "Claude Code",
  },
  {
    id: "agents",
    dir: ".agents",
    skillDir: ".agents/skills",
    description:
      "Codex / DeepSeek Harness / GitHub Copilot / Cursor / OpenCode / Gemini / Windsurf (shared .agents folder)",
  },
  {
    id: "qoder",
    dir: ".qoder",
    skillDir: ".qoder/skills",
    description: "Qoder IDE",
  },
  {
    id: "cursor",
    dir: ".cursor",
    skillDir: ".cursor/skills",
    description: "Cursor IDE (native path; the .agents target covers Cursor too)",
    selectable: false,
  },
  {
    id: "opencode",
    dir: ".opencode",
    skillDir: ".opencode/skills",
    description: "Opencode CLI (native path; the .agents target covers OpenCode too)",
    selectable: false,
  },
];

export const SELECTABLE_PLATFORMS: PlatformDef[] = PLATFORMS.filter(
  (platform) => platform.selectable !== false,
);

export const DEFAULT_PLATFORMS: PlatformId[] = ["claude"];

export function getPlatformById(id: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getPlatformsByIds(ids: PlatformId[]): PlatformDef[] {
  return ids
    .map((id) => getPlatformById(id))
    .filter((p): p is PlatformDef => p !== undefined);
}

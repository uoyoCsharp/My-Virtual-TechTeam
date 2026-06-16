export interface SkillEntry {
  description: string;
  knowledge?: Record<string, unknown[]>;
  [key: string]: unknown;
}

export interface Registry {
  version: string;
  last_updated: string;
  knowledge?: Record<string, unknown[]>;
  skills: Record<string, SkillEntry>;
}

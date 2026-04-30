export interface NextSuggestions {
  primary: string;
  primary_desc: string;
  alternatives?: Array<{
    skill: string;
    when: string;
  }>;
}

export interface SkillEntry {
  agent: string;
  description: string;
  path: string;
  template: string | null;
  category: "workflow" | "shortcut" | "utility" | "project";
  mode: string;
  phase?: string | null;
  depends_on?: string[];
  next_suggestions?: NextSuggestions;
}

export interface Registry {
  version: string;
  last_updated: string;
  skills: Record<string, SkillEntry>;
}

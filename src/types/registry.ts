export interface NextSuggestionBranch {
  condition: string;
  primary: string;
  primary_desc: string;
}

export interface NextSuggestionAlternative {
  skill: string;
  desc?: string;
  when?: string;
}

export interface NextSuggestions {
  // Legacy single-primary form (still supported by existing skills)
  primary?: string;
  primary_desc?: string;
  // New conditional form: at least one branch must have condition: "default"
  conditional?: NextSuggestionBranch[];
  alternatives?: NextSuggestionAlternative[];
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

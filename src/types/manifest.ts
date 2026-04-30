export interface SectionInline {
  type: "inline";
  content: string;
}

export interface SectionFile {
  type: "file";
  source: string;
}

export interface SectionShared {
  type: "shared" | "template";
  source: string;
  params?: Record<string, unknown>;
}

export type Section = SectionInline | SectionFile | SectionShared;

export interface Manifest {
  name: string;
  output: string;
  frontmatter: Record<string, string>;
  sections: Section[];
}

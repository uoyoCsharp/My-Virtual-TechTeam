export type FileOrigin = "framework" | "user";

export interface CoreManifestFile {
  path: string;
  origin: FileOrigin;
  auto_load: boolean;
}

export interface CoreManifest {
  id: string;
  type: string;
  files: CoreManifestFile[];
}

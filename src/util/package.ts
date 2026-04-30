import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getPackageRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

export function getVersion(): string {
  const pkg = JSON.parse(
    readFileSync(path.resolve(getPackageRoot(), "package.json"), "utf-8"),
  );
  return pkg.version;
}

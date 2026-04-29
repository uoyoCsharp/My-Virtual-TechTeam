import { readFileSync } from "node:fs";
import path from "node:path";
import type { Section } from "../types/manifest.js";

const BLOCK_PATTERN = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}\n?/g;
const VAR_PATTERN = /\{\{(\w+|\.)?\}\}/g;

function replaceVars(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(VAR_PATTERN, (_match, key: string) => {
    if (key === ".") return String(vars["."] ?? "");
    const val = vars[key];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

function expandBlocks(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(BLOCK_PATTERN, (_match, key: string, rawBody: string) => {
    const val = params[key];
    if (val === undefined || val === null || val === false) return "";
    const body = rawBody.replace(/^\n/, "");
    if (Array.isArray(val)) {
      return val
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return replaceVars(body, item as Record<string, unknown>).trimEnd();
          }
          return replaceVars(body, { ".": item }).trimEnd();
        })
        .join("\n");
    }
    return replaceVars(body, params);
  });
}

export function applyParams(
  template: string,
  params: Record<string, unknown>,
): string {
  let result = expandBlocks(template, params);
  result = replaceVars(result, params);
  return result;
}

export function loadSection(
  section: Section,
  skillDir: string,
  sourcesDir: string,
): string {
  switch (section.type) {
    case "inline":
      return section.content;

    case "file": {
      const filePath = path.resolve(skillDir, section.source);
      return readFileSync(filePath, "utf-8");
    }

    case "shared":
    case "template": {
      const filePath = path.resolve(sourcesDir, section.source);
      let content = readFileSync(filePath, "utf-8");
      if (section.params) {
        content = applyParams(content, section.params);
      }
      return content;
    }
  }
}

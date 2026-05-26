import { readFileSync } from "node:fs";
import path from "node:path";
import type { Section } from "../types/manifest.js";

const BLOCK_PATTERN = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}\n?/g;
const INVERTED_PATTERN = /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}\n?/g;
const COND_PATTERN = /\{\{\?(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}\n?/g;
const VAR_PATTERN = /\{\{(\w+|\.)?\}\}/g;

function isTruthyNonEmpty(val: unknown): boolean {
  if (val === undefined || val === null || val === false || val === "") return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

function readTemplate(filePath: string): string {
  return readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
}

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
    if (Array.isArray(val) && val.length === 0) return "";
    const body = rawBody.replace(/^\n/, "").replace(/\n$/, "");
    if (Array.isArray(val)) {
      const items = val
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return replaceVars(body, item as Record<string, unknown>).trimEnd();
          }
          return replaceVars(body, { ".": item }).trimEnd();
        })
        .join("\n");
      return items + "\n";
    }
    return replaceVars(body, params) + "\n";
  });
}

function expandInverted(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(INVERTED_PATTERN, (_match, key: string, rawBody: string) => {
    if (isTruthyNonEmpty(params[key])) return "";
    const body = rawBody.replace(/^\n/, "").replace(/\n$/, "");
    return body + "\n";
  });
}

function expandConditionals(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(COND_PATTERN, (_match, key: string, rawBody: string) => {
    if (!isTruthyNonEmpty(params[key])) return "";
    const body = rawBody.replace(/^\n/, "").replace(/\n$/, "");
    return body + "\n";
  });
}

export function applyParams(
  template: string,
  params: Record<string, unknown>,
): string {
  let result = expandConditionals(template, params);
  result = expandBlocks(result, params);
  result = expandInverted(result, params);
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
      return section.content.replace(/\r\n/g, "\n");

    case "file": {
      const filePath = path.resolve(skillDir, section.source);
      return readTemplate(filePath);
    }

    case "shared":
    case "template": {
      const filePath = path.resolve(sourcesDir, section.source);
      const content = readTemplate(filePath);
      return applyParams(content, section.params ?? {});
    }
  }
}

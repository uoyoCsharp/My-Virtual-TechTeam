#!/usr/bin/env node

/**
 * requirement-source.js — Read-only requirement source utility
 *
 * Deterministic, read-only commands for epic requirement provenance:
 *   --fingerprint <source_path>      normalize a source path and SHA-256 fingerprint it
 *   --verify-epic <epic_path>        validate the v1/v2 context schema and report source drift
 *   --effective-context <epic_path> --child <change_id>
 *                                     project the bounded effective context for one child
 *
 * Mirrors epic-update.js structure and output protocol: exit 0 = single-line
 * JSON on stdout, exit 1 = plain-text error on stderr. Never writes files.
 *
 * NOTE: This source file uses `import from "yaml"`. During the build pipeline,
 * esbuild bundles it into a zero-dependency single file deployed to
 * .ai-agents/scripts/requirement-source.cjs.
 *
 * Usage: see the authoritative reference at .ai-agents/scripts/requirement-source.md.
 */

import { readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

// ── Constants ─────────────────────────────────────────────────────────────
const VALID_KINDS = ["file", "conversation"];
const VALID_CATEGORIES = [
  "goal",
  "in_scope",
  "out_of_scope",
  "business_rule",
  "constraint",
  "example",
  "decision",
];

const ERRORS = {
  NO_OPERATION: () =>
    "No operation specified. Use --fingerprint, --verify-epic, or --effective-context.",
  CONFLICTING_MODES: (modes) => `Conflicting modes: --${modes.join(", --")}. Use exactly one mode per invocation.`,
  MISSING_FINGERPRINT_PATH: () => "Missing required argument: --fingerprint <source_path>",
  MISSING_VERIFY_PATH: () => "Missing required argument: --verify-epic <epic_path>",
  MISSING_EFFECTIVE_PATH: () => "Missing required argument: --effective-context <epic_path>",
  CHILD_REQUIRED: () => "--effective-context requires --child <change_id>",
  CHILD_WITHOUT_MODE: () => "--child requires --effective-context",
  EPIC_NOT_FOUND: (p) => `Epic file not found at ${p}.`,
  EPIC_PARSE_FAILED: (detail) => `Failed to parse epic YAML: ${detail}`,
  CONTEXT_VALIDATION_FAILED: (errs) =>
    `Epic context validation failed:\n  - ${errs.join("\n  - ")}`,
  CHILD_NOT_FOUND: (id, valid) =>
    `Child "${id}" not found. Valid children: ${valid.length ? valid.join(", ") : "(none)"}.`,
  SOURCE_NOT_FOUND: (p) => `Source file not found at ${p}.`,
  SOURCE_NOT_REGULAR: (p) => `Source is not a readable regular file: ${p}.`,
  SOURCE_UNREADABLE: (p, detail) => `Source file is not readable: ${p} (${detail}).`,
};

// ── Path helpers ───────────────────────────────────────────────────────────
function toPosix(p) {
  return p.split(sep).join("/");
}

// Walk upward from `start` until a directory containing `.ai-agents` is found.
function findWorkspaceRoot(start) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, ".ai-agents"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

// Normalize a source path into a stored reference.
// Inside the workspace: workspace-root-relative POSIX path.
// Outside the workspace: normalized absolute POSIX path.
function normalizeSourceReference(absPath, workspaceRoot) {
  if (workspaceRoot && isInside(workspaceRoot, absPath)) {
    return {
      reference: toPosix(relative(workspaceRoot, absPath)),
      reference_base: "workspace",
    };
  }
  return { reference: toPosix(absPath), reference_base: "absolute" };
}

// Resolve a stored reference to an absolute filesystem path.
// Relative references resolve against the workspace root (fallback: the epic's
// directory), never against process cwd.
function resolveStoredReference(reference, workspaceRoot, epicPath) {
  if (isAbsolute(reference)) return resolve(reference);
  const base = workspaceRoot || dirname(resolve(epicPath));
  return resolve(base, reference);
}

function sha256Hex(buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function fingerprintFile(absPath) {
  let st;
  try {
    st = statSync(absPath);
  } catch (e) {
    if (e.code === "ENOENT") return { error: ERRORS.SOURCE_NOT_FOUND(absPath) };
    return { error: ERRORS.SOURCE_UNREADABLE(absPath, e.code || e.message) };
  }
  if (!st.isFile()) return { error: ERRORS.SOURCE_NOT_REGULAR(absPath) };

  let buffer;
  try {
    buffer = readFileSync(absPath);
  } catch (e) {
    return { error: ERRORS.SOURCE_UNREADABLE(absPath, e.code || e.message) };
  }
  return { size: buffer.length, fingerprint: sha256Hex(buffer) };
}

// ── Schema validation ──────────────────────────────────────────────────────
// Schema rules (ADR-1 revision):
//   version 1: legacy. No context validation when requirement_context is absent;
//              a complete requirement_context is accepted and validated (migration-friendly).
//   version 2: must contain requirement_context; every child needs context_refs.
//   Anything else, or a v2 epic missing requirement_context, is invalid.
function getVersion(epic) {
  if (epic.version === undefined || epic.version === null || epic.version === "") return 1;
  const n = Number(epic.version);
  return Number.isNaN(n) ? null : n;
}

function segmentsValid(reference) {
  return reference
    .split("/")
    .every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

function validateContext(epic) {
  const errors = [];
  const version = getVersion(epic);

  if (version === null || (version !== 1 && version !== 2)) {
    errors.push(`Unsupported epic version "${String(epic.version)}" (must be 1 or 2)`);
    return errors;
  }

  const hasContext =
    epic.requirement_context !== undefined && epic.requirement_context !== null;
  const children = Array.isArray(epic.children) ? epic.children : [];

  if (version === 2 && !hasContext) {
    errors.push("version 2 epic requires requirement_context");
    return errors;
  }

  if (!hasContext) {
    // Legacy epic without requirement context: no context validation.
    return errors;
  }

  const ctx = epic.requirement_context;
  const sources = Array.isArray(ctx.sources) ? ctx.sources : null;
  const items = Array.isArray(ctx.items) ? ctx.items : null;

  if (!sources || sources.length === 0) {
    errors.push("requirement_context.sources must be a non-empty array");
  }
  if (!items || items.length === 0) {
    errors.push("requirement_context.items must be a non-empty array");
  }
  if (
    ctx.global_refs !== undefined &&
    ctx.global_refs !== null &&
    !Array.isArray(ctx.global_refs)
  ) {
    errors.push("requirement_context.global_refs must be an array");
  }
  const globalRefs = Array.isArray(ctx.global_refs) ? ctx.global_refs : [];

  const sourceIds = new Set();
  for (const s of sources || []) {
    if (!s || typeof s.id !== "string" || s.id === "") {
      errors.push("Every source must have a non-empty string id");
      continue;
    }
    if (sourceIds.has(s.id)) errors.push(`Duplicate source id "${s.id}"`);
    sourceIds.add(s.id);

    if (!VALID_KINDS.includes(s.kind)) {
      errors.push(
        `Source "${s.id}" has invalid kind "${s.kind}" (must be file or conversation)`
      );
      continue;
    }
    if (s.kind === "file") {
      if (typeof s.reference !== "string" || s.reference === "") {
        errors.push(`File source "${s.id}" requires a non-empty reference`);
      } else if (!isAbsolute(s.reference)) {
        const ref = s.reference.split("\\").join("/");
        if (!segmentsValid(ref)) {
          errors.push(
            `File source "${s.id}" reference must not contain "." or ".." segments`
          );
        }
      }
      if (typeof s.fingerprint !== "string" || !/^sha256:[0-9a-f]{64}$/.test(s.fingerprint)) {
        errors.push(`File source "${s.id}" requires a sha256:<hex> fingerprint`);
      }
    } else {
      if (s.reference !== "conversation") {
        errors.push(`Conversation source "${s.id}" must have reference "conversation"`);
      }
      if (s.fingerprint !== undefined && s.fingerprint !== null) {
        errors.push(`Conversation source "${s.id}" must not have a fingerprint`);
      }
    }
  }

  const itemIds = new Set();
  for (const item of items || []) {
    if (!item || typeof item.id !== "string" || item.id === "") {
      errors.push("Every item must have a non-empty string id");
      continue;
    }
    if (itemIds.has(item.id)) errors.push(`Duplicate item id "${item.id}"`);
    itemIds.add(item.id);

    if (!VALID_CATEGORIES.includes(item.category)) {
      errors.push(`Item "${item.id}" has invalid category "${item.category}"`);
    }
    if (typeof item.summary !== "string" || item.summary === "") {
      errors.push(`Item "${item.id}" requires a non-empty summary`);
    }
    const refs = Array.isArray(item.source_ids) ? item.source_ids : [];
    if (refs.length === 0) {
      errors.push(`Item "${item.id}" requires at least one source_ids entry`);
    }
    for (const r of refs) {
      if (!sourceIds.has(r)) errors.push(`Item "${item.id}" references unknown source "${r}"`);
    }
  }

  for (const ref of globalRefs) {
    if (!itemIds.has(ref)) errors.push(`global_refs references unknown item "${ref}"`);
  }

  for (const c of children) {
    const refs = Array.isArray(c.context_refs) ? c.context_refs : [];
    if (version === 2 && refs.length === 0) {
      errors.push(`Child "${c.change_id}" requires at least one context_refs entry`);
    }
    for (const r of refs) {
      if (!itemIds.has(r)) {
        errors.push(`Child "${c.change_id}" context_refs references unknown item "${r}"`);
      }
    }
  }

  return errors;
}

// ── Source verification ────────────────────────────────────────────────────
// Statuses: unchanged | changed | missing | unverifiable.
// warnings[] carries user-facing messages for non-unchanged states only.
function verifySources(epic, workspaceRoot, epicPath) {
  const sources = [];
  const warnings = [];

  for (const s of epic.requirement_context.sources) {
    if (s.kind === "conversation") {
      // Nothing to compare for conversation provenance.
      sources.push({ id: s.id, status: "unchanged", reference: "conversation" });
      continue;
    }

    const abs = resolveStoredReference(s.reference, workspaceRoot, epicPath);
    let st;
    try {
      st = statSync(abs);
    } catch (e) {
      if (e.code === "ENOENT") {
        sources.push({ id: s.id, status: "missing", reference: s.reference });
        warnings.push({
          source_id: s.id,
          code: "source_missing",
          message: `Requirement source "${s.id}" is missing at ${s.reference}.`,
        });
      } else {
        sources.push({ id: s.id, status: "unverifiable", reference: s.reference });
        warnings.push({
          source_id: s.id,
          code: "source_unverifiable",
          message: `Requirement source "${s.id}" cannot be verified at ${s.reference} (${e.code || e.message}).`,
        });
      }
      continue;
    }

    if (!st.isFile()) {
      sources.push({ id: s.id, status: "unverifiable", reference: s.reference });
      warnings.push({
        source_id: s.id,
        code: "source_unverifiable",
        message: `Requirement source "${s.id}" is not a readable regular file at ${s.reference}.`,
      });
      continue;
    }

    let buffer;
    try {
      buffer = readFileSync(abs);
    } catch (e) {
      sources.push({ id: s.id, status: "unverifiable", reference: s.reference });
      warnings.push({
        source_id: s.id,
        code: "source_unverifiable",
        message: `Requirement source "${s.id}" is not readable at ${s.reference} (${e.code || e.message}).`,
      });
      continue;
    }

    if (sha256Hex(buffer) === s.fingerprint) {
      sources.push({ id: s.id, status: "unchanged", reference: s.reference });
    } else {
      sources.push({ id: s.id, status: "changed", reference: s.reference });
      warnings.push({
        source_id: s.id,
        code: "source_changed",
        message: `Requirement source "${s.id}" has changed since decomposition (${s.reference}).`,
      });
    }
  }

  return { sources, warnings };
}

// ── Effective context projection ───────────────────────────────────────────
// Ordered union of global_refs followed by the child's context_refs,
// deduplicated by first occurrence without reordering either list.
function projectEffectiveContext(epic, child) {
  const ctx = epic.requirement_context;
  const itemsById = new Map((ctx.items || []).map((i) => [i.id, i]));
  const ordered = [];
  const seen = new Set();

  for (const ref of [...(ctx.global_refs || []), ...(child.context_refs || [])]) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const item = itemsById.get(ref);
    if (item) ordered.push(item);
  }

  return ordered.map((i) => ({
    id: i.id,
    category: i.category,
    summary: i.summary,
    source_ids: i.source_ids,
  }));
}

// ── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function validateArgs(args) {
  const modes = ["fingerprint", "verify-epic", "effective-context"].filter(
    (m) => args[m] !== undefined
  );
  if (modes.length === 0) return ERRORS.NO_OPERATION();
  if (modes.length > 1) return ERRORS.CONFLICTING_MODES(modes);
  if (args.fingerprint === true) return ERRORS.MISSING_FINGERPRINT_PATH();
  if (args["verify-epic"] === true) return ERRORS.MISSING_VERIFY_PATH();
  if (args["effective-context"] === true) return ERRORS.MISSING_EFFECTIVE_PATH();
  if (args["effective-context"] !== undefined && (args.child === undefined || args.child === true)) {
    return ERRORS.CHILD_REQUIRED();
  }
  if (args.child !== undefined && args["effective-context"] === undefined) {
    return ERRORS.CHILD_WITHOUT_MODE();
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  const argErr = validateArgs(args);
  if (argErr) {
    process.stderr.write(argErr + "\n");
    process.exit(1);
  }

  // Mode 1: --fingerprint <source_path>
  if (args.fingerprint) {
    const absPath = resolve(args.fingerprint);
    const root = findWorkspaceRoot(dirname(absPath)) || findWorkspaceRoot(process.cwd());
    const { reference, reference_base } = normalizeSourceReference(absPath, root);
    const result = fingerprintFile(absPath);
    if (result.error) {
      process.stderr.write(result.error + "\n");
      process.exit(1);
    }
    process.stdout.write(
      JSON.stringify({
        ok: true,
        reference,
        reference_base,
        fingerprint: result.fingerprint,
        size: result.size,
      }) + "\n"
    );
    process.exit(0);
  }

  // Modes 2/3: epic-based
  const epicPath = args["verify-epic"] || args["effective-context"];
  if (!existsSync(epicPath)) {
    process.stderr.write(ERRORS.EPIC_NOT_FOUND(epicPath) + "\n");
    process.exit(1);
  }

  let epic;
  try {
    epic = parseYaml(readFileSync(epicPath, "utf-8"));
  } catch (e) {
    process.stderr.write(ERRORS.EPIC_PARSE_FAILED(e.message) + "\n");
    process.exit(1);
  }
  if (!epic || typeof epic !== "object") {
    process.stderr.write(ERRORS.EPIC_PARSE_FAILED("not a valid YAML object") + "\n");
    process.exit(1);
  }

  const errors = validateContext(epic);
  if (errors.length) {
    process.stderr.write(ERRORS.CONTEXT_VALIDATION_FAILED(errors) + "\n");
    process.exit(1);
  }

  const hasContext =
    epic.requirement_context !== undefined && epic.requirement_context !== null;
  const workspaceRoot = findWorkspaceRoot(dirname(resolve(epicPath)));
  const contextUnavailableWarning = [
    {
      source_id: null,
      code: "context_unavailable",
      message:
        "Original requirement context is unavailable; child scope is used as the baseline.",
    },
  ];

  // Mode 2: --verify-epic <epic_path>
  if (args["verify-epic"]) {
    if (!hasContext) {
      process.stdout.write(
        JSON.stringify({ ok: true, sources: [], warnings: contextUnavailableWarning }) + "\n"
      );
    } else {
      const { sources, warnings } = verifySources(epic, workspaceRoot, epicPath);
      process.stdout.write(JSON.stringify({ ok: true, sources, warnings }) + "\n");
    }
    process.exit(0);
  }

  // Mode 3: --effective-context <epic_path> --child <change_id>
  const childId = args.child;
  const children = Array.isArray(epic.children) ? epic.children : [];
  const child = children.find((c) => c.change_id === childId);
  if (!child) {
    process.stderr.write(ERRORS.CHILD_NOT_FOUND(childId, children.map((c) => c.change_id)) + "\n");
    process.exit(1);
  }

  const childOut = {
    change_id: child.change_id,
    title: child.title,
    scope: child.scope,
  };

  if (!hasContext) {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        child: childOut,
        context: [],
        sources: [],
        warnings: contextUnavailableWarning,
      }) + "\n"
    );
    process.exit(0);
  }

  const { sources, warnings } = verifySources(epic, workspaceRoot, epicPath);
  const context = projectEffectiveContext(epic, child);
  process.stdout.write(
    JSON.stringify({
      ok: true,
      child: childOut,
      context,
      sources,
      warnings,
    }) + "\n"
  );
  process.exit(0);
}

main();

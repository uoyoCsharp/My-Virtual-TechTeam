import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { applyParams, loadSection } from "../src/build/section-loader.js";

describe("applyParams", () => {
  it("replaces simple variables", () => {
    const result = applyParams("Hello {{name}}, you are {{role}}.", {
      name: "Alice",
      role: "Analyst",
    });
    expect(result).toBe("Hello Alice, you are Analyst.");
  });

  it("replaces missing variables with empty string", () => {
    const result = applyParams("Hello {{name}}.", {});
    expect(result).toBe("Hello .");
  });

  it("expands array blocks with object items", () => {
    const template = `Rules:
{{#items}}
- {{label}}: {{value}}
{{/items}}
Done.`;
    const result = applyParams(template, {
      items: [
        { label: "A", value: "1" },
        { label: "B", value: "2" },
      ],
    });
    expect(result).toContain("- A: 1");
    expect(result).toContain("- B: 2");
    expect(result).toContain("Done.");
  });

  it("expands array blocks with string items using dot notation", () => {
    const template = `List:
{{#items}}
- {{.}}
{{/items}}
End.`;
    const result = applyParams(template, {
      items: ["alpha", "beta", "gamma"],
    });
    expect(result).toContain("- alpha");
    expect(result).toContain("- beta");
    expect(result).toContain("- gamma");
    expect(result).toContain("End.");
  });

  it("removes block when param is missing", () => {
    const template = `Before
{{#optional}}
- {{.}}
{{/optional}}
After`;
    const result = applyParams(template, {});
    expect(result).toBe("Before\nAfter");
  });

  it("removes block when param is false", () => {
    const template = `A
{{#show}}
visible
{{/show}}
B`;
    const result = applyParams(template, { show: false });
    expect(result).toBe("A\nB");
  });

  it("keeps block content for truthy non-array values", () => {
    const template = `{{#enabled}}
Content here: {{name}}
{{/enabled}}`;
    const result = applyParams(template, { enabled: true, name: "test" });
    expect(result).toContain("Content here: test");
  });

  it("handles multiple blocks in sequence", () => {
    const template = `{{#a}}
- a: {{.}}
{{/a}}
{{#b}}
- b: {{.}}
{{/b}}`;
    const result = applyParams(template, {
      a: ["x"],
      b: ["y", "z"],
    });
    expect(result).toContain("- a: x");
    expect(result).toContain("- b: y");
    expect(result).toContain("- b: z");
  });

  it("renders inverted section when param is missing", () => {
    const template = `{{#items}}
- {{.}}
{{/items}}
{{^items}}
No items found.
{{/items}}`;
    const result = applyParams(template, {});
    expect(result).not.toContain("{{^items}}");
    expect(result).toContain("No items found.");
  });

  it("removes inverted section when param is truthy", () => {
    const template = `{{#items}}
- {{.}}
{{/items}}
{{^items}}
No items found.
{{/items}}`;
    const result = applyParams(template, { items: ["a", "b"] });
    expect(result).toContain("- a");
    expect(result).toContain("- b");
    expect(result).not.toContain("No items found.");
    expect(result).not.toContain("{{^items}}");
  });

  it("renders inverted section when param is false", () => {
    const template = `{{^enabled}}
Disabled content.
{{/enabled}}`;
    const result = applyParams(template, { enabled: false });
    expect(result).toContain("Disabled content.");
  });

  it("removes inverted section when param is true", () => {
    const template = `{{^enabled}}
Disabled content.
{{/enabled}}`;
    const result = applyParams(template, { enabled: true });
    expect(result).not.toContain("Disabled content.");
    expect(result).not.toContain("{{^enabled}}");
  });

  it("recursively expands nested blocks when param is an object", () => {
    const template = `Header
{{#group}}
{{#items}}
- {{label}}: {{value}}
{{/items}}
{{#extras}}
* {{.}}
{{/extras}}
{{/group}}
Footer`;
    const result = applyParams(template, {
      group: {
        items: [
          { label: "A", value: "1" },
          { label: "B", value: "2" },
        ],
        extras: ["x", "y"],
      },
    });
    expect(result).not.toContain("{{#items}}");
    expect(result).not.toContain("{{#extras}}");
    expect(result).not.toContain("{{/group}}");
    expect(result).toContain("- A: 1");
    expect(result).toContain("- B: 2");
    expect(result).toContain("* x");
    expect(result).toContain("* y");
    expect(result).toContain("Header");
    expect(result).toContain("Footer");
  });

  it("recursively expands nested blocks inside array-of-objects", () => {
    const template = `{{#groups}}
Group {{name}}:
{{#items}}
- {{.}}
{{/items}}
{{/groups}}`;
    const result = applyParams(template, {
      groups: [
        { name: "alpha", items: ["a1", "a2"] },
        { name: "beta", items: ["b1"] },
      ],
    });
    expect(result).not.toContain("{{#items}}");
    expect(result).toContain("Group alpha:");
    expect(result).toContain("- a1");
    expect(result).toContain("- a2");
    expect(result).toContain("Group beta:");
    expect(result).toContain("- b1");
  });

  it("renders per-condition alternatives nested inside each condition", () => {
    const template = `{{#conditions}}
- **\`{{condition}}\`** -> /{{primary}}
{{#alternatives}}
  - Or /{{skill}}
{{/alternatives}}
{{/conditions}}`;
    const result = applyParams(template, {
      conditions: [
        {
          condition: "default",
          primary: "mvt-design",
          alternatives: [{ skill: "mvt-analyze-code" }],
        },
        {
          condition: "quick",
          primary: "mvt-quick-dev",
        },
      ],
    });
    expect(result).toContain("- **`default`** -> /mvt-design");
    expect(result).toContain("  - Or /mvt-analyze-code");
    expect(result).toContain("- **`quick`** -> /mvt-quick-dev");
    expect(result).not.toContain("{{#alternatives}}");
  });

  it("collapses consecutive blank lines left by removed blocks", () => {
    const template = `Table end
| row |
{{#optionA}}
| optA |
{{/optionA}}
{{#optionB}}
| optB |
{{/optionB}}
{{^optionA}}
Inverted block
{{/optionA}}
{{#optionC}}
| optC |
{{/optionC}}

### Next heading`;
    const result = applyParams(template, {});
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain("| row |\nInverted block\n\n### Next heading");
  });

  it("strips heading + empty table when all conditional rows are removed", () => {
    const template = `Some content

### Parameter semantics

| Argument | When to use | Effect |
|----------|-------------|--------|
{{#optA}}
| \`--opt-a\` | When A | Does A |
{{/optA}}
{{#optB}}
| \`--opt-b\` | When B | Does B |
{{/optB}}

### Failure handling

Handle failures gracefully.`;
    const result = applyParams(template, {});
    expect(result).not.toContain("Parameter semantics");
    expect(result).not.toContain("|----------|");
    expect(result).toContain("Some content");
    expect(result).toContain("### Failure handling");
    expect(result).toContain("Handle failures gracefully.");
  });

  it("preserves heading + table when at least one conditional row exists", () => {
    const template = `### Parameter semantics

| Argument | When to use | Effect |
|----------|-------------|--------|
{{#optA}}
| \`--opt-a\` | When A | Does A |
{{/optA}}
{{#optB}}
| \`--opt-b\` | When B | Does B |
{{/optB}}

### Next section`;
    const result = applyParams(template, { optA: true });
    expect(result).toContain("### Parameter semantics");
    expect(result).toContain("| `--opt-a` | When A | Does A |");
    expect(result).toContain("### Next section");
  });

  it("preserves single-brace placeholders meant for runtime substitution", () => {
    const template = `{{#conditions}}
- When \`{{condition}}\`: Primary -> /{primary} -- {primary_desc}
{{/conditions}}`;
    const result = applyParams(template, {
      conditions: [
        {
          condition: "default",
          primary: "mvt-design",
          primary_desc: "Design architecture",
        },
      ],
    });
    expect(result).toContain("- When `default`");
    expect(result).toContain("/{primary}");
    expect(result).toContain("{primary_desc}");
  });
});

describe("loadSection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "section-loader-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("renders shared section with mustache blocks when params omitted", () => {
    const sourcesDir = path.join(tmpDir, "sources");
    mkdirSync(path.join(sourcesDir, "sections"), { recursive: true });
    const templatePath = path.join(sourcesDir, "sections", "context.md");
    writeFileSync(
      templatePath,
      `Header\n{{#items}}\n- {{.}}\n{{/items}}\nFooter\n`,
      "utf-8",
    );

    const result = loadSection(
      { type: "shared", source: "sections/context.md" },
      tmpDir,
      sourcesDir,
    );

    expect(result).not.toContain("{{#items}}");
    expect(result).not.toContain("{{/items}}");
    expect(result).toContain("Header");
    expect(result).toContain("Footer");
  });

  it("renders script-usage-rule.md with plan-update block when uses_plan_update is true", () => {
    const sourcesDir = path.resolve("sources");
    const result = loadSection(
      { type: "shared", source: "sections/script-usage-rule.md", params: { uses_plan_update: true } },
      path.resolve("."),
      sourcesDir,
    );

    // Plan-update block rendered
    expect(result).toContain("## Script Usage Rule");
    expect(result).toContain("node .ai-agents/scripts/plan-update.cjs");
    expect(result).toContain("--plan");
    expect(result).toContain("--task");
    expect(result).toContain("--status");
    expect(result).toContain("--projects");
    // Pointer to full reference doc
    expect(result).toContain(".ai-agents/scripts/plan-update.md");
    // Epic-update block NOT rendered
    expect(result).not.toContain("node .ai-agents/scripts/epic-update.cjs");
    // No leftover Mustache markers
    expect(result).not.toContain("{{#uses_plan_update}}");
    expect(result).not.toContain("{{/uses_plan_update}}");
    expect(result).not.toContain("{{#uses_epic_update}}");
  });

  it("renders script-usage-rule.md with epic-update block when uses_epic_update is true", () => {
    const sourcesDir = path.resolve("sources");
    const result = loadSection(
      { type: "shared", source: "sections/script-usage-rule.md", params: { uses_epic_update: true } },
      path.resolve("."),
      sourcesDir,
    );

    // Epic-update block rendered
    expect(result).toContain("## Script Usage Rule");
    expect(result).toContain("node .ai-agents/scripts/epic-update.cjs");
    expect(result).toContain("--complete-child");
    expect(result).toContain("--epic");
    // Pointer to full reference doc
    expect(result).toContain(".ai-agents/scripts/epic-update.md");
    // Plan-update block NOT rendered
    expect(result).not.toContain("node .ai-agents/scripts/plan-update.cjs");
    // No leftover Mustache markers
    expect(result).not.toContain("{{#uses_epic_update}}");
    expect(result).not.toContain("{{/uses_epic_update}}");
    expect(result).not.toContain("{{#uses_plan_update}}");
  });

  it("renders script-usage-rule.md with both blocks when both flags are true", () => {
    const sourcesDir = path.resolve("sources");
    const result = loadSection(
      { type: "shared", source: "sections/script-usage-rule.md", params: { uses_plan_update: true, uses_epic_update: true } },
      path.resolve("."),
      sourcesDir,
    );

    expect(result).toContain("node .ai-agents/scripts/plan-update.cjs");
    expect(result).toContain("node .ai-agents/scripts/epic-update.cjs");
    // General rule always present
    expect(result).toContain("Never read");
  });

  it("renders script-usage-rule.md with only the general rule when no script flags are set", () => {
    const sourcesDir = path.resolve("sources");
    const result = loadSection(
      { type: "shared", source: "sections/script-usage-rule.md", params: {} },
      path.resolve("."),
      sourcesDir,
    );

    expect(result).toContain("## Script Usage Rule");
    expect(result).toContain("Never read");
    // No script-specific blocks
    expect(result).not.toContain("node .ai-agents/scripts/plan-update.cjs");
    expect(result).not.toContain("node .ai-agents/scripts/epic-update.cjs");
    // No leftover Mustache markers
    expect(result).not.toContain("{{#uses_");
    expect(result).not.toContain("{{/uses_");
  });
});

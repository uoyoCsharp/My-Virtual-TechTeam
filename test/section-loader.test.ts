import { describe, it, expect } from "vitest";
import { applyParams } from "../src/build/section-loader.js";

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
});

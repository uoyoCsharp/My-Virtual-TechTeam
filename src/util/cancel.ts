import * as p from "@clack/prompts";

export function cancelled(): never {
  p.cancel("Cancelled.");
  throw new Error("Cancelled");
}

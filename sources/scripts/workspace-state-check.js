#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { findProjectRoot } from "./lib/workspace-artifacts.js";

function readYaml(filePath) {
  return parseYaml(readFileSync(filePath, "utf-8"));
}

function planFinding(change, planPath) {
  if (!existsSync(planPath)) {
    return {
      code: "PLAN_PATH_MISSING",
      change_id: change.id,
      plan_path: change.plan_path,
      recommended_action: "manual_review",
    };
  }

  try {
    const plan = readYaml(planPath);
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.tasks) || typeof plan.status !== "string") {
      throw new Error("invalid plan shape");
    }
    return { plan };
  } catch {
    return {
      code: "PLAN_INVALID",
      change_id: change.id,
      plan_path: change.plan_path,
      recommended_action: "manual_review",
    };
  }
}

function collectFindings(session, projectRoot) {
  const findings = [];
  const changes = Array.isArray(session.changes) ? session.changes : [];
  const activeChangeId = session.active_change?.id || "";
  const knownEpicIds = new Set([
    ...(Array.isArray(session.epics) ? session.epics : []).map((epic) => epic?.id),
    session.active_epic?.id,
  ].filter(Boolean));

  for (const change of changes) {
    if (!change?.id) {
      findings.push({ code: "EMPTY_CHANGE_ID", recommended_action: "prune_empty_entry" });
      continue;
    }

    if (change.plan_path) {
      const planResult = planFinding(change, join(projectRoot, change.plan_path));
      if (planResult.code) {
        findings.push(planResult);
      } else if (
        planResult.plan.status === "done" &&
        change.status === "active" &&
        change.id !== activeChangeId
      ) {
        findings.push({
          code: "PLAN_DONE_INDEX_ACTIVE",
          change_id: change.id,
          recommended_action: "set_status_done",
        });
      }
    }

    if (change.epic_id && !knownEpicIds.has(change.epic_id)) {
      findings.push({
        code: "EPIC_REFERENCE_UNRESOLVED",
        change_id: change.id,
        epic_id: change.epic_id,
        recommended_action: "manual_review",
      });
    }
  }

  return findings.sort((left, right) =>
    `${left.code}:${left.change_id || ""}:${left.plan_path || left.epic_id || ""}`.localeCompare(
      `${right.code}:${right.change_id || ""}:${right.plan_path || right.epic_id || ""}`
    )
  );
}

function main() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    process.stderr.write("Could not find project root containing .ai-agents.\n");
    process.exit(1);
  }

  const sessionPath = join(projectRoot, ".ai-agents", "workspace", "session.yaml");
  if (!existsSync(sessionPath)) {
    process.stderr.write(`Session file not found at ${sessionPath}.\n`);
    process.exit(1);
  }

  let session;
  try {
    session = readYaml(sessionPath);
  } catch (error) {
    process.stderr.write(`Failed to parse session.yaml: ${error.message}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ ok: true, findings: collectFindings(session || {}, projectRoot) }) + "\n");
}

main();
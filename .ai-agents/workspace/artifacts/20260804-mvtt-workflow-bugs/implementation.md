# Implementation: MVTT Workflow Bug Remediation

## Task: t1-session-lifecycle-core - Harden session lifecycle mutations

### Implementation Summary

Implemented the session lifecycle contract from ADR-2, ADR-7, ADR-8, and ADR-10. The session writer now validates all command and session preconditions before appending history, rejects implicit active-change replacement, supports explicit abandon and repair operations, composes change and epic terminal updates, and writes only after deterministic mutation ordering succeeds.

### Files Touched

| Path | Action | Intent |
|---|---|---|
| `sources/scripts/session-update.js` | modify | Add validated lifecycle, repair, collision, and atomic write behavior. |
| `sources/scripts/session-update.md` | create | Provide the authoritative reference for lifecycle and repair CLI flags. |
| `test/session-update.test.ts` | modify | Cover replacement rejection, zero-write failures, repairs, abandonment, and composed terminal updates. |

### Design Compliance

| Check | Result | Evidence |
|---|---|---|
| Files match task scope | passed | Touched the three planned t1 files; the documentation file was created after explicit user confirmation. |
| Module and layer placement | passed | The session writer, its script reference, and its focused tests remain in their existing directories. |
| Public interfaces match design | passed | Implemented `--abandon-change`, `--abandon-epic`, `--repair-change-statuses`, lifecycle validation, and composed terminal flags from the accepted design. |
| Forbidden imports absent | passed | The implementation continues to use only Node built-ins and the existing YAML dependency. |
| Error handling at boundaries | passed | Validation and write failures exit before state mutation; atomic write cleanup remains at the filesystem boundary. |
| New external dependencies | passed | None added. |

### Deviations from Design

None.

### Self-Check Results

- `npm run build`: passed.
- `npx vitest run test/session-update.test.ts`: passed, 53 tests.
- Editor diagnostics: no errors in the script, reference document, or focused test file.

### Open TODOs

- Implement t2 before workflow integration so `epic-update` can supply the corresponding defer and abandon transitions.
- Use `/mvt-review` after the remaining lifecycle workflows are integrated.

### Deliverables

#### Public Interface

`session-update.cjs` now rejects a different active change for `--new-change`; exposes `--abandon-change`, `--abandon-epic`, `--repair-change-statuses`, and `--prune-empty-changes`; and permits one change terminal flag plus one epic terminal flag in the same command. The reference is `sources/scripts/session-update.md`.

#### Data Shapes

Change repairs are a comma-separated `<id>=<status>` list, where status is exactly `active`, `done`, or `abandoned`. Close and abandon operations upsert the active record into `changes[]` or `epics[]` with the corresponding terminal status before clearing the active pointer.

#### Usage Constraints

All flags and session-state preconditions are validated before history or state mutation. Repair ids must already exist, repair/remove collisions fail, and empty active lifecycle targets fail without writing. Workflow callers must invoke session-update exactly once after any successful epic-file transition and must not expect `epic-update` to write session state.

### Change Tracking

- `t1-session-lifecycle-core`: implementation complete; pending `/mvt-update-plan` status update.

## Task: t2-epic-lifecycle-core - Implement deterministic epic transitions

### Implementation Summary

Implemented the ADR-10 epic lifecycle boundary. `epic-update` now owns only atomic `epic.yaml` transitions, supports deferred completion and explicit abandonment, and derives terminal epic status from the final child states without mutating `session.yaml`.

### Files Touched

| Path | Action | Intent |
|---|---|---|
| `sources/scripts/epic-update.js` | modify | Add defer and abandon transitions, terminal status rules, and remove direct session synchronization. |
| `sources/scripts/epic-update.md` | modify | Document the new lifecycle commands, terminal semantics, and epic-only persistence boundary. |
| `test/epic-update.test.ts` | modify | Cover deferred completion, abandoned-child advancement, terminal states, and session isolation. |

### Design Compliance

| Check | Result | Evidence |
|---|---|---|
| Files match task scope | passed | Touched exactly the three planned t2 files. |
| Module and layer placement | passed | The epic writer, CLI reference, and focused tests remain in their existing locations. |
| Public interfaces match design | passed | Added `--defer-next` with `--complete-child` and `--abandon-child`; output retains `epic_status` and `current_change` without `session_sync`. |
| Forbidden imports absent | passed | No new imports or cross-layer dependencies were added. |
| Error handling at boundaries | passed | Argument, YAML, validation, and atomic filesystem-write failures retain the existing exit behavior. |
| New external dependencies | passed | None added. |

### Deviations from Design

None.

### Self-Check Results

- `npm run build`: passed.
- `npx vitest run test/epic-update.test.ts`: passed, 52 tests.
- `git diff --check -- sources/scripts/epic-update.js sources/scripts/epic-update.md test/epic-update.test.ts`: passed.
- Editor diagnostics: no errors in the script, reference document, or focused test file.

### Open TODOs

- t4 must map epic transition results to exactly one `session-update` lifecycle command and report epic/session divergence without replaying the epic mutation.
- Run `/mvt-review` after lifecycle workflow integration.

### Deliverables

#### Public Interface

`epic-update.cjs` accepts `--complete-child <id> --defer-next` to complete the child while leaving the next child inactive, and `--abandon-child <id>` to abandon a child and advance deterministically. Success JSON contains `epic_status` and `current_change`, and never contains `session_sync`.

#### Data Shapes

Every child transition reports `child.change_id`, old and new status, `current_change`, `epic_status`, and `progress`. An epic becomes `abandoned` only when all children are abandoned; any other all-terminal child set becomes `done`.

#### Usage Constraints

`epic-update.cjs` writes only `epic.yaml`; workflow callers must issue exactly one appropriate `session-update.cjs` command after its success. A deferred epic remains `in_progress` with `current_change: ""` until resume explicitly activates an eligible child. Do not make a compensating session write when the epic mutation fails.

### Change Tracking

- `t2-epic-lifecycle-core`: implementation complete; pending `/mvt-update-plan` status update.

## Task: t3-artifact-state-tools - Build deterministic artifact and state tools

### Implementation Summary

Implemented the ADR-5 and ADR-6 script boundaries. `artifact-scan` provides deterministic live-artifact enumeration without archived inputs, while `workspace-state-check` inspects session, plan, and epic references and returns read-only repair findings. Both scripts bundle as standalone CommonJS tools with adjacent authoritative references.

### Files Touched

| Path | Action | Intent |
|---|---|---|
| `sources/scripts/lib/workspace-artifacts.js` | create | Share project-root resolution, live change-directory classification, and workspace-relative path conversion. |
| `sources/scripts/artifact-scan.js` | create | Expose sorted `plans`, `change-dirs`, and `files` discovery modes as JSON. |
| `sources/scripts/artifact-scan.md` | create | Document scanner modes, output contract, and archive exclusion. |
| `sources/scripts/workspace-state-check.js` | create | Emit read-only session/index/plan/epic consistency findings. |
| `sources/scripts/workspace-state-check.md` | create | Document finding codes, recommended actions, and zero-write boundary. |
| `build-scripts.js` | modify | Bundle the new script entry points with the existing standalone scripts. |
| `test/artifact-scan.test.ts` | create | Cover sorted modes, immediate-plan selection, recursive live files, and invalid mode handling. |
| `test/workspace-state-check.test.ts` | create | Cover every finding code, active-change exclusion, and zero-write behavior. |

### Design Compliance

| Check | Result | Evidence |
|---|---|---|
| Files match task scope | passed | Touched exactly the eight planned t3 files. |
| Module and layer placement | passed | Shared discovery code is isolated under `sources/scripts/lib`; CLI wrappers and references remain under `sources/scripts`. |
| Public interfaces match design | passed | Scanner emits sorted workspace-relative entries for all three modes; checker emits only the five designed finding codes and actions. |
| Forbidden imports absent | passed | The tools use Node built-ins and the existing bundled YAML dependency only. |
| Error handling at boundaries | passed | CLI argument, root, session, plan parsing, and filesystem failures return stderr without state mutation. |
| New external dependencies | passed | None added. |

### Deviations from Design

None.

### Self-Check Results

- `npm run build`: passed; both `.cjs` bundles and usage references are present in `dist/scripts`.
- `npx vitest run test/artifact-scan.test.ts test/workspace-state-check.test.ts`: passed, 7 tests.
- `git diff --check` for all eight t3 files: passed.
- Editor diagnostics: no errors in the new scripts, shared module, build entry, or focused tests.

### Open TODOs

- t5 must consume scanner output in discovery workflows and submit confirmed checker repairs only through its final `session-update` command.
- Run `/mvt-review` after the workflow integrations are complete.

### Deliverables

#### Public Interface

`artifact-scan.cjs --mode <plans|change-dirs|files>` returns `{ ok, mode, entries }`. `workspace-state-check.cjs` returns `{ ok, findings }`; it reports only `EMPTY_CHANGE_ID`, `PLAN_DONE_INDEX_ACTIVE`, `PLAN_PATH_MISSING`, `PLAN_INVALID`, and `EPIC_REFERENCE_UNRESOLVED`.

#### Data Shapes

Scanner entries are sorted workspace-relative paths with `/` separators and never include an `_archived` segment. Checker findings include `code`, `recommended_action`, and applicable `change_id`, `plan_path`, or `epic_id`; only non-current `PLAN_DONE_INDEX_ACTIVE` findings use `set_status_done`, while missing/invalid plans and unresolved epics use `manual_review`.

#### Usage Constraints

Consumers must use scanner output directly and must not perform fallback recursive live-artifact discovery. The checker is strictly read-only and never applies repairs; cleanup must present findings, obtain confirmation, and submit selected repairs through one final `session-update.cjs` command. The current active change is intentionally excluded from stale completed-plan findings.

### Change Tracking

- `t3-artifact-state-tools`: implementation complete; pending `/mvt-update-plan` status update.

## Task: t4-lifecycle-workflows - Integrate lifecycle workflow routing

### Implementation Summary

Integrated the accepted lifecycle routes into the generated workflow sources. `mvt-update-plan` now owns runtime lifecycle flag selection and documents plan-backed, done-plan, plan-less, defer, abandon, recovery, and divergence behavior. `mvt-analyze` blocks a conflicting active change before writing artifacts, while `mvt-plan-dev` explicitly distinguishes matching and conflicting active ids.

### Files Touched

| Path | Action | Intent |
|---|---|---|
| `sources/sections/session-update.md` | modify | Render runtime lifecycle selection only for update-plan while preserving static callers. |
| `sources/skills/mvt-update-plan/manifest.yaml` | modify | Enable scoped runtime lifecycle rendering. |
| `sources/skills/mvt-update-plan/business.md` | modify | Define finalization, defer, abandon, recovery, and divergence routes. |
| `sources/skills/mvt-analyze/manifest.yaml` | modify | Add the active-change conflict decision rule. |
| `sources/skills/mvt-analyze/business.md` | modify | Gate change-id and artifact creation behind conflict resolution. |
| `sources/skills/mvt-plan-dev/manifest.yaml` | modify | Block different active-id planning while allowing same-id planning. |

### Design Compliance

| Check | Result | Evidence |
|---|---|---|
| Files match task scope | passed | Touched exactly the six planned t4 files. |
| Module and layer placement | passed | Changes remain in shared sections and skill source directories. |
| Public interfaces match design | passed | Routes use defer/abandon epic commands and one route-selected session command; dynamic flag selection is limited to update-plan. |
| Forbidden imports absent | passed | Documentation and manifests introduce no code imports. |
| Error handling at boundaries | passed | Routes explicitly stop on failed epic mutation and report session-after-epic divergence without a compensating write. |
| New external dependencies | passed | None added. |

### Deviations from Design

None.

### Self-Check Results

- `npx vitest run test/assembler.test.ts`: passed, 58 tests.
- `npm run build`: passed.
- `git diff --check` for all six t4 files: passed.
- Editor diagnostics: no errors in the shared section, manifests, or workflow documents.

### Open TODOs

- t5 must consume scanner/checker outputs and implement the deferred epic resume route described by t4.
- t6 must add assembled workflow sequence coverage for the new routing branches.

### Deliverables

#### Public Interface

Only `mvt-update-plan` selects `session-update.cjs` lifecycle flags at runtime. It exposes routes for keep-open, finalize, abandon, done-plan, plan-less, recovery, epic advance, and epic defer.

#### Data Shapes

The workflow consumes `epic-update` success JSON through `epic_status` and `current_change`. Terminal `done` maps to `--close-change --close-epic`; terminal `abandoned` maps to `--abandon-change --abandon-epic`; non-terminal child routes close or abandon only the change.

#### Usage Constraints

Run the epic mutation before exactly one session mutation. Do not call session-update after a failed epic update. If session-update fails after the epic write, report divergence and stop without a compensating write. Analyze must resolve a different active change before artifact creation; plan-dev may only create or regenerate a plan for the current active id.

### Change Tracking

- `t4-lifecycle-workflows`: implementation complete; pending `/mvt-update-plan` status update.

## Task: t5-discovery-cleanup-resume - Migrate discovery cleanup and resume workflows

### Implementation Summary

Migrated the discovery and reconciliation workflows to the t3 scanner/checker boundary. Cleanup now consumes findings before a single final repair/removal update, status and resume use scanner-confirmed plans, sync-context uses scanner-confirmed change directories, and check-context uses scanner-confirmed files. Resume documents deferred epic activation followed by exactly one session registration call.

### Files Touched

| Path | Action | Intent |
|---|---|---|
| `sources/skills/mvt-cleanup/business.md` | modify | Consume checker/scanner output and apply selected repairs, removals, and truncation once. |
| `sources/skills/mvt-status/business.md` | modify | Replace plan glob discovery with scanner plans mode. |
| `sources/skills/mvt-resume/business.md` | modify | Replace plan fallback discovery and add deferred-child activation routing. |
| `sources/skills/mvt-sync-context/business.md` | modify | Replace artifact directory fallback scanning with scanner change-dirs mode. |
| `sources/skills/mvt-check-context/business.md` | modify | Replace recursive artifact enumeration with scanner files mode. |

### Design Compliance

| Check | Result | Evidence |
|---|---|---|
| Files match task scope | passed | Touched exactly the five planned t5 files. |
| Module and layer placement | passed | Migration remains within the owning workflow business documents. |
| Public interfaces match design | passed | Workflows consume the scanner/checker command contracts and use the designed deferred resume sequence. |
| Forbidden imports absent | passed | Documentation-only changes add no imports or dependencies. |
| Error handling at boundaries | passed | Cleanup submits only safe confirmed repairs after move outcomes; resume reports epic/session divergence without replay. |
| New external dependencies | passed | None added. |

### Deviations from Design

None.

### Self-Check Results

- `npm run build`: passed.
- Editor diagnostics and `git diff --check`: passed for all five files.
- `npx vitest run test/assembler.test.ts`: one expected failure remains in t6-owned coverage: the old status assertion requires fallback glob discovery, which t5 intentionally removes in favor of scanner-only discovery.

### Open TODOs

- t6 must replace the legacy fallback-glob assembler assertion with scanner-only discovery and add end-to-end sequence coverage.

### Deliverables

#### Public Interface

Discovery workflows invoke `artifact-scan.cjs` in one fixed mode: status/resume use `plans`, sync-context uses `change-dirs`, and check-context uses `files`. Cleanup invokes `workspace-state-check.cjs` before scanner inventory.

#### Data Shapes

Only scanner JSON `entries` define live artifact inputs. Cleanup maps selected `EMPTY_CHANGE_ID` to pruning and selected `PLAN_DONE_INDEX_ACTIVE` to `<id>=done` repair; all other checker findings require `manual_review`.

#### Usage Constraints

No workflow may fall back to recursive live-artifact discovery. Cleanup applies selected repairs, successful move removals, and truncation in one final session update; only successfully moved ids are removed. For a deferred epic, resume activates a ready child through `epic-update --switch-active`, then registers it through exactly one session update and reports divergence if that second step fails.

### Change Tracking

- `t5-discovery-cleanup-resume`: implementation complete; pending `/mvt-update-plan` status update.
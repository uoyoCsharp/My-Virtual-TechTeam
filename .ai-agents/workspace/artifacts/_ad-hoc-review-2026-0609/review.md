---
id: 'review-output'
version: '1.0'
skill: 'mvt-review'
---

# Code Review Report

## Review Scope

- **Files reviewed** (source code only; generated SKILL.md and .ai-agents internal files skipped):
  - `src/types/platform.ts` (new)
  - `src/fs/materialize.ts` (modified)
  - `src/fs/install-manifest.ts` (modified)
  - `src/fs/registry-merge.ts` (modified)
  - `src/commands/install.ts` (modified)
  - `src/commands/update.ts` (modified)
  - `src/commands/uninstall.ts` (modified)
  - `test/commands/install.test.ts` (modified)
  - `test/commands/update.test.ts` (modified)
  - `test/fs/registry-merge.test.ts` (modified)
  - `install-manifest.yaml` (modified)
- **Aspect**: full review (all axes)
- **Fallbacks applied**: `design.md` missing — Group A (Design/Layer Compliance) skipped. Verdict capped at Approve with comments.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| Warning  | 2     |
| Suggestion | 3   |

**Verdict: Approve with comments** (code-only review; no design artifact available).

The multi-platform implementation is well-structured, type-safe, and backward-compatible. The `PlatformId` / `PlatformDef` abstraction is clean and extensible. Platform info is correctly stored in the installation manifest (`.mvtt-manifest.json`) rather than in business config. Test coverage is comprehensive — 10 new tests covering dual-platform writes, content identity, platform reduction cleanup, registry path rewrite, and custom skill path preservation.

## Critical Issues

None.

## Warnings

### W1. Stale comment in `uninstall.ts`

**File**: `src/commands/uninstall.ts`, line 38
**Observation**: The comment reads "Fall back to all known platforms if config is unreadable" — the word "config" is a leftover from an earlier iteration. Platform info is now stored in `.mvtt-manifest.json`, not in `config.yaml`.
**Recommendation**: Update the comment to reference the manifest: "Fall back to all known platforms if manifest is unreadable."

### W2. Double manifest read in `update.ts`

**File**: `src/commands/update.ts`, lines 21 and 62
**Observation**: `readInstallationManifest(projectRoot)` is called at line 21. Later, `readInstalledPlatforms(projectRoot)` (line 62) internally calls `readInstallationManifest` again. In theory, if the manifest file were modified between these two reads, the `existing.files` (from the first read) and the `platforms` (from the second read) could be inconsistent. Extremely unlikely in practice since both happen within the same synchronous command, but worth noting.
**Recommendation**: Consider passing the already-loaded manifest to `readInstalledPlatforms` to avoid the redundant I/O, or document that both reads are expected to return identical data within a single command invocation. Non-blocking.

## Suggestions

### S1. `readInstalledPlatforms` placement

**File**: `src/fs/materialize.ts`, lines 38-47
**Observation**: `readInstalledPlatforms` is semantically an install-manifest operation (it reads from `.mvtt-manifest.json`), but is defined in `materialize.ts` because it also uses `DEFAULT_PLATFORMS`. Both `update.ts` and `uninstall.ts` import it from `materialize.js`, creating a slight coupling.
**Recommendation**: Consider moving it to `install-manifest.ts` (which already imports `DEFAULT_PLATFORMS`). This would make the dependency graph cleaner: commands read manifest data from `install-manifest`, and `materialize` remains focused on file writing. Non-blocking.

### S2. `SKILL_OUTPUT_PREFIX` could reference `PlatformDef`

**File**: `src/fs/materialize.ts`, line 36
**Observation**: `SKILL_OUTPUT_PREFIX = ".claude/skills/"` is hardcoded. The canonical skill prefix is also implicit in `PLATFORMS[0].skillDir` (claude). If the claude platform definition were ever changed, this constant would silently diverge.
**Recommendation**: Derive the prefix from the claude platform definition: `const SKILL_OUTPUT_PREFIX = PLATFORMS[0].skillDir + "/";` — or add a comment explaining the coupling. Low-risk; non-blocking.

### S3. Test `multi-platform: platform reduction` could be more direct

**File**: `test/commands/update.test.ts`, lines 151-178
**Observation**: The test installs with 2 platforms, then calls `writeInstallationManifest` again with `["claude"]` to simulate platform reduction, then runs `updateCommand()`. This works but the flow is indirect — the initial `writeInstallationManifest` at line 158 writes files for both platforms, then line 163 overwrites the manifest with only one platform while the files on disk still reflect two platforms.
**Recommendation**: Add a brief inline comment explaining the test's intent: "Simulate platform reduction by rewriting the manifest to only claude, while qoder files remain on disk." Non-blocking.

## Highlights

- Clean separation of concerns: `PlatformId` / `PlatformDef` in `types/`, platform selection in `commands/`, file output in `fs/`.
- `written` Set in `materialize.ts` (line 113) elegantly prevents duplicate writes if the same platform appears twice.
- `removeStaleGeneratedFiles` in `update.ts` automatically handles platform reduction — no new code needed for cleanup.
- `primaryPlatform` concept in `registry-merge.ts` correctly rewrites only framework skill paths, preserving custom user skill paths.
- Non-TTY fallback in `selectPlatforms()` (line 111) ensures CI/headless environments default to `DEFAULT_PLATFORMS`.
- Backward compatibility: omitting the `platforms` parameter produces identical output to the previous single-platform behavior.

## Skipped Checks

| Group | Reason |
|-------|--------|
| A — Design/Layer Compliance | No `design.md` artifact available for this change. Code-only review. |
| F — Security | No auth/data-sensitivity requirements; no external network I/O. |

## Recommended Next Skill

- `/mvt-update-plan` — Mark this review task as done if there is an active plan tracking multi-platform work.
- `/mvt-fix` — Address W1 (stale comment) and optionally W2 (double manifest read) if desired.

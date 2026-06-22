---
id: 'review-output'
version: '1.0'
skill: 'mvt-review'
---

# Code Review Report

## Review Scope

**Files reviewed:**
- `sources/scripts/epic-update.js` — `syncSessionOnEpicClose` 新函数 + `main()` 中的调用点
- `test/epic-update.test.ts` — 6 个新 session_sync 测试 + `beforeEach` 脚手架调整

**Review depth:** 全量 (Group A~F)

**Fallbacks:**
- `design.md` / `implementation.md` 均不存在 → Group A 跳过；裁决上限锁定为 `Approve with comments`
- 无安全上下文 → Group F 跳过

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Warning | 1 |
| Suggestion | 2 |

**Verdict: Approve with comments** — 修改正确、测试充分、错误处理到位。存在 1 个低影响 warnings 和 2 个代码整洁建议。

## Critical Issues

None.

## Warnings

| # | 文件 | 行 | 观察 | 建议 |
|---|------|----|------|------|
| W1 | `sources/scripts/epic-update.js` | 531-535 | `unlinkSync` 的 `catch {}` 空块无任何日志。虽然这是"best-effort cleanup"模式（整个 session 同步即是 best-effort），但临时文件泄漏在脚本级错误场景下难以排查。 | 至少加 `// best-effort cleanup — temp file overwritten next run` 注释说明意图，而不是空块。不阻塞合并。 |

## Suggestions

| # | 文件 | 行 | 观察 | 建议 |
|---|------|----|------|------|
| S1 | `sources/scripts/epic-update.js` | 522 | `const epicId = epic.epic_id \|\| epic.id;` 的 `\|\| epic.id` 回退。epic.yaml schema 只定义了 `epic_id`，加上 epic-id 从未在其他位置以 `epic.id` 形式出现。 | 删去 `\|\| epic.id` 保持精简；或在注释中明确说明这是防御性回退。 |
| S2 | `test/epic-update.test.ts` | 89-90 | `projectDir = tmpDir;` 赋值后未再被引用（只有 `workspaceDir`、`epicPath`、`sessionPath` 在后续使用）。 | 删掉 `projectDir` 变量声明和赋值——整行无效果。 |

## Skipped Checks

| Group | 理由 |
|-------|------|
| A — Design / Layer Compliance | 无 `design.md` 或 `implementation.md`：本次为快速代码修复，无对应设计产物 |
| F — Security | 修改不涉及安全上下文（输入源为本地 YAML 文件，无外部边界） |

## Recommended Next Skill

`/mvt-fix` — 应用 W1 的 `catch` 注释和 S1/S2 的建议清理（若有共识），然后 `/mvt-test` 确认回归测试连续性。

## Highlights

- **测试覆盖完整：** 6 个测试覆盖了快乐路径、作用域守卫、缺失 session 文件、session 解析失败、幂等性、epic.yaml 不回滚——相当于对 sync 函数的穷举契约测试。
- **错误处理分层清晰：** main() 明确区分"epic.yaml 写入失败→exit 1"和"session 同步失败→仅报告不 exit"——职责边界分明，是 best-effort 模式的正确实现。
- **最佳测试实践：** 测试名表述场景而非函数名（如 `"is scoped: leaves active_epic alone when session points at a different epic"`），符合 Group E 的要求。

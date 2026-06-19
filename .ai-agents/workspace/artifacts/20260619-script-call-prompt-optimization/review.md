---
id: 'review-output'
version: '1.0'
skill: 'mvt-review'
---

# Code Review Report

## Summary

| 指标 | 数量 |
|------|------|
| Critical | 0 |
| Warning | 1 |
| Suggestion | 2 |
| **Verdict** | **Approve with comments** |

本次审查覆盖 change `20260619-script-call-prompt-optimization` 的全部 14 个源文件和 6 个生成的 SKILL.md 产物。审查维度包括：设计合规性、代码质量、错误处理、边界情况、测试覆盖。

**总体结论**：实现严格遵循了设计文档中 5 个 ADR 的全部要求。6 个目标 skill 的生成产物均正确渲染对应的布尔指导模式。测试覆盖了所有新增渲染路径，全量测试 257 通过。存在 1 个 Warning（设计文档建议的倒装包裹器未实现）和 2 个建议改进项。

## Review Scope

- **深度**: 全量审查
- **设计合规检查**: 已执行（design.md 可用）
- **回退说明**: 无 — 所有必要输入均存在

## Critical Issues

无。

## Warnings

### W1: `script-usage-rule.md` 未使用倒装包裹器抑制通用块

| 字段 | 内容 |
|------|------|
| **文件** | `sources/sections/script-usage-rule.md` |
| **行范围** | 1-40 |
| **严重度** | Warning |
| **观察** | 设计文档的 `Section rendering contract` 建议使用倒装包裹器模式（`{{^plan_update_inline_command_only}}{{#uses_plan_update}}...{{/uses_plan_update}}{{/plan_update_inline_command_only}}`）来确保当 manifest 同时设置通用和专用标志时不会重复渲染。但当前实现使用顺序独立块，缺少机械性互斥保障。 |
| **风险** | 如果某 manifest 误设了矛盾标志（如同时设置 `uses_plan_update: true` 和 `plan_update_inline_command_only: true`），生成产物会同时渲染两个块，造成重复指导。当前所有 manifest 均无此问题，且设计文档明确接受了此风险（"mitigated by section-loader/assembler tests"）。 |
| **建议** | 考虑在后续优化中为互斥标志组添加倒装包裹器，使模板更健壮。当前不阻塞合并。 |

## Suggestions

### S1: 补充矛盾标志组合的渲染测试

| 字段 | 内容 |
|------|------|
| **文件** | `test/section-loader.test.ts` |
| **严重度** | Suggestion |
| **观察** | 当前 5 个新增 section-loader 测试覆盖了各专用模式的独立渲染，但未覆盖矛盾标志组合（如 `plan_update_inline_command_only: true` + `uses_plan_update: true`）的行为。添加此类测试可明确行为契约。 |
| **建议** | 添加一个边界测试：当 manifest 同时设置互斥标志时，验证生成产物包含可预期的输出（两个块都渲染），或者在未来添加倒装包裹器后验证正确抑制。 |

### S2: `mvt-implement` 内联指导缺少非交付物场景的 plan-update 指引

| 字段 | 内容 |
|------|------|
| **文件** | `sources/sections/script-usage-rule.md` (通过 `plan_update_inline_command_only` 路径) |
| **位置** | 生成的 `.claude/skills/mvt-implement/SKILL.md` 第 283-286 行 |
| **严重度** | Suggestion |
| **观察** | `mvt-implement` 的 `plan-update.cjs` 调用只出现在 Step 8（Deliverables Handoff）——该步骤在无下游依赖时被完全跳过。内联指导说 "using the exact command rendered in this skill's workflow"，但日常任务更新走的是 Step 9 的 `/mvt-update-plan` 路径，不需要直接调用 `plan-update.cjs`。当前指导虽非错误，但可能让 AI 在无交付物场景下寻找不存在的命令。 |
| **建议** | 可考虑在内联指导末尾添加限定说明："For normal task status updates, do NOT call `plan-update.cjs` directly; use `/mvt-update-plan` instead." 当前不阻塞合并。 |

## Highlights

### 设计合规性矩阵

| ADR | 要求 | 状态 | 验证方式 |
|-----|------|------|----------|
| ADR-1 | 使用布尔标志而非字符串枚举 | ✅ 通过 | 所有 5 个新标志均为布尔类型；`section-loader.ts` 未改动 |
| ADR-2 | 保留旧有布尔行为作为默认路径 | ✅ 通过 | `mvt-update-plan` 仍使用 `uses_plan_update: true` |
| ADR-3 | 内联命令模式（mvt-implement） | ✅ 通过 | 生成产物无 `--status <new_status>` 或 `plan-update.md` 指针 |
| ADR-4 | 保持通用引用（mvt-update-plan） | ✅ 通过 | 生成产物含通用 plan 命令 + plan-update.md 指针 |
| ADR-5 | 脚本文档仅作回退读取 | ✅ 通过 | 回退措辞精确限定为 "only for modes or flags not rendered in this skill" |
| 引擎无改动 | 不修改 `src/build/*`、`src/types/*`、`sources/scripts/*` | ✅ 通过 | grep 确认无相关文件被改动 |
| 互斥标志文档化 | 冲突标志组合在 design.md 中记录 | ✅ 通过 | design.md Key Interfaces 含互斥关系表 |

### 生成产物验证

| Skill | 通用命令 | 专业指导 | 文档指针 | 预期行为 |
|-------|----------|----------|----------|----------|
| `mvt-implement` | 无 `--status <new_status>` | "exact command rendered in this skill's workflow" | 无 `plan-update.md` | ✅ 内联模式 |
| `mvt-update-plan` | 有 plan 通用命令 | "exact mode commands rendered" (epic) | 有 `plan-update.md`, 无 `epic-update.md` | ✅ 混合模式 |
| `mvt-decompose` | 无 | fallback 措辞 | 有 `epic-update.md` (仅未渲染的模式) | ✅ 回退模式 |
| `mvt-analyze` | 无 | fallback 措辞 | 有 `epic-update.md` (仅未渲染的模式) | ✅ 回退模式 |
| `mvt-sync-context` | 无 `--status <new_status>` | "pass `--projects`" | 有 `plan-update.md` (仅未渲染的模式) | ✅ 项目提醒模式 |
| `mvt-cleanup` | N/A | N/A | N/A (无 Script Usage Rule) | ✅ 移除正确 |

### 测试覆盖评估

| 测试文件 | 相关测试数 | 覆盖范围 |
|----------|-----------|----------|
| `test/section-loader.test.ts` | 5 个新增 + 4 个既有相关 | 各专用模式独立渲染、通用模式、无标志场景 |
| `test/assembler.test.ts` | 6 个新增断言块 | 6 个目标 skill 的完整输出验证 |
| 全量 `npm test` | 257 通过 | 无回归 |

## Skipped Checks

- **Group C (Error Handling)**: 本次变更为文档层改动，无运行时错误处理路径。
- **Group F (Security)**: 无认证/授权相关代码。

## Recommended Next Skill

- 无 Critical 发现，无需 `/mvt-fix`
- 若接受 S2 建议 → `/mvt-quick-dev` 对 `script-usage-rule.md` 做细微措辞调整
- 若需补充 S1 建议的测试 → `/mvt-test`
- 若审查通过 → `/mvt-update-plan` 标记审查任务完成

# mvt-help 提示词问题报告

> 审查对象：`sources/skills/mvt-help/business.md`（及关联的 SKILL.md Activation / Output Format）
> 日期：2026-06-19
> 状态：待处理

## P0 — 一致性冲突（会导致输出不稳定）

### P0-1 Step 3 与 Output Format 分组规则矛盾
- **位置**：Step 3 "Display all skills as a single flat table (no grouping)" vs Output Format "Skills tables grouped by category"
- **现状**：两处指令相反，模型无法确定 flat 还是分组
- **建议**：统一为 flat table；Output Format 改为 `Single flat skills table, sorted by registry declaration order`

### P0-2 Step 2 与 Edge Cases 的 Critical 重复
- **位置**：Step 2 表 "review.md has Critical findings → /mvt-fix" vs Edge Cases "Critical review findings → surface prominently"
- **现状**：同一逻辑两处描述，Edge Cases 额外要求"prominently surface"，优先级未声明
- **建议**：合并到 Step 2 主表（追加"prominently surface above catalog"），Edge Cases 只保留非主表异常

## P1 — 指令模糊（模型易猜测）

### P1-1 Step 2 证据缺乏可操作定义
- **位置**：Step 2 决策表
- **现状**：`analysis.md` 路径未定义；`history` 中 `/mvt-analyze` 匹配规则未定义；"Change Tracking lists > 5 files" 章节字段名未定义
- **建议**：表前加"证据约定"——artifact 路径模板、`history[].skill` 匹配规则（前缀 `/mvt-` + name，大小写敏感）、Change Tracking 指 `design.md > ## Change Tracking` 文件计数

### P1-2 Step 4 着色无模板（当前选中行）
- **位置**：business.md:51 "Color-code based on current progress"
- **现状**：要求 green/yellow/gray 着色，但未给 mermaid `classDef`/`class` 模板；文本退化时如何标注也未定义
- **建议**：补 mermaid 着色模板片段（`classDef done/current/pending` + 节点 `:::done`）；Edge Cases 文本退化分支明确用 `[done]`/`[current]`/`[pending]` 标注

### P1-3 Step 5 reason 指令机械
- **位置**：Step 5 "one-clause reason citing the matched condition"
- **现状**：condition 本身即 reason，模型易原样复读
- **建议**：改为"reason explaining why this condition matches the current state fact"（锚定状态事实而非 condition 文本）

## P2 — 冗余 / 可简化

### P2-1 Activation Step 2 (PS 解析) 对只读 help 过重
- **位置**：SKILL.md Activation Protocol Step 2
- **现状**：Plan-driven / Non-plan 双模式、路径匹配、用户询问——help 不写 artifact，几乎用不到
- **建议**：简化为"加载 `knowledge._all` + `skills.mvt-help.knowledge._all`；project-specific 按需加载"

### P2-2 Knowledge Loading 反模式段落重复
- **位置**：SKILL.md Activation Step 3 "Anti-pattern -- DO NOT"
- **现状**：通用规则局部重复，易与其他 skill 版本漂移
- **建议**：抽取到 `sources/sections/activation-knowledge-loading.md` 共享 section

### P2-3 Output Format `{name}` 来源未定义
- **位置**：Output Format `**Project**: {name}`
- **现状**：未说明取自 `project-context.yaml > projects[].name` 还是 `session.yaml`；多项目取哪个
- **建议**：明确 `{name}` = `project-context.yaml > projects[]` 名称列表（多项目逗号拼接），`initialized` = `session.yaml.initialized_at` 非空

## P3 — 健壮性增强

### P3-1 registry 存在但 skills 段为空未处理
- **位置**：Edge Cases 表
- **现状**：只覆盖 "registry.yaml missing"
- **建议**：增加 `registry.yaml present but skills empty/malformed → STOP at Step 3; recommend mvtt install; show no catalog`

### P3-2 兜底回复生硬
- **位置**：Step 5 "Asks about something not in registry"
- **现状**："No skill matches that. Available skills: see catalog above." 冷漠且 catalog 可能已滚出
- **建议**：改为基于 registry description 关键词的模糊匹配，给出 top-2 近似 skill

### P3-3 Suggested Next Steps 条件过少
- **位置**：Suggested Next Steps
- **现状**：仅 3 条件（not initialized / no active change / active change），与 Step 2 的 12 行状态脱节
- **建议**：Next Steps 首候选直接复用 Step 2 推荐结果，再补 1-2 个上下文次选

## 修复优先级清单

| 优先级 | 编号 | 动作 |
|--------|------|------|
| P0 | P0-1 | 统一 flat table，修 Output Format 文案 |
| P0 | P0-2 | Critical 逻辑合并到 Step 2 主表 |
| P1 | P1-1 | Step 2 前加"证据约定"段落 |
| P1 | P1-2 | 补 mermaid 着色模板 + 文本退化标注 |
| P1 | P1-3 | reason 锚定状态事实 |
| P2 | P2-1 | PS 解理简化为 on-demand |
| P2 | P2-2 | 反模式抽取为共享 section |
| P2 | P2-3 | 明确 `{name}` 来源 |
| P3 | P3-1 | 补 registry 空但存在的 Edge Case |
| P3 | P3-2 | 兜底回复改模糊匹配 |
| P3 | P3-3 | Next Steps 复用 Step 2 推荐 |

# 架构设计评审 v3: 多项目工作流支持 (OPT-2026-002)

> 变更 ID: `20260605-multi-project-workflow-support`
> v3 日期: 2026-06-06
> v3 性质: **最终版** — 全部决策已确认，全部缺口已定义解决方案，可直接进入实现阶段
> 关键前提: **绿地项目，无存量用户，破坏性变更可接受，无需迁移逻辑。**

---

## 1. 已确认决策记录

### 决策 1: DAG 多项目推进 — 选项 A（按项目独立 in_progress）

| 项目 | 内容 |
|------|------|
| **决策** | `validatePlan` 允许每个项目各一个 `in_progress`；`current_task` 变为 `current_tasks`；`findCycle` 按项目子图；`recomputeCurrentTask` 项目感知 |
| **解决的评审项** | P0-1（致命） |
| **plan.yaml schema 变更** | `current_task: string` → `current_tasks: Record<string, string>`（项目名 → 任务 ID） |
| **plan-update.js 变更** | `validatePlan`: 每项目最多一个 `in_progress`（非全局）。`recomputeCurrentTask`: 按项目推进，跨项目推进时 emit `project_switch` 通知。`findCycle`: 按项目子图检测环 |
| **skill 变更** | `mvt-update-plan`: 读取 `current_tasks`（非 `current_task`）。`mvt-status`: 按项目展示各 `current_task`。`mvt-resume`: 处理 `project_switch` 通知 |

### 决策 2: 跨项目 depends_on — 允许

| 项目 | 内容 |
|------|------|
| **决策** | 允许跨项目 `depends_on`。`skipped` 满足跨项目 `depends_on`（与决策 4 一致）。跨项目依赖推进时 emit `project_switch` 通知 |
| **解决的评审项** | NEW-P1（跨项目 depends_on 语义） |
| **recomputeCurrentTask 行为** | 任务 t1(project:["api"]) depends_on t2(project:["web"])：t2 为 done 或 skipped 时 t1 可推进；t2 为 blocked 时 t1 仍阻塞 |

### 决策 3: 非计划技能的 PS 解析 — 执行时按需识别

| 项目 | 内容 |
|------|------|
| **决策** | 非计划技能（mvt-quick-dev、mvt-fix、mvt-refactor、mvt-review 等）可一次性修改仓库内所有项目。技能在执行过程中识别需要更改的项目，并加载对应的项目上下文信息（如果有） |
| **解决的评审项** | P1-5（非计划技能 PS 解析路径） |
| **激活时行为** | 加载 `knowledge._all`（全局知识），不急于解析到单一项目 |
| **执行时行为** | 根据用户请求中的文件路径/变更描述，识别涉及的项目，加载对应的 `knowledge.{projectName}` 和 `skills.{name}.knowledge.{projectName}` |
| **与计划技能的区别** | 计划技能在激活时通过 `current_task.project` 确定项目并一次性加载；非计划技能在激活时加载全局知识，执行中按需加载项目知识 |

### 决策 4: skipped 满足 depends_on

| 项目 | 内容 |
|------|------|
| **决策** | `skipped` 满足 `depends_on`（依赖视为已解决）；`blocked` 不满足（依赖未解决） |
| **解决的评审项** | P2-9 |
| **代码变更** | `recomputeCurrentTask` 中 `doneIds` 改为 `resolvedIds = new Set(tasks.filter(t => t.status === "done" || t.status === "skipped").map(t => t.id))` |

### 决策 5: 项目命名限制

| 项目 | 内容 |
|------|------|
| **决策** | 项目名仅允许 `[a-zA-Z0-9_-]` 且不以 `_` 开头 |
| **解决的评审项** | NEW-P1（`_all` 键名碰撞） |
| **校验位置** | `mvt-init` 写入 `project-context.yaml` 时校验；`plan-update.js --projects` 校验每个值 |

### 决策 6: ADR-6 状态 — accepted

| 项目 | 内容 |
|------|------|
| **决策** | ADR-6（扩展 scope 到 `src/fs/registry-merge.ts`）状态从 `proposed` 改为 `accepted` |
| **解决的评审项** | ADR-6 状态确认 |

### 前置决策（v2 中已确认）

| 决策 | 内容 | 解决的评审项 |
|------|------|-------------|
| D-R2 | 不在 session.yaml 中保留 `active_project` | P1-1、P1-4、P1-7 |
| D-R9 | coding-standards 不是独立需求，硬编码路径应移除 | P2-1 |
| D-R10 | mvt-init 不使用 --refresh 参数，改用交互模式 | P2-4 |

---

## 2. 已解决项汇总

| 原编号 | 问题 | 解决方式 |
|--------|------|---------|
| P0-1 | plan-update.js 全局唯一 in_progress vs 多项目并行 | 决策 1: 按项目独立 in_progress |
| P1-1 | active_project 生命周期未定义 | D-R2: 不保留 active_project |
| P1-4 | session.yaml active_project schema 缺失 | D-R2: 不保留 active_project |
| P1-5 | 非计划技能 PS 解析路径缺失 | 决策 3: 执行时按需识别 |
| P1-7 | session-update.js --set-active-project 参数契约缺失 | D-R2: 不需要此参数 |
| NEW-P1 | 跨项目 depends_on 语义未定义 | 决策 2: 允许 + skipped 满足 |
| NEW-P1 | _all 键名碰撞防护缺失 | 决策 5: 项目名限制 |
| P2-1 | S1-6 coding-standards 误升格 | D-R9: 确认纠正 |
| P2-5 | CSV 参数转义 | 决策 5: 项目名限制为 `[a-zA-Z0-9_-]` 且不以 `_` 开头 |
| P2-6 | project-context.yaml 缺 source_paths | 确认: 加入 schema 模板作为空默认值 |
| P2-9 | skipped/blocked 不满足 depends_on | 决策 4: skipped 满足 |

---

## 3. 剩余未解决问题

### P1-2: mvt-manage-context 第 4 象限知识添加操作路径缺失

| 项目 | 内容 |
|------|------|
| **问题** | 2×2 矩阵建好后，用户需要能向第 4 象限（项目 × 技能）添加知识条目。但 `add` 等子命令在新 map 结构下的操作路径未定义 |
| **具体缺口** | `add`: 两问（scope + breadth）→ 4 象限 → registry 键路径的映射表未提供。`remove`: 需遍历所有项目键。`list`: 需按 project × skill 分组。`move`: 需跨项目键移动 |
| **影响** | 用户无法将项目专属知识放入第 4 象限——容器搭好但没有操作入口 |
| **解决方案** | 在设计中新增 "Map 感知操作" 子节，至少包含：<br>1. **add 的两问路由表**：<br>   - scope=全局, breadth=全技能 → `knowledge._all`<br>   - scope=项目, breadth=全技能 → `knowledge.{projectName}`<br>   - scope=全局, breadth=指定技能 → `skills.{name}.knowledge._all`<br>   - scope=项目, breadth=指定技能 → `skills.{name}.knowledge.{projectName}`<br>2. **remove**: 遍历所有项目键搜索目标条目<br>3. **list**: 按 project × skill 三维分组展示<br>4. **move**: 支持跨项目键移动（如 `_all` → `web`）<br>5. **_all 的特殊语义**: 提升到 `_all` = 所有项目的所有技能都会加载，比原 shared 语义更重——需确认流程 |
| **解决后变化** | 用户可通过 mvt-manage-context 向任意象限添加/管理知识条目 |

---

### P1-3: mvt-sync-context 多项目路由缺失

| 项目 | 内容 |
|------|------|
| **问题** | Step 2 硬编码读取 `_generated/project-context.md`。多项目需路由到 `_generated/{name}/project-context.md`，但路由链未定义 |
| **影响** | 多项目场景下 sync-context 不知道该更新哪个项目的语义文件 |
| **解决方案** | 4 级 fallback 路由链（已根据 D-R2 调整）：<br>1. `task.project` 存在 → 路由到该项目文件<br>2. 变更文件路径匹配唯一项目的 `source_paths` 或 `path` → 路由到该项目<br>3. 当前操作的文件所属项目（path 反查） → 路由到该项目<br>4. 列出候选项目供用户选择 |
| **解决后变化** | sync-context 准确路由到正确项目的语义文件 |

---

### P1-6: --deliverables-pointer 参数值域不清

| 项目 | 内容 |
|------|------|
| **问题** | 设计写 `--deliverables-pointer present`，但 ADR-5 定义 freshness 为 `current | stale` 枚举。`present` 不在枚举中 |
| **解决方案** | 明确参数合约：<br>`--deliverables-pointer current` → 写入 `task.deliverables = { freshness: current }`<br>`--mark-deliverable-stale <task_id>` → 写入下游 `task.deliverables.freshness = stale` |
| **解决后变化** | 参数值域与 ADR-5 枚举一致 |

---

### P1-8: activation-load-context.md 具体修改文本未定义

| 项目 | 内容 |
|------|------|
| **问题** | 所有技能共享的激活节需完全重写，但无具体 Markdown 文本。当前 `knowledge.shared` 和 `skills.*.knowledge` 引用格式与新 map 根本不兼容——需删除重写 |
| **解决方案** | 新增 "激活节修改" 子节，起草两种加载模式的精确指令：<br><br>**模式 A: 计划驱动技能**（mvt-implement、mvt-plan-dev 等）<br>1. 读取 `project-context.yaml > projects[]`<br>2. 若 `projects.length == 1` → PS = 唯一项目，跳过所有提示（ADR-1）<br>3. 若多项目 → 读取 plan 的 `current_tasks` 取当前任务的 project（优先级 1）<br>4. 若无 plan 信号 → 文件路径反查 `projects[].path`（优先级 2）<br>5. 若仍无法确定 → 提示用户选择（优先级 3）<br>6. 按 PS 加载知识并集：`_all` + `knowledge[P]` + `skills[S].knowledge._all` + `skills[S].knowledge[P]`<br><br>**模式 B: 非计划技能**（mvt-quick-dev、mvt-fix 等）<br>1. 加载 `knowledge._all` + `skills[S].knowledge._all`（全局知识）<br>2. 执行过程中识别涉及的项目（从文件路径、变更描述推断）<br>3. 按需加载对应项目的 `knowledge[P]` + `skills[S].knowledge[P]`<br><br>**实现准则**: 编辑后必须在同一 commit 执行 `mvtt build` |
| **解决后变化** | 所有技能的激活节有明确指令，两种模式的行为完全确定性 |
| **v3 备注** | 决策 3（非计划技能按需识别）引入了模式 B，这是全新的加载模式。激活节需同时覆盖两种模式 |

---

### P1-9: install-manifest.yaml 子目录推理需修正

| 项目 | 内容 |
|------|------|
| **问题** | ADR-7 结论正确但推理有误。`materialize.ts:183-193` 仅 `mkdirSync(dir, { recursive: true })`，不追踪内容——不是"前缀匹配 vs 精确匹配"问题 |
| **解决方案** | 修正 ADR-7 推理为"确保目录存在，内容不受管理"。修正 BR-10：`_generated/` 是 `user_data_dirs` 不是 `generated` |

---

### P1-10: 测试覆盖缺口

| 项目 | 内容 |
|------|------|
| **问题** | 新结构下测试覆盖率不足 |
| **具体缺口** | **registry-merge.test.ts**(6 项): 项目隔离、`_all` 绑定保留、空项目键、跨项目同名碰撞、install/update 字节一致性、stableKey 跨项目键不误去重<br>**plan-update.test.ts**(5 项): skipped/blocked 不满足 depends_on、其他 in_progress 存在时保留 current_task、completed_at 回退清除、--artifacts 累积去重、更新非 current_task 不改变 current_task<br>**决策 1 新增测试**: 按项目独立 in_progress 验证、current_tasks 按项目推进、跨项目推进 emit project_switch、findCycle 按项目子图<br>**决策 4 新增测试**: skipped 满足 depends_on、跨项目 skipped 满足 depends_on |
| **解决方案** | 补充上述测试用例；测试中 `RegistryDoc` 和 `doc.knowledge!.shared!.push(...)` 全面更新为 map 操作 |

---

### NEW-P1: per-skill knowledge 合并逻辑 map 适配被低估

| 项目 | 内容 |
|------|------|
| **问题** | `registry-merge.ts:117-128` 假设 `skills.<name>.knowledge` 是数组，ADR-2 将其变为 map，ADR-6 未区分顶层和 per-skill 两个合并路径 |
| **解决方案** | 在 ADR-6 Consequences 中显式标注：per-skill knowledge 合并从数组迭代改为 map-per-key 迭代，与顶层 knowledge 合并同构但独立执行 |

---

### P2 项一览

| ID | 问题 | 解决方案 | 状态 |
|----|------|---------|------|
| P2-2 | session-update.js 硬替换 active_change 字段枚举 | 文档化约束；考虑重构 `activeChangeFields()` | 实现时处理 |
| P2-3 | 双通道知识加载分工 | 移除 `mvt-quick-dev/manifest.yaml:42` 的 coding-standards 条目，约定 extended_context 仅用于动态路径 | 实现时处理 |
| P2-4 | mvt-init 项目变更处理 | D-R10: 移除 --refresh，改为交互式检测+提示 | 已定义，待写入 |
| P2-5 | CSV 参数转义 | 决策 5: 项目名限制为 `[a-zA-Z0-9_-]` 且不以 `_` 开头 | 已解决 |
| P2-6 | project-context.yaml 缺 source_paths | 加入 schema 模板作为空默认值，由 mvt-analyze-code 填充 | 已解决 |
| P2-7 | mvt-cleanup 多项目交互 | 一行确认：按 change-id 归档，不感知项目 | 实现时处理 |
| P2-8 | Registry 接口缺 knowledge 字段 | 添加 `knowledge: Record<string, KnowledgeEntry[]>` | 实现时处理 |
| NEW-P2 | mvt-check-context 按项目计账规则 | 按项目独立计账 + 全局汇总 | 实现时处理 |
| NEW-P2 | 孤儿项目知识条目清理 | mvt-manage-context list 标注孤儿；mvt-init 提示清理 | 实现时处理 |
| NEW-P2 | --deliverables-pointer 与 --mark-deliverable-stale 非原子执行 | 支持单次调用同时传入两个参数 | 实现时处理 |

---

## 4. 决策 3 引入的新设计缺口

决策 3（非计划技能执行时按需识别项目并加载上下文）引入了一种新的知识加载模式。当前设计中未定义以下细节：

### GAP-1: 非计划技能的"执行中按需加载"机制 → 已确认

| 项目 | 内容 |
|------|------|
| **问题** | 计划技能在激活时一次性加载所需知识（PS 确定 → 加载并集）。非计划技能在激活时只加载 `_all`，执行中识别项目后需加载对应项目知识。但当前 MVTT 架构中，知识加载仅发生在激活节（Step 2），**不存在"执行中二次加载"的机制** |
| **需要定义的内容** | 1. **加载方式**: 非计划技能识别到项目后，如何加载对应知识？<br>   - 方案 a: 技能的 business.md 中显式指令"读取 `.ai-agents/knowledge/project/_generated/{name}/project-context.md` 和 registry 中 `knowledge.{name}` 声明的文件"——这是直接文件读取，无需新机制<br>   - 方案 b: 在激活节中增加"若为非计划技能，加载所有项目的 knowledge"——简单但 token 开销大<br>2. **项目识别时机**: 从用户的请求内容（文件路径、变更描述）中推断，还是在 Step 1（读取项目索引）后立刻判断？<br>3. **多项目场景**: 用户请求涉及多个项目时，依次加载各项目知识 |
| **确认方案** | **方案 a**: 在非计划技能的 business.md 中增加指令，根据变更目标文件路径匹配 `projects[].path` 确定项目，然后显式读取对应知识文件。无需新机制，利用已有的文件读取能力 |
| **影响范围** | `mvt-quick-dev/business.md`、`mvt-fix/business.md`、`mvt-refactor/business.md`、`mvt-review/business.md` 的操作步骤中需增加项目识别 + 知识加载指令 |

### GAP-2: 决策 1 对 plan.yaml schema 和脚本的影响细节 → 已确认

| 项目 | 内容 |
|------|------|
| **问题** | `current_task: string` → `current_tasks: Record<string, string>` 的具体行为需细化 |
| **确认结论** | 1. **单项目也使用 `current_tasks`**：不保留 `current_task` 向后兼容，绿地项目可接受破坏性变更<br>2. **跨项目任务**：`project: ["web","api"]` 的任务为 in_progress 时，`current_tasks` 中每个涉及的项目的键都指向它<br>3. **plan 完成**：`current_tasks` 为空对象 `{}`<br>4. **JSON 输出**：`current_task: "t1"` → `current_tasks: { web: "t3", api: "t1" }`，所有消费 JSON 的 skill 需更新 |

---

## 5. 设计文档需更新的内容

基于全部决策和剩余缺口，design.md 需更新以下内容：

| 更新项 | 类型 | 优先级 | 说明 |
|--------|------|--------|------|
| 新增 ADR-8: 按项目独立 in_progress | ADR | P0 | 记录决策 1 的推理和后果 |
| ADR-4 补充: 跨项目 depends_on 语义 | ADR 补充 | P1 | 记录决策 2：允许，skipped 满足 |
| ADR-2 补充: 非计划技能的两种加载模式 | ADR 补充 | P1 | 记录决策 3：激活时 `_all` + 执行中按需 |
| ADR-6 状态: proposed → accepted | ADR 更新 | P1 | 决策 6 |
| Key Interfaces: `current_tasks` schema | Schema 定义 | P1 | 替代原 `current_task` |
| Key Interfaces: 移除 `active_project` | Schema 移除 | P1 | D-R2 |
| Key Interfaces: 移除 `--set-active-project` | CLI 移除 | P1 | D-R2 |
| Key Interfaces: `--deliverables-pointer` 参数合约 | CLI 定义 | P1 | P1-6 |
| Key Interfaces: 项目命名约束 | 约束定义 | P1 | 决策 5 |
| Data Flow: Flow 1 简化为 3 级 PS 解析 | 流程更新 | P1 | D-R2 移除 session 锚点 |
| Data Flow: Flow 1 增加模式 B（非计划技能） | 流程新增 | P1 | 决策 3 |
| Module Design: mvt-manage-context map 操作路径 | 设计补充 | P1 | P1-2 |
| Module Design: mvt-sync-context 路由链 | 设计补充 | P1 | P1-3 |
| Module Design: mvt-init 交互模式（移除 --refresh） | 设计修改 | P2 | D-R10 |
| ADR-7 推理修正 | 文档修正 | P1 | P1-9 |
| BR-10 修正 | 文档修正 | P1 | _generated/ 是 user_data_dirs |
| S1-6 修正 | 文档修正 | P2 | D-R9 |
| `recomputeCurrentTask` 中 `doneIds` → `resolvedIds` | 行为变更 | P2 | 决策 4 |
| 新增: coding-standards.md 硬编码路径移除清单 | 代码清理 | P2 | D-R9 |

---

## 6. 最终确认记录

| # | 确认项 | 决策 |
|---|--------|------|
| 1 | GAP-2: 单项目也使用 `current_tasks` 格式 | **是** — 不保留 `current_task` 向后兼容 |
| 2 | GAP-1: 非计划技能按需加载方案 | **方案 a** — business.md 中显式读取指令，无需新机制 |
| 3 | P2-6: `source_paths` 加入 project-context.yaml schema | **加入** — 作为空默认值，由 mvt-analyze-code 填充 |
| 4 | P2 项处理方式 | **实现时处理** — 不在设计阶段逐一展开 |

---

## 7. 行动路线

| 步骤 | 行动 | 目的 |
|------|------|------|
| **1** | 更新 design.md（第 5 节所列全部更新项） | 设计文档与决策一致 |
| **2** | 执行 `/mvt-plan-dev` | 分解为可跟踪的实现任务 |

---

*本文档为设计评审的 v3 决策落地版。所有 P0/P1 级架构决策已确认，剩余 P2 项建议在实现阶段处理。*

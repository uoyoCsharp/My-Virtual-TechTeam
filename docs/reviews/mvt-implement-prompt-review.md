# mvt-implement 提示词优化提案

> 审查对象：`sources/skills/mvt-implement/business.md`（Step 2 / Step 5 / Step 8）
> 日期：2026-06-19
> 状态：待审核

---

## P0 — 数据风险（可能导致 plan.yaml 状态被误覆盖）

### P0-1 Step 8 `--status <current_status>` 参数假设脆弱

- **位置**：Step 8 "Deliverables Handoff" 的 `plan-update.cjs` 命令模板
- **现状**：命令模板要求 AI 传入 `--status <current_status>`，注释说"typically `in_progress`"。但 `plan-update.cjs` 的 `applyUpdate()` 对 `--status` 是**无条件覆盖式写入**（`task.status = args2.status`），且会联动 `completed_at` 与 DAG 重算。AI 若误传 `done`，会把下游任务提前推进、写入错误的 `completed_at`。
- **根因**：Step 8 的语义意图是"只更新 deliverables 指针 + stale 标记，不动 status"，但脚本架构强制 `--status` 为必填参数（`validateArgs()` 缺省即报错退出），导致 AI 必须精确复述当前状态才能避免副作用——这是"用全量覆盖语义表达增量更新意图"的设计错配。
- **推荐方案（A+B 组合）**：
  - **脚本侧（根因修复）**：`plan-update.cjs` 新增 `unchanged` 作为 `--status` 的合法特判值——`applyUpdate()` 识别到 `unchanged` 时跳过 `task.status` 赋值及 `completed_at` 联动，仅处理 deliverables flags。不写入 `VALID_STATUSES`，只在 `applyUpdate` 内部特判。
  - **提示词侧（防御指令）**：Step 8 命令模板将 `<current_status>` 替换为 `unchanged`，并删除"typically `in_progress`"的猜测性注释。
- **涉及文件**：`.ai-agents/scripts/plan-update.cjs`、`sources/scripts/plan-update.md`、`sources/skills/mvt-implement/business.md` Step 8

---

## P1 — 适用性偏差（对非 DDD 项目产生错误引导）

### P1-1 Step 2 拓扑排序硬编码 DDD 词汇

- **位置**：Step 2.2 "Topologically order files by dependency: domain entities -> repositories/adapters -> use-case/services -> controllers/UI"
- **现状**：排序链使用 DDD/分层架构的专属词汇。但 `mvt-design` Step 3 明确支持 5 种架构风格（Plain CRUD、Service-oriented、Domain-driven、Event-driven、Multi-service），加上前端项目，共 6 类场景不适用此链。AI 遇到非 DDD 项目时要么强行套用错误词汇，要么忽略规则自行排序，行为不一致。
- **推荐方案（A）**：将硬编码链替换为"按 `design.md` ADR 选定的架构风格查下表"的映射表：

  | Architecture Style (from design.md ADR) | Topological order (dependency-first) |
  |---|---|
  | Plain CRUD / 3-layer | model/schema -> repository/dao -> service -> controller/route |
  | Service-oriented within a module | interface/contract -> service -> dao/repository |
  | Domain-driven | domain entity -> repository/adapter -> use-case/service -> controller/UI |
  | Event-driven / async | event schema -> producer -> consumer/handler |
  | Multi-service / boundary split | shared contract -> service A, service B (per boundary) |
  | Frontend / UI | types/models -> hooks/store -> components -> pages/routes |
  | Unknown / not specified | infer from actual import graph; lowest-level (no internal deps) first |

- **涉及文件**：`sources/skills/mvt-implement/business.md` Step 2.2

---

## P2 — 设计讨论（需先定方向再细化）

### P2-1 Step 5 "Verify Design Compliance" 的三个子问题

- **位置**：Step 5 整体
- **现状**：Step 5 定义 6 项检查，标注 Auto/Manual，存在以下子问题需讨论定方向：

#### 子问题 a：与 `mvt-review` Group A 职责重叠

`mvt-review` Group A 做几乎相同的检查（file in module/layer、dependency direction、public interfaces match、deviations documented）。重叠导致：`mvt-implement` 自检 → 写 `implementation.md` → 用户跑 `/mvt-review` → 重复检查，结论可能不一致。

**三个候选方向**：

| 方向 | 做法 | 取舍 |
|---|---|---|
| **X** | Step 5 只保留"机械性、必须通过才能交付"的检查（forbidden imports、files match Change Tracking），把"需判断的合规性"完全交给 `mvt-review` | 职责清晰，但 `mvt-implement` 自检能力削弱 |
| **Y** | 保持现状，明确标注"Step 5 是自检，`mvt-review` 是独立复核" | 改动最小，但重复劳动未解决 |
| **Z** | Step 5 结果写入 `implementation.md > Design Compliance`，`mvt-review` 读取该段作为输入，只复核"声称通过的项目" | 形成接力而非重复，但需同步改 `mvt-review` |

#### 子问题 b："Auto" 标注过于乐观

| 检查项 | 标注 | 实际 |
|---|---|---|
| Files touched == Change Tracking | Auto | ✅ 真自动 |
| File lives in module/layer | Auto (path match) | ⚠️ 半自动——依赖 `design.md > Module Design` 表有 path→module 映射，但模板该段是空标题无列结构 |
| Public interfaces match Key Interfaces | Auto (grep) | ⚠️ 半自动——grep 能找声明，但"签名匹配"需语义比较，实际是 Manual |
| Forbidden cross-layer imports | Auto (grep) | ✅ 真自动——但前提是 `project-context.md` 有明确 forbidden 规则 |
| Error handling at boundaries | Manual | ✅ 诚实 |
| No new external deps | Auto (diff manifests) | ✅ 真自动——但纯脚本项目无 manifest 可 diff |

**建议**：将"Auto"细分为 `Auto (mechanical)`（列表比较、grep、diff）与 `Semi-auto (heuristic)`（需 AI 解析结构再判断），对 Semi-auto 项注明"依赖 design.md 表格结构，结构不完整则降级为 Manual"。

#### 子问题 c：BLOCK 分级不清晰 + design.md 缺失降级路径笼统

- **BLOCK 分级**：第 3 项（interface 不匹配）标注"raise as deliberate change requiring `/mvt-design` re-run"实为隐性 BLOCK，第 6 项（new deps）同理，但均未标 BLOCK。建议明确三级：`BLOCK`（必须停下）、`WARN-and-document`（记录偏离可继续）、`FIX-in-place`（当场改代码）。
- **降级路径**：Edge Cases 说 `design.md` missing → "skip Step 5 design-match checks"过于笼统。实际应明确：跳过第 1/2/3/5/6 项（依赖 design），保留第 4 项（依赖 project-context.md）。

- **涉及文件**：`sources/skills/mvt-implement/business.md` Step 5 + Edge Cases 表（方向若选 Z 还涉及 `sources/skills/mvt-review/business.md`）

---

## 修复优先级清单

| 优先级 | 编号 | 动作 | 前置条件 |
|--------|------|------|----------|
| P0 | P0-1 | 脚本加 `unchanged` 特判 + 提示词改用 `unchanged` | 无 |
| P1 | P1-1 | Step 2.2 替换为架构风格-拓扑顺序映射表 | 无 |
| P2 | P2-1a | Step 5 与 mvt-review 职责划分定方向（X/Y/Z） | **需决策** |
| P2 | P2-1b | Auto 标注细分为 mechanical / semi-auto | 依赖 P2-1a 方向 |
| P2 | P2-1c | BLOCK 三级分级 + design.md 缺失降级路径细化 | 依赖 P2-1a 方向 |

---

## 待决策项

1. **P0-1**：是否认可 A+B 组合方案？脚本侧改动是否可接受？
2. **P1-1**：映射表是否覆盖你项目中的实际架构风格？是否需要增减行？
3. **P2-1a**：Step 5 与 `mvt-review` 的职责划分倾向哪个方向（X/Y/Z）？

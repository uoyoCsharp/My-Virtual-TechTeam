# 优化提案：MVTT 各 Skill 的多项目工作流支持

> **提案编号**：OPT-2026-002
> **版本**：v2.4（新增 4.4 脚本影响面：明确 `plan-update.js` 3 处 + `session-update.js` 1 处主动改动，`--projects` 校验采「调用方传参」方案，修正涉及文件/范围说明。承接 v2.3：`task.project` 数组、`deliverables` 自由文本；v2.2：4.1 统一 `knowledge` 映射 + `_all` 键、4.3 命名与交互。全新项目前提，允许破坏性变更）
> **状态**：草案
> **涉及 Skill**：mvt-manage-context、mvt-plan-dev、mvt-update-plan、mvt-implement、mvt-analyze-code、mvt-sync-context、mvt-init、mvt-status、mvt-check-context、mvt-resume
> **涉及文件**：`sources/defaults/project-context.yaml`、`sources/defaults/session.yaml`、`registry.yaml`、`sources/sections/activation-load-context.md`、多个 `sources/skills/*/business.md`、`sources/scripts/plan-update.js`、`sources/scripts/session-update.js`（源文件；经 esbuild 打包为 `.ai-agents/scripts/*.cjs`）
> **作者**：xiangjie

---

## 1. 故事背景

MVTT 目前对**单项目仓库**的支持非常完善：一个仓库、一份 `project-context.yaml` 条目、一份语义 `project-context.md`、一条线性 `plan.yaml`。每个 skill 加载相同的上下文、面向相同的代码面进行推理，抽象从不泄漏。

但现代仓库越来越多是**多项目**形态。一个仓库里常常前端和后端并存（有时更多：共享库、基础设施包、CLI 工具）。团队希望用**一个 MVTT 工作区**驱动整个仓库，并**统一管控所有子项目的整体进度**——而不是装三遍 MVTT、再手动把结果拼起来。

数据层其实已经为此预留了能力：`project-context.yaml` 被明确设计为多条目索引（`projects[]`，每条带 `name` / `path` / `type` / `tech_stack`），`mvt-analyze-code` 也支持 `--all` 和 `{name}` 按项目分析。**但建立在该索引之上的工作流 skill 从未被改造成"项目感知"。** 上下文全局加载、计划不记录任务所属项目、任务间的跨项目交接也没有任何持久化的承载。

本提案要补的就是这块缺口：让**工作流层**尊重**数据层**早已支持的多项目结构。

---

## 2. 现有问题

### 2.1 现象

在多项目仓库中，一个处理**前端任务**的 skill 仍会加载**整个**工作区上下文，包括所有后端语义知识。AI 因此：

- 在无关项目上浪费上下文 token；
- 可能被另一个项目的规则**误导**（例如把后端的分层约束套用到前端文件上）。

另外，当一个任务的产出是后续任务的输入时（前端消费后端产出的 API 契约），**没有任何持久化、结构化的交接记录**。一旦会话重启，下游任务就无法可靠地还原上游任务到底产出了什么。

### 2.2 根因分析

三个相互独立的缺陷叠加导致：

**缺陷 A —— 上下文全局加载，没有项目作用域。**
`registry.yaml > knowledge.shared` 只声明了一条 `project-context` 条目，指向单个文件 `knowledge/project/_generated/project-context.md`。`mvt-analyze-code` 在多项目时把所有项目写进**同一个文件**（用 `# Project: {name}` 标题加 `---` 分隔）。激活协议（`sources/sections/activation-load-context.md` 加 registry 知识加载步骤）随后为**每一次** skill 调用加载**完整的** shared 知识。结果就是：多项目 = 永远全量上下文。

**缺陷 B —— 不存在"当前项目"这一概念。**
`session.yaml` 只跟踪 `active_change`，没有 `active_project`。也没有任何 skill 具备"我现在在哪个项目上工作"的解析规则。缺了这个信号，即便上下文可拆分，skill 在脱离计划运行时（临时 `/mvt-design`、`/mvt-analyze` 等）也不知道该加载哪一份。

**缺陷 C —— 计划对项目无感，交接缺乏结构。**
`mvt-plan-dev` 的任务 schema 没有 `project` 字段，因此一份计划里不同项目的任务无法区分。`task.artifacts.files` 记录了**改了哪些文件**、`implementation.md` 记录了**做了什么**，但都没有承载**下游任务需要消费的契约**（前端依赖的 API 形状）。交接只存在于对话里，会话一新建就丢失。

### 2.3 影响

| 维度 | 缺口带来的影响 |
|------|----------------|
| Token 预算 | 多项目仓库里每个 skill 都加载 N 个项目份的 `project-context.md`；`mvt-check-context` 的"被每个 skill 加载"口径既高估又无法按项目归因 |
| AI 决策质量 | 跨项目规则串味：skill 可能强制或建议错误项目的约定，产出错误的实现或评审 |
| 进度管控 | 无法看到"前端 3/5、后端 2/4"——而这正是初衷。进度只是一条不区分项目的列表 |
| 会话持久性 | 跨项目依赖（前端 ⇐ 后端契约）在重启后丢失；下游任务只能重新猜测上游产出 |

---

## 3. 现有架构分析

### 3.1 已支持多项目的部分

| 组件 | 多项目状态 |
|------|-----------|
| `project-context.yaml` | ✅ `projects[]` 多条目索引（name / path / type / tech_stack） |
| `mvt-analyze-code` | ✅ 支持 `--all` 和 `{name}`；按项目替换 section，保留未分析项目 |
| `project-context.md` | ⚠️ 多项目**内容**存在，但全部塞在**同一个文件**里、归属同一条 shared 知识 |

### 3.2 对项目无感的部分

| 组件 | 缺口 |
|------|------|
| `registry.yaml > knowledge.shared` | 单条全局 `project-context`，无项目作用域 |
| 激活协议（`activation-load-context.md`） | 为每个 skill 加载完整 shared 知识；没有"按当前项目过滤"的步骤 |
| `session.yaml` | 无 `active_project`，无当前项目锚点 |
| `mvt-plan-dev` / `plan.yaml` 任务 schema | 任务上没有 `project` 字段 |
| `plan-update.cjs` | 没有把任务与已知项目绑定的校验 |
| `mvt-implement` | 读取全局 `project-context.md`；无按项目作用域；无结构化"产出契约"输出 |
| `mvt-status` / `mvt-check-context` / `mvt-sync-context` | 无按项目分组 / 归因 / 路由 |

### 3.3 依赖链

三个解决方案**并非彼此独立**——它们共享同一个地基：

```
        前提：当前项目解析
        （active_project 锚点 + 推断规则）
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                   │
   方案一             方案二              方案三
   项目级上下文       计划任务 project    任务交接
   加载                                  （deliverables）
```

方案二（`task.project`）同时也是方案一获取当前项目信号**最廉价的来源**：执行 `current_task` 时，skill 读 `task.project` 即知该加载哪一份上下文。

---

## 4. 解决方案提案

### 4.0 前提 —— 当前项目的智能解析（三方案共同地基）

> **本节为 v2 重点修订。** 遵循 MVTT 框架原则——**多给选项让用户选择、尽量不要求用户传入参数、框架应智能处理默认值并自动推断用户意图**——我们**不**设定 `/mvt-implement --project api` 这类"用户显式传参"的预期。当前项目应由框架**自动推断**得出；只有在推断出现歧义时，才**列出候选项让用户挑选**。

引入"skill 当前所操作项目"的概念，分两部分：

**1. 锚点（数据层）**

- 在 `session.yaml` 增加 `active_project`（单项目仓库为空 / `"default"`）。
- 在计划任务上增加 `project` 字段（见方案二）。

这两个锚点都是框架内部维护、自动写入的状态，**不需要用户手动设置**。

**2. 解析规则（写入激活协议，按优先级自动执行，无需用户传参）**

skill 启动时按以下顺序**自动**确定当前项目，全程不要求用户输入参数：

1. **计划信号**：若存在活跃计划，取 `current_task.project`（数组）。这是最常见路径——用户跑 `/mvt-implement` 时，框架已从计划得知当前任务涉及哪些项目。任务为多项目时，"当前项目"即该项目集合（见 4.1 第 4 层的并集加载）。
2. **会话锚点**：否则取 `session.active_project`（上一次确定的项目集合，框架自动续用）。
3. **文件路径反查**：否则根据本次涉及的文件路径，落到匹配的 `projects[].path` / `source_paths`，自动判定所属项目。
4. **结构兜底**：
   - 单项目仓库 → 直接用 `default`，**无任何提问**（与今日行为完全一致）。
   - 多项目仓库且上述均无法唯一确定 → **列出候选项目让用户选择**（带智能预选：把路径反查/会话锚点命中的项目作为推荐项排在首位），而不是要求用户回忆并传入项目名，**也绝不静默全量加载**。

**设计要点**：用户的交互永远是"从框架给出的选项里挑"，而非"记住并输入参数"。框架先尽力推断，推断不出再给选项，选项还带智能默认。这与 4.1 中 `mvt-manage-context` 的项目绑定 UI 一脉相承。

**向后兼容是硬约束**：单项目仓库（`name="default"`）行为与今日**完全一致**。当仓库只有一个项目时，所有项目作用域逻辑塌缩为无操作，且**不触发任何额外提问**。

---

### 4.1 方案一 —— 项目级上下文（两维正交模型）

**目标**：处理项目 X 的 skill，只加载与 X 相关、且与该 skill 相关的上下文。

**关键认识：project 维度不能只挂在 shared 上，它必须能与 per-skill 维度正交组合。**
知识有两条正交的作用域轴：

- **skill 轴** —— 所有 skill 都加载 vs 仅特定 skill 加载。
- **project 轴** —— 所有项目通用 vs 仅特定项目加载。

两轴交叉构成一个 **2×2 的作用域矩阵**：

|  | **所有 skill 都加载** | **仅特定 skill 加载** |
|---|---|---|
| **所有项目通用** | ① 全局共享：`core`、团队通用规约 | ② 全局按 skill：所有项目通用的评审规则 |
| **按项目区分** | ③ 项目共享：该项目的 `project-context.md` | ④ **项目 × skill**：前端 coding-standard（只在 `mvt-implement`/`mvt-review` **写/审前端时**加载），后端 coding-standard（同理，写/审后端时加载） |

右下角象限④——**既按项目、又按 skill**——正是真实需求所在：`mvt-implement` 写前端项目时读前端的 coding-standard，写后端项目时读后端的 coding-standard；`mvt-implement` 写文档类项目时两者都不加载。v1/v2 早先的设计漏掉了这一格，本节补齐。

**结构统一（采纳"②④ 应统一在 knowledge 下"的反馈，并推及 ①③）**：不为项目维度新设单独的键（如 `knowledge_by_project`），而是把每一层的 `knowledge` 都改成**按项目名分组的映射**，并保留一个 `_all` 键表示"所有项目通用"。这样：

- skill 轴由"在哪一层"表达：顶层 `knowledge`（所有 skill）vs `skills.<name>.knowledge`（仅该 skill）。
- project 轴由"映射的键"表达：`_all`（所有项目）vs `<项目名>`（仅该项目）。

此写法仍是**按键直查、而非 per-entry `project:` 字段**，与上一轮"独立映射"决策一致；只是把原先的"两个并列键"收敛为"一个映射 + 一个保留键"，语义更内聚。保留键取 `_all`，沿用本仓库 `_framework`/`_generated`/`_archived` 等下划线前缀的保留命名约定。

下面按 5 层落地：

**第 1 层 —— 语义文件始终为单文件。**
`mvt-analyze-code` 的输出始终为单个 `project-context.md`：

```
knowledge/project/_generated/project-context.md          （始终扁平路径，不论项目数量）
```

多项目仓库中，文件内使用 `# Project: {name}` 顶级标题区分各项目的语义内容段。`mvt-analyze-code --all` 在单文件内按段替换/保留各项目内容。
**设计纠正**：按项目拆分文件（`_generated/{name}/project-context.md`）是设计错误。`project-context.md` 描述的是仓库级业务领域知识（术语、业务规则、核心模块概览），不按项目拆分。按项目区分的技术知识（编码规范等）通过 2×2 矩阵象限 3/4 的独立知识条目处理。

**第 2 层 —— 项目级知识文件目录约定。**
用户的项目级知识（coding-standard 等）也按项目分目录存放，与语义文件并列：

```
knowledge/principle/coding-standards.md                  （单项目 / 全局通用：保持不变）
knowledge/principle/{name}/coding-standards.md           （多项目：每项目一份规约）
```

**第 3 层 —— `registry.yaml` 用"按项目分组的 `knowledge` 映射 + `_all` 保留键"统一表达四象限。**
顶层 `knowledge` 与每个 `skills.<name>.knowledge` 都是同一种结构：键为项目名，值为知识条目数组；`_all` 键代表所有项目通用。

```yaml
knowledge:                         # 顶层 = 所有 skill 都加载
  _all:                            #   象限①：所有项目通用（取代旧 knowledge.shared）
    - id: "core"
      source: "knowledge/core/"
      files_from_manifest: true
  web:                             #   象限③：仅 web 项目（所有 skill）
    - id: "coding-standards"
      source: "knowledge/principle/web/"
      files: ["coding-standards.md"]
  api:
    - id: "coding-standards"
      source: "knowledge/principle/api/"
      files: ["coding-standards.md"]

skills:
  mvt-implement:
    # ...
    knowledge:                     # skill 层 = 仅本 skill 加载
      _all:                        #   象限②：所有项目通用（取代旧扁平 list）
        - id: "review-rules"
          type: static
          source: "knowledge/principle/"
          files: ["general-review.md"]
      web:                         #   象限④：仅 web × 本 skill
        - id: "coding-standards"
          type: static
          source: "knowledge/principle/web/"
          files: ["coding-standards.md"]
      api:
        - id: "coding-standards"
          type: static
          source: "knowledge/principle/api/"
          files: ["coding-standards.md"]
```

每个项目键下的条目沿用现有 per-skill 条目的完全相同形状（`type` / `source` / `files`）。**破坏性变更**（全新项目前提下采纳）：
- 旧 `knowledge.shared`（list）→ `knowledge._all`（同样的 list，挪到 `_all` 键下）。
- 旧 `skills.<name>.knowledge`（扁平 list）→ `skills.<name>.knowledge._all`（同样的 list，挪到 `_all` 键下）。
- 多项目语义文件 `project-context` 始终在 `knowledge._all` 中（扁平路径），不按项目拆分——它描述的是仓库级业务领域知识。
- 单项目仓库只用 `_all` 键，等价于今日行为（仅多一层 `_all` 嵌套）。

**第 4 层 —— 在激活时按"当前项目集合 + 当前 skill"双重过滤。**
给 `activation-load-context.md` 增加一步：解析出当前项目集合 **PS**（4.0 前提；单项目任务即单元素集合，跨项目任务即多元素集合）、当前 skill 为 S 后，加载的知识集合 = 以下之并（纯按键直查，无遍历筛选）：

1. `knowledge._all`（象限①，恒加载）
2. 对 PS 中每个项目 P：`knowledge[P]`（象限③）
3. `skills[S].knowledge._all`（象限②，恒加载）
4. 对 PS 中每个项目 P：`skills[S].knowledge[P]`（象限④，项目 × 当前 skill）

第 4 项就是"`mvt-implement` 写前端 → 加载前端 coding-standard，写后端 → 加载后端 coding-standard"的落点；跨项目任务（如 `["web","api"]`）则**并集加载**两者的规约。任一 `[P]` 键不存在时静默跳过（如某项目没单独定规约）。

> **`mvt-implement` 的衔接**：现状中 `business.md` 是按固定路径直接读 `coding-standards.md`（无项目维度）。改造后，coding-standard 由激活协议依"当前项目 × mvt-implement"自动注入，`business.md` 不再硬编码单一路径，而是消费已加载的规约知识。`mvt-review`、`mvt-test`、`mvt-refactor` 等同样消费规约的 skill 同理。

**第 5 层 —— `mvt-manage-context` 增加项目维度（贯穿两格）。**
新增/移动 `project`/`principle` 类型知识项时，skill 的绑定 UI 按 4.0 原则**以选项形式**逐级询问（不要求传参）：

1. 先问作用域：**全局** 还是 **某个项目**（多项目仓库才出现此问，单项目自动跳过）。
2. 再问广度：**所有 skill（共享）** 还是 **特定 skill**（复用现有 add 流程的 skill 评分选择 UI）。

两问的组合直接映射到四象限，并写入对应的 registry 键：

| 作用域 \ 广度 | 所有 skill | 特定 skill S |
|---|---|---|
| 全局（所有项目） | `knowledge._all` ① | `skills[S].knowledge._all` ② |
| 某项目 P | `knowledge[P]` ③ | `skills[S].knowledge[P]` ④ |

`list` / `remove` / `check-context` 也需相应识别 `knowledge` 已从"list / 单层"变为"按项目分组的映射（含 `_all`）"这一新结构。

---

### 4.2 方案二 —— 计划任务标注所属项目

**目标**：每个任务声明所属项目，使计划、进度、上下文加载都项目正确。

**Schema 变更** —— 在 `mvt-plan-dev`（Step 4 任务字段 + 示例 YAML）的任务对象上增加 `project`，**类型为数组**（每项必须匹配某个 `projects[].name`）：

```yaml
tasks:
  - id: "t1-api-contract"
    title: "定义订单 API 契约"
    project: ["web", "api"]        # 新增 —— 数组；跨项目任务直接列出真实项目
    status: in_progress
    depends_on: []
    skill_hint: mvt-implement
    # ...
  - id: "t2-web-orders-page"
    title: "构建订单页面"
    project: ["web"]               # 单项目任务也用数组（单元素）
    depends_on: ["t1-api-contract"]
    # ...
```

**规则**：
- `project` 为数组。**绝大多数任务是单元素**（一任务一项目，仍是推荐的默认粒度）；真正跨项目的任务（如前后端共享的 API 契约）**直接列出涉及的真实项目** `["web", "api"]`——无需发明 `shared`/`root` 之类伪项目（采纳"project 支持数组"的反馈，由此**取消**了原伪项目命名待定点）。
- **校验放进 `plan-update.cjs`，不交给 LLM**（与既有确定性决策一致——`plan.yaml` 由脚本而非模型变更）：数组非空，且每个元素都存在于 `project-context.yaml > projects[].name`；否则拒绝。`mvt-plan-dev` 的校验步骤（Step 5）在创建时加同样的检查。
- **生成时由框架自动推断 `project`**：`mvt-plan-dev` 分解任务时，依据分析/设计产物涉及的路径**自动**判定每个任务的项目数组；仅当某任务无法唯一归属时，才**以选项形式**请用户确认（多选）——不要求用户为每个任务手填项目名。
- **粒度提示**：数组允许多项目，但 4.1 的"一任务一项目"仍是健康默认。`mvt-plan-dev` 应优先把任务拆到单项目；只有当一个任务在内聚上确实横跨多项目（共享契约/协议）时才用多元素，避免数组被滥用成"懒得拆分"。

---

### 4.3 方案三 —— 结构化任务交接（推荐：扩展 schema，而非新增 skill）

**目标**：当任务 B 依赖任务 A 的产出时，B 能跨会话、持久且结构化地还原 A 产出了什么。

你最初的设想是新增一个专门 skill 来产出"开发产物文档"并更新 `plan.yaml`。评估现有机制后，**推荐更轻量的形态**，因为"记录"需求其实已大体满足：

- `implementation.md` 已按任务累积分节（Summary / Files Touched / …）。
- `task.artifacts.files` 已记录产出文件路径。

真正的缺口不是"做了什么"，而是**下游任务要消费的契约**（API 形状、导出类型）——这是文件列表和散文记录都没有结构化承载的。

**命名（采纳"`provides` 改更直观名"的反馈）**：字段名改为 **`deliverables`（交付物）**。它直白对应"任务产出的交付物"，不像 `provides` 需脑补"提供给谁"，也不与 `artifacts.files`（改了哪些文件）混淆。

**粒度（已定：自由结构化文本）**：交付物**内容**为自由结构化的 Markdown（在 `implementation.md` 中以分节呈现），而非强制字段 schema（如 `endpoints: [...]` / `exported_types: [...]`）。理由：交付物形态多样（API 契约、配置规格、文件格式约定、协议……），强 schema 套不住所有情形且编写更重；自由文本由下游 skill 在加载后理解消费，灵活且零编写负担。可在 `implementation.md` 模板里给一个**建议的分节骨架**（如"对外接口 / 数据形状 / 使用约束"）作为软引导，但不作硬性校验。

**推荐 —— 方案 A（轻量，复用现有 skill）：**
1. 在计划任务 schema 增加 `deliverables` 字段——结构化描述该任务对下游暴露的契约/交付物规格。**内容**写进 `implementation.md`（结构化分节，沿用单文件累积）；`plan.yaml` 的 `task.deliverables` 只存一个轻量指针 + 新鲜度标记（`current` / `stale`）。
2. `mvt-implement` 实现完任务后，**带用户交互**地维护交付物（见下"交互设计"），而非全自动静默生成。
3. 下游任务（`depends_on` 中列出该任务的）在执行时**自动加载上游任务的 `deliverables`**。
4. 所有 `plan.yaml` 变更仍走 `plan-update.cjs`——交互（确认 y/n）在 skill 层发生，脚本只负责确定性写入（记录指针、置 `stale`）。

**交互设计（采纳"产出/变更时与用户确认"的反馈）：**

- **(a) 产出时确认 —— 按"是否真有下游"智能触发。**
  `mvt-implement` 完成任务后，在 `plan.yaml` 做**反向依赖查找**：是否存在其他任务的 `depends_on` 指向本任务？
  - **有下游** → 这份交付物会被消费 → **提示用户确认是否生成/更新 `deliverables`**（智能默认 = 生成，并列出依赖它的下游任务名）。
  - **无下游** → 默认跳过、不打扰（避免每个任务都问），符合"需要时才交互"的原则。

- **(b) 变更时确认 —— 防止下游消费到过时交付物。**
  当一个**已有 `deliverables`** 的任务被重新实现 / 范围变更时，`mvt-implement` 检测到"已存在交付物 + 存在下游消费者" →
  **提示"该任务实现已变更，交付物可能过时，下游 [任务列表] 依赖它，是否更新交付物？(y/n)"**。
  - 同意更新 → 重新生成交付物内容。
  - 无论是否当场更新，都通过 `plan-update.cjs` 把下游任务消费的这份交付物标记为 `stale`，使 `mvt-resume` / `mvt-status` 能把"下游可能需要复核"显式呈现。

> 两处确认都遵循框架"多给选项、智能默认、需要时才打扰"原则：仅在**确有下游消费者**时才发起交互，无下游则不打扰。

**备选 —— 方案 B（重量，仅当确需人工策展时）：**
若确实需要人工策展的交接文档，**再**引入专门 skill——但它应当**消费** `implementation.md` / `deliverables` 并产出策展文档 + 调用 `plan-update.cjs`，而不是另起一套产物存储。

**建议：先上方案 A**，验证结构化 `deliverables` 是否已填补缺口，确有人工策展需求再升级到方案 B。

---

### 4.4 脚本影响面（`plan-update.js` / `session-update.js`）

本提案的数据 schema 变更会落到 `sources/scripts/` 下的两个确定性脚本（经 esbuild 打包为 `.ai-agents/scripts/*.cjs`）。先明确一个**关键利好**，它消解了大部分顾虑：

> **两个脚本都是「`parseYaml(整份文件) → 改对象 → stringifyYaml(整份文件)`」的全量读写模式。** 它们不认识的新字段会被**自动透传保留**。因此 `task.project`、`task.deliverables`、`session.active_project` 一旦由对应 skill 写入，即便脚本完全不改，状态流转的 round-trip 也**不会抹掉**这些字段。脚本只需在**主动校验或主动写入**这些字段处改动——"顺带保留"是免费的。（既有代价：`yaml` 库 parse→stringify 会丢注释，属现状行为，与本提案无关。）

**`plan-update.js`（3 处主动改动）：**

1. **`task.project` 数组校验（承接 4.2）。** `validatePlan(plan)` 目前**只持有 plan 对象**，不知道合法项目名单（须来自 `project-context.yaml`）。**已定：采用「调用方传参」方案**——给脚本新增 `--projects "web,api"`，由调用方 skill（`mvt-plan-dev` / `mvt-update-plan`）读 `project-context.yaml > projects[].name` 后传入合法名单。脚本保持现状「吃显式 `--plan` 路径、不感知项目根」的纯机械风格，零耦合；正确性由 skill 负责传对。**否决**了「脚本仿 `session-update.js` 的 `findProjectRoot()` 自读 `project-context.yaml`」方案（会给 `plan-update.js` 新引入项目根解析与读盘耦合，破坏其无项目根感知的现状分工）。
   - **校验规则**：当 `--projects` 提供且项目数 > 1 时，每个任务的 `project` 数组**非空且每项 ∈ 传入名单**；否则拒绝。
   - **单项目向后兼容**：未传 `--projects`、或名单仅 `default` 时，缺省 `project` 放行（缺省视为 `["default"]`），保持今日行为。此 gating 写进 `validatePlan`。
2. **`deliverables` 指针 + 新鲜度写入（承接 4.3）。** 当前 `applyUpdate` 只处理 `status / artifacts / notes`。新增参数（如 `--deliverables-pointer <ptr>`）确定性地写入 `task.deliverables` 的轻量指针并置 `current`；新鲜度枚举（`current` / `stale`）可选地加进 `validatePlan`。
3. **变更时反向置 `stale`（承接 4.3b）。** "把下游消费的交付物标记为 `stale`" 需反向依赖查找（找出 `depends_on` 含本任务的下游任务）——纯机械逻辑，适合放脚本。新增 `--mark-deliverable-stale <task_id>` 或由 skill 算出下游、脚本仅置位。

> 以上三处均与现有 `recomputeCurrentTask`（DAG / `current_task` 重算）和 `findCycle`（环检测）**正交**，不改动既有逻辑。

**`session-update.js`（1 处主动改动）：**

4. **`active_project` 锚点写入（承接 4.0）。** 当前脚本无任何写 `active_project` 的入口。新增 `--set-active-project <name|csv>`（project 现为集合 PS，支持逗号分隔多值）。skill 解析出当前项目集合后经此持久化，作为 4.0 第 2 优先级「会话锚点续用」的数据来源。

**不经这两个脚本的改动**（纯 skill / 激活层，列此以划清边界）：4.1 第 1 层 `project-context.md` 拆分（`mvt-analyze-code` / `mvt-sync-context` 直接读写 `.md`/`.yaml`）、第 3 层 `registry.yaml` 结构变更、第 4 层激活双重过滤——均不触及 `plan-update` / `session-update`。

---

## 5. 建议

1. **按依赖关系排序、风险最小者先行。**
   1. 前提（active_project 锚点 + 自动解析规则）
   2. 方案二（`task.project` + 脚本校验）—— 最轻，且产出方案一所需的当前项目信号
   3. 方案一（拆文件 + registry `knowledge` 改按项目分组映射 + 激活双重过滤 + manage-context 项目维度）—— 核心收益。其中"项目 × skill"格（如前后端各自的 coding-standard）是落地的关键，应与"项目共享"格一同实现
   4. status / check-context / sync-context / init 的项目感知（见第 6 节）
   5. 方案三 方案 A（`deliverables` + 复用 implement + 产出/变更两处用户确认）

2. **向后兼容视为硬不变量。** 单项目仓库（`name="default"`）零行为变更，也不触发任何新增提问。每条项目作用域分支在 `projects[].length == 1` 时都必须塌缩为今日行为。

3. **始终遵循"多给选项、少要参数、智能推断"原则。** 当前项目由框架自动推断，歧义时列选项（带智能预选）让用户挑，绝不要求用户记忆并传入 `--project` 之类参数，也绝不静默全量加载。

4. **`plan.yaml` 变更保持在 `plan-update.cjs` 内。** 新增的 `project` 校验、以及 `deliverables` 指针/新鲜度（`current`/`stale`）的写入都必须是确定性脚本逻辑，而非 LLM 判断——与既有确定性决策一致；用户交互（确认 y/n）只发生在 skill 层。

5. **优先扩展 schema 而非新增 skill。** 方案三复用 `mvt-implement`，不新增 skill 与新流程；更少活动部件，更低流转摩擦。

---

## 6. 其他值得纳入的优化点

以下优化由核心工作自然衍生，是让多项目真正可用所必需：

| # | Skill / 领域 | 优化 | 为何重要 |
|---|-------------|------|----------|
| 6.1 | `mvt-init` | 探测 monorepo 子项目并把 `projects[]` 填成多条 | 没有它，多项目能力就没有**入口**——索引始终是单条目 |
| 6.2 | `mvt-status` | 按项目分组展示进度（"前端 3/5、后端 2/4"） | 这正是初衷——跨项目的整体进度管控 |
| 6.3 | `mvt-check-context` | 按**项目**核算 token；`project-context` 不再全局通用后，修正"被每个 skill 加载"的算法；识别 `knowledge` 已变为"按项目分组映射（含 `_all`）"的新结构 | 拆分后，按项目预算才能让"哪个项目上下文超标"有意义；新增的"项目 × skill"格也要纳入核算与 `list`/`remove` |
| 6.4 | `mvt-sync-context` | `project-context.md` 始终使用扁平路径；按项目技术知识（象限 3/4）的路由仍适用 | 今日它并回单个 `project-context.md`；设计已纠正：始终只有一个文件，无需路由 |
| 6.5 | `mvt-resume` / DAG 推进 | 让跨项目的 `current_task` 切换显式可见 | 自动推进可能在前后端之间跳；resume/status 应让项目切换显式呈现，避免用户停留在错误上下文 |

---

## 7. 待审阅的开放问题

> **已定（registry 作用域形态）**：采用**按键直查的映射**方案（4.1 方案 A）——每一层 `knowledge` 都是"按项目名分组的映射 + `_all` 保留键"：顶层 `knowledge._all` / `knowledge.<项目>`，skill 层 `skills.<name>.knowledge._all` / `skills.<name>.knowledge.<项目>`。**不**采用"在每条知识条目上加 `project:` 字段靠激活时过滤"的方案。理由：结构清晰、加载逻辑直白（激活端按键直接取，无需遍历筛选），skill 轴由"在哪一层"表达、project 轴由"映射的键"表达，语义内聚。代价是 `mvt-manage-context` 的 `list`/`remove`/绑定 UI 与 `mvt-check-context` 的核算需识别这一新结构——此成本已在第 6 节与 4.1 第 5 层接受。

> **已定（task.project 形态）**：`project` 为**数组**，跨项目任务直接列真实项目 `["web","api"]`，**取消**了原"伪项目命名"待定点（4.2）。
>
> **已定（`deliverables` 粒度）**：**自由结构化文本**（Markdown 分节），不强制字段 schema；模板提供软引导骨架（4.3）。

1. **迁移** —— 已在扁平 `project-context.md` 上的存量多项目工作区，是下次 `mvt-analyze-code --all` 时自动拆分，还是要求显式重新 init？项目级知识文件（如 coding-standard）从扁平路径迁到 `{name}/` 子目录，是否需要一次性的 `mvt-manage-context` 迁移辅助？
   - 注：全新项目无此问题；此问仅针对**存量**工作区的迁移路径。

---

## 8. 范围说明

本提案覆盖 **skill 指令层与数据 schema 层**。脚本侧仅**扩展现有两个脚本的参数与校验**（`plan-update.js` 新增 `--projects` 校验、`deliverables` 指针/freshness、反向置 stale；`session-update.js` 新增 `--set-active-project`，详见 4.4），**不新增第三个脚本、不改动 esbuild 打包管线结构**。4.1 第 1 层的 `mvt-analyze-code` 文件路径变更，可能需要复核 `install-manifest.yaml`，确认按项目的 `_generated/{name}/` 路径被正确归类为 `generated`（MVTT 拥有、update 时覆写）。

---

## 附录：版本变更

**v1 → v2**
- **4.0 当前项目解析**：移除"显式 `--project` 参数"作为解析入口；改为**自动推断（计划信号 → 会话锚点 → 路径反查 → 结构兜底）**，歧义时**列选项让用户选**（带智能预选），符合"多给选项、少要参数、智能推断"框架原则。
- **4.2 方案二**：补充 `mvt-plan-dev` 生成任务时**自动推断 `project`**、仅在无法唯一归属时以选项确认。
- **第 5 节建议**：将原"显式参数"表述改为"自动推断 + 选项预选"。
- 文档语言：英文 → 中文。

**v2 → v2.1**
- **4.1 方案一重构为两维正交模型**：明确 project 维度必须与 per-skill 维度**正交组合**，给出 2×2 作用域矩阵。补齐此前遗漏的**第四象限"项目 × skill"**——例如 `mvt-implement` 写前端时加载前端 coding-standard、写后端时加载后端 coding-standard。
- 激活协议由"按当前项目过滤"升级为"按**当前项目 × 当前 skill 双重过滤**"（四象限之并）。
- `mvt-manage-context` 绑定 UI 升级为两级选项（作用域：全局/项目；广度：所有 skill/特定 skill），组合映射到四象限。

**v2.1 → v2.2（本次，含三条反馈）**
- **4.1 结构统一**：象限 ①②③④ 不再分散在 `knowledge.shared` / `knowledge.projects` / `knowledge` / `knowledge_by_project` 多个键，统一为**每层 `knowledge` = 按项目名分组的映射 + `_all` 保留键**（skill 轴看"在哪一层"，project 轴看"映射的键"）。这是全新项目前提下的破坏性变更（旧扁平 list 挪入 `_all`）。
- **4.3 字段改名**：`provides` → **`deliverables`（交付物）**，更直观。
- **4.3 新增用户交互**：(a) 产出时——仅当存在下游消费者才提示是否生成交付物；(b) 变更时——已有交付物且有下游时提示是否更新，并经 `plan-update.cjs` 置下游消费的交付物为 `stale`。交互在 skill 层、写入走脚本。
- 同步更新第 5、6、7 节及附录涉及上述命名/结构的部分。

**v2.2 → v2.3（本次，含两条反馈）**
- **4.2 `task.project` 改为数组**：跨项目任务直接列真实项目（`["web","api"]`），**取消**伪项目命名（原待定点 1 消解）。`plan-update.cjs` 校验改为"数组非空且每项 ∈ `projects[].name`"。
- **4.0 / 4.1 适配多项目任务**：当前项目由单值升级为**项目集合 PS**；4.1 第 4 层对 PS **并集加载**象限③④（跨项目任务加载所涉各项目的上下文与规约）。
- **4.3 `deliverables` 粒度定为自由结构化文本**（原待定点 2）：Markdown 分节、不强制字段 schema，模板给软引导骨架。
- 第 7 节移除已解决的两条待定点，仅余"存量迁移"一条。

**v2.3 → v2.4（本次，脚本影响面）**
- **新增 4.4 节「脚本影响面」**：通读 `sources/scripts/plan-update.js` 与 `session-update.js` 后明确——两脚本为全量 parse→stringify 读写，未知新字段自动透传保留，故仅在主动校验/写入处改动。列出 `plan-update.js` 3 处（`--projects` 数组校验、`deliverables` 指针+freshness、反向置 stale）+ `session-update.js` 1 处（`--set-active-project`）。
- **`--projects` 校验数据来源已定：采「调用方传参」（方案 A）**，否决脚本自读项目根（方案 B），保持 `plan-update.js` 无项目根感知的纯机械分工。单项目缺省 `project` 放行以保向后兼容。
- **修正涉及文件**：补 `sources/scripts/session-update.js`，并将路径从打包产物 `.cjs` 改为源文件 `sources/scripts/*.js`。
- **修正第 8 节范围说明**：从"除已有校验外不引入新逻辑"改为"扩展现有两脚本参数与校验、不新增脚本、不改打包管线"。

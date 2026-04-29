# MVTT 架构分析与改进建议（修订版）

> **文档目的**：基于 MVTT 的真实定位——"AI + 人工协作的引导式 Prompt 编排框架"——对当前实现进行多维度分析，识别改进空间，并为每个问题提供**纯 prompt + markdown + YAML** 的可落地方案（不依赖任何运行时如 Python、Node 等）。
>
> **定位澄清（前置约束）**：
> 1. **人工始终在驾驶位**：所有流转都由用户触发和确认，不追求自动编排、自动调度、自主 Agent。Skill 的职责是"做好当前一步 + 清晰引导用户做下一步"。
> 2. **纯 Prompt 框架**：不依赖 Python / Node 等外部运行时。所有逻辑通过 AI 读取 markdown / YAML 完成。"API""校验""事件"都以约定的文档和字段形式存在。
> 3. **热路径内嵌，冷路径抽离**（Runtime Cost Awareness）：每次 skill 调用都会"执行"的内容（Activation Protocol、输出 footer 等）**必须内嵌**在 skill 文件中，避免每次调用多读文件；只在特定条件下"查阅"的内容（registry、schema、workflow）才**按需抽离**。
>
> **分析版本**：基于 dev 分支当前快照（19 个 mvt-* skill、config.yaml v1.5）
> **修订日期**：2026-04-27

---

## 零、核心设计原则：Inline vs. Extract

在 Prompt 框架中设计"共享"内容时，必须区分两类内容，避免把"dev 时的重复"错误地用"runtime 多读文件"来解决：

| 内容类型 | 特征 | 处理策略 |
|---|---|---|
| **执行热路径**（Activation Protocol、输出 footer、偏好应用逻辑） | 每次 skill 调用都会走一遍 | ✅ **内嵌**在每个 skill 中；用"权威模板 + 生成器"保证一致性 |
| **参考材料**（registry、schema、workflow、knowledge） | 只在特定场景查阅 | ✅ **抽离**成独立文件，按需读取 |

**判断标准**：问一句 "这份内容是每次都要跑一遍，还是偶尔查一下？"
- **每次都要跑 → 内嵌**（dev 时靠 scaffold 模板 + `/mvt-create-skill` 或 `/mvt-sync-skills` 批量对齐）
- **偶尔才查 → 抽离**（避免污染主 skill，按需加载）

**为什么不能把热路径抽到共享文件**：
1. **Token 成本**：抽离后每次 skill 调用都要多读 1-3 个文件，每个 ~500-800 token
2. **延迟成本**：多次 Read 工具调用的 IO 往返
3. **可靠性成本**：AI 可能跳过引用、误解占位符、忘记 resolve
4. **可追溯性成本**：阅读一个 skill 时需要跳转多个文件才能理解完整行为

**DRY at dev-time, inlined at runtime**：代码的 `import` 是编译期零成本的硬保证；markdown 的"引用"是运行期软约定，每次都要付代价。

---

## 目录

- [一、重新定义的成功标准](#一重新定义的成功标准)
- [二、当前实现评估](#二当前实现评估)
- [三、问题清单与改进建议](#三问题清单与改进建议)
  - [P1 引导性输出缺失（最高优先级）](#p1-引导性输出缺失最高优先级)
  - [P2 registry.yaml 未作为运行时契约](#p2-registryyaml-未作为运行时契约)
  - [P3 上下文契约未文档化](#p3-上下文契约未文档化)
  - [P4 配置底座扩展性不足](#p4-配置底座扩展性不足)
  - [P5 路径硬编码遍布各 skill](#p5-路径硬编码遍布各-skill)
  - [P6 Activation Protocol 样板冗余](#p6-activation-protocol-样板冗余)
  - [P7 单一活跃变更的灵活性限制](#p7-单一活跃变更的灵活性限制)
  - [P8 Shortcut skills 造成静默 drift](#p8-shortcut-skills-造成静默-drift)
  - [P9 工作流不可定制](#p9-工作流不可定制)
  - [P10 代码变更无"软提醒"机制](#p10-代码变更无软提醒机制)
- [四、改进路线图](#四改进路线图)
- [五、明确不做的事（避免过度设计）](#五明确不做的事避免过度设计)
- [六、总结](#六总结)

---

## 一、重新定义的成功标准

MVTT 不是智能体自主协作平台，而是 **"引导式 Prompt 编排框架"**。真正重要的能力是：

| 能力维度 | 定义 |
|---|---|
| **规范的 Skill 形态** | 每个 skill 行为可预期、输入输出清晰、形态一致 |
| **清晰的上下文契约** | 结构化文件（YAML）职责分明，字段含义可查 |
| **可扩展的配置底座** | 用户偏好 + 框架行为 + skill 定制可扩展 |
| **强引导性输出** | 每步完成后告诉用户"你刚完成了什么 / 当前进度 / 下一步可选" |
| **低样板成本** | 新增 skill、新增模板、新增 pattern 的门槛足够低 |

**用户永远是编排者**——skill 不调用 skill、不自动触发、不并行执行。AI 的职责是"做好这一步 + 提示下一步"。

---

## 二、当前实现评估

| 能力维度 | 评级 | 评价 |
|---|---|---|
| Skill 形态规范度 | ✅ 4/5 | 19 个 skill 的 Activation Protocol 结构统一 |
| 上下文结构设计 | ✅ 4/5 | session / project-context / knowledge 三层分离合理 |
| 配置底座 | 🟡 3/5 | 字段少，扩展路径不清晰 |
| 引导性输出 | 🟡 2/5 | 各 skill 有输出模板，但缺少统一的"下一步建议"块 |
| 契约清晰度 | 🟡 2/5 | project-context.yaml 的字段含义主要靠隐式约定 |
| 模板扩展性 | ✅ 5/5 | `_templates/custom/` 覆盖机制干净 |
| 样板成本 | 🟡 3/5 | 新 skill 需要抄 ~100 行 boilerplate |

**总体判断**：MVTT 已经**较好地达成了既定目标**，不需要推倒重来。改进重点集中在 **"强化引导性"** 和 **"明晰契约"** 两条主线，辅以小范围的扩展性优化。

---

## 三、问题清单与改进建议

### P1 引导性输出缺失（最高优先级）

#### 📍 问题描述

MVTT 的核心价值主张是"引导用户下一步操作"，但当前各 skill 输出的末尾格式不统一，也没有标准化的"下一步建议"块。用户跑完 `/mvt-analyze` 后，可能不知道：

- 当前进度到哪了？
- 接下来该跑哪个 skill？
- 是否有可选的分支（跳过某一步 / 优化当前步）？

这直接削弱了"引导式编排框架"的核心体验。

#### 💡 改进方案：Next-Step Guidance Block 标准化（内嵌式）

> **设计原则**：footer 是执行热路径（每次 skill 调用都要生成），所以**内嵌**在每个 skill 的输出模板里，而不是抽成 `_shared-footer.md` 让每次都多读一次文件。一致性通过"权威 scaffold + 生成器"在 dev 时保证。

**步骤 1**：在 `.ai-agents/skills/_templates/_scaffold/footer-block.md` 中定义**权威模板**（仅作为 dev 时的参照和生成器输入，**不在 runtime 读取**）：

```markdown
<!-- Next-Step Guidance Block — Authoritative Template v1 -->
<!-- 本块需要内嵌到每个 *-output.md 末尾；修改此模板后运行 /mvt-sync-skills 同步 -->

---

## ✅ Completed

{一句话描述本次 skill 的实际产出，例如："已完成用户认证模块的需求分析，识别 3 个 feature、2 个 actor、5 条业务规则"}

## 📍 Current Progress

| Phase    | Status        |
|----------|---------------|
| analyze  | {✅ done / 🟡 in_progress / ⏳ pending} |
| design   | ... |
| implement| ... |
| review   | ... |
| test     | ... |

## 👉 Suggested Next Steps

**Recommended**: `/mvt-{next-skill}` — {一句话描述下一步会做什么}

**Alternatives**:
- `/mvt-{alt-1}` — {何时适用}
- `/mvt-{alt-2}` — {何时适用}

**Check status**: `/mvt-status`
```

**步骤 2**：将这段 footer **完整内嵌**到每个 `*-output.md` 模板末尾（analyze-output.md、design-output.md 等）。跑 skill 时 AI 只需读一个完整的 output template，不需要额外读 shared footer。

**步骤 3**：Next Step 的**动态数据**（next-skill 是谁、progress 状态）来自 `registry.yaml`（P2）和 `session.yaml`——这两个本来就需要读。每个 skill 的 Activation Protocol 增加明确指令：

```markdown
### Final Step: Emit Next-Step Guidance
- 本 skill 的 output template 末尾已内嵌 guidance block
- 填充数据：
  - "Completed": 基于本次实际产出
  - "Current Progress" table: 从 session.yaml 读取
  - "Suggested Next Steps": 从 registry.yaml 中本 skill 的 `next_suggestions` 读取
```

**步骤 4**：新增 `/mvt-sync-skills`（或扩展现有 `/mvt-create-skill`）作为"对齐工具"：
- 读 `_scaffold/footer-block.md`
- 扫描所有 `*-output.md`
- 对比 footer 部分是否与权威模板一致；不一致则提示用户更新

这样 dev 时的维护成本很低（改一次 scaffold，用 `/mvt-sync-skills` 批量对齐），runtime 成本为零（skill 只读一个 output template）。

**收益**：
- ✅ 用户体验从"做完一步后迷茫"变为"做完一步就知道下一步"
- ✅ 格式统一，降低学习成本
- ✅ Runtime 零额外开销，不多读文件
- ✅ 与 registry.yaml（P2）天然联动：next step 从 registry 读取

---

### P2 registry.yaml 未作为运行时契约

#### 📍 问题描述

`.ai-agents/registry.yaml` 当前是**装饰性文档**——没有任何 skill 在运行时读取它。因此：

- 无法从 registry 推导依赖关系、下一步建议
- `/mvt-status` 和 `/mvt-help` 的信息都是手写硬编码
- 第三方 skill 没有一个"注册口"能与原生 mvt-* skill 对等协作

注意：**我们不追求"registry 自动触发 skill"**，只需要让 registry 成为 AI 读取的"真理之源"，用来生成引导、检查依赖、可视化进度。

#### 💡 改进方案：registry.yaml v2 — 纯声明式契约

**新结构**：

```yaml
version: 2

# 每个 skill 的声明式契约
skills:
  mvt-analyze:
    role: analyst
    description: "Extract requirements and domain concepts"
    skill_file: .claude/skills/mvt-analyze/SKILL.md
    output_template: _templates/analyze-output.md
    phase: analyze                # 对应 session.progress 中的字段
    depends_on: []                # 前置 skill
    reads:
      - path: workspace/session.yaml
      - path: workspace/project-context.yaml
        fields: [project, requirements]
      - path: knowledge/core/*
    writes:
      - path: workspace/project-context.yaml
        fields: [requirements]
      - path: workspace/session.yaml
        fields: [active_change.id, progress.analyze, recent_actions]
      - path: workspace/artifacts/{change_id}/analysis.md
    next_suggestions:
      primary: mvt-design
      alternatives: [mvt-analyze]     # 可再次运行做 refinement
    category: workflow               # workflow | shortcut | utility

  mvt-design:
    role: architect
    phase: design
    depends_on: [mvt-analyze]
    # ...

  mvt-fix:
    role: developer
    phase: null                      # 不在 DAG 中
    category: shortcut
    side_effects:
      - type: code_change
      - type: context_drift_risk     # 会造成 context 漂移
    next_suggestions:
      primary: mvt-sync-context      # shortcut 完成后建议 sync

# 工作流定义（可选，详见 P9）
workflows:
  default:
    phases: [analyze, design, implement, review, test]
```

**用法**：

- **skill 启动时**：Step 1.5 读 registry 中自己的 `depends_on`，检查 session.progress 中对应 phase 是否为 `done`，否则警告用户。
- **skill 结束时**：Step N 读 registry 中自己的 `next_suggestions`，填充到 Next-Step Guidance Block（P1）。
- **`/mvt-status`**：读 registry + session 动态生成依赖图与进度表。
- **`/mvt-help`**：读 registry 动态列出 skill 分类与描述。

**关键原则**：
- ❌ **不做自动触发**：即使 `next_suggestions.primary = mvt-design`，也只是**建议**，用户必须手动调用。
- ❌ **不做自动依赖检查阻断**：prerequisite 未完成时**警告**而非阻断——用户可能有合理的跳步理由。

**收益**：
- ✅ registry 成为唯一真理源，skill 自描述
- ✅ 引导建议、状态显示、依赖检查都有数据基础
- ✅ 新增 skill 时只需在 registry 添加一条目，`/mvt-status` 和 `/mvt-help` 自动感知

---

### P3 上下文契约未文档化

#### 📍 问题描述

`session.yaml` 和 `project-context.yaml` 的字段含义、类型、必填状态、写入者等信息，主要分散在各 skill 的 SKILL.md 中靠隐式约定维系。

**具体问题**：
- 新贡献者想加一个 skill，不知道该读哪些字段、该写哪些字段。
- 用户手动编辑 session.yaml 修复问题时，没有 schema 文档可查。
- 某个 skill 把 `requirements.features` 写成 `requirement.feature`，下游静默读空，用户无感知。

**注意**：我们不做"运行时校验"（不能依赖 jsonschema 之类的库），只做**文档化契约 + skill prompt-level 的软校验**。

#### 💡 改进方案：Schema-as-Markdown 契约文档 + Pre-flight Prompt 校验

**步骤 1**：新增目录 `.ai-agents/schemas/` 存放契约文档（纯 markdown，供 AI 和人类共同阅读）：

```markdown
# schemas/project-context.schema.md

# project-context.yaml Contract

## Top-Level Sections

| Section      | Required? | Written by     |
|--------------|-----------|----------------|
| project      | always    | /mvt-init      |
| requirements | after /mvt-analyze | /mvt-analyze   |
| architecture | after /mvt-design  | /mvt-design    |

## project

| Field                     | Type    | Required | Example                  |
|---------------------------|---------|----------|--------------------------|
| name                      | string  | yes      | "MyApp"                  |
| type                      | enum    | yes      | web / mobile / cli / library / service |
| tech_stack.language       | string  | yes      | "TypeScript"             |
| tech_stack.framework      | string  | no       | "React"                  |
| tech_stack.build_tool     | string  | no       | "Vite"                   |
| tech_stack.test_framework | string  | no       | "Vitest"                 |

## requirements

| Field            | Type  | Required after | Example |
|------------------|-------|----------------|---------|
| features         | array | /mvt-analyze   | [{id, name, description}] |
| actors           | array | /mvt-analyze   | [{name, type, description}] |
| business_rules   | array | /mvt-analyze   | ["Users must verify email before login"] |
| clarifications   | array | optional       | [{question, answer}] |

## architecture

...
```

为 `session.yaml` 写一份同样的契约文档 `schemas/session.schema.md`。

**步骤 2**：每个 skill 的 Activation Protocol 增加 Step 1.5：

```markdown
### Step 1.5: Validate Context (Pre-flight)
- Read `schemas/project-context.schema.md` and `schemas/session.schema.md`
- Cross-check loaded YAML files against the contracts
- For this skill's required input fields (per registry.yaml `reads.fields`):
  - If any required field is missing or empty:
    - STOP execution
    - Report: "Missing required field `X` in `path/to/file.yaml`"
    - Suggest: "Run `/mvt-{prerequisite-skill}` first, or edit the file manually per `schemas/project-context.schema.md`"
```

**步骤 3**：`/mvt-cleanup` 增加 `--repair` 模式，读 schema 生成缺失字段的空骨架。

**收益**：
- ✅ 字段含义有单一事实源，新贡献者查一份文档即可
- ✅ 静默失败变显式失败，问题在进入 skill 第一步就被发现
- ✅ 校验完全由 AI 在 prompt 中完成，零运行时依赖

---

### P4 配置底座扩展性不足

#### 📍 问题描述

`.ai-agents/config.yaml` 当前只有 4 个字段（language、no_emojis、data_format、pattern.active）。想新增一个配置项（比如 `review.strict_mode` 或 `token_budget.context_load`）时：

- 没有清晰的命名空间约定
- 所有 skill 都要改自己的 Activation Protocol Step 2 才能读到新字段

这违反开闭原则，也让"统一配置底座"的定位显得单薄。

#### 💡 改进方案：分层命名空间 + 约定式读取

**步骤 1**：重新设计 config.yaml 结构（分三层）：

```yaml
version: 2

# 第 1 层：用户偏好（原有字段迁移到这里）
preferences:
  language: zh-CN
  output:
    no_emojis: false
    data_format: yaml

# 第 2 层：框架行为（新增）
framework:
  paths:                          # 见 P5
    workspace: .ai-agents/workspace
    knowledge: .ai-agents/knowledge
    schemas: .ai-agents/schemas
    templates: .ai-agents/skills/_templates
  active_workflow: default        # 见 P9
  context_drift_warning: true     # 见 P8

# 第 3 层：Pattern 选择（原有）
pattern:
  active: ddd

# 第 4 层：Skill 级命名空间（新增，各 skill 自治）
skills:
  mvt-analyze:
    require_clarification: true
  mvt-review:
    strict_mode: false
    focus: [security, performance]
  mvt-test:
    default_framework: vitest
```

**步骤 2**：在权威 scaffold（见 P6 `_scaffold/skill-template.md`）的 Step 2 中定义统一的读取约定，所有 skill **内嵌**这段内容：

```markdown
### Step 2: Load Config
1. Read `.ai-agents/config.yaml`
2. Always apply:
   - `preferences.language` — output language
   - `preferences.output.no_emojis` — strip emojis globally
   - `preferences.output.data_format` — table format
3. Apply `framework.*` (paths, active_workflow 等)
4. If this skill has entries under `skills.<current-skill-name>`, apply skill-specific overrides
```

**步骤 3**：在 `schemas/config.schema.md` 中记录每一层的字段含义，新增字段时同步更新。

**关键原则**：
- ✅ **新增全局框架行为**：只加到 `framework.*`，shared protocol 自动读取。
- ✅ **新增 skill 专属配置**：只加到 `skills.<name>.*`，该 skill 自己读，不影响其他 skill。
- ❌ **不做动态 plugin 注册**：保持纯声明。

**收益**：
- ✅ 新增配置不用改 19 个 skill
- ✅ 命名空间清晰，职责分明
- ✅ 保持纯 YAML，AI 可读，无运行时依赖

---

### P5 路径硬编码遍布各 skill

#### 📍 问题描述

每个 skill 的 SKILL.md 都硬编码路径：

```markdown
- Read `.ai-agents/workspace/session.yaml`
- Write to `.ai-agents/workspace/artifacts/{change_id}/analysis.md`
```

**问题**：
- 若想把 workspace 改到 `.mvtt/` 或项目根目录，需要改 19 个 skill 文件
- 用户想自定义路径完全做不到

#### 💡 改进方案：路径集中到 `framework.paths`

**步骤 1**：（已在 P4 中包含）将所有路径集中到 config.yaml 的 `framework.paths`：

```yaml
framework:
  paths:
    workspace: .ai-agents/workspace
    session: .ai-agents/workspace/session.yaml
    project_context: .ai-agents/workspace/project-context.yaml
    artifacts: .ai-agents/workspace/artifacts
    knowledge: .ai-agents/knowledge
    schemas: .ai-agents/schemas
    templates: .ai-agents/skills/_templates
```

**步骤 2**：把 skill 中所有硬编码路径改为引用：

**改造前**：
```markdown
- Read `.ai-agents/workspace/session.yaml`
- Write artifact to `.ai-agents/workspace/artifacts/{change_id}/analysis.md`
```

**改造后**：
```markdown
- Read `<framework.paths.session>` (resolved from config.yaml)
- Write artifact to `<framework.paths.artifacts>/{change_id}/analysis.md`
```

**步骤 3**：在权威 scaffold（`_scaffold/skill-template.md`，见 P6）的 Step 2 末尾明确规定（各 skill 内嵌此内容）：

```markdown
After loading config, resolve all `<framework.paths.X>` placeholders to actual paths before any file operation.
```

**收益**：
- ✅ 重构目录结构只改 config 一处
- ✅ 企业场景下可把路径指向自定义位置
- ✅ 全程文档级引用，AI 可正确解析，无运行时依赖

---

### P6 Activation Protocol 样板冗余

#### 📍 问题描述

19 个 skill 的 Activation Protocol Step 1-2（读 session、读 config、应用偏好）几乎一模一样，每个 skill 抄 ~30 行 boilerplate。

**后果**：
- 新增 skill 门槛高
- 修改公共逻辑要改 19 处
- `/mvt-create-skill` 虽然存在，但只是引导用户手写

#### 💡 改进方案：权威 Scaffold + 生成器（Inline at Runtime）

> **设计原则修正**：Activation Protocol Step 1-2 是**执行热路径**——每次 skill 调用都必须走一遍。如果抽成 `_shared/activation-protocol.md`，每次调用都要多读一个文件（~800 token + IO 往返），而且 AI 可能跳过引用、误解占位符。**正确方向是"dev 时 DRY，runtime inline"**：维护一份权威 scaffold，内容**完整内嵌**在每个 skill 文件里，用生成器保证一致性。

**步骤 1**：新增 `.claude/skills/_scaffold/skill-template.md` 作为**权威模板**（仅 dev 时参照，runtime 不读）：

```markdown
<!-- MVTT Skill Scaffold v1 —— 修改此模板后运行 /mvt-sync-skills 批量对齐 -->

---
name: mvt-{NAME}
description: {DESCRIPTION}
---

## Activation Protocol

### Step 1: Load Context
1. Read `.ai-agents/config.yaml`, resolve `framework.paths.*`
2. Read `<paths.session>` and `<paths.project_context>`
3. Expose: `session`, `project`, `change` (current active change)

### Step 1.5: Validate Context
1. Find this skill in `registry.yaml`; read `reads.fields` and `depends_on`
2. For each required input field: if missing/empty, STOP and report
3. For each `depends_on` phase: if not `done`, WARN (do not block); ask user to confirm
4. If current change's `context_drift == true`, print drift warning block

### Step 2: Load Config
1. Apply `preferences.language`, `preferences.output.no_emojis`, `preferences.output.data_format`
2. Apply `framework.*` (paths, active_workflow, etc.)
3. Apply `skills.mvt-{NAME}.*` if present in config.yaml

### Step 3: {BUSINESS_STEPS — 每个 skill 自己填充}
<!-- TODO: skill-specific logic here -->

### Final Step: Emit Output via Template
1. Read `<paths.templates>/{NAME}-output.md` (its footer is already inlined, see P1)
2. Fill in skill-specific data + Next-Step Guidance Block (data from registry + session)
```

**步骤 2**：用 `/mvt-create-skill` 基于 scaffold 生成新 skill 文件——新 skill 生成后，Step 1、1.5、2、Final Step 的完整内容**直接存在于 skill 文件里**，runtime 不需要读任何共享协议文件。

**步骤 3**：新增 `/mvt-sync-skills` 作为"对齐工具"：
- 读 `_scaffold/skill-template.md`
- 扫描所有 `.claude/skills/mvt-*/SKILL.md`
- 对比 Step 1 / 1.5 / 2 / Final Step 的 boilerplate 部分是否与 scaffold 一致
- 不一致则**显示 diff** 并让用户确认后批量更新（AI 驱动，非 Python）

**步骤 4**（可选）：在每个 skill 文件顶部加个溯源注释，方便后续对齐：

```markdown
<!-- Boilerplate synced from _scaffold/skill-template.md v1 @ 2026-04-27 -->
```

**关键权衡对比**：

| 方案 | Dev 维护成本 | Runtime 成本 | 可靠性 |
|---|---|---|---|
| 完全重复（现状） | 中（改 19 处） | 低 | 高 |
| 抽离 `_shared/activation-protocol.md` | 低 | **高**（每次多读 ~800 token + IO） | 中（AI 可能漏引用） |
| **权威 Scaffold + 生成器（推荐）** | 低（`/mvt-sync-skills` 批量对齐） | 低 | 高 |

**收益**：
- ✅ 新 skill 从"抄 100 行"变为"生成器一键生成 100 行 scaffold + 自己只填业务步骤"
- ✅ 公共逻辑更新时，一次改 scaffold + 一次 `/mvt-sync-skills` 即可
- ✅ Runtime 零额外开销，skill 自包含，阅读性最好
- ✅ 与 P1（footer 内嵌）思路一致

---

### P7 单一活跃变更的灵活性限制

#### 📍 问题描述

`session.yaml` 的 `active_change` 是 singleton，限制：
- 无法同时推进两个 feature 的分析
- 切换 feature 需要手动编辑 YAML
- 不利于 "周一分析需求 A，周二设计需求 B，周三继续 A 的设计" 这种真实节奏

#### 💡 改进方案：多 change map + 显式切换

**新 session.yaml 结构**：

```yaml
version: 2
session:
  initialized_at: "2026-04-27T10:00:00Z"
  last_command: "/mvt-design"
  current_change: "20260427-user-auth"     # 指针

changes:
  "20260427-user-auth":
    title: "User authentication"
    created_at: "2026-04-27T09:00:00Z"
    progress:
      analyze: done
      design: in_progress
      implement: pending
      review: pending
      test: pending
    recent_actions: []
    context_drift: false                    # 见 P8

  "20260427-payment-api":
    title: "Payment API"
    created_at: "2026-04-27T11:00:00Z"
    progress:
      analyze: in_progress
    recent_actions: []
    context_drift: false
```

**Skill 约定**：
- 默认操作 `current_change`
- 支持显式切换：`/mvt-switch 20260427-payment-api`
- `/mvt-status` 列出所有 changes 和进度

**artifact 目录**：保持 `<paths.artifacts>/{change_id}/`（已按 change 隔离，无需改）

**共享 project-context.architecture 的处理**：
- 每次写入追加 `last_modified_by: {change_id, skill, timestamp}`
- 被其他 change 修改过时，当前 skill 读到后在输出中提示："架构自上次 design 以来被 change X 修改过，请确认"

**收益**：
- ✅ 支持并行推进多个变更
- ✅ 贴近真实开发节奏
- ✅ 仍然是用户手动切换，不引入自动调度

---

### P8 Shortcut skills 造成静默 drift

#### 📍 问题描述

`/mvt-fix` 和 `/mvt-refactor` 直接改代码但不更新 `progress`，导致 `project-context.architecture` 可能与实际代码脱节。虽有 `/mvt-sync-context` 补救，但需用户主动触发。

**核心原则约束**：不能自动触发 sync（违反"人工在驾驶位"）。

#### 💡 改进方案：drift flag + 引导提示

**步骤 1**：shortcut skill 完成后，在 session.yaml 当前 change 下设置标志：

```yaml
changes:
  "20260427-user-auth":
    context_drift: true
    drift_caused_by:
      - skill: mvt-fix
        at: "2026-04-27T15:00:00Z"
        summary: "Fixed null pointer in auth service"
```

**步骤 2**：所有 skill 的 Step 1.5（Validate Context）增加检查：

```markdown
If current change's `context_drift == true`:
  - Print warning block at the top of output:
    > ⚠️ Context Drift Detected
    > Recent shortcuts ({drift_caused_by.skill}) may have desynced context from code.
    > Recommended: Run `/mvt-sync-context` before continuing.
  - Continue execution (user decides)
```

**步骤 3**：`/mvt-sync-context` 完成后清除标志：

```yaml
context_drift: false
drift_caused_by: []
```

**步骤 4**：shortcut skill 在 Next-Step Guidance 中将 `/mvt-sync-context` 作为 Recommended：

```markdown
## 👉 Suggested Next Steps

**Recommended**: `/mvt-sync-context` — context may be out of sync after this fix

**Alternatives**:
- Continue working, sync later (not recommended for long sessions)
```

**收益**：
- ✅ Drift 可见、可追踪
- ✅ 用户始终决定是否 sync，符合"人工在驾驶位"
- ✅ 纯 YAML 字段 + prompt 逻辑，零运行时依赖

---

### P9 工作流不可定制

#### 📍 问题描述

当前工作流 `analyze → design → implement → review → test` 硬编码在：
- `session.progress` 的固定 5 个字段
- 每个 skill 的 depends_on 硬编码逻辑

**场景**：
- 纯前端原型项目想跳过正式 design 阶段
- 学习项目只想做 analyze + implement
- 企业项目可能想插入"security-review"阶段

#### 💡 改进方案：声明式工作流 YAML

**步骤 1**：新增目录 `.ai-agents/workflows/`，内含多个工作流定义：

```yaml
# workflows/default.yaml
name: default
description: "Standard full SDLC workflow"
phases:
  - id: analyze
    skill: mvt-analyze
    required: true
  - id: design
    skill: mvt-design
    required: true
    depends_on: [analyze]
  - id: implement
    skill: mvt-implement
    required: true
    depends_on: [design]
  - id: review
    skill: mvt-review
    required: false
    depends_on: [implement]
  - id: test
    skill: mvt-test
    required: true
    depends_on: [implement]
```

```yaml
# workflows/frontend-quick.yaml
name: frontend-quick
description: "Lightweight workflow for UI prototypes"
phases:
  - id: analyze
    skill: mvt-analyze
  - id: implement
    skill: mvt-implement
    depends_on: [analyze]
  - id: test
    skill: mvt-test
    depends_on: [implement]
    required: false
```

**步骤 2**：在 config.yaml 选择活跃工作流：

```yaml
framework:
  active_workflow: default   # 或 frontend-quick / custom-xxx
```

**步骤 3**：Skill 的 Step 1.5 和 Next-Step Guidance 都改为从 workflow 读依赖：

```markdown
1. Read `<paths.workflows>/<active_workflow>.yaml`
2. Find current skill's phase, read `depends_on`
3. Check those phases in session.progress
4. Next-step suggestion = next phase in workflow after current
```

**步骤 4**：`session.progress` 从固定字段改为动态字段，跟随 workflow 的 phases：

```yaml
changes:
  "20260427-x":
    progress:
      analyze: done
      implement: in_progress
      test: pending
      # 没有 design 和 review，因为 frontend-quick 不包含
```

**收益**：
- ✅ 支持多种项目形态
- ✅ 用户可复制 default.yaml 定制自己的工作流
- ✅ 纯 YAML，AI 可读，零运行时依赖

---

### P10 代码变更无"软提醒"机制

#### 📍 问题描述

用户直接修改代码（非通过 skill）、git checkout 切换分支、合并代码等操作都可能让 project-context 与代码脱节。当前只能靠用户记得跑 `/mvt-sync-context`。

**核心约束**：不能用 Python 脚本做检测（澄清 2），也不能自动触发 sync（澄清 1）。

#### 💡 改进方案：Claude Code 原生 hook 仅做"文本提示"

**步骤 1**：在 `.claude/settings.json` 加入极轻量的提示 hook（不依赖 Python，只用系统自带命令）：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'ℹ️ Code changed — project-context.yaml may need /mvt-sync-context'"
          }
        ]
      }
    ]
  }
}
```

这条 echo 纯文本，用户看到后**自己决定**是否运行 sync。

**步骤 2**：所有 skill 的 Step 1.5 增加一条软提醒（和 P8 的 drift 检查合并）：

```markdown
If session.last_command is older than current date OR
  session.current_change.recent_actions contains edit/write without sync since last skill call:
  - Print info block: "ℹ️ 距离上次 sync 已有一段时间，建议运行 /mvt-sync-context 保持 context 与代码同步"
  - Continue execution
```

**步骤 3**：在 `/mvt-sync-context` 的输出中清晰说明做了什么：

```markdown
## ✅ Sync Completed

**Scanned**: src/ (47 files)
**Detected changes**:
- New module: `payments/` (not in project-context.yaml)
- Renamed: `utils/auth.ts` → `auth/utils.ts`

**Updated project-context.yaml**:
- `architecture.modules`: added `payments`
- `architecture.modules[auth].files`: updated paths

{Next-Step Guidance Block}
```

**收益**：
- ✅ 用户得到提醒，但决策权在手里
- ✅ 不依赖 Python / 自动化
- ✅ 与 drift flag 机制（P8）形成闭环

---

## 四、改进路线图

按 **用户价值** 和 **实现依赖** 排序，建议分三期：

### 🚀 Phase 1 — 引导与契约（最高价值，2-3 周）

| # | 问题 | 核心产出 |
|---|---|---|
| P1 | 引导性输出缺失 | footer block 内嵌到各 `*-output.md`；权威模板 `_scaffold/footer-block.md` + `/mvt-sync-skills` 批量对齐 |
| P2 | registry 未激活 | `registry.yaml` v2 + `/mvt-status` 和 `/mvt-help` 动态读取 |
| P3 | 契约未文档化 | `.ai-agents/schemas/*.schema.md` + skill Step 1.5 软校验 |

**阶段目标**：用户"每一步完成后都知道下一步可以做什么"；贡献者"想加新 skill 时有清晰契约可查"。

### 🔧 Phase 2 — 底座打磨（2-3 周）

| # | 问题 | 核心产出 |
|---|---|---|
| P4 | 配置底座扩展性不足 | config.yaml v2 分层结构（preferences / framework / skills） |
| P5 | 路径硬编码 | `framework.paths.*` + skill 全量改为引用 |
| P6 | 样板冗余 | `_scaffold/skill-template.md` 权威模板 + `/mvt-sync-skills` 批量对齐（内嵌非抽离） |

**阶段目标**：底座真正成为"底座"，新增配置、重构目录、新增 skill 的成本显著降低。

### 🎯 Phase 3 — 灵活性增强（按需推进）

| # | 问题 | 核心产出 |
|---|---|---|
| P7 | 单一活跃变更 | session.yaml v2（多 change map）+ `/mvt-switch` |
| P8 | Shortcut drift | `context_drift` 标志 + skill 警告 + next-step 引导 |
| P9 | 工作流不可定制 | `.ai-agents/workflows/*.yaml` + config `active_workflow` |
| P10 | 代码变更软提醒 | Claude Code hook echo + skill 软提醒逻辑 |

**阶段目标**：支持更多真实协作场景（并行变更、自定义流程、代码漂移保护）。

---

## 五、明确不做的事（避免过度设计）

基于"人工在驾驶位 + 纯 Prompt 框架"的约束，以下方向**明确不做**，避免未来被过度设计拖累：

| 不做 | 原因 |
|---|---|
| ❌ Skill 自主调用其他 skill（sub-invoke） | 违反"用户始终编排" |
| ❌ 事件总线 / 订阅-发布系统 | 违反"人工触发"且需要持久化运行时 |
| ❌ Orchestrator 元 skill 自动规划 skill 序列 | 违反"用户始终编排" |
| ❌ Python / Node 脚本做运行时检测、校验、转换 | 违反"纯 Prompt 框架" |
| ❌ JSON Schema + jsonschema 库的运行时校验 | 同上，用 markdown 契约 + prompt 软校验替代 |
| ❌ 后台进程监听代码变更自动 sync | 违反"人工触发"和"无运行时" |
| ❌ 强制阻断式依赖检查 | 与引导式定位冲突；应警告 + 让用户决定 |
| ❌ 将执行热路径内容抽到共享文件（如 `_shared/activation-protocol.md`、`_shared-footer.md`） | 抽离后每次 skill 调用都要多读文件（token + IO + 可靠性成本）；改用"权威 scaffold + 生成器在 dev 时对齐、runtime 内嵌" |

---

## 六、总结

### 6.1 核心判断

MVTT 已经**较好地达成了"引导式 Prompt 编排框架"的目标**。当前不是"推倒重来"的时机，而是"**精细打磨**"的时机，重点在两条主线：

1. **强化引导性**：让每个 skill 输出末尾有清晰的"下一步建议"（P1、P2）
2. **明晰契约**：让 registry、schema、paths 三者成为 AI 和人类共同遵守的文档（P2、P3、P5）

### 6.2 Phase 1 即可交付高价值

即便只完成 Phase 1 的 P1 + P2 + P3，用户体验就会有质的变化：
- 做完任何一步都知道"下一步建议做什么"
- 出现字段错误时能在第一步就看到明确提示
- 新贡献者读一份 registry + 一份 schema 就能理解整个框架

### 6.3 一句话愿景

> **MVTT 的成功不是"让 AI 自动完成所有事"，而是"让 AI 在每一步做到可预期的产出，并把决策权清晰地交还给用户"。当前的骨架已经接近这个目标，改进的重点是让骨架更清晰、更贴手。**

---

## 七、速查表：问题 × 改进方案

| # | 问题 | 现状痛点 | 改进方案核心 | 关键产出 | Phase | 优先级 |
|---|---|---|---|---|---|---|
| P1 | 引导性输出缺失 | 各 skill 输出末尾格式不统一，用户不知下一步 | Next-Step Guidance Block **内嵌**到各 output 模板；权威模板 `_scaffold/footer-block.md` + `/mvt-sync-skills` 对齐 | `*-output.md` 末尾含 Completed / Progress / Suggested Next Steps 三段 | Phase 1 | 🔴 最高 |
| P2 | registry.yaml 未作为运行时契约 | 155 行 registry 无 skill 读取；`/mvt-status` 和 `/mvt-help` 硬编码 | registry v2 声明式契约（reads / writes / depends_on / next_suggestions）；skill 启动读依赖、结束读 next-step；`/mvt-status` `/mvt-help` 动态生成 | `registry.yaml` v2 | Phase 1 | 🔴 最高 |
| P3 | 上下文契约未文档化 | 字段含义靠隐式约定；写错字段下游静默失败 | Schema-as-Markdown 契约文档（`schemas/*.schema.md`）+ skill Step 1.5 prompt-level 软校验 | `schemas/session.schema.md`、`schemas/project-context.schema.md` | Phase 1 | 🔴 最高 |
| P4 | 配置底座扩展性不足 | config.yaml 仅 4 字段；新增配置要改 19 个 skill | 分层命名空间（preferences / framework / pattern / skills）+ 约定式读取 | `config.yaml` v2 分层结构 | Phase 2 | 🟡 高 |
| P5 | 路径硬编码遍布各 skill | 路径写死在 19 个 SKILL.md；目录重构成本高 | 集中到 `framework.paths.*`；skill 引用 `<framework.paths.X>` 占位符 | config.yaml `framework.paths` + skill 全量改造 | Phase 2 | 🟡 高 |
| P6 | Activation Protocol 样板冗余 | Step 1-2 在 19 个 skill 中重复 ~30 行 | **权威 Scaffold + 生成器**（非抽离！）；内容内嵌到 skill，用 `/mvt-sync-skills` 批量对齐 | `_scaffold/skill-template.md` + `/mvt-sync-skills` | Phase 2 | 🟡 高 |
| P7 | 单一活跃变更的灵活性限制 | `active_change` 是 singleton；无法并行推进多变更 | session.yaml v2 多 change map + `/mvt-switch` 显式切换 | `session.yaml` v2 + `/mvt-switch` skill | Phase 3 | 🟢 中 |
| P8 | Shortcut skills 造成静默 drift | `/mvt-fix` `/mvt-refactor` 改码不更 context，易脱节 | `context_drift` 标志 + 各 skill 检查并警告 + shortcut 输出将 `/mvt-sync-context` 设为 Recommended | session.yaml 新增 `context_drift` / `drift_caused_by` 字段 | Phase 3 | 🟢 中 |
| P9 | 工作流不可定制 | 5 阶段硬编码；无法适配前端原型、企业级等场景 | 声明式工作流 YAML（`.ai-agents/workflows/*.yaml`）+ config `active_workflow` | workflows/ 目录 + skill 从 workflow 读依赖 | Phase 3 | 🟢 中 |
| P10 | 代码变更无"软提醒"机制 | 直接改码 / git 切分支后 context 与代码脱节 | Claude Code 原生 hook 仅做 echo 文本提示 + skill Step 1.5 软提醒 | `.claude/settings.json` hook 配置 + skill 软提醒逻辑 | Phase 3 | 🟢 中 |

### 速查：明确不做的事

| 不做 | 原因简述 |
|---|---|
| Skill 自主调用 skill（sub-invoke） | 违反"用户始终编排" |
| 事件总线 / 订阅-发布 | 违反"人工触发"+ 需要运行时 |
| Orchestrator 自动规划 | 违反"用户始终编排" |
| Python / Node 运行时脚本 | 违反"纯 Prompt 框架" |
| 强制阻断式依赖检查 | 与引导式定位冲突 |
| 热路径抽共享文件（`_shared/*`） | Runtime 成本高；改用 scaffold + 生成器 |

---

*文档版本：v2.1（修订版）· 修订日期：2026-04-27*
*核心约束：人工在驾驶位 + 纯 Prompt 框架（无 Python / Node 运行时依赖）+ 热路径内嵌冷路径抽离*

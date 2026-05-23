# MVTT Framework 优化提案

> 版本：v1.1 | 日期：2026-05-23 | 状态：待审核
>
> v1.1 变更：移除 registry.yaml 的 `mode` 字段；重设计提案 4 为双层知识加载模型（shared + per-skill）
>
> v1.2 变更：pattern 知识提升为 shared 层；记录 activation-load-context 交互机制的分析结论（暂不采纳，待定）

---

## 背景与动机

MVTT 当前架构基于固定的 `analyze → design → implement → review → test` 流水线设计。随着框架演进，已出现大量脱离此流水线的 skill（如 `mvt-fix`、`mvt-refactor`、`mvt-cleanup` 等），原有机制在以下四个维度暴露出结构性问题：

1. **知识写而不读**：用户添加的知识库内容无法在后续 skill 中被自动加载
2. **状态模型过时**：`session.yaml` 的 `progress` 字段无法描述灵活的工作流
3. **推荐逻辑硬编码**：skill 结尾的 next suggestions 无法感知自定义 skill
4. **session 更新不一致**：各 skill 的 session 更新逻辑分散且格式不统一

---

## 提案概览

| # | 优化项 | 影响范围 | 风险 | 优先级 |
|---|--------|----------|------|--------|
| 1 | 标准化 session 更新 | 所有 skill 的 business.md | 低 | **P0** |
| 2 | 重设计 session 结构 | session.yaml、mvt-status、registry.yaml | 中 | **P1** |
| 3 | 动态 skill 注册与推荐 | registry.yaml、footer-next-steps.md、mvt-create-skill | 中 | **P2** |
| 4 | 知识库与 skill 加载关联（双层模型） | registry.yaml、activation-load-context.md、config.yaml | 中 | **P3** |

**依赖关系**：`1 → 2 → 3`，`4` 相对独立但建议在 2 之后执行。

---

## 提案 1：标准化 session 更新

### 问题分析

当前各 skill 的 "Update Workspace" 步骤分散在各自的 `business.md` 中，格式和字段覆盖不一致：

| Skill | `last_command` | `recent_actions` | `progress` | 其他更新 |
|-------|:-:|:-:|:-:|---|
| `mvt-init` | ✓ | ✓ | — | `initialized_at` |
| `mvt-analyze` | ✓ | ✓ | `analyze: done` | `active_change` 全字段 |
| `mvt-design` | ✓ | ✓ | `design: done` | artifact + architecture |
| `mvt-implement` | ✓ | ✓ | `implement: done` | artifact |
| `mvt-review` | ✓ | ✓ | `review: done` | artifact |
| `mvt-test` | ✓ | ✓ | `test: done` | artifact |
| `mvt-fix` | ✓ | ✓ | 明确不更新 | — |
| `mvt-refactor` | ✓ | ✓ | 明确不更新 | — |
| `mvt-cleanup` | ✓ | ✓ | — | — |
| `mvt-sync-context` | ✓ | ✓ | — | — |
| `mvt-add-context` | ✗ | ✗ | — | — |
| `mvt-check-context` | ✗ | ✗ | — | — |
| `mvt-config` | ✗ | ✗ | — | — |

问题：部分 skill 完全没有 session 更新指令；`progress` 字段仅部分 skill 更新，逻辑不统一；LLM 遵循手写指令的可靠性有限。

### 方案

**抽取共享 section `sections/session-update.md`**，与 `activation-load-context.md` 同级，所有 skill 统一引用。

#### 文件结构

```
sources/sections/session-update.md   ← 新增共享段
```

#### `session-update.md` 内容设计

```markdown
## State Update (Required)
After execution, update `.ai-agents/workspace/session.yaml`:

### Mandatory Fields (every skill must set)
- `session.last_command`: Set to current skill command (e.g., "/mvt-analyze")
- `recent_actions`: Append one-line summary with format:
  `[{YYYY-MM-DD HH:MM}] /{command}: {one-line summary}`
  Keep max 5 entries. If exceeds, drop oldest.

### Conditional Fields (set only when applicable)
{{#update_active_change}}
- `active_change.id`: Set when a new change is created
- `active_change.title`: Set when a new change is created
- `active_change.created_at`: Set when a new change is created
{{/update_active_change}}

### Forbidden
- Do NOT update fields not listed above
- Do NOT overwrite `active_change` unless this skill creates a new change
```

#### 每个 skill manifest 的改造

在 manifest.yaml 中声明 session 更新参数：

```yaml
# mvt-analyze 的 manifest 示例
sections:
  # ... 其他 sections ...
  - type: shared
    source: sections/session-update.md
    params:
      update_active_change: true
```

```yaml
# mvt-fix 的 manifest 示例
sections:
  # ... 其他 sections ...
  - type: shared
    source: sections/session-update.md
    params:
      update_active_change: false
```

#### 需修改的文件清单

| 文件 | 变更 |
|------|------|
| `sections/session-update.md` | **新增** |
| `mvt-init/manifest.yaml` | 添加 session-update section 引用 |
| `mvt-analyze/manifest.yaml` | 同上 + 删除 business.md 中的 Update Workspace 步骤 |
| `mvt-design/manifest.yaml` | 同上 |
| `mvt-implement/manifest.yaml` | 同上 |
| `mvt-review/manifest.yaml` | 同上 |
| `mvt-test/manifest.yaml` | 同上 |
| `mvt-fix/manifest.yaml` | 同上 |
| `mvt-refactor/manifest.yaml` | 同上 |
| `mvt-cleanup/manifest.yaml` | 同上 |
| `mvt-sync-context/manifest.yaml` | 同上 |
| `mvt-add-context/manifest.yaml` | 同上（当前缺失，补全） |
| `mvt-check-context/manifest.yaml` | 同上（当前缺失，补全） |
| `mvt-config/manifest.yaml` | 同上（当前缺失，补全） |
| 各 skill 的 `business.md` | 移除各自的 "Update Workspace" 步骤 |

---

## 提案 2：重设计 session 结构

### 问题分析

`session.yaml` 的 `progress` 字段是固定五阶段流水线的产物：

```yaml
progress:
  analyze: pending
  design: pending
  implement: pending
  review: pending
  test: pending
```

此设计无法适应当前灵活的工作流：
- `mvt-fix`、`mvt-refactor` 等独立 skill 与此流水线无关
- `mvt-status` 基于此字段生成阶段可视化，已不准确
- `registry.yaml` 中各 skill 仍声明 `phase: analyze/design/...` 和 `mode: full-workflow/shortcut/independent`，均是旧流水线模型的残留

### 方案

#### 新 `session.yaml` 结构

```yaml
# Workspace Session State (v2)
# 支持灵活工作流，不再绑定固定流水线

session:
  initialized_at: ""
  last_command: ""

# Current active change
active_change:
  id: ""
  title: ""
  created_at: ""

# Skill execution history (append-only, max 10)
# 记录实际执行过的 skill，替代旧的 progress 字段
skill_history:
  - command: "/mvt-analyze"
    completed_at: "2026-05-23T14:30:00"
    summary: "Analyzed user authentication requirements"

# Recent actions (append-only, max 5)
recent_actions: []
```

#### 关键变更点

1. **移除 `progress` 字段**，用 `skill_history` 替代
2. **`skill_history`** 记录每次 skill 执行的 command + 时间 + 摘要，上限 10 条
3. **`recent_actions`** 保持不变（上限从 3 调整为 5，与 skill_history 对齐）

#### `registry.yaml` 联动清理

移除各 skill 中的 `phase` 和 `mode` 字段（均已无语义意义）：

- **`phase`**：绑定固定流水线，移除理由同 `progress`
- **`mode`**：原分类为 `full-workflow / shortcut / independent`，本质仍是对旧流水线的分类——`full-workflow` 意味着"属于流水线且更新 progress"，`shortcut` 意味着"不属于流水线且不更新 progress"，`independent` 意味着"独立运行"。移除 progress 后，此分类失去基础。skill 的行为差异由 `knowledge`（提案 4）和 `category` 自然区分

```yaml
# Before
mvt-analyze:
  phase: analyze      # ← 删除
  mode: full-workflow # ← 删除
  category: workflow

# After
mvt-analyze:
  category: workflow
```

#### `mvt-status` 重写

当前的 `mvt-status` 依赖 `progress` 做阶段可视化，需要重写为基于 `skill_history` 的状态展示：

```markdown
## Execution Flow

### Step 1: Load State
- Read `session.yaml` for skill_history, active_change, recent_actions
- Read `project-context.yaml` for project info, tech stack, architecture

### Step 2: Build Activity Timeline
- Parse `skill_history` into chronological timeline
- Group by change-id if multiple skills for same change
- Identify current activity focus

### Step 3: Build Status Report
- Project info summary
- Active change details (if any)
- Skill history timeline (recent 5 entries)
- Context completeness indicator

### Step 4: Suggest Next Step
- Based on skill_history and active_change, suggest relevant next skill
- Use registry.yaml to find available skills matching current context
```

#### `session-update.md` 联动更新

提案 1 中的共享段需增加 `skill_history` 更新指令：

```markdown
### Mandatory Fields (every skill must set)
- `session.last_command`: Set to current skill command
- `skill_history`: Append entry: `{command: "/{name}", completed_at: "{timestamp}", summary: "{one-line}"}`
  Keep max 10 entries. If exceeds, drop oldest.
- `recent_actions`: Append one-line summary. Keep max 5.
```

#### 需修改的文件清单

| 文件 | 变更 |
|------|------|
| `defaults/session.yaml` | 重设计结构：移除 progress，增加 skill_history |
| `registry.yaml` | 移除所有 skill 的 `phase` 和 `mode` 字段 |
| `sections/session-update.md` | 增加 skill_history 更新指令 |
| `mvt-status/business.md` | 重写为基于 skill_history 的状态展示 |
| `mvt-status/manifest.yaml` | 更新模板引用（如需要） |

---

## 提案 3：动态 skill 注册与推荐

### 问题分析

当前 `registry.yaml` 中的 `next_suggestions` 是静态硬编码的：

```yaml
mvt-analyze:
  next_suggestions:
    primary: mvt-design
    primary_desc: "Create architecture based on this analysis"
```

问题：
- 用户通过 `/mvt-create-skill` 创建自定义 skill 后，硬编码的建议不会包含这些 skill
- `footer-next-steps.md` 模板是静态 Handlebars，无法动态生成
- 自定义 skill 虽然会注册到 registry（`custom: true`），但不会出现在任何已有 skill 的推荐列表中

### 方案

#### 3.1 强化 registry 作为运行时 skill 发现的唯一来源

当前 registry 已有 `custom: true` 标记（由 `mvt-create-skill` 写入），但其他 skill 不读取 registry 来发现可用 skill。

改进：在 `activation-load-context.md` 中增加 registry 加载：

```markdown
## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data
- `.ai-agents/registry.yaml` -- Available skills registry (for dynamic suggestions)
```

这样每个 skill 执行时都能感知当前所有可用 skill（包括自定义 skill）。

#### 3.2 改造 `footer-next-steps.md` 为动态推荐模板

```markdown
## Suggested Next Steps

Based on the completed skill and the current project state, recommend 2-3
relevant next skills from the registry. Consider:

1. The skill just completed: `{{current_skill}}`
2. The current `skill_history` in session.yaml
3. All available skills listed in registry.yaml (including custom skills)
4. The `category` and `knowledge` of each skill for relevance matching

Format each suggestion as:
- `/{skill_name}` -- {when to use this skill}
```

这将推荐逻辑从硬编码变为 LLM 基于上下文的动态推理。

#### 3.3 各 skill business.md 中移除硬编码的建议

当前多个 skill 的 business.md 或 manifest 输出格式中包含固定的建议步骤，例如 `mvt-add-context` 的输出格式中：

```markdown
**Suggested Next Steps**:
- `/mvt-check-context` -- Analyze context load if context is large
- `/mvt-analyze` -- Start requirements analysis
- `/mvt-status` -- View current project status
```

改为统一引用 `footer-next-steps.md`，由动态模板生成。

#### 3.4 `mvt-create-skill` 生成的 skill 模板同步更新

当前 `mvt-create-skill/business.md` 中生成的 skill 模板包含硬编码的 `## Suggested Next Steps` 段。应改为引用共享的 `footer-next-steps.md`。

#### 需修改的文件清单

| 文件 | 变更 |
|------|------|
| `sections/activation-load-context.md` | 增加 registry.yaml 加载 |
| `sections/footer-next-steps.md` | 改造为动态推荐模板 |
| 各 skill 的 manifest.yaml | 统一引用 footer-next-steps.md（替代内联建议） |
| 各 skill 的 business.md | 移除硬编码的 Suggested Next Steps |
| `mvt-create-skill/business.md` | 更新生成模板，使用共享 footer |

---

## 提案 4：知识库与 skill 加载关联（双层模型）

### 问题分析

当前知识库的加载机制存在断裂：

1. **写入端**：`/mvt-add-context` 会将知识写入 `knowledge/principle/` 或 `knowledge/project/`
2. **读取端**：`activation-load-context.md` 仅加载 `session.yaml` + `project-context.yaml`，**不加载任何知识文件**
3. **声明端**：知识 manifest 中有 `auto_load: true` 和 `scenarios` 字段，但**没有任何执行逻辑消费这些声明**

更深层的问题是：**不同 skill 需要的知识并不相同**。例如：
- `mvt-review` 需要 `review-principles.md` 和编码规范
- `mvt-implement` 可能需要编码规范，但不需要 review checklist
- `mvt-init` 几乎不需要任何知识文件

如果将所有知识都放入全局的 `active_knowledge`，会导致每个 skill 都加载不必要的知识，浪费 token 并降低指令遵从度。

但另一类知识——**项目级架构模式**——性质不同。pattern 是项目的基础架构决策，一旦选定，它影响所有在此架构下工作的 skill（分析、设计、实现、修复、重构都需要遵守同一架构约束）。因此 pattern 知识应属于 **shared 层**，而非 per-skill 层。

### 方案：双层知识加载模型

核心思路：将知识分为 **shared（共享）** 和 **per-skill（按 skill 指定）** 两层。

```
┌─────────────────────────────────────────────┐
│              Shared Knowledge               │
│  (config.yaml > knowledge.shared)           │
│  所有 skill 执行时都会加载                   │
│  例：core/review-principles.md              │
│  例：patterns/ddd/* (当 pattern.active=ddd) │
├─────────────────────────────────────────────┤
│           Per-Skill Knowledge               │
│  (registry.yaml > skills.{name}.knowledge)  │
│  仅当前执行的 skill 加载                      │
│  例：mvt-review 加载自定义编码规范            │
└─────────────────────────────────────────────┘
```

#### 4.1 config.yaml — shared 知识层

```yaml
# config.yaml 新增
knowledge:
  # 共享知识：所有 skill 执行时都会加载
  # 由 /mvt-add-context 维护（用户选择"共享"时写入此列表）
  # 由 /mvt-init 维护（设置 pattern.active 时自动追加 pattern 条目）
  shared:
    - id: "core"
      path: "knowledge/core/"
      files: ["review-principles.md"]
    - id: "pattern-active"                  # 当 pattern.active 有值时加载
      type: "dynamic"
      source: "knowledge/patterns/{pattern.active}/"
      files_from_manifest: true             # 从该目录的 manifest.yaml 读取文件列表
    # - id: "project-conventions"
    #   path: "knowledge/principle/project-conventions/"
    #   files: ["coding-standards.md"]
```

设计考量：
- **token 可控**：shared 列表中的知识会被每个 skill 加载，需用户显式确认
- **默认值**：`core` 是默认共享项，框架自带且体量小（~800 tokens）
- **pattern 为 shared**：架构模式是项目级决策，所有 skill 都需要在同一模式下工作
- **pattern 动态加载**：`pattern-active` 条目使用 `type: "dynamic"`，当 `config.yaml > pattern.active` 为空时自动跳过，不会浪费 token
- **可追溯**：用户可通过 `/mvt-config` 查看和调整

#### 4.2 registry.yaml — per-skill 知识层

在每个 skill 条目中新增 `knowledge` 字段，声明该 skill 需要的额外知识：

```yaml
skills:
  mvt-analyze:
    agent: analyst
    description: "Analyze requirements documents and extract domain concepts"
    path: .claude/skills/mvt-analyze/SKILL.md
    template: .ai-agents/skills/_templates/analyze-output.md
    category: workflow
    depends_on: []
    # knowledge 省略 = 仅加载 shared（含 core + pattern-active）

  mvt-design:
    agent: architect
    description: "Create architecture design based on analyzed requirements"
    path: .claude/skills/mvt-design/SKILL.md
    template: .ai-agents/skills/_templates/design-output.md
    category: workflow
    depends_on: [mvt-analyze]
    # knowledge 省略 = 仅加载 shared

  mvt-review:
    agent: reviewer
    description: "Perform code review for quality and standards compliance"
    path: .claude/skills/mvt-review/SKILL.md
    template: .ai-agents/skills/_templates/review-output.md
    category: workflow
    depends_on: [mvt-implement]
    knowledge:                          # per-skill 示例：自定义编码规范
      - id: "coding-standards"
        type: "static"
        source: "knowledge/principle/coding-standards/"
        files: ["rules.md", "naming-conventions.md"]

  mvt-implement:
    agent: developer
    description: "Implement features based on architecture design"
    path: .claude/skills/mvt-implement/SKILL.md
    template: .ai-agents/skills/_templates/implement-output.md
    category: workflow
    depends_on: [mvt-design]
    # knowledge 省略 = 仅加载 shared

  mvt-fix:
    agent: developer
    description: "Diagnose and fix bugs or issues in the codebase"
    path: .claude/skills/mvt-fix/SKILL.md
    template: .ai-agents/skills/_templates/fix-output.md
    category: shortcut
    depends_on: []
    # knowledge 省略 = 仅加载 shared

  # 独立 skill 无 knowledge 字段时，默认仅加载 shared
  mvt-init:
    agent: conductor
    description: "Initialize or refresh a project with comprehensive analysis"
    path: .claude/skills/mvt-init/SKILL.md
    template: .ai-agents/skills/_templates/init-output.md
    category: project
    # knowledge 字段省略 = 等同 knowledge: []
```

**知识引用类型**：

| type | 说明 | 示例 |
|------|------|------|
| `static` | 固定路径，直接加载 | `source: "knowledge/principle/my-standards/"`, `files: ["rules.md"]` |
| `dynamic` | 路径包含变量，运行时解析 | `source: "knowledge/patterns/{pattern.active}/"`, `files_from_manifest: true` |

- `static`：`files` 字段显式列出要加载的文件
- `dynamic`：`files_from_manifest: true` 表示从目标目录的 `manifest.yaml` 中读取文件列表（已有的 manifest 机制终于被消费）
- 当 `{pattern.active}` 为空时，跳过该条目不加载任何 pattern 知识

#### 4.3 改造 `activation-load-context.md`

```markdown
## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data
- `.ai-agents/registry.yaml` -- Available skills registry

### Step 1.5: Load Knowledge

#### A. Shared Knowledge (all skills)
Read `.ai-agents/config.yaml` > `knowledge.shared`.
For each entry:

- If `type` is absent or `"static"`: Load `.ai-agents/{{source or path}}{{file}}` for each file in `files`
- If `type: "dynamic"`:
  1. Resolve variables in `source` (e.g., `{pattern.active}` → read from `config.yaml`)
  2. If resolved path exists and `files_from_manifest: true`:
     Read `.ai-agents/{{resolved_source}}manifest.yaml` and load all listed `files`
  3. If resolved variable is empty or path does not exist → Skip this entry

Default shared entries (always present):
- `core` → `knowledge/core/review-principles.md`
- `pattern-active` → `knowledge/patterns/{pattern.active}/*` (skipped if no pattern selected)

#### B. Per-Skill Knowledge (current skill only)
Read `.ai-agents/registry.yaml` > `skills.{{current_skill}}.knowledge`.
For each entry, apply the same `static` / `dynamic` resolution logic as above.

If `knowledge` field is absent or empty → Skip this step (shared knowledge is sufficient).
```

加载顺序：shared → per-skill，确保 per-skill 知识可以引用或覆盖 shared 中的内容。

#### 4.4 改造 `/mvt-add-context` 的执行流程

当前 `mvt-add-context` 的 Step 3 写入知识时，不区分共享与 skill 专属。需要增加交互式分类：

```markdown
### Step 3: Write Context
Based on information collected:
1. Update `.ai-agents/workspace/project-context.yaml` (matching fields)
2. Update `.ai-agents/workspace/session.yaml` (standardized update via session-update.md)
3. If coding standards or project knowledge provided:
   a. Write knowledge files to `.ai-agents/knowledge/principle/` or `knowledge/project/`
   b. Create or update `manifest.yaml` in the knowledge directory
   c. **[NEW]** Ask user: "Should this knowledge be available to all skills, or specific ones?"
      - **All skills (shared)**: Append entry to `config.yaml` > `knowledge.shared`
      - **Specific skills**: Append entry to `registry.yaml` > `skills.{name}.knowledge`
        for each selected skill (with `type: "static"`)
      - **Show token impact estimate** before confirming
4. Update `config.yaml` `pattern.active` if user confirmed architecture pattern
```

示例交互：
```
You've added "Project Coding Standards" to knowledge/principle/coding-standards/

How should this knowledge be loaded?
  1. All skills (shared) — every skill will load this (~400 tokens each)
  2. Specific skills only — choose which skills need this knowledge
  3. Skip auto-loading — available but not auto-loaded

> 2

Which skills should load this knowledge?
  ☑ mvt-implement — applies coding standards during implementation
  ☑ mvt-review — checks code against standards during review
  ☐ mvt-design — usually doesn't need coding standards
  ☐ mvt-fix — typically works within existing code style
  ...
```

#### 4.5 改造 `/mvt-config` 支持知识管理

```markdown
### Knowledge Management

#### View Knowledge
- List shared knowledge entries (from config.yaml)
- List per-skill knowledge entries (from registry.yaml, grouped by skill)
- Show token estimates for each entry

#### Modify Knowledge
- Move knowledge between shared ↔ per-skill
- Remove knowledge from loading list (does not delete files)
- Add existing knowledge files to shared or per-skill list
```

#### 4.6 与 `pattern.active` 的联动

Pattern 知识属于 shared 层，但使用 `type: "dynamic"` 声明——当 `config.yaml > pattern.active` 为空时，该条目在加载时自动跳过。

**`/mvt-init` 的联动改造**：当用户选择或确认架构模式时，`/mvt-init` 需要执行以下操作：

```markdown
### Step 5: Update Workspace
1. Write `.ai-agents/workspace/project-context.yaml`: ...
2. Write `.ai-agents/workspace/session.yaml`: ...
3. Write `.ai-agents/config.yaml`:
   - Set `pattern.active` to selected pattern    # 现有逻辑
   - **[NEW]** Ensure `knowledge.shared` contains `pattern-active` entry:
     ```yaml
     - id: "pattern-active"
       type: "dynamic"
       source: "knowledge/patterns/{pattern.active}/"
       files_from_manifest: true
     ```
     If already present (from previous init), do not duplicate.
     If user selected `none` for pattern, do not add this entry.
4. If `pattern.active` was changed from a previous value:
   - Pattern knowledge will automatically load the new pattern's files
   - No need to remove old pattern files (they remain on disk for reference)
```

**设计优势**：
- `pattern-active` 条目在 shared 中只需声明一次，后续所有 skill 自动获得 pattern 知识
- `/mvt-init` 不需要为每个 skill 单独操作 knowledge 声明
- 用户切换 pattern 时，只需更新 `pattern.active` 值，`type: "dynamic"` 自动解析新路径
- 比在多个 skill 中重复声明 `pattern-active`（v1.1 方案）更简洁且不会遗漏

#### 4.7 `/mvt-create-skill` 的联动

用户创建自定义 skill 时，应支持声明知识需求：

```markdown
### Step 2: Skill Design
- ...
- Determine knowledge requirements:
  - Does this skill need custom knowledge files? → Add `static` entry with path and files
  - Does this skill need knowledge that varies by config? → Add `dynamic` entry
  - Or only shared knowledge (core + pattern)? → Leave `knowledge` empty or omit
```

生成的 registry 条目中包含 `knowledge` 字段。

#### 4.8 现有知识 manifest 的价值激活

当前 `knowledge/core/manifest.yaml` 和 `knowledge/patterns/*/manifest.yaml` 中的元数据（`auto_load`、`scenarios`、`files`、`token_estimate`）在双层模型下终于被消费：

- `files` 列表 → 被 `files_from_manifest: true` 引用
- `token_estimate` → 被 `/mvt-check-context` 和 `/mvt-config` 用于展示 token 开销
- `scenarios` → 可作为 `/mvt-add-context` 交互时的参考（"此知识适用于 review 场景"）

`auto_load` 字段则被双层模型替代——不再由 manifest 自己声明是否自动加载，而由 config.yaml（shared）和 registry.yaml（per-skill）控制。

#### 需修改的文件清单

| 文件 | 变更 |
|------|------|
| `defaults/config.yaml` | 新增 `knowledge.shared` 字段（含 `pattern-active` 动态条目） |
| `registry.yaml` | 每个 skill 新增 `knowledge` 字段；移除 `phase` 和 `mode` |
| `sections/activation-load-context.md` | 重写为双层加载：shared（含 pattern）+ per-skill |
| `mvt-add-context/business.md` | Step 3 增加知识分类注册（shared vs per-skill） |
| `mvt-init/business.md` | Step 5 增加 `knowledge.shared` 中 `pattern-active` 条目的维护逻辑 |
| `mvt-config/business.md` | 增加知识库管理（查看、移动、删除加载项） |
| `mvt-check-context/business.md` | token 估算纳入 shared + per-skill 全量范围 |
| `mvt-create-skill/business.md` | 生成模板中增加 knowledge 需求声明 |

---

## 实施路径

```
Phase 1: 基础设施 (提案 1 + 2)
├── 创建 sections/session-update.md
├── 重设计 defaults/session.yaml（移除 progress，增加 skill_history）
├── 所有 skill manifest 统一引用 session-update.md
├── 移除各 business.md 中的 Update Workspace 步骤
├── registry.yaml 移除 phase 和 mode 字段
└── 重写 mvt-status（基于 skill_history）

Phase 2: 动态化 (提案 3)
├── 改造 footer-next-steps.md 为动态模板
├── activation-load-context.md 增加 registry 加载
├── 各 skill 统一引用动态 footer
└── mvt-create-skill 模板同步更新

Phase 3: 知识闭环 (提案 4)
├── config.yaml 增加 knowledge.shared（含 pattern-active 动态条目）
├── registry.yaml 每个 skill 增加 knowledge 字段
├── activation-load-context.md 重写为双层加载（shared + per-skill）
├── mvt-add-context 增加知识分类注册（shared vs per-skill 交互）
├── mvt-init 增加 knowledge.shared 中 pattern-active 条目维护
├── mvt-config 增加知识管理
├── mvt-check-context token 估算纳入双层范围
└── mvt-create-skill 增加 knowledge 需求声明
```

### 兼容性考虑

- `session.yaml` 结构变更：需在构建时输出迁移说明，已有工作区的 `session.yaml` 可保留旧字段（LLM 会忽略不认识的字段），新字段由下次 skill 执行自动补全
- `registry.yaml` 移除 `phase` 和 `mode`：纯删除字段，向下兼容
- `activation-load-context.md` 增加 registry 加载：增量变更，不影响已有 skill
- `registry.yaml` 增加 `knowledge` 字段：新增字段，不影响已有 skill（缺失时等同 `knowledge: []`）

### 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| 动态推荐比硬编码推荐准确度低 | 中 | 在 footer 模板中提供充分的上下文提示（当前 skill、skill_history、registry 元数据） |
| per-skill knowledge 增加配置复杂度 | 中 | 缺失 `knowledge` 字段时默认仅加载 shared，渐进式采用；`/mvt-add-context` 交互式引导 |
| shared 知识膨胀导致 token 开销上升 | 低 | shared 默认仅含 core（~800 tokens）；`/mvt-config` 可查看和移除 |
| session.yaml 迁移 | 低 | 旧字段不冲突，新字段按需补全 |
| 共享 section 参数化复杂度 | 低 | 仅使用简单的 `{{#param}}` 条件渲染 |

---

## 附录：变更文件总览

```
新增文件:
  sources/sections/session-update.md

修改文件:
  sources/defaults/session.yaml              # 重设计结构（移除 progress，增加 skill_history）
  sources/defaults/config.yaml               # 新增 knowledge.shared（含 pattern-active 动态条目）
  sources/sections/activation-load-context.md # 重写为双层加载（context + shared knowledge + per-skill knowledge）
  sources/sections/footer-next-steps.md      # 动态推荐模板
  registry.yaml                              # 移除 phase 和 mode；每个 skill 增加 knowledge 字段

各 skill manifest.yaml (共 14 个):
  - 统一引用 session-update.md
  - 统一引用 footer-next-steps.md（替代内联建议）

各 skill business.md (共 10 个):
  - 移除 "Update Workspace" 步骤
  - 移除硬编码的 "Suggested Next Steps"

重点重写:
  mvt-status/business.md                     # 基于 skill_history 重写
  mvt-add-context/business.md                # 增加知识分类注册（shared vs per-skill 交互）
  mvt-init/business.md                       # 增加 knowledge.shared 中 pattern-active 维护
  mvt-config/business.md                     # 增加知识管理
  mvt-check-context/business.md              # token 估算纳入双层知识范围
  mvt-create-skill/business.md               # 增加 knowledge 需求声明
```

---

## 附录：待定事项 — activation-load-context 用户交互机制

> 此项经分析后暂不纳入当前提案，记录分析结论供后续决策。

### 原始提议

在 `activation-load-context.md` 中增加用户交互：当第一次执行 skill 时，展示准备加载的 context 文件列表，与用户确认，并询问是否需要额外补充。

### 分析结论：暂不采纳

**核心问题**：交互与 skill 执行耦合，增加不可预测性。

| 维度 | 分析 |
|------|------|
| **"第一次"定义模糊** | 首次在本对话中？本项目中？使用该 skill？`session.yaml` 无精确判断依据 |
| **执行摩擦** | 用户执行 `/mvt-fix` 想快速修 bug，却要先确认 context 加载列表，打断工作流 |
| **上下文漂移** | 同一对话中 `/mvt-add-context` 可能改变了知识库，首次确认后 context 已不同 |
| **LLM 交互可靠性** | "展示列表 → 等待确认 → 追加补充" 的多轮交互对 LLM 指令遵从度要求高，容易中断或遗忘 |
| **已有替代** | `/mvt-check-context`（查看负载）、`/mvt-status`（查看状态）、`/mvt-config`（管理知识库） |

### 备选方案（供后续评估）

**方案 A：`--preview` flag**
```
/mvt-analyze --preview    # 只展示将要加载的 context，不执行
/mvt-analyze              # 正常执行，不中断
```
- 优点：零侵入，用户按需使用
- 缺点：需要每个 skill 支持 flag 解析

**方案 B：无交互的 context 摘要**
在 `activation-load-context.md` 中加一段展示指令（不等待用户输入）：
```
[Context Loaded] session.yaml | project-context.yaml | registry.yaml | core/review-principles.md | patterns/ddd/*
```
- 优点：提供透明性，不中断执行
- 缺点：每次 skill 执行都输出一行，可能被用户忽略

**方案 C：独立 `/mvt-preview` 命令**
创建专门的 preview skill，展示下次 skill 执行将加载的完整 context 列表。
- 优点：职责清晰，不影响现有 skill
- 缺点：增加一个 skill 维护成本

# MVTT CLI 架构设计文档

> **文档性质**：正式架构设计文档，基于 `cli-migration-plan.md` 路线图 + 决策确认后产出，供审阅后作为实施依据。
>
> **决策记录**：
>
> | # | 决策点 | 选择 |
> |---|---|---|
> | 1 | CLI 仓库位置 | **A：保持当前 `My-Virtual-TechTeam` 仓库（monorepo）** |
> | 2 | npm 包名 | **`@uoyo/mvtt`**（scoped 包） |
> | 3 | 版本策略 | **SemVer；CLI 与 source 同版本号一起发布** |
> | 4 | 拆分粒度起点 | **先拆 Activation Protocol 5 个共享 section；其余保持 inline** |
> | 5 | eject 命令 | **v2.0.0 不做** |
> | 6 | 迁移命令 | **不需要；用户直接使用新版本安装** |
>
> **编制日期**：2026-04-28
> **状态**：待审阅

---

## 目录

- [一、架构总览](#一架构总览)
- [二、核心设计原则](#二核心设计原则)
- [三、Source 层设计](#三source-层设计)
- [四、Build 引擎设计](#四build-引擎设计)
- [五、CLI 命令设计](#五cli-命令设计)
- [六、Runtime 层设计（用户项目产物）](#六runtime-层设计用户项目产物)
- [七、文件保护机制](#七文件保护机制)
- [八、Manifest 驱动拼装详解](#八manifest-驱动拼装详解)
- [九、共享 Section 拆分清单](#九共享-section-拆分清单)
- [十、技术栈与工程规范](#十技术栈与工程规范)
- [十一、执行计划](#十一执行计划)
- [十二、验收标准](#十二验收标准)
- [十三、风险与缓解](#十三风险与缓解)
- [十四、明确不做的事](#十四明确不做的事)
- [附录 A：完整 Manifest 示例](#附录-a完整-manifest-示例)
- [附录 B：共享 Section 模板示例](#附录-b共享-section-模板示例)
- [附录 C：现有 Skill 完整清单](#附录-c现有-skill-完整清单)

---

## 一、架构总览

### 1.1 核心思想

**Source 和 Runtime 之间加入生成器层，从根源消灭双写漂移。**

```
┌──────────────────────────────────┐
│  Source 层（开发者维护）             │
│  - 细粒度 section（DRY）            │
│  - manifest.yaml（拼装声明）        │
│  - registry.yaml（单一元数据源）     │
└──────────────┬───────────────────┘
               │
               │  mvtt build（assembler）
               │
               ▼
┌──────────────────────────────────┐
│  Runtime 层（用户项目）              │
│  - 完整扁平 SKILL.md（inlined）     │
│  - 完整扁平 output template         │
│  - 只读 registry / knowledge        │
└──────────────────────────────────┘
```

### 1.2 架构收益

| 原问题 | CLI 架构如何解决 |
|---|---|
| P1 引导性输出缺失 | 共享 footer section 在 source 层维护一份，build 时 inline 到每个 output template |
| P2 registry 未激活 | registry.yaml 成为 build 的核心元数据输入；同时分发到 runtime 供 `/mvt-status`、`/mvt-help` 读取 |
| P3 契约未文档化 | registry 即单一契约源，不再需要独立 schemas/ |
| P6 样板冗余 | source 层高度 DRY（共享 section）；runtime 层完全 inline（零额外读取） |
| `/mvt-sync-skills` | **作废**——重新 build 即对齐 |
| `/mvt-update` skill | **作废**——`npx @uoyo/mvtt update` CLI 命令替代 |
| `update_framework.py` | **作废**——CLI 替代 |

### 1.3 仓库结构

```
My-Virtual-TechTeam/                    # monorepo
│
├── package.json                         # npm 包：@uoyo/mvtt
├── tsconfig.json
├── tsconfig.build.json
├── .npmignore
│
├── src/                                 # CLI 实现（TypeScript）
│   ├── index.ts                         # bin 入口
│   ├── cli.ts                           # 命令路由
│   │
│   ├── commands/
│   │   ├── install.ts                   # 首次安装
│   │   ├── update.ts                    # 增量更新
│   │   ├── uninstall.ts                 # 清理卸载
│   │   └── doctor.ts                    # 健康检查
│   │
│   ├── build/
│   │   ├── assembler.ts                 # manifest → 完整 markdown
│   │   ├── section-loader.ts            # 4 类 section 的加载、参数替换
│   │   └── validator.ts                 # manifest schema 校验
│   │
│   ├── fs/
│   │   ├── protection.ts               # 保护区判断、GENERATED 头检测
│   │   └── hash.ts                      # SHA-256 文件 hash
│   │
│   └── types/
│       ├── manifest.ts                  # Manifest TS 类型
│       └── registry.ts                  # Registry TS 类型
│
├── sources/                             # 所有 skill / template 的源
│   ├── skills/
│   │   ├── mvt-analyze/
│   │   │   ├── manifest.yaml            # 拼装清单
│   │   │   └── business.md              # 业务逻辑（Execution Flow）
│   │   ├── mvt-design/
│   │   │   ├── manifest.yaml
│   │   │   └── business.md
│   │   └── ...（19 个 skill）
│   │
│   ├── sections/                        # 共享 section（被多个 skill 引用）
│   │   ├── activation-load-context.md
│   │   ├── activation-load-config.md
│   │   ├── activation-preflight.md
│   │   ├── role-header.md
│   │   └── footer-next-steps.md
│   │
│   └── templates/                       # 输出模板的源
│       ├── analyze-output/
│       │   ├── manifest.yaml
│       │   └── body.md
│       ├── init-output/
│       │   ├── manifest.yaml
│       │   └── body.md
│       └── ...（14 个 template）
│
├── registry.yaml                        # 元数据单一源（build 核心输入）
├── install-manifest.yaml                # 安装清单：文件分类与目标路径
│
├── test/
│   ├── assembler.test.ts
│   ├── section-loader.test.ts
│   ├── commands/
│   │   ├── install.test.ts
│   │   └── update.test.ts
│   └── fixtures/
│       └── expected/                    # snapshot：期望的生成结果
│
├── docs/
│   ├── architecture-analysis.md         # 历史分析文档
│   ├── change-plan.md                   # 历史（已作废）
│   ├── cli-migration-plan.md            # 路线图
│   └── cli-architecture-design.md       # 本文档
│
├── .ai-agents/                          # 当前版本（CLI 完成后变为 source 的原始素材）
├── .claude/                             # 当前版本（同上）
│
└── README - About MVTT .md
```

---

## 二、核心设计原则

### 2.1 DRY at Source, Inlined at Runtime

| 层 | 原则 | 说明 |
|---|---|---|
| Source | DRY | 共享内容只写一份（section 文件），通过 manifest 引用 |
| Runtime | Inlined | 每个 SKILL.md / output template 是完整自包含的扁平文档，AI 读一个文件即可 |

**为什么 runtime 必须 inline**：
1. Token 成本——每次额外读取 ~500-800 token
2. IO 延迟——多次 Read 工具调用
3. 可靠性——AI 可能跳过引用、忘记 resolve
4. 可读性——一个文件看完整行为，不需要跳转

### 2.2 人工始终在驾驶位

CLI 只负责**安装和更新文件**，不做任何 runtime 行为控制。skill 的执行仍然完全由用户触发、AI 按 SKILL.md 指令执行。

### 2.3 热路径内嵌，冷路径抽离

| 内容类型 | 频率 | 处理 |
|---|---|---|
| Activation Protocol（Load Context / Load Config / Pre-flight） | 每次 skill 调用 | **内嵌**到每个 SKILL.md |
| Output footer（Next-Step Guidance） | 每次 skill 输出 | **内嵌**到每个 output template |
| Registry（依赖、next-step 数据源） | 仅 `/mvt-status`、`/mvt-help` 和 skill 需要查引导时读 | **抽离**为独立文件 |
| Knowledge（patterns、core docs） | 仅特定 skill 按需读 | **抽离**为独立文件 |

### 2.4 GENERATED vs USER DATA

CLI 管理的文件严格分为两类，互不越界：

- **GENERATED**：CLI 完全托管，每次 update 覆盖
- **USER DATA**：CLI 永不触碰，属于用户

---

## 三、Source 层设计

### 3.1 Skill Source 结构

每个 skill 在 `sources/skills/` 下有独立目录：

```
sources/skills/mvt-analyze/
├── manifest.yaml          # 拼装声明：由哪些 section 组成
└── business.md            # 该 skill 特有的业务逻辑（Execution Flow）
```

`manifest.yaml` 是组装说明书，声明一个 SKILL.md 由哪些 section 按什么顺序拼成。

`business.md` 是该 skill 独有的内容——执行步骤、决策规则、变体定义等。

### 3.2 共享 Section

存放在 `sources/sections/`，被多个 skill 的 manifest 引用：

```
sources/sections/
├── activation-load-context.md       # Step 1: Load Context
├── activation-load-config.md        # Step 2: Load Config & Apply Preferences
├── activation-preflight.md          # Step 3: Pre-flight Checks（参数化模板）
├── role-header.md                   # Role 声明块（参数化模板）
└── footer-next-steps.md             # Suggested Next Steps 块（参数化模板）
```

共享 section 支持参数替换，详见[第八节](#八manifest-驱动拼装详解)。

### 3.3 Output Template Source 结构

```
sources/templates/analyze-output/
├── manifest.yaml          # 拼装声明
└── body.md                # 模板主体内容
```

Output template 的 manifest 同样支持引用共享 section（如 footer-next-steps）。

### 3.4 Registry（根目录）

`registry.yaml` 位于仓库根目录，是 build 的核心元数据输入。同时在 install 时复制到用户项目供 runtime 读取。

**Registry 结构**（v2，继承并扩展当前版本）：

```yaml
version: "2.0"
last_updated: "2026-04-28"

skills:
  mvt-analyze:
    agent: analyst
    description: "Analyze requirements documents and extract domain concepts"
    path: .claude/skills/mvt-analyze/SKILL.md
    template: .ai-agents/skills/_templates/analyze-output.md
    category: workflow              # workflow | shortcut | utility | project
    mode: full-workflow
    phase: analyze                  # 对应 session.progress 中的字段
    depends_on: []
    next_suggestions:
      primary: mvt-design
      primary_desc: "Create architecture based on this analysis"
      alternatives:
        - skill: mvt-analyze
          when: "ambiguities remain, refine analysis"

  mvt-design:
    agent: architect
    description: "Create architecture design based on analyzed requirements"
    path: .claude/skills/mvt-design/SKILL.md
    template: .ai-agents/skills/_templates/design-output.md
    category: workflow
    mode: full-workflow
    phase: design
    depends_on: [mvt-analyze]
    next_suggestions:
      primary: mvt-implement
      primary_desc: "Implement features based on this design"
      alternatives:
        - skill: mvt-design
          when: "design needs revision"

  # ... 其余 skill 同结构
```

**Build 时用途**：assembler 从 registry 读取 `next_suggestions`、`depends_on` 等数据，注入到共享 section 的参数中。

**Runtime 用途**：`/mvt-status` 和 `/mvt-help` 读取 registry 动态生成状态表和帮助信息。

---

## 四、Build 引擎设计

### 4.1 整体流程

```
registry.yaml ──┐
                 │
manifest.yaml ───┼──→ assembler.ts ──→ 完整 markdown 文件
                 │
sections/*.md ──┘
```

**步骤**：

1. **加载 registry**：解析 `registry.yaml`，获取所有 skill 的元数据
2. **遍历 manifest**：对 `sources/skills/*/manifest.yaml` 和 `sources/templates/*/manifest.yaml` 逐个处理
3. **加载 section**：按 manifest 中的 `sections` 数组顺序，依次加载每个 section
4. **参数替换**：对 `shared` 和 `template` 类型的 section，用 manifest 中的 `params` + registry 中的元数据做变量替换
5. **拼接**：将 frontmatter + 所有 section 内容顺序拼接为一个完整的 markdown 文件
6. **写入**：在目标路径输出文件，首行加 GENERATED 标记

### 4.2 Section 类型（4 类）

| 类型 | 说明 | 来源 |
|---|---|---|
| `inline` | 直接写在 manifest 中的短文本 | manifest.yaml 的 `content` 字段 |
| `file` | 引用本 skill 目录下的 `.md` 文件 | 相对于 skill 目录的路径 |
| `shared` | 引用 `sources/sections/` 下的共享文件 | `sections/` 目录下的文件名 |
| `template` | 与 `shared` 相同，但强调有参数替换 | 同 `shared`（实现上无区别，语义区分） |

> 实现层面 `shared` 和 `template` 的处理逻辑相同——都支持参数替换。区分两个名称是为了 manifest 的可读性：`shared` 暗示"原样引入"，`template` 暗示"需要填参数"。

### 4.3 参数替换规则

使用 `{{variable}}` 语法，assembler 做简单字符串替换：

```yaml
# manifest.yaml 中
- type: shared
  source: sections/role-header.md
  params:
    role: Analyst
    role_desc: "a Requirements Analysis Expert"
```

```markdown
<!-- sections/role-header.md -->
## Role

You are the **{{role}}** -- {{role_desc}}.
```

**替换后**：

```markdown
## Role

You are the **Analyst** -- a Requirements Analysis Expert.
```

**嵌套参数**：支持一层深度的对象/数组参数，assembler 按约定格式展开：

```yaml
params:
  boundaries:
    - skill: /mvt-design
      scope: architecture decisions
    - skill: /mvt-implement
      scope: implementation code
```

对应模板中使用 `{{#boundaries}}` / `{{/boundaries}}` 块语法（类 Mustache，但仅实现最小子集）：

```markdown
### Boundaries
{{#boundaries}}
- Do NOT {{scope}} -> Suggest `{{skill}}`
{{/boundaries}}
```

### 4.4 Assembler 输出

每个生成文件的结构：

```markdown
<!-- GENERATED by mvtt v2.0.0 @ 2026-04-28T10:00:00Z. Manual edits will be overwritten. -->
---
name: mvt-analyze
description: 'Analyze requirements documents and extract domain concepts...'
---

[section 1 内容]

[section 2 内容]

...

[section N 内容]
```

### 4.5 Validator

在 build 前校验：

1. **manifest schema**：每个 manifest.yaml 必须包含 `name`、`output`、`sections` 字段
2. **section 引用**：所有 `source` 引用的文件必须存在
3. **参数完整性**：shared section 中的 `{{variable}}` 在 manifest 的 `params` 中都有对应值
4. **registry 一致性**：`sources/skills/` 下的每个 skill 在 `registry.yaml` 中都有对应条目

校验失败时 build 中止并输出清晰错误信息。

---

## 五、CLI 命令设计

### 5.1 命令总览

| 命令 | 功能 | 典型用法 |
|---|---|---|
| `npx @uoyo/mvtt install` | 首次安装到当前项目 | 项目根目录执行 |
| `npx @uoyo/mvtt install --pattern ddd` | 安装时指定 architecture pattern | |
| `npx @uoyo/mvtt update` | 更新到最新版本（保留 USER DATA） | |
| `npx @uoyo/mvtt update --check` | 只检查是否有新版，不实际更新 | |
| `npx @uoyo/mvtt update --to 2.1.0` | 更新到指定版本 | |
| `npx @uoyo/mvtt doctor` | 检查安装健康状态 | |
| `npx @uoyo/mvtt uninstall` | 移除所有 GENERATED 文件；保留 USER DATA | |

### 5.2 install 流程

```
npx @uoyo/mvtt install [--pattern <name>]
```

**流程**：

1. **检测**：检查目标目录是否已有 `.mvtt-manifest.json`
   - 已存在 → 提示 "Already installed. Use `update` instead." 并退出
2. **Build**：运行 assembler 从 source 生成所有 runtime 文件到内存
3. **写入 GENERATED 文件**：
   - `.claude/skills/mvt-*/SKILL.md`（19 个 skill）
   - `.ai-agents/skills/_templates/*-output.md`（14 个 template）
   - `.ai-agents/knowledge/core/*`
   - `.ai-agents/knowledge/patterns/*`
   - `.ai-agents/registry.yaml`
4. **创建 CREATE_ONCE 文件**（仅首次）：
   - `.ai-agents/config.yaml`（默认配置）
   - `.ai-agents/workspace/session.yaml`（空骨架）
   - `.ai-agents/workspace/project-context.yaml`（空骨架）
5. **创建 USER DATA 目录**：
   - `.ai-agents/workspace/artifacts/`
   - `.ai-agents/skills/_templates/custom/`
   - `.ai-agents/knowledge/principle/`
   - `.ai-agents/knowledge/project/`
6. **写入安装元数据**：`.ai-agents/.mvtt-manifest.json`
7. **输出摘要**：列出安装的文件数量、版本、下一步操作提示

**pattern 处理**：
- 如果指定了 `--pattern ddd`，在 `config.yaml` 中设置 `pattern.active: ddd`
- 如果未指定，`pattern.active` 留空，由用户后续通过 `/mvt-init` 设置

### 5.3 update 流程

```
npx @uoyo/mvtt update [--check] [--to <version>]
```

**流程**：

1. **读取** `.mvtt-manifest.json`，获取当前安装版本
2. **对比**：当前版本 vs 目标版本（latest 或 `--to` 指定）
   - `--check` 模式：只输出版本差异摘要，不做任何修改
3. **检测用户改动**：对所有 GENERATED 文件计算 hash，与 manifest 记录对比
   - 若发现用户手改了 GENERATED 文件 → 警告并列出，询问是否继续
4. **Build**：用新版 source 重新生成
5. **覆盖 GENERATED 文件**：只覆盖 GENERATED 区域的文件
6. **不碰 USER DATA 和 CREATE_ONCE**
7. **更新** `.mvtt-manifest.json`（版本号、hash、时间戳）
8. **输出摘要**：列出更新/新增/删除的文件

### 5.4 doctor 流程

```
npx @uoyo/mvtt doctor
```

**检查项**：

| 检查 | 说明 |
|---|---|
| manifest 存在 | `.mvtt-manifest.json` 是否存在 |
| 文件完整性 | GENERATED 文件是否都在，hash 是否匹配 |
| 用户改动检测 | 哪些 GENERATED 文件被手动修改了 |
| 目录结构 | USER DATA 目录是否存在 |
| config.yaml | 是否存在，格式是否合法 |
| registry 一致性 | runtime registry 与包内 registry 版本是否匹配 |

输出格式：

```
mvtt doctor v2.0.0

[PASS] .mvtt-manifest.json exists
[PASS] 19 skill files present
[WARN] .claude/skills/mvt-analyze/SKILL.md has been manually modified
[PASS] 14 template files present
[PASS] config.yaml valid
[PASS] workspace directories exist

Summary: 1 warning, 0 errors
```

### 5.5 uninstall 流程

```
npx @uoyo/mvtt uninstall
```

**流程**：

1. 读取 `.mvtt-manifest.json`，获取所有 GENERATED 文件列表
2. **确认提示**：列出将删除的文件，等待用户确认
3. 删除所有 GENERATED 文件
4. 删除 `.mvtt-manifest.json`
5. **保留**所有 USER DATA（workspace/、custom/、principle/、project/、config.yaml）
6. 输出摘要

---

## 六、Runtime 层设计（用户项目产物）

### 6.1 目录结构

```
user-project/
├── .claude/
│   └── skills/
│       ├── mvt-add-context/SKILL.md      # GENERATED
│       ├── mvt-analyze/SKILL.md          # GENERATED
│       ├── mvt-analyze-code/SKILL.md     # GENERATED
│       ├── mvt-check-context/SKILL.md    # GENERATED
│       ├── mvt-cleanup/SKILL.md          # GENERATED
│       ├── mvt-config/SKILL.md           # GENERATED
│       ├── mvt-create-skill/SKILL.md     # GENERATED
│       ├── mvt-design/SKILL.md           # GENERATED
│       ├── mvt-fix/SKILL.md              # GENERATED
│       ├── mvt-help/SKILL.md             # GENERATED
│       ├── mvt-implement/SKILL.md        # GENERATED
│       ├── mvt-init/SKILL.md             # GENERATED
│       ├── mvt-refactor/SKILL.md         # GENERATED
│       ├── mvt-review/SKILL.md           # GENERATED
│       ├── mvt-status/SKILL.md           # GENERATED
│       ├── mvt-sync-context/SKILL.md     # GENERATED
│       ├── mvt-template/SKILL.md         # GENERATED
│       └── mvt-test/SKILL.md             # GENERATED
│
├── .ai-agents/
│   ├── workspace/                         # USER DATA
│   │   ├── session.yaml                   # CREATE_ONCE
│   │   ├── project-context.yaml           # CREATE_ONCE
│   │   └── artifacts/                     # USER DATA
│   │
│   ├── skills/
│   │   └── _templates/
│   │       ├── analyze-output.md          # GENERATED
│   │       ├── analyze-code-output.md     # GENERATED
│   │       ├── cleanup-output.md          # GENERATED
│   │       ├── config-output.md           # GENERATED
│   │       ├── context-check-output.md    # GENERATED
│   │       ├── design-output.md           # GENERATED
│   │       ├── fix-output.md              # GENERATED
│   │       ├── implement-output.md        # GENERATED
│   │       ├── init-output.md             # GENERATED
│   │       ├── refactor-output.md         # GENERATED
│   │       ├── review-output.md           # GENERATED
│   │       ├── status-output.md           # GENERATED
│   │       ├── sync-context-output.md     # GENERATED
│   │       ├── test-output.md             # GENERATED
│   │       └── custom/                    # USER DATA
│   │
│   ├── knowledge/
│   │   ├── core/                          # GENERATED
│   │   ├── patterns/                      # GENERATED
│   │   ├── principle/                     # USER DATA
│   │   └── project/                       # USER DATA
│   │
│   ├── config.yaml                        # CREATE_ONCE
│   ├── registry.yaml                      # GENERATED
│   └── .mvtt-manifest.json                # GENERATED（安装元数据）
│
└── ...（用户自己的代码）
```

### 6.2 被删除的旧文件

以下文件/目录在 CLI 方案中**不再需要**：

| 旧文件 | 处置 |
|---|---|
| `.ai-agents/scripts/update_framework.py` | 删除 |
| `.ai-agents/scripts/requirements.txt` | 删除 |
| `.claude/skills/mvt-update/SKILL.md` | 删除（CLI `update` 命令替代） |
| `.ai-agents/skills/_templates/_manifest.yaml` | 删除（registry.yaml 统一管理） |
| `.ai-agents/skills/_templates/update-framework-output.md` | 删除 |

### 6.3 生成后的 SKILL.md 结构

以 `mvt-analyze` 为例，生成后的 SKILL.md 是完全自包含的：

```markdown
<!-- GENERATED by mvtt v2.0.0 @ 2026-04-28T10:00:00Z. Manual edits will be overwritten. -->
---
name: mvt-analyze
description: 'Analyze requirements documents and extract domain concepts...'
---

# MVT Analyze

## Purpose
Analyze requirements documents...

## Role
You are the **Analyst** -- a Requirements Analysis Expert.

### Decision Rules
- If user intent is unclear -> Ask a clarifying question
- ...

### Boundaries
- Do NOT architecture decisions -> Suggest `/mvt-design`
- Do NOT implementation code -> Suggest `/mvt-implement`

## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

Extended context for this skill:
- `.ai-agents/knowledge/core/*`
- `.ai-agents/workspace/artifacts/{change_id}/analysis.md` (if exists)

### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` -> Use this language for ALL output
- `preferences.output.no_emojis` -> If true, never use emojis
- `preferences.output.data_format` -> Use this format for data sections

### Step 3: Pre-flight Checks
- If `session.initialized_at` is empty -> WARN: "Session not initialized. Run /mvt-init first."
- If `project.name` is empty -> WARN: "Project not initialized."

### Step 4: Execute
[该 skill 独有的业务逻辑：Execution Flow、Variants、具体步骤...]

## Output Format
Read and use the output template from: `.ai-agents/skills/_templates/analyze-output.md`

## Suggested Next Steps
After completion, suggest:
- `/mvt-design` -- Create architecture based on this analysis
- `/mvt-analyze` -- Refine analysis if ambiguities remain
- `/mvt-status` -- View project status
```

---

## 七、文件保护机制

### 7.1 三级分类

| 级别 | 标识 | CLI 行为 | 示例 |
|---|---|---|---|
| **GENERATED** | 首行含 `GENERATED by mvtt` | install 时创建，update 时覆盖，uninstall 时删除 | SKILL.md、*-output.md、registry.yaml |
| **CREATE_ONCE** | 在 install-manifest.yaml 中标记 | install 时创建，update 时**不覆盖**，uninstall 时**保留** | config.yaml、session.yaml、project-context.yaml |
| **USER DATA** | 在 install-manifest.yaml 中标记 | CLI 永不创建内容（只创建目录），永不修改，永不删除 | workspace/artifacts/、custom/、principle/、project/ |

### 7.2 install-manifest.yaml

```yaml
version: 2

generated:
  - pattern: ".claude/skills/mvt-*/SKILL.md"
    source: "build:skills"
  - pattern: ".ai-agents/skills/_templates/*-output.md"
    source: "build:templates"
  - pattern: ".ai-agents/knowledge/core/**"
    source: "copy:sources/knowledge/core/"
  - pattern: ".ai-agents/knowledge/patterns/**"
    source: "copy:sources/knowledge/patterns/"
  - pattern: ".ai-agents/registry.yaml"
    source: "copy:registry.yaml"

create_once:
  - path: ".ai-agents/config.yaml"
    source: "sources/defaults/config.yaml"
  - path: ".ai-agents/workspace/session.yaml"
    source: "sources/defaults/session.yaml"
  - path: ".ai-agents/workspace/project-context.yaml"
    source: "sources/defaults/project-context.yaml"

user_data_dirs:
  - ".ai-agents/workspace/artifacts/"
  - ".ai-agents/skills/_templates/custom/"
  - ".ai-agents/knowledge/principle/"
  - ".ai-agents/knowledge/project/"
```

### 7.3 GENERATED 文件头标记

```markdown
<!-- GENERATED by mvtt v2.0.0 @ 2026-04-28T10:00:00Z. Manual edits will be overwritten. -->
```

CLI 通过检测首行是否匹配 `<!-- GENERATED by mvtt` 来判断文件是否为自己生成的。

### 7.4 .mvtt-manifest.json

```json
{
  "mvtt_version": "2.0.0",
  "installed_at": "2026-04-28T10:00:00Z",
  "last_updated_at": "2026-04-28T10:00:00Z",
  "pattern": "ddd",
  "files": {
    ".claude/skills/mvt-analyze/SKILL.md": {
      "hash": "sha256:abc123...",
      "category": "generated"
    },
    ".ai-agents/skills/_templates/analyze-output.md": {
      "hash": "sha256:def456...",
      "category": "generated"
    },
    ".ai-agents/config.yaml": {
      "hash": "sha256:789ghi...",
      "category": "create_once"
    }
  }
}
```

**用途**：
- `update`：对比 installed 与新版的差异
- `doctor`：检测 GENERATED 文件是否被手改（hash 不符）
- `uninstall`：精确知道该删哪些文件

---

## 八、Manifest 驱动拼装详解

### 8.1 Skill Manifest 完整结构

```yaml
# sources/skills/mvt-analyze/manifest.yaml
name: mvt-analyze
output: .claude/skills/mvt-analyze/SKILL.md

frontmatter:
  name: mvt-analyze
  description: "Analyze requirements documents and extract domain concepts..."

sections:
  # Section 1: 标题与目的（inline）
  - type: inline
    content: |
      # MVT Analyze

      ## Purpose
      Analyze requirements documents, extract features, actors, domain concepts,
      and business rules. Produce structured analysis artifacts.

  # Section 2: 角色声明（shared + 参数化）
  - type: shared
    source: sections/role-header.md
    params:
      role: Analyst
      role_desc: "a Requirements Analysis Expert"
      decision_rules:
        - condition: "user intent is unclear"
          action: "Ask a clarifying question before proceeding"
        - condition: "requirements conflict"
          action: "Highlight conflicts and ask user to resolve"
      boundaries:
        - skill: /mvt-design
          scope: architecture decisions
        - skill: /mvt-implement
          scope: implementation code

  # Section 3: Load Context（shared，通用）
  - type: shared
    source: sections/activation-load-context.md
    params:
      extended_context:
        - ".ai-agents/knowledge/core/*"
        - ".ai-agents/workspace/artifacts/{change_id}/analysis.md (if exists)"

  # Section 4: Load Config（shared，通用，无参数）
  - type: shared
    source: sections/activation-load-config.md

  # Section 5: Pre-flight（shared + 参数化）
  - type: shared
    source: sections/activation-preflight.md
    params:
      checks:
        - field: session.initialized_at
          empty_message: "Session not initialized. Run /mvt-init first."
          level: WARN
        - field: project.name
          empty_message: "Project not initialized."
          level: WARN

  # Section 6: 业务逻辑（file，本 skill 独有）
  - type: file
    source: ./business.md

  # Section 7: 输出格式指令（inline）
  - type: inline
    content: |
      ## Output Format

      Read and use the output template from: `.ai-agents/skills/_templates/analyze-output.md`

      If a custom version exists at `.ai-agents/skills/_templates/custom/analyze-output.md`, use the custom version instead.

  # Section 8: Next Steps 指引（shared + 参数化）
  - type: shared
    source: sections/footer-next-steps.md
    params:
      next_primary: mvt-design
      next_primary_desc: "Create architecture based on this analysis"
      next_alternatives:
        - skill: mvt-analyze
          when: "ambiguities remain, refine analysis"
      always_show:
        - skill: mvt-status
          desc: "View project status"
```

### 8.2 Template Manifest 结构

```yaml
# sources/templates/analyze-output/manifest.yaml
name: analyze-output
output: .ai-agents/skills/_templates/analyze-output.md

frontmatter:
  id: analyze-output
  version: "1.0"
  skill: mvt-analyze

sections:
  - type: file
    source: ./body.md

  - type: shared
    source: sections/footer-next-steps.md
    params:
      next_primary: mvt-design
      next_primary_desc: "Create architecture based on this analysis"
      next_alternatives:
        - skill: mvt-analyze
          when: "address blocking questions before proceeding"
```

### 8.3 Assembler 处理伪代码

```typescript
function assemble(manifest: Manifest, registry: Registry): string {
  const lines: string[] = [];

  // 1. GENERATED 标记
  lines.push(generatedHeader(manifest.name));

  // 2. Frontmatter
  lines.push('---');
  for (const [key, value] of Object.entries(manifest.frontmatter)) {
    lines.push(`${key}: ${yaml(value)}`);
  }
  lines.push('---');
  lines.push('');

  // 3. 逐 section 拼接
  for (const section of manifest.sections) {
    let content: string;

    switch (section.type) {
      case 'inline':
        content = section.content;
        break;
      case 'file':
        content = readFile(resolve(manifest.dir, section.source));
        break;
      case 'shared':
      case 'template':
        content = readFile(resolve(SECTIONS_DIR, section.source));
        if (section.params) {
          content = replaceParams(content, section.params);
        }
        break;
    }

    lines.push(content.trim());
    lines.push('');
  }

  return lines.join('\n');
}
```

---

## 九、共享 Section 拆分清单

### 9.1 首批拆出的 5 个 Section

基于决策 4（先拆 Activation Protocol 5 个共享 section），以下为首批拆分清单：

| # | Section 文件 | 内容 | 参数 |
|---|---|---|---|
| 1 | `activation-load-context.md` | Step 1: Load Context（读 session.yaml + project-context.yaml + 扩展上下文） | `extended_context: string[]` |
| 2 | `activation-load-config.md` | Step 2: Load Config & Apply Preferences（读 config.yaml，应用偏好） | 无（固定内容） |
| 3 | `activation-preflight.md` | Step 3: Pre-flight Checks（检查必要字段是否存在） | `checks: {field, empty_message, level}[]` |
| 4 | `role-header.md` | Role 声明块（角色名、描述、决策规则、边界声明） | `role, role_desc, decision_rules[], boundaries[]` |
| 5 | `footer-next-steps.md` | Suggested Next Steps（下一步主推荐 + 备选 + 固定提示） | `next_primary, next_primary_desc, next_alternatives[], always_show[]` |

### 9.2 保持 inline 的内容

以下内容因为每个 skill 差异大，不适合抽为共享 section：

- **Purpose 段落**：每个 skill 的目的描述完全不同
- **Execution Flow**：每个 skill 的核心业务逻辑（business.md）
- **Variants**：部分 skill 有变体定义，内容差异大
- **Output Format 指令**：虽然模式相似，但模板路径不同，用 inline + 变量替换更清晰

### 9.3 未来可能拆出的 Section（暂不拆）

| Section | 条件 |
|---|---|
| `output-format-instruction.md` | 如果 19 个 skill 的输出格式指令收敛到完全统一的模式 |
| `activation-validate-context.md` | 如果 P3（契约校验）落地后，Pre-flight 和 Validate 需要拆开 |

---

## 十、技术栈与工程规范

### 10.1 技术选型

| 项目 | 选择 | 原因 |
|---|---|---|
| 语言 | TypeScript | 类型安全、npm 生态原生 |
| 运行时 | Node.js >= 18 | LTS 保障、原生 ESM |
| 模块系统 | ESM (`"type": "module"`) | 现代标准 |
| 构建 | `tsc`（TypeScript Compiler） | 简单直接，不需要 bundler |
| CLI 框架 | 无（手写 `process.argv` 解析） | 命令少（4-5 个），引入 Commander/Yargs 过重 |
| YAML 解析 | `yaml`（npm 包） | 标准 YAML 1.2 支持 |
| Hash | Node.js 内置 `crypto` | SHA-256，无额外依赖 |
| 测试 | `vitest` | 快速、原生 ESM 支持 |
| 发布 | npm publish | `@uoyo/mvtt` scoped 包 |

### 10.2 package.json 核心字段

```json
{
  "name": "@uoyo/mvtt",
  "version": "2.0.0",
  "description": "My Virtual Tech Team - AI-guided prompt orchestration framework",
  "type": "module",
  "bin": {
    "mvtt": "./dist/index.js"
  },
  "files": [
    "dist/",
    "sources/",
    "registry.yaml",
    "install-manifest.yaml"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest",
    "prepublishOnly": "npm run build && npm test"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "vitest": "^2.0"
  },
  "dependencies": {
    "yaml": "^2.4"
  }
}
```

### 10.3 目录约定

- `src/` → TypeScript 源码
- `dist/` → 编译产物（.gitignore）
- `sources/` → skill/template/section 源（随 npm 包一起分发）
- `test/` → 测试
- `test/fixtures/expected/` → snapshot 文件（build 结果的期望值）

### 10.4 测试策略

| 测试类型 | 覆盖范围 | 工具 |
|---|---|---|
| **Snapshot 测试** | assembler 生成的 SKILL.md 与 expected/ 目录下的快照对比 | vitest snapshot |
| **单元测试** | section-loader 参数替换、validator 校验逻辑 | vitest |
| **集成测试** | install / update / uninstall 在临时目录中完整运行 | vitest + tmp dir |
| **回归测试** | 生成的 19 个 SKILL.md 与当前手写版本语义一致 | 首次迁移时建立 baseline |

---

## 十一、执行计划

### 11.1 Phase 分解

```
Phase A（基础骨架）
├── A.1  CLI 仓库脚手架（package.json、tsconfig、bin 入口、目录结构）
├── A.2  Source 层目录结构 + manifest schema 定义
└── A.3  install-manifest.yaml + 保护区规则设计

Phase B（拆分内容）
└── B.1  把 19 skill + 14 template 拆为 source 层
         - 先拆 5 个代表性 skill（mvt-analyze, mvt-design, mvt-implement, mvt-init, mvt-fix）
         - 提取 5 个共享 section
         - 确认 build 结果与原文件语义一致后，拆剩余 14 个

Phase C（Build 引擎）
├── C.1  assembler + section-loader 实现
├── C.2  validator 实现
└── C.3  snapshot 测试建立

Phase D（CLI 命令层）
├── D.1  install 命令实现
├── D.2  update 命令实现
├── D.3  doctor 命令实现
└── D.4  uninstall 命令实现

Phase E（上线）
├── E.1  npm scope 注册 + 首次发布
├── E.2  README 更新
└── E.3  旧文件清理（删除 update skill、scripts/、_manifest.yaml 等）
```

### 11.2 依赖关系

```
A.1 → A.2 → A.3 ──┐
                    ├──→ C.1 → C.2 → C.3 → D.1 → D.2 → D.3 → D.4 → E.1 → E.2 → E.3
B.1 ───────────────┘
```

Phase A 和 Phase B 可以并行推进（A 做骨架，B 做内容拆分）。Phase C 依赖 A + B 完成。

### 11.3 里程碑

| 里程碑 | 验收标准 |
|---|---|
| **M1: Build 跑通** | `sources/skills/mvt-analyze/` 能拼装出完整的 `SKILL.md`，与当前手写版本语义一致 |
| **M2: 全量 Build** | 19 个 skill + 14 个 template 全部可 build，snapshot 测试通过 |
| **M3: Install 可用** | 空项目执行 `npx @uoyo/mvtt install` 得到完整 MVTT 目录结构 |
| **M4: Update 可用** | v2.0.0 项目执行 update 到 v2.0.1，GENERATED 文件正确更新，USER DATA 无损 |
| **M5: Doctor 可用** | 手改一个 GENERATED 文件后 `mvtt doctor` 能检测到 |
| **M6: npm 发布** | `npx @uoyo/mvtt install` 在干净机器上可用 |

---

## 十二、验收标准

### 12.1 功能验收

| # | 场景 | 预期结果 |
|---|---|---|
| 1 | 空项目执行 `npx @uoyo/mvtt install` | 生成完整目录结构，19 个 SKILL.md + 14 个 template + config + session + project-context |
| 2 | 执行 `install --pattern ddd` | config.yaml 中 `pattern.active: ddd` |
| 3 | 已安装项目再次 `install` | 提示已安装，建议使用 `update` |
| 4 | 执行 `update` | GENERATED 文件更新，USER DATA 不变 |
| 5 | 手改 GENERATED 文件后 `update` | 警告哪些文件被改过，询问是否继续 |
| 6 | 执行 `doctor` | 正确报告文件完整性状态 |
| 7 | 执行 `uninstall` | GENERATED 文件删除，USER DATA 保留 |
| 8 | 生成的 SKILL.md 被 Claude Code 正确识别为 skill | Claude Code 的 `/` 菜单中可以看到所有 mvt-* skill |
| 9 | 生成的 SKILL.md 内容与当前手写版本语义一致 | AI 按 skill 执行时行为不变 |

### 12.2 质量验收

| # | 标准 | 方法 |
|---|---|---|
| 1 | 0 个 npm 安全漏洞 | `npm audit` |
| 2 | TypeScript strict mode 编译通过 | `tsc --strict` |
| 3 | 测试覆盖率 > 80% | vitest coverage |
| 4 | 所有 snapshot 测试通过 | vitest |
| 5 | Windows / macOS / Linux 路径兼容 | 全部使用 `path.join`，不硬编码 `/` |

---

## 十三、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Source 拆分粒度错误（过粗或过细） | 中 | 中 | 先拆 5 个代表性 skill 验证，确认后再铺开 |
| 现有 skill 行为被拆丢失 | 中 | 高 | 每个 skill 写 snapshot test：build output 与现有文件语义比对 |
| 参数替换不足以覆盖所有变体 | 中 | 中 | 预留 `file` 类型兜底——无法模板化的内容直接用独立文件 |
| npm scope `@uoyo` 不可用 | 低 | 低 | 提前在 npmjs.com 注册 `@uoyo` org 确认可用 |
| CLI bug 导致 USER DATA 丢失 | 低 | 高 | update 前自动备份 `.mvtt-backup/`；uninstall 只删 manifest 中记录的文件 |
| Windows 路径问题 | 中 | 中 | 全部使用 `path.join` / `path.resolve`；CI 加 Windows runner |
| `yaml` npm 包的 YAML 1.2 解析与当前文件不兼容 | 低 | 中 | 迁移前用 `yaml` 库解析所有现有 YAML 文件做兼容性验证 |

---

## 十四、明确不做的事

| 不做 | 原因 |
|---|---|
| `eject` 命令 | v2.0.0 聚焦主路径，逃生舱口留给后续版本 |
| `migrate` 命令 | 用户直接使用新版安装，无需迁移路径 |
| `dev --watch` 模式 | 留给后续需要时再加 |
| Skill runtime 行为变更 | CLI 只管文件分发，不改变 skill 的执行逻辑 |
| 自动触发 skill / 编排引擎 | 违反"人工在驾驶位"原则 |
| Python / Node runtime 脚本 | CLI 是 dev-time 工具，runtime 仍然是纯 prompt |
| 热路径内容抽到共享文件（runtime 层） | 违反"热路径内嵌"原则；DRY 在 source 层解决 |
| Bundler（webpack / esbuild） | 4-5 个命令的 CLI 不需要打包，`tsc` 直出 |

---

## 附录 A：完整 Manifest 示例

### mvt-analyze skill manifest

```yaml
# sources/skills/mvt-analyze/manifest.yaml
name: mvt-analyze
output: .claude/skills/mvt-analyze/SKILL.md

frontmatter:
  name: mvt-analyze
  description: >-
    Analyze requirements documents and extract domain concepts.
    Detects features, actors, domain concepts, and business rules.
    Use when user wants to analyze requirements, extract features,
    or start the analysis phase of development workflow.

sections:
  - type: inline
    content: |
      # MVT Analyze

      ## Purpose

      Analyze requirements documents, extract features, actors, domain concepts,
      and business rules. Produce structured analysis artifacts that feed into
      the design phase.

  - type: shared
    source: sections/role-header.md
    params:
      role: Analyst
      role_desc: "a Requirements Analysis Expert"
      decision_rules:
        - condition: "user intent is unclear"
          action: "Ask a clarifying question before proceeding"
        - condition: "requirements document is provided"
          action: "Proceed with full analysis"
        - condition: "no requirements document, verbal description only"
          action: "Extract requirements from conversation, confirm with user"
        - condition: "requirements conflict detected"
          action: "Highlight conflicts explicitly, ask user to resolve"
      boundaries:
        - skill: /mvt-design
          scope: architecture decisions
        - skill: /mvt-implement
          scope: implementation code

  - type: shared
    source: sections/activation-load-context.md
    params:
      extended_context:
        - ".ai-agents/knowledge/core/*"
        - ".ai-agents/workspace/artifacts/{change_id}/analysis.md (if exists)"
        - "Requirements documents provided by user"

  - type: shared
    source: sections/activation-load-config.md

  - type: shared
    source: sections/activation-preflight.md
    params:
      checks:
        - field: session.initialized_at
          empty_message: "Session not initialized. Run /mvt-init first."
          level: WARN
        - field: project.name
          empty_message: "Project not initialized."
          level: WARN

  - type: file
    source: ./business.md

  - type: inline
    content: |
      ## Output Format

      Read and use the output template from: `.ai-agents/skills/_templates/analyze-output.md`

      If a custom version exists at `.ai-agents/skills/_templates/custom/analyze-output.md`, use the custom version instead.

      Fill the template placeholders with the analysis results.

      Every response MUST end with a Suggested Next Steps section.

  - type: shared
    source: sections/footer-next-steps.md
    params:
      next_primary: mvt-design
      next_primary_desc: "Create architecture based on this analysis"
      next_alternatives:
        - skill: mvt-analyze
          when: "ambiguities remain, refine analysis"
      always_show:
        - skill: mvt-status
          desc: "View project status"
```

---

## 附录 B：共享 Section 模板示例

### B.1 activation-load-context.md

```markdown
## Activation Protocol

### Step 1: Load Context (Context Foundation)
Load the following files as foundational context:
- `.ai-agents/workspace/session.yaml` -- Current workflow state
- `.ai-agents/workspace/project-context.yaml` -- Project domain data

{{#extended_context}}
Extended context for this skill:
{{#extended_context}}
- {{.}}
{{/extended_context}}
{{/extended_context}}
```

### B.2 activation-load-config.md

```markdown
### Step 2: Load Config & Apply Preferences (Config Foundation)
Read `.ai-agents/config.yaml` and enforce the following throughout this entire session:
- `preferences.language` -> Use this language for ALL output (responses, artifact content, comments)
- `preferences.output.no_emojis` -> If true, never use emojis
- `preferences.output.data_format` -> Use this format for data sections in artifacts
```

### B.3 activation-preflight.md

```markdown
### Step 3: Pre-flight Checks
{{#checks}}
- If `{{field}}` is empty -> {{level}}: "{{empty_message}}"
{{/checks}}
```

### B.4 role-header.md

```markdown
## Role

You are the **{{role}}** -- {{role_desc}}.

### Decision Rules
{{#decision_rules}}
- If {{condition}} -> {{action}}
{{/decision_rules}}

### Boundaries
{{#boundaries}}
- Do NOT {{scope}} -> Suggest `{{skill}}`
{{/boundaries}}
```

### B.5 footer-next-steps.md

```markdown
## Suggested Next Steps
After completion, suggest:
- `/{{next_primary}}` -- {{next_primary_desc}}
{{#next_alternatives}}
- `/{{skill}}` -- {{when}}
{{/next_alternatives}}
{{#always_show}}
- `/{{skill}}` -- {{desc}}
{{/always_show}}
```

---

## 附录 C：现有 Skill 完整清单

以下 19 个 skill 需要从当前手写版本拆分为 source 层：

| # | Skill | Agent/Role | Category | Output Template | Phase |
|---|---|---|---|---|---|
| 1 | mvt-init | Conductor | project | init-output.md | - |
| 2 | mvt-status | Conductor | project | status-output.md | - |
| 3 | mvt-config | Conductor | project | config-output.md | - |
| 4 | mvt-sync-context | Conductor | project | sync-context-output.md | - |
| 5 | mvt-cleanup | Conductor | project | cleanup-output.md | - |
| 6 | mvt-analyze | Analyst | workflow | analyze-output.md | analyze |
| 7 | mvt-analyze-code | Analyst | workflow | analyze-code-output.md | - |
| 8 | mvt-design | Architect | workflow | design-output.md | design |
| 9 | mvt-implement | Developer | workflow | implement-output.md | implement |
| 10 | mvt-fix | Developer | shortcut | fix-output.md | - |
| 11 | mvt-refactor | Developer | shortcut | refactor-output.md | - |
| 12 | mvt-review | Reviewer | workflow | review-output.md | review |
| 13 | mvt-test | Tester | workflow | test-output.md | test |
| 14 | mvt-help | Conductor | utility | (inline) | - |
| 15 | mvt-create-skill | Conductor | utility | (inline) | - |
| 16 | mvt-add-context | Conductor | utility | (inline) | - |
| 17 | mvt-check-context | Conductor | utility | context-check-output.md | - |
| 18 | mvt-template | Conductor | utility | (inline) | - |

> **注意**：`mvt-update`（第 19 个）在 CLI 方案中**作废**，不纳入 source 层。最终 runtime 产物为 **18 个 skill**。

---

*文档版本：v1.0*
*编制日期：2026-04-28*
*状态：待审阅*
*前序文档：`docs/cli-migration-plan.md`（路线图）、`docs/architecture-analysis.md`（分析）*

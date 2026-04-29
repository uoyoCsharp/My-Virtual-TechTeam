# MVTT CLI 开发计划（3 Phase）

> **前序文档**：`docs/cli-architecture-design.md`（已审批）
>
> **包名**：`@uoyo/mvtt`
>
> **编制日期**：2026-04-28
>
> **原则**：每个 Phase 结束后都可独立验收，产出可运行的阶段性成果。Phase 之间存在依赖但不存在回溯——前一个 Phase 的产物是后一个 Phase 的输入。

---

## Phase 总览

| Phase | 名称 | 核心目标 | 产出物 | 预期验收标准 |
|---|---|---|---|---|
| **Phase 1** | 基础骨架 + Build 引擎 | CLI 工程脚手架就位 + assembler 能从 source 生成完整 markdown | `src/`、`sources/`（5 个代表性 skill）、build 引擎、snapshot 测试 | `npm run build` 通过；5 个 skill 的 assembler 输出与现有文件语义一致 |
| **Phase 2** | 全量拆分 + CLI 命令 | 18 个 skill 全部迁入 source 层 + install/update/doctor/uninstall 4 个命令可用 | 完整 `sources/`、4 个 CLI 命令、集成测试 | 空目录 `npx @uoyo/mvtt install` 得到完整 MVTT 结构 |
| **Phase 3** | 质量打磨 + 发布 | 测试覆盖、跨平台验证、npm 发布 | npm 包、README、旧文件清理 | `npx @uoyo/mvtt install` 在干净机器上可用 |

```
Phase 1                  Phase 2                    Phase 3
┌─────────────────┐     ┌──────────────────────┐   ┌─────────────────┐
│ 工程脚手架        │     │ 剩余 13 skill 拆分     │   │ 测试覆盖 >80%    │
│ Source 层设计     │     │ 14 template 拆分       │   │ Windows/macOS   │
│ 5 共享 section   │ ──→ │ knowledge 静态复制     │──→│ npm 发布         │
│ 5 代表 skill 拆分 │     │ install 命令           │   │ README 更新      │
│ Build 引擎       │     │ update 命令            │   │ 旧文件清理       │
│ Snapshot 测试    │     │ doctor 命令            │   │                 │
└─────────────────┘     │ uninstall 命令         │   └─────────────────┘
                        └──────────────────────┘
```

---

## Phase 1：基础骨架 + Build 引擎

### 目标

从零搭建 CLI 工程、设计 source 层结构、实现 build 引擎核心，并用 5 个代表性 skill 验证"source → 完整 markdown"的拼装流程可靠。

### 任务清单

#### 1.1 CLI 工程脚手架

| 任务 | 产出 | 说明 |
|---|---|---|
| 1.1.1 初始化 npm 包 | `package.json` | name: `@uoyo/mvtt`，type: module，bin: `./dist/index.js`，engines: node>=18 |
| 1.1.2 TypeScript 配置 | `tsconfig.json` + `tsconfig.build.json` | strict mode，target: ES2022，module: NodeNext |
| 1.1.3 bin 入口 | `src/index.ts` + `src/cli.ts` | 解析 `process.argv`，路由到 commands；暂时只注册 `build`（内部开发用命令） |
| 1.1.4 测试框架 | vitest 配置 | `vitest.config.ts`，支持 ESM |
| 1.1.5 .gitignore / .npmignore | 配置文件 | dist/ 在 .gitignore；src/ 在 .npmignore |
| 1.1.6 依赖安装 | `yaml`（runtime）+ `typescript`、`vitest`（dev） | 最小依赖原则 |

**验收**：`npm run build` 编译成功，`node dist/index.js --help` 输出帮助信息。

#### 1.2 Source 层目录结构

| 任务 | 产出 | 说明 |
|---|---|---|
| 1.2.1 创建 sources 目录骨架 | `sources/skills/`、`sources/sections/`、`sources/templates/`、`sources/defaults/` | 空目录结构 |
| 1.2.2 定义 manifest schema | `src/types/manifest.ts` | Manifest 接口：name、output、frontmatter、sections[] |
| 1.2.3 定义 registry types | `src/types/registry.ts` | SkillEntry 接口：agent、description、path、template、category、mode、phase、depends_on、next_suggestions |
| 1.2.4 创建 install-manifest.yaml | `install-manifest.yaml` | 三级分类：generated、create_once、user_data_dirs |
| 1.2.5 创建 defaults | `sources/defaults/config.yaml`、`session.yaml`、`project-context.yaml` | 从当前 `.ai-agents/` 中提取初始骨架版本 |

**验收**：目录结构就位，TypeScript 类型编译通过。

#### 1.3 提取 5 个共享 Section

从现有 19 个 skill 的 SKILL.md 中提取公共部分，参数化：

| # | Section 文件 | 提取来源 | 参数 |
|---|---|---|---|
| 1 | `sources/sections/activation-load-context.md` | 所有 skill 的 "Step 1: Load Context" | `extended_context: string[]` |
| 2 | `sources/sections/activation-load-config.md` | 所有 skill 的 "Step 2: Load Config" | 无（固定内容） |
| 3 | `sources/sections/activation-preflight.md` | 所有 skill 的 "Step 3: Pre-flight Checks" | `checks: {field, empty_message, level}[]` |
| 4 | `sources/sections/role-header.md` | 所有 skill 的 "Role" 段 | `role, role_desc, decision_rules[], boundaries[]` |
| 5 | `sources/sections/footer-next-steps.md` | 所有 skill 末尾的 "Suggested Next Steps" | `next_primary, next_primary_desc, next_alternatives[], always_show[]` |

**操作方式**：
1. 逐个对比 19 个 SKILL.md 中对应段落，找出完全相同的文本 → 固定内容
2. 找出 skill 间差异的部分 → 提取为 `{{param}}` 参数
3. 编写参数化模板，确保 assembler 替换后能还原每个 skill 的原始内容

**验收**：5 个 section 文件就位，参数命名清晰，有对应的 TypeScript 类型。

#### 1.4 拆分 5 个代表性 Skill

选择覆盖面最广的 5 个 skill 作为首批拆分对象：

| # | Skill | 选择原因 | 总行数 | 独有逻辑行数 |
|---|---|---|---|---|
| 1 | **mvt-analyze** | workflow 类代表；有 extended context；标准 Activation Protocol | ~100 | ~57 |
| 2 | **mvt-design** | 有 Variants；depends_on 非空；workflow 类 | ~112 | ~67 |
| 3 | **mvt-implement** | workflow 类；读 pattern knowledge；标准结构 | ~103 | ~58 |
| 4 | **mvt-init** | project 类代表；有 Variants；无 depends_on | ~123 | ~78 |
| 5 | **mvt-fix** | shortcut 类代表；无 phase；side effects | ~98 | ~55 |

**每个 skill 的拆分产出**：

```
sources/skills/mvt-analyze/
├── manifest.yaml          # 拼装声明（引用 5 个共享 section + 1 个 file section）
└── business.md            # Execution Flow / Variants / 独有逻辑
```

**拆分步骤**（每个 skill）：
1. 将现有 SKILL.md 中的 Activation Protocol（Step 1-3）替换为 manifest 中的 shared section 引用
2. 将 Role 段替换为 `role-header.md` 引用 + params
3. 将 Suggested Next Steps 替换为 `footer-next-steps.md` 引用 + params
4. 将 Purpose 段 + Output Format 段作为 inline section
5. 将 Execution Flow 及其余独有内容提取到 `business.md`
6. 编写 `manifest.yaml`

**验收**：每个 skill 有 manifest.yaml + business.md，manifest 中的 section 引用全部可解析。

#### 1.5 Build 引擎实现

| 任务 | 文件 | 说明 |
|---|---|---|
| 1.5.1 section-loader | `src/build/section-loader.ts` | 按 4 种 type 加载内容；`{{var}}` 简单替换；`{{#list}}...{{/list}}` 块展开 |
| 1.5.2 assembler | `src/build/assembler.ts` | 读 manifest → 逐 section 加载 → 拼接 frontmatter + GENERATED 头 + sections |
| 1.5.3 validator | `src/build/validator.ts` | manifest schema 校验 + section 文件存在性 + 参数完整性 |
| 1.5.4 build 命令 | `src/commands/build.ts` | 遍历 `sources/skills/*/manifest.yaml`，逐个 assemble 输出到目标路径 |
| 1.5.5 GENERATED 头生成 | assembler 内置 | `<!-- GENERATED by mvtt vX.Y.Z @ ISO-timestamp. Manual edits will be overwritten. -->` |

**参数替换实现规则**：

```
简单变量：{{variable}} → 直接替换为字符串值
块变量：  {{#items}}...{{field}}...{{/items}} → 对数组中每项展开模板
条件块：  {{#variable}}...{{/variable}} → 当 variable 非空/非假时保留内容
```

> 不实现完整 Mustache——只需要上述 3 种语法覆盖所有 section 的参数化需求。

**验收**：`node dist/index.js build` 能将 5 个 skill 的 source 拼装为完整的 SKILL.md。

#### 1.6 Snapshot 测试

| 任务 | 文件 | 说明 |
|---|---|---|
| 1.6.1 建立 baseline | `test/fixtures/expected/` | 将现有 5 个 SKILL.md **原样复制**到 expected/ 作为参照 |
| 1.6.2 编写 snapshot 测试 | `test/assembler.test.ts` | 对每个 skill：build 产出 vs expected 文件对比（忽略 GENERATED 头的时间戳） |
| 1.6.3 section-loader 单元测试 | `test/section-loader.test.ts` | 简单替换、块展开、条件块、缺失参数报错 |
| 1.6.4 validator 单元测试 | `test/validator.test.ts` | 缺少必填字段、引用不存在的文件、参数缺失 |

**snapshot 对比策略**：
- 忽略首行 GENERATED 标记（时间戳会变）
- 忽略 frontmatter 中的 description（原文可能有微调）
- **核心比对**：Activation Protocol 段、Role 段、Execution Flow 段、Output Format 段、Suggested Next Steps 段的**语义等价**

**验收**：`npm test` 全部通过。

---

### Phase 1 完成标志（里程碑 M1）

| 检查项 | 标准 |
|---|---|
| `npm run build` | TypeScript 编译成功，零错误 |
| `node dist/index.js build` | 5 个 skill 的 SKILL.md 成功生成 |
| snapshot 测试 | 生成结果与现有文件语义一致 |
| section-loader 测试 | 3 种参数替换语法全部覆盖 |
| 目录结构 | `src/`、`sources/`、`test/` 结构符合架构设计文档 |

---

## Phase 2：全量拆分 + CLI 命令

### 目标

将剩余 13 个 skill + 14 个 output template 全部迁入 source 层；实现 install / update / doctor / uninstall 4 个 CLI 命令；在临时目录中完成端到端集成测试。

### 前置条件

Phase 1 完成：build 引擎可用，5 个 section 模板已验证。

### 任务清单

#### 2.1 剩余 13 个 Skill 拆分

按复杂度分 3 批推进，每批完成后运行 snapshot 测试确认：

**第 1 批（workflow 类，5 个）**：

| Skill | 行数 | 说明 |
|---|---|---|
| mvt-review | ~131 | 有 Variants；读 pattern knowledge |
| mvt-test | ~126 | 有 Variants；读 coding standards |
| mvt-analyze-code | ~105 | 独立模式；读源码分析 |
| mvt-refactor | ~122 | shortcut 类；无 phase |
| mvt-sync-context | ~91 | project 类；独立模式 |

**第 2 批（project/utility 类，5 个）**：

| Skill | 行数 | 说明 |
|---|---|---|
| mvt-status | ~83 | 读 registry 动态生成 |
| mvt-config | ~118 | 有 Variants |
| mvt-cleanup | ~108 | 有 Variants |
| mvt-help | ~129 | 读 registry 动态生成 |
| mvt-check-context | ~106 | utility |

**第 3 批（utility/特殊，3 个）**：

| Skill | 行数 | 说明 |
|---|---|---|
| mvt-create-skill | ~182 | 最大的 skill；scaffold 逻辑 |
| mvt-add-context | ~124 | 交互式引导 |
| mvt-template | ~113 | 模板管理 |

> **mvt-update 不拆分**——该 skill 在 CLI 方案中作废，不纳入 source 层。最终产物为 **18 个 skill**。

**每批操作**：
1. 为每个 skill 编写 `manifest.yaml` + `business.md`
2. 运行 `build` 生成 SKILL.md
3. 将现有 SKILL.md 复制到 `test/fixtures/expected/` 作为 baseline
4. 运行 snapshot 测试确认语义一致
5. 全部通过后进入下一批

**验收**：18 个 skill 全部可 build，全部 snapshot 测试通过。

#### 2.2 14 个 Output Template 拆分

| # | Template | 对应 Skill |
|---|---|---|
| 1 | analyze-output.md | mvt-analyze |
| 2 | analyze-code-output.md | mvt-analyze-code |
| 3 | design-output.md | mvt-design |
| 4 | implement-output.md | mvt-implement |
| 5 | fix-output.md | mvt-fix |
| 6 | refactor-output.md | mvt-refactor |
| 7 | review-output.md | mvt-review |
| 8 | test-output.md | mvt-test |
| 9 | init-output.md | mvt-init |
| 10 | status-output.md | mvt-status |
| 11 | config-output.md | mvt-config |
| 12 | cleanup-output.md | mvt-cleanup |
| 13 | sync-context-output.md | mvt-sync-context |
| 14 | context-check-output.md | mvt-check-context |

> `update-framework-output.md` 作废，不迁入。

**每个 template 的拆分产出**：

```
sources/templates/analyze-output/
├── manifest.yaml
└── body.md
```

template 的 manifest 结构与 skill 类似，但更简单——大部分 template 只有 body + footer 两个 section。footer 引用 `sections/footer-next-steps.md` 共享 section。

**验收**：14 个 template 全部可 build，生成结果与现有文件一致。

#### 2.3 Registry v2 + Knowledge 静态复制

| 任务 | 产出 | 说明 |
|---|---|---|
| 2.3.1 编写 registry.yaml v2 | 根目录 `registry.yaml` | 从当前 `.ai-agents/registry.yaml` 迁移并扩展：增加 phase、depends_on、next_suggestions 字段 |
| 2.3.2 Knowledge 文件归位 | `sources/knowledge/core/`、`sources/knowledge/patterns/` | 从 `.ai-agents/knowledge/core/` 和 `patterns/` 复制；install 时原样复制到用户项目 |

**当前 knowledge 文件清单**：

```
knowledge/core/
├── manifest.yaml
└── review-principles.md

knowledge/patterns/
├── manifest.yaml
├── clean-architecture/
│   ├── manifest.yaml
│   └── review-checklist.md
├── ddd/
│   ├── manifest.yaml
│   ├── review-checklist.md
│   └── tactical-patterns.md
└── frontend-react/
    ├── manifest.yaml
    └── review-checklist.md
```

Knowledge 文件不需要 build——直接作为静态文件复制到用户项目。在 `install-manifest.yaml` 中标记为 `generated`（CLI 托管）。

**验收**：registry v2 可被 TypeScript 类型正确解析；knowledge 文件在 sources/ 中就位。

#### 2.4 install 命令

| 任务 | 文件 | 说明 |
|---|---|---|
| 2.4.1 install 命令主逻辑 | `src/commands/install.ts` | 流程见架构设计文档 5.2 节 |
| 2.4.2 文件保护逻辑 | `src/fs/protection.ts` | 读 install-manifest.yaml，判断文件分类 |
| 2.4.3 hash 计算 | `src/fs/hash.ts` | SHA-256，Node.js crypto |
| 2.4.4 .mvtt-manifest.json 写入 | install 命令内 | 记录版本、时间、文件 hash |
| 2.4.5 --pattern 选项 | install 命令内 | 设置 config.yaml 的 pattern.active |

**install 流程**：
1. 检查 `.ai-agents/.mvtt-manifest.json` 是否存在 → 已存在则提示用 `update`
2. 运行 build 引擎生成所有 SKILL.md 和 template 到内存
3. 写入 GENERATED 文件（18 SKILL.md + 14 template + registry + knowledge）
4. 创建 CREATE_ONCE 文件（config.yaml + session.yaml + project-context.yaml）
5. 创建 USER DATA 目录（artifacts/ + custom/ + principle/ + project/）
6. 写入 `.ai-agents/.mvtt-manifest.json`
7. 输出安装摘要

**验收**：空目录执行 `node dist/index.js install` 后，目录结构与架构设计文档 6.1 节完全一致。

#### 2.5 update 命令

| 任务 | 文件 | 说明 |
|---|---|---|
| 2.5.1 update 命令主逻辑 | `src/commands/update.ts` | 流程见架构设计文档 5.3 节 |
| 2.5.2 hash 对比检测 | update 命令内 | 对比当前文件 hash vs manifest 记录，检测用户手改 |
| 2.5.3 --check 只读模式 | update 命令内 | 输出差异摘要但不修改 |

**验收**：安装后修改一个 GENERATED 文件 → update 时警告 → 确认后覆盖 → USER DATA 不变。

#### 2.6 doctor 命令

| 任务 | 文件 | 说明 |
|---|---|---|
| 2.6.1 doctor 命令主逻辑 | `src/commands/doctor.ts` | 流程见架构设计文档 5.4 节 |
| 2.6.2 检查项实现 | doctor 命令内 | manifest 存在、文件完整性、hash 匹配、目录结构、config 格式 |

**验收**：手改 GENERATED 文件后 `doctor` 输出 `[WARN]`；正常安装后全 `[PASS]`。

#### 2.7 uninstall 命令

| 任务 | 文件 | 说明 |
|---|---|---|
| 2.7.1 uninstall 命令主逻辑 | `src/commands/uninstall.ts` | 流程见架构设计文档 5.5 节 |
| 2.7.2 确认提示 | uninstall 命令内 | 列出将删除的文件，stdin 确认 |

**验收**：uninstall 后 GENERATED 文件全部删除，USER DATA（workspace/、custom/、config.yaml 等）完整保留。

#### 2.8 集成测试

| 任务 | 文件 | 说明 |
|---|---|---|
| 2.8.1 install 集成测试 | `test/commands/install.test.ts` | 在 tmp 目录执行 install，验证目录结构和文件内容 |
| 2.8.2 update 集成测试 | `test/commands/update.test.ts` | install → 修改 GENERATED → update → 验证覆盖 + USER DATA 不变 |
| 2.8.3 doctor 集成测试 | `test/commands/doctor.test.ts` | install → doctor(PASS) → 手改文件 → doctor(WARN) |
| 2.8.4 uninstall 集成测试 | `test/commands/uninstall.test.ts` | install → uninstall → 验证 GENERATED 删除 + USER DATA 保留 |

**验收**：`npm test` 全部通过（包含 Phase 1 的 snapshot 测试 + Phase 2 的集成测试）。

---

### Phase 2 完成标志（里程碑 M2-M5）

| 里程碑 | 检查项 | 标准 |
|---|---|---|
| **M2** | 全量 Build | 18 个 skill + 14 个 template 全部 snapshot 测试通过 |
| **M3** | Install 可用 | 空目录 install 后目录结构完整，所有文件内容正确 |
| **M4** | Update 可用 | install v2.0.0 → update → GENERATED 更新、USER DATA 无损 |
| **M5** | Doctor 可用 | 手改 GENERATED 文件后 doctor 能检测到 |

---

## Phase 3：质量打磨 + 发布

### 目标

补全测试覆盖率、确保跨平台兼容、发布 npm 包、更新文档、清理旧文件。

### 前置条件

Phase 2 完成：4 个 CLI 命令可用，集成测试通过。

### 任务清单

#### 3.1 测试覆盖率补全

| 任务 | 说明 |
|---|---|
| 3.1.1 配置 coverage | vitest coverage 配置，目标 >80% |
| 3.1.2 补全 edge case 测试 | 空 manifest、无效 YAML、缺失 section 文件、损坏的 .mvtt-manifest.json |
| 3.1.3 补全 CLI 参数测试 | 无效命令、缺少参数、--help、--version |
| 3.1.4 error path 测试 | install 时目录无写权限、update 时 manifest 缺失、doctor 在未安装项目运行 |

**验收**：`npm test -- --coverage` 报告 >80%。

#### 3.2 跨平台兼容

| 任务 | 说明 |
|---|---|
| 3.2.1 路径兼容审查 | 全局搜索硬编码 `/`，确保全部使用 `path.join` / `path.resolve` |
| 3.2.2 Windows 测试 | 在当前 Windows 11 环境运行完整测试套件 |
| 3.2.3 换行符处理 | 生成文件统一使用 `\n`（LF），配置 `.gitattributes` |
| 3.2.4 长路径处理 | 确保深层嵌套路径（如 `knowledge/patterns/clean-architecture/review-checklist.md`）在 Windows 上正常 |

**验收**：Windows 上 `npm test` 全部通过。

#### 3.3 CLI 体验打磨

| 任务 | 说明 |
|---|---|
| 3.3.1 彩色输出 | install/update/doctor/uninstall 的终端输出加颜色（用 ANSI escape，不加依赖） |
| 3.3.2 --version 命令 | 从 package.json 读取版本号 |
| 3.3.3 --help 输出 | 每个命令的帮助文本 |
| 3.3.4 错误信息友好化 | 所有 user-facing 错误信息提供清晰原因 + 建议操作 |
| 3.3.5 Node 版本检查 | 入口处检查 `process.version >= 18`，不符合时提示升级 |

**验收**：`npx @uoyo/mvtt --help` 输出清晰的命令列表和用法。

#### 3.4 npm 发布准备

| 任务 | 说明 |
|---|---|
| 3.4.1 注册 @uoyo scope | 在 npmjs.com 注册 `@uoyo` organization |
| 3.4.2 .npmignore 最终审查 | 确保 npm 包只包含 `dist/`、`sources/`、`registry.yaml`、`install-manifest.yaml` |
| 3.4.3 prepublishOnly 脚本 | `npm run build && npm test` |
| 3.4.4 package.json files 字段 | 确认白名单：`["dist/", "sources/", "registry.yaml", "install-manifest.yaml"]` |
| 3.4.5 试发布 | `npm publish --dry-run` 检查包内容和大小 |
| 3.4.6 正式发布 | `npm publish --access public` |

**验收**：`npx @uoyo/mvtt install` 在全新机器/目录上可用。

#### 3.5 文档更新

| 任务 | 说明 |
|---|---|
| 3.5.1 README 更新 | `README - About MVTT .md` 更新安装方式为 `npx @uoyo/mvtt install` |
| 3.5.2 源仓库贡献指南 | 简要说明如何修改 source、如何 build、如何测试 |

#### 3.6 旧文件清理

| 文件/目录 | 操作 |
|---|---|
| `.ai-agents/scripts/update_framework.py` | 删除 |
| `.ai-agents/scripts/requirements.txt` | 删除 |
| `.ai-agents/scripts/`（如果空了） | 删除目录 |
| `.claude/skills/mvt-update/` | 删除整个目录 |
| `.ai-agents/skills/_templates/_manifest.yaml` | 删除 |
| `.ai-agents/skills/_templates/update-framework-output.md` | 删除 |
| `docs/change-plan.md` | 标记归档或删除（已被 cli-migration-plan.md 替代） |

**注意**：旧文件清理在 npm 发布成功**之后**执行，确保有回退路径。

---

### Phase 3 完成标志（里程碑 M6）

| 检查项 | 标准 |
|---|---|
| 测试覆盖率 | >80% |
| Windows 测试 | 全部通过 |
| npm publish | `@uoyo/mvtt` 在 npmjs.com 可见 |
| npx 安装 | 全新目录 `npx @uoyo/mvtt install` 成功 |
| 旧文件清理 | 6 个废弃文件/目录已删除 |
| README | 安装方式已更新 |

---

## 附录：文件产出全景

### Phase 1 新增文件

```
package.json
tsconfig.json
tsconfig.build.json
vitest.config.ts
.npmignore
install-manifest.yaml
src/
├── index.ts
├── cli.ts
├── commands/
│   └── build.ts
├── build/
│   ├── assembler.ts
│   ├── section-loader.ts
│   └── validator.ts
├── fs/
│   └── hash.ts
└── types/
    ├── manifest.ts
    └── registry.ts
sources/
├── sections/
│   ├── activation-load-context.md
│   ├── activation-load-config.md
│   ├── activation-preflight.md
│   ├── role-header.md
│   └── footer-next-steps.md
├── skills/
│   ├── mvt-analyze/    (manifest.yaml + business.md)
│   ├── mvt-design/     (manifest.yaml + business.md)
│   ├── mvt-implement/  (manifest.yaml + business.md)
│   ├── mvt-init/       (manifest.yaml + business.md)
│   └── mvt-fix/        (manifest.yaml + business.md)
├── templates/          (空，Phase 2 填充)
└── defaults/
    ├── config.yaml
    ├── session.yaml
    └── project-context.yaml
test/
├── assembler.test.ts
├── section-loader.test.ts
├── validator.test.ts
└── fixtures/
    └── expected/       (5 个 SKILL.md baseline)
```

### Phase 2 新增/修改文件

```
registry.yaml (v2, 根目录)
src/commands/
├── install.ts
├── update.ts
├── doctor.ts
└── uninstall.ts
src/fs/
└── protection.ts
sources/skills/
├── mvt-review/         (manifest.yaml + business.md)
├── mvt-test/           (manifest.yaml + business.md)
├── mvt-analyze-code/   (manifest.yaml + business.md)
├── mvt-refactor/       (manifest.yaml + business.md)
├── mvt-sync-context/   (manifest.yaml + business.md)
├── mvt-status/         (manifest.yaml + business.md)
├── mvt-config/         (manifest.yaml + business.md)
├── mvt-cleanup/        (manifest.yaml + business.md)
├── mvt-help/           (manifest.yaml + business.md)
├── mvt-check-context/  (manifest.yaml + business.md)
├── mvt-create-skill/   (manifest.yaml + business.md)
├── mvt-add-context/    (manifest.yaml + business.md)
└── mvt-template/       (manifest.yaml + business.md)
sources/templates/
├── analyze-output/     (manifest.yaml + body.md) x14
└── ...
sources/knowledge/
├── core/               (从 .ai-agents/knowledge/core/ 复制)
└── patterns/           (从 .ai-agents/knowledge/patterns/ 复制)
test/commands/
├── install.test.ts
├── update.test.ts
├── doctor.test.ts
└── uninstall.test.ts
test/fixtures/expected/  (+13 个 SKILL.md baseline + 14 个 template baseline)
```

### Phase 3 修改/删除文件

```
修改：
  README - About MVTT .md (安装方式更新)
  package.json (final version for publish)
  .gitattributes (新增，LF 换行)

删除：
  .ai-agents/scripts/update_framework.py
  .ai-agents/scripts/requirements.txt
  .ai-agents/scripts/ (目录)
  .claude/skills/mvt-update/ (目录)
  .ai-agents/skills/_templates/_manifest.yaml
  .ai-agents/skills/_templates/update-framework-output.md
```

---

*文档版本：v1.0*
*编制日期：2026-04-28*
*前序文档：`docs/cli-architecture-design.md`（已审批）*

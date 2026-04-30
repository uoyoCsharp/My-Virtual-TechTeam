# MVTT Developer Guide

> **读者对象**：第一次接触 MVTT 代码库、需要修改 skill 内容、调整共享 section、增加新 CLI 命令、或对整个构建流程做改动的开发者。
>
> **前置知识**：TypeScript 基础、Node.js >= 18、Git。
>
> **前序文档**：
> - [cli-architecture-design.md](./cli-architecture-design.md) — 架构设计（权威）
> - [cli-migration-plan.md](./cli-migration-plan.md) — 为什么选择 CLI 方案
> - [architecture-analysis.md](./architecture-analysis.md) — 历史问题分析

---

## 目录

- [一、30 秒心智模型](#一30-秒心智模型)
- [二、环境准备](#二环境准备)
- [三、目录结构导读](#三目录结构导读)
- [四、构建管线：从 Source 到 Runtime](#四构建管线从-source-到-runtime)
- [五、常见开发场景](#五常见开发场景)
- [六、Manifest 与 Section 参考](#六manifest-与-section-参考)
- [七、CLI 命令内部原理](#七cli-命令内部原理)
- [八、测试指南](#八测试指南)
- [九、发布流程](#九发布流程)
- [十、排错手册](#十排错手册)
- [十一、代码风格与约束](#十一代码风格与约束)
- [十二、常见问题（FAQ）](#十二常见问题faq)

---

## 一、30 秒心智模型

MVTT 有两个层次，**不要把它们混在一起**：

### 1. Runtime（用户项目）
当 Claude Code 用户装了 MVTT 后，他们项目里有 18 个 `SKILL.md` 文件。Claude 在加载这些 skill 时，每个都是**完全自包含的扁平 markdown**，没有任何引用/include。

### 2. Source（本仓库）
为了让开发者不用复制粘贴 18 份重复的 Activation Protocol，我们用 "manifest + shared section" 的方式在**源代码层维护 DRY**。`mvtt build` 把 source 展平成 runtime 产物。

```
┌─────────────────────┐         ┌─────────────────────┐
│  Source (DRY)       │──build─>│  Runtime (Flat)     │
│                     │         │                     │
│  sources/           │         │  .claude/skills/    │
│  ├── skills/        │         │  └── mvt-*/SKILL.md │
│  ├── sections/      │         │                     │
│  ├── templates/     │         │  .ai-agents/        │
│  ├── knowledge/     │         │  └── skills/        │
│  └── defaults/      │         │      └── _templates/│
│                     │         │                     │
│  registry.yaml      │         │                     │
│  install-manifest   │         │                     │
└─────────────────────┘         └─────────────────────┘
```

**核心规则：Runtime 永远是 flat，不允许引用外部文件。** Source 层的 DRY 是给开发者看的，不是给 AI 看的。

---

## 二、环境准备

### 系统要求

| 工具 | 版本 |
|---|---|
| Node.js | >= 18.0.0（建议 LTS） |
| npm | 随 Node 自带 |
| Git | 任意近代版本 |

### 克隆与安装

```bash
git clone <repo-url>
cd My-Virtual-TechTeam
npm install
```

### 首次编译与验证

```bash
npm run build          # TypeScript → dist/
npm test               # 运行 64 个测试
node dist/index.js --help
```

如果 `npm test` 全绿，你的环境就绪了。

### 快速看一眼产物

```bash
# 把 source 构建到临时目录（不触碰仓库内的 .claude/.ai-agents）
node dist/index.js build --out .build-test

# 看一个生成后的 skill 文件
cat .build-test/.claude/skills/mvt-analyze/SKILL.md

# 清理
rm -rf .build-test
```

### 本地调试 CLI：`npm link`（推荐）

当你想在本地测试 `mvtt install` / `mvtt update` / `mvtt doctor` 等命令的真实调用体验（和用户通过 `npx @uoyo/mvtt` 使用时一致），用 `npm link` 把本地仓库注册为全局 CLI：

```bash
# 1. 在 MVTT 仓库根目录执行一次
cd /path/to/My-Virtual-TechTeam
npm run build        # 必须先 build，link 的是 dist/index.js
npm link             # 全局注册为 @uoyo/mvtt

# 2. 之后在任何目录都能直接用 mvtt 命令
cd /tmp && mkdir test-proj && cd test-proj
mvtt install
mvtt doctor
mvtt uninstall --yes

# 3. 用完后解除链接
cd /path/to/My-Virtual-TechTeam
npm unlink -g @uoyo/mvtt
```

**关键点**：
- `npm link` 创建的是符号链接，**改了 source 必须重新 `npm run build`** 才生效（因为 bin 指向 `dist/index.js`）
- 调试循环可以简化为：`vi src/... && npm run build && mvtt <command>`（无需每次 link/unlink）
- Windows 下如果报权限错误，在 PowerShell 里以管理员身份运行 `npm link`

**何时用这个而不是直接 `node dist/index.js`**：
- 想验证 bin 入口、Node 版本检查、`process.argv` 解析在真实调用场景下的行为
- 想和"用户实际体验"（`npx @uoyo/mvtt ...`）完全一致
- 不想在测试目录之间切换时反复输入绝对路径

**替代方式对比**：

| 场景 | 方式 |
|---|---|
| 秒级验证 build 产物 | `node dist/index.js build --out .build-test` |
| 调试 CLI 命令调用 | `npm link` + `mvtt <command>` |
| 发布前冷启动验证 | `npm pack` + 在空目录 `npm install <tgz>` |
| 验证 prompt 在 Claude Code 的真实行为 | `mvtt install` 到测试项目，在 Claude Code 打开 |

---

## 三、目录结构导读

### 根目录

```
My-Virtual-TechTeam/
├── package.json              # npm 包定义，bin: mvtt
├── tsconfig.json             # TS 配置（开发）
├── tsconfig.build.json       # TS 配置（发布，排除测试）
├── vitest.config.ts          # 测试 + coverage 配置
├── registry.yaml             # 🔑 skill 元数据单一源
├── install-manifest.yaml     # 🔑 文件分类规则（GENERATED/CREATE_ONCE/USER_DATA）
│
├── src/                      # TypeScript 源码（见下节）
├── sources/                  # skill/template/section 内容源（见下节）
├── test/                     # vitest 测试（见 §八）
├── docs/                     # 设计与开发文档
├── dist/                     # 编译产物（.gitignore）
│
└── .ai-agents/ + .claude/    # 本仓库自己用 MVTT 时的 runtime（非源）
```

### `src/` — CLI 实现

```
src/
├── index.ts                  # bin 入口（检查 Node 版本，调用 cli.ts）
├── cli.ts                    # 命令路由器
│
├── commands/
│   ├── build.ts              # build（开发用）
│   ├── install.ts            # 首次安装
│   ├── update.ts             # 增量更新
│   ├── doctor.ts             # 健康检查
│   ├── uninstall.ts          # 卸载
│   └── shared.ts             # 命令间共享（re-export util/package）
│
├── build/                    # Source → Runtime 引擎
│   ├── assembler.ts          # manifest → 完整 markdown
│   ├── section-loader.ts     # 4 类 section 加载 + 参数替换
│   └── validator.ts          # manifest schema + 引用 + 参数完整性校验
│
├── fs/                       # 文件系统相关
│   ├── materialize.ts        # 🔑 把 build 产物写入用户项目（install/update 共用）
│   ├── install-manifest.ts   # .mvtt-manifest.json 读写
│   └── hash.ts               # SHA-256 哈希
│
├── types/                    # TypeScript 类型定义
│   ├── manifest.ts           # Manifest / Section 类型
│   └── registry.ts           # Registry 类型
│
└── util/
    ├── package.ts            # 读取 package.json version / root
    └── color.ts              # ANSI 终端彩色输出（TTY 检测）
```

### `sources/` — 内容源

```
sources/
├── defaults/                 # install 时首次创建的用户文件
│   ├── config.yaml
│   ├── session.yaml
│   └── project-context.yaml
│
├── sections/                 # 🔑 跨 skill 共享的 5 个模板
│   ├── activation-load-context.md
│   ├── activation-load-config.md
│   ├── activation-preflight.md
│   ├── role-header.md
│   └── footer-next-steps.md
│
├── skills/                   # 18 个 skill
│   └── mvt-<name>/
│       ├── manifest.yaml     # 声明由哪些 section 拼成
│       └── business.md       # 该 skill 独有的业务逻辑
│
├── templates/                # 14 个输出模板
│   └── <name>-output/
│       ├── manifest.yaml
│       └── body.md
│
└── knowledge/                # 静态复制到用户项目
    ├── core/
    └── patterns/
        ├── ddd/
        ├── clean-architecture/
        └── frontend-react/
```

---

## 四、构建管线：从 Source 到 Runtime

### 单个 skill 的生成流程

以 `mvt-analyze` 为例：

```
sources/skills/mvt-analyze/manifest.yaml
  │
  │ 声明 sections: [inline, shared(role-header), shared(activation-*), file(business.md), ...]
  │
  ▼
src/build/assembler.ts  ┐
                        ├─→ 读 manifest.yaml
                        ├─→ 逐 section 调用 loadSection()
                        │    ├── inline:   直接用 content 字段
                        │    ├── file:     读相对于 skillDir 的文件
                        │    └── shared:   读 sources/<source> + applyParams()
                        ├─→ 拼接 frontmatter + GENERATED 头 + sections
                        ▼
.claude/skills/mvt-analyze/SKILL.md（自包含扁平 markdown）
```

### 参数替换规则（`section-loader.ts`）

支持 3 种语法，以 Mustache 子集实现：

| 语法 | 含义 | 示例 |
|---|---|---|
| `{{var}}` | 简单变量替换 | `{{role}}` → `"Analyst"` |
| `{{#list}}...{{/list}}` | 数组迭代；块内可用 `{{field}}` 或 `{{.}}` | 见下例 |
| `{{#flag}}...{{/flag}}` | 条件块；flag 缺失或 false 时整块消失 | 见下例 |

**数组迭代示例**：

模板 `role-header.md`：
```markdown
### Decision Rules
{{#decision_rules}}
- {{rule}}
{{/decision_rules}}
```

Manifest 中传参：
```yaml
params:
  decision_rules:
    - rule: "Clear input -> Proceed"
    - rule: "Ambiguity -> Ask"
```

**关键实现细节**：
- 数组迭代后每项之间用 `\n` 拼接，块尾的 `\n` 被消费掉（避免空行堆积）
- 条件块缺失时整块消失，也消费尾部 `\n`
- 缺失的 `{{var}}` 替换为空字符串（不报错）——但 validator 会在 build 前拦住

### Validator 做什么

`src/build/validator.ts` 在 build 前检查：

1. manifest 必填字段（`name`、`output`、`sections`）
2. 每个 section 的 `source` 文件是否存在
3. **简单变量**（不在块内的 `{{var}}`）是否都在 `params` 中声明
4. 块变量（`{{#flag}}`）缺失时**不报错**——因为它们表示"可选展开"

---

## 五、常见开发场景

### 场景 1：修改某个 skill 的业务逻辑

例如改 `mvt-analyze` 的 Execution Flow：

```bash
# 1. 编辑业务文件
vi sources/skills/mvt-analyze/business.md

# 2. 构建并肉眼检查
npm run build
node dist/index.js build --out .build-test
diff .build-test/.claude/skills/mvt-analyze/SKILL.md .claude/skills/mvt-analyze/SKILL.md

# 3. 测试
npm test
```

> **注意**：`.claude/skills/mvt-analyze/SKILL.md` 是本仓库自己用的 runtime 产物。改 source 后不会自动重建到本仓库的 `.claude/` —— 如果想刷新本仓库的 runtime：
> ```bash
> node dist/index.js build --out .
> ```

### 场景 2：新增一个共享 section

例如增加 `activation-validate-artifacts.md`：

```bash
# 1. 创建 section 模板
cat > sources/sections/activation-validate-artifacts.md <<'EOF'
### Step 3.5: Validate Artifacts
{{#artifacts}}
- Must exist: `{{path}}`
{{/artifacts}}
EOF

# 2. 在需要使用的 skill manifest 里引用
#    sources/skills/mvt-<name>/manifest.yaml 的 sections 数组里加：
#    - type: shared
#      source: sections/activation-validate-artifacts.md
#      params:
#        artifacts:
#          - path: "workspace/..."

# 3. 构建验证
npm run build && npm test
```

### 场景 3：新增一个 skill

例如 `mvt-deploy`：

```bash
# 1. 创建 source 目录
mkdir -p sources/skills/mvt-deploy

# 2. 写 manifest.yaml（照着 mvt-fix 抄一份当骨架）
cp sources/skills/mvt-fix/manifest.yaml sources/skills/mvt-deploy/manifest.yaml
cp sources/skills/mvt-fix/business.md sources/skills/mvt-deploy/business.md

# 3. 修改 manifest 里的 name / output / frontmatter / params
vi sources/skills/mvt-deploy/manifest.yaml
#    改掉 name: mvt-deploy
#    改掉 output: .claude/skills/mvt-deploy/SKILL.md
#    改掉 frontmatter.name / description
#    调整 role / decision_rules / next_suggestions

# 4. 写独有业务逻辑
vi sources/skills/mvt-deploy/business.md

# 5. 在 registry.yaml 新增一条
vi registry.yaml
# 追加：
#   mvt-deploy:
#     agent: developer
#     description: "..."
#     path: .claude/skills/mvt-deploy/SKILL.md
#     template: null
#     category: shortcut
#     ...

# 6. 如果需要输出模板，在 sources/templates/ 创建 <name>-output/

# 7. 构建 + 测试
npm run build && npm test
```

### 场景 4：新增一个 CLI 命令

例如 `mvtt diff`（对比当前状态与产物）：

```bash
# 1. 实现命令
cat > src/commands/diff.ts <<'EOF'
export function diffCommand(args: string[]): void {
  // 参照 doctor.ts 的模式
}
EOF

# 2. 在 cli.ts 注册
vi src/cli.ts
# 在 COMMANDS 对象里加：diff: diffCommand
# 在 printHelp() 的命令列表里加一行

# 3. 写测试（test/cli.test.ts 增加一个 describe 块）

# 4. 构建 + 测试
npm run build && npm test
```

### 场景 5：修改所有 skill 共有的 Activation Protocol

共享 section 在 `sources/sections/` 下。改一处，所有 skill 自动继承：

```bash
vi sources/sections/activation-load-config.md
npm run build
npm test
```

**无需**手动修改 18 个 SKILL.md —— 这正是 CLI 方案的核心价值。

### 场景 6：修改文件保护规则

例如新增一个 GENERATED 目录：

```bash
# 1. 在 install-manifest.yaml 新增条目
vi install-manifest.yaml

# 2. 如果需要 CLI 特殊处理，改 src/fs/materialize.ts

# 3. 跑测试确认旧行为没被破坏
npm test
```

---

## 六、Manifest 与 Section 参考

### Skill Manifest 完整结构

```yaml
name: mvt-<name>                                    # skill ID
output: .claude/skills/mvt-<name>/SKILL.md          # 生成到用户项目的路径

frontmatter:                                         # 写入 SKILL.md 顶部的 YAML frontmatter
  name: mvt-<name>
  description: "..."                                 # Claude Code 用这个做 skill 触发匹配

sections:                                            # 按顺序拼接
  - type: inline
    content: |
      # Title
      Body text here.

  - type: shared                                     # 引用 sources/sections/ 下的文件
    source: sections/role-header.md
    params:                                          # 参数替换
      role: Analyst
      role_desc: "..."
      decision_rules:                                # 数组参数
        - rule: "..."
      boundaries:
        - scope: "..."
          skill: "/mvt-..."

  - type: file                                       # 引用本 skill 目录下的文件
    source: ./business.md

  - type: template                                   # shared 的别名（语义化区分）
    source: sections/footer-next-steps.md
    params: { ... }
```

### Template Manifest（更简单）

```yaml
name: <name>-output
output: .ai-agents/skills/_templates/<name>-output.md

frontmatter:
  id: <name>-output
  version: "1.0"
  skill: mvt-<name>

sections:
  - type: file
    source: ./body.md
```

### 5 个共享 Section 的参数契约

| Section | 必填简单变量 | 可选块变量 |
|---|---|---|
| `activation-load-context.md` | — | `extended_context: string[]` |
| `activation-load-config.md` | — | — |
| `activation-preflight.md` | — | `checks: [{order, field, level, message}]` |
| `role-header.md` | `role`, `role_desc` | `decision_rules: [{rule}]`, `boundaries: [{scope, skill}]` |
| `footer-next-steps.md` | `next_primary`, `next_primary_desc` | `next_alternatives: [{skill, when}]`, `always_show: [{skill, desc}]` |

---

## 七、CLI 命令内部原理

### install 命令

```typescript
// src/commands/install.ts
1. 检查 .ai-agents/.mvtt-manifest.json 是否存在 → 存在则退出
2. 调用 materializeProject()：
   - 遍历 sources/skills/ 和 sources/templates/
   - 用 assembler 生成每个文件，写入目标路径
   - 复制 knowledge/ 和 registry.yaml
   - CREATE_ONCE 文件：config/session/project-context（仅首次）
   - USER_DATA 目录：创建空目录
3. 处理 --pattern 参数（改 config.yaml 的 pattern.active）
4. 写 .mvtt-manifest.json（记录所有文件的 hash）
```

### update 命令

```typescript
// src/commands/update.ts
1. 读取 .mvtt-manifest.json，获取当前版本
2. 对比 CLI 版本，--check 模式只打印差异
3. 对所有 GENERATED 文件重算 hash，与 manifest 记录对比
   → 不符则警告"用户修改将被覆盖"
4. 调用 materializeProject()（overwriteCreateOnce: false）
5. 更新 .mvtt-manifest.json
```

### doctor 命令

```typescript
// src/commands/doctor.ts
checks:
  - manifest 存在
  - 对每个记录的文件：
      存在？ → 不存在报 FAIL (Missing)
      是 GENERATED？ → 哈希对比，不符报 WARN (Modified)
  - USER_DATA 目录是否都还在
```

### uninstall 命令

```typescript
// src/commands/uninstall.ts
1. 读 manifest 获取 GENERATED 文件列表
2. 未加 --yes 只打印，不删
3. 加 --yes 则：
   - 删除所有 GENERATED 文件
   - 删除 .claude/skills/mvt-* 目录
   - 删除 manifest.json
   - 保留 CREATE_ONCE 和 USER_DATA（config.yaml / workspace/ / knowledge/principle/ 等）
```

### materialize.ts —— install 和 update 的共享核心

所有写入用户项目的逻辑都在 `src/fs/materialize.ts`，因为 install 和 update 90% 逻辑相同。关键参数：

- `overwriteCreateOnce: false`（默认）— CREATE_ONCE 已存在则跳过
- 返回 `MaterializedFile[]` 供 manifest 记录哈希

---

## 八、测试指南

### 运行方式

```bash
npm test                       # 跑一次
npm run test:watch             # 监听模式
npm run test:coverage          # 带 coverage 报告
npx vitest run test/cli.test.ts   # 跑单个文件
```

### 当前测试分布（64 个测试）

| 文件 | 类型 | 覆盖内容 |
|---|---|---|
| `test/section-loader.test.ts` | 单元 | 参数替换、块展开、条件块 |
| `test/validator.test.ts` | 单元 | manifest 校验、错误检测 |
| `test/assembler.test.ts` | 快照 | 5 个代表性 skill 的语义结构 |
| `test/commands/install.test.ts` | 集成 | materialize → 验证产物结构 |
| `test/commands/update.test.ts` | 集成 | 用户数据保留、覆盖行为 |
| `test/commands/doctor.test.ts` | 集成 | 哈希检测、缺失检测 |
| `test/cli.test.ts` | 端到端 | 通过 captureIO 调用命令函数 |

### 测试写作惯例

集成测试用临时目录，避免污染仓库：

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "mvtt-<name>-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});
```

CLI 测试用 `captureIO` 助手拦截 `console.*` 和 `process.exit`（见 `test/cli.test.ts`）——不要 spawn 子进程，coverage 拿不到。

### Coverage 门槛

`vitest.config.ts` 设置了 75/75/75/70（lines/stmts/funcs/branches）。当前实际 92/100/85，跑 `npm run test:coverage` 如果低于门槛会 fail。

---

## 九、发布流程

> 前提：`@uoyo` npm scope 已在 npmjs.com 注册完成。

```bash
# 1. 版本号规则：SemVer。CLI 版本和 source 版本捆绑
#    - Bug 修复：patch（2.0.0 → 2.0.1）
#    - 新 skill / 新命令：minor（2.0.1 → 2.1.0）
#    - 破坏性改动（manifest schema / 文件布局）：major

# 2. 升级 package.json 的 version 字段
vi package.json  # 改 "version": "2.0.1"

# 3. 同步 registry.yaml 的 last_updated 字段
vi registry.yaml

# 4. 全量验证
npm run build
npm test

# 5. 预览产物
npm pack --dry-run
# 检查：是否 dist/ sources/ registry.yaml install-manifest.yaml 都在；
# 是否没有误包含 .ai-agents/ .claude/ src/ test/

# 6. 本地冷启动验证（推荐）
npm pack
cd /tmp && mkdir test-install && cd test-install
npm install /path/to/uoyo-mvtt-2.0.1.tgz
npx @uoyo/mvtt install
# 检查目录结构是否正确

# 7. 正式发布
cd /path/to/mvtt-repo
npm publish --access public

# 8. Tag + push
git tag v2.0.1
git push origin v2.0.1
```

**发布前检查单**：
- [ ] `npm test` 全绿
- [ ] `npm pack --dry-run` 产物清单正确
- [ ] package.json / registry.yaml 版本号一致
- [ ] README 没有过期命令
- [ ] `.npmignore` 没有误包含敏感文件

---

## 十、排错手册

### TypeScript 编译报错 `Cannot find module 'node:fs'`

缺 `@types/node`：

```bash
npm install --save-dev @types/node
```

### build 报 `Shared section not found`

检查 manifest 中 `source: sections/xxx.md` 的路径——它是相对于 `sources/` 根的，不是相对于 `sources/sections/`。

### build 报 `Missing param "foo"`

Validator 检测到 section 模板中有 `{{foo}}` 但 manifest 的 `params` 里没传。两种解决：

1. 在 manifest 里加上 `params: { foo: "value" }`
2. 如果想让它可选，把模板里的 `{{foo}}` 改成块形式 `{{#foo}}...{{/foo}}`——块缺失时会整体消失

### 生成的 SKILL.md 有多余空行

Section 模板尾部的空行可能重复。检查 `section-loader.ts` 的 `BLOCK_PATTERN` 正则——它已经会消费块后的一个 `\n`，但两个连续块之间的空行仍会保留（这是正常的）。

### install 到临时目录后，re-install 报"already installed"

这是设计行为。要重装先删除 `.ai-agents/.mvtt-manifest.json`，或用 `uninstall --yes` 正式卸载。

### update 在不同版本间无法触发（总说 "Already at"）

`update.ts` 比较的是 `package.json` 的 version 和 `.mvtt-manifest.json` 的 `mvtt_version`。开发时可以手动改后者来测试 update 路径。

### Windows 下路径问题

**不要**拼接 `projectRoot + "/" + relPath`。永远用 `path.resolve(projectRoot, relPath)`。Node.js 在 Windows 上能正确处理正斜杠输入，但输出时可能是反斜杠——不要把文件路径当字符串比较。

---

## 十一、代码风格与约束

### 硬性规则

1. **Runtime 不能引用外部文件**。所有 skill 文件必须自包含。
2. **用 `path.resolve` / `path.join`**，永远不要用 `+` 拼路径分隔符。
3. **GENERATED / CREATE_ONCE / USER_DATA 边界不可逾越**。新增托管文件时在 `install-manifest.yaml` 中分类。
4. **不要在 runtime 加 Python / Node 运行时脚本**。skill 必须是纯 prompt。
5. **保持 minimal dependencies**。当前运行时依赖只有 `yaml`；开发依赖只有 `typescript`/`vitest`/`@types/node`。加新依赖要有充分理由。

### 推荐实践

- 修改 section 模板后必须 `npm run build && npm test`
- 新加 skill 时优先考虑复用现有 5 个共享 section，而不是新造
- 在 `registry.yaml` 中登记每个 skill 的 `depends_on` 和 `next_suggestions`——这是 skill 间协调的契约源
- 写注释聚焦 WHY，不要解释 WHAT（代码自己能说）

### 非硬性但鼓励

- CLI 输出带彩色（用 `src/util/color.ts`），TTY 检测已内置
- 错误信息给出具体修复建议（不只是报错）
- 集成测试比单元测试有价值（覆盖更多真实路径）

---

## 十二、常见问题（FAQ）

**Q1: 我想给某个 skill 加一个只有它自己用的 section，要抽到 shared 吗？**

不要。直接用 `type: file` 引用本 skill 目录下的独立 md 文件，或者直接 inline。**只有被 2+ skill 共用时**才往 `sources/sections/` 挪。

**Q2: Runtime 里为什么每个 SKILL.md 都有 GENERATED 标记？**

用于 `doctor` 和 `update` 命令检测用户是否手改过该文件。头部标记 + SHA-256 哈希双重机制。

**Q3: 用户改了 SKILL.md 会怎么样？**

- `doctor` 会报 `[WARN] Manually modified`
- `update` 会警告并覆盖（这是预期行为——用户不应该直接改 GENERATED 文件，需要定制应通过 `_templates/custom/` 或新建 custom skill）

**Q4: 为什么 `mvt-update` skill 不存在了？**

被 CLI 的 `mvtt update` 命令替代。让更新逻辑从 "Claude 读一段 prompt 执行 Python" 变成 "TypeScript 直接执行"——更可靠、更快、更可测。

**Q5: 我想让某个 skill 只在特定 pattern 下可用，怎么做？**

当前 skill 注册是全局的。这类需求可以在 `registry.yaml` 加字段（比如 `pattern_scope: [ddd]`），然后在 `mvt-help` / `mvt-status` 中根据 active pattern 过滤。属于增强功能，不是当前 v2.0 必做。

**Q6: `.ai-agents/` 和 `.claude/` 这两个目录开发时要关心吗？**

不直接。它们是"本仓库自己当 MVTT 用户时的 runtime"。改 source 后默认不自动刷新它们，除非你手动跑 `node dist/index.js build --out .`。要保持它们和 source 同步是 manual decision。

**Q7: 开发时怎么快速验证一个 skill 的 prompt 在 Claude Code 里的行为？**

```bash
# 把 source 构建到本仓库（覆盖 .claude/ 和 .ai-agents/_templates/）
node dist/index.js build --out .

# 在 Claude Code 里打开本仓库，触发 /mvt-<name> 测试
```

**Q8: 哪些改动会触发 CLI 的 major 版本？**

- manifest YAML schema 变更（字段重命名、删除）
- install-manifest.yaml 分类规则变更
- GENERATED 文件路径约定变更
- registry.yaml 顶级结构变更

这些会让旧 `.mvtt-manifest.json` 失效。至少升 major 版本，并在 CHANGELOG 写清楚迁移路径。

---

## 一页速查卡

```
# 开发循环
vi sources/<something>                   # 改 source
npm run build                            # 编译 CLI
npm test                                 # 验证
node dist/index.js build --out .build-test  # 肉眼看产物
rm -rf .build-test                       # 清理

# 常用 CLI 调用
node dist/index.js install               # 装
node dist/index.js install --pattern ddd # 带 pattern 装
node dist/index.js doctor                # 体检
node dist/index.js update --check        # 查版本
node dist/index.js uninstall --yes       # 卸载

# 关键目录
sources/skills/mvt-<name>/               # skill 源
sources/sections/                        # 共享 section
sources/templates/<name>-output/         # 输出模板源
registry.yaml                            # skill 元数据
install-manifest.yaml                    # 文件分类
src/fs/materialize.ts                    # install/update 核心
src/build/assembler.ts                   # build 核心
```

---

*文档版本：v1.0 · 编制日期：2026-04-29*
*维护者请在重大架构变更后同步更新本文档*

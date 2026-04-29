# MVTT 迁移至 CLI 生成方案 · 路线图

> **决策已定**：
> - CLI 宿主：**Node.js + TypeScript**
> - 分发：**npm + npx**（`npx mvtt install`）
> - 范围：**runtime + 安装/更新体验同时优化**
> - 兼容：**不保留**当前"手动克隆仓库"方式，CLI 落地后强制迁移
>
> **本文档替代**：`docs/change-plan.md`（v2.0 原增量路线整体作废，改为 CLI 一次性交付）
>
> **架构跃迁**：MVTT 从"markdown 文件集合"升级为"**工程化产品**"——source 与 runtime 中间加入**生成器层**，从根源消灭双写漂移。

---

## 一、为什么换路线

### 原 Phase 1 的根本问题

原计划为了达成"runtime 零新增读取 + dev-time 信息集中"，被迫引入了**双写**：

| 信息 | 写在 skill 文件（runtime 用） | 写在 registry.yaml / scaffold（dev-time 用） |
|---|---|---|
| depends_on / next_suggestions | ✅ | ✅ |
| reads / writes | ✅（IO Declaration） | ✅ |
| Pre-flight 结构、footer 格式 | ✅ | ✅ |

**代价**：需要 `/mvt-sync-skills` 手动对账工具兜底。只要人会忘，漂移就会发生。

### CLI 方案从根本上解决

**核心思路**：source 和 runtime 之间加一个**生成器**。

```
┌─────────────────────────┐
│  Source 层（开发者维护）     │
│  - 细粒度 section          │ ← DRY at dev-time
│  - manifest.yaml           │
│  - registry.yaml（单一源头）│
└───────────┬─────────────┘
            │ mvtt build
            ▼
┌─────────────────────────┐
│  Runtime 层（用户项目）     │
│  - 完整扁平 SKILL.md        │ ← inlined at runtime
│  - 完整扁平 output template │
└─────────────────────────┘
```

**收益**：
- ❌ 信息再也没有两份
- ❌ `/mvt-sync-skills` 不需要存在
- ❌ `/mvt-update` skill 不需要存在
- ✅ 改一处（source）重新生成（runtime 一致）
- ✅ `热路径内嵌 + 冷路径抽离`这条原则**在 source/runtime 两层分别成立**，不再矛盾

---

## 二、原 Phase 1 / 2 / 3 的处置

以原分析文档的 P1-P10 编号对照：

| 编号 | 问题 | 新处置 |
|---|---|---|
| **P1** 引导性输出 | ✅ 融入 CLI source 层的共享 footer section；产物中 inline |
| **P2** registry 激活 | ✅ registry v2 成为 CLI 的核心元数据源；运行时只有 `/mvt-status` `/mvt-help` 读 |
| **P3** 契约文档化 | ✅ 自动解决——registry 就是单一契约源，无需 schemas/ |
| **P4** config 底座分层 | ⏳ 延后，CLI 稳定后推进 |
| **P5** 路径集中 | ⏳ 延后，和 P4 一起 |
| **P6** 样板冗余 | ✅ **彻底消失**——source 高度 DRY，产物 inline，两全其美 |
| **P7** 多 change 支持 | ⏳ 延后 |
| **P8** drift flag | ⏳ 延后 |
| **P9** 工作流可定制 | ⏳ 延后 |
| **P10** hook 提醒 | ⏳ 延后 |

**本次交付聚焦**：P1、P2、P3、P6 通过 CLI 一次性解决。其他延后到 CLI 稳定之后。

### 明确作废的设计

| 原设计 | 作废原因 |
|---|---|
| `/mvt-sync-skills` | CLI 重新生成即对齐，不需要对账工具 |
| `/mvt-update` skill（现有 update_framework.py） | `mvtt update` CLI 命令替代 |
| `.ai-agents/scripts/update_framework.py` | 同上 |
| `schemas/*.schema.md` | 单一源头即契约 |
| `_scaffold/*.md`（独立目录） | 源 section 即 scaffold |
| `_shared/*.md`（独立目录） | 源 section 即共享 |

---

## 三、新仓库架构

### 3.1 MVTT 源仓库（开发者维护）

```
mvtt/                                # 当前仓库
├── package.json                     # npm 包定义，bin: mvtt
├── tsconfig.json
├── src/                             # CLI 实现（TypeScript）
│   ├── cli.ts                       # 入口
│   ├── commands/
│   │   ├── install.ts
│   │   ├── update.ts
│   │   ├── uninstall.ts
│   │   ├── doctor.ts
│   │   ├── eject.ts
│   │   └── dev.ts                   # 开发时 --watch
│   ├── build/
│   │   ├── assembler.ts             # manifest → 完整 markdown
│   │   ├── section-loader.ts        # 4 类 section 的加载与展开
│   │   └── validator.ts             # manifest / registry schema 校验
│   ├── fs/
│   │   ├── protection.ts            # 保护区判断、GENERATED 头检测
│   │   └── hash.ts                  # 生成文件 hash 记录
│   └── types/
│       └── manifest.ts              # Manifest / Registry 的 TS 类型
│
├── sources/                         # 所有 skill/template 的源
│   ├── skills/
│   │   ├── mvt-analyze/
│   │   │   ├── manifest.yaml        # 拼装清单
│   │   │   └── business.md          # 业务步骤（Execution Flow）
│   │   ├── mvt-design/
│   │   └── ...（19 个 skill）
│   │
│   ├── sections/                    # 共享 section（会被多个 skill 引用）
│   │   ├── activation-load-context.md
│   │   ├── activation-load-config.md
│   │   ├── activation-preflight-template.md
│   │   ├── footer-next-step-guidance.md
│   │   └── role-header-template.md
│   │
│   └── templates/                   # 输出模板的源
│       ├── analyze-output/
│       │   ├── manifest.yaml
│       │   └── body.md
│       └── ...（14 个 template）
│
├── registry.yaml                    # 元数据单一源（build 时的核心输入）
├── install-manifest.yaml            # 全局安装清单：哪些文件生成到哪、哪些是用户区
│
├── test/                            # CLI 单元测试 + 生成结果的 snapshot
│   ├── assembler.test.ts
│   └── fixtures/
│
└── docs/
    ├── architecture-analysis.md
    └── cli-migration-plan.md       # 本文档
```

### 3.2 用户项目（CLI 生成后）

```
user-project/
├── .claude/
│   └── skills/
│       └── mvt-*/SKILL.md          # ← GENERATED（完整扁平）
├── .ai-agents/
│   ├── workspace/                   # ← USER DATA（永不覆盖）
│   │   ├── session.yaml
│   │   ├── project-context.yaml
│   │   └── artifacts/
│   ├── skills/
│   │   └── _templates/
│   │       ├── *-output.md          # ← GENERATED
│   │       └── custom/              # ← USER DATA
│   ├── knowledge/
│   │   ├── core/                    # ← GENERATED
│   │   ├── patterns/                # ← GENERATED
│   │   ├── principle/               # ← USER DATA
│   │   └── project/                 # ← USER DATA
│   ├── config.yaml                  # ← USER DATA（CLI 只在首次 install 时创建）
│   ├── registry.yaml                # ← GENERATED（从源仓库复制）
│   └── .mvtt-manifest.json          # ← 安装元数据（版本、文件 hash）
└── ...（用户自己的代码）
```

**关键边界**：
- **GENERATED**：CLI 覆盖。改了会被下次 update 覆盖。
- **USER DATA**：CLI 永不碰。
- **首次创建类**（config.yaml）：CLI 只在 install 时创建，update 不覆盖。

---

## 四、CLI 命令设计

| 命令 | 功能 | 典型用法 |
|---|---|---|
| `npx mvtt install` | 首次安装到当前项目 | 项目根目录执行 |
| `npx mvtt install --pattern ddd` | 安装时指定 pattern | |
| `npx mvtt update` | 更新到 latest 版本（保留 USER DATA） | |
| `npx mvtt update --check` | 只检查新版，不实际更新 | |
| `npx mvtt update --to 2.1.0` | 更新到指定版本 | |
| `npx mvtt doctor` | 检查 GENERATED 文件是否被手改、manifest 是否完整 | |
| `npx mvtt uninstall` | 移除所有 GENERATED；保留 USER DATA | |
| `npx mvtt eject` | 进入手动维护模式：把 GENERATED 转为 USER DATA，未来不再覆盖 | 极少用 |
| `mvtt dev --watch` | 开发者本地：改 source 自动重新生成到 `.claude/skills/` | 开发 CLI 本身时用 |

**用户心智模型**：就像 `create-react-app` / `vite`——运行命令装上，改业务，需要新功能就 update。不用关心内部文件怎么生成。

---

## 五、核心机制详解

### 5.1 Manifest 驱动的拼装

每个 skill / template 有一份 manifest 声明它由哪些 section 拼装。

```yaml
# sources/skills/mvt-analyze/manifest.yaml
name: mvt-analyze
output: .claude/skills/mvt-analyze/SKILL.md

frontmatter:
  name: mvt-analyze
  description: "Analyze requirements documents and extract domain concepts..."

sections:
  - type: inline
    content: |
      # MVT Analyze

      ## Purpose
      Analyze requirements...

  - type: shared
    source: sections/role-header-template.md
    params:
      role: Analyst
      role_desc: "a Requirements Analysis Expert"
      boundaries:
        - skill: /mvt-design
          scope: architecture decisions
        - skill: /mvt-implement
          scope: implementation code

  - type: shared
    source: sections/activation-load-context.md

  - type: shared
    source: sections/activation-load-config.md

  - type: shared
    source: sections/activation-preflight-template.md
    params:
      checks:
        - field: session.initialized_at
          message: "Session not initialized. Run /mvt-init first."
          level: WARN
        - field: project.name
          message: "Project not initialized."
          level: WARN

  - type: file
    source: ./business.md   # mvt-analyze 自己的 Execution Flow

  - type: shared
    source: sections/footer-next-step-guidance.md
    params:
      next_primary: mvt-design
      next_primary_desc: "Create architecture based on this analysis"
      next_alternatives:
        - skill: /mvt-analyze
          when: "ambiguities remain"
```

### 5.2 Section 类型（4 类）

| 类型 | 用途 |
|---|---|
| `inline` | 直接写在 manifest 里的短 markdown |
| `file` | 引用本 skill 目录下的 `.md` 文件 |
| `shared` | 引用 `sources/sections/` 下的共享 section |
| `template` | 带参数的模板（`{{var}}` 占位符，assembler 做简单替换） |

### 5.3 生成文件头部标记

每个 GENERATED 文件首行：

```markdown
<!-- GENERATED by mvtt vX.Y.Z @ 2026-04-27T10:30:00Z. Manual edits will be overwritten. Use _templates/custom/ for overrides. -->
```

CLI 通过这个标记识别"是否是自己生成的"。

### 5.4 .mvtt-manifest.json（安装元数据）

```json
{
  "mvtt_version": "2.0.0",
  "installed_at": "2026-04-27T10:30:00Z",
  "last_updated_at": "2026-04-27T10:30:00Z",
  "pattern": "ddd",
  "files": {
    ".claude/skills/mvt-analyze/SKILL.md": {
      "hash": "sha256:abc123...",
      "source_version": "2.0.0"
    },
    // ...
  }
}
```

**用途**：
- `update`：对比 installed 与 latest 的差异
- `doctor`：检测用户是否手改了生成文件（hash 不符即报警）
- `uninstall`：精确知道该删哪些文件

### 5.5 保护区规则（install-manifest.yaml）

```yaml
version: 2

# GENERATED 目录：CLI 完全托管
generated:
  - .claude/skills/mvt-*/
  - .ai-agents/skills/_templates/*.md
  - .ai-agents/knowledge/core/
  - .ai-agents/knowledge/patterns/
  - .ai-agents/registry.yaml

# CREATE_ONCE：首次 install 创建，update 不覆盖
create_once:
  - .ai-agents/config.yaml
  - .ai-agents/workspace/session.yaml
  - .ai-agents/workspace/project-context.yaml

# USER_DATA：CLI 永不触碰
user_data:
  - .ai-agents/workspace/
  - .ai-agents/skills/_templates/custom/
  - .ai-agents/knowledge/principle/
  - .ai-agents/knowledge/project/
```

---

## 六、执行路线（8 个 Phase 0 步骤）

所有任务已加入任务清单。推荐顺序：

| # | Phase | 内容 | 风险 |
|---|---|---|---|
| 1 | **Phase 0.1** | CLI 仓库与项目脚手架（package.json、tsconfig、npm bin 入口） | 低 |
| 2 | **Phase 0.2** | 设计 source 层目录结构 + manifest schema | 低（设计阶段） |
| 3 | **Phase 0.3** | 把现有 19 skill + 14 template 拆为 source sections（最重活） | 中 |
| 4 | **Phase 0.4** | 实现 build 引擎（assembler + section-loader + validator） | 中 |
| 5 | **Phase 0.5** | 实现 install / update / uninstall / doctor / eject 命令 | 中 |
| 6 | **Phase 0.6** | 设计保护区 / GENERATED 头 / hash 检测机制 | 低 |
| 7 | **Phase 0.7** | 源头融入 P1 footer + P2 registry v2 | 低（并入 0.3） |
| 8 | **Phase 0.8** | 发布 npm 包 + 迁移文档 | 低 |

### 建议的实际执行次序（按依赖）

```
阶段 A（基础）：0.1 → 0.2 → 0.6       ← 设计与骨架
阶段 B（内容）：0.3                    ← 最耗时
阶段 C（引擎）：0.4 → 0.7              ← build 引擎
阶段 D（命令）：0.5                    ← CLI 命令层
阶段 E（上线）：0.8                    ← 测试 + 发布
```

### 里程碑验收

| 里程碑 | 验收标准 |
|---|---|
| M1：build 跑通 | source 能拼装出一个完整的 `mvt-analyze/SKILL.md`，与旧文件语义一致 |
| M2：install 可用 | 空项目跑 `mvtt install` 得到完整 MVTT 结构 |
| M3：update 可用 | 装了 v2.0.0 的项目跑 `mvtt update --to 2.0.1` 正确升级，USER DATA 无损 |
| M4：doctor 可用 | 手改一个生成文件后 `mvtt doctor` 能检测到 |
| M5：npm 可用 | `npx mvtt install` 在干净机器上可用 |

---

## 七、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| source 拆分粒度错误（过粗或过细） | 中 | 中 | Phase 0.2 先设计+评审再动；从 3-5 个代表性 skill 起手 |
| 现有 skill 行为被拆丢失 | 中 | 高 | 对每个 skill 写 snapshot test：`build output == 现有文件`（去掉 frontmatter 时间戳等） |
| 用户手改生成文件的处理策略 | 中 | 中 | doctor 检测 + update 前警告 + 提供 eject 兜底 |
| npm 发布名字冲突 / 权限 | 低 | 低 | 预先检查 `mvtt` 名字是否可用；否则 `@your-scope/mvtt` |
| CLI bug 导致用户项目损坏 | 低 | 高 | update 前自动备份到 `.backup/`；doctor 可还原 |
| TypeScript + Node 版本要求 | 低 | 低 | 在 package.json 的 `engines` 字段约束；CLI 首行检查 Node 版本 |

---

## 八、对现有仓库的影响

### 会删除 / 重大改造

| 内容 | 处置 |
|---|---|
| `.ai-agents/scripts/update_framework.py` | 删除（被 CLI 替代） |
| `.ai-agents/scripts/requirements.txt` | 删除 |
| `.claude/skills/mvt-update/` | 改造为 "提示用户运行 `npx mvtt update`" 的薄 skill，或直接删除 |
| `.ai-agents/registry.yaml`（源位置） | 移到根目录，作为 CLI 的元数据输入 |
| 当前 `.claude/skills/mvt-*/*` | 从"手写源"降级为"生成产物"；源移到 `sources/skills/` |
| 当前 `.ai-agents/skills/_templates/*` | 同上 |

### 需新增

- `package.json` / `tsconfig.json`
- `src/`（CLI 实现）
- `sources/`（拆分后的 source）
- `install-manifest.yaml`
- `test/`

### 不受影响

- `.ai-agents/knowledge/` 的实际内容（只是 install 时的分发方式变了）
- `README - About MVTT .md`（会更新使用方式）

---

## 九、用户迁移路径

**当前用户**（手动克隆仓库使用）→ **新用户**（`npx mvtt install`）：

1. 在 v2.0.0 发布时，README 顶部放醒目迁移指南
2. 提供 `mvtt migrate` 命令：
   - 检测旧版 MVTT 安装
   - 备份用户数据（workspace/、knowledge/principle/、knowledge/project/、config.yaml）
   - 删除旧的 `.claude/skills/mvt-*/` 和 `.ai-agents/skills/_templates/*`
   - 运行 install
   - 恢复备份的用户数据
3. 旧仓库的 dev 分支保持可用 6 个月，之后归档

---

## 十、需要确认的设计决策

请在 Phase 0.1 启动前确认：

### 1. CLI 仓库位置
- **选项 A**：保持在当前 `My-Virtual-TechTeam` 仓库（monorepo：CLI + source 同仓）— **推荐**
- **选项 B**：新建 `mvtt-cli` 仓库，source 仓库独立
- 推荐 A 的理由：改 source 和改 CLI 通常一起，分仓会增加协调成本

### 2. npm 包名
- **首选**：`mvtt`（需先查 npmjs.com 是否可用）
- **备选**：`@你的作用域/mvtt`
- **备选**：`create-mvtt`（走 `npm init mvtt` 模式）

### 3. 版本策略
- **推荐**：SemVer；CLI 与 source 同版本号（一起发布）
- 用户心智：`mvtt v2.1.0` = CLI v2.1.0 + source 内容 v2.1.0

### 4. 拆分粒度起点
- **推荐**：先拆 **Activation Protocol**（Load Context / Load Config / Pre-flight / Role Header / Footer）5 个共享 section
- 其他保持 inline；之后看哪里重复再抽
- 避免一开始就过度抽象

### 5. 是否在 v2.0.0 就做 eject
- **推荐**：v2.0.0 不做，留到 v2.1.0
- 理由：eject 是逃生舱口，首版聚焦主路径

### 6. 迁移指南是否作为 CLI 命令
- **推荐**：`npx mvtt migrate` 作为专用命令，而不是 `install` 的 flag
- 更清晰，风险更可控

---

## 十一、一句话总结

> **这不是"给 MVTT 加个安装器"，这是一次架构升级——从"一堆约定"到"工程化产品"。原本为了调和 source 与 runtime 双重身份而设计的所有补丁（sync-skills、update skill、scaffold 目录、schema 目录、IO Declaration 双写）都会被 CLI 一次性消解。我们原本要打的十张补丁，现在用一次重构替代。**

---

## 十二、下一步

- [ ] 你确认本路线图
- [ ] 回答第十节的 6 个决策点
- [ ] Phase 0.1 启动（CLI 仓库脚手架）

我可以在你确认后直接开始 Phase 0.1——搭建 TypeScript + Node CLI 骨架、配置 package.json 和 bin 入口。

---

*文档版本：v1.0 · 编制日期：2026-04-27*
*状态：替代 `docs/change-plan.md` v2.0；原增量路线整体作废*

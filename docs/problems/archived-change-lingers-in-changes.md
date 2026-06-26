# `changes[]` 中已归档变更的悬挂指针问题

> 编写日期: 2026-06-22
> 关联: `mvt-cleanup`, `mvt-status`, `mvt-resume`, `mvt-sync-context`, `session-update.js`

---

## 1. 问题描述

`/mvt-cleanup` 归档已完成变更时，产物目录从 `artifacts/{change-id}/` 移到 `artifacts/_archived/{change-id}/`，但 `session.yaml > changes[]` 中的索引条目**保持不变**，导致出现悬挂指针：

```yaml
# session.yaml — 归档后的 changes 条目
changes:
  - id: "chg-001"
    title: "User authentication"
    plan_path: ".ai-agents/workspace/artifacts/chg-001/plan.yaml"  # ← 已不存在！
    status: "done"
    updated_at: "2026-06-22T10:00:00Z"
```

AI 在读取 `session.yaml` 时看到这条记录，尝试访问 `plan_path` 会得到文件不存在的异常，造成误解和额外的推理开销。

---

## 2. 数据结构全景

### `session.yaml` 中相关字段

```yaml
active_change:      # 当前活动的 Change（游标指针）
  id: ""
  title: ""
  created_at: ""
  plan_path: ""
  epic_id: ""

changes: []         # 历史索引（含 status: active | done | abandoned）
  # - id: "chg-001"
  #   title: "User authentication"
  #   plan_path: ".ai-agents/workspace/artifacts/chg-001/plan.yaml"
  #   status: "active" | "done" | "abandoned"
  #   updated_at: "2026-05-23T14:30:00"
```

### 产物目录结构

```
artifacts/
  chg-001/              ← 归档前，changes[] 中的 plan_path 指向这里
    plan.yaml
    analysis.md
    design.md
    implementation.md
    ...
  _archived/
    chg-001/             ← 归档后，产物实际在这里
      plan.yaml
      summary.md
      ...
```

### 核心矛盾

| 层面 | 归档前 | 归档后 |
|------|--------|--------|
| 产物物理位置 | `artifacts/{id}/` | `artifacts/_archived/{id}/` |
| `changes[].plan_path` | ✅ 有效 | ❌ 悬挂指针 |
| `changes[].status` | `done` | `done`（未变） |

---

## 3. 影响分析

### 3.1 各技能的受影响程度

| 技能 | 行为 | 影响等级 |
|------|------|---------|
| `mvt-status` | Step 3 遍历 `changes[]` 读取 plan.yaml，失败时标记 `(missing)` | **中** — 显示 `(missing)` 让用户困惑 |
| `mvt-resume` | Step 2 遍历 `changes[]`，但只取 `plan.status == "in_progress"` | **低** — `done` 不会被选 |
| `mvt-cleanup` | Step 2/3/4 读取 `changes[]` 中的 `done` 条目做 sync check 和 Inventory | **中** — 保留条目会导致重复处理；删除条目又影响下次判断 |
| `mvt-sync-context` | Step 2 读取 `changes[]` 中 `status: done` 的条目，验证目录存在性 | **高** — 目录检查会失败；但如果已 sync 过则无影响 |
| `mvt-help` | 边缘规则：不警告，忽略 | **低** |
| `mvt-analyze / mvt-design / mvt-implement / mvt-review / mvt-test` | 不直接读取 `changes[]` | **无** |

### 3.2 典型误解场景

**场景：用户运行 `/mvt-status` 查看当前状态**

```
Changes Overview:
| change-id | title            | status | progress  | updated_at          |
|-----------|------------------|--------|-----------|---------------------|
| chg-001   | User auth        | done   | (missing) | 2026-06-22T10:00:00 |
| chg-002   | Dashboard        | active | 3/5 tasks | 2026-06-22T14:00:00 |
```

AI 看到 `(missing)` 可能会思考："为什么这个已完成的变更文件不见了？是不是工作流出错了？要不要自动修复？" — 这不仅浪费 token，还可能导致错误推理。

**场景：AI 主动遍历 `changes[]` 做上下文聚合**

如果某个技能（或 AI 的自主行为）遍历 `changes[]` 尝试读取所有 plan 来构建上下文全景：

```
→ 读 artifacts/chg-001/plan.yaml → 404 ❌ （困惑）
→ 读 artifacts/chg-002/plan.yaml → OK
```

AI 的推理链可能偏离正轨。

---

## 4. 涉及的核心文件

| 文件 | 角色 |
|------|------|
| `sources/scripts/session-update.js` | `changes[]` 的唯一写入点 |
| `.claude/skills/mvt-cleanup/SKILL.md` | 归档操作 + 调用 `session-update.cjs` |
| `.claude/skills/mvt-status/SKILL.md` | 读取 `changes[]` 显示状态面板 |
| `.claude/skills/mvt-resume/SKILL.md` | 读取 `changes[]` 发现可恢复的 plan |
| `.claude/skills/mvt-sync-context/SKILL.md` | 读取 `changes[]` 确定聚合候选 |
| `.claude/skills/mvt-help/SKILL.md` | 边缘规则引用 |
| `test/session-update.test.ts` | `--close-change` 行为的测试 |

---

## 5. 解决方案分析

### 5.1 方案 A：归档时更新 `plan_path`（最小改动）

**思路**：`/mvt-cleanup` 归档后，将 `changes[].plan_path` 重写为 `_archived/{id}/plan.yaml`。

**操作**：在 `session-update.js` 中新增 `--move-plan-path <new-path>` flag，或在 `mvt-cleanup` SKILL.md 的 State Update 中增加一步手动更新。

**优点**：
- 指针永远有效，AI 行为一致
- 可以读取已归档的 `plan.yaml` / `summary.md` 作为参考
- 改动面小

**缺点**：
- `changes[]` 中保留已归档条目，语义不够纯净
- 需要额外的 session-update flag

**影响范围**：`session-update.js` + `mvt-cleanup/SKILL.md`（State Update 段落）

---

### 5.2 方案 B：归档时从 `changes[]` 删除条目（推荐候选）

**思路**：`/mvt-cleanup` 归档 done 变更后，直接从 `changes[]` 中移除该条目。

**操作**：在 `session-update.js` 中新增 `--remove-change <change-id>` flag；`mvt-cleanup` 在 Step 7 归档后调用此 flag。

**优点**：
- ✅ **完全消除误解** — `changes[]` 中处处有效，无悬挂指针
- ✅ **语义纯净** — `changes[]` 从"历史日志"变为"活跃索引"，只存未归档的变更
- ✅ 用户查看 status 时不会看到已归档的旧条目，界面更清爽
- 可移除多个 SKILL.md 中的 `(missing)` 边缘规则

**缺点**：
- ❗ **sync-context 必须在 cleanup 之前运行** — 否则知识永久丢失（`changes[]` 和产物目录双重删除）
- ❌ **历史追溯降级** — 从"`changes[]` + `_archived/` 双证据"降级为仅 `_archived/` 单证据
- ⚠️ 需修改 `session-update.js`（新增 flag）+ 测试

**影响范围**：

| 文件 | 变更类型 |
|------|---------|
| `sources/scripts/session-update.js` | 新增 `--remove-change` flag |
| `.claude/skills/mvt-cleanup/SKILL.md` | State Update 调用 `--remove-change` 替换 `--close-change` |
| `.claude/skills/mvt-status/SKILL.md` | 可移除 `(missing)` 边缘规则 |
| `.claude/skills/mvt-help/SKILL.md` | 可移除相关边缘规则 |
| `test/session-update.test.ts` | 修改 `--close-change` 测试 + 新增 `--remove-change` 测试 |

---

### 5.3 方案 C：引入 `archived` 状态标记

**思路**：归档时不删条目，也不改路径，而是加一个新状态标记。

```yaml
changes:
  - id: "chg-001"
    title: "User authentication"
    plan_path: ".ai-agents/workspace/artifacts/_archived/chg-001/plan.yaml"
    status: "archived"          # 新增状态
    updated_at: "2026-06-22T10:00:00Z"
```

**操作**：在 `session-update.js` 中新增 `--archive-change` flag；各 SKILL.md 统一识别 `status: archived`。

**优点**：
- 语义丰富，保留了"完成→归档"的完整生命周期
- `plan_path` 有效指向归档后的位置

**缺点**：
- 改动面最大 — 需要修改 5+ 个 SKILL.md 来识别新的 `archived` 状态
- `mvt-status` 的 Changes Overview 中仍显示已归档条目，占用展示空间
- 与其他状态的互斥逻辑（如 resum 只选 `in_progress`）需要确认无冲突

---

### 5.4 方案 D：读取时容错（被动防御）

**思路**：不改写入逻辑，在所有读取 `changes[]` 的地方增加 fallback 到 `_archived/` 的容错逻辑。

**操作**：修改 `mvt-status`、`mvt-sync-context`、`mvt-resume` 等 SKILL.md 的读取步骤，在 `plan_path` 指向的文件不存在时，自动尝试 `artifacts/_archived/{id}/plan.yaml`。

**优点**：
- 不改 `session-update.js`，风险最低
- "自修复"式读取

**缺点**：
- 治标不治本 — 悬挂指针仍然存在，每个读取点都要加容错
- 改动面分散（4+ 个 SKILL.md）
- AI 在未专门处理容错的场景中仍可能困惑

---

## 6. 推荐方案

**推荐方案 B**，核心理由：

1. **完全消除误解**，这是首要目标
2. **语义清晰** — `changes[]` 只存"当前值得关注"的变更索引
3. **改动相对集中** — 主要在 `session-update.js` 和 `mvt-cleanup/SKILL.md`

**前提条件**（在实施前需确保）：

1. `mvt-sync-context` 有明确的用户引导，确保它在 `mvt-cleanup` 之前运行
2. 用户接受"归档即遗忘"的语义 — 历史追溯只依赖 `_archived/` 目录

如果用户更倾向于保留历史可见性，**备选方案 A** 是最小代价的选择。

---

## 7. 参考资料

- `sources/scripts/session-update.js` — `--close-change` 实现（约第 272 行）
- `.claude/skills/mvt-cleanup/SKILL.md` — Step 7 归档执行逻辑
- `.claude/skills/mvt-status/SKILL.md` — Step 3 Changes Overview
- `.claude/skills/mvt-resume/SKILL.md` — Step 2 发现 Pending Plans
- `.claude/skills/mvt-sync-context/SKILL.md` — Step 2 识别已完成变更
- `test/session-update.test.ts` — 相关测试用例

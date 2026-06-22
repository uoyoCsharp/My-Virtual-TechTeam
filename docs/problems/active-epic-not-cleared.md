# `active_epic` 未被清空的问题分析

> 编写日期: 2026-06-22
> 关联: `mvt-cleanup`, `mvt-update-plan`, `session-update.js`, `epic-update.js`

---

## 1. 问题描述

在 MVTT 框架中，当一个 Epic 的所有子 Change 完成后，`session.yaml` 中的 `active_epic` 字段不会被自动清空。具体表现为：

```yaml
# session.yaml — Epic 完成后仍残留
active_epic:
  id: "epic-20260608-ecommerce"
  title: "ecommerce platform"
  created_at: "2026-06-08T10:00:00Z"
  epic_path: ".ai-agents/workspace/artifacts/epic-20260608-ecommerce/epic.yaml"
```

即使：
- `epic.yaml` 中已经设置了 `status: done`
- 所有子 Change 均已 `done`
- 最后一个子 Change 的 `active_change` 已被清理

`active_epic` 仍然保持旧值不重置。

---

## 2. 数据结构全景

### `session.yaml` 中相关字段

```yaml
active_epic:        # 当前活动的 Epic（游标指针）
  id: ""
  title: ""
  created_at: ""
  epic_path: ""

epics: []           # 历史快照（含 status: active | done | abandoned）

active_change:      # 当前活动的 Change（游标指针）
  id: ""
  title: ""
  created_at: ""
  plan_path: ""
  epic_id: ""       # 所属 Epic（关联到 active_epic.id）

changes: []         # 历史快照（含 status: active | done | abandoned）
```

### 对称性对比

| 操作 | active_change | active_epic |
|------|--------------|-------------|
| 创建 | `--new-change --change-id <id>` | `--new-epic --epic-id <id>` |
| 设置路径 | `--set-plan-path <path>` | `--set-epic-path <path>` |
| 快照更新 | `--update-change` | `--set-epic-status <status>` |
| 关闭并清空 | `--close-change` | `--close-epic` |
| 自动关闭触发者 | **`mvt-cleanup`**, **`mvt-update-plan`** | **（无人触发）** |

---

## 3. 涉及 Skill 的分析

### 3.1 `mvt-cleanup` 的问题

**SKILL.md 中的当前逻辑**：

- Step 9（Session Update Parameter Selection）—— 只有两行规则：

| Actual cleanup action | session-update parameters |
|----------------------|---------------------------|
| Closed active_change (all plan tasks completed) | `--close-change --truncate-history <N>` |
| Only truncated history / archived old changes | `--truncate-history <N>` |

**缺少第三行**：当归档了一个已完成 Epic 时，也应追加 `--close-epic`。

- State Update 段落中有约束：

> Use only the flags rendered in the command above; do not invent extra session-update flags.

这意味着即使运行时 AI 发现应该关闭 epic，指令也不允许加 `--close-epic`。

- Step 4（Cleanup Rules）中已能检测 Epic 完成：

```
Artifact directory under artifacts/ whose id starts with epic-
AND contains epic.yaml with status: done
  → Batch archive candidate
```

但归档目录 ≠ 清除 `active_epic`。归档是文件层面的操作，`active_epic` 是 session 状态层面的操作，两者互不感知。

**结论**：`mvt-cleanup` 有检测已完成 Epic 的能力，但没有将检测结果传递到 `session-update.cjs` 调用的机制。

---

### 3.2 `mvt-update-plan` 的问题

**SKILL.md 中当前逻辑（Step 5 — Epic Advancement Check）**：

```
plan_status == "done" 且 active_change.epic_id 非空
  → 询问用户 (y / n / defer)

  (y)     → epic-update.cjs --complete-child
             + session-update.cjs --close-change

  (defer) → epic-update.cjs --set-child-status done
             + session-update.cjs --close-change

  (n)     → 不做任何事
```

**关键信息已就绪但未被使用**：

`epic-update.cjs --complete-child` 的 stdout 中直接包含 `epic_status`：

```json
{
  "ok": true,
  "child": { "change_id": "chg-003", "old_status": "active", "new_status": "done" },
  "current_change": "",           // 空 = 没有下一个子 change
  "epic_status": "done",          // ← 可直接用于决策
  "progress": { "done": 3, "total": 3 }
}
```

当 `epic_status === "done"` 时，说明所有子 change 均已完成，epic 自然终结。

**当前行为**：
- `epic.yaml` 中的 `status` 已更新为 `done`
- `active_change` 已被 `--close-change` 清空
- 但 `active_epic` 仍然保留在 session 中 → **不一致**

**三种处理方案**：

| 选项 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A: 不处理，留给 cleanup** | `mvt-update-plan` 只推进 DAG，不碰 `active_epic` | 职责清晰 | 状态不一致窗口期长；用户不跑 cleanup 则永远脏 |
| **B: 在 (y) 路径中条件性 close** | 当 `epic_status === "done"` 时，追加 `--close-epic` | 信息已就绪；恰好是自然终点；无额外询问 | (y) 路径逻辑略复杂 |
| **C: 再问一次用户** | `epic_status === "done"` 时问"是否同时关闭 epic" | 用户完全控制 | 过度询问；所有子 change 都 done 了没有不关的理由 |

---

## 4. 现有机制能否 work around

| 方法 | 结果 |
|------|------|
| 手动调 `node .ai-agents/scripts/session-update.cjs --close-epic` | 可以，但需要用户知道 flag 存在 |
| 等 `mvt-cleanup` 修复 | 目前不会清空，需要改 SKILL.md |
| 信任 `epic.yaml` 中的 `status: done` 作为事实源 | 可以，但 `mvt-status`、`mvt-help` 等 skill 依赖 `active_epic` 判断当前状态 |

---

## 5. 推荐修复方向

### 方向 1 — 修改 `mvt-update-plan`（高优先级）

在 Step 5 的 (y) 路径中，读取 `epic-update.cjs` stdout 的 `epic_status` 字段：

- 如果 `epic_status === "done"` → 追加 `--close-epic`
- 其余情况不变

影响范围：
- `.claude/skills/mvt-update-plan/SKILL.md` — Step 5 决策逻辑 + State Update 命令模板

### 方向 2 — 修改 `mvt-cleanup`（中优先级）

在 Step 9 规则表中增加 Epic 相关行，并在 State Update 中支持条件性追加 `--close-epic`：

- 条件：`active_epic.id` 非空 且 对应 `epic.yaml` 中 `status === "done"`
- 动作：在 session-update 调用中追加 `--close-epic`

影响范围：
- `.claude/skills/mvt-cleanup/SKILL.md` — Step 9 规则表 + State Update 段落

### 方向 3 — 修改 `epic-update.js`（低优先级/可选）

让 `completeChild()` 在 `epic.status === "done"` 时也返回信号，方便调用方（AI 或脚本链）轻松判断是否需追加 `--close-epic`。

→ **已实现**：`epic_status` 字段已在返回值中。

---

## 6. 关联的 Test 分析

已有测试覆盖：

| 测试 | 文件位置 | 覆盖内容 |
|------|---------|---------|
| `sets matching epics[] entry to done and clears active_epic` | `test/session-update.test.ts:256` | `--close-epic` 的基本行为 |
| `rejects --close-epic with --new-epic` | `test/session-update.test.ts:284` | 互斥校验 |
| `preserves epic_id in changes[] snapshot on --close-change` | `test/session-update.test.ts:333` | epic_id 在 `--close-change` 中被保留 |
| `resets epic_id to empty on active_change after --close-change` | `test/session-update.test.ts:354` | `--close-change` 清空 epic_id |
| `preserves existing epic_id when --new-change omits --epic-id` | `test/session-update.test.ts:371` | 重新 `--new-change` 时不丢失 epic_id |
| `preserves created_at when --new-change re-invoked on same change` | `test/session-update.test.ts:385` | 同一 change 重入时保留 created_at |

**缺少的测试**：
- `epic-update.cjs --complete-child` 后最后一个子 change 完成时 `epic.status` 变为 `done` 的端到端验证
- `mvt-update-plan` 在 `epic_status === "done"` 时是否追加 `--close-epic` 的行为测试
- `mvt-cleanup` 在归档已完成 Epic 时是否清空 `active_epic` 的行为测试

---

## 7. 附录：关键代码引用

### `session-update.js` — `--close-epic` 实现（第 393–412 行）

```js
if (args["close-epic"]) {
    session.epics = session.epics || [];
    session.active_epic = session.active_epic || {};
    const aeId = session.active_epic.id;
    if (aeId) {
      const epicIdx = session.epics.findIndex((e) => e.id === aeId);
      if (epicIdx >= 0) {
        session.epics[epicIdx].status = "done";
        session.epics[epicIdx].updated_at = now;
      }
    }
    session.active_epic = {
      id: "",
      title: "",
      created_at: "",
      epic_path: "",
    };
}
```

### `epic-update.js` — `recomputeCurrentChange()`（第 281–296 行）

```js
function recomputeCurrentChange(epic) {
  const children = epic.children || [];
  const resolvedIds = new Set(
    children.filter((c) => TERMINAL_STATUSES.includes(c.status))
      .map((c) => c.change_id)
  );
  const next = children.find(
    (c) => c.status === "pending" &&
      (c.depends_on || []).every((d) => resolvedIds.has(d))
  );
  if (next) {
    next.status = "active";
    epic.current_change = next.change_id;
  } else {
    epic.current_change = "";
    const allTerminal = children.length > 0 &&
      children.every((c) => TERMINAL_STATUSES.includes(c.status));
    if (allTerminal) epic.status = "done";
  }
  return next ? next.change_id : "";
}
```

### `mvt-cleanup/SKILL.md` — Step 9 规则表（当前）

```
| Actual cleanup action | session-update parameters |
|----------------------|---------------------------|
| Closed active_change (all plan tasks completed) | --close-change --truncate-history <N> |
| Only truncated history / archived old changes (active_change still in progress) | --truncate-history <N> (do NOT pass --close-change) |
```

### `mvt-update-plan/SKILL.md` — Step 5 当前逻辑

```
4. On y:
  - epic-update.cjs --epic "<path>" --complete-child <id>
  - session-update.cjs --close-change
  - Display: next child info from epic-update stdout. Suggest /mvt-analyze.
```

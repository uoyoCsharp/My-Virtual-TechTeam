# mvt-design 提示词优化提案

> 审查对象：`sources/skills/mvt-design/business.md`（Step 3 "Choose Architecture Style"）
> 日期：2026-06-19
> 状态：待审核

---

## 问题诊断：Step 3 的结构性问题

### 1. 互斥选择 vs 多维组合

5 行风格来自**不同架构维度**，并非互斥：

| Style | 真实维度 |
|-------|----------|
| Plain CRUD / 3-layer | 分层策略 |
| Service-oriented within a module | 内部组织粒度 |
| Domain-driven | 核心逻辑建模哲学 |
| Event-driven / async | 通信范式（同步/异步） |
| Multi-service / boundary split | 部署拓扑 |

一个系统可**同时**是 domain-driven + event-driven + 3-layer。"Pick the row" 的单选交互强迫 AI 选一个，无法表达多维组合。

### 2. "Escalate" 暗喻无阶梯对齐

> "select the **smallest viable** architecture style. **Escalate** only when concerns force it."

暗示存在从小到大的阶梯，但表格是 unordered list，未指明行间 escalate 关系。按不同维度解读，阶梯方向不一致（结构简单度 vs 概念复杂度 vs 耦合度），AI 无法判断 escalate 方向。

### 3. 语法不一致

- **DEFER 混入 Avoid 列**：Multi-service 行的 Avoid 列写的是操作指令"DEFER"，其他行是性质描述（名词性）。元级指令混入领域级描述。
- **CRUD / 3-layer 概念捆绑**：Plain CRUD（数据库操作风格）与 3-layer（应用分层架构）不是同义词。3-layer 可有丰富业务规则，CRUD 可在单层完成。捆绑暗示等价，导致 AI 理解分歧。

### 4. 与 Step 2 断连

Step 2 产出 Concerns Table（`concern | priority`），但 Step 3 的 Use when 条件**未引用** Step 2 的 Concern 或 Priority。两步之间无映射机制，Step 2 产出未喂入 Step 3。

### 5. 与下游的耦合脆弱

`mvt-implement` Step 2.2 的拓扑排序硬编码引用了此处的 style label（P1-1 提案）。若 Step 3 本身有问题，下游映射也站不住。

---

## Step 3 的三个核心价值（不可默默丢弃）

经深入检验，Step 3 虽形式有问题，但承载三个核心价值：

| 核心价值 | 当前实现位置 | 作用 |
|---|---|---|
| **"smallest viable" 反过度工程护栏** | Step 3 的 What 描述 | 校准 LLM 天然倾向过度工程的倾向 |
| **multi-service scope guard** | Step 3 末尾 STOP 指令 | 防止 AI 悄悄把单服务项目设计成微服务 |
| **风格→模块的认知引导** | Step 3 的表格 | 引导 Step 4 的模块设计粒度（DDD 聚合根 vs CRUD 按表映射） |

---

## 方案对比

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 删除 Step 3，价值迁移到 Step 4** | Step 4 开头加"从满足 concerns 的最简单结构开始"原则；branches 表加 multi-service guard；风格认知引导由 Concerns Table 隐式驱动 | 流程最简洁；消除互斥选择问题；下游 mvt-implement 改为从 Module Design 依赖图推导拓扑顺序 | AI 从 concerns→modules 的推导一致性下降；认知引导变隐式 |
| **B. 保留 Step 3 但重构** | 改为分维度评估（非单选）；加 escalate 阶梯；显式连接 Step 2 的 Concern | 保留显式决策点；认知引导保持显式 | 表格设计复杂；改动大；多维组合的交互模式难定义 |
| **C. 合并 Step 2 + Step 3** | "For each concern, identify the architectural response"——concern 与风格响应在同一张表 | 消除断连；concern 直接驱动架构响应 | Step 2 变重；仍需处理多维组合问题 |

---

## 推荐方案：A（删除 + 价值迁移）

**理由**：
1. 对绝大多数 change（已有项目中加功能），项目既定风格已由代码库 + `project-context.md` 承载，Step 3 不产生新信息
2. 真正重要的架构决策由 Step 6 ADR 兜底，不依赖 style label 触发
3. 下游 `mvt-implement` 改为从 Module Design 依赖图推导拓扑顺序，比按 style label 查表更可靠
4. 三个核心价值均可显式迁移到 Step 4，不丢失

**前提条件**（必须同步完成）：

| 迁移项 | 迁移到 | 具体内容 |
|---|---|---|
| "smallest viable" 护栏 | Step 4 开头原则 | 加一句："Start from the simplest structure that satisfies the concerns; add complexity only when a concern cannot be met without it." |
| multi-service scope guard | Step 4 branches 表 | 新增一行：`Design implies multi-service but project is single-service → STOP, ask user to confirm scope expansion` |
| 风格认知引导 | Step 4 How 步骤 | Step 4.1 改为："Map each Concern to an owning module; let the concern's nature guide the module's granularity (rich business rules → aggregate/entity modules, simple data access → CRUD modules, async flows → event handler modules)." |

---

## 影响范围

| 文件 | 改动 |
|---|---|
| `sources/skills/mvt-design/business.md` | 删除 Step 3；Step 4 补入迁移价值；Step 6 ADR 门控移除"Choice of architecture style"条目；Step 7 确认条件移除"Step 3 escalated to multi-service"（改为引用 Step 4 branches）；Step 8 Required sections 无需改（本就无 Style 段） |
| `sources/skills/mvt-implement/business.md` | P1-1 提案的拓扑顺序映射表改为"从 Module Design 依赖图推导"，不再按 style label 查表 |
| `sources/templates/design-output/body.md` | 无需改（本就无 Architecture Style 段） |

---

## 待决策项

1. **是否认可方案 A**（删除 Step 3 + 价值迁移到 Step 4）？还是倾向 B（保留重构）或 C（合并 Step 2+3）？
2. **"smallest viable" 护栏的迁移措辞**：是作为 Step 4 的开场原则，还是作为全局设计原则放在更上层？
3. **风格认知引导**：迁移到 Step 4.1 的"let the concern's nature guide"是否足够？还是需要更显式的 concern→pattern 映射表？

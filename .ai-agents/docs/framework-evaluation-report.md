# AI Agent Framework 设计评估报告

**评估日期**: 2026-03-08
**评估范围**: `.ai-agents/` 框架完整设计
**评估视角**: Prompt工程最佳实践

---

## 执行摘要

本报告从Prompt工程角度对该AI Agent框架进行深度分析。框架整体设计思路清晰，采用了多Agent协作、工作流驱动、知识库分离等先进理念。但存在若干设计不合理之处，可能影响实际使用效果。

**整体评分**: 7.2/10

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | 8.0/10 | 分层清晰，但存在冗余 |
| Prompt质量 | 6.5/10 | 缺乏约束力，易被绕过 |
| 上下文管理 | 7.5/10 | 层级设计合理，但实现复杂 |
| 工作流设计 | 7.0/10 | 状态机完善，但灵活性不足 |
| 可扩展性 | 7.5/10 | 动态发现机制好，但配置分散 |
| 一致性 | 6.0/10 | 存在多处不一致 |

---

## 一、架构设计分析

### 1.1 优点

#### 分层清晰
```
FRAMEWORK.md (入口)
    ├── agents/ (角色定义)
    ├── skills/ (技能模块)
    ├── knowledge/ (知识库)
    ├── workflows/ (工作流)
    └── workspace/ (状态管理)
```

#### 平台适配器设计
框架设计了 `platforms` 配置，支持 Claude Code 和 GitHub Copilot，体现了良好的可移植性考虑。

### 1.2 问题

#### 问题1: 文件组织存在冗余

**现状**:
- `agents/_commands/` 目录包含13个命令文件
- 每个命令文件都重复了Agent的核心职责描述
- `agents/` 目录的Agent定义文件和 `_commands/` 目录内容高度重叠

**示例**: `agents/conductor.md` 已定义职责，而 `agents/_commands/init.md` 又重新描述执行流程。

**影响**:
- Token浪费：加载命令时重复读取相似内容
- 维护成本高：修改需要同步多处
- 一致性风险：描述不一致导致行为模糊

**建议**: 采用"引用+扩展"模式，命令文件只包含该命令特有的执行细节，不再重复角色定义。

#### 问题2: 元数据格式不统一

**现状**:
```yaml
# agents/conductor.md 使用 YAML frontmatter
---
id: conductor
name: Conductor
commands: [...]
---

# agents/_shared.md 使用纯Markdown
# Shared Agent Rules
All agents MUST follow these rules.
```

**影响**: 解析逻辑复杂化，不便于自动化处理。

**建议**: 统一使用YAML frontmatter格式。

---

## 二、Prompt设计深度分析

### 2.1 Agent角色定义问题

#### 问题1: 角色边界约束不足

**现状** (`agents/analyst.md`):
```markdown
### MUST NOT Do
- Make assumptions without noting them
- Provide implementation suggestions
- Make technology recommendations
- Make architecture decisions
```

**问题**: "MUST NOT" 是自然语言约束，LLM容易忽略。缺乏强制性的结构约束。

**示例场景**:
```
用户: #analyze 用户需要登录功能，我觉得应该用JWT

Analyst可能会输出:
- 建议使用JWT认证  ← 违反了 "不做技术建议" 规则
```

**建议**:
1. 使用结构化输出格式强制约束
2. 添加"自检清单"，输出前必须通过检查
3. 设计"护栏prompt"，在关键输出前验证

#### 问题2: 角色切换机制脆弱

**现状** (`agents/_shared.md`):
```markdown
When user input starts with `#{command}`:
1. Announce: Output `[{Agent} Mode]`
2. Load: READ `agents/{agent}.md`
3. Execute: Follow agent's rules
```

**问题**:
- 依赖LLM主动"切换模式"，但LLM可能忘记当前角色
- 没有强制性的角色上下文注入机制
- 多轮对话中角色边界容易模糊

**示例场景**:
```
用户: #analyze 用户登录需求
[Analyst Mode] 分析完成...

用户: 帮我写代码实现
LLM可能直接写代码，忘记自己还是Analyst角色
```

**建议**:
1. 每轮响应都强制输出当前角色标识
2. 设计角色边界检查机制
3. 添加"跨角色请求检测"，自动提示正确命令

### 2.2 命令Prompt问题

#### 问题1: 执行流程过于抽象

**现状** (`agents/_commands/implement.md`):
```markdown
**Step 2: Plan Implementation**
- Identify files to create/modify
- Determine implementation order
- Note dependencies
```

**问题**: 步骤描述过于抽象，缺乏具体的思考框架和决策树。

**建议**: 添加决策树和checklist:
```markdown
**Step 2: Plan Implementation**

Decision Tree:
1. Is this a NEW module?
   → Check architecture.yaml for module boundaries
   → Create file in correct layer
2. Is this MODIFYING existing code?
   → Read code-mapping.yaml for related files
   → Check dependencies

Checklist before coding:
- [ ] Confirmed layer assignment
- [ ] Identified dependencies
- [ ] Checked coding standards
```

#### 问题2: 示例驱动的Prompt缺乏泛化指导

**现状**: 大量使用Example来指导行为，但缺乏泛化规则。

**示例** (`agents/_commands/review.md`):
```markdown
## Example 1: General Code Review
[详细示例...]
```

**问题**: Example只覆盖有限场景，遇到新场景时LLM行为不可预测。

**建议**: 添加"原则+示例"模式:
```markdown
## Review Principles

1. **Traceability**: Every issue must trace to a rule in knowledge/
2. **Specificity**: Suggestion must include file:line reference
3. **Actionability**: Every issue must have a concrete fix suggestion

## Examples
[基于原则的示例]
```

---

## 三、上下文管理分析

### 3.1 优点

#### 分层加载策略
```yaml
# config.yaml
smart_context:
  rules:
    - trigger: "fix.*bug|modify.*feature"
      action: load_related_code
      context_level: minimal
```

根据任务复杂度动态调整上下文，有效控制Token消耗。

### 3.2 问题

#### 问题1: 上下文加载职责分散

**现状**: 上下文加载逻辑散布在多个位置：
- `config.yaml` - 加载规则定义
- `agents/_shared.md` - 加载指令
- `skills/_system/context-loader.md` - 加载技能
- 各Agent文件的 `context:` 部分
- 各命令文件的执行步骤

**影响**:
- 难以追踪实际加载了什么上下文
- 配置冲突时难以调试
- 新增上下文源需要修改多处

**建议**: 统一到 `context-loader.md` 管理，其他文件只引用。

#### 问题2: 依赖声明与实际加载不匹配

**现状** (`agents/developer.md`):
```yaml
context:
  required:
    - workspace/state/session.yaml
    - workspace/context/architecture.yaml
  optional:
    - knowledge/principle/coding-standards.md
```

**问题**:
- 声明了"required"，但实际是建议加载，缺乏强制校验
- `optional` 的加载时机不明确
- 缺少加载失败时的处理逻辑

**建议**:
```yaml
context:
  required:
    - path: workspace/state/session.yaml
      validate: file_exists
      on_missing: error
  optional:
    - path: knowledge/principle/coding-standards.md
      condition: "command == 'implement'"
      on_missing: warn
```

---

## 四、工作流设计分析

### 4.1 优点

#### 完整的状态机定义
```yaml
# workflows/requirement-to-code.yaml
transitions:
  - from: analyze
    to: design
    trigger: "#design"
    guard: "requirements.yaml exists && user_confirmed"
```

状态转换有前置条件(guard)和触发器，设计合理。

### 4.2 问题

#### 问题1: 状态管理过于理想化

**现状**: 工作流假设严格的线性执行：
```
analyze → design → implement → review → test
```

**问题**:
- 实际开发中经常需要回溯、跳过步骤
- `rollback` 配置存在但缺乏具体的回滚策略
- 没有处理"部分完成"的场景

**示例场景**:
```
用户: #analyze 完成
用户: 直接 #implement（跳过 design）

框架如何处理？当前设计会阻止，但实际中可能需要灵活性
```

**建议**: 添加"快速通道"和"显式跳过"机制:
```yaml
transitions:
  - from: analyze
    to: implement
    trigger: "#implement"
    guard: "user_confirmed_skip_design"
    warning: "Skipping design phase may lead to inconsistent implementation"
```

#### 问题2: 并发状态处理不明确

**现状**: `session.yaml` 只追踪单一工作流状态。

**问题**: 不支持并行处理多个独立任务。

**建议**: 设计多任务状态管理:
```yaml
session:
  active_tasks:
    - id: task-001
      workflow: requirement-to-code
      phase: design
    - id: task-002
      workflow: code-review
      phase: review
```

---

## 五、知识库组织分析

### 5.1 优点

#### 模式化组织
```
knowledge/
├── core/           # 通用原则
├── patterns/       # 架构模式
│   ├── ddd/
│   ├── clean-architecture/
│   └── frontend-react/
├── principle/      # 项目标准
└── project/        # 定制知识
```

分层清晰，便于按需加载。

### 5.2 问题

#### 问题1: 知识粒度不均匀

**现状**:
- `knowledge/core/software-principles.md` 包含SOLID、DRY、KISS等所有原则（223行）
- `knowledge/patterns/ddd/overview.md` 只有概念介绍（150行）

**问题**:
- 大文件难以按需加载部分内容
- Token消耗不可控
- 检索效率低

**建议**: 按主题拆分:
```
knowledge/core/
├── solid/
│   ├── srp.md
│   ├── ocp.md
│   └── ...
├── principles/
│   ├── dry.md
│   ├── kiss.md
│   └── yagni.md
```

#### 问题2: 知识与技能边界模糊

**现状**:
- `knowledge/patterns/ddd/review-checklist.md` 是知识文件
- `skills/review-execution.md` 是技能文件，引用了知识文件

**问题**: 职责边界不清，review-checklist 可以看作知识，也可以看作技能的一部分。

**建议**: 明确边界:
- **知识(Knowledge)**: 静态的概念、原则、规则
- **技能(Skill)**: 动态的执行流程、操作步骤

---

## 六、一致性审计

### 6.1 命名不一致

| 位置 | 不一致项 |
|------|----------|
| `FRAMEWORK.md` vs `registry.yaml` | 命令数量描述一致，但实际命令文件有14个 |
| Agent文件 | `context.required` vs `Context Loading` 章节的描述格式不同 |
| 工作流文件 | `states` 和 `phases` 两个配置描述相同内容 |

### 6.2 引用路径不一致

**示例**:
```markdown
# agents/_shared.md
- workspace/state/session.yaml

# skills/_system/context-loader.md
- workspace/state/semantic-index.yaml  # 额外的文件，_shared.md未提及
```

### 6.3 输出格式不一致

**示例** (`agents/analyst.md` vs `agents/reviewer.md`):
```markdown
# analyst.md
### Features Identified
| Feature | Description | Priority |

# reviewer.md
### Critical Issues
#### C{N}: {Issue Title}  # 使用不同的标题层级
```

---

## 七、缺失的关键设计

### 7.1 缺少错误恢复Prompt

**现状**: 配置文件有 `error_recovery` 配置，但缺少具体的Prompt指导LLM如何处理错误。

**建议**: 添加 `agents/_error-recovery.md`:
```markdown
# Error Recovery Protocol

When encountering errors:

1. **Classify Error Type**
   - Missing prerequisite → Route to correct phase
   - Context conflict → Request clarification
   - Tool failure → Retry with alternative approach

2. **Recovery Actions**
   - Log error in session.yaml
   - Suggest user actions
   - Offer rollback if applicable
```

### 7.2 缺少质量门禁

**现状**: 各阶段的 `exit_criteria` 只是文件存在检查，缺少质量验证。

**建议**: 添加质量门禁Prompt:
```yaml
exit_criteria:
  - type: quality_gate
    checks:
      - "analysis has no unresolved clarifications"
      - "all features have priority assigned"
```

### 7.3 缺少Token预算管理

**现状**: 配置中有 `max_tokens` 但没有实际的预算控制逻辑。

**建议**: 添加Token预算Prompt:
```markdown
# Token Budget Management

Before loading context, estimate:
- System prompt: ~1000 tokens
- Knowledge base: ~2000 tokens (if level 3)
- Output budget: ~3000 tokens

If budget exceeded:
1. Switch to lighter context level
2. Use summary instead of full content
3. Load only relevant sections
```

---

## 八、改进建议汇总

### 8.1 高优先级

| # | 建议 | 影响 |
|---|------|------|
| 1 | 统一Prompt格式，使用结构化输出约束 | 减少角色越界 |
| 2 | 添加强制性的角色标识输出机制 | 防止角色混淆 |
| 3 | 重构命令文件，消除与Agent定义的冗余 | 降低Token消耗 |
| 4 | 细化知识库粒度 | 提高加载效率 |

### 8.2 中优先级

| # | 建议 | 影响 |
|---|------|------|
| 5 | 添加工作流快速通道 | 提高灵活性 |
| 6 | 统一上下文加载管理 | 降低复杂度 |
| 7 | 添加错误恢复Prompt | 提高鲁棒性 |
| 8 | 添加质量门禁 | 保证输出质量 |

### 8.3 低优先级

| # | 建议 | 影响 |
|---|------|------|
| 9 | 统一命名规范 | 提高可维护性 |
| 10 | 添加Token预算管理 | 优化成本 |

---

## 九、重构建议

### 9.1 Prompt结构重构

建议采用以下结构：

```
.ai-agents/
├── FRAMEWORK.md          # 简化为入口指引
├── registry.yaml         # 保持不变
├── config.yaml           # 保持不变
│
├── agents/
│   ├── _base.md          # 所有Agent的基础Prompt
│   ├── _constraints.md   # 强制约束（所有Agent必须遵守）
│   ├── _output-format.md # 统一输出格式
│   ├── conductor.md      # 只包含角色特有定义
│   └── ...
│
├── commands/
│   ├── init.md           # 只包含执行步骤，引用Agent定义
│   └── ...
│
├── knowledge/
│   ├── core/
│   │   ├── solid/
│   │   │   ├── srp.md
│   │   │   └── ...
│   │   └── principles/
│   │       ├── dry.md
│   │       └── ...
│   └── patterns/
│       └── ...
│
└── workspace/
    └── ...
```

### 9.2 核心Prompt模板

建议Agent文件采用以下模板：

```markdown
---
id: {agent_id}
name: {name}
commands: [{command_list}]
---

# {name} Agent

## Identity
You are the **{name}** - {one_sentence_identity}.

## Constraints (MUST follow)
<!-- 这些约束会被自动验证 -->
{constraint_1}
{constraint_2}

## Capabilities
- {capability_1}
- {capability_2}

## Output Contract
<!-- 结构化输出格式 -->
```json
{
  "role": "{agent_id}",
  "phase": "{current_phase}",
  "output": { ... }
}
```

## Decision Framework
| Situation | Action |
|-----------|--------|
| {situation} | {action} |

## Handoff Protocol
When task is complete or out of scope:
1. Update session.yaml
2. Output suggested next command
3. Clear temporary context
```

---

## 十、结论

该AI Agent框架在设计理念上具有前瞻性，采用了多Agent协作、知识库分离、分层上下文加载等先进技术。但从Prompt工程角度看，存在以下核心问题：

1. **约束力不足**: 大量使用自然语言描述"应该/不应该"，LLM容易忽略
2. **结构性冗余**: Agent定义与命令文件内容重叠
3. **一致性缺失**: 命名、格式、路径存在多处不一致
4. **容错性欠缺**: 缺少错误恢复和质量门禁机制

建议优先解决约束力问题和结构性冗余，这将显著提升框架的实际效果。

---

**评估人**: Claude (AI Assistant)
**版本**: 1.0

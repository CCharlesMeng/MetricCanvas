# 复盘台账（session-optimize）

按 Pattern-Key 去重，按 Recurrence-Count 计数。格式见 session-optimize/references/learnings-ledger.md。

本文件独立于同目录下其他工具的 LEARNINGS.md / ERRORS.md 等文件，清理那些文件时不要连带删除本文件。

---

## [RETRO-20260810-001] decision.ask-before-discovery

**类别**: 流程/决策（L2）
**严重程度**: 中
**Status**: pending
**Pattern-Key**: decision.ask-before-discovery
**Recurrence-Count**: 1
**First-Seen**: 2026-08-10
**Last-Seen**: 2026-08-10

### 问题

设计与组件分析在完成仓库/原型事实归因前就进入批量提问，使用户重复提供部分可直接发现的视口、字体与布局信息。

### 证据

- 会话中用户明确纠正“为什么会问这个问题，从存量项目中无法识别到吗”
- 同轮回复包含“默认字体，没说就是默认”与“html都给了”
- `参考/流水分析报告/tasks.md:5-7` 后续能从项目/设计事实固定 1200px 基准、四档视口与组件路径

### 处置

设计分析的澄清问题必须先有 provenance：只询问工件不可观测、来源冲突或会改变产品边界的项。本次首次记账，作为下一 Story 的可逆试验候选。

### Metadata

- 去向: 移交 `sdd-dev-frontend` 维护者
- 相关文件: `.agents/skills/sdd-dev-frontend/references/story-artifact-templates.md`
- See Also: —

## [RETRO-20260810-002] decision.constraint-drop

**类别**: 流程/决策（L2）
**严重程度**: 高
**Status**: pending
**Pattern-Key**: decision.constraint-drop
**Recurrence-Count**: 1
**First-Seen**: 2026-08-10
**Last-Seen**: 2026-08-10

### 问题

Task 计划已明确的行为、响应式与工程约束没有在对应 Task 结束时机械清零，Phase C 成为首次发现六类已知问题的防线。

### 证据

- `参考/流水分析报告/tasks.md:158-163` 已声明 error/empty、非有限数、actual/forecast 边界与空值行为
- `参考/流水分析报告/tasks.md:189-196` 已声明 1000/1200/1680/1920px 判定
- `参考/流水分析报告/dev-review.md:29-34` 记录 token、`any`/断言、error→empty、预测边界和 1000px 裁切在收口检视才被报出

### 处置

每个 Task Step ④/⑤ 需有“已知约束 → 检查方式 → 结果”的清零门：行为约束落 RED/GREEN 或还原规则，工程约束落命令/diff 检查，布局 Task 当即跑冻结视口。该原则能防止错误结果，申请固化时交由 skill 维护者评估。

### Metadata

- 去向: 移交 `sdd-dev-frontend` 维护者
- 相关文件: `.agents/skills/sdd-dev-frontend/SKILL.md`
- See Also: RETRO-20260810-001

## [RETRO-20260810-003] project.silent-failure

**类别**: 项目实现（L4）
**严重程度**: 高
**Status**: pending
**Pattern-Key**: project.silent-failure
**Recurrence-Count**: 1
**First-Seen**: 2026-08-10
**Last-Seen**: 2026-08-10

### 问题

还原工具链曾在语义期望与 DOM 原始事实没有可比较协议时产出 GREEN，使验收结果看似成功但不能证明契约成立。

### 证据

- `参考/流水分析报告/alpha-tests.md:35` 明确撤销“旧 GREEN”并记录协议缺失
- `.agents/skills/sdd-dev-frontend/references/restore-contract.md:109-125` 是本轮补入的 text/constraints/object.fields 与 adapter 判定字段禁止协议
- `.agents/skills/sdd-dev-frontend/evals/test_extract_design_spec.py:951-1023` 补了 adapter 拒绝和 text GREEN/RED 对照

### 处置

新增检查模式必须同时有 GREEN 与 RED fixture；Story 接受 GREEN 前对关键语义规则和几何规则各做一次 mutation，证明可控缺陷确实会转 RED。本项属错误验收风险，一次即申请固化。

### Metadata

- 去向: 移交 `sdd-dev-frontend` 维护者
- 相关文件: `.agents/skills/sdd-dev-frontend/references/restore-contract.md`, `.agents/skills/sdd-dev-frontend/evals/test_extract_design_spec.py`
- See Also: RETRO-20260810-002

## [RETRO-20260810-004] decision.undeclared-input

**类别**: 流程/决策（L2）
**严重程度**: 中
**Status**: pending
**Pattern-Key**: decision.undeclared-input
**Recurrence-Count**: 1
**First-Seen**: 2026-08-10
**Last-Seen**: 2026-08-10

### 问题

布局检视派发没有把已验证的浏览器 harness 声明为可执行输入，子代理选了空连接器通道并误报“无法实证”。

### 证据

- 会话检视首轮回传为浏览器列表 `[]`，不再尝试仓内 Playwright
- 明确指定 Playwright + 本地 Chrome 后，四档视口与截图全部成功
- `.agents/skills/sdd-dev-frontend/agents/review-layout.md:5-32` 要求打开页面，但未声明具体 `<browser-driver>` 字段和成功探针

### 处置

检视输入需声明 `browser-harness = 启动命令 / 驱动 / URL / 成功探针`，reviewer 必须先跑指定 harness；单一连接器空结果不能判整个环境缺失。本次首次记账，只作可逆试验候选。

### Metadata

- 去向: 移交 `sdd-dev-frontend` 维护者
- 相关文件: `.agents/skills/sdd-dev-frontend/agents/review-layout.md`
- See Also: RETRO-20260810-003

# AGENTS.md — IOC 数据开发工作区导航(AI Agent 入口)

本目录是 IOC 数据开发的垂直领域工作区。AI Agent 按以下顺序理解本工作区:

## 1. 我是谁

IOC 数据开发 Agent。四仓契约:

| 仓 | 职责 | 真源路径 |
|----|------|----------|
| schemas | 定义流程(artifacts DAG + skills 白名单 + validation) | `codespec/schemas/ioc-workflow/schema.yaml` |
| agentcenter (skills) | 提供 skill 执行逻辑 | `skills/`(实现)+ `.cac/skills/`(注册索引) |
| codespec CLI | 唯一运行时调度者 | 外部 CLI;不可用时走手动路径 |
| MetaSpec (ioc-kernel) | 规范单向约束源(公理+策略+守卫+门禁词汇) | `codespec/guidelines/ioc-kernel/` |

## 2. 先读什么(按序)

1. `codespec/guidelines/ioc-kernel/core-ontology.md` — 顶层类 + CORE-AX*/KW-AX* 公理(不可违反)
2. `codespec/schemas/ioc-workflow/schema.yaml` — 流程全量注册表(DAG/技能/门禁/校验)
3. `codespec/guidelines/ioc-kernel/gates-glossary.md` — 门禁词汇(唯一真源)
4. `codespec/guidelines/ioc-kernel/policies-index.yaml` — POL-* 策略
5. `codespec/guidelines/ioc-kernel/contracts-index.md` — 契约产物(Deliverable/Evidence/Governance/Asset-Delta)
6. `harness/stages/<当前阶段>.md` — 当前阶段薄卡片

## 3. 核心纪律(每次执行必须遵守)

- **CORE-AX4 唯一真源优先**:写维表/指标/数据设计约束前,先查 `knowledge-base/` 基线。
- **CORE-AX3 从磁盘读**:写列名/表名时,必须从磁盘重读 evidence,禁止凭记忆。
- **CORE-AX9 Fail-Closed**:`sdd_stage_gate.py` 返回 BLOCKED 即停工;禁止自改 `change-manifest.yaml` 的 `gates.*` 绕过。
- **CORE-AX10 工具失败即停工**:`clouddp-cli`/`cloudioc-cli` 失败时禁止落盘 evidence。
- **CORE-AX8 澄清须人工**:澄清项 `answered`/`closed` 只能由人类裁定,AI 不得 closed P0。

## 4. 阶段流程

- data 主路径(15 阶段):`intake → requirement → data-design → ads-design → ads-design-validation → ads-clarification-apply → clouddevops-review → sql-bindings-ready → sql-generate → sql-validation → job-create(TEST) → platform-test → promotion → job-create(FORMAL) → platform-formal → archive`
- subject 主路径(13 阶段):`requirement → subject-design → subject-design-validation → subject-clarification-apply → subject-sql-bindings-ready → sql-generate → sql-validation → job-create → platform-test → promotion → platform-formal → archive`
- 并行轨道(ads-design-validation 后):service 三件套(service-design → service-develop → frontend-plan)+ 测试三件套(test-analyzer → testpoint-analyzer → testcase-designer)

完整映射见 `codespec/schemas/ioc-workflow/schema.yaml` 与 `harness/stages/`。

## 5. 工作区布局

- `codespec/changes/{version}/{feature-id}/` — 增量工作区(每个 feature 一个目录,含 `change-manifest.yaml`、产物、evidence)
- `harness/tools/` — 门禁与校验脚本(经 bash 调用,`python harness/tools/sdd_stage_gate.py --feature <dir> --stage <stage-id>`)
- `knowledge-base/` — 基线真源(先查后写)

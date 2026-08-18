# gates-glossary.md — 门禁词汇(唯一真源)

> 位置:`codespec/guidelines/ioc-kernel/gates-glossary.md`
> 规则:门禁的语义以本文档为准;`schema.yaml` 的 gates 注册表与 `harness/tools/sdd_stage_gate.py` 引用本文档。

## 1. 五类门禁

| 类型 | 含义 | 何时检查 | 处置 |
|------|------|----------|------|
| Invariant | 始终成立的真源规则(CORE-AX* / KW-AX*) | 任何时刻 | 违反即停工 |
| Definition of Done | 阶段退出时必须满足的声明式清单 | 退出前 | 未满足不得退出 |
| Decision Gate | 仅当存在人类拍板才需确认 | 决策点 | 等待人类裁定 |
| Handoff Gate | 不可逆/跨阶段交接的硬边界 | 交接前 | 未过不得交接 |
| Playbook | 高自由度建议路径,可重排/跳过/循环 | 执行中 | 建议 |

## 2. manifest gates.* 字段(12 个)

| gate 字段 | 置位者 | 阻塞下游 |
|-----------|--------|----------|
| data_design | ioc-data-design | ads-design |
| ads_design_validation | ioc-ads-design-validate | sql-generate 等(=fail 时) |
| clouddevops_review | sdd-clouddevops-update | sql-bindings-ready |
| ads_clarification_applied | 澄清闭环回写 | P0 open 时阻塞各阶段 |
| service_design | ioc-service-design | service-develop, frontend-plan |
| service_develop | ioc-service-develop | frontend-plan(条件) |
| sql_bindings_ready | sql-bindings-ready | sql-generate |
| sql_validation_static | sql-validator | job-create(TEST), platform-test |
| test_execution | platform-test | promotion |
| platform_test | platform-test | promotion |
| sql_promotion | promotion | archive |
| platform_formal | platform-formal | archive(建议 pass) |

## 3. gate 取值

| 值 | 语义 |
|----|------|
| not_started | 未开始(默认) |
| in_progress | 进行中(不得被下游引用) |
| pass | 已通过 |
| fail | 已失败(=阻塞下游) |
| waived | 豁免(须记录理由,仅限非强制 gate) |

## 4. 执行规则(CORE-AX9 Fail-Closed)

```bash
python harness/tools/sdd_stage_gate.py --feature <feature-dir> --stage <stage-id>
```

- 返回 `BLOCKED` 即停工(排除阻塞项前不得继续)。
- **禁止自改 gates.\* 绕过门禁**。
- **禁止伪造产物绕过门禁**。
- `blocks_when` 规则由 `harness/tools/blocks_when.py` 执行。

## 5. 决策点(Decision Gate)

仅当存在人类拍板才需确认:如 `job-create` 的 TEST/FORMAL 切换、`promotion` 的正式发布、`ads-clarification` 的 P0 裁定。AI 不得代替人类拍板(CORE-AX8)。

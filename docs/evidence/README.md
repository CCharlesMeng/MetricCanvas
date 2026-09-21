# 证据附件

这里放**被 ADR 正文、代码或正式文档当作论据引用的报告与基线**。它们不是过程件：过程件跟批次走，批次收口就整批进 [`docs/archive/`](../archive/README.md)；证据附件**跟决策走**——只要引用它的那份决策还生效，它就还在被读。

判据只有一条：**移走它会不会切断某份决策的论证链。** 会，就放这里。

| 文件 | 谁把它当论据 |
|---|---|
| [`2026-08-chat-bi-competitive-research.md`](./2026-08-chat-bi-competitive-research.md) | [ADR-0039](../adr/0039-derived-measure-templates-as-company-definitions.md) 与 [ADR-0040](../adr/0040-scope-card-as-control-panel.md) **正文**，是两份决策的论证依据 |
| [`2026-08-packages-architecture-review.md`](./2026-08-packages-architecture-review.md) | `packages/page/tests/schema-boundaries.test.ts` 的注释，用来解释那条边界为什么存在 |
| [`2026-09-08-legacy-baseline.md`](./2026-09-08-legacy-baseline.md) | 根 [`README.md`](../../README.md)；且它是 git tag `legacy/pre-static-platform-2026-09-08` 的**唯一索引**，丢了就找不回旧链 |
| [`2026-08-frontend-calculation-reconciliation.md`](./2026-08-frontend-calculation-reconciliation.md) | [`ioc-operation-map.md`](../archive/ioc-operation-map/ioc-operation-map.md) 三处称其为空值语义的「替代真源」 |
| [`2026-08-ioc-harness-capability-review.md`](./2026-08-ioc-harness-capability-review.md) + [`-action-pack.md`](./2026-08-ioc-harness-action-pack.md) | 互为索引的 IOC 能力证据档案 |
| [`dataset-reconciliation.md`](./dataset-reconciliation.md) | ADR 基线的[未决事项](../adr/topics/open-questions.md)，作为 [ADR-0033](../adr/0033-suspend-dataset-runtime.md) 恢复条件的逐条对账 |
| [`中间层分析.md`](./中间层分析.md) | [ADR-0006](../adr/0006-metadomain-layering-and-naming.md) 正文（「表服务」改名「数据服务」的来源）；`packages/engine/data-gateway/fixtures/services-list.json` 按它 §4.3.1 的字段形状录制 |
| [`组件分析.md`](./组件分析.md) | [ADR-0006](../adr/0006-metadomain-layering-and-naming.md) 正文 |
| [`architecture-formal-model.md`](./architecture-formal-model.md) | [ADR-0074](../adr/0074-browser-component-building-and-isolated-legacy-baseline.md) 与 [ADR-0076](../adr/0076-formal-architecture-contract-scope-and-enforcement.md) 正文，是形式化架构的模型草案；**草案未收口，校验器未实现** |
| [`wayfinder-107-pangu-integration-baseline.md`](./wayfinder-107-pangu-integration-baseline.md) | [ADR-0077](../adr/0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) 正文与[问数编排主题页](../adr/topics/ask-orchestration-and-scope-governance.md)，是盘古接入的可验收行为清单 |

## 读它们时注意

**证据附件记的是当时看到的事实，不是当前结论。** 现行结论一律以 ADR 与[主题页](../adr/topics/)为准；这些文件只回答「那条结论的依据是什么」。历史正文不改写——发现某份证据已经过期，改的是引用它的 ADR，不是回头改证据。

## 什么时候往这里加东西

写新 ADR 时如果正文要引用一份报告，先问这份报告会不会随批次收口进归档。会，就把它挪到这里再引用，并在上表补一行。**不要让 ADR 正文的链接指进 `docs/archive/`。**

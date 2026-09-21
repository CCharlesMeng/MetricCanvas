# 服务端计算数据集批次（2026-08，方向已挂起）

## 这批做了什么

两份文档：`dataset-handoff.md` 是项目背景与数据链路的交接（从企业内部数据大屏 / IOC 指标看板体系出发），`dataset规划.md` 是**服务端计算数据集**的设计——Transform 层（join / lookup / group / timeAlign / rank）加 Compute 层（`ratio` / `pctChange` / `cagr` 等具名算子），用来补齐 DQE 表达不了的那 30%–40% 派生计算。

## 结论落在哪

**这个方向被 [ADR-0033](../../adr/0033-suspend-dataset-runtime.md) 挂起，至今是 `proposed`、未实现。** 派生计算改由 DQE `formula` 承担。

挂起的三条理由，每条都还成立：

1. 它要求领域层出现**第二个聚合根**，实质修订 ADR-0006 / ADR-0007；
2. 它的 Transform 边界语义正是 [ADR-0015](../../adr/0015-defer-cascading-data-source-input-semantics.md) 挂起的那一批（空集与失败传播、输入集合上限、循环依赖校验、缓存键、取消语义）；
3. 它的正确性依赖尚未在真实数据侧补齐的**可加性与时间聚合方式**。

被保留下来以备恢复的唯一结论是「**不提供通用 `arithmetic`，只提供具名算子**」——[ADR-0046](../../adr/0046-controlled-computation-with-named-operators.md) 采纳了这一条，**但只是部分恢复**：它引入封闭具名算子，不恢复计算数据集聚合根，也不恢复 Transform/Compute 分层。**所以 ADR-0033 的三条恢复条件仍未满足，挂起未解除。**

## 恢复条件的逐条对账

在 [`docs/evidence/dataset-reconciliation.md`](../../evidence/dataset-reconciliation.md)——它被 ADR 基线的[未决事项](../../adr/topics/open-questions.md)当作论据引用，所以不在归档里，在证据层。

第一条的**契约侧已由 [ADR-0044](../../adr/0044-first-class-metric-entries.md) 打通，数据侧未补齐**；后两条未动。在此之前不得以任何名义在服务端或页面协议中引入 Transform/Compute 层。

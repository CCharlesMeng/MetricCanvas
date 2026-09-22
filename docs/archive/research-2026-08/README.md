# 早期调研（2026-08，未被任何决策引用）

## 这批是什么

三份 2026-08 的调研报告。与同期的竞品研究、中间层分析不同，**这三份全仓零引用**——没有 ADR 正文把它们当论据，也没有代码或正式文档指向它们。同期被引用的那几份已经进了 [`docs/evidence/`](../../evidence/README.md)。

| 文件 | 讲什么 | 相关决策（但未引用它） |
|---|---|---|
| `2026-08-attribution-diagnosis-data-inputs.md` | 归因诊断需要数据侧给出哪些输入 | [ADR-0043](../../adr/0043-attribution-diagnosis-as-a-sibling-analysis-form.md)（proposed，未实现） |
| `2026-08-dp-semantic-foundation.md` | DP 驱动的语义底座与本体层思路 | [ADR-0031](../../adr/0031-metrics-as-data-context-discovery-anchor.md)、[ADR-0044](../../adr/0044-first-class-metric-entries.md) |
| `2026-08-llm-sql-generation-best-practices.md` | 让大模型写对 SQL 的业界实践，以及「规则堆叠失效」的一手证据 | [ADR-0032](../../adr/0032-authoring-time-query-verification.md) 的验真链路 |

## 结论落在哪

**不在这三份里。** 归因诊断的现行设计基线是 ADR-0043 本身（仍是 proposed）；语义底座落在 ADR-0031 与 ADR-0044，现行结论见[数据获取与查询模型](../../adr/topics/data-fetching-and-query-model.md)；查询验真落在 ADR-0032，现行结论见[问数编排与口径治理](../../adr/topics/ask-orchestration-and-scope-governance.md)。

归因诊断当前卡在两项必须由数据侧给出的输入（指标条目的可加性、维度层级关系）——这条登记在[未决事项](../../adr/topics/open-questions.md)，不在本目录。

## 为什么留着

`2026-08-llm-sql-generation-best-practices.md` 里的「规则堆叠失效」是一手证据而不是转述，重开这个话题时值得先看一眼。另两份是没有被采纳的方案思考，保留以免同一条路被重走。

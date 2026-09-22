# 外部 skill 设计稿（2026-07 ~ 08，已收口）

## 这批做了什么

四份由外部 skill（`superpowers`）在改动前生成的设计稿。它们是**当时的实施设计**，不是决策记录，全仓没有任何文件引用它们。

## 结论落在哪

四份的结论都已经进了正式文档，读 ADR 就够：

| 设计稿 | 结论现在住在哪 |
|---|---|
| `2026-07-31-page-schema-v3-complete-migration-design.md` | [ADR-0017](../../adr/0017-page-schema-v3-hard-cutover.md) 页面 Schema v3 一次性硬切换 |
| `2026-08-03-ai-summary-and-component-title-normalization-design.md` | [ADR-0019](../../adr/0019-internalize-ai-summary-generation.md) AI 总结内化为垂直组件；现行结论见 [AI 总结组件](../../adr/topics/ai-summary-component.md) |
| `2026-08-12-section-container-and-row-alignment-design.md` | [ADR-0038](../../adr/0038-section-container-and-row-alignment-invariant.md) 分区容器单一真源与行对齐不变量 |
| `2026-07-31-objective-documentation-rewrite-design.md` | 文档客观化的写法要求，已并入 [`docs/agents/`](../../agents/) 与各正式文档自身 |

## 为什么留着

没有被引用、结论已出档，本可以删。留下的唯一理由是它们记录了**改动前的现场判断**——三份 ADR 的 Context 段写的是决定，这四份写的是当时看到的代码长什么样。要考古某次硬切换之前的实现形状时有用，除此之外不必打开。

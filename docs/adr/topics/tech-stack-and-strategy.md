# 技术栈与建设策略

> 为什么自研封闭领域 DSL 与 Svelte 运行时，而不是 A2UI 或开源 BI；严格声明式的边界在哪。

**现行结论:** 页面协议是自研的封闭领域 DSL,不采用 A2UI 或其他通用 agent→UI 协议;统一运行时基于 Svelte 自建,不采用或魔改 Grafana/Superset/Rill 等开源 BI;页面规格保持严格声明式,禁止表达式、脚本和自定义样式,复杂计算不进入页面层。ADR-0002 中 shadcn-svelte 的选型未落地，当前自建组件是实现事实；ADR-0066 明确它不是宿主消费前置，也不为文档对账引入该依赖。

这四份决策的共同前提是"页面协议的可控性是核心诉求":只有封闭、紧凑、可被 JSON Schema 完整校验的领域 DSL,才能让 AI 生成结果可控、可自动修复。0005 论证自建运行时的理由中,"数据服务是唯一数据入口"这一条已被 0014 的查询产物模型修订(现在的数据入口是数据网关,按查询产物分发到 SQL/DQE/组合执行适配器),但"规格可控性""避免长期跟随开源上游演进""内网部署与身份整合成本"等其余理由不变。

**已生效的修订:** [ADR-0046](../0046-controlled-computation-with-named-operators.md) 把 ADR-0003 的"复杂计算不进入页面层"修订为"计算只以封闭算子表达,开放语法面不进入页面层"。它不推翻 ADR-0003 的判据——禁的仍是可任意求值、语法面开放、无法被 JSON Schema 完整校验的东西——但承认封闭具名算子与 [ADR-0035](../0035-structured-relative-time-expressions.md) 的结构化相对时间同类,是声明式数据而非表达式。第一批算子(`ratio` / `delta` / `groupSubtotal` / `grandTotal` / `pivot`)已进入页面协议 5.1;第二批 `joinAggregate` 形状未定。

来源:[ADR-0001](../0001-domain-dsl-over-a2ui.md)、[ADR-0002](../0002-svelte-runtime.md)、[ADR-0003](../0003-strict-declarative-spec.md)、[ADR-0005](../0005-build-over-open-source-bi.md)。

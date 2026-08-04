# AI 总结组件内化与 Props 规范化设计

## 背景

客户活动风险简报中的风险总结原为带 `X/xx` 占位符的静态文本，无法随当前页面数据变化。现有页面数据源与数据网关只表达 `inline` 和 DQE `query` 业务数据；AI SSE 返回的是生成内容，不应伪装成第三种数据源。与此同时，存量文本组件使用 `heading`，其他组件使用 `title`，相同视觉概念存在两套 Props。

## 方案

页面协议一次性升级到 Schema 4.0：组件自身的可见标题统一使用 `props.title`，组件能力目录逐项声明标题必填、可选或不支持。`text.props.heading` 被拒绝。

新增 `aiSummary` 组件。页面只声明 `title?`、字面量 `promptTemplate` 和 `relatedData`。关联数据包含页面数据源引用、业务说明以及 `field → term` 白名单；不包含 `data`、场景或外部 SSE 协议参数。

运行时数据真元收敛为两份：

1. `dataSourceId → DataSnapshot`，由数据编排器执行、缓存和发布；
2. `componentId → AiSummarySnapshot`，由每个 AI 总结组件会话隔离管理。

普通组件数据槽和 AI 总结关联数据都在渲染时投影到第一份真元。AI Summary 垂直组件 Module 内部完成请求组装、固定 SSE Adapter、输入指纹、自动取消、代次隔离和手动重试；纯渲染 View 只消费第二份真元。

SSE Adapter 固定使用宿主注入的 `conversationBaseUrl` 与可选 `env`，自动生成 conversationId、六位 requestId 和当前 `YYYY-MM`，携带 cookie，并要求流在结束前出现 `finish`。请求业务数据只包含 `relatedData.fields` 声明字段，按字段转换成列数组。

## 边界

- 数据网关 Interface 保持 DQE 取数和维度候选值能力；
- 不新增 `contentSources`、通用生成内容层或公共 AI Runtime；
- Prompt 不支持插值或表达式；
- 不把外部端点、Header 或 ID 放进页面元数据；
- 首个正式切片只迁移公司考察风险总结，其他三个风险总结只迁移 `heading → title`；
- 首轮通过可注入假 SSE 契约验证，不接入生产地址。

## 验收标准

- Schema 4.0 拒绝旧 `heading`、`aiSummary.data`、未知数据源、未知字段和空模板；
- 一个页面数据源无论被多少组件或总结引用都只执行一次，仅被关联数据引用时也会执行；
- AI 请求只包含声明字段，空数据不调用 SSE；
- 相同输入不重复生成，数据变化 Abort 旧流，迟到事件不能覆盖新内容；
- 失败不自动重试，错误态提供手动重试；
- SSE 任意拆块仍能解析 `generate/finish`，缺失 `finish` 为协议错误；
- AI Markdown 不执行脚本或原始 HTML；
- 公司考察风险总结不再包含静态占位内容；
- `pnpm validate`、`pnpm test`、`pnpm check`、`pnpm test:embed` 通过。

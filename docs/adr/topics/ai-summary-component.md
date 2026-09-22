# AI 总结组件

> 摘要默认走 `text`，只有明确声明 SSE 动态生成才用 `aiSummary`；它是垂直组件而不是第三种数据源。

**现行结论:** 页面摘要默认使用 `text`,由后端随页面文档在 `props.body` 中返回正文;正文默认按纯文本渲染,需要分色时显式声明 `bodyFormat: "semanticHtml"`,并与排行详情共用受控语义 HTML Module。只有需求明确声明运行时 SSE 动态生成时才选择 `aiSummary`,不得根据标题、已有数据或 AI 文案自动推断。显式声明的 AI 总结是内化执行的生成型垂直组件 Module,不是第三种页面数据源。`aiSummary` 组件只声明可选标题、纯文本 `promptTemplate` 和必填的 `relatedData`(对既有页面数据源字段的显式只读引用),不声明 `data`,不暴露端点、Header 或 SSE 协议参数。Host、请求组装、私有 SSE Adapter、会话管理与纯渲染 View 在组件目录内高内聚地分工;数据网关不为此新增 AI/Prompt/SSE 方法。只有出现真实的多组件共享生成能力时,才从当前的单一垂直组件中提取公共 Module。正文的受限 Markdown 渲染此前隔在 `widgets` 包,已由 0025 迁入同一组件目录,该垂直模块至此完整;同一份决策也说明了为什么 `aiSummary` 不该有 `widgets` 侧实现。

来源:[ADR-0019](../0019-internalize-ai-summary-generation.md)、[ADR-0025](../0025-converge-runtime-presentation-packages.md)、[ADR-0027](../0027-default-summary-to-text-unless-sse-explicit.md)、[ADR-0029](../0029-share-controlled-semantic-html-rendering.md)。

---
status: accepted
---

# AI 总结采用垂直组件 Module 内化生成

AI 总结是内化执行的生成组件，不是第三种页面数据源。页面 Schema 4.0 的 `aiSummary` 只声明可选 `props.title`、纯文本 `promptTemplate` 和必填 `relatedData`；它不声明 `data`，也不暴露场景、端点、Header、ID 或其他外部协议参数。

`relatedData` 显式引用既有页面数据源、业务说明和允许发送的字段。页面语义校验验证数据源与字段引用。数据编排器以 `dataSourceId` 为键形成唯一页面数据快照；普通组件数据槽和 AI 总结关联数据投影到同一份快照。仅被关联数据引用的数据源同样执行。

AI 总结垂直组件 Module 在组件目录内高内聚地负责：

- Host 连接组件声明、页面数据快照和组件会话；
- 请求组装只选择声明字段并转换为列数组；
- 私有 SSE Adapter 固定处理请求协议、身份字段、cookie 和流解析；
- 组件会话管理输入指纹、Abort、代次隔离、手动重试和 AI 总结快照；
- 纯渲染 View 呈现标题、加载、流式文本、空、错误与重试。

数据网关 Interface 不增加 AI、Prompt、SSE 或总结方法。系统不新增 `contentSources`，不把 SSE 定义为 DQE 或页面数据源，也不提前抽取公共 AI Runtime Module。

## Consequences

- 页面数据快照按 `dataSourceId` 唯一，AI 总结快照按 `componentId` 隔离；
- AI 总结的数据出站边界由 `relatedData.fields` 白名单控制；
- 数据变化取消旧流并重新生成，迟到事件不能覆盖新代次；
- 缺少 AI 配置或生成失败只影响当前 AI 总结组件；
- 相同输入不重复生成，失败只允许手动重试；
- AI 返回 Markdown 通过共享受限解析器渲染，不执行原始 HTML。

只有出现真实的多组件共享生成能力，或下载、通知等非组件消费者时，才从垂直组件中提取公共 Module。

## Considered Options

- 第三种页面数据源或 `contentSources`：混淆受控业务数据与生成内容，不采用。
- 把 AI 请求放入数据网关：扩大查询执行端口的职责并引入 Prompt/SSE 概念，不采用。
- 立即抽取通用 AI Runtime：当前只有一个消费者，会形成浅层转发与推测性抽象，不采用。
- Svelte View 直接组装协议：会把领域输入、会话和纯渲染混在一起；采用同目录 Host、会话与 Adapter 的垂直 Module。

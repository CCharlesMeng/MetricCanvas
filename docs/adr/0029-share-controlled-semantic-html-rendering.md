---
status: accepted
---

# 摘要与排行详情共用受控语义 HTML 渲染 Module

后端返回的摘要正文和 DQE 返回的排行说明都需要按业务方向分色。如果 `text` 自己新增一套富文本解析与样式映射，安全白名单、失败行为和颜色契约会在两个消费者之间漂移；如果继续把能力封闭在 `rankingDetailCard` 目录，`text` 又只能依赖另一个业务组件的私有实现。

## 决策

**把受控语义 HTML 提升为 `widgets` 包内的共享 Module。** 它的 Interface 只接收原始字符串；Implementation 独占长度、节点数、嵌套深度、标签与语义类白名单，解析为受控节点后递归渲染，并统一映射 `tone-positive`、`tone-negative`、`tone-neutral`。未知标签、属性、类名或错误闭合全部失败关闭，原始字符串永不进入 `{@html}`。`rankingDetailCard` 和 `text` 是当前两个真实消费者，因此这条 seam 不再是假设。

**`text` 通过 `props.bodyFormat: "semanticHtml"` 显式选择受控正文。** 省略 `bodyFormat` 时，`props.body` 始终按纯文本渲染，即使正文看起来像 HTML；这保持现有页面兼容，也避免 Agent 或后端无意扩大解释能力。受控正文沿用 ADR-0028 的标签和语义类契约，组件可以在自身 CSS 中选择字号与间距，但页面文档仍不能提供 CSS、颜色名或脚本。

**数据来源语义不混合。** `semanticHtml/detail` 仍是结果字段契约中的 DQE 明细字段；`text.props.body` 仍是随页面文档返回的静态正文，不新增组件数据槽、查询或 SSE。摘要默认 `text`、SSE 必须明确声明的 ADR-0027 继续生效。

## Consequences

- 安全修复、允许类扩展和状态颜色调整集中在一个 Module，对摘要与排行详情同时生效。
- 调用方不再持有解析树或错误结构，测试直接穿过同一个 Interface 验证成功渲染与失败关闭。
- `detail-*` 类名因既有 DQE 契约继续保留；它们在共享 Module 中表示内容角色，不意味着调用方必须是明细字段。

## Considered Options

- **在 `TextBlock` 复制解析器和 CSS。** 两套安全与视觉契约会独立演进，不采用。
- **让 `text` 直接使用 `{@html}`。** 无法维持封闭页面协议和失败关闭，不采用。
- **把摘要改回 `aiSummary` 或 Markdown。** 前者错误引入运行时 SSE，后者没有既有的业务方向语义类契约，均不采用。

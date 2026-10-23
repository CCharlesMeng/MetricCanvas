# AI 总结组件

> 摘要默认走 `text`，只有明确声明 SSE 动态生成才用 `aiSummary`；它是垂直组件而不是第三种数据源。

**本轮已确认的新契约（6.51，6.52 增加数据源 ID 直接引用；实现与验收见 [主计划](../../plan/2026-10-22-report-ai-summary.md)）：** AI 总结仅用于 Report，统一提供正文与动态生成两种模式；普通说明仍由 text 承载。动态模式通过 relatedDataSource 直接引用数据源 ID，或从当前可见 section 推导分析范围；采用数据源的非明细结果字段，旧 relatedData 仍按原白名单读取，传入 question 与包含 dataSources 的 contextInfo；集成应用通过独立 Adapter 实现 generate(question, contextInfo): Promise<string>，SSE 协议与鉴权留在 Adapter。组件不拥有请求生命周期，应用会话集中管理节流、并发、去重与缓存；时间切换和报表卸载不取消已启动任务。完整正文遵守受控语义 HTML，结构不合规时安全降级为纯文字；导出使用当前输入的完整结果。数据网关不新增 AI 方法，AI 总结仍是垂直 Module。下列早期 ADR 的“默认 text、仅 SSE 动态生成、私有盘古 Client”由本轮用户确认修订，不再作为新页面创作规则。

来源:[ADR-0019](../0019-internalize-ai-summary-generation.md)、[ADR-0025](../0025-converge-runtime-presentation-packages.md)、[ADR-0027](../0027-default-summary-to-text-unless-sse-explicit.md)、[ADR-0029](../0029-share-controlled-semantic-html-rendering.md)。

# AI 总结 aiSummary

仅适用于 Report 布局。后端已生成的 AI 正文与按页头时间条件生成的区域分析使用同一个组件；普通说明继续使用 text。

## 模式与范围

`mode: provided` 必须提供非空 `body`，不声明生成提示词、范围或 initial；无需 AI 接口。`body` 支持现有受控 semantic HTML。

`mode: generated` 必须提供非空 `promptTemplate`，并声明 `relatedDataSources` 或 `relatedSections`。`relatedDataSources: ["sales-summary", "regional-comparison"]`（6.53）直接引用页面数据源 ID，不再重复声明 source、description、fields 或 field/term 映射；采用结果字段契约内全部非明细字段及原有标签、类型、单位等信息。ID 必须存在、列表非空且不能重复，顺序不影响生成输入和缓存。显式数据源优先于 relatedSections。

未声明显式数据源时，`relatedSections` 按内容分区 id 收集当前可见组件的数据槽，包含活动 Tab 与组合卡子组件；去重后选择结果字段契约内全部非明细字段，不跟随其他 AI 总结、其他分区或查询上游。显隐沿用统一 visibleWhen 投影。

省略 mode 的旧动态声明按 generated 读取。6.52 的单数旧拼写 `relatedDataSource` 保留读取兼容，语义与复数相同，不能与 relatedDataSources 同时声明；当前示例与创作统一使用复数。旧 `relatedData` 保留读取兼容及原字段白名单、术语映射规则；新页面使用 relatedDataSources，两者不能同时声明。旧显式声明仍优先于 relatedSections。需要缩小分析字段范围时，引用专门提供该范围的页面数据源。

可选 `initial: { body, inputKey }` 提供动态模式首屏正文。inputKey 必须等于 `aiSummaryInputKey(question, contextInfo)` 的结果；条件、范围或数据变化后不复用不匹配的正文。不要将只有正文、没有输入绑定的结果用作动态首屏缓存。

## 查询与生成

Report 页头时间筛选仍由 filterBindings 控制既有查询。关联查询退出 loading 后冻结实际查询条件、时间范围、字段含义、单位、结果范围、数据与状态，再提交生成任务。空结果与失败如实交给分析实现，不由引擎决定业务分析是否可行。数据按选定数据源的非明细结果字段投影（旧声明沿用字段白名单），不静默截断或自动发起全量查询。

集成应用注入 `aiSummary: { generate(question, contextInfo): Promise<string> }`。question 由业务提示词和固定输出约束组成；contextInfo 含页面/修订/组件、区域、页头时间筛选与 dataSources。每份数据源含 id、业务说明、字段、实际生效查询、结果范围和查询快照。页面 JSON 不得保存地址、鉴权、函数或 SSE 协议。SSE 构建与流累积由 Adapter 独占，组件只接收完整字符串。

## 会话与缓存

同一个 aiSummary 注入对象代表同一应用会话，跨报表复用。组件卸载或切换时间只取消订阅，已启动请求继续完成并缓存。缓存按页面文档/修订、摘要身份、实际分析范围、查询条件、字段、数据状态、提示词与输出约束版本精确匹配。相同输入复用已完成结果或正在执行的任务；重试显式重新调用。

默认每个摘要每秒最多启动一次、全局并发 2；窗口/队列内只保留每个区域最新待启动任务，已启动任务不取消。throttleMs、concurrency、maxEntries、ttlMs 属于集成应用配置。默认保留最多 100 份未订阅完成结果，30 分钟过期；执行中和正在展示的结果不因缓存清理而丢失。身份/环境变化时更换注入对象。刷新浏览器清空缓存，不使用持久存储。

## 呈现与导出

默认完整摘要直接复用 SDT 页头“报告摘要”的 ReportSummary 呈现：渐变面板、居中双侧装饰标题、白色内框、浅紫描边正文、18px 字号与 32px 行高；默认标题为“报告摘要”，可用 title 修改。显式 variant: reportInline 保留紧凑行内形态，复用 TextBlock 的对应呈现。

只展示完整结果。合规 HTML 由共享 SemanticHtml 渲染；标签、属性、语义类或闭合结构不合规时提取可读纯文字，保留段落与换行，不执行 HTML、脚本或加载资源。纯文字降级结果也属于可缓存、可导出的成功正文。空响应或调用失败显示组件局部错误，可手动重试。此容错不改变其他 semanticHtml 消费者的严格契约。

导出冻结当前条件下已完成正文及其呈现格式；未完成或失败显示状态占位，不调用 AI，不导出半截内容或其他时间的结论。

## 本地示例与接入

Playground：`/pages/report-ai-summary`。双区域、直接正文与结构降级共用既有 Report 呈现；对照区域使用 relatedDataSources，业务用量区域使用 relatedSections。forecast-page 仅保留为旧 relatedData 读取兼容样例。

云宝助手 Adapter 集中在 ai-summary/adapters/yunbao-assistant.ts，通过 @metriccanvas/engine/ui/ai-summary/yunbao-assistant 独立入口注入；当前明确为本地 Mock。具体替换位置见集成应用的接入说明。内网替换 generate 函数体，保持两参数和 Promise<string>；自行构建 SSE、消费事件并累积正文。Playground 与 Platform 共用该实现。真实云宝、DQE/Relay 与内网身份联调独立验收。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

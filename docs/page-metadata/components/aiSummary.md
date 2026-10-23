# AI 总结 aiSummary

仅适用于 Report 布局。已有正文与按页头时间条件生成的区域分析使用同一个组件；普通说明继续使用 text。

## 正文与范围

从 6.54 起无需声明 mode：`body` 为非空字符串（去除首尾空白后判断）时，直接展示原正文，支持受控 semantic HTML 或纯文本。摘要不调用 AI、不触发关联取数，不需要 generate 配置；同时存在的生成配置不参与此时的取数、字段校验与生成。Report 其他组件照常运行。时间切换不会自动清空正文或重新生成。

```json
{
  "body": "<p>本期分析结论……</p>"
}
```

未声明 body、body 为空字符串或纯空白时，使用非空 `promptTemplate` 与 `relatedDataSources`、`relatedSections` 或 `scope: "container"` 生成摘要；缺少这些配置时报告配置错误。

```json
{
  "promptTemplate": "分析当前期间的用量变化。",
  "relatedDataSources": ["usage"]
}
```

`relatedDataSources: ["sales-summary", "regional-comparison"]`（6.53）直接引用页面数据源 ID，采用结果字段契约内全部非明细字段及原有标签、类型、单位等信息，不重复声明字段映射。生成时 ID 必须存在、列表非空且不能重复，顺序不影响生成输入与缓存；显式数据源优先于 relatedSections。

未声明显式数据源时，`relatedSections` 按内容分区 ID 收集当前可见组件的数据槽，包含活动 Tab 与组合卡子组件；去重后选择全部非明细结果字段，不跟随其他 AI 总结、其他分区或查询上游。显隐沿用统一 visibleWhen 投影。

旧 mode、initial 声明仅保留历史读取兼容，当前用法不需要首屏输入绑定参数；运行分支以 body 是否非空为准。6.52 单数 relatedDataSource 和旧 relatedData 字段白名单保留读取兼容；生成时新旧数据源声明不能同时配置。当前创作统一使用 relatedDataSources。

## 容器组合与顶部位置（6.58）

同一个 aiSummary 可独立摆放，也可作为组合卡的子组件，与原有准入的指标、图表等内容组合。内容分区支持整行区域，组合卡支持横向并排区域，Tab 沿用现有内容及嵌套规则；本能力不扩展其他组件准入或递归布局。

`scope: "container"` 显式总结直接拥有当前摘要的内容集合：内容分区的组件、组合卡的子组件，或当前摘要所属 Tab 页签的内容。动态生成时与 relatedDataSources、relatedSections 及旧范围声明互斥。未选择此选项时，摆放位置不会隐式改变显式范围。非空 body 仍优先直显并跳过生成配置。

```json
{
  "title": "本区域总结",
  "variant": "reportInline",
  "promptTemplate": "仅根据本区域的数据概括变化。",
  "scope": "container"
}
```

仅收集区域内可见组件引用的页面数据源，去重并采用全部非明细字段；嵌套 Tab 只收集活动页签。文字、标题及其他摘要正文不进入 datasource 请求或分析输入，不跟随查询上游，不额外查询。表格搜索、分页及行显隐仍沿用既有数据快照语义，不改成屏幕可见行总结。contextInfo 在此模式增加可选 region（kind、id、sectionId），准确绑定所在区域与缓存输入。

6.58 起，摘要必须连续排在所属区域的正文组件序列最前，Report 页头与区域标题仍在其之前；摘要的 layout.span 必须占满所在区域列轨（组合卡/Tab 为 12，内容分区按 columnTracks 数量或默认 12），且不能作为铺底层。独立摘要所在的纯摘要分区必须位于页面其他正文之前。校验失败报告摘要的精确路径，不在运行时偷偷重排。

旧版本继续按原声明顺序读取；normalizePageDocument 升级为当前写出版本时会检查顶部约束，位置不合规时返回错误，需作者先显式调整原文档。组合卡内摘要与 scope 字段的最低版本均为 6.58。连续多份顶部摘要允许，正文直显也须遵守位置规则。

场景 `/pages/report-ai-summary-regions` 使用合成 inline 数据与本地 Mock，覆盖页面摘要、内容分区、并排组合卡与 Tab 页签；卡内摘要复用既有 reportInline，页面摘要复用 ReportSummary。

## 查询与生成

Report 页头时间筛选由 filterBindings 控制既有查询。无正文时，关联查询退出 loading 后冻结实际查询条件、时间范围、字段含义、单位、结果范围、数据与状态，再提交生成任务。空结果与失败如实交给分析实现。数据按选定数据源的非明细结果字段投影，不静默截断或自动发起全量查询。

集成应用注入 `aiSummary: { generate(question, contextInfo): Promise<string> }`。question 由业务提示词和固定输出约束组成；contextInfo 含页面、修订、组件、区域、页头时间筛选与 dataSources。页面 JSON 不保存端点、鉴权、函数或 SSE 协议；SSE 构建和正文累积由 Adapter 负责，组件接收完整字符串。

## 会话与缓存

同一个 aiSummary 注入对象代表同一应用会话。无正文的摘要切换时间或卸载时只退订，已启动请求继续完成并缓存。缓存按页面文档/修订、摘要身份、实际范围、查询、字段、数据状态、提示词和输出约束精确匹配；相同输入复用已完成或执行中的任务。

默认每个摘要每秒最多启动一次、全局并发 2；待启动队列只保留每个区域最新输入，已启动任务不取消。默认保留最多 100 份未订阅完成结果，30 分钟过期；正在执行和展示的结果不因清理丢失。刷新浏览器清空缓存。

## 呈现与导出

默认完整复用 SDT“报告摘要”的 ReportSummary：渐变背景、白色内框、浅紫描边内容区三层结构；默认标题为“报告摘要”，可用 title 修改。显式 variant: reportInline 使用既有紧凑 TextBlock。

合规 HTML 按语义渲染；结构不合规时提取安全可读文字并保留换行，不执行脚本或加载资源。纯文本回退也可缓存和导出。无正文生成时，空响应或失败显示局部错误并支持重试。

非空 body 优先用于导出；动态结果冻结当前条件下的完整正文。未完成或失败显示状态占位，不额外调用 AI，不使用其他时间的结论。

## 本地示例与接入

Playground：`/pages/report-ai-summary`。直接正文、结构回退与双区域动态摘要都省略 mode；对照区域使用 relatedDataSources，用量区域使用 relatedSections。forecast-page 保留为旧 relatedData 读取兼容样例。

云宝实现在 ai-summary/adapters/yunbao-assistant.ts，通过 @metriccanvas/engine/ui/ai-summary/yunbao-assistant 独立注入。当前是本地 Mock；内网替换 generate 函数体即可。真实云宝、DQE/Relay 与身份联调独立验收。

## 查阅方式

字段与联合分支以生成结构表为准。完整页面用于结构/语义校验，渲染行为结合浏览器证据。返回[模块索引](../README.md)。

# Report 区域 AI 总结

入口：`/pages/report-ai-summary`。运行 `pnpm dev:dqe`（同时启动 DQE Sim 和 Playground；已有服务时只补齐缺失服务）。页面显式使用 Report：右上角月份范围驱动查询；两个区域分别通过 relatedSections 和 relatedDataSources 选择数据。

云宝调用在 `packages/engine/runtime-ui/src/ai-summary/adapters/yunbao-assistant.ts`，当前为约 1.2 秒的本地 mock，结果明确标记“本地 Mock 分析”。内网只替换 generate(question, contextInfo): Promise<string>；SSE 构建和内容累积放在这个函数内部。

外观：默认 AI Summary 完整复用 SDT“报告摘要”的渐变背景、白色内框、浅紫描边内容区三层结构及居中装饰标题。区域内 reportInline 沿用既有紧凑呈现。

观察：所有摘要都省略 mode。非空 body 直接显示，不依赖 generate 配置，也不因时间切换重新生成；空字符串或纯空白 body 按无正文处理，使用提示词与范围生成。结构不完整正文仍展示纯文字。查询结束后两个区域独立生成。对照区域直接声明 `relatedDataSources: ["comparison"]`，与 relatedSections 同为复数集合，无需字段映射；只分析 comparison 的非明细字段。切换月份后再返回，已启动任务继续执行并复用结果；相同输入不重复调用。导出仅使用当前条件下完整结果，未完成区域显示占位。

数据环境为本地 DQE Sim；浏览器测试可注入确定性结果和延迟 Adapter 验证竞态，不代表真实云宝、DQE、Relay 或内网验收。

## 容器组合与顶部摘要

入口：`/pages/report-ai-summary-regions`，无 URL 参数，仅需 `pnpm dev:playground`。页面使用 Report，数据为合成 inline，AI 为约 1.2 秒的本地 Mock，不需 DQE 服务或真实云宝。

1. 页面摘要位于页头后、其他正文之前，显式关联 usage 与 comparison。
2. 整行内容分区的摘要位于说明文字及表格之前；scope: container 只关联 usage。
3. 左右组合卡各自的首个子组件为 AI Summary，左卡只关联 usage，右卡只关联 comparison；卡内继续使用原有指标和图表。
4. 切换“用量视角 / 对照视角”，各页签摘要位于表格之前，各自关联本页签来源；首次访问按现有机制生成，返回复用缓存。
5. “区域说明文字” 及未引用的 unreferenced 数据源不出现在总结正文。PDF/PNG 沿用完整结果捕获，不触发额外 AI 生成。
6. 异常复现：在 Playground 编辑器将卡内 summary 移到图表后，或把其 span 改为 6，校验应在对应组件路径报告顶部/占满列轨错误；scope 与 relatedDataSources 同时声明时报告范围冲突。恢复原页面后重试。

自动浏览器验收：`pnpm --filter playground exec playwright test tests/ai-summary-regions.browser.ts`，直接访问该页，检查宽窄屏、数据源隔离、活动 Tab 与位置。该页不证明真实云宝、DQE/Relay 或内网身份接入。

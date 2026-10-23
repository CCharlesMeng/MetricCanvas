# Report 区域 AI 总结

入口：`/pages/report-ai-summary`。运行 `pnpm dev:dqe`（同时启动 DQE Sim 和 Playground；已有服务时只补齐缺失服务）。页面显式使用 Report：右上角月份范围驱动查询；两个区域分别通过 relatedSections 和 relatedDataSources 选择数据。

云宝调用在 `packages/engine/runtime-ui/src/ai-summary/adapters/yunbao-assistant.ts`，当前为约 1.2 秒的本地 mock，结果明确标记“本地 Mock 分析”。内网只替换 generate(question, contextInfo): Promise<string>；SSE 构建和内容累积放在这个函数内部。

外观：默认 AI Summary 与 SDT 页头的“报告摘要”共用 ReportSummary，包含渐变面板、居中装饰标题、白色内框与浅紫描边正文。

观察：后端正文立即显示；结构不完整正文仍展示纯文字。查询结束后两个区域独立生成。对照区域直接声明 `relatedDataSources: ["comparison"]`，与 relatedSections 同为复数集合，无需字段映射；只分析 comparison 的非明细字段。切换月份后再返回，已启动任务继续执行并复用结果；相同输入不重复调用。导出仅使用当前条件下完整结果，未完成区域显示占位。

数据环境为本地 DQE Sim；浏览器测试可注入确定性结果和延迟 Adapter 验证竞态，不代表真实云宝、DQE、Relay 或内网验收。

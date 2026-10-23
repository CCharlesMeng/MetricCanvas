# 恢复完整 SDT 摘要呈现

2026-10-23，用户澄清 SDT 就是“渐变背景＋白色＋紫色内容区”，撤回上一轮对层次的误解。

默认 AI Summary 已恢复完整 ReportSummary，去除精简尝试新增的内部 framed 参数及对应样式分支，当前 ReportSummary.svelte 与 AiSummaryView.svelte 的内容与精简前一致。区域内 reportInline 保持原有紧凑呈现；区域总结范围及顶部约束仍按已确认方案。

验证：Embed 构建、4 项浏览器回归、Playground 1440/640 宽窄屏 1 项回归通过。浏览器测试逐项比较 AI Summary 与真实 SDT 页头摘要的宽高、字体、背景、边框、内边距及语义颜色，恢复完整一致性；导出回归通过。文档与 local-authoring 已重新生成并检查漂移。

纯呈现恢复未修改生成、查询或其他业务函数。Svelte script 的 summaryBody AST selfCC 保持 5→5；未新增函数、辅助函数或未关闭复杂度问题，模板恢复原有结构。

当前截图：page-summary-sdt.png。前一轮 page-summary.png / README.md 属于已撤回的精简尝试，不能作为当前外观。

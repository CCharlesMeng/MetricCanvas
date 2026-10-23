# 页面摘要精简呈现（已撤回）

本轮用户澄清 SDT 原本就是三层结构后，以下精简尝试已撤回；当前结果见 [恢复记录](sdt-restored.md)。

2026-10-23 用户要求：“页面摘要直接参考 sdt，不要搞那么多层”。

直接复用 ReportSummary 的 SDT 标题、正文排版、语义颜色和浅底描边。AI Summary 不再显示组件自带的渐变面板、额外白色内框；正文只有一层底色。共享呈现组件增加内部 framed 参数，SDT 页头沿用默认完整面板，AI Summary 传 false；不增加页面元数据字段或版本，不改取数、范围、生成、缓存、顶部规则和导出语义。reportInline 沿用原有呈现。

已验证：

- 实际 Playground `/pages/report-ai-summary-regions`，1440 / 640 宽屏，1 项浏览器测试通过；已人工查看实际页面，页面级摘要只有标题和单层正文，区域摘要不受影响。
- Embed 构建及 4 项浏览器测试通过：SDT 标题/正文计算样式相同；AI 摘要外层无渐变、白框透明且无内边距，SDT 原有面板及内边距保持。日期、缓存、非空正文、区域隔离、嵌套导出回归通过。
- engine Svelte/TypeScript 检查通过，0 errors / 0 warnings。
- 语义文档及 local-authoring 已重新生成；契约漂移检查通过，仓外安装/知识/参考链接 30 项通过。
- 复杂度口径 metriccanvas-ts-ast/1、TypeScript 5.9.3；Svelte 仅提取 script 测量，不将模板交给 TypeScript。ReportSummary 无手写函数；AiSummaryView.summaryBody selfCC 5→5；修改的浏览器测试所有函数/回调均 ≤ 3，无新增辅助函数及超限项。模板仅新增 class 受控切换，不改变正文分支。

截图 page-summary.png；浏览器、类型、独立安装及复杂度原始回执位于本目录。此记录更新默认摘要外观，早期“完整渐变/白框与 SDT 完全一致”的表述属于旧批次时间点。

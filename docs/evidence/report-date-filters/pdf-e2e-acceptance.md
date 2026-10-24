# 本地 PDF 端到端补验

2026-10-11：回应“只看到导出 DOM，没有看到实际 PDF”的验收缺口。本轮只增加页面试验场的本地集成应用编码接线与结果预览，引擎公共方法及完整性规则未改。

## 已验证

- 在原报告示例点击“导出 PDF”，调用正式 `RuntimeView.withExportView`，通过本地 Chromium 编排文件，经 Poppler 从实际 PDF 生成第一页预览，浏览器下载完整 PDF。
- 实际文件为 8 页 A4，三张表共 159 行；逐项验证每张表 1–53 行各出现一次，金额一致。包括未显示的内容分区组，以及区域、项目两个 Tabs。
- 报告标题、静态图表与 `2026-01 至 2026-06` 期间保留；无日期筛选标签和表单字段。图表标题与图像同页。
- Poppler 逐页渲染检查，无标题不可见、表格内容重叠或行裁切；页面显示由实际 PDF 渲染的第一页，避免内置浏览器不支持 PDF iframe 的空白预览。
- 方法结束后临时导出 DOM 为 0；编码临时目录清理；无同源标识的请求返回 403。
- 页面试验场 Svelte 检查 0 错误、0 警告，TypeScript 检查通过；`git diff --check` 通过。

证据：[文件校验](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/pdf-e2e/pdf-verification.json)、[八页渲染](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/pdf-e2e/pdf-all-pages.jpg)、[浏览器预览加载事实](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/pdf-e2e/browser-preview.json)、[检查日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/pdf-e2e/playground-check.txt)。本地文件：`output/pdf/report-date-example.pdf`。

## 范围

正式引擎 + 合成数据网关 + 本地开发编码器 + 真实浏览器下载这条链路已验证。真实 Relay/Java/DQE、生产集成应用的编码器及任意宽分区横向编排仍未验证；示例遇到宽分区明确拒绝。新增代码未纳入上一轮四角色检视指纹；此文单独记录补验，不沿用上一轮检视结论。

“主要明细 / 补充明细”来自示例的内容分区组配置，分别展示经营明细及趋势、区域及项目分析，目的为验证导出展开隐藏内容；已在示例工具区解释。

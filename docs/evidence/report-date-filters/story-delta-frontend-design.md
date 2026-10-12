# report-date-filters · Frontend Design Delta

批准的设计与职责见 [完整计划](../../archive/report-date-ui-2026-10/2026-10-09-report-header-date-filters.md)。本 Story 使用文字规格：C 的封面上方工具带、四种固定日期形态、提取确认后生成、当前已应用期间及独立完整静态导出。

新工具带复用 FilterBar 与 ReportHeader；控件草稿归各日期控件，已应用筛选及查询归 RuntimeSurface/orchestrate。ExportView 共用 RuntimeSection/ComponentRenderer，页面数据经同一网关按捕获作用域取得，回调消费及 PDF 编码归集成应用。

验收页面使用明确标注的本地合成数据；数据值、原值回填、筛选变更与导出均走正式页面协议及运行时。它不表示真实业务数据/部署已经验收。

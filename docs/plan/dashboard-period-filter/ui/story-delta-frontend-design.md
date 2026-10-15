# 期间筛选 UI 文字规格

规格与验收项取自 ../../2026-10-15-dashboard-period-filter.md，以用户在 2026-10-15 对该计划的“可以，开始推进”作为批准。现有 OpenTiny OS DatePicker 风格继承 PATTERN-COMP-1、PATTERN-STYLE-1。控件作为 DashboardToolbar 内 FilterBar 的一个筛选器；年、季、月和近一年按钮在左，右侧为对应期间选择。季度框 YYYY 年 Qn，面板 Q1–Q4。近一年右侧只读 YY年M月~YY年M月，不含当前月。年季月保留日期锚点；近一年与历史锚点无关。新接口不改变现有月／日及范围模式。窄容器不得页面横向溢出，浮层保持可达。方案规定的范围、交互和现有 OS 组件规范构成冻结标准，不按演示 Dashboard 的装饰内容还原。

# 柱状图默认16px与指标卡用法核对

2026-10-22；检出 `/Users/moon/.codex/worktrees/ioc-header-main-delivery/DataDashboard`，基线 `c370e7918969929910ca6fb6f1478782ed716844`。

## 已完成的公共柱宽调整

用户要求“柱状图默认宽度以后一律改成16px”。公共barOption统一默认16 CSS px，覆盖普通、分组、堆叠、横向、reportForecast和混合图中的柱系列；横向表示厚度。移除reportForecast独有40px默认。折线不声明柱宽，既有高级显式barWidth继续覆盖默认值。没有新增协议字段或版本。

场景 `/pages/bar-width-defaults` 使用同一份正式JSON，含上述6类及显式32px覆盖对照；已注册目录并补pages/README。当前IOC Header展示页直接复用公共默认值，无页面私有宽度补丁。全为内联合成数据，无DQE访问。

页面元数据同步：PAGE-METADATA.md、docs/page-metadata/components/barChart.md、reference-map.json的语义标题注册。运行authoring导出器从真源更新分发副本、local-authoring语义知识及哈希清单。

## 验证

- 独立local-authoring校验通过；第1次快照缺少混合系列主轴和字段单位，第2次补齐后通过，原始快照均保留在 `/tmp/bar-width-defaults-attempt-1/2`。
- 8文件83项回归通过：柱图/系列顺序/高级扩展、目录与页面id中立性、local-authoring工具/仓外独立安装与引用。
- 新增直接消费完整场景的5项验收通过：所有变体默认16、显式32覆盖保留；使用真实ECharts SVG绘制，在390/1440画布解析普通与横向柱形几何，均为16px。
- Engine和Playground检查均0错误0警告；新增测试文件再次通过Engine测试类型检查。
- authoring:contracts 导出1020 product/4 authoring/1 interface文件；authoring:contracts:check通过。
- Playground生产构建通过；git diff --check通过。
- 5173真实浏览器：7张图全部渲染，0浏览器错误；390px时7个canvas、页面scrollWidth=innerWidth=390。截图：[宽屏场景](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-default-bar-width-2026-10-22/bar-width-gallery.jpg)、[窄屏场景](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-default-bar-width-2026-10-22/bar-width-narrow.jpg)、[IOC页16px柱图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-default-bar-width-2026-10-22/ioc-header-bar16.jpg)。浏览器临时视口已恢复。

## 指标卡核对与审核

当前页使用正式 `@metriccanvas/engine/widgets` 的MetricCard，页面类型为metricCard；没有替换为自写控件。默认variant配合RuntimeSection的metric-cell浅灰底，标题小、数值横排且重复“合计”，是本页使用方式不适合单指标概览。

已用原组件构造对比预览：[原始JSON](metric-card-review.json)、[实际对比](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-default-bar-width-2026-10-22/metric-card-comparison.jpg)。下排复用compositeCard.metricGrid + metricCard.compactStack：白底、指标名在上、数值与单位在下，无新增CSS或数据语义。用户提供AGENTS.md要求样式冲突先审核，已先提供对比，随后用户明确确认“是的 修改一下 没问题”。已按确认替换ioc-header-demo的四张指标卡。

真实数据服务、生产部署及本轮Git提交/push均未执行。


## 确认后的页面替换

保持原Dashboard形态、页头、查询与筛选绑定，四张现有metricCard外包compositeCard.metricGrid并改用compactStack；指标名放在row.label，删除重复标题与“合计”。机会点数采用已确认预览的千分位格式。没有新增组件CSS或产品协议。

- 独立local-authoring校验通过，冻结快照 `/tmp/ioc-header-demo-white-cards-attempt-1`。
- 目录及页面id中立性2文件10项通过，git diff --check通过。
- 实际浏览器：全球年度签约额393,840；勾重点后182,520，取消后恢复；四张卡均正确更新。
- 1440px：四卡均位于top=118、宽336.25px；390px：四卡宽343px，单列自然排列，文档scrollWidth=innerWidth=390。临时视口已恢复。
- 当前页面截图：[1440px](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-default-bar-width-2026-10-22/ioc-header-white-cards-1440.jpg)、[390px](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-default-bar-width-2026-10-22/ioc-header-white-cards-390.jpg)。仅页面配置调整，前批公共柱宽及其文档/Skill改动保留，当前批次尚未提交或push。

## 交付前复杂度核对

采用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，同一工具实测原始 HEAD 与本批改动，完整结果见 complexity-before.json / complexity-after.json。修改的普通柱系列 map 回调自身 CC 29 → 28；混合系列 map 回调 8 → 8；原有预测宽度断言的外层与 every 回调均 1 → 1。新增测试函数（含嵌套回调）共 8 个，CC 为 1、1、1、1、7、1、3、1，均 ≤ 15。

普通系列 map 是存量超限函数，本批只删除预测柱宽条件，CC 下降 1；为避免将默认宽度调整扩大为系列颜色、标签和数据组装的整体重构，保留原结构。剩余该回调 CC 28 的存量治理入口为仓库代码复杂度后续分批计划。barOption 外层自身 CC 19 → 19（未改其自身分支），不能以外层数值替代内部回调结果。Header 的 CSS 与导出布局容器变化见相邻间距验收记录，无新增可执行函数或条件。

交付前合并 `53eccb7f` 后用同工具复测，主系列回调仍为 29 → 28，混合系列回调仍为 8 → 8；新增测试函数 CC 不变。最新基线见 complexity-upstream-before.json，最终输出更新至 complexity-after.json。保留上游普通及混合图的 16px 实现，仅移除预测变体的 40px 例外。合并回归及交付门禁修复见相邻间距验收记录。

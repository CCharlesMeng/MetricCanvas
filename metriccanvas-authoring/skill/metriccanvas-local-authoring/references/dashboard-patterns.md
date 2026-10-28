# Dashboard 范式

仅在用户确认 Dashboard 后读取。先按阅读目的选一张卡，再读该卡的结构摘要和涉及的协议模块；不把四张卡叠成一页。摘要由维护仓库的现有页面提炼，包含原结构与来源哈希，不含业务数据或查询体，也不是可直接运行的页面 JSON。源页面展示某种写法，不证明它是每次设计的最佳选择，更不证明实际服务已验收。

Dashboard 的外框满宽；标题和全局筛选通常由统一工具栏承担。分区、组合卡、Tab 与表格依据本次业务关系选择。局部使用说明性文字不会把页面变成 Report。

IOC Region 默认是一个单选树形下拉：地区部、代表处在树内直接选择，不另加层级按钮。使用 `display:"tree"`、`treeSelection:"level"`、`selection:{mode:"single"}`，声明真实 hierarchy 并省略 hierarchyPicker；结构树候选必须包含可信 level 和 parent 关系。旧数据仅有各层平面候选时，保留原候选端口并按声明层级分组，显式单选并省略 hierarchyPicker 即可；不为外观切换到不可用的V2端口。已有示例的按钮或地图专用 hidden 不是默认范式，不能为还原下拉外观伪造父子关系。协议和异常边界见[业务筛选](page-metadata/filters.md#business-filters)。

| 范式 | 适用目的 | 阅读骨架 | 结构摘要 |
|---|---|---|---|
| 地图概览 | 扫描地域差异、业务状态和重点对象 | 地图 + 主题组合卡 + 切换明细 | [dashboard-map](page-patterns/dashboard-map.json) |
| 主题分析 | 对比多个管理主题与组织层级 | 并列指标组 → 分层 Tab → 各层级完整分析表 | [dashboard-analysis](page-patterns/dashboard-analysis.json) |
| 筛选清单 | 找到并处理对象集合 | 全局筛选 → 主表 → 排序／搜索／分页／导航 | [dashboard-list](page-patterns/dashboard-list.json) |
| 对象详情 | 阅读单个对象的画像、规范、预测和进展 | 对象页头 → 概况与规范并列 → 预测矩阵 → 事实叙述 | [dashboard-detail](page-patterns/dashboard-detail.json) |

## 地图概览

源页面 `ioc-project-overview`：同一分区使用 `[29,29,22]` 权重轨，地图位于 backdrop，业务卡与明细位于内容层；卡内组合主指标、分类、图例与比率。它体现“地域背景与业务主题共同扫描”的组织方法，不应无条件搬用其权重、层叠或业务类别。普通地图加明细也可用前景 4+8，完整可校验示例见[地图主导概览](../assets/layouts/overview-map-led.json)；两种几何方案按设计选择，不混成固定模板。

保留每张业务卡内部指标与分类的归属，图与分类明细同字段、同序同色。地图维度、地域命中与层级映射需有依据。读[概览布局](overview-layouts.md)、[地图绑定](map-bindings.md)、[组合卡](page-metadata/components/compositeCard.md)；真实下钻目标未提供时记录缺口。

## 主题分析

源页面 `ioc-opportunity-analysis`：第一分区按 `[2,2,3,3]` 放四组主题卡，内部指标按业务成组；第二分区用 `analysisStack` Tab，每个 Tab 包含多张分析表。Tab 切的是组织层级下的整组分析，不能只保留一张表。该源使用 compact 工具栏；新需求有多个筛选或长文字时按[工具栏规则](local-workflow.md)选择可换行默认工具栏，不能因范式就复制 compact。

按主题收拢 KPI，避免把所有指标展开成纵向清单。Tab 内表格的查询范围、搜索排序与导出各自核对。读[组合卡](page-metadata/components/compositeCard.md)、[Tab](page-metadata/components/tabContainer.md)、[表格](page-metadata/components/table.md)。

## 筛选清单

源页面 `ioc-opportunity-list`：一个 card 分区承载全宽主表，页面 filters 与查询绑定共同定义对象集合。筛选多、表格长都不意味着需要 Report，也无需强加报告封面或总结段落。

先区分页面筛选与表内筛选，再列完整列、固定列、搜索、排序、分页、导出和行导航的需求覆盖。查询窗口的当前行不能冒充完整结果；完整搜索／导出能力取决于数据源契约。读[筛选](page-metadata/filters.md)、[表格](page-metadata/components/table.md)、[导航](page-metadata/actions-and-navigation.md)，完整查询结构参考[查询看板](page-metadata/examples/query-dashboard.json)。

## 对象详情

源页面 `ioc-project-detail`：显式 `layout: "dashboard"`，`dashboardToolbar: "hidden"`，内容页头采用 `reportHeader.projectDetail`；概况与规范用权重轨并列，后接预测矩阵及字段叙述。它是识别阶段的重要反例：详情、长文和 reportHeader 都能出现在 Dashboard。

对象身份由真实页面参数与数据契约提供；描述文字消费已有事实，不自动生成分析结论。隐藏工具栏需确认自有页头承担了所需标题与交互。读[页头](page-metadata/components/reportHeader.md)、[键值面板](page-metadata/components/keyValuePanel.md)、[字段文字](page-metadata/components/fieldText.md)、[参数](page-metadata/params-and-text-values.md)。Dashboard 页头不配置 Report 专用日期工具带或下载声明。

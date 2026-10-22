# pages/capabilities/layout

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 指标卡与文字混排｜收入构成

入口：`/pages/metric-card-equation`；[页面 JSON](metric-card-equation.json)。

启动：已有试验场时运行 `pnpm sim:dqe`；一起启动用 `pnpm dev:dqe`。

同一白底无边框 card 分区内依次放置小标题、左对齐区域筛选按钮和四张 Before 指标卡；第二组保留静态业务拆分对照。

数据性质：合成演示；完整筛选联动需 DQE Sim。

1. 检查标题、其下按钮、四卡均在同一白底分区内；标题和按钮左对齐，外层无边框，小卡仍有灰边。
2. 全部区域为1200/680/360/160；选华东变为720/408/216/96，选华南变为480/272/144/64。第二组静态指标不变。
3. 拉宽容器，四卡均分文字及双侧8px之外的剩余宽度；390px容器中纵向排列，无页面横向溢出。
4. 未启动Sim时查询显示取数失败或空数据，控件与分区仍保留；不能据此判断真实查询可用。

边界：等号与加号仅表达展示关系；all/east/south 是合成数据的显式汇总行，all 不代表通用的取消过滤。此场景不证明真实 DQE/Relay 接入。

关键声明：`section.container:card`、`section.title`、`filterGroup`、`layout.before`、查询 `filterBindings`。

关联：[ioc-project-overview](../../business/dashboard/ioc/project/ioc-project-overview.json)。

## 看板标题｜布局形态独立样式

入口：`/pages/dashboard-title-styles`；[页面 JSON](dashboard-title-styles.json)。

启动：`pnpm dev:playground`。

对照默认、plain、panel、card分区与text.heading，验证报表与看板标题分别呈现。

静态内容

可直接预览

1. 查看四类分区标题与内容章节标题。
2. 打开另一布局形态的对照页，核对字号、颜色、对齐和装饰。

只验证标题呈现，无数据查询；不将plain作为共用标题的回退入口。

关键声明：`layout`, `sections[].container`, `sections[].title`, `sections[].components[].props.variant`。

关联：[report-title-styles](report-title-styles.json)。

关联：[metric-card-equation](metric-card-equation.json)。

## 报表标题｜布局形态独立样式

入口：`/pages/report-title-styles`；[页面 JSON](report-title-styles.json)。

启动：`pnpm dev:playground`。

对照默认、plain、panel、card分区与text.heading，验证报表与看板标题分别呈现。

静态内容

可直接预览

1. 查看四类分区标题与内容章节标题。
2. 打开另一布局形态的对照页，核对字号、颜色、对齐和装饰。

只验证标题呈现，无数据查询；不将plain作为共用标题的回退入口。

关键声明：`layout`, `sections[].container`, `sections[].title`, `sections[].components[].props.variant`。

关联：[dashboard-title-styles](dashboard-title-styles.json)。

关联：[metric-card-equation](metric-card-equation.json)。

## 筛选、页内下钻与跨页导航

入口：`/pages/demo`；[页面 JSON](demo.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

点击区域或渠道图表，体验页内筛选；再跳转销售明细并恢复条件。

合成演示

初始行可预览；动态交互需仿真

1. 启动本地 DQE Sim，点击区域或渠道图表观察联动。
2. 通过图表入口跳到销售明细，检查 URL 和目标页筛选条件。

跨页导航需要集成应用承接路由；本页使用本地仿真数据。

关键声明：`filters`, `sections[].components[].props.actions`。

关联：[sales-detail](../table/sales-detail.json)。

关联：[region-map](../chart/region-map.json)。

## 空数据下的组件呈现

入口：`/pages/empty-state-showcase`；[页面 JSON](empty-state-showcase.json)。

启动：`pnpm dev:playground`。

在没有数据行时，检查指标、图表、表格和地图仍保留标题与基本结构。

合成演示

可直接预览空态

1. 查看指标卡、图表、表格和地图的空数据表现。
2. 比较表头、坐标轴、底图与组件标题是否保留。

本页只直接演示空快照；请求失败后的空数据呈现需通过对应异常测试验证。

关键声明：`dataSources.*.source`, `sections[].components[].type`。

关联：[query-numeric-tolerance](../query/query-numeric-tolerance.json)。

## 本地创作：指标匹配与字段呈现

入口：`/pages/local-authoring-knowledge-demo`；[页面 JSON](local-authoring-knowledge-demo.json)。

启动：`pnpm dev:playground`。

用页面和指标说明核对用数位置，并观察金额、百分数和表格列宽。

合成演示

内联合成数据，无需外部服务

1. 核对签约金额为4,200.0万、达成率为42.0%。
2. 核对明细表单位和列宽；该页面未接真实查询。

指标说明有同名不同口径和缺失查询映射，名称命中不等于真实执行。

关键声明：`dataSources.business-summary.fields`, `sections[].components[].props.rows`, `sections[].components[].props.columns`。

## Tab 混合内容与按需加载

入口：`/pages/tab-mixed-content`；[页面 JSON](tab-mixed-content.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

指标卡、组合卡、图表、文本和表格共用Tab，按需加载、状态保留与URL恢复；合成数据。

合成演示数据

本地DQE Sim与合成AI总结，不代表真实服务验收

1. 在概览观察自适应指标卡、组合卡与16px柱图。
2. 切换明细并搜索客户21，切回后核对搜索与总结保留。
3. 修改公共条件后切回明细，刷新检查活动页签恢复。

Tab不允许页头或嵌套Tab；Report导出不补生成未访问的AI总结。

关键声明：`sections[].components[].props.contentLayout`, `sections[].components[].props.tabs`。

关联：[tab-mixed-content-report](tab-mixed-content-report.json)。

## Tab 混合内容全展开导出

入口：`/pages/tab-mixed-content-report`；[页面 JSON](tab-mixed-content-report.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

Report展开全部混合内容Tab导出PDF/PNG，未访问的AI总结不补生成；合成数据。

合成演示数据

本地DQE Sim与合成AI总结，不代表真实服务验收

1. 在概览观察自适应指标卡、组合卡与16px柱图。
2. 切换明细并搜索客户21，切回后核对搜索与总结保留。
3. 直接导出检查全部页签。

Tab不允许页头或嵌套Tab；Report导出不补生成未访问的AI总结。

关键声明：`sections[].components[].props.contentLayout`, `sections[].components[].props.tabs`。

关联：[tab-mixed-content](tab-mixed-content.json)。

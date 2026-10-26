# pages/capabilities/layout

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 主指标与多行次级指标

入口：`/pages/metric-card-primary-detail`；[页面 JSON](metric-card-primary-detail.json)。

启动：`pnpm dev:playground`，无需URL参数或额外服务；仅内联合成数据。

1. 第一行四卡依次为0、1、3、6行次级指标。主指标名称与大数字靠上对齐，四张卡的外框底边一致，短卡在底部留白。
2. 次级指标每行上方8px，名称14px/20px、黑色50%，数值14px/17px、黑色80%且带下划线，字体为PingFang SC（系统无该字体时使用sans-serif）。
3. 缩小至390px宽，卡片逐张堆叠并恢复自然高度；长名称允许换行，无横向溢出。边界卡保留真实0，空值显示缺失占位。
4. 点击“已回款（可点击查看明细）”的数值，打开既有明细弹窗并显示960万元；键盘Tab/Enter亦可激活。其他下划线数值是普通文本。
5. 非法声明可复现：将第一张卡的`rows[0]`复制为第二个主指标，校验拒绝并定位`/sections/0/components/0/props/rows`；将版本改成6.64，校验指出6.65能力下限。

仅验证页面协议、正式运行时布局与既有明细入口，不证明真实DQE、Relay或线上部署。


## MC 内容包：布局与版本检查

入口：`/pages/mc-content-layout-demo`；[实际页面](mc-content-layout-demo.json)。运行 `pnpm dev:playground`；无 URL 参数和 DQE 依赖。页面由 `tools/scripts/mc-content-fixtures.py` 调用真实本地 MC 接口生成，数据为合成诊断。

1. 检查表格：同源知识有界读取、完整工具参数、来源覆盖对账，以及正常编译 ok、用户要求地图 gap、IOC 计划场景 invalid、旧版 6.0 页面 upgrade_required、未来版本 needs_review、真实保存与 Relay not_run。
2. 点击“检查项”列排序，确认已有表格交互可用；390px 下检查页面可阅读，宽表在自己的滚动区域展示。
3. 通过 `mc-content/scripts/mc_content.py schema --input <旧文件>` 检查兼容性；upgrade 不带输出目录只检查，带全新目录才输出 original、page 和 migration.json，原文件不变。
4. 内容包更新后运行 `pnpm authoring:contracts` 和 `pnpm mc:content:fixtures`；`pnpm mc:content:fixtures --check` 校验页面与实际诊断一致，不能手改静态表格伪造通过。

本页证明本地诊断和已有运行时呈现；不证明 Relay 执行注册、完整产物通道、真实查询、保存或发布。布局编译只检查结构与声明，视觉质量仍需实际预览。

Report 专属布局验收：[经营报告](mc-layout-business-report.json)与[用量报告](mc-layout-usage-report.json)，入口分别为 `/pages/mc-layout-business-report`、`/pages/mc-layout-usage-report`。两页由编译计划经现有 compose 函数在内存装配，再通过 MC 产物检查生成；无保存调用，使用两条月份合成记录。检查总量 50、折线 20→30、明细两行和章节排布。此处为验收 Report 模板而显式采用 report；诊断页采用 dashboard。

## 旧页面升级后继续开发

入口：`/pages/schema-upgrade-demo`；[实际页面](schema-upgrade-demo.json)。启动 `pnpm dev:playground`。数据为3条内联合成记录，无需DQE服务。

原件为 `tools/fixtures/local-authoring-upgrade/schema-upgrade-demo.json`（6.0、layoutForm:dashboard）。在仓库根目录运行 `node metriccanvas-authoring/skill/metriccanvas-local-authoring/scripts/upgrade-page.mjs tools/fixtures/local-authoring-upgrade/schema-upgrade-demo.json --out-dir /tmp/<尚不存在的目录>`，检查原件备份、migration.json与page目录中的新页面。升级后继续修改meta.title为“已升级：继续开发旧页面”和指标卡标题为“继续开发：GMV”，即本演示文件。

1. 页面以Dashboard呈现上述新标题，指标卡显示原始GMV 6323.0亿；三个区域与金额保持。
2. 点击表格“成交总额”排序，验证升序为华南、华北、华东，降序相反；升级后仍可使用已有交互。
3. 原6.0文件仍被运行时读取策略拒绝；本工具只负责显式创作期升级，新文件通过独立校验，运行时兼容范围保持原策略。
4. 将输入副本schemaVersion改为7.0，升级返回blocked及/schemaVersion错误，不创建输出目录；未知字段不被删除来换取通过。

旧图表筛选回归输入为 `tools/fixtures/local-authoring-upgrade/chart-filter.json`；迁移后保留4个原图表id、默认值和查询绑定，输出filterGroup与组合卡。真实查询和视觉交互另以原有 `chart-local-filter-page` 场景核对，此离线迁移不证明真实DQE/Relay可用。

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

### MC 补全回放

`pnpm --filter playground exec playwright test mc-content.browser.ts --workers=1` 使用本目录的诊断页、经营/用量 Report 与 schema-upgrade-demo，验证 1440/390px、表头内排序按钮、合成数值 50 与 20→30，以及三地区原值/排序。当前诊断页新增知识、完整工具参数和独立覆盖分母三项，由实际 MC 查询生成。

同一浏览器回归还直接读取 `tools/fixtures/local-authoring-upgrade/chart-filter.json`，调用产品升级实现，将迁移后的精确完整页放入 `/preview`；四类旧图表筛选转成组合卡 + filterGroup。网关调用现有本地 DQE Sim，点击“订单对比区域 → 海外”后验证新的订单请求确含 OVERSEAS，其他图表和对照图保留。该回放覆盖实际引擎查询/筛选链，数据为合成 Sim，不代表真实 DQE、权限、Relay 或保存验收。

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

查看“安装文件完整性”“运行依赖预检”和“换行转换拒绝”：前两项分别来自实际 diagnose/preflight，第三项来自临时完整副本的 CRLF 故障注入，应显示 invalid、CONTENT_RESOURCE_MISMATCH / line-endings。页面是生成时的本地结果快照，浏览器不扫描安装磁盘，不代表 Windows/Relay 或真实服务验收。点击“检查项”排序并在 1440px/390px 核对表格与页面滚动，自动入口为 `mc-content.browser.ts`。

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

## 局部接数：共享指标与独立内容

入口：`/pages/local-authoring-scoped-data-demo`；[页面 JSON](local-authoring-scoped-data-demo.json)。运行 `pnpm dev:playground`，无需 URL 参数或 DQE。两张表共用内联合成数据，独立指标使用另一页面数据源。

1. 两张表均显示东区50.0%、南区0.0%、北区100.0%，独立指标为999。点击第一张表的闭环率列排序，确认南区移至首行，而第二张表仍按原顺序；零值保持0.0%。
2. 从完整独立 Skill 运行 `node <skill-dir>/scripts/analyze-data.mjs scan --page <page.json> --component region-table`：selectedComponents 仅选中该表；consumers 包含两张表，sources 仅含 voice-closure，数据行不输出。选中 other-card 时只返回独立源；多个 --component 可合并读取。
3. 共享源变更仍须核对两张表；读取范围不是校验范围。原组件通过回执路径定位，完整页面经 validate-page.mjs 校验。draft/check/prepare 保留全页报告覆盖，拒绝 --component。
4. 运行 `node <skill-dir>/scripts/snapshot-attempt.mjs <page.json>`，省略输出目录得到系统临时目录内的快照；用返回 file 运行完整校验，用 `--check <folder>` 核对字节。快照不应放进被页面发现的目录；默认临时样本需要长期留证时归档到扫描范围外。
5. 将 --component 改为不存在的 id，脚本应明确报错；使用坏 JSON 创建快照仍保存原字节，页面校验失败不覆盖该样本。

本场景验证局部读取、已有运行时共享数据呈现和快照隔离；不证明真实 DQE、模型耗时、token 或线上发布。

## Tab 多表格自然展开

入口：`/pages/tab-multiple-tables`；[页面 JSON](tab-multiple-tables.json)。运行 `pnpm dev:playground`，无 URL 参数，无服务依赖；24 条内联合成记录。

1. 默认、compact、analysisStack、grid 四组页签均包含两个表格。面板随内容增高，没有 Tab 级滚动条，后续分区位于内容下方。
2. 切换到“单个表格”，compact 恢复原有 524px 高度；切回“多个表格”时恢复自然高度，已访问页签保留状态。
3. 第一张表翻至第 2 页，显示合成记录 11，第二张表仍从合成记录 1 开始。390px 宽屏下横向滚动由表格自身承担，Tab 不另加滚动容器。
4. 回归命令：`PLAYGROUND_BASE_URL=http://127.0.0.1:5173 node apps/playground/tests/tab-multiple-tables-browser.mjs`。

仅验证正式运行时布局、分页与滚动，不涉及真实 DQE/Relay。


## 加载时保留组件结构

统一入口：[全部组件加载总览](http://localhost:5173/loading-components-review)。同一页面同时渲染 Dashboard 与 Report，覆盖组件目录全部19种类型及根级 IOC 页头。Dashboard 中放18种组件，Report 中验收专属 AI 总结，遵守 filterGroup 仅 Dashboard、AI 总结仅 Report 的布局约束。

页面 JSON：[Dashboard](loading-structure-demo.json)、[Report](loading-ai-summary-demo.json)，原独立入口 `/pages/loading-structure-demo` 保留。示例显式使用 `MC_LOADING_STRUCTURE_DEMO`，合成行位于 `tools/dqe-sim/fixtures/loading-structure-gallery.json`，原订单分页数据在 `tools/dqe-sim/src/loading-structure.ts`，不访问真实业务服务。

启动 Playground 与 Sim：`pnpm dev:playground`，另开终端 `DQE_LOADING_DEMO_DELAY_MS=3000 pnpm sim:dqe`。延迟只作用于此命名演示查询，默认0；AI 总结走本地 Mock，自有生成等待。

1. 点击“重新播放全部加载”，两个运行时重新挂载，当前页可见的取数组件重新查询，等待3秒；标题、缺省值、图表容器、表头与搜索框保留，圆圈居中显示，表格圆圈位于表体加载提示旁。
2. 文本、页头、按钮、筛选器和容器没有独立请求，直接显示；已访问筛选条件与 Tab 命中缓存时直接显示。切换测试轮次或使用重播可观察新的请求。
3. 查看指标卡、仪表盘、键值面板、柱状图、折线图、饼图、地图、排行榜、排名详情、分类明细、字段文本、普通表格及组合卡子组件；数据返回后圆圈消失，原节点仍在。AI 总结在相关查询完成后生成本地 Mock 分析。
4. 下方 Tab 保留订单／收入切换、查询分页与展开明细；子表在回执前已有表头，筛选重查不混用上次条件的数据。390px 下按栅格堆叠，无页面横向溢出。

自动验收：`pnpm --filter playground exec playwright test loading-structure.browser.ts`。以可控的合成 HTTP 回执暂停查询，覆盖全部数据组件圆圈、AI、重播、首次加载、筛选、分页、展开子表、Tab 激活、原节点持续挂载及宽窄屏。组件目录与页面类型集合由 `tools/dqe-sim/tests/loading-structure.test.ts` 对账。合成回执不代表真实 DQE／Relay 或已部署环境验收。

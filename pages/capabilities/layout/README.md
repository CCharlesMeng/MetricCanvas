# pages/capabilities/layout

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 指标卡变化项显隐

<!-- example-guide: task=metric-card-change-visibility; page=metric-card-change-visibility; components=rates -->

复用用途：在一张卡内按已应用的统计期间切换同比、环比，保留主、次指标值。

参考对象：[页面 JSON](metric-card-change-visibility.json) 的 `rates` 指标卡及 `period` 筛选器。两组变化项分别在 `rows` 和 `secondaryRows` 下声明。

移植边界：映射目标页的期间筛选器 ID 和同口径同比、环比字段。示例数值来自内联合成数据。

可观察预期与环境：运行 `pnpm dev:playground`，打开 `/pages/metric-card-change-visibility`，无需 URL 参数。默认月显示两行环比，切换年、季显示两行同比，切换近一年时只保留次指标「较目标」。签约完成率、回款完成率始终可见。自动验收使用同一份 JSON 校验典型非法条件，并在报表宿主中核对 PDF/PNG 的冻结展示。

## 指标定义气泡

入口 `/pages/metric-card-definition-tip`。[页面 JSON](metric-card-definition-tip.json)。

运行 `pnpm dev:playground`。指标值来自内联数据，定义由页面试验场的合成端口延迟 400 毫秒返回。

1. 悬停「销售毛利率」主标题旁的问号，先显示加载，随后显示名称与编码、定义、公式、解释人及更新说明。移入气泡后点击黑色粗体的「查看最新指标定义」，新标签页打开合成的指标卡示例。移开指针，等气泡关闭后再次悬停，观察已加载的定义直接出现。
2. 「销售收入」无主标题，问号与气泡标题沿用唯一指标行的标签，展示可滚动的长定义和底部「查看更多」。「框架执行率」首次查询失败，点击「重新加载」可恢复。「闭环率」无跳转链接。「已跟进项目」无问号。
3. 到「逐行指标定义」分区，在「闭环指标」与「合同指标」两个已有标题下，分别悬停 6 个指标名称右侧的问号，核对指标名和编码。下方两行复用总闭环率字段，分别省略开关和显式关闭，均只显示指标名和值。
4. 快速从一个问号移到另一个，只显示当前指标的内容。使用 `?tips=off` 再次进入，指标值照常显示，所有问号隐藏。
5. 将宿主的 `lang` 设为 `en-US`，悬停后核对问号的辅助名称、字段标签、状态提示与链接文案。固定文案继续使用中文，定义正文沿用服务端内容。
6. 比较「销售毛利率」和「销售收入」的气泡。短内容的气泡宽度小于 400px，长定义的气泡外宽和外高各最多 400px。将视口缩到 320 × 480px，再打开长定义，确认气泡位于视口内且可滚动到底部链接。

移植时复用 `closure-and-contract-metrics` 中的主、次指标行，通过 `showDefinition` 控制位置，并把 `metricCode` 写入目标数据源的结果字段。页面同时保留 `gross-profit-rate` 等既有 `tipCode` 示例。端口请求、编码、更新日期和链接均为合成演示，真实 operation-map 联调另验。

## Embed 重复挂载

页面入口 `/pages/embed-mount-lifecycle`；[页面 JSON](embed-mount-lifecycle.json) 显式使用 dashboard，仅含内联合成计数，无 URL 参数或 DQE 依赖。运行 `pnpm dev:playground` 可检查初值 1 与指标卡呈现。

宿主生命周期必须在真实 embed 入口验收：运行 `pnpm --filter @metriccanvas/embed build` 和 `pnpm --filter @metriccanvas/embed preview:examples`，访问 `http://127.0.0.1:4175/examples/mount-lifecycle.html`。该入口读取上面同一份 JSON，连续点击“再次 mount”时卡片计数增加，活动实例始终为1且句柄不变；点击“销毁”后为0，再点击“再次 mount”可恢复为1。事件回调替换、不同容器隔离与销毁后旧句柄边界由 `packages/embed/tests/browser/mount-lifecycle.spec.ts` 验证。Playground 的页面呈现不作为宿主重复挂载的证明；本场景不涉及真实 DQE/Relay 或目标 Angular 宿主部署。

## 指标值切换同页 Tab

入口 `/pages/metric-card-select-tab`。[页面 JSON](metric-card-select-tab.json)。

启动 `pnpm dev:dqe`，或分别运行 `pnpm dev:playground` 与 `pnpm sim:dqe`。可用 `?demo-context=订单监控` 覆盖卡片标题。数值和明细为合成演示，明细查询通过本地 DQE Sim 执行。

1. 默认显示订单概览。切换「订单区域」到「海外」。超期明细首次激活前不发明细请求。
2. 点击「超期单数」的数值 12，切换到「超期明细」。区域仍为「海外」，查询首行订单量为 20，地址包含 `orders-region=OVERSEAS` 和 `tab.order-detail-tabs=overdue`。
3. 再次点击同一数值，明细不重复加载。「历史详情入口」执行卡片级详情。关闭详情后，按 Enter 激活同卡「零值指标」回到订单概览。缺失指标显示占位。
4. 将动作引用改成不存在的容器或页签，校验在相应 ID 位置报错。使用 6.125 时定位 `selectTab` 的版本下限。

参考卡片 `overdue-count` 与目标 `order-detail-tabs` 的 `overdue` 页签。移植时将各指标行 `action.selectTab` 的两个 ID 映射到目标页面，并沿用该页的数据与筛选。需要行级动作的指标移除旧的 `link: true`。浏览器验证页内会话、筛选与合成查询行为。真实 DQE 与目标宿主部署需另验。

## IOC 行权效率指标与明细联动

入口 `/pages/rep-office-execution-efficiency-tab-demo`。[页面 JSON](rep-office-execution-efficiency-tab-demo.json)。

该页复用「行权效率-代表处」的布局、筛选、数据源及三个明细页签。运行 `pnpm dev:playground`，页面专用仿真网关提供 2026 年 11 月的合成 KPI 和明细。可先选「卓越NA」，再点顶部的决策时长、人数或闭环率数值。两张 SDT 指标卡进入「商务审批明细」，两张闭环率指标卡分别进入商务和合同闭环率明细。页头客户分类和统计期间在切换后保留。

决策人数和时长的下划线覆盖数值，「人」和「天」单独显示。闭环率的百分号随数值一起带下划线。

## 主指标与多行次级指标

入口：`/pages/metric-card-primary-detail`；[页面 JSON](metric-card-primary-detail.json)。

启动：`pnpm dev:playground`，无需URL参数或额外服务；仅内联合成数据。

1. 第一行四卡依次为0、1、3、6行次级指标。主指标名称与大数字靠上对齐，四张卡的外框底边一致，短卡在底部留白。
2. 次级指标每行上方8px，名称14px/20px、黑色50%，数值14px/17px、黑色80%，字体为PingFang SC（系统无该字体时使用sans-serif）。下划线只覆盖可点击的数值文本。
3. 缩小至390px宽，卡片逐张堆叠并恢复自然高度；长名称允许换行，无横向溢出。边界卡保留真实0，空值显示缺失占位。
4. `detail-link` 中“已回款（可点击查看明细）”和“零值（可点击查看明细）”的数值带下划线，点击或键盘 Tab/Enter 打开明细弹窗。第一项显示 960 万元，下划线只覆盖 960。“暂无数据（已配置链接）”显示为普通文本。复用时映射 `valueField`，保留 `row.link: true` 与配套动作。演示的内联字段和金额均为合成数据。
5. 非法声明可复现：将第一张卡的`rows[0]`复制为第二个主指标，校验拒绝并定位`/sections/0/components/0/props/rows`；将版本改成6.64，校验指出6.65能力下限。
6. `mixed-variants` 分区将两张单面板 `compactStack`（有/无同比）与两张 `primaryDetail`（两行/一行次级指标）混排。1440px 下四张卡面底边一致；390px 下逐卡自然高度。同比分布、主次字体、颜色、内边距和内容位置保持各自形态，只在横排短卡底部留白。下一视觉行不继承上一行的最高高度。

仅验证页面协议、正式运行时布局与既有明细入口，不证明真实DQE、Relay或线上部署。


## MC 内容包：布局与版本检查

入口：`/pages/mc-content-layout-demo`；[实际页面](mc-content-layout-demo.json)。运行 `pnpm dev:playground`；无 URL 参数和 DQE 依赖。页面由 `tools/scripts/mc-content-fixtures.py` 调用真实本地 MC 接口生成，数据为合成诊断。

查看“安装文件完整性”“运行依赖预检”和“换行转换拒绝”：前两项分别来自实际 diagnose/preflight，第三项来自临时完整副本的 CRLF 故障注入，应显示 invalid、CONTENT_RESOURCE_MISMATCH / line-endings。页面是生成时的本地结果快照，浏览器不扫描安装磁盘，不代表 Windows/Relay 或真实服务验收。点击“检查项”排序并在 1440px/390px 核对表格与页面滚动，自动入口为 `mc-content.browser.ts`。

1. 检查表格：同源知识有界读取、完整工具参数、来源覆盖对账，以及正常编译 ok、用户要求地图 gap、IOC 计划场景 invalid、旧版 6.0 页面 upgrade_required、未来版本 needs_review、真实保存与 Relay not_run。
2. 点击“检查项”列排序，确认已有表格交互可用；390px 下检查页面可阅读，宽表在自己的滚动区域展示。
3. 通过 `mc-content/scripts/mc_content.py schema --input <旧文件>` 检查兼容性；upgrade 不带输出目录只检查，带全新目录才输出 original、page 和 migration.json，原文件不变。
4. 内容包更新后运行 `pnpm authoring:contracts` 和 `pnpm mc:content:fixtures`；`pnpm mc:content:fixtures --check` 校验页面与实际诊断一致，不能手改静态表格伪造通过。

“装配失败定位”来自真实本地装配的合成反例：查询投影缺少 region，结果字段仍声明 region。应显示 failed；正文按层级展示输入块 `/sections/0/blocks/0` 和候选页面 `/dataSources/sample/fields/region/queryField` 的校验位置，以便宽窄屏换行阅读。表格和真实回执保留原始 JSON Pointer；完整消息保存在测试消费的 `tools/fixtures/mc-content-layout/diagnostics.json` 的 composeFailure 中。修复只补齐真实缺失的投影关系，不能删字段或改业务口径。候选页面路径不作为最终 partial 页面的位置。本场景仅运行确定性工具，不执行 DQE、保存或预览交接。

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
2. 切换明细并搜索客户21，切回后核对搜索状态保留。浏览器网络记录中的明细查询应只有首次进入时的一次。
3. 在概览修改公共条件后切回明细，确认按新条件显示结果。再往返一次，确认空结果也能保留。刷新检查活动页签恢复。

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
2. 切换到明细后立即返回概览，等待合成 AI 总结完成，再回到明细检查原总结。整个往返只应生成一次。
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

1. 点击“重新播放全部加载”，两个运行时重新挂载，当前页可见的取数组件重新查询，等待3秒；标题、缺省值、图表容器、表头与搜索框保留，指标卡每个数字位置显示灰色骨架条（含变化值及完成率），表格显示10行骨架。两处都有从左向右的循环扫光，图表先按自身形态渲染灰色柱、线、圆环或底图，不显示加载提示文字或转圈；信息面板数值、排行与分类列表、字段文本与AI总结使用各自结构的静态骨架，整个预览没有加载转圈或提示文案。
2. 文本、页头、按钮、筛选器和容器没有独立请求，直接显示；已访问筛选条件与 Tab 命中缓存时直接显示。切换测试轮次或使用重播可观察新的请求。
3. 查看指标卡、仪表盘、键值面板、柱状图、折线图、饼图、地图、排行榜、排名详情、分类明细、字段文本、普通表格及组合卡子组件；数据返回后恢复真实值，原节点仍在。AI 总结在相关查询完成后生成本地 Mock 分析。
4. 下方 Tab 保留订单／收入切换、查询分页与展开明细；子表在回执前已有表头；筛选重查、点击订单量列排序和查询翻页期间，表体显示10行骨架，图表保留原生图形并灰化，待新数据整体就绪后替换。390px 下按栅格堆叠，无页面横向溢出。

自动验收：`pnpm --filter playground exec playwright test loading-structure.browser.ts`。以可控的合成 HTTP 回执暂停查询，覆盖表格10行骨架、原生图表灰态与同实例更新、指标卡加载扫光与重查直接出值、其他组件静态骨架与全页无转圈/加载文案、AI、重播、首次加载、筛选、排序与分页、展开子表、Tab 激活、原节点持续挂载及宽窄屏。组件目录与页面类型集合由 `tools/dqe-sim/tests/loading-structure.test.ts` 对账。合成回执不代表真实 DQE／Relay 或已部署环境验收。


## Tab 表格筛选后动态高度

入口：`/pages/tab-table-filter-growth`；[页面 JSON](tab-table-filter-growth.json)。运行 `pnpm dev:playground`，无 URL 参数，无服务依赖；上表 20 条、下表 10 条内联合成记录。

1. 默认、compact、analysisStack、grid 和 reportCompact 五组布局中，在上表搜索“第一组”，上下表均显示 10 行。
2. 清空上表搜索，上表恢复 20 行，下表仍为 10 行。上表按内容增高，下表及后续分区下移，各组件外层完整包含内容，没有覆盖。analysisStack 保持既有表体最大高度和内部滚动。
3. 切到“单个表格”再切回“多个表格”，保留 20 行与正确布局；重新搜索“第一组”恢复 10 行和原高度。搜索“不存在的记录”呈现空态，清空后恢复。
4. 在 1440px 与 390px 宽度重复上述操作。回归命令：`PLAYGROUND_BASE_URL=http://127.0.0.1:5173 node apps/playground/tests/tab-table-filter-growth-browser.mjs`。

验证正式运行时的搜索筛选、自然高度、空态和页签保活。数据来自 inline，未验证真实 DQE、Relay 或部署环境。本修复不新增 Schema 字段或高度配置，由引擎统一维护占位。

## 指标卡首次取数和重查共用加载骨架

打开 `/pages/metric-card-loading` 查看[完整合成页面](metric-card-loading.json)。启动 `pnpm dev:playground`，另开终端运行 `DQE_LOADING_DEMO_DELAY_MS=3000 pnpm sim:dqe`。页面使用 `MC_LOADING_STRUCTURE_DEMO` 合成查询，无需 URL 参数。

1. 刷新页面。全部 8 种形态的主数值、次级指标、变化值和完成率均在原位显示灰色扫光骨架，标题、标签和完成率环形轨道保留。首次响应返回后，主数值显示 72。
2. 将区域从“中国区”切到“海外”。取数期间出现同样的骨架，响应返回后主数值直接更新到 86。切回已缓存的“中国区”可直接显示结果。
3. 开启系统“减少动态效果”并刷新。重复切换，确认加载骨架静止，结果就绪后直接出值。

自动验收：`pnpm --filter playground exec playwright test loading-structure.browser.ts`。浏览器暂停同一页面的合成 HTTP 回执，覆盖首次加载、筛选重查、小幅数值变化、成功、空结果和 HTTP 错误；错误或空结果后显示缺失占位，不残留单位或趋势箭头；在390px窄屏检查加载时无横向溢出。该场景不证明真实 DQE／Relay 接入。

独立请求与返回补充验收：同一轮每个 HTTP 请求仅含一个 DQE 项；挂起慢查询时其他组件先显示。同一引擎实例切到另一页面再返回时，指标卡在重新查询期间继续使用扫光骨架。整页刷新或销毁实例后清除展示回执。数据网关及权限变化不复用缓存。缓存仅服务屏幕展示，执行和导出仍检查当前快照。

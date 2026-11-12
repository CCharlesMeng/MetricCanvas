# pages/capabilities/table

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 组合查询成员搜索

运行 `pnpm dev:playground`，打开 `/pages/paged-join-search`；无需 URL 参数或真实 DQE。`contract-closure-main` 与 `contract-closure-basic` 复用合同明细和基础资料查询形状，由内存仿真网关为2026年10月、11月各提供相同范围的36条合同，ID唯一。页面显式为 Dashboard，`contract-closure-joined` 独占合同表格，字段投影和搜索以页面声明为准。

默认按基础资料“合同电子流创建时间”倒序，每页10条。搜索 `0012` 返回当前期间1条合同；搜索 `00` 可继续翻页，基础资料排序按钮在非空搜索期间禁用。搜索不存在的编码返回0条，清空后回第一页并恢复默认倒序。导出 Excel 应覆盖全部搜索匹配记录，保持搜索成员的顺序。可移植查询、成员键、投影、搜索和分页结构；真实账期字段、范围等价性、合同唯一键与包含搜索编码必须在真实接入验证，不能复制仿真网关作为业务实现。自动回归直接消费本页；此示例不证明真实 DQE/Relay 行为。


## 表格单位、颜色与上下箭头

运行 `pnpm dev:playground`，打开 `/pages/table-trend-arrows`。无需 URL 参数，全部为 inline 合成数据，不需要 DQE。字段列 `arrowRule` 与 `colorRule` 独立，省略不显示。箭头默认前置，`position:"after"` 后置，两种 mode 均支持。

核对收入变化默认前置：绿色 `↑ +2.5 万元`、红色 `↓ -1.2 万元`；耗时变化显式后置：红色 `+2.5 天 ↓`、绿色 `-1.2 天 ↑`；映射可反向。固定绿色百分比列统一 ↓，包括有效零；缺失无箭头。无颜色列仅负值显示 ↓，正值无箭头；sign 模式零/缺失无箭头。普通带符号数值 ±0.04 舍入为零时无箭头，±0.05 按配置显示对应方向。枚举“已达标”、显式 none 和省略规则列均不显示箭头。紧凑表格验证反向规则和显式 before，进度条列固定前置 ↑（含零），缺失仍不显示。

点击导出 Excel，核对前置、后置、反向、固定和零的箭头规则与屏幕一致，原数值仍为数值。自动浏览器验收读取该页；缺少映射、错误枚举、布尔值、未知属性、文本绑定和旧版本由产品测试及 conformance 向量验证。此页仅验证合成数据的展示/导出，不代表真实 DQE/Relay。

## 查询默认方向与固定基线

运行 `pnpm dev:playground`，打开 `/pages/query-sort-baseline`，无需 URL 参数或 DQE 服务。该页包含合成 query 初始快照，首次打开平均决策时长列即显示降序，三个代表处依次为乙、丙、甲。点击该列循环清除、升序、降序；移开鼠标后活动方向仍可见。

下方复用行权效率页面中的两段图表声明，时长柱为 6/3/1 并显示固定 2 天基线，人数柱为 8/4/2 并显示固定 5 人基线；悬浮各类别核对指标与基线。常量不用声明 field。页面只验证初始快照、Schema 和浏览器呈现，真实 DQE 返回顺序需在内网另外核对。自动验收入口为 `tests/query-sort-baseline.browser.ts`。

## 审批人下钻查询参数

入口：[主表筛选](http://localhost:5187/pages/record-join-query-params?approver-name=合成审批人甲)、[全部记录](http://localhost:5187/pages/record-join-query-params)、[无匹配](http://localhost:5187/pages/record-join-query-params?approver-name=没有匹配记录)。

分别启动 `DQE_SIM_PORT=18387 DQE_SIM_HOST=127.0.0.1 pnpm --filter @metriccanvas/dqe-sim dev` 和 `DQE_SIM_PORT=18387 pnpm --filter playground dev --host 127.0.0.1 --port 5187 --strictPort`。页面使用默认标准数据网关，经同源 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute` HTTP 代理访问 DQE Sim；没有专用页面网关或接口拦截。夹具仅在 Sim 服务端，JSON 不含行数据、initial 或模拟开关。参数仅用于查询初始化，页面不提供审批人筛选控件。

- `approver-name=合成审批人甲`：标题显示人名，3 条审批记录，第一页有同一商务的两条记录；第二页 A-4 无基本信息，责任人为 null。
- `approver-name=合成审批人乙`：显示 1 条 A-3；不带参数显示 4 条，动态标题属性按缺值规则省略。
- `owner-name=合成责任人甲`：仅限制补列源，主表仍有 4 条，其他商务的责任人补空。
- 无匹配参数显示空表。主表请求只增加“审批人姓名”条件，补列请求只增加自己的责任人参数及本轮商务ID；不应出现只查询审批人候选值的请求。上游失败由 HTTP 运行时回归覆盖。

页面声明与浏览器验收共用此文件。打开 Network 过滤 `execute`，审批人甲应出现3条 POST：主表两个读取批次及一条基本信息补列。浏览器回归禁止零HTTP请求，保存请求体、响应体、状态和 Sim 的 x-request-id；运行时回归也通过临时 Sim HTTP 服务及正式网关执行。HTTP仿真不代表内网真实字段、权限、总数或部署成功。

## 表头候选完整查询与前端去重

入口：`/pages/table-column-candidates-query`；[页面 JSON](table-column-candidates-query.json)。运行 `pnpm dev:playground`，无需 URL 参数或真实 DQE。模拟数据位于 `apps/playground/fixtures/full-query-candidates.ts`，通过平台共用网关消费原生 DQE 合成响应。

1. 表格620条，每页20条。打开代表处筛选，首批显示50/80个去重选项；搜索“办事处80”仍能找到第620条记录中的值，它不在表格当前页或前三批200行中。
2. 选择办事处80后表格变为1条；清空候选搜索，滚动选项列表到底部自动续载，仍有80个候选，当前列自身条件没有缩小候选范围。
3. 区域列选择华南，再打开代表处筛选，仅剩办事处61—80共20项；其他列的条件仍生效。数值列可设置收入区间，候选保持原查询指标与维度粒度。
4. 打开 `?state=truncated`；表格仍可显示普通分页。打开代表处筛选显示“候选项加载失败”和重试按钮，不展示被截断的候选集合。
5. 打开 `?state=blocked-candidates`，候选请求故意一直不返回。表格先显示20行，进入视口、完成绘制并空闲后才预加载。点击“下一页”仍能显示第21行；在途后台候选被取消，候选加载不会遮住表格。普通场景预加载后打开菜单复用候选页；未就绪时只在菜单中等待。隐藏或离开视口暂停预加载。

候选原始读取为200、200、200、200的请求窗口，实际响应分别200、200、200、20行；默认扫描上限1000，恰好1000条最多5批。`?state=over-limit` 使用1001条记录，候选首批发现超限后停止，菜单提示缩小筛选范围且不提供部分选项，表格仍可翻页；`?state=raised-limit` 对同一1001条记录显式注入 `columnCandidatesMaxRows: 1200`，候选可完整读取。保留全部 `output_dims` 和非空 `output_metrics`。候选搜索、排序、分页及去重计数在前端完成；未命中候选页缓存时重新完整读取。该场景不证明真实 DQE/Relay 已联调，取消、迟到响应、缺失/变化总数和业务 TopN由行为测试补充。

## 组合查询错误定位

入口：`/pages/paged-join-diagnostics`；[页面 JSON](paged-join-diagnostics.json)。启动 `pnpm dev:dqe`，或分别运行 `pnpm sim:dqe` 与 `pnpm dev:playground`，保持统计月份 2026-09。页面沿用普通 DQE Sim 的8个代表处合成数据，所有成员关闭远端选页能力，先完整读取目录成员，再按编码补列。

1. 正常打开：第一页3行，上海、北京、广州，匹配总数8；翻页、排序和搜索保持完整关联行为。
2. 故障回放：执行 `pnpm --filter playground exec playwright test tests/paged-join-diagnostics.browser.ts --workers=1`。测试直接读取本页，通过 HTTP 响应边界分别将目录首行关联键改为 null、令第二行键与首行相同、将总数改为9、将总数改为1001。测试注入合成身份与响应，无需真实服务；使用空闲的5183端口。
3. null 与重复键均跳过一行并显示可用7行；总数9/返回8行保留8行，缺项诊断只在控制台输出。表格不显示额外提示，控制台打印 TABLE_RESULT_RECOVERED 并定位 office-directory，不包含真实业务值。总数1001超过fallback预算时仍报 DQE_QUERY_REJECTED，保留完整来源定位。

浏览器用例覆盖正常和四种故障，并输出截图至Playwright报告目录。记录模式关联键与原有分页、取消、缓存行为由共享执行回归覆盖。本地Sim和HTTP回放不等于真实DQE/Relay验收。

## 决策意见明细

入口：`/pages/decision-opinion-details`；[页面 JSON](decision-opinion-details.json)。运行 `pnpm dev:playground` 即可，无需 DQE Sim 或 URL 参数。

256 条合成统计记录，合同、商务各 128 条。复用 Dashboard 页头、正式表格、类型列表头筛选和查询分页；专用预览适配器读取两个独立分页模拟源，按全局顺序归并出当前页，不访问真实网络。

1. 初始每页 20 条，总数 256；前两行为商务 130 次、合同 120 次。合同 120 次对应占比 63.0%，由模拟后端直接给出，不按 90 ÷ 120 重算。
2. 点击“类型”列表头的漏斗，勾选“合同”或“商务”，总数为 128，全部行均属于所选类型；同时勾选两项或逐项取消勾选恢复 256 条混排。支持搜索候选；候选搜索不改变表格数据，选择或清除筛选回到第一页。弹层按内容自适应，此处短选项宽160px，长候选最多撑至360px并换行，窄屏不超出视口。上方不再放置类型按钮组。相同姓名和两边重复局部 ID 仍分别保留。
3. 点击决策总次数、有效意见数、有效意见占比列头切换升降序，回到第一页；指标 DQE 显式多字段排序会在发请求前明确失败。占比降序前三行为 88.0%、87.5%、80.0%，空值升降序均在末尾。
4. 点击第 13 页，显示序号 241—256，共 16 行。页码跳转输入框也可以直接输入 13 并按 Enter。首次深页读取需要扫描有序前缀；本预览仅保留最多 8 份页结果缓存，不提供跨请求事务快照。
5. 打开 `/pages/decision-opinion-details?sourceFailure=contract`，模拟合同来源失败；整表为空，控制台输出查询诊断，不呈现商务半份结果。表头候选也通过实际来源加载，参与来源失败时如实失败；去掉该参数恢复。单一类型查询不会执行未参与的来源，该行为由回归测试覆盖。

本页使用 `query` 协议，默认排序来自查询 `order_by_field/type`，初始列头按[查询默认排序规则](../../../docs/page-metadata/components/table.md#查询默认排序的首屏方向)回显方向。通用多来源合并使用已实现的 [`pagedUnion`](../../../docs/page-metadata/data-sources.md#paged-union)，可运行入口见[多来源字段映射与整体排序](#多来源字段映射与整体排序)；表格组件没有 `props.defaultSort` 属性。页面 JSON 单独交给其他集成应用不会自带本页专用适配器。导出和搜索未开放，本地模拟与浏览器验证不证明真实 DQE 的排序、计数或生产接入能力。

## 跨页导航目标｜销售明细

入口：`/pages/sales-detail`；[页面 JSON](sales-detail.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

接收演示页传来的区域、渠道条件，从 URL 恢复筛选后展示明细。

合成演示

建议从来源页进入

1. 先打开关联的筛选与导航示例，再点击进入本页。
2. 比较 URL、筛选器和明细范围，返回来源页。

直接打开不会自动得到来源页的点击上下文；本地仿真不证明真实服务。

关键声明：`filters`, `dataSources.*.source.query`。

关联：[demo](../layout/demo.json)。

## 多级表头、独立搜索与 Excel 导出

入口：`/pages/table-toolbar-demo`；[页面 JSON](table-toolbar-demo.json)。

启动：`pnpm dev:playground`。

查看三层表头和跨行跨列合并；搜索客户后导出全部匹配结果，两张表互不影响。

合成演示

可直接体验

1. 点击顶部表格收入实际列排序，表头仍保持三层。
2. 在客户表搜索客户2并导出 Excel，核对全部匹配记录；另一张表保持原状。

本页使用内联页面数据源；完整结果导出与当前分页显示范围不同。

关键声明：`sections[].components[].props.columns`, `sections[].components[].props.toolbar`。

关联：[table-detail-overlay](table-detail-overlay.json)。

关联：[multi-query-table](multi-query-table.json)。

## 表格点击、详情弹窗与抽屉

入口：`/pages/table-detail-overlay`；[页面 JSON](table-detail-overlay.json)。

启动：`pnpm dev:playground`。

点击订单数打开全部订单弹窗，点击待交付打开抽屉，点击异常订单查看空结果。

合成演示

可直接体验

1. 点击订单数 8，在弹窗中搜索、排序、翻页或导出。
2. 关闭后点击待交付 3 和异常订单 0；按 Esc 或关闭按钮返回。

三个入口使用已准备好的完整快照；不演示按任意点击行传参查询，query 详情需另接数据网关。

关键声明：`detailViews`, `sections[].components[].props.columns`。

关联：[demo](../layout/demo.json)。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

## 多查询组合表、全局排序与固定排名

入口：`/pages/multi-query-table`；[页面 JSON](multi-query-table.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

组合多个查询进行全局排序、跨源范围筛选和导出；对比当前序号与固定业务排名。

合成演示

固定 2026-09 仿真场景

1. 启动本地 DQE Sim，保持 2026-09；将召开率切到降序并翻页。
2. 对比两表序号与排名，再筛选或搜索天津，导出全部匹配行。

固定排名来自上游普通查询字段；组合查询源不生成业务排名，其他月份在本地仿真中显式失败。

关键声明：`dataSources.*.source.type`, `dataSources.*.source.ordinalField`, `sections[].components[].props.pagination`。

关联：[query-result-where-page](../query/query-result-where-page.json)。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

## 表格搜索｜字段切换与精确匹配

入口：`/pages/table-search-options-demo`；[页面 JSON](table-search-options-demo.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

静态搜索字段下拉框、精确匹配、切换即搜索及旧包含搜索对照；合成数据与 DQE 仿真。

合成演示

本地表可直接体验；查询表需启动 DQE Sim

1. 默认按项目名称精确搜索星河项目，结果不包含二期。
2. 切到责任人立即用现有输入搜索；切到项目编码搜索00123，清空保留选项。
3. 修改未提交草稿后导出，仍使用已生效的字段与关键词。
4. 搜索“不存在的项目”，表体显示“暂无数据”，保留表头与搜索框；清空搜索后恢复明细。

本地与 DQE Sim 不代表真实 DQE 服务验收。

关键声明：`sections[].components[].props.toolbar.search`, `dataSources.queried.source.query`。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

关联：[multi-query-table](multi-query-table.json)。

## TinyVue OS 表格样式与变体

入口：`/pages/table-tiny-os`；[页面 JSON](table-tiny-os.json)。

启动：`pnpm dev:playground`。

对照普通、预测矩阵、内嵌与保留的报表紧凑表格，检查排序、筛选、分页和多级固定表头。

合成演示

可直接体验

1. 比较四种表格，reportCompact 保留旧样式。
2. 点击金额排序，展开数值或日期筛选，搜索客户25后清空并翻页。
3. 窄屏横向滚动检查固定列；查看多级表头和导出结果。

内联合成数据，不代表真实 DQE 验收；维度候选值未注入时如实显示能力不可用。

关键声明：`sections[].components[].props.variant`, `sections[].components[].props.columns`。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

关联：[table-detail-overlay](table-detail-overlay.json)。

## 行内子表格与独立本地分页

入口：`/pages/table-row-expansion-inline`；[页面 JSON](table-row-expansion-inline.json)。

启动：`pnpm dev:playground`。

合成内联数据；展开北辰和远山，默认白底仅内容与现有表格分页；翻父页后查看空明细。无需DQE。

合成演示

可直接体验

1. 展开北辰和远山，将北辰翻到第2页，确认远山保持第1页。
2. 折叠重开回第1页；父表切到第2页展开海川，查看空结果。
3. 第二张表体验按需标题、排序及single单行展开。

导出范围待确认。内联合成明细；第二张表按需启用本地搜索。

关键声明：`sections[].components[].props.rowExpansion`, `dataSources.*.source`。

关联：[table-row-expansion-query](table-row-expansion-query.json)。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

## 按父行查询的子表格与独立分页

入口：`/pages/table-row-expansion-query`；[页面 JSON](table-row-expansion-query.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

合成数据及本地DQE Sim；展开后按父行查询，复用现有页码/每页条数/跳页控件。第二张父表演示按需标题、列排序与单行展开。

合成演示

展开取数需本地仿真

1. 展开北辰和远山，将北辰翻到第2页，确认远山保持第1页。
2. 折叠重开回第1页；父表切到第2页展开海川，查看空结果。
3. 第二张表体验按需标题、排序及single单行展开。

导出范围待确认。需本地DQE Sim；不代表真实DQE/Relay验收，查询搜索需网关编码。

关键声明：`sections[].components[].props.rowExpansion`, `dataSources.*.source`。

关联：[table-row-expansion-inline](table-row-expansion-inline.json)。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

## 表格列候选筛选与多列联动

入口：`/pages/table-column-candidates`；[页面 JSON](table-column-candidates.json)。

启动：`pnpm dev:playground`。

全表列候选、排除自身、多列联动、失配已选值与候选分页；内联合成数据。

合成演示

可直接体验

1. 打开代表处筛选，滚动选项列表到底部自动续载取得64项；搜索办事处64并勾选。候选较多时只有选项列表滚动，搜索框保持可见，不显示“加载更多”按钮；缩小窗口高度后列表随弹层可用高度收缩，外层不产生第二条滚动条。切换搜索词后列表回到顶部，搜索可匹配尚未滚动加载的办事处64。
2. 将金额下限设为650000，确认已选代表处保留并提示无匹配，第二张表保持独立。

64行内联合成数据。普通远程查询须接入已核验的列候选编码器；不代表真实 DQE 或权限链路验收。

关键声明：`sections[].components[].props.columns`, `sections[].components[].props.pagination`。

关联：[table-tiny-os](table-tiny-os.json)。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

## 表格区域点击与筛选联动

入口：`/pages/table-cell-selection`；[页面 JSON](table-cell-selection.json)。

启动：`pnpm dev:playground`，并在集成环境接入匹配的网关、数据集和权限。

点击带下划线的区域写入筛选，下表只显示该区域代表处；对照链接列与选择列。

合成演示

需启动 DQE Sim

1. 点击华南地区部，下表仅保留深圳代表处。
2. 点击华东地区部，下表切换为杭州代表处；上表仍保留全部选择入口。

合成数据经 DQE Sim 查询；不代表真实 DQE 验收。selection 只写筛选，查询通过显式 filterBindings 订阅。

关键声明：`sections[].components[].props.columns[].selection.writes`, `dataSources.details.source.query.filterBindings`。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

关联：[table-detail-overlay](table-detail-overlay.json)。

## 表格自动序号列

入口：`/pages/table-row-number`；[页面 JSON](table-row-number.json)。

启动：`pnpm dev:playground`。

查看普通表格的跨页连续序号、排序筛选后重编号与 Excel 导出。

合成演示

可直接体验

1. 将客户明细切到第2页，序号为11—20。
2. 按金额降序，客户25的序号变为1；搜索客户25后仅保留序号1。
3. 清空搜索并导出Excel，序号从1连续到25；下方对照三种变体和空结果。

内联合成数据；查询分页的偏移另由网关桩验收，不证明真实DQE能力。

关键声明：`sections[].components[].props.rowNumber`。

关联：[table-toolbar-demo](table-toolbar-demo.json)。

关联：[multi-query-table](multi-query-table.json)。

## 表格详情浮层宽度

- 页面：`table-detail-overlay.json`，入口 `http://localhost:5173/pages/table-detail-overlay`。显式 Dashboard，内联合成数据，无需 DQE；使用 `pnpm dev:playground` 启动。
- 点击订单数8打开宽版弹窗，待交付3打开同宽右侧抽屉，异常订单0打开同宽空结果；订单总额打开普通字段详情。点击下方“订单详情”指标卡也打开同一个宽版订单表格。
- 窗口1440px时宽1296px，1920px时宽1440px；390px时宽351px，极窄窗口始终保留32px宽度余量。弹窗居中、抽屉贴右；表格在内部横向滚动，页面不溢出。普通字段弹窗沿用560px上限。
- 公开 mount 集成：先执行 `pnpm --filter @metriccanvas/embed build`，再执行 `MC_EMBED_EXAMPLE_PORT=4186 pnpm --filter @metriccanvas/embed preview:examples`，访问 `http://127.0.0.1:4186/examples/detail-overlay.html`。该示例复用本页 JSON，在有高层级侧栏、transform 与 overflow 裁剪的集成应用中挂载到小 div；遮罩应覆盖整个窗口和侧栏，点击侧栏位置只关闭弹层且不触发侧栏按钮，关闭后按钮可操作。无 iframe；ShadowRoot 样式仍隔离。
- 搜索、排序、翻页、导出、Esc关闭及焦点恢复沿用原有能力。查询详情的加载、错误、取消及迟到响应由浏览器行为测试覆盖；合成页面不证明真实DQE/Relay。

## 表格缺省值不响应点击

入口：`/pages/table-missing-cell-actions`；[页面 JSON](table-missing-cell-actions.json)。无必填 URL 参数；执行 `pnpm dev:playground`，使用内联合成数据，无需 DQE。

四种表格变体各有三行：

1. “缺省值”行的选择、导航、详情与自定义 `暂无` 文案均无下划线、不可聚焦，点击不写入筛选、不跳转、不打开详情；选择列的次字段有内容也不恢复入口。
2. “真实零和横线”行中的真实 `—` 可选择、可导航；数字 `0` 可通过鼠标或 Enter 打开详情。
3. “正常值”行保留原有选择、导航和详情行为。

浏览器回归：`pnpm --filter playground exec playwright test table-missing-cell-actions.browser.ts --workers=1`，覆盖四种变体。只证明本地渲染与交互，不代表真实 DQE 或 Relay 验收。

## 原文容错和独立汇总

- `/pages/table-value-tolerance`：合成初始行，时间组合串、字符串字段返回数字和异常数值按原文展示；导出检查文本及合法数字类型。
- `/pages/table-missing-sort`：点击数值或文本表头切换升降序，空白、横杠始终排最后，0和有效文本不被误判。
- `/pages/table-pinned-summary`：需要本地 DQE Sim。每页显示独立中国区汇总，无序号、总数只计地区；翻页及选择地区不改变汇总，切换产品或月份更新两源。按地区编码搜索 `region-missing`，明细显示“暂无数据”，独立汇总仍保留；清空搜索恢复明细。汇总场景可选零行、多行、查询失败，后两项仍显示明细但不能完整导出Excel。示例没有真实授权能力，不能作为真实服务权限验收。

隔离端口启动示例：`DQE_SIM_PORT=18229 pnpm sim:dqe`；`DQE_SIM_PORT=18229 pnpm --filter playground exec vite dev --port 5180 --host 127.0.0.1`。浏览器回归：`PLAYGROUND_BASE_URL=http://127.0.0.1:5180 node apps/playground/tests/table-enhancements-browser.mjs`。

## 多来源字段映射与整体排序

入口：`/pages/multi-source-table`。从仓库启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5193`，访问 `http://127.0.0.1:5193/pages/multi-source-table`。同一页面也在组件目录的表格场景、数据功能目录的多来源有序合并中可发现；详情目标 `/pages/multi-source-contract-detail` 和 `/pages/multi-source-commercial-detail` 接收 `record-id`。

数据环境为本地合成普通分页接口，各 128 行；真实归并由产品 SourceProgram 执行，页面使用通用 `pagedUnion` 声明。成员的原始字段与最终列使用不同 ID，类型来自显式常量，商务的“可空说明”显式为 null。无真实 DQE 请求。

1. 打开页面：默认“决策总次数”降序，前 3 行依次为商务 130、合同 120、商务 100，总数 256，13 页；合同 001 的占比为 63%，保持上游值。
2. 点击“有效意见占比”：在两个来源全部记录上升序，再点降序；null 在两个方向均位于末尾。任意跳页后序号跨页连续；同值按来源与原始键稳定排序。
3. 搜索“审批人甲”：总数 3，商务 001、合同 001 和合同 003 都保留。打开类型表头筛选，可见合同、商务；选择合同后总数 2，清除恢复 3。清空搜索后恢复 256。
4. 打开审批人候选：候选从两个来源完整匹配域合并并去重；候选搜索与表格搜索独立。可空说明只有“合同专属说明”候选，不把 null 当作普通选项。
5. 点击导出：无筛选时得到 256 行的 Excel，带一行表头，排序保持当前提交视图；搜索或筛选后只导出全部匹配行。容量与异常沿用 10000 行/5 分钟上限，不输出部分文件。
6. 点击合同、商务记录中的审批人，分别进入对应来源详情；URL 保留原始 `record-id`。浏览器后退可回到原页面。
7. 访问 `/pages/multi-source-table?sourceFailure=commercial`：任一参与来源失败，整表报错，不展示合同半份记录。非法投影、单位冲突、缺失行键和旧协议版本有产品契约反例；取消、总数变化重试、缓存检查点和大规模按需源由行为测试补充。
8. 访问 `/pages/multi-source-table?rowFailure=duplicate`：同一商务来源重复行键仅保留第一条，总数255；`?rowFailure=missing-key` 跳过空键记录，总数255；`?rowFailure=order` 有界完整整理后全局排序，总数256。均不显示额外提示，来源诊断通过控制台 warning 输出，Excel 附数据异常说明。清除参数恢复正常；跨200行批次重复及检查点由行为测试覆盖，合成故障不证明真实 DQE 分页稳定性。

验收记录：[paged-union](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/paged-union/acceptance.md)。模拟、真实浏览器、静态协议及真实 DQE 分层报告；本页不证明真实服务具有稳定排序、NULL 规则、搜索编码、准确计数或候选接口。

## 顶部筛选联动列显隐

- `/pages/table-column-visibility`：Dashboard，四种表格变体共用内联合成记录，无需 DQE。顶部“列范围”在完整列、仅客户、全部隐藏间切换。先搜索“华南”或在第二表按项目精确搜索，再切换，观察搜索范围/选项、组表头、页码及 Excel；全部隐藏保留标题和专用提示。
- `/pages/table-column-visibility-scopes`：内联合成数据，先展开父行，再切换全部隐藏并恢复，确认子表保持收起；仅客户时再次展开只显示产品列，点击客户查看详情表，Tab 内表格沿用相同列条件。
- `/pages/table-column-visibility-report`：Report 专属验收，顶端筛选切为仅客户后导出 PDF/PNG；开始后切回完整列，文件保持导出开始时列范围。已有行内子表导出限制未解除。

启动：`pnpm dev:playground`；按控制台端口打开上述页面。自动浏览器验收直接读取对应页面，不替换筛选配置：`COLUMN_VISIBILITY_BASE_URL=http://127.0.0.1:5197 node apps/playground/tests/table-column-visibility-browser.mjs`，静态导出另运行同目录 `table-column-export-browser.mjs`。源码规则、边界与说明见[表格协议](../../../docs/page-metadata/components/table.md#table-column-visibility)。

浏览器/inline 和模拟网关集成测试均不证明真实 DQE、Relay、业务事实或权限接入已验收。

## 审批记录关联与全局筛选

入口：[record-join-demo](http://localhost:5187/pages/record-join-demo)，文件 `record-join-demo.json`。无需URL参数；在对应工作树执行 `pnpm --filter playground exec vite dev --port 5187`。使用当前预览Adapter的1205条合成审批记录，不访问真实DQE。

默认2026-09，显示1205条；搜索 `BIZ-00001`，显示初审、复审两条及相同当前责任人；搜索 `BIZ-00000`，两条记录均保留，基本信息显示空值。生命状态候选同时包含“已关闭”“进行中”；仅选“进行中”显示601条，切换候选、排序及翻页都对完整范围生效。将起止期间均改成2026-08并按Enter提交，显示0条。恢复默认条件导出XLSX，包含1205条记录；添加 `?sourceFailure=true` 产生 `DQE_TRANSPORT_ERROR` 控制台诊断，表格沿用现有空态，不显示部分成功结果或成功总数。

自动化直接读取业务页面配置，覆盖分批读取、重复商务ID、补列表重复键、取消、资源预算、搜索、候选和导出。证据见 `docs/evidence/paged-join-records/acceptance.md`；真实DQE字段、时间格式、区域及HCS业务约束仍未验真。

## DQE 单字段排序回归（2026-10-27）

启动 `pnpm dev:dqe`，访问 `/pages/query-result-where-page`，初始金额降序、切换执行周期列和翻页，网络请求的 order 只能使用 order_by_field/type 与 offset/limit。Shift 追加第二排序列时明确失败，不能发送 by 数组；普通点击恢复单列查询。访问 `/pages/table-row-expansion-query` 展开客户，子表格默认按行键升序，切换产品列排序时不追加行键。访问 `/pages/multi-source-table` 验证两个来源整体排序和翻页；此页为合成独立网关，也经过正式 DQE 排序编码校验。418行等指标、行键逆序、跨200行批次由 dqe-sort-contract.test.ts 验证。合成浏览器与 Mock 不证明真实 DQE 的比较、计数或跨批稳定性。

### 审批期间下推与读取预算

入口 `/pages/record-join-demo`；在仓库执行 `pnpm --filter playground dev --host 127.0.0.1 --port 5192`。本页使用1205条合成审批记录，通过与业务页相同的主表时间绑定，在返回总数和分页前过滤，不需要真实DQE服务。

默认2026-09显示1205条；将审批期间起止均改为2026-08并提交，显示0条；改回9月恢复1205条。搜索BIZ-00001保留同一商务的两条审批，翻页保持全局序号。`?sourceFailure=true`模拟上游失败，不能发布部分成功。共享执行回归另覆盖“未过滤总数1299225、下推后12条”的请求边界，以及过滤后仍超预算的拒绝。

浏览器合成适配器验证交互；真实HTTP编码由共享网关回归验证，二者均不证明真实DQE接受审批时间维度比较。业务页面为 `pages/business-rejection-details.json`；真实服务须返回过滤后的准确total_count。


### 记录关联省略行数预算（6.69）

入口 `/pages/record-join-no-row-limit`，使用完整页面 `record-join-no-row-limit.json`。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5202`；无需URL参数或真实DQE。现有合成Adapter提供100001条审批记录，页面不声明 `records.maxRows`，保留128 MiB累计字节限制和单批60秒超时。默认9月完整读取后显示100001条；搜索 `BIZ-50000` 能找到末尾的一条审批及当前责任人，证明全局查询未截在十万条。清空搜索、排序和翻页复用完整关联结果；8月为0条。添加 `?sourceFailure=true` 模拟上游失败，不能显示部分成功。完整导出仍有独立10000行限制。

`business-rejection-details.json` 与 `record-join-demo.json` 也省略行数预算，保留各自字节和超时配置。旧页面显式 `maxRows` 继续执行；把它移除需同版6.69运行时和校验器。自动回归覆盖跨十万行关联及末尾搜索、显式行数拒绝、字节拒绝、超时、取消、截断及计数变化。本场景使用合成数据，不证明真实内网性能和最终业务查询成功。


## 层级筛选联动父子表格

入口：`/pages/table-hierarchy-selection`。正式6.70 Dashboard，合成 DQE HTTP 数据；代表处明细没有 parent，归属使用独立查询。启动 `pnpm dev:dqe`（默认 Sim 18228、Playground 5173）；独立工作树可分别使用 `DQE_SIM_PORT=18229 pnpm sim:dqe` 与 `DQE_SIM_PORT=18229 pnpm --filter playground dev --port 5210`。

地区范围只有一个单选树形下拉，外面没有地区部／代表处按钮或返回按钮。候选基于同一合成夹具的显式归属关系建树；展开箭头只展开节点，不改变筛选。首屏地区部4行，父表每页2行，不查归属及子表。在树内选华东仅保留整体1200，手动展开5个代表处；再次打开同一下拉并展开华东，直接选上海，先定位 O101→R01，再自动展开华东，整体1200、上海360。年度2025为960/288；共同条件保留展开或手动收起，子页回1，父页保持。改选地区或清空恢复默认；搜索节点、取消弹层不提交草稿，URL保留原始O101与office层级。

候选包含合成“全球”节点；选择全球保留全部4条父记录，页头与URL保留该选择，不执行归属定位。选华东为父1行子5行，选上海为1/1行；从两者切回全球均恢复父4行子17行的完整导出。全球或未选择时只展开华东、子表搜索上海再导出，Excel仍为同一个缩进父子工作表。父搜索和表头条件限定父域，父页与子局部状态不限制完整范围；不展开也可导出。浏览器回归 `apps/playground/tests/table-child-export.browser.ts` 覆盖上述全球切换与下载内容；数据仅为合成 DQE Sim，不代表真实服务验收。

异常候选含“定位无结果”“归属不唯一”“定位失败”，均显示诊断，不展示全量、不发目标子查询。URL初值：`?region=O101&region.level=office&year=2026&product=all`。合成搜索编码仅支持示例代表处名称；实际服务需提供候选与归属查询，真实 DQE/Relay/权限未由此场景证明。正式证据在 `docs/evidence/hierarchical-row-expansion/result.md`。

## 分页合并组合行键（6.72）

入口：`/pages/multi-source-composite-key`。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5197`，访问 `http://127.0.0.1:5197/pages/multi-source-composite-key`。页面来自实际 JSON 自动发现，沿用 Dashboard 与共享表格；两个来源由 `apps/playground/fixtures/decision-opinion/union-gateway.ts` 提供合成数据。

- 合同来源的“审批人甲”同时出现在“示例一处”和“示例二处”，两行都保留；商审与合同的相同组合按来源分别保留，合计256行。成员使用 `rowKeyFields:["contract-approver","contract-office"]` 等对应字段，最终行键仍为字符串。
- 切换页码与排序、搜索“审批人甲”、筛选类型，并导出 Excel，观察统一结果；来源详情导航继续使用原始记录编码，与行身份分开。
- `?rowFailure=duplicate-composite` 使商务来源第2行复用第1行的审批人与代表处，保留第一条并显示来源 warning，总数255，不回显业务值。
- `?rowFailure=missing-composite-key` 使第2行代表处为null，跳过无效记录并显示来源 warning，总数255；清除参数恢复正常。空白字符串、缺字段、类型错误、跨200行批次重复、旧声明及initial回放由契约和行为测试覆盖。

这些场景只验证本地合成数据与统一运行时，不证明真实DQE的指标、权限、排序或跨批稳定性；组合键不会自动追加排序字段。

## 分页合并可选UUID行键（6.73）

入口：`http://127.0.0.1:5197/pages/multi-source-generated-key`。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5197`。完整 JSON 使用 Dashboard，两个成员显式选择 `rowKeyGeneration: "uuid"`，数据由 `apps/playground/fixtures/decision-opinion/union-gateway.ts` 合成。

默认显示256行。操作翻页、搜索、排序和导出应保持完整有序结果。追加 `?rowFailure=missing-composite-key`，第二条商务记录的代表处为空但仍显示；追加 `?rowFailure=duplicate-composite`，重复业务组合仍保留256行；追加 `?rowFailure=order`，完整整理后显示有序256行及 warning。对照 `/pages/multi-source-composite-key`，其空组合分量跳行、重复组合保留第一条。

成员可分别选择单键、组合键、UUID；后者只给返回行分配临时身份，刷新或重新取数可能变化。业务字段需按实际可空性声明，业务正确性及分页无重叠由上游保证。此页面和测试只证明本地共享执行链与合成网关，不证明真实DQE/Relay数据契约。


## 异常数据兼容与缺项导出

入口 `/pages/table-data-recovery`；[完整页面](table-data-recovery.json)。运行 `pnpm --filter playground dev --host 127.0.0.1 --port 5198 --strictPort`，访问 http://127.0.0.1:5198/pages/table-data-recovery，无需 DQE Sim。

- 默认混合故障：多来源合并保留6条可用记录（不规则行跳过、重复 key 留首条），记录关联保留8条审批记录（重复基本信息留首条）。缺字段和不可用对象值显示 —；两表不显示额外提示，控制台以 warning 记录来源诊断。
- 合并表每页3条，第二页仍3条，总数6；搜索、筛选和排序作用于整理后的匹配范围。分别导出两表，数据工作表分别为6/8行，不受当前页影响，另有“数据异常说明”工作表。
- 访问 `?recoveryState=ready` 模拟数据准备好后刷新：两表恢复8条，控制台不再产生异常整理 warning；正常导出不附说明表。
- 合成数据与故障注入在 `apps/playground/fixtures/table-recovery.ts`，基础种子在 `decision-opinion/model.ts` 与 `rejection-details/gateway.ts`。自动浏览器检查执行 `node apps/playground/tests/table-data-recovery-browser.mjs`，输出到 `docs/evidence/table-data-recovery/browser/`。

静态合法、模拟网关、实际浏览器和下载回读属于本地证据；真实 DQE/Relay、真实模型和线上部署不在本轮证据内。预算、权限、网络和取消仍明确失败；异常整理限制见[数据源说明](../../../docs/page-metadata/data-sources.md#table-result-recovery)。

## 记录关联单批超时

入口 `/pages/record-join-batch-timeout`，完整页面 `record-join-batch-timeout.json`，无需 URL 参数。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5203`。合成适配器位于 `apps/playground/fixtures/rejection-details/gateway.ts`，12条审批、每批2条，主表与补列请求每次延迟250ms，`records.timeoutMs: 1000`。整轮耗时超过1秒后仍应显示12条完整记录；搜索 `BIZ-00005` 应找到两条审批及当前责任人，翻页和搜索复用完整结果。

加 `?sourceTimeout=true` 将每次请求延迟改为1500ms，单批超过1000ms后出现错误态，无审批行；去掉参数可重新完整读取。字节仍整轮累计，已有字节拒绝回归保持。自动浏览器验收 `node apps/playground/tests/record-batch-timeout-browser.mjs <证据目录>`（`RECORD_TIMEOUT_BASE_URL` 可覆盖默认地址）。本场景仅证明合成适配器下的超时、完整性及缓存行为，不证明真实 DQE/Relay 性能。

## 组合查询按需分页

入口 `/pages/paged-join-on-demand`，页面 `paged-join-on-demand.json`，80个全新合成项目；入口 `/pages/record-join-on-demand`，页面 `record-join-on-demand.json`，1205条合成审批。启动 `pnpm dev:playground --host 127.0.0.1 --port 5183` 后打开对应路由；普通数据来自 `apps/playground/fixtures/query-join-gateway.ts`，记录数据来自 `apps/playground/fixtures/rejection-details/gateway.ts`，不调用真实DQE。

普通表首屏10行、总数80；可见后在空闲时按所属成员自动读取“项目名称”和补充成员“项目状态”的候选，不执行完整组合读取，下一页从P000011开始。打开状态菜单复用两个候选，过滤“项目状态=已关闭”总数40、筛选标记为黑色，旧审批次数排序清除；本列显式配置 showSelectAll:true，点击“全选”恢复总数80，省略 showSearch 不显示搜索框；项目名称显式 showSearch:true，省略全选开关不显示全选。两种菜单均无无法执行的“为空”入口。再点击审批次数排序，总数回80，状态勾选清除。只有本页键参与补列。记录表首屏10条、总数1205，使用真实合成记录id；补列源选页无法正确表达时保留原页及能力诊断。候选读取不影响主表翻页。

可观察来源：普通预览发布 `metriccanvas:synthetic-paged-join` 事件，含单源生效查询，验证limit/offset和键范围；每页默认10条、补列批次10条。截断、重复与范围外键由执行测试注入并验证失败后没有完整恢复。浏览器脚本 `apps/playground/tests/paged-join-query.browser.ts` 与页面使用同一声明。合成执行、Chrome交互、CI和真实DQE分别验收；真实分页/计数/空值能力未因此获得证明。

候选预览另发布 `metriccanvas:synthetic-paged-join-candidates` 事件，包含所属成员的候选请求，可在打开菜单前核对 project-status→项目状态 映射。维度与对象查询编码由执行层回归分别覆盖；本页合成网关不证明真实 DQE 权限或服务完整性。普通及紧凑变体的 select、日期和数值范围黑色标记与清空恢复灰色另由 `/pages/table-tiny-os` 和 `table-filter-active.browser.ts` 验证。

### 按页补列空关联编号兼容

同一完整页面 `/pages/paged-join-on-demand?supplementKey=empty` 注入第11条空关联编号：主表仍10行、总数80，显示来源与忽略1条的告警；下一页仍从P000011开始，只有当前页编码参与补列，不启动完整读取。`?supplementKey=all-empty` 显示10条主行且补列为空，告警计数10；`?supplementKey=truncated` 保留截断错误，`?supplementKey=failure` 保留权限错误。去掉参数恢复正常页并清除告警。完整导出按页取得80条并附异常说明，不把缺项文件冒充完整原始结果。数据和故障均来自 query-join-gateway.ts，不证明真实DQE。

### 可空排序字段沿用后端顺序

入口 `/pages/paged-join-on-demand?nulls=first`、`?nulls=last`，启动方式同上。合同金额字段声明 `nullable:true`，合成源将P000001、P000012等每隔11条的金额置空。点击“合同金额”升序或降序，first场景的8条空值始终排前，last场景始终排后；翻页应保持后端顺序、每页10条和总数80，补列不重新排序。完整导出与屏幕使用同一排序视图。去掉参数恢复无空值数据。浏览器回归直接读取本页，执行回归同时覆盖省略nullable、默认查询排序、逐页读取及导出；关联键、准确总数、截断、权限和“为空”筛选的既有限制继续验证。此场景仅证明引擎保留合成后端顺序，不证明真实DQE的稳定排序、计数或空值行为。

## 父行展开缓存

`/pages/table-row-expansion-cache`（`table-row-expansion-cache.json`）：启动 `pnpm dev:playground` 后直接打开，无参数、无需外部DQE，使用专属内存仿真Gateway。

1. 展开北辰科技，子表翻到第2页后收起并重开：仍为C01-011起始的第2页，不新增查询。
2. 同时展开远山制造：从C02-001开始，数据和页码独立。
3. 收起后切换父表页码，再返回重开：缓存已失效，重新请求第一页。整页刷新也会清空缓存。
4. 请求数、隔离和刷新由 `apps/playground/tests/row-expansion-cache-browser.mjs` 验证；条件/参数/上下文变化、错误/空结果、取消迟到响应和20实例上限由运行时回归覆盖。

此为本地仿真与浏览器证据，不代表真实DQE或生产权限联调。用户页面无需新增缓存字段。
## 商务类型前端枚举（6.80）

<!-- example-guide: task=column-enums; page=table-column-enums; components=business-types -->

入口 `/pages/table-column-enums`，内联合成编码0、1、9和空值。单元格显示项目商务框架、项目非框架、9、—。打开商务类型筛选直接看到两项中文枚举，选择项目商务框架仅保留 B-1；清空后导出 Excel，前两条为中文标签。枚举选项不请求候选接口；查询页仍使用原始编码过滤。业务页 `/pages/business-decision-all-details?approver-name=合成审批人甲&mtime=month:2026-11` 通过 DQE Sim execute 返回原始编码，再由前端映射。

复用用途：在保留原始编码的同时，为表格单元格、静态筛选候选和 Excel 提供中文枚举展示。

参考对象：完整页面 [table-column-enums.json](table-column-enums.json)，组件 `business-types` 的 `biz-type` 与 `numeric-code` 列；关注列的 `enumValues`、`filterable`，以及 `main` 数据槽引用的 `businesses.fields`。按组件及字段身份定位，数组下标仅表示当前文件位置。

移植边界：沿用目标页已确认的字段类型与原始编码，只替换有业务依据的标签映射；保留目标页的数据源、查询、筛选和分页方式。`businesses` 的合成数据仅用于演示，数值编码与字符串编码不能混用。单元格、候选和导出需要分别核对，结构合法不能单独证明三者行为一致。

可观察预期与环境：本页为 inline 合成场景，无需 DQE；按上文操作核对标签、未映射编码、筛选结果和 Excel。真实查询的下推行为另在对应 DQE 场景验收，本页不证明业务编码全集或真实服务兼容性。

## 列头筛选默认选中值

入口 `/pages/table-header-filter-defaults`，页面 JSON 为 `table-header-filter-defaults.json`，显式 Dashboard，使用内联合成数据，无需 DQE。运行 `pnpm dev:playground`。下方固定默认值对照中，第一表默认待审批且编码为数值1，显示 A001/A003；第二表共享源但独立默认已通过，显示 A002/A005；第三表默认 archived，显示空态，菜单仍保留可取消的已选值。

清空第一表审批状态条件后编码1仍生效，共4行；切换到隐藏审批状态再显示，该列条件保持清除。清空编码后恢复6行，可翻页；第二表保持两条已通过记录。下载 Excel 使用当前条件，不重新套用默认值。刷新整个页面恢复声明默认。

远程入口 `/pages/table-header-filter-defaults-query`，同名 JSON 使用已有 Demo/Approval Details 的 DQE Sim 合成夹具。分别启动 `DQE_SIM_PORT=18402 DQE_SIM_HOST=127.0.0.1 pnpm --filter @metriccanvas/dqe-sim dev` 和 `DQE_SIM_PORT=18402 pnpm --filter playground dev --host 127.0.0.1 --port 5202 --strictPort`。通过默认网关和同源 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute` HTTP 代理读取。下方“东区审批记录”对照表的首个主请求 fields 条件包含区域=东区，每页2条；首屏 R001/R003，总数14。翻页仍只读东区，清空区域后总数28；清空状态的导出为28条，整页刷新恢复东区14条。候选请求与主请求应按实际字段投影区分。此场景不证明真实 DQE、Relay、权限或部署。

## 表头参数初始化（Schema 6.85）

启动 `DQE_SIM_PORT=18405 pnpm sim:dqe`，另执行 `DQE_SIM_PORT=18405 pnpm --filter playground dev --host 127.0.0.1 --port 5206`。

- 来源：`/pages/table-header-filter-param-source`。有效意见数传“是”，决策总次数传重复键“是、否”，直接打开不传参数。
- 内联合成：`/pages/table-header-filter-defaults?is-valid=是`。首个表为“参数初值（全选不限）”，其“是否有效意见”列通过 initialParam: is-valid 读取 URL；“参数初值（显式值集合）”及“参数 Tab 会话”同列也引用该参数，各持有独立状态。顶部“URL：是／否／不限”按钮直接打开对应 URL。原有静态默认值表移到下方对照。“全选不限”表全选/清空后返回4条（含空值、待定），“显式值集合”表全选返回2条。
- DQE Sim HTTP：`/pages/table-header-filter-defaults-query?region-input=西区`。首个表为“参数初始化区域（合成 DQE）”，其“区域”列通过 initialParam: region-input 读取 URL，首个请求带西区；顶部“URL：东区／西区／不限”按钮可直接切换入口，改选东区、清空、翻页、刷新数据与 Excel 均使用当前条件；原静态东区表保持自己的默认值。
- 分别打开不传参数、`?is-valid=否`、`?is-valid=是&is-valid=否`；初态为不限、否、不限（values 表保留两值集合）。`?is-valid=`、重复同值、`?is-valid=unknown`、`?is-valid=%5B%22是%22%5D` 应显示输入或定位到 initialParam 的诊断，不发无条件查询。
- 清空后切换 Tab/翻页/刷新数据并导出，筛选图标保持不限；重新打开页面实例重新取 URL 初值。恢复空视图、取消和迟到响应由行为测试补足。

这些是合成数据与 DQE Sim 证据，真实 business-decision-details 原件、真实 DQE、Relay 与部署均另验；不能以本示例冒充业务迁移。

## 分页与弹层边缘定位

入口：`/pages/table-pagination-popovers`；[页面 JSON](table-pagination-popovers.json)。运行 `pnpm dev:playground`，不需要 URL 参数或 DQE 服务。页面仅使用16条内联合成记录。

1. 初始每页1条，共16页；选择每页20条后显示全部16条，每页条数选择器继续保留，再选择10条可恢复两页。单页隐藏页码、前后页与跳页控件。
2. 将分页条数菜单的触发控件滚动到视口底部，菜单向上展开；控件靠近顶部时向下展开。表头数值筛选、搜索字段下拉同样根据空间定位，空间不足时可在菜单内滚动。
3. `pnpm --filter playground exec playwright test tests/table-pagination-popovers.browser.ts --workers=1` 自动验证16页切单页再切回及上下边缘定位、Escape关闭。UI组件的多选、树、范围、单选、菜单及日期在普通DOM和ShadowRoot中由 `packages/ui/tests/browser/popover-edges.spec.ts` 回归。这里只验证浏览器交互，不作为真实DQE、Relay或部署证明。

### 自定义展示单位

入口 `/pages/chart-table-unit`，无需 URL 参数，明细为 inline 合成数据，汇总为完整 query 的合成 initial 快照。运行 `pnpm --filter playground dev --host 127.0.0.1 --port 5183` 后打开页面：柱图和折线单系列图例分别含“审批时长（天）”与“平均用时（天）”；数字标签及悬浮提示为“12.5 天”，混合图对照金额显示“2.5 万元”。表格时长含单位，零为“0 天”，缺失为“—”；置顶汇总为“10.5 天”。点击时长排序仍按原数值，点击导出表格后 Excel 保留原值并展示单位。饼图图例显示“12 家”。窄屏检查完整文字与表内滚动。该场景验证展示和本地导出，不证明真实 DQE/Relay。

## 十二行可视高度与内部滚动

入口：`/pages/table-twelve-row-viewport`；[页面 JSON](table-twelve-row-viewport.json)。运行 `pnpm dev:playground`，无需 URL 参数或外部服务，全部为内联合成数据。

1. 普通、预测矩阵、内嵌和紧凑表格各有二十条当前页数据，可视区域最多十二行；在表内滚动到第20条，表头始终可见，分页条在滚动区外。
2. 每页数量改为10时按十条实际高度收缩；改回20或50后恢复最多十二行高度，记录和总数不丢失。翻至尾页仅五条，表格随之收缩。
3. 多级表头表格有25条，三层表头另计高度，窄屏长文本换行后仍按十二行实际高度限制，并可横向滚动到最右列。
4. 搜索“客户25”后短表自动收缩至一行；清空搜索恢复。最下方十条短表没有多余空白。Excel 保持完整数据范围，PDF/PNG 静态导出不受十二行裁切。

浏览器回归直接读取本页，覆盖实际滚动、粘性表头、短表及分页大小变化。静态导出解除限高由组件边界验证；本场景不代表真实 DQE/Relay 或部署验收。

父子表格对照 `/pages/table-row-expansion-cache` 使用延迟合成查询：第一次展开后即可看到订单号 C01-001，子表下一页显示 C01-011，不需要折叠重开。父表前十二条父行的展开内容额外计入高度，子表保持自己的分页和行数限制。自动回归同时核对真实视口交集及父表滚动容器高度，避免仅因 DOM 内已有文字而误判通过。

## 显式全选入口（Schema 6.98）

列头弹层始终没有“清除筛选”按钮，不再随选中状态增减入口。取消勾选或清空范围输入即可清空该列条件。

入口 `/pages/table-header-select-all`，运行 `pnpm dev:playground`，无需 URL 参数或数据服务，全部是内联合成数据。静态“是／否”字典与动态候选使用同一 `filterable:{mode:"select",showSelectAll:true}`；新例不配置 allBehavior。

1. 前两表初始仅“是”，总数1；点击全选后保持勾选，总数4，包含“待定”和空值。翻到第二页查看 C/D，取消全选仍为不限，之后单选“是”恢复1条。
2. 动态表先全选，再在区域列选择东区：总数3，仍含空值；其他列和业务范围不因全选而删除。动态表取消“待定”后剩余“是／否”，共2条，逐项选满后恢复4条。
3. “省略开关”和“false”两表没有全选入口；逐项选“是／否”只返回2条。Tab 内表格全选后切换其他面板再返回仍保持全选。
4. “仅空值”表的动态候选为空，仍可全选恢复唯一的空值记录。前两表全选后导出 Excel 为4条；省略开关、单项和其他列筛选均按各自会话导出。旧 `/pages/table-header-filter-defaults` JSON 不作迁移，已有 allBehavior 仍按原规则执行。

动态分页入口 `/pages/table-header-select-all-query` 使用既有完整候选合成 Adapter，无需 DQE。代表处列初始加载50/80项，全选禁用；滚动列表到底部自动续载至80项后全选返回620条。搜索时隐藏全选，清空关键词后需重新取得完整候选；`?state=over-limit` 显示候选上限错误且没有可用全选。既有 `/pages/table-column-candidates-query` 保持旧 JSON。本示例不证明真实 DQE/Relay 集成。

## 审批意见溢出提示

入口：`/pages/table-long-text`；[页面 JSON](table-long-text.json)。运行 `pnpm dev:playground`，无需 URL 参数或外部数据服务，全部为内联合成数据。

四种表格外观的普通文本主值均按实际列宽单行省略，超出时显示 `…`；鼠标悬停查看 tooltip 全文，没有截断的短内容不弹提示。没有80字阈值、“更多”或点击展开。对照80/81字文本与不同列宽，验证省略只与实际宽度有关。提示保留多行原文及组合 Emoji；可以移入提示选择文本或滚动，Esc、移出、表格滚动或数据变化关闭旧提示。

`link-fallback` 表复用同一批合成数据，仅“短意见”命中 `navigateBySource` 的导航目标；其余来源退回普通文本。长意见应保持非零文字宽度、单行省略和悬浮全文，“未配置导航”的短意见直接可见且不弹提示；Excel 保留全部原文。移植时保留来源字段与导航 cases 的对应关系，业务来源码和目标地址须替换为目标页面的实际值。浏览器回归只断言宽度、溢出、提示内容和工作簿值，具体视觉效果由人工验收。

在宽屏和390px窄屏自行检查省略和悬浮提示：提示为白底深色文字，在单元格右侧垂直居中显示，靠近窗口边缘时向内收齐到视口右边界，不翻转到单元格左侧。Excel、PDF/PNG 静态呈现保留全文且无 tooltip。已有选择、导航和详情入口保持原交互，受控语义 HTML、数值、次字段与徽标不参与本次省略。本场景不证明真实 DQE/Relay 接入。

## 时间格式与固定 UTC+8

<!-- example-guide: task=time-format; page=table-time-format; components=times -->

入口 `/pages/table-time-format`；页面为 inline 合成数据，无 URL 参数、无需 DQE。运行 `pnpm dev:playground` 后直接打开。原始 ISO、偏移、无时区、斜杠、紧凑结构和秒/毫秒数字字符串均显示相同 UTC+8 时刻；首七行时间应为 `2026-11-10 02:30:00`，跨年为 `2027-01-01 02:30:00`，非法日期保留原文，空值显示 `--`。右侧另有 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm`、`HH:mm:ss`、`YYYY年MM月DD日` 四列；首行分别为 `2026-11-10`、`2026-11-10 02:30`、`02:30:00`、`2026年11月10日`。点击表格导出 Excel 核对各格式列与页面文本一致，空值保持空单元格。此页仅验证前端转换与本地导出，不代表真实 DQE/Relay。

复用用途：将表格中的多种时间输入统一转换为固定 UTC+8 的显示文本，并让表格与 Excel 使用相同时间格式。

参考对象：完整页面 [table-time-format.json](table-time-format.json)，组件 `times` 的 `createdAt`、`dayAt`、`isoDayAt`、`minuteAt`、`clockAt`、`chineseDayAt` 字段引用及其 `format:{type:"time",pattern:...}`；`records.fields` 保留原始字段类型，`raw` 列用于对照输入。

移植边界：映射目标页已有字段及数据槽，保留查询、筛选、分页与导出关系，仅移植已确认的时间格式。无时区输入按 UTC 解释，显示固定 UTC+8；不要把格式展示当作业务时区转换或改写源值。合成记录、列标题和文件名不作为目标页业务数据。

可观察预期与环境：使用上文 inline 入口检查普通、跨年、非法与空值，分别核对页面文本及 Excel。本文描述操作预期，指南未声明本轮结构、浏览器或导出已执行；真实 DQE/Relay、权限和业务时区口径另验。

## 无行键子表与重复记录（6.105）

入口 `/pages/table-child-keyless`；页面显式 Dashboard，使用合成规范化网关，无需 DQE 服务或 URL 参数。运行 `pnpm dev:playground` 后访问该路径。

1. 查询父表初始4条，每页2条；展开华东，第一页同时显示两条“上海”，金额分别360和999，子表共6条，每页2条。下一页显示江苏、浙江；折叠再展开保留当前页，两个不同金额记录不能被合并。
2. 在子表搜索“上海”显示两条；改变排序与每页条数沿用原表格能力，清空排序恢复查询声明的代表处编码升序。选择页头上海时，父指标保留整体，子表仍显示两条上海记录。
3. 未展开直接导出，Excel 只有“父子表格”一张数据表，含4条父记录、18条子记录。A2/B2为华东/1200；A3留空、B3/C3为子表表头“代表处/金额”，B4/C4与B5/C5分别为上海/360、上海/999，子表各行A列均为空。华东6条子记录写完后，第10行继续中国区父记录，再写其缩进子表；两条上海不能被合并。子表搜索、分页或收起不缩小导出范围；页头选上海后导出父1条、子2条。
4. 下方“内联子表”展开后显示两条甲代表处，金额10和20。两种子表都不声明 rowExpansion.table.rowKey，父表 rowKey 保留。显式填写错误或重复子表行键仍失败；无行键查询缺少默认排序、旧版本省略子行键均被契约校验拒绝。

这里验证合成数据、完整导出和浏览器呈现，不证明真实 DQE/Relay 的排序稳定性或权限。真实授权规范回执的两条广东记录由本地重放另验，不把业务回执放入公共夹具。

### 伙伴健康度计算、排序与组合标题

入口 `/pages/partner-health-interactions`，无需 URL 参数；`pnpm dev:playground` 后直接访问。仅使用合成内联输入，复用 `partner-health` 的列和图表配置，`sumFields` 在前端计算总分，不连接真实 DQE。

点击“伙伴健康度得分”列头，观察完整 12 行按计算总分升序／降序，再按每页 10 行分页；翻页后顺序连续。点击“伙伴声音闭环率”数值，弹窗标题包含实际行的地区部、指标名与数值。图表各柱显示四类得分的合计，包含风险负扣分，合计标签与可见柱顶保持 8px 间距。错误字段、空片段数组、表达式以及旧版本使用新标题由协议测试验证；真实 DQE、权限和业务口径需独立联调。

### 单工作表缩进父子导出

入口 `/pages/table-hierarchy-selection`（合成 DQE Sim，`pnpm dev:dqe` 启动）或 `/pages/table-child-keyless`（内存合成网关，`pnpm dev:playground` 启动），无需 URL 参数。两页均已显式启用完整父子 Excel，父子表是否展开不限制导出。

点击导出后，检查只有“父子表格”一张数据工作表，主表记录从A列开始，每条记录下面紧跟自己的子表表头及完整明细，子表从B列开始且A列留空。下一条父记录接在前一个子表之后；父子字段名称可以相同。页头选择、父表已提交搜索和表头条件收窄范围，子表局部搜索和分页不缩小导出。空子表显示缩进表头及“暂无数据”，父表为空只输出主表表头；多级表头、序号和格式由独立 Excel 读取器回验。这里不证明真实 DQE/Relay 接入或实时分页事务一致性。

## 前端计算总分默认排序（6.108）

入口 `/pages/table-default-sort`，无 URL 参数；`pnpm dev:playground` 后直接访问。页面使用合成 inline 输入，`scores.compute` 计算总分，两张同源表分别声明降序和升序。参考对象为 `descending`、`ascending` 及其 `props.defaultSort`，移植时替换字段与计算口径，保持完整结果、本地分页和最终字段引用，不复制演示业务值。

首屏左表从合成地区部12开始，右表从合成地区部01开始；左表下一页只含合成地区部02、01。点击一张表的排序列不改变另一张表，清空排序回到输入顺序。结构和行为回归拒绝旧版本、未知或重复字段、空规则、非法方向及远程结果；真实 DQE、权限和 Relay 不在合成验收范围内。

分页外观对照：左表省略 `numbered`，右表保留历史 `numbered:false`，均显示数字页码1、2；点击2或输入跳页只改变当前表。选择每页20条后显示全部12条并隐藏页码，条数选择器仍可用。`/pages/table-row-number` 验证历史 `numbered:true`，其内嵌表格保持不分页、空结果保留条数选择器；`/pages/paged-join-on-demand` 验证查询分页同样显示数字页码与省略号。`numbered:false` 仅作兼容见证，移植到新页面时省略该字段。自动回归 `apps/playground/tests/table-pagination-unified.browser.ts` 消费这些完整页面，不替换交互配置。

## 表头候选搜索开关

入口 `/pages/table-header-filter-search`，运行 `pnpm dev:playground` 后访问，无需 URL 参数或数据服务。页面八张表均使用同一份内联合成数据：前六张分别展示静态枚举与动态候选的 showSearch:true、false 和省略；最后两张“静态枚举：不配置全选”和“动态候选：不配置全选”省略 showSelectAll，同时保留 showSearch:true，展示两个开关独立。Schema 6.112 新页面省略时隐藏搜索。参考对象是本项目既有表头候选面板，移植时保留列绑定与筛选作用范围，开关不能证明后端查询或权限能力。

1. 打开各表“状态”：true 显示“搜索选项”，false 和省略均隐藏；不出现“为空”按钮。
2. 在 true 表搜索“否”，候选缩小但总条数仍4；勾选“否”后总条数1；再搜索不存在的文本显示“没有候选项”，已提交筛选仍保留。
3. 清空关键词恢复候选与勾选，全选作用于完整匹配范围，总条数回4并包含空值。
4. 访问旧页面 `/pages/table-column-candidates`，不新增声明仍有原动态候选搜索；显式升级保留原文件并为动态列写入 showSearch:true，静态枚举不新增搜索。
5. 打开最后两张“不配置全选”表的“状态”：显示搜索框和单项复选框，没有“全选”；搜索“否”并勾选后总数1，清空搜索后仍没有全选，取消该项恢复4条（含空值）。其声明为 filterable:{mode:"select",showSearch:true}，未写 showSelectAll，而非显式 false。

浏览器验收直接读取本页及旧页，协议回归覆盖 true/false 的版本下限、错误类型、错误拼写、范围筛选拒绝、升级幂等和输入不变。全部为内联合成数据，不证明真实 DQE/Relay 支持。

# pages/capabilities/table

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 决策意见明细

入口：`/pages/decision-opinion-details`；[页面 JSON](decision-opinion-details.json)。运行 `pnpm dev:playground` 即可，无需 DQE Sim 或 URL 参数。

256 条合成统计记录，合同、商务各 128 条。复用 Dashboard 页头、正式表格、类型列表头筛选和查询分页；专用预览适配器读取两个独立分页模拟源，按全局顺序归并出当前页，不访问真实网络。

1. 初始每页 20 条，总数 256；前两行为商务 130 次、合同 120 次。合同 120 次对应占比 63.0%，由模拟后端直接给出，不按 90 ÷ 120 重算。
2. 点击“类型”列表头的漏斗，勾选“合同”或“商务”，总数为 128，全部行均属于所选类型；同时勾选两项或点击“清除筛选”恢复 256 条混排。支持搜索候选；候选搜索不改变表格数据，选择或清除筛选回到第一页。弹层按内容自适应，此处短选项宽160px，长候选最多撑至360px并换行，窄屏不超出视口。上方不再放置类型按钮组。相同姓名和两边重复局部 ID 仍分别保留。
3. 点击决策总次数、有效意见数、有效意见占比列头切换升降序，回到第一页；Shift 追加多列排序。占比降序前三行为 88.0%、87.5%、80.0%，空值升降序均在末尾。
4. 点击第 13 页，显示序号 241—256，共 16 行。页码跳转输入框也可以直接输入 13 并按 Enter。首次深页读取需要扫描有序前缀；本预览仅保留最多 8 份页结果缓存，不提供跨请求事务快照。
5. 打开 `/pages/decision-opinion-details?sourceFailure=contract`，模拟合同来源失败；整表为空，控制台输出查询诊断，不呈现商务半份结果。表头候选也通过实际来源加载，参与来源失败时如实失败；去掉该参数恢复。单一类型查询不会执行未参与的来源，该行为由回归测试覆盖。

JSON 使用现有 `query` 协议，默认排序来自查询 `order.by`；初始列头沿现有协议不额外显示默认方向，副标题说明默认顺序。这里没有新增通用 `pagedUnion` 或 `props.defaultSort` 协议；这些继续由[实施计划](../../../docs/plan/2026-10-23-paged-union-table.md)承接。页面 JSON 单独交给其他宿主不会自带此适配器。导出和搜索未开放，本地模拟与浏览器验证不证明真实 DQE 的排序、计数或生产接入能力。

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

1. 打开代表处筛选，加载更多取得64项；搜索办事处64并勾选。
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
- 容器1440px时宽1296px，1920px时宽1440px；390px时宽351px，极窄容器始终保留32px宽度余量。弹窗居中、抽屉贴右；表格在内部横向滚动，页面不溢出。普通字段弹窗沿用560px上限。
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
- `/pages/table-pinned-summary`：需要本地 DQE Sim。每页显示独立中国区汇总，无序号、总数只计地区；翻页及选择地区不改变汇总，切换产品或月份更新两源。汇总场景可选零行、多行、查询失败，后两项仍显示明细但不能完整导出Excel。示例没有真实授权能力，不能作为真实服务权限验收。

隔离端口启动示例：`DQE_SIM_PORT=18229 pnpm sim:dqe`；`DQE_SIM_PORT=18229 pnpm --filter playground exec vite dev --port 5180 --host 127.0.0.1`。浏览器回归：`PLAYGROUND_BASE_URL=http://127.0.0.1:5180 node apps/playground/tests/table-enhancements-browser.mjs`。

# pages/capabilities/table

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 表头候选完整查询与前端去重

入口：`/pages/table-column-candidates-query`；[页面 JSON](table-column-candidates-query.json)。运行 `pnpm dev:playground`，无需 URL 参数或真实 DQE。模拟数据位于 `apps/playground/fixtures/full-query-candidates.ts`，通过平台共用网关消费原生 DQE 合成响应。

1. 表格620条，每页20条。打开代表处筛选，首批显示50/80个去重选项；搜索“办事处80”仍能找到第620条记录中的值，它不在表格当前页或前三批200行中。
2. 选择办事处80后表格变为1条；清空候选搜索，再加载更多，仍有80个候选，当前列自身条件没有缩小候选范围。
3. 区域列选择华南，再打开代表处筛选，仅剩办事处61—80共20项；其他列的条件仍生效。数值列可设置收入区间，候选保持原查询指标与维度粒度。
4. 打开 `?state=truncated`；表格仍可显示普通分页。打开代表处筛选显示“候选项加载失败”和重试按钮，不展示被截断的候选集合。
5. 打开 `?state=blocked-candidates`，候选请求故意一直不返回。表格先显示20行，进入视口、完成绘制并空闲后才预加载。点击“下一页”仍能显示第21行；在途后台候选被取消，候选加载不会遮住表格。普通场景预加载后打开菜单复用候选页；未就绪时只在菜单中等待。隐藏或离开视口暂停预加载。

候选原始读取为200、200、200、200的请求窗口，实际响应分别200、200、200、20行；默认扫描上限1000，恰好1000条最多5批。`?state=over-limit` 使用1001条记录，候选首批发现超限后停止，菜单提示缩小筛选范围且不提供部分选项，表格仍可翻页；`?state=raised-limit` 对同一1001条记录显式注入 `columnCandidatesMaxRows: 1200`，候选可完整读取。保留全部 `output_dims` 和非空 `output_metrics`。候选搜索、排序、分页及去重计数在前端完成；未命中候选页缓存时重新完整读取。该场景不证明真实 DQE/Relay 已联调，取消、迟到响应、缺失/变化总数和业务 TopN由行为测试补充。

## 组合查询错误定位

入口：`/pages/paged-join-diagnostics`；[页面 JSON](paged-join-diagnostics.json)。启动 `pnpm dev:dqe`，或分别运行 `pnpm sim:dqe` 与 `pnpm dev:playground`，保持统计月份 2026-09。页面沿用普通 DQE Sim 的8个代表处合成数据，所有成员关闭远端选页能力，先完整读取目录成员，再按编码补列。

1. 正常打开：第一页3行，上海、北京、广州，匹配总数8；翻页、排序和搜索保持完整关联行为。
2. 故障回放：执行 `pnpm --filter playground exec playwright test tests/paged-join-diagnostics.browser.ts --workers=1`。测试直接读取本页，通过 HTTP 响应边界分别将目录首行关联键改为 null、令第二行键与首行相同、将总数改为9、将总数改为1001。测试注入合成身份与响应，无需真实服务；使用空闲的5183端口。
3. null 与重复键均跳过一行并显示可用7行；总数9/返回8行保留8行并提示可能缺项。表格上方可展开 warning 定位 office-directory，控制台打印 TABLE_RESULT_RECOVERED，不包含真实业务值。总数1001超过fallback预算时仍报 DQE_QUERY_REJECTED，保留完整来源定位。

浏览器用例覆盖正常和四种故障，并输出截图至Playwright报告目录。记录模式关联键与原有分页、取消、缓存行为由共享执行回归覆盖。本地Sim和HTTP回放不等于真实DQE/Relay验收。

## 决策意见明细

入口：`/pages/decision-opinion-details`；[页面 JSON](decision-opinion-details.json)。运行 `pnpm dev:playground` 即可，无需 DQE Sim 或 URL 参数。

256 条合成统计记录，合同、商务各 128 条。复用 Dashboard 页头、正式表格、类型列表头筛选和查询分页；专用预览适配器读取两个独立分页模拟源，按全局顺序归并出当前页，不访问真实网络。

1. 初始每页 20 条，总数 256；前两行为商务 130 次、合同 120 次。合同 120 次对应占比 63.0%，由模拟后端直接给出，不按 90 ÷ 120 重算。
2. 点击“类型”列表头的漏斗，勾选“合同”或“商务”，总数为 128，全部行均属于所选类型；同时勾选两项或点击“清除筛选”恢复 256 条混排。支持搜索候选；候选搜索不改变表格数据，选择或清除筛选回到第一页。弹层按内容自适应，此处短选项宽160px，长候选最多撑至360px并换行，窄屏不超出视口。上方不再放置类型按钮组。相同姓名和两边重复局部 ID 仍分别保留。
3. 点击决策总次数、有效意见数、有效意见占比列头切换升降序，回到第一页；指标 DQE 显式多字段排序会在发请求前明确失败。占比降序前三行为 88.0%、87.5%、80.0%，空值升降序均在末尾。
4. 点击第 13 页，显示序号 241—256，共 16 行。页码跳转输入框也可以直接输入 13 并按 Enter。首次深页读取需要扫描有序前缀；本预览仅保留最多 8 份页结果缓存，不提供跨请求事务快照。
5. 打开 `/pages/decision-opinion-details?sourceFailure=contract`，模拟合同来源失败；整表为空，控制台输出查询诊断，不呈现商务半份结果。表头候选也通过实际来源加载，参与来源失败时如实失败；去掉该参数恢复。单一类型查询不会执行未参与的来源，该行为由回归测试覆盖。

JSON 使用现有 `query` 协议，默认排序来自查询 `order_by_field/type`；初始列头沿现有协议不额外显示默认方向，副标题说明默认顺序。这里没有新增通用 `pagedUnion` 或 `props.defaultSort` 协议；这些继续由[实施计划](../../../docs/plan/2026-10-23-paged-union-table.md)承接。页面 JSON 单独交给其他宿主不会自带此适配器。导出和搜索未开放，本地模拟与浏览器验证不证明真实 DQE 的排序、计数或生产接入能力。

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

## 多来源字段映射与整体排序

入口：`/pages/multi-source-table`。从仓库启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5193`，访问 `http://127.0.0.1:5193/pages/multi-source-table`。同一页面也在组件目录的表格场景、数据功能目录的多来源有序合并中可发现；详情目标 `/pages/multi-source-contract-detail` 和 `/pages/multi-source-commercial-detail` 接收 `record-id`。

数据环境为本地合成普通分页接口，各 128 行；真实归并由产品 SourceProgram 执行，页面使用通用 `pagedUnion` 声明。成员的原始字段与最终列使用不同 ID，类型来自显式常量，商务的“可空说明”显式为 null。无真实 DQE 请求。

1. 打开页面：默认“决策总次数”降序，前 3 行依次为商务 130、合同 120、商务 100，总数 256，13 页；合同 001 的占比为 63%，保持上游值。
2. 点击“有效意见占比”：在两个来源全部记录上升序，再点降序；null 在两个方向均位于末尾。任意跳页后序号跨页连续；同值按来源与原始键稳定排序。
3. 搜索“审批人甲”：总数 3，商务 001、合同 001 和合同 003 都保留。打开类型表头筛选，可见合同、商务；选择合同后总数 2，清除恢复 3。清空搜索后恢复 256。
4. 打开审批人候选：候选从两个来源完整匹配域合并并去重；候选搜索与表格搜索独立。可空说明只有“合同专属说明”候选，不把 null 当作普通选项。
5. 点击导出：无筛选时得到 256 行的 Excel，带一行表头，排序保持当前提交视图；搜索或筛选后只导出全部匹配行。容量与异常沿用 10000 行/60 秒上限，不输出部分文件。
6. 点击合同、商务记录中的审批人，分别进入对应来源详情；URL 保留原始 `record-id`。浏览器后退可回到原页面。
7. 访问 `/pages/multi-source-table?sourceFailure=commercial`：任一参与来源失败，整表报错，不展示合同半份记录。非法投影、单位冲突、缺失行键和旧协议版本有产品契约反例；取消、总数变化重试、缓存检查点和大规模按需源由行为测试补充。
8. 访问 `/pages/multi-source-table?rowFailure=duplicate`：同一商务来源重复行键仅保留第一条，总数255；`?rowFailure=missing-key` 跳过空键记录，总数255；`?rowFailure=order` 有界完整整理后全局排序，总数256。均显示可展开来源 warning，Excel 附数据异常说明。清除参数恢复正常；跨200行批次重复及检查点由行为测试覆盖，合成故障不证明真实 DQE 分页稳定性。

验收记录：[paged-union](../../../docs/evidence/paged-union/acceptance.md)。模拟、真实浏览器、静态协议及真实 DQE 分层报告；本页不证明真实服务具有稳定排序、NULL 规则、搜索编码、准确计数或候选接口。

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

未选择且只展开华东、子表搜索上海时导出，Excel仍为两个工作表、父4行子17行。选华东为1/5行，选上海为1/1行。父搜索和表头条件限定父域，父页与子局部状态不限制完整范围；不展开也可导出。

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

- 默认混合故障：多来源合并保留6条可用记录（不规则行跳过、重复 key 留首条），记录关联保留8条审批记录（重复基本信息留首条）。缺字段和不可用对象值显示 —；两表均有可展开来源 warning。
- 合并表每页3条，第二页仍3条，总数6；搜索、筛选和排序作用于整理后的匹配范围。分别导出两表，数据工作表分别为6/8行，不受当前页影响，另有“数据异常说明”工作表。
- 访问 `?recoveryState=ready` 模拟数据准备好后刷新：两表恢复8条，warning 消失；正常导出不附说明表。
- 合成数据与故障注入在 `apps/playground/fixtures/table-recovery.ts`，基础种子在 `decision-opinion/model.ts` 与 `rejection-details/gateway.ts`。自动浏览器检查执行 `node apps/playground/tests/table-data-recovery-browser.mjs`，输出到 `docs/evidence/table-data-recovery/browser/`。

静态合法、模拟网关、实际浏览器和下载回读属于本地证据；真实 DQE/Relay、真实模型和线上部署不在本轮证据内。预算、权限、网络和取消仍明确失败；异常整理限制见[数据源说明](../../../docs/page-metadata/data-sources.md#table-result-recovery)。

## 记录关联单批超时

入口 `/pages/record-join-batch-timeout`，完整页面 `record-join-batch-timeout.json`，无需 URL 参数。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5203`。合成适配器位于 `apps/playground/fixtures/rejection-details/gateway.ts`，12条审批、每批2条，主表与补列请求每次延迟250ms，`records.timeoutMs: 1000`。整轮耗时超过1秒后仍应显示12条完整记录；搜索 `BIZ-00005` 应找到两条审批及当前责任人，翻页和搜索复用完整结果。

加 `?sourceTimeout=true` 将每次请求延迟改为1500ms，单批超过1000ms后出现错误态，无审批行；去掉参数可重新完整读取。字节仍整轮累计，已有字节拒绝回归保持。自动浏览器验收 `node apps/playground/tests/record-batch-timeout-browser.mjs <证据目录>`（`RECORD_TIMEOUT_BASE_URL` 可覆盖默认地址）。本场景仅证明合成适配器下的超时、完整性及缓存行为，不证明真实 DQE/Relay 性能。

## 组合查询按需分页

入口 `/pages/paged-join-on-demand`，页面 `paged-join-on-demand.json`，80个全新合成项目；入口 `/pages/record-join-on-demand`，页面 `record-join-on-demand.json`，1205条合成审批。启动 `pnpm dev:playground --host 127.0.0.1 --port 5183` 后打开对应路由；普通数据来自 `apps/playground/fixtures/query-join-gateway.ts`，记录数据来自 `apps/playground/fixtures/rejection-details/gateway.ts`，不调用真实DQE。

普通表首屏10行、总数80，空闲后不扫描完整候选；下一页从P000011开始。过滤“项目状态=已关闭”总数40，旧审批次数排序清除；再点击审批次数排序，总数回80，状态勾选清除。只有本页键参与补列。记录表首屏10条、总数1205，使用真实合成记录id；补列源选页与“为空”无法正确表达时显示原因，保留原页。点击菜单才加载候选，不影响主表翻页。

可观察来源：普通预览发布 `metriccanvas:synthetic-paged-join` 事件，含单源生效查询，验证limit/offset和键范围；每页默认10条、补列批次10条。截断、重复与范围外键由执行测试注入并验证失败后没有完整恢复。浏览器脚本 `apps/playground/tests/paged-join-query.browser.ts` 与页面使用同一声明。合成执行、Chrome交互、CI和真实DQE分别验收；真实分页/计数/空值能力未因此获得证明。

## 父行展开缓存

`/pages/table-row-expansion-cache`（`table-row-expansion-cache.json`）：启动 `pnpm dev:playground` 后直接打开，无参数、无需外部DQE，使用专属内存仿真Gateway。

1. 展开北辰科技，子表翻到第2页后收起并重开：仍为C01-011起始的第2页，不新增查询。
2. 同时展开远山制造：从C02-001开始，数据和页码独立。
3. 收起后切换父表页码，再返回重开：缓存已失效，重新请求第一页。整页刷新也会清空缓存。
4. 请求数、隔离和刷新由 `apps/playground/tests/row-expansion-cache-browser.mjs` 验证；条件/参数/上下文变化、错误/空结果、取消迟到响应和20实例上限由运行时回归覆盖。

此为本地仿真与浏览器证据，不代表真实DQE或生产权限联调。用户页面无需新增缓存字段。

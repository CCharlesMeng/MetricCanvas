# pages/capabilities/table

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 组合查询错误定位

入口：`/pages/paged-join-diagnostics`；[页面 JSON](paged-join-diagnostics.json)。启动 `pnpm dev:dqe`，或分别运行 `pnpm sim:dqe` 与 `pnpm dev:playground`，保持统计月份 2026-09。页面沿用普通 DQE Sim 的8个代表处合成数据，所有成员关闭远端选页能力，先完整读取目录成员，再按编码补列。

1. 正常打开：第一页3行，上海、北京、广州，匹配总数8；翻页、排序和搜索保持完整关联行为。
2. 故障回放：执行 `pnpm --filter playground exec playwright test tests/paged-join-diagnostics.browser.ts --workers=1`。测试直接读取本页，通过 HTTP 响应边界分别将目录首行关联键改为 null、令第二行键与首行相同、将总数改为9、将总数改为1001。测试注入合成身份与响应，无需真实服务；使用空闲的5183端口。
3. 四种异常均显示表格空态，控制台首行先解释原因和处理方法（空键示例：“第1行的代表处编码为空，无法关联其他数据，请检查查询结果”），技术来源在后面的“定位详情”中打印 `office-overview` → 成员 `directory` → 数据源 `office-directory` → 字段 `rep-office-code`（DQE `rep_office_code`），并给出 `/dataSources/office-overview/source/members/directory/key`。空键报第1行及实际null；重复键报第2行与第1行重复；截断报返回8行/总数9；超限报总数1001/上限1000。主成员失败后没有补列查询，错误消息不包含代表处名称或编码值。

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
8. 访问 `/pages/multi-source-table?rowFailure=duplicate`：合成商务响应第二行复用第一行行键，整表报错；页面显示整表失败，控制台首段说明“审批统计明细”中第1、2条记录的“来源内编码”相同、该字段用于区分记录及修改建议；后续技术定位指出 `opinions` → `commercial`、`commercial-localRowId` / `commercial_local_row_id`、配置路径及来源第 1、2 行和 `offset=0`。`?rowFailure=missing-key` 定位第二行缺失行键；`?rowFailure=order` 定位相邻来源行排序错误。行号从 1 开始，offset 从 0 开始；不回显实际行键或业务行。清除参数恢复正常表格。跨200行批次重复及检查点由行为测试覆盖；这些合成故障不证明真实 DQE 分页稳定性。

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

入口 `/pages/record-join-no-row-limit`，使用完整页面 `record-join-no-row-limit.json`。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5202`；无需URL参数或真实DQE。现有合成Adapter提供100001条审批记录，页面不声明 `records.maxRows`，保留128 MiB和60秒限制。默认9月完整读取后显示100001条；搜索 `BIZ-50000` 能找到末尾的一条审批及当前责任人，证明全局查询未截在十万条。清空搜索、排序和翻页复用完整关联结果；8月为0条。添加 `?sourceFailure=true` 模拟上游失败，不能显示部分成功。完整导出仍有独立10000行限制。

`business-rejection-details.json` 与 `record-join-demo.json` 也省略行数预算，保留各自字节和超时配置。旧页面显式 `maxRows` 继续执行；把它移除需同版6.69运行时和校验器。自动回归覆盖跨十万行关联及末尾搜索、显式行数拒绝、字节拒绝、超时、取消、截断及计数变化。本场景使用合成数据，不证明真实内网性能和最终业务查询成功。


## 层级筛选联动父子表格

入口：`/pages/table-hierarchy-selection`。正式6.70 Dashboard，合成 DQE HTTP 数据；代表处明细没有 parent，归属使用独立查询。启动 `pnpm dev:dqe`（默认 Sim 18228、Playground 5173）；独立工作树可分别使用 `DQE_SIM_PORT=18229 pnpm sim:dqe` 与 `DQE_SIM_PORT=18229 pnpm --filter playground dev --port 5210`。

地区范围只有一个单选树形下拉，外面没有地区部／代表处按钮或返回按钮。候选基于同一合成夹具的显式归属关系建树；展开箭头只展开节点，不改变筛选。首屏地区部4行，父表每页2行，不查归属及子表。在树内选华东仅保留整体1200，手动展开5个代表处；再次打开同一下拉并展开华东，直接选上海，先定位 O101→R01，再自动展开华东，整体1200、上海360。年度2025为960/288；共同条件保留展开或手动收起，子页回1，父页保持。改选地区或清空恢复默认；搜索节点、取消弹层不提交草稿，URL保留原始O101与office层级。

未选择且只展开华东、子表搜索上海时导出，Excel仍为两个工作表、父4行子17行。选华东为1/5行，选上海为1/1行。父搜索和表头条件限定父域，父页与子局部状态不限制完整范围；不展开也可导出。

异常候选含“定位无结果”“归属不唯一”“定位失败”，均显示诊断，不展示全量、不发目标子查询。URL初值：`?region=O101&region.level=office&year=2026&product=all`。合成搜索编码仅支持示例代表处名称；实际服务需提供候选与归属查询，真实 DQE/Relay/权限未由此场景证明。正式证据在 `docs/evidence/hierarchical-row-expansion/result.md`。

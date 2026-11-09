# pages/capabilities/filters

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 按钮显隐与查询生效条件

入口 `/pages/filter-binding-when`；启动 `pnpm dev:playground`，使用页面专属本地合成 Adapter，无需 DQE 服务。

1. 全球层级默认“中国区”，图表和表格显示北京；切换“海外”后显示巴黎。
2. 在区域树选择海外地区部或巴黎代表处，按钮隐藏。即便此前选的是“中国区”，仍显示巴黎，查询只使用具体区域。
3. 选择全球节点返回 geo 层级，按钮恢复之前选择。刷新 URL 亦恢复筛选与层级。表格下载沿用当前范围。
4. 用 `?state=empty`、`?state=error` 分别观察空结果与合成查询失败；控制器不因空态或错误被删除。

示例复用维度绑定 `when` 和组件 `visibleWhen` 的同一筛选条件。全局选择保留在状态和 URL 中；查询是否应用该谓词只由绑定条件决定。本地数据不代表真实 DQE 或权限接入。

## 完整经营分析月报（合成演示）

入口 `/pages/report-monthly-complete`；[页面 JSON](report-monthly-complete.json)。启动 `pnpm dev:playground`，无需 URL 参数或 DQE 服务。此页专门验收 Report 时间工具带、完整内容联动与 PDF 下载，显式使用 `layout: "report"`。

1. 默认 2026-10：营业收入 1,186 万元、订单 4,380 单、毛利率 22.1%、目标完成率 95.6%；同时展示近六个月收入趋势、区域收入分布和四行区域明细。
2. 将“报告月份”改成 2026-09：标题、四个指标、两张图和区域表同步更新；收入为 1,144.6 万元，订单为 4,272 单。刷新页面保留月份。
3. 在 1440、1024 和 390px 下观察布局，页面无横向溢出；明细表在自身范围滚动。
4. 点击“下载 PDF”：直接下载以当前月份标题命名的 PDF，内容对应当前已应用月份。

三个查询页面数据源由专属本地合成数据网关响应，按月份确定性派生数据，不访问外部 DQE。浏览器验收复用上述完整页面；此场景不证明真实 DQE、Relay 或业务口径接入。

## Report 时间选择、查询与标题联动

入口：`/pages/report-date-filter-example`；[页面 JSON](report-date-filter-example.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

提交单月或范围后同步期间文字；范围查询独立联动，非法未来时间保持已应用状态。

合成演示

文字联动可直接体验；范围查询需仿真

1. 在第一节提交报告月份，观察主标题和期间文字；清除后显示全部期间。
2. 在范围查询一节修改期间，观察明细；在最后一节尝试未来日期或早于下限的值。

三节控件相互独立；文字联动不等于该筛选已绑定所有查询。

关键声明：`filters`, `params`, `dataSources.*.source.query.filterBindings`, `sections[].components[].props.filterIds`。

关联：[dashboard-period-filter](dashboard-period-filter.json)。

关联：[business-sdt-report-monthly](../../business/report/sdt/business-sdt-report-monthly.json)。

## 统一页头 · 仅选年份

入口：`/pages/dashboard-period-filter`；[页面 JSON](dashboard-period-filter.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

统一页头仅选年份，绑定查询使用完整自然年，未绑定对照表保持不变。

合成演示

交互取数需本地仿真

1. 启动本地 DQE Sim 或注入合成验收网关，打开年份框选择历史年份。
2. 观察经营明细使用完整自然年，未绑定查询保持不变；尝试 URL 恢复和未来年份。

只显示一个年份框；完整年季月切换保留于契约夹具，页面不重复放两套时间条件。

关键声明：`iocHeader`, `filters`, `dataSources.*.source.query.filterBindings`。

关联：[report-date-filter-example](report-date-filter-example.json)。

关联：[chart-local-filter-page](../chart/chart-local-filter-page.json)。

## 图表筛选：左侧按钮与右侧下拉

入口：`/pages/filter-group-page`；[页面 JSON](filter-group-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

同一张图表卡左上切换营业收入/订单量，右上按区域筛选；图表与合计共同刷新。

合成演示

交互取数需本地仿真

1. 左上切换营业收入/订单量，观察图表、单位和合计更新。
2. 右上选择华东/华南，图表与合计只显示所选区域。
3. 刷新页面确认两项选择从 URL 恢复；窄屏控件可换行。



关键声明：`filters`, `sections[].components[].props.components[].props.display`, `sections[].components[].props.components[].props.align`, `dataSources.*.source.query.filterBindings`。

关联：[filter-group-state-page](filter-group-state-page.json)。

关联：[chart-local-filter-page](../chart/chart-local-filter-page.json)。

## 左侧按钮组与右侧双下拉

入口：`/pages/filter-group-parallel-selects`；[页面 JSON](filter-group-parallel-selects.json)。目录：数据与联动 → 条件驱动查询 → 局部筛选与查询订阅 → 左侧按钮组与右侧双下拉（合成演示）。

启动：`pnpm dev:dqe`，或 `pnpm dev:playground` 与 `pnpm sim:dqe`。夹具更新后需重启本地 DQE Sim。

合成演示

交互取数需本地仿真

组合卡显式 `filterLayout:"toolbar"`，左侧营业收入/订单量按钮组，右侧区域和渠道两个下拉；右组按 12px 间距紧凑排列并贴齐卡内容右边界。三个条件共同绑定趋势和合计查询。

1. 默认营业收入、全部区域、全部渠道，合计 1,710 万元。宽屏按钮靠左，两个下拉整体靠右，随卡宽变化仍保持组内间距。
2. 区域选华东，合计 951 万元；渠道选直营，合计 571 万元；左侧切订单量，保留华东和直营，合计 1,857 笔。
3. 刷新恢复全部三项条件；独立页 `?metric=orders&region=east&channel=direct` 显示 1,857。非法或重复值回退各自默认项。
4. 窄屏右组先整体换行并继续居右，不把按钮和两个下拉挤成三等份；组内放不下时可再次换行。Escape 关闭弹层后返回触发框。

关键声明：`sections[].components[].props.filterLayout`, `filterGroup.props.align`, `filters`, `dataSources.*.source.query.filterBindings`。

关联：[filter-group-page](filter-group-page.json)。

渠道为独立合成数据集，直营约占 60%，合作伙伴为剩余部分；按每月取整后汇总，保持每月与总计闭合。`all` 是显式汇总成员。页面校验、浏览器与本地 Sim 不代表真实 DQE、Relay 或生产接入验收。

## 独立筛选：指标卡、一控多与条件显隐

入口：`/pages/filter-group-state-page`；[页面 JSON](filter-group-state-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

固定按钮组控制多个查询和带符号指标卡；页头条件控制筛选组件与内容各自显隐。

合成演示

交互取数需本地仿真

1. 切换直营/加盟，观察两张带符号指标卡和趋势同步更新，对照图不变。
2. 业务范围切到海外，按钮组与趋势隐藏，指标卡保留已选口径；切回国内恢复原选择。
3. 切换组合卡内区域，确认只改变卡内指标。



关键声明：`filters`, `sections[].components[].visibleWhen`, `sections[].components[].props.filterId`, `dataSources.*.source.query.filterBindings`。

关联：[chart-local-filter-page](../chart/chart-local-filter-page.json)。

关联：[page-visibility-region-linkage](page-visibility-region-linkage.json)。

## 统一条件显隐与地区层级联动

入口：`/pages/page-visibility-region-linkage`；[页面 JSON](page-visibility-region-linkage.json)。

启动：`pnpm dev:playground`。

层级空选、分区与子项条件、父容器保留、Tab回退、行投影、按钮和文字片段。内联演示数据。

内联演示数据

无需 DQE；只验证本地条件规则与呈现

1. 切换地区部，观察地区部行权规范分区隐藏、父容器保留，Tab及表格行同步变化。
2. 切回全球，点击显示扩展内容和恢复基础内容，刷新后检查 URL 层级恢复。

本地演示不代表真实 CloudIOC、Java、DQE 或 Relay 接入验收。

关键声明：`filters`, `sections[].visibleWhen`, `sections[].components[].props`。

关联：[page-visibility-inputs](page-visibility-inputs.json)。

关联：[page-visibility-report](page-visibility-report.json)。

## 已有权限与业务事实显隐

入口：`/pages/page-visibility-inputs`；[页面 JSON](page-visibility-inputs.json)。

启动：`pnpm dev:playground`。

已有权限与业务事实的就绪、拒绝及错误输入；本地Sim事实验收。

内联演示数据；权限与事实使用本地 Sim

无需 DQE；只验证本地条件规则与呈现

1. 使用页面外的 Sim 事实控制切换允许、拒绝、等待与错误，观察内容变化。
2. 更换权限会话后旧实例停用；重新初始化后按当前权限显示。

本地演示不代表真实 CloudIOC、Java、DQE 或 Relay 接入验收。

关键声明：`sections[].visibleWhen`。

关联：[page-visibility-region-linkage](page-visibility-region-linkage.json)。

关联：[page-visibility-report](page-visibility-report.json)。

## 条件显隐报告与导出

入口：`/pages/page-visibility-report`；[页面 JSON](page-visibility-report.json)。

启动：`pnpm dev:playground`。

报告导出使用相同条件：整块隐藏、父容器保留、全部允许Tab展开、行投影与PDF/PNG/XLSX。

内联演示数据

无需 DQE；只验证本地条件规则与呈现

1. 切换地区部后下载 PDF、PNG 和表格 XLSX。
2. 核对地区部分区缺席、允许的空父容器保留、Tab 展开及两行代表处记录。

本地演示不代表真实 CloudIOC、Java、DQE 或 Relay 接入验收。

关键声明：`filters`, `sections[].visibleWhen`, `sections[].components[].props`。

关联：[page-visibility-region-linkage](page-visibility-region-linkage.json)。

关联：[page-visibility-inputs](page-visibility-inputs.json)。

## 筛选选择跨表查询 · 签约与商机

入口：`/pages/query-mode-chart-demo`；[页面 JSON](query-mode-chart-demo.json)。

启动：`pnpm dev:dqe`（已有服务时直接打开页面）。隔离工作区演示使用 `DQE_SIM_PORT=18231 pnpm sim:dqe` 与 `DQE_SIM_PORT=18231 pnpm --filter playground dev --host 127.0.0.1 --port 5174 --strictPort`。

数据环境：本地 DQE 仿真，`query-modes.json` 中 `sales_contracts` 和 `sales_opportunities` 只是两组独立 JSON 固定数据，不是真实数据库表。Sim 按普通指标名选择样例数据，保留原始响应键 `签约金额` / `商机金额`；页面各 case 的 `fieldMappings` 将其映射为图表字段 `amount`，不向 DQE 发送别名。名称、区域、月份粒度、人民币单位和无维度求和只是样例约定；真实指标、表路由、聚合、权限及无分页结果完整性均未验真。

1. 默认“签约金额 / 华东”：一至六月为110,000、120,000、130,000、140,000、150,000、160,000元，合计810,000元。
2. 选择“商机金额”：同一张折线图更新为330,000至480,000元，合计2,430,000元；明细同步变化。
3. 选择“华南”：商机金额变为240,000至390,000元，合计1,890,000元；切回签约金额保留华南，合计630,000元。
4. 刷新保留URL业务与区域选择。非法URL值 `?business=unknown` 恢复默认签约；合法值 `?business=opportunities&region=south` 直接请求商机华南。
5. 在浏览器 Network 的 DQE 请求中核对指标名由签约金额变为商机金额，区域谓词字段由签约区域变为商机区域。两个数据源分别请求趋势与合计；Chart和明细共用趋势结果，没有第三条明细请求。

同一 Chart 的组件 id、`data.main`、字段绑定不变。页面可在目录的“筛选”主题中发现。缺少 case、映射缺失/越界、普通指标伪别名、旧版本、未知选择、多值及旧捕获查询由契约夹具与执行测试覆盖，迟到/失败由运行时测试覆盖。

证据范围：本地页面协议、HTTP仿真、浏览器请求及呈现；不代表真实数据库、DQE、Relay或业务口径验收。

## 查询独立期间策略与时间列显隐

入口：`/pages/period-query-columns-demo`；[页面 JSON](period-query-columns-demo.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`。页面使用静态合成得分和 DQE Sim 合成 Tokens 数据；年/季/月得分是独立示例值，不由月度数据聚合生成。

1. 默认月模式仅显示月度得分及其分组表头，两个查询分别发送 day 和 month。
2. 切“年”“季”“近一年”，观察对应得分列替换，其他分组表头消失；同一选择仍由日/月查询独立解析。近一年排除当前月，URL 保存模式，重开 URL 后保持列集合。
3. 在月度列排序后切年，再切回月，原用户排序不复活；导出 XLSX 只含当前模式可见列。
4. 查询体保留 is_aggregate，不写 period/start/end；协议测试覆盖固定年扩大范围、按选择的能力拒绝、未应用选择、非法混写与旧声明兼容。工作台验收入口 `apps/platform/tests/browser/report-date-editor.html?dashboard`，逐查询主动迁移、选择固定策略或按选择策略，预览实际请求期间。

自动浏览器入口：`node apps/playground/tests/period-query-policy-browser.mjs <证据目录>`，默认页面试验场端口 5198、编辑器端口 5199，支持 PERIOD_POLICY_BASE_URL / PERIOD_EDITOR_BASE_URL。真实 DQE/Relay 未验收；季度支持 quarter 与 YYYY-Qn 编码，原示例仍显式固定日/月覆盖整季。


## 重点国代筛选集成

入口：[重点国代联动](./key-office-filter-demo.json) `/pages/key-office-filter-demo`；[目标页](./key-office-filter-target.json) `/pages/key-office-filter-target`。Region 必须为单个可搜索的单选组织树，不存在第二个地区部或代表处下拉。两页均为 Dashboard，查询和候选完全使用 `apps/playground/fixtures/key-office-filter/gateway.ts` 的合成数据：A1 重点 10、A2 普通 20、B1 重点 30、B2 普通 40。

启动 `pnpm dev:playground -- --host 127.0.0.1 --port 5183 --strictPort`，按实际启动日志确认端口。无需选择 Region 即可勾选。选择地区 A 时显示 A1/A2，勾选后跨地区显示 A1/B1，取消后恢复 A1/A2。选择普通代表处 A2 再勾选，Region 仍保留 A2，完整组织候选不收窄；取消后恢复 A2。勾选期间改选地区 B，仍显示 A1/B1，取消后显示 B1/B2。导出 XLSX 使用相同范围。两页均省略 overridesFilters，验证引擎默认覆盖。

选择地区 A、月份 2026-09、勾选重点国代，点击“切换页面”：目标页回填三项共享值，重新验证候选后显示 A1/B1；返回时继续继承。显式 URL `?key-office=false` 优先于宿主保存的 true；取消勾选、清空地区也写回共享值。清空 Region 后重点国代仍可操作，已勾选时继续显示 A1/B1。Playground 的两页共用局部宿主示例实例；刷新视为新会话。嵌入浏览器夹具则以 sessionStorage 模拟跨整页导航的宿主会话。

可复用宿主示例是 `packages/embed/examples/shared-filter-bridge.ts`，两个挂载入口使用相同实例。只将 projectNavigationInputs 投影出的公共筛选声明传给它。MC 每页持有独立候选与查询状态；本示例不接入真实 HeaderOptionService，不证明真实 DQE 或门户部署。

## IOC Region 参数名表示层级

页面：`/pages/ioc-region-url-demo`，文件 `ioc-region-url-demo.json`。IOC Header 默认启用组织 URL 参数，页面不包含 URL 映射字段，旧 IOC 页面也无需增加配置。先运行 `pnpm dev:playground`；该场景由 Playground 注入完整的合成组织树及合成查询 Adapter，无需真实 DQE 服务。

- `/pages/ioc-region-url-demo?region-dept=中国地区部`：树内选中中国地区部，表格显示上海、北京两条记录。
- `/pages/ioc-region-url-demo?rep-office=上海代表处`：树内选中上海代表处，表格只有上海一条。
- `/pages/ioc-region-url-demo?region-dept=中国地区部&rep-office=上海代表处`：取第二项代表处；反过来 `?rep-office=上海代表处&region-dept=中国地区部` 取地区部。
- `?rep-office=北京代表处&rep-office=上海代表处`：重复键也取最后值。
- `?region=上海代表处&region.level=office`：旧格式继续选中上海；交互选择后回写新键，并删除旧键。
- `?region-dept=中国地区部&rep-office=`：严格 URL 模式显示输入错误，不向业务查询静默回退。
- `?rep-office=未授权代表处`：不在完整候选内，查询和导出受门禁阻断。

在同一棵树中改选欧洲地区部，URL 只保留 `region-dept=欧洲地区部`，表格显示法国代表处；改选上海代表处则只保留 `rep-office=上海代表处`。无关 URL 参数应继续保留。无输入使用声明的中国地区部默认值。本地合成行为不证明真实组织接口、DQE/Relay、权限或部署验收。

### 重点国代优先（6.84，中文筛选值）

入口：`/pages/key-office-priority-demo`、`/pages/key-office-priority-target`。运行 `pnpm dev:playground`，两页自动加载 `createKeyOfficePriorityGateway` 合成候选及查询，无需真实 DQE。完整声明分别为同目录两个 JSON。

1. 打开 `/pages/key-office-priority-demo?rep-office=南京代表处`，只显示南京。
2. 勾选“仅看重点国代”，显示上海、深圳两个跨地区重点代表处，Region 仍显示南京；XLSX 导出使用相同范围。
3. 勾选期间选择华东地区部仍显示两个地区的重点代表处；取消后恢复华东的上海、南京。
4. 客户类型候选值为战略/卓越，对应业务查询字段为 `客户级别`；它与时间等条件不被覆盖。
5. 切换页面、刷新保留已勾选及原 Region；URL 中中文值与候选 value 一致。不选 Region 也允许勾选。

两组重点国代场景均省略 `overridesFilters`，由引擎默认覆盖 Region，不把 Region 的候选依赖到重点国代。普通布尔筛选的候选依赖和显式覆盖仍由独立行为测试验证。所有组织、金额及 `重点国代=true` 字段均是合成输入；浏览器通过不证明生产重点名单、授权或 DQE 字段已接通。

异常入口：`/pages/key-office-priority-demo?state=empty&key-office=true` 返回完整空名单，表格显示暂无数据；取消勾选后恢复四条普通数据。`?state=denied&key-office=true` 显示名单未就绪的加载错误，不进入全量查询。名单桥接与中文组织候选的真实服务接线由集成应用实现；完整说明在仓库 `docs/evidence/2026-11-04-ioc-header-filters/integration.md`。

全球验收：`/pages/key-office-priority-demo?region.level=geo&region=全球&mtime=2026-04&customer-category=战略` 显示上海、广州，完整 XLSX 同范围；勾选重点后仅上海，取消恢复两行。合成 Adapter 将上游 `WORLD/全球` 节点归一为中文 value，查询不携带全球编码、地区部或代表处条件。仅全球节点不限，中国/海外等节点仍过滤；普通组织树规则不变。原生 HTTP 验收 `/pages/ioc-opportunity-list?region.level=geo&region=全球&mtime=2026-04` 首屏5行，保留月份谓词；原页未配置导出按钮，浏览器探针临时启用现有表格导出后验证完整10行。仅为本地合成服务证明。


## 季度查询编码

入口：`/pages/quarter-query-period`；[页面 JSON](quarter-query-period.json)。启动 `pnpm dev:playground`。

默认选择 2026-Q3，IOC Header 认领的时间绑定仅声明 `target:"time"`，没有 periodPolicy，旧查询体保留 month 用于验证引擎默认覆盖。首次请求发送 `filter.time:{period:"quarter",start:"2026-Q3",end:"2026-Q3",is_aggregate:true}`；切换月、年时分别发送 month、year，近一年发送 month 和此前十二个完整月范围，聚合开关保留。显式 fixed/selection、期间比较、字段时间绑定的优先级由自动测试覆盖；月度趋势例外见 `ioc-header-demo` 的 trend 查询。Q0/Q5、日/月格式混入季度和倒置范围继续在发送前拒绝。

自动验收：`node apps/playground/tests/quarter-query-browser.mjs <证据目录>`，环境变量 `QUARTER_QUERY_BASE_URL` 指向页面试验场（默认端口 5208）。浏览器测试按页面 JSON 驱动控件，以合成 HTTP 回执验证实际请求编码和表格渲染；未调用真实 DQE/Relay，页面脱离测试运行时需要可用的数据网关。
## 旧工具栏期间默认规则

入口：`/pages/period-query-defaults-legacy`；[页面 JSON](period-query-defaults-legacy.json)。此能力回归场景刻意保留旧 `dashboardToolbar`，不迁移页头，Schema 6.95 没有新增字段。

启动 `pnpm dev:playground` 并接入可用数据网关。默认 2026-Q3，同一选择驱动三条真实 DQE 请求：普通时间绑定发送 quarter/2026-Q3；显式 fixed month 发送 month/2026-07～2026-09；自定义账期字段发送 >=20260701、<=20260930，不增加指标时间条件。切换年、月、近一年后三者继续遵守各自规则，月趋势不会被季度默认覆盖。

自动验收：先用 `DQE_SIM_PORT=18348 pnpm --filter playground dev --host 127.0.0.1 --port 5218 --strictPort` 启动页面试验场，再运行 `node apps/playground/tests/period-query-defaults.browser.mjs <证据目录>`。测试自行启动 18348 的合成 HTTP 服务，`PERIOD_QUERY_BASE_URL` 可改页面试验场地址，`PERIOD_QUERY_BACKEND_PORT` 应与代理端口一致。原生 HTTP 验证传参、表格和服务不支持时不回退，原有错误事件由集成应用处理；不证明真实 DQE 指标口径。非期间日期范围、时间点窗口、期间比较和对象查询由定向回归验证。月趋势例外沿用现有 periodPolicy，未声明策略的旧 period 不再承担固定粒度含义。

## 数据源候选与静态组织树

入口：`/pages/filter-source-candidates`；[页面 JSON](filter-source-candidates.json)。

启动：`pnpm dev:playground`，不需要 DQE Sim。使用本地合成查询 Adapter。

1. 组织下拉为 JSON 中的 inline 页面数据源。选“北区”，URL 仅包含 `organization=north`，图表显示北区自身的 100，不加入上海或北京。再选“上海”后同时保留两个节点。
2. 渠道来源为查询页面数据源，以每页 2 行读取全部 5 行，去重后显示“直营、伙伴、线上”三项。选“线上”后金额变为原来的 3 倍；重新打开仍能选择其他渠道。
3. 刷新 URL 恢复组织与渠道选择；窄屏两个控件回流，仍靠右且可操作。
4. `?state=error` 显示候选失败及重试；`?state=incomplete` 在后续页总数变化时失败，不展示先取得的部分渠道；`?state=empty` 显示无候选项。

正式字段为 `filters[].candidates.{dataSource,valueField,labelField,parentField}`；filterGroup 只引用 filterId 且省略旧 options。父子节点独立选择，显示名不进入查询值。静态导出冻结显示名与值，浏览期间再切换不改变已捕获导出。

证据仅覆盖产品协议、合成分页 Adapter 与浏览器；真实 DQE、Relay、组织权限服务和生产部署不在本页验收范围。

## IOC 客户类型固定查询字段

入口 `/pages/ioc-customer-query-field?customer-category=战略`，完整页面 `ioc-customer-query-field.json` 使用首分区首个 `iocHeader` 组件，复用重点国代合成网关。启动 `pnpm dev:playground` 后直接打开。此回归页故意把客户类型绑定写成旧名 `客户类型`；组件查询规则仍固定传 `客户级别`，表格应显示上海、广州两行，XLSX 完整导出相同。改选卓越显示南京、深圳，清空选择恢复四行；勾选重点国代继续与客户条件共同生效。未认领的普通筛选沿用页面显式字段，不能按显示文案推断客户语义。

客户类型约定标识为 `customer-category`、`customer-type`、`na-type`；规则仅作用于页头认领且已绑定的平面维度筛选，不自动订阅数据源。该页为合成数据，仅证明统一运行时和查询投影，不证明真实 DQE、权限或部署。

## 定稿日期默认期间

入口：`/pages/finalization-default-time` 与 `/pages/finalization-default-time-detail`。启动 `pnpm dev:playground` 后直接访问；使用确定性合成网关，不需要 DQE Sim。

页面主时间筛选声明 `default:{mode:"month",finalizationName:"经营数据"}`。合成截止日期为2026-10-18，首次选择10月；明细显示实际查询期间和“定稿查询1次”。修改月份、切换年季或近一年后计数仍为1。近一年包含当前时间上下文所在月，并查询十二个完整月份。点击“查看同期间下钻页”后目标页保留已应用模式及起止；直接打开目标页使用自身定稿默认值。页头使用首section首组件iocHeader。

`?state=error` 模拟请求失败，missing无记录、invalid非法日期、conflict同名不同日期、timeout超时；各入口均回退执行环境当前日期所在月。URL明确传入例如 `?period-filter=month%3A2026-08` 时，定稿查询仍执行一次，再由既有导航流程应用8月。

浏览器自动验收：`pnpm --filter playground exec playwright test tests/finalization-default.browser.ts`。场景仅证明协议与引擎，不证明真实截止表、DQE、Relay或生产权限接入。

# MetricCanvas 页面元数据规范

页面元数据是统一运行时消费的声明式JSON文档。当前作者协议为 **6.41**，读取支持5.0—5.4、6.5、6.11、6.12、6.13、6.14、6.15、6.16、6.17、6.18、6.19、6.20、6.21、6.22、6.23、6.24、6.25、6.26、6.27、6.28、6.29、6.30、6.31、6.32、6.33、6.34、6.36、6.37、6.38、6.39、6.40和6.41；各能力的版本下限独立校验。结构事实由 `packages/page/src/schema/` 单向导出，当前版本与可读范围由 `versionPolicy` 和 `supportedVersions()` 定义；未声明属性不被接受。

高级图表呈现扩展自 6.32 起通过隐含 `props.echartsOption` 声明，仅用于明确的 ECharts 定制需求；见[高级扩展](docs/page-metadata/chart-option.md)。

6.41 将通用 DashboardToolbar 的呈现能力并入 IocHeader，只保留一个页头实现。新页面使用 `iocHeader`，旧 `dashboardToolbar` 只作兼容读取；布局、更多筛选、只读和说明见[唯一页头](docs/page-metadata/page.md#唯一页头641)。仅选年份使用共享 `periodModes:["year"]`，见[现有期间页面](pages/dashboard-period-filter.json)。

## 从需求到页面

创作先取得受治理的数据上下文，确定性工具按页面构建规格装配完整页面，经过校验后交统一运行时。数据上下文、会话、执行身份与修订信息不写进页面文档。页面协议可表达、Authoring工具已支持、外部服务已接通分别举证。

新建页面先明确布局形态（Dashboard／Report）并显式声明 `layout`；外框含义与默认值见[页面与布局](docs/page-metadata/page.md#创作时显式选择布局形态)。本地创作 Skill 在生成前完成用户确认并按形态读取成型页面范式；这不新增资产类别或协议字段。

页面拥有命名数据源、筛选器和内容分区；组件的数据槽引用数据源，字段绑定引用结果字段契约。queryField属于查询字段空间，页面字段id和筛选器dimension不能靠同名隐式绑定。数据快照是运行状态，不是作者文档。

查询失败时，页面 UI 组件呈现空数据，具体错误打印到控制台，内部错误态及 `data-error` 事件保留。普通查询的 `totalCount` 与返回行数不一致仅告警，继续渲染已有行；详见[查询异常与结果总数](docs/page-metadata/data-sources.md#查询异常与结果总数)。

页面搭建的拖动手柄、蓝色选框、就地操作条与删除属于创作期交互，不新增页面协议字段。组件顺序与宽度仍由 `sections[].components`、`layout.span` 声明；空分区草稿与删除行为见[内容分区与布局](docs/page-metadata/sections-and-layout.md#页面搭建中的移动与删除)，验收页面为 `pages/platform-canvas-experience.json`。

## 文档结构与维护分工

本文件维护页面协议概览、版本边界与阅读导航。使用步骤与跨字段示例由专题文档维护，字段语义由模块维护，精确结构表从Schema生成；同一规则在所属文档维护后由其他入口引用。

| 文档层次 | 职责与入口 |
|---|---|
| 协议总览 | 本文件：页面组成、能力边界、版本与专题导航 |
| 参数与筛选专题 | [PAGE-PARAMETERS.md](PAGE-PARAMETERS.md)：维度与时间输入、初始化、页内筛选、期间文字、时间窗口和兼容用法 |
| 查询依赖专题 | [级联查询](docs/cascading-queries.md)：结果绑定、请求顺序、明细完整性、计算与完整示例 |
| 集成应用接入专题 | [报告导出与PDF下载](docs/report-export.md)：内置下载、后台编码、运行环境及失败处理 |
| 模块语义源与生成参考 | `docs/page-metadata/`维护作者语义；[模块参考](contracts/metriccanvas/page/reference/README.md)提供Schema生成的字段表、分支、合法示例和反例，同时分发到Authoring Bundle与Skill |

[机器索引](contracts/metriccanvas/page/reference/index.json)记录Schema位置、模块与示例覆盖；[完整Schema](contracts/metriccanvas/page/reference/schema.json)与参考正文同时生成。修改模块语义或示例索引后运行 `pnpm authoring:contracts`，不要手工维护分发副本。

## 快速查阅与验证

需要先观察效果再查配置时，使用[页面示例与能力索引](pages/README.md#能力索引)。页面试验场按能力、布局形态、用途和运行条件查找完整页面，并提供体验步骤、当前 JSON 配置与关联入口；这些导航说明属于开发工具，不进入页面协议或本地创作 Skill 的运行依赖。

| 使用场景 | 规则与用法 | 完整页面或接入示例 |
|---|---|---|
| 声明页面结构、布局与组件 | [页面与布局](contracts/metriccanvas/page/reference/page.md)、[组件参考](contracts/metriccanvas/page/reference/components/README.md) | [完整页面示例索引](contracts/metriccanvas/page/reference/examples/README.md) |
| 打开时指定维度范围与报告期间 | [当前分层参数](PAGE-PARAMETERS.md#当前分层参数新页面) | [分层参数页面](packages/page/fixtures/contract-valid/grouped-params-page.json) |
| 顶部切换月份或日期并联动查询与文字 | [时间参数与顶部筛选](PAGE-PARAMETERS.md#时间参数与顶部筛选) | [报告页头时间筛选页面](pages/report-date-filter-example.json) |
| 先查对象集合，再查明细并关联展示 | [级联查询](docs/cascading-queries.md) | [商务SDT报告](pages/business-sdt-cascade-example.json) |
| 从其他页面通过 URL 打开指定 Tab（6.33） | [Tab 初值](docs/page-metadata/components/tabContainer.md#url-初始化页签633)、[链接传参](docs/page-metadata/actions-and-navigation.md#链接传参与目标页签) | [来源页](pages/tab-url-source.json)、[目标页](pages/tab-url-initialization.json) |
| 配置每张表的独立搜索与完整Excel导出 | [表格工具区](docs/table-export.md) | [表格工具区示例](packages/page/fixtures/contract-valid/table-toolbar-page.json) |
| 配置 IOC 公共页头（6.36） | [IOC 公共页头](docs/page-metadata/page.md#ioc-公共页头632) | [普通](pages/ioc-header-overview-demo.json)、[密集](pages/ioc-header-dense-filter-demo.json)、[详情](pages/ioc-header-detail-demo.json) |
| 配置 PDF / PNG 导出按钮（6.31） | [报告页头](docs/page-metadata/components/reportHeader.md#导出按钮631) | [导出图片](pages/report-png-export.json)、[单张长图](pages/report-png-long-export.json) |
| 配置 Report 工具带内置 PDF 下载与按钮文字（6.28） | [报告页头](docs/page-metadata/components/reportHeader.md#内置-pdf-下载628) | [内置PDF下载页面](pages/report-pdf-export.json) |
| 下载当前筛选范围内的完整报告PDF | [导出与PDF下载接入](docs/report-export.md) | [HTML接入示例](packages/embed/examples/report-export.html) |

1. 按场景进入专题；按JSON路径查[模块参考](contracts/metriccanvas/page/reference/README.md)。
2. 使用完整JSON示例，保留显式数据、参数与筛选依赖；局部片段不能单独当作页面文档。
3. 使用 `pnpm validate <页面 JSON 所在目录>` 校验。开发工具的入口与启动命令见[页面试验场](apps/playground/README.md)。静态校验、开发态演示和真实DQE/集成应用接通分别举证。

## 页面参数与筛选

<a id="参数场景索引与使用"></a>
<a id="维度参数"></a>
<a id="时间参数"></a>
<a id="时间场景索引"></a>
<a id="时间初始化与保存"></a>
<a id="无数据与时间约束"></a>
<a id="参数的打开保存与显示"></a>

页面参数是打开时确定的不可变输入，筛选器是页内可变状态。当前分层参数以 `params.query.{dimensions,times}` 与 `params.display` 区分消费位置，查询在受控DQE位置显式引用参数；参数可以只为筛选器提供初值。声明、初始化、查询消费、保存与文本取值统一见[参数专题](PAGE-PARAMETERS.md)，旧数组兼容也在该专题内说明。

### 顶部时间筛选

<a id="配置步骤"></a>
<a id="月份范围示例"></a>
<a id="运行行为与预览"></a>

`filters` 声明输入，`filterBindings` 声明查询消费，`reportHeader.props.filterIds` 声明控件位置，文本取值显式引用当前参数或筛选状态。版本下限与完整配置统一见[时间参数与顶部筛选](PAGE-PARAMETERS.md#时间参数与顶部筛选)；字段表见[筛选声明](contracts/metriccanvas/page/reference/filters.md)和[报告页头](contracts/metriccanvas/page/reference/components/reportHeader.md)。

`timePoint.min` 从6.24起声明可选的最早月份/日期，下限包含自身；选择器、手工提交、URL和筛选状态共同约束。字段语义见[筛选声明](docs/page-metadata/filters.md#时间点下限624)，可操作场景见[商务SDT单月报告](pages/business-sdt-report-monthly.json)。

## 级联查询

查询结果绑定自6.14起由下游 `source.query.resultBindings` 声明，读取上游原始维度集合形成查询输入；6.19起可用where独立筛选输入行而保留上游结果；6.20起允许查询分页窗口输入及任意列查询排序驱动依赖更新；与用户筛选状态分别管理。完整声明、执行顺序、边界及与 `pivot`/`joinAggregate` 的协作见[级联查询专题](docs/cascading-queries.md)，字段表见[查询定义与显式绑定](contracts/metriccanvas/page/reference/queries-and-bindings.md)。

逐字段配置讲解见[首轮查询、任意列排序与分页级联](docs/page-metadata/queries-and-bindings.md#配置解读首轮查询任意列排序与分页级联)：连起来配置字段映射、初始order、表格query分页与下游resultBindings。查询分页窗口提供本轮输入，totalCount表示业务总行数；sections顺序不决定查询执行顺序。

## 动态标题与文本组合（6.23）

所有文本取值位置可使用 `{"parts":[{"filter":"report-month","format":"period"}," 经营分析报告"]}`，主标题随已应用的时间筛选更新。片段也可引用打开时固定的参数，声明和缺值语义见[文本组合](docs/page-metadata/params-and-text-values.md#文本片段组合623)。完整验收统一在 [Report 时间选择与联动](pages/report-date-filter-example.json)，按文字联动、范围查询和未来时间限制分节展示。

## 多查询表格（6.22）

`pagedJoin` 组合查询源复用普通查询定义，通过稳定业务键投影到独占组合表；支持完整行域的排序、跨源数值范围、搜索与分页。声明及边界见[数据源](docs/page-metadata/data-sources.md#多查询组合源-pagedjoin622)和[表格](docs/page-metadata/components/table.md#数值范围和组合表622)。可运行验收页为 [multi-query-table.json](pages/multi-query-table.json)，打开方式和逐步预期见[页面验收场景](pages/README.md#多查询表格)。页面使用本地 DQE Sim，不证明真实 DQE 能力。

新功能交付须按[必选验收要求](docs/agents/feature-acceptance.md)同步页面场景、本规范对应模块和本地创作 Skill。

验收页同时对照当前排序序号与固定预签金额排名：前者使用 `ordinalField`；后者由普通查询返回排名字段，再通过 `projection` 关联，切换排序和表格筛选时保留原名次。排名范围与并列规则由提供该字段的查询定义，组合源不隐式重算。

## 报告下载与完整导出

Report 顶层页头可用 `reportHeader.props.pdfExport`（6.28）启用引擎内置 PDF 下载，并按需配置按钮名称和文件名；声明、默认值与示例见[报告页头](docs/page-metadata/components/reportHeader.md#内置-pdf-下载628)。标准下载由引擎按原有布局连续保存，采用零外边距；主线程分批准备画面，Web Worker负责编码，移除取消按钮和旧withExportView入口。整页下载保留成功取得的内容，部分取数失败不阻断其余内容；下载成功不代表数据完整。下载范围、限制与演示统一见[报告导出与PDF下载接入](docs/report-export.md)。

Report顶层页头统一声明`exportButtons`（6.31），每项配置`format`、`label?`、`filename?`、`scale?`；一项一个按钮，点击直接下载。PDF默认2倍、支持2/3/4倍；PNG默认3倍、支持3/4倍，始终只输出一张完整PNG。不支持的scale值按未配置处理，回退对应默认倍率，不阻止打开或下载。旧`pdfExport`/`pngExport`保留读取兼容；声明与限制见[报告页头](docs/page-metadata/components/reportHeader.md#导出按钮631)。

## 版本、初始化与持久化

新文档写当前作者版本和 `layout`。已支持版本的 `layoutForm` 在输入边界兼容读取，双字段同时出现拒绝；布局兼容规范化不自动升级其他能力。历史修订先核验原文hash，迁移结果另存新修订。详见[布局迁移](docs/page-metadata/layout-migration.md)。

无值参数模板可以结构合法，必需输入完整性在执行前验证。执行时的查询副本与可变筛选状态不作为模板原文保存；提取、填值及旧绑定迁移见[参数专题](PAGE-PARAMETERS.md#程序化提取与填值)。

Schema元数据另见[数据上下文规则](docs/schema-metadata.md)，页面构建规格与工具能力另见[Authoring Bundle](metriccanvas-authoring/README.md)。

## 字段绑定与展示格式

<a id="百万单位的使用65"></a>

格式由组件字段绑定声明，页面数据源可以提供 `defaultFormat` 建议，原始数据保留基础单位。格式清单、覆盖优先级及百万单位的用法统一见[字段绑定与格式](contracts/metriccanvas/page/reference/field-bindings-and-formats.md)。

## 旧锚点导航


原章节已迁入模块，以下锚点保留旧链接定位；字段表以生成参考为准。

<a id="1-概念与关联关系"></a>

1. 概念与关联关系 → [模块参考](contracts/metriccanvas/page/reference/README.md)。

<a id="11-声明关系"></a>

1.1 声明关系 → [模块参考](contracts/metriccanvas/page/reference/README.md)。

<a id="12-引用关系表"></a>

1.2 引用关系表 → [模块参考](contracts/metriccanvas/page/reference/README.md)。

<a id="13-三个字段空间"></a>

1.3 三个字段空间 → [模块参考](contracts/metriccanvas/page/reference/README.md)。

<a id="2-生成规则"></a>

2. 生成规则 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="3-顶层结构"></a>

3. 顶层结构 → [模块参考](contracts/metriccanvas/page/reference/page.md)。

<a id="32-版本策略"></a>

3.2 版本策略 → [模块参考](contracts/metriccanvas/page/reference/page.md)。

<a id="33-页面参数与文本取值"></a>

3.3 页面参数与文本取值 → [模块参考](contracts/metriccanvas/page/reference/params-and-text-values.md)。

<a id="31-标识符与唯一性"></a>

3.1 标识符与唯一性 → [模块参考](contracts/metriccanvas/page/reference/page.md)。

<a id="4-页面数据源与结果字段契约"></a>

4. 页面数据源与结果字段契约 → [模块参考](contracts/metriccanvas/page/reference/data-sources.md)。

<a id="41-数据模式"></a>

4.1 数据模式 → [模块参考](contracts/metriccanvas/page/reference/data-sources.md)。

<a id="42-标量字段"></a>

4.2 标量字段 → [模块参考](contracts/metriccanvas/page/reference/fields.md)。

<a id="43-展示格式"></a>

4.3 展示格式 → [模块参考](contracts/metriccanvas/page/reference/field-bindings-and-formats.md)。

<a id="44-数据行契约"></a>

4.4 数据行契约 → [模块参考](contracts/metriccanvas/page/reference/fields.md)。

查询结果中的 `number` / `money` 度量采用单元格容错：异常值归一化为 `null`，数字字符串转换，保留全部数据行；`nullable: false` 的数值度量缺失改为非阻断告警。初始行、动态响应、嵌套数值明细和组合结果的规则一致；维度、字段映射及结构仍严格校验。完整规则见[查询数值容错](docs/page-metadata/fields.md#查询数值度量的容错)，验收见 [query-numeric-tolerance](pages/query-numeric-tolerance.json)。

<a id="45-inline-页面数据源"></a>

4.5 `inline` 页面数据源 → [模块参考](contracts/metriccanvas/page/reference/data-sources.md)。

<a id="46-query-页面数据源"></a>

4.6 `query` 页面数据源 → [模块参考](contracts/metriccanvas/page/reference/data-sources.md)。

<a id="47-内嵌初始行"></a>

4.7 内嵌初始行 → [模块参考](contracts/metriccanvas/page/reference/data-sources.md)。

<a id="48-recordlistdetail-嵌套明细"></a>

4.8 `recordList/detail` 嵌套明细 → [模块参考](contracts/metriccanvas/page/reference/fields.md)。

<a id="49-semantichtmldetail-受控语义-html"></a>

4.9 `semanticHtml/detail` 受控语义 HTML → [模块参考](contracts/metriccanvas/page/reference/semantic-html.md)。

<a id="410-受控计算阶段"></a>

6.12 新增完整结果上的跨源 `joinAggregate`；依赖、组合键、聚合和缺行策略显式声明，查询源需要 `source.resultScope: "complete"`。约束与批次规则见 [ADR-0095](docs/adr/0095-cross-source-computation-and-ioc-schema-compatibility.md)。创作契约将在 IOC 实施最后阶段统一生成。

4.10 受控计算阶段 → [模块参考](contracts/metriccanvas/page/reference/compute.md)。

<a id="5-筛选器与查询绑定"></a>

5. 筛选器与查询绑定 → [模块参考](contracts/metriccanvas/page/reference/filters.md)。

<a id="51-维度筛选器"></a>

5.1 维度筛选器 → [模块参考](contracts/metriccanvas/page/reference/filters.md)。

<a id="52-时间范围筛选器"></a>

5.2 时间范围筛选器 → [模块参考](contracts/metriccanvas/page/reference/filters.md)。

<a id="53-布尔时间点数值区间与搜索"></a>

5.3 布尔、时间点、数值区间与搜索 → [模块参考](contracts/metriccanvas/page/reference/filters.md)。

<a id="54-dqe-筛选绑定"></a>

5.4 DQE 筛选绑定 → [模块参考](contracts/metriccanvas/page/reference/queries-and-bindings.md)。

<a id="6-内容分区与布局"></a>

6. 内容分区与布局 → [模块参考](contracts/metriccanvas/page/reference/sections-and-layout.md)。

<a id="7-组件模型与选择目录"></a>

7. 组件模型与选择目录 → [模块参考](contracts/metriccanvas/page/reference/components/README.md)。

<a id="71-组件通用结构"></a>

7.1 组件通用结构 → [模块参考](contracts/metriccanvas/page/reference/components/README.md)。

<a id="72-选择目录"></a>

7.2 选择目录 → [模块参考](contracts/metriccanvas/page/reference/components/README.md)。

<a id="73-reportheader"></a>

7.3 `reportHeader` → [模块参考](contracts/metriccanvas/page/reference/components/reportHeader.md)。

<a id="74-metriccard"></a>

7.4 `metricCard` → [模块参考](contracts/metriccanvas/page/reference/components/metricCard.md)。

6.34 支持 Dashboard 顶层指标卡 `layout.before` 连接文字，双侧间距缺省 8px，保留外层 12 列；完整场景见 [指标卡连接排布](pages/metric-card-equation.json)。

<a id="75-图表组件"></a>

7.5 图表组件 → [模块参考](contracts/metriccanvas/page/reference/components/README.md)。

<a id="柱状图-barchart"></a>

柱状图 `barChart` → [模块参考](contracts/metriccanvas/page/reference/components/barChart.md)。

<a id="折线图-linechart"></a>

折线图 `lineChart` → [模块参考](contracts/metriccanvas/page/reference/components/lineChart.md)。

<a id="饼图-piechart"></a>

饼图 `pieChart` → [模块参考](contracts/metriccanvas/page/reference/components/pieChart.md)。

<a id="76-table"></a>

7.6 `table` → [模块参考](contracts/metriccanvas/page/reference/components/table.md)。

<a id="77-mapchart"></a>

7.7 `mapChart` → [模块参考](contracts/metriccanvas/page/reference/components/mapChart.md)。

<a id="77a-gauge"></a>

7.7a `gauge` → [模块参考](contracts/metriccanvas/page/reference/components/gauge.md)。

<a id="77b-tabcontainer"></a>

7.7b `tabContainer` → [模块参考](contracts/metriccanvas/page/reference/components/tabContainer.md)。

<a id="77c-compositecard"></a>

7.7c `compositeCard` → [模块参考](contracts/metriccanvas/page/reference/components/compositeCard.md)。

<a id="78-排名组件"></a>

7.8 排名组件 → [模块参考](contracts/metriccanvas/page/reference/components/README.md)。

<a id="rankingcard"></a>

`rankingCard` → [模块参考](contracts/metriccanvas/page/reference/components/rankingCard.md)。

<a id="rankingdetailcard"></a>

`rankingDetailCard` → [模块参考](contracts/metriccanvas/page/reference/components/rankingDetailCard.md)。

<a id="79-keyvaluepanel-与-fieldtext"></a>

7.9 `keyValuePanel` 与 `fieldText` → [模块参考](contracts/metriccanvas/page/reference/components/fieldText.md)。

<a id="79a-categorybreakdown"></a>

7.9a `categoryBreakdown` → [模块参考](contracts/metriccanvas/page/reference/components/categoryBreakdown.md)。

<a id="710-text"></a>

7.10 `text` → [模块参考](contracts/metriccanvas/page/reference/components/text.md)。

<a id="711-aisummary"></a>

7.11 `aiSummary` → [模块参考](contracts/metriccanvas/page/reference/components/aiSummary.md)。

<a id="8-数据槽字段绑定与有限交互"></a>

8. 数据槽、字段绑定与有限交互 → [模块参考](contracts/metriccanvas/page/reference/actions-and-navigation.md)。

<a id="81-数据槽"></a>

8.1 数据槽 → [模块参考](contracts/metriccanvas/page/reference/actions-and-navigation.md)。

<a id="82-字段引用与字段绑定"></a>

8.2 字段引用与字段绑定 → [模块参考](contracts/metriccanvas/page/reference/actions-and-navigation.md)。

<a id="83-组件-action-与-url-导航"></a>

8.3 组件 action 与 URL 导航 → [模块参考](contracts/metriccanvas/page/reference/actions-and-navigation.md)。

<a id="84-文本链接与表格选择"></a>

8.4 文本链接与表格选择 → [模块参考](contracts/metriccanvas/page/reference/actions-and-navigation.md)。

<a id="9-从页面声明到运行时"></a>

9. 从页面声明到运行时 → [模块参考](contracts/metriccanvas/page/reference/data-sources.md)。

<a id="10-完整生成示例"></a>

10. 完整生成示例 → [模块参考](contracts/metriccanvas/page/reference/examples/README.md)。

<a id="101-仅内联页面"></a>

10.1 仅内联页面 → [模块参考](contracts/metriccanvas/page/reference/examples/README.md)。

<a id="102-带初始行筛选和-action-的-dqe-页面"></a>

10.2 带初始行、筛选和 action 的 DQE 页面 → [模块参考](contracts/metriccanvas/page/reference/examples/README.md)。

<a id="11-生成后自检清单"></a>

11. 生成后自检清单 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="111-结构"></a>

11.1 结构 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="112-数据与查询"></a>

11.2 数据与查询 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="113-引用与角色"></a>

11.3 引用与角色 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="114-产品语义"></a>

11.4 产品语义 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="12-禁止的生成模式"></a>

12. 禁止的生成模式 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

<a id="13-校验与错误"></a>

13. 校验与错误 → [模块参考](contracts/metriccanvas/page/reference/validation.md)。

6.3 新增确定性时间参数与查询窗口绑定。日期/月取值固定于初始化，按指定时间查询，不回退最新期；结构、窗口边界与实施限制见[时间参数](docs/page-metadata/time-parameters.md)。

6.4新增 `yearToDate` / `monthToDate` 具名窗口，不带unit，终点为绑定参数的报告基准期；保留6.3旧窗口写法兼容。

6.5新增 `compact-million-0/1/2` 数值展示格式，按百万缩放并保留指定小数位；不改变查询与原始数值。

### 6.12 查询结果与页内交互增量

- `sectionGroups` / `defaultSectionGroup` / `sectionGroupParam` / `sectionAnchors`：既有内容分区的有限切换和页内定位。
- `detailViews`：snapshot 复用快照，query 以必需显式绑定隔离取数；`openDetail.view` 与旧 `fields` 互斥。表格列可声明互斥的独立 `openDetail` / `navigate`。
- `timeFill` / `selectField`：明确日/月范围补齐和有限模式字段选择。
- 柱图 series 的 `kind` / `axis`：柱线混合、轴单位校验。
- 字段绑定 `missingText`：消费者缺失文案，数值类型与刻度不变。

具体约束见 [ADR-0096](docs/adr/0096-ioc-view-state-and-post-query-presentation.md)。6.11继续可读，但使用上述能力的文档必须写6.12。

所有时间选择器默认禁止未来时间，覆盖点、范围、Dashboard 年／季／月及精确时间输入；URL 和手工输入同样受限。当前自然期间保持完整查询范围，详见[时间选择的默认上限](docs/page-metadata/filters.md#时间选择的默认上限)。

`timePoint.disableFuture: true` 从6.25起禁止未来月份／日期，当前期间可选；上限随本地当前日期推进，控件、手工输入、URL与参数初始化共同约束。见[禁止未来时间](docs/page-metadata/filters.md#禁止未来时间625)及[交互验收页](pages/report-date-filter-example.json)。

6.27 增量：Dashboard 顶部 timeRange 的年／季／月／近一年选择形态，声明、状态及查询规则见[期间筛选](docs/page-metadata/filters.md#dashboard-期间选择627)。
6.29 增加 Dashboard 正文图表左上角独立筛选 `props.filter`，支持自定义显示名称、查询值和单选默认项；查询依赖校验保证只影响所属图表。完整声明、限制与验收页面见[图表独立筛选](docs/page-metadata/filters.md#图表独立筛选629)。

6.37 新增[业务筛选](docs/page-metadata/filters.md#business-filters)：单多选、封闭枚举、结构树、候选依赖与hint；共用执行入口先核验当前候选再复用初始结果或查询，不在页头内另建规则解释器。

6.38增加USD静态money、非递归FieldBinding.byFilter、numberRange约束/单位/预设及metricByFilter。参见[金额范围](docs/page-metadata/filters.md#amount-range)、[字段选择](docs/page-metadata/field-bindings-and-formats.md#field-selection)和`pages/ioc-header-currency-demo.json`。不同币种结果保持独立静态字段，不提供前端换汇；旧普通相等范围兼容。

## 6.39 复杂时间与可信期间输入

共用筛选新增 `timeRange.display:"modes"`、完整静态 `query.timeModes`、时间 `presets`、`availability` 和动态维度 `candidateWindow`；边界见[筛选语义](docs/page-metadata/filters.md)、[查询绑定](docs/page-metadata/queries-and-bindings.md)。实际验收为 `pages/ioc-header-time-modes-demo.json`、`ioc-header-time-presets-demo.json`、`ioc-header-availability-demo.json`、`ioc-header-calendar-window-demo.json`，均为本地合成数据。旧年季月/近一年、详情单月、离散月份和 datetime 保持各自语义。可信期间事实由 RuntimeView/embed 的可选稳定 `displayInputs` 源提供，不写入 Page/参数/URL；本批不开放 Condition、任意对象路径或权限表达式。

### 6.40 跨页传值

导航可显式配置`validateTargetInputs:true`，集成应用提供目标输入投影；校验row/param/filter映射，拒绝缺必需值、类型/粒度不兼容及无目标能力，普通URL兼容。目标独立校验并等待当前候选；显式开启`strictURLInputs:true`时，非法筛选URL不回退默认查询。见[交互与导航](docs/page-metadata/actions-and-navigation.md)。无视图恢复，B6挂起。

`strictURLInputs:true`由页面显式开启，兼容规范化升版本不自动开启。来源和目标可分别选择该策略；本批三个验收页均开启。受控编辑使用`set_url_input_validation`，enabled=false仅删除该标记。
条件呈现与动作资格见[条件规则](docs/page-metadata/conditions.md)：6.35就地声明visibleWhen/enabledWhen，父级约束后代，子项不反推父级。

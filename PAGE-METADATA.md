# MetricCanvas 页面元数据规范

页面元数据是统一运行时消费的声明式JSON文档。当前作者协议为 **6.18**，读取支持5.0—5.4、6.5、6.11、6.12、6.13、6.14、6.15、6.16、6.17和6.18；各能力的版本下限独立校验。结构事实由 `packages/page/src/schema/` 单向导出，当前版本与可读范围由 `versionPolicy` 和 `supportedVersions()` 定义；未声明属性不被接受。

## 从需求到页面

创作先取得受治理的数据上下文，确定性工具按页面构建规格装配完整页面，经过校验后交统一运行时。数据上下文、会话、执行身份与修订信息不写进页面文档。页面协议可表达、Authoring工具已支持、外部服务已接通分别举证。

页面拥有命名数据源、筛选器和内容分区；组件的数据槽引用数据源，字段绑定引用结果字段契约。queryField属于查询字段空间，页面字段id和筛选器dimension不能靠同名隐式绑定。数据快照是运行状态，不是作者文档。

## 文档结构与维护分工

本文件维护页面协议概览、版本边界与阅读导航。使用步骤与跨字段示例由专题文档维护，字段语义由模块维护，精确结构表从Schema生成；同一规则在所属文档维护后由其他入口引用。

| 文档层次 | 职责与入口 |
|---|---|
| 协议总览 | 本文件：页面组成、能力边界、版本与专题导航 |
| 参数与筛选专题 | [PAGE-PARAMETERS.md](PAGE-PARAMETERS.md)：维度与时间输入、初始化、页内筛选、期间文字、时间窗口和兼容用法 |
| 查询依赖专题 | [级联查询](docs/cascading-queries.md)：结果绑定、请求顺序、明细完整性、计算与完整示例 |
| 集成应用接入专题 | [报告导出与PDF下载](docs/report-export.md)：实例方法、下载范围、编码器、取消及失败处理 |
| 模块语义源与生成参考 | `docs/page-metadata/`维护作者语义；[模块参考](contracts/metriccanvas/page/reference/README.md)提供Schema生成的字段表、分支、合法示例和反例，同时分发到Authoring Bundle与Skill |

[机器索引](contracts/metriccanvas/page/reference/index.json)记录Schema位置、模块与示例覆盖；[完整Schema](contracts/metriccanvas/page/reference/schema.json)与参考正文同时生成。修改模块语义或示例索引后运行 `pnpm authoring:contracts`，不要手工维护分发副本。

## 快速查阅与验证

| 使用场景 | 规则与用法 | 完整页面或接入示例 |
|---|---|---|
| 声明页面结构、布局与组件 | [页面与布局](contracts/metriccanvas/page/reference/page.md)、[组件参考](contracts/metriccanvas/page/reference/components/README.md) | [完整页面示例索引](contracts/metriccanvas/page/reference/examples/README.md) |
| 打开时指定维度范围与报告期间 | [当前分层参数](PAGE-PARAMETERS.md#当前分层参数新页面) | [分层参数页面](packages/page/fixtures/contract-valid/grouped-params-page.json) |
| 顶部切换月份或日期并联动查询与文字 | [时间参数与顶部筛选](PAGE-PARAMETERS.md#时间参数与顶部筛选) | [报告页头时间筛选页面](pages/report-date-filter-example.json) |
| 先查对象集合，再查明细并关联展示 | [级联查询](docs/cascading-queries.md) | [商务SDT报告](pages/business-sdt-report.json) |
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

## 级联查询

查询结果绑定自6.14起由下游 `source.query.resultBindings` 声明，读取上游原始维度集合形成查询输入；与用户筛选状态分别管理。完整声明、执行顺序、边界及与 `pivot`/`joinAggregate` 的协作见[级联查询专题](docs/cascading-queries.md)，字段表见[查询定义与显式绑定](contracts/metriccanvas/page/reference/queries-and-bindings.md)。

## 报告下载与完整导出

下载属于集成应用接入：页面JSON声明内容及查询，引擎实例通过 `withExportView` 提供完整静态视图，集成应用负责PDF编码、分页与文件保存。公共方法、下载范围、限制与演示统一见[报告导出与PDF下载接入](docs/report-export.md)；页面协议没有下载配置开关。

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

# MetricCanvas 页面元数据规范

页面元数据是统一运行时消费的声明式 JSON 文档。当前作者协议版本、可读兼容范围与各能力的次版本下限，统一以 [`packages/page/src/version.ts`](packages/page/src/version.ts) 的 `versionPolicy.current`、`supportedVersions()` 和能力表为唯一真源；结构事实由 [`packages/page/src/schema/`](packages/page/src/schema/) 单向导出，未声明属性不被接受。

> 历次 `6.x` 次版本能力增量与零字段运行时行为变更已独立归集于 **[页面协议演进与变更日志](docs/changelog/page-metadata.md)**；查阅精确字段语义、Schema 结构表与合法/反例夹具请直接进入各模块参考。

## 从需求到页面

创作先取得受治理的数据上下文，确定性工具按页面构建规格装配完整页面，经过校验后交统一运行时。数据上下文、会话、执行身份与修订信息不写进页面文档。页面协议可表达、Authoring 工具已支持、外部服务已接通分别举证。

新建页面先明确布局形态（`dashboard` / `report`）并显式声明 `layout`；外框含义与默认值见[页面与布局](docs/page-metadata/page.md#创作时显式选择布局形态)。本地创作 Skill 在生成前完成用户确认并按形态读取成型页面范式；这不新增资产类别或协议字段。

页面拥有命名数据源（`dataSources`）、筛选器（`filters`）、可选页面参数（`params`）和内容分区（`sections`）；组件的数据槽引用数据源，字段绑定引用结果字段契约。`queryField` 属于查询字段空间，页面字段 ID 和筛选器 `dimension` 不能靠同名隐式绑定。数据快照是运行状态，不是作者文档。

默认运行态保障（均由引擎承接，无需新增协议字段）：

- **结构优先加载与错误隔离**：拿到合法页面后立即挂载真实页头、筛选控件、分区与组件外壳；查询失败时保留组件结构、输出脱值控制台诊断与 `data-error` 事件，详见[屏幕加载与查询异常](docs/page-metadata/data-sources.md#screen-loading)。
- **IOC 页头组件化**：新页面统一在首分区首位使用 `type: "iocHeader"`（业务属性在 `props`），旧根级 `iocHeader` 与 `dashboardToolbar` 仅保留兼容读取；详见[分区页头](docs/page-metadata/page.md#ioc-页头进入分区681)。
- **按需取数与条件裁剪**：隐藏表格列、图表系列与无消费者的关联计算自动跳过取数，详见[条件显隐](docs/page-metadata/conditions.md)。

单张期间明细表可用已有的 `rowKey`、`unionKeys` 与 `joinAggregate` 先显示已返回的组织，再补列、追加行。适用条件见[期间明细表渐进显示](docs/page-metadata/compute.md#period-detail-union)。

## 文档结构与维护分工

本文件维护页面协议概览、版本边界与阅读导航。使用步骤与跨字段示例由专题文档维护，字段语义由模块维护，精确结构表从 Schema 生成；同一规则在所属文档维护后由其他入口引用。

| 文档层次 | 职责与入口 |
|---|---|
| 协议总览 | 本文件：页面组成、能力边界、版本边界与专题导航 |
| 版本演进与变更日志 | [页面协议变更日志](docs/changelog/page-metadata.md)：历次 `6.x` 次版本增量、运行时容错与零字段引擎演进记录 |
| 参数与筛选专题 | [PAGE-PARAMETERS.md](PAGE-PARAMETERS.md)：维度与时间输入、初始化、页内筛选、期间文字、时间窗口和兼容用法 |
| 查询依赖专题 | [级联查询](docs/cascading-queries.md)：结果绑定、请求顺序、明细完整性、计算与完整示例 |
| 集成应用接入专题 | [报告导出与PDF下载](docs/report-export.md)：内置下载、后台编码、运行环境及失败处理 |
| 模块语义源与生成参考 | `docs/page-metadata/` 维护作者语义；[模块参考](contracts/metriccanvas/page/reference/README.md)提供 Schema 生成的字段表、分支、合法示例和反例，同时分发到 Authoring Bundle 与 Skill |

[机器索引](contracts/metriccanvas/page/reference/index.json)记录 Schema 位置、模块与示例覆盖；[完整 Schema](contracts/metriccanvas/page/reference/schema.json)与参考正文同时生成。修改模块语义或示例索引后运行 `pnpm authoring:contracts`，不要手工维护分发副本。

## 快速查阅与验证

需要先观察效果再查配置时，使用[页面示例与能力索引](pages/README.md#能力索引)。页面试验场按布局、独立组件目录和数据与联动三个维度查找推荐场景；全部实际文件在 `/files` 中自动发现，移动文件保留 id 和 `/pages/<id>` 地址，无需逐页登记。文件与目录校验边界见[文件与目录校验](docs/page-metadata/validation.md#文件与目录校验)与[页面数据源分支诊断](docs/page-metadata/validation.md#页面数据源分支诊断)。

| 使用场景 | 规则与用法 | 完整页面或接入示例 |
|---|---|---|
| 声明页面结构、布局与组件 | [页面与布局](contracts/metriccanvas/page/reference/page.md)、[组件参考](contracts/metriccanvas/page/reference/components/README.md) | [完整页面示例索引](contracts/metriccanvas/page/reference/examples/README.md) |
| 打开时指定维度范围与报告期间 | [当前分层参数](PAGE-PARAMETERS.md#当前分层参数新页面) | [分层参数页面](packages/page/fixtures/contract-valid/grouped-params-page.json) |
| 顶部切换月份或日期并联动查询与文字 | [时间参数与顶部筛选](PAGE-PARAMETERS.md#时间参数与顶部筛选) | [报告页头时间筛选页面](pages/capabilities/filters/report-date-filter-example.json)、[完整合成月报](pages/capabilities/filters/report-monthly-complete.json) |
| 先查对象集合，再查明细并关联展示 | [级联查询](docs/cascading-queries.md) | [商务 SDT 报告](pages/business/report/sdt/business-sdt-cascade-example.json) |
| 从其他页面通过 URL 打开指定 Tab（6.33） | [Tab 初值](docs/page-metadata/components/tabContainer.md#url-初始化页签633)、[链接传参](docs/page-metadata/actions-and-navigation.md#链接传参与目标页签) | [来源页](pages/capabilities/navigation/tab-url-source.json)、[目标页](pages/capabilities/navigation/tab-url-initialization.json) |
| 配置每张表的独立搜索与完整 Excel 导出（全部匹配行，普通表每批请求 200 条，准备预算 30 分钟，支持集成应用导出权限） | [表格工具区](docs/table-export.md) | [表格工具区示例](packages/page/fixtures/contract-valid/table-toolbar-page.json) |
| 配置 IOC 公共页头（6.36 / 6.81 组件化） | [IOC 公共页头](docs/page-metadata/page.md#ioc-公共页头632)、[分区页头](docs/page-metadata/page.md#ioc-页头进入分区681) | [普通](pages/capabilities/ioc-header/scenarios/ioc-header-overview-demo.json)、[密集](pages/capabilities/ioc-header/scenarios/ioc-header-dense-filter-demo.json)、[详情](pages/capabilities/ioc-header/scenarios/ioc-header-detail-demo.json) |
| 配置 PDF / PNG 导出按钮（6.31） | [报告页头](docs/page-metadata/components/reportHeader.md#导出按钮631) | [导出图片](pages/capabilities/export/report-png-export.json)、[单张长图](pages/capabilities/export/report-png-long-export.json) |
| 配置 Report 工具带内置 PDF 下载与按钮文字（6.28） | [报告页头](docs/page-metadata/components/reportHeader.md#内置-pdf-下载628) | [内置 PDF 下载页面](pages/capabilities/export/report-pdf-export.json) |
| 下载当前筛选范围内的完整报告 PDF | [导出与 PDF 下载接入](docs/report-export.md) | [HTML 接入示例](packages/embed/examples/report-export.html) |

1. 按场景进入专题；按 JSON 路径查[模块参考](contracts/metriccanvas/page/reference/README.md)。
2. 使用完整 JSON 示例，保留显式数据、参数与筛选依赖；局部片段不能单独当作页面文档。
3. 使用 `pnpm validate <页面 JSON 所在目录>` 校验。开发工具的入口与启动命令见[页面试验场](apps/playground/README.md)。静态校验、开发态演示和真实 DQE / 集成应用接通分别举证。

## 页面参数与筛选

<a id="参数场景索引与使用"></a>
<a id="维度参数"></a>
<a id="时间参数"></a>
<a id="时间场景索引"></a>
<a id="时间初始化与保存"></a>
<a id="无数据与时间约束"></a>
<a id="参数的打开保存与显示"></a>

页面参数是打开时确定的不可变输入，筛选器是页内可变状态。当前分层参数以 `params.query.{dimensions,times}` 与 `params.display` 区分消费位置，查询在受控 DQE 位置显式引用参数；参数可以只为筛选器提供初值。声明、初始化、查询消费、保存与文本取值统一见[参数专题](PAGE-PARAMETERS.md)与[参数模块参考](docs/page-metadata/params-and-text-values.md)，旧数组兼容也在该专题内说明。

### 顶部时间筛选

<a id="配置步骤"></a>
<a id="月份范围示例"></a>
<a id="运行行为与预览"></a>

`filters` 声明输入，`filterBindings` 声明查询消费，`reportHeader.props.filterIds`（或 IOC 页头 `props.components` / `filterIds`）声明控件位置，文本取值显式引用当前参数或筛选状态。版本下限与完整配置统一见[时间参数与顶部筛选](PAGE-PARAMETERS.md#时间参数与顶部筛选)；字段表见[筛选声明](contracts/metriccanvas/page/reference/filters.md)和[报告页头](contracts/metriccanvas/page/reference/components/reportHeader.md)。

## 级联查询

查询结果绑定由下游 `source.query.resultBindings` 声明，读取上游原始维度集合形成查询输入；支持 `where` 独立筛选输入行，以及查询分页窗口与任意列查询排序驱动依赖更新；与用户筛选状态分别管理。完整声明、执行顺序、边界及与 `pivot` / `joinAggregate` 的协作见[级联查询专题](docs/cascading-queries.md)，字段表见[查询定义与显式绑定](contracts/metriccanvas/page/reference/queries-and-bindings.md)。

逐字段配置讲解见[首轮查询、任意列排序与分页级联](docs/page-metadata/queries-and-bindings.md#配置解读首轮查询任意列排序与分页级联)：连起来配置字段映射、初始 `order`、表格 `query` 分页与下游 `resultBindings`。查询分页窗口提供本轮输入，`totalCount` 表示业务总行数；`sections` 顺序不决定查询执行顺序。

## 动态标题与文本组合（6.23）

所有文本取值位置可使用 `{"parts":[{"filter":"report-month","format":"period"}," 经营分析报告"]}`，主标题随已应用的时间筛选更新。片段也可引用打开时固定的参数，声明和缺值语义见[文本组合](docs/page-metadata/params-and-text-values.md#文本片段组合623)。完整验收统一在 [Report 时间选择与联动](pages/capabilities/filters/report-date-filter-example.json)。

## 多查询表格（6.22）

`pagedJoin` 组合查询源复用普通查询定义，通过稳定业务键投影到独占组合表；支持完整行域排序、跨源数值范围、搜索、记录模式 `records` 与按需/自动分页。`pagedUnion`（6.61 起）支持多来源投影与逐行合并分页。声明及边界见[数据源](docs/page-metadata/data-sources.md#多查询组合源-pagedjoin622)、[分页合并源](docs/page-metadata/data-sources.md#paged-union)与[表格](docs/page-metadata/components/table.md#数值范围和组合表622)。可运行验收页为 [multi-query-table.json](pages/capabilities/table/multi-query-table.json) 与 [multi-source-table.json](pages/capabilities/table/multi-source-table.json)。

新功能交付须按[必选验收要求](docs/agents/feature-acceptance.md)同步页面场景、本规范对应模块和本地创作 Skill。

## 报告下载与完整导出

Report 顶层页头统一通过 `exportButtons`（6.31，旧 `pdfExport` / `pngExport` 保留兼容读取）声明 PDF 与单张高清 PNG 下载，按项配置 `format`、`label?`、`filename?`、`scale?`。下载范围、编码限制与集成应用接入方法统一见[报告页头](docs/page-metadata/components/reportHeader.md#导出按钮631)与[报告导出与 PDF 下载接入](docs/report-export.md)。

## 版本、初始化与持久化

新文档写当前作者版本（见 `packages/page/src/version.ts` 的 `versionPolicy.current`）和 `layout`。已支持版本的 `layoutForm` 在输入边界兼容读取，双字段同时出现拒绝；布局兼容规范化不自动升级其他能力。历史修订先核验原文 hash，迁移结果另存新修订。详见[布局迁移](docs/page-metadata/layout-migration.md)。

使用 `metriccanvas-local-authoring` 继续开发旧页面时，先运行独立 `upgrade-page.mjs` 检查；可迁移时保留原始字节与报告，再升级工作文件并继续原任务。升级规则、版本范围和语义缺口见[旧页面继续开发](docs/page-metadata/page.md#旧页面继续开发与显式升级)，可观察场景见[升级示例](pages/capabilities/layout/README.md#旧页面升级后继续开发)。此创作期能力不扩大运行时的旧版本读取范围。

无值参数模板可以结构合法，必需输入完整性在执行前验证。执行时的查询副本与可变筛选状态不作为模板原文保存；提取、填值及旧绑定迁移见[参数专题](PAGE-PARAMETERS.md#程序化提取与填值)。

Schema 元数据另见[数据上下文规则](docs/schema-metadata.md)，页面构建规格与工具能力另见[Authoring Bundle](metriccanvas-authoring/README.md)。

## 字段绑定与展示格式

<a id="百万单位的使用65"></a>

缺失值默认显示 `—`（包括百分比和图表）；普通数值默认千分位，整数（含百分比、金额、缩放单位及舍入后整数）省略 `.0` / `.00`，非整数按声明精度四舍五入并舍弃小数末尾零；自定义缺失文字仍优先。详见[整数与缺失值的统一显示](docs/page-metadata/field-bindings-and-formats.md#numeric-value-display)。

格式由组件字段绑定声明，页面数据源可以提供 `defaultFormat` 建议，原始数据保留基础单位。格式清单、覆盖优先级、语义格式与时间格式串统一见[字段绑定与格式](contracts/metriccanvas/page/reference/field-bindings-and-formats.md)。

图表标签、悬浮提示、数值轴单位与饼图外围百分比统一采用共享数值格式化规则，详见[柱线图数值格式一致性](docs/page-metadata/field-bindings-and-formats.md#chart-number-format)与[饼图外围标签](docs/page-metadata/components/pieChart.md#percentage-labels)。

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

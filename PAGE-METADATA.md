# MetricCanvas 页面元数据规范

表格自 6.62 起在字段列和分组列上声明 `visibleWhen`，搜索、用户列操作与冻结导出随可见列同步；旧表格保持原规则。见[列条件显隐](docs/page-metadata/components/table.md#table-column-visibility)。

图表配置项自 6.59 起可从字段或常量取值，`field` / `value`（或 `valueField` / `value`）互斥；覆盖全部图表及仪表，详见[组件取值与空态](docs/page-metadata/field-bindings-and-formats.md#chart-constant-values)。

页面元数据是统一运行时消费的声明式JSON文档。当前作者协议为 **6.62**，读取支持5.0—5.4、6.5、6.11、6.12、6.13、6.14、6.15、6.16、6.17、6.18、6.19、6.20、6.21、6.22、6.23、6.24、6.25、6.26、6.27、6.28、6.29、6.30、6.31、6.32、6.33、6.34、6.35、6.36、6.37、6.38、6.39、6.40、6.41、6.42、6.43、6.44、6.45、6.46、6.47、6.48、6.49、6.50、6.51、6.52、6.53、6.54、6.55、6.56、6.57、6.58、6.59、6.60、6.61和6.62；各能力的版本下限独立校验。结构事实由 `packages/page/src/schema/` 单向导出，当前版本与可读范围由 `versionPolicy` 和 `supportedVersions()` 定义；未声明属性不被接受。

高级图表呈现扩展自 6.32 起通过隐含 `props.echartsOption` 声明，仅用于明确的 ECharts 定制需求；见[高级扩展](docs/page-metadata/chart-option.md)。

柱状图公共默认柱宽统一为16px，覆盖普通、横向、堆叠、预测和混合柱系列；显式高级覆盖仍生效。声明与验收入口见[柱状图默认柱宽](docs/page-metadata/components/barChart.md#默认柱宽)。

6.41 将通用 DashboardToolbar 的呈现能力并入 IocHeader，只保留一个页头实现。新页面使用 `iocHeader`，旧 `dashboardToolbar` 只作兼容读取；布局、更多筛选、只读和说明见[唯一页头](docs/page-metadata/page.md#唯一页头641)。仅选年份使用共享 `periodModes:["year"]`，见[现有期间页面](pages/capabilities/filters/dashboard-period-filter.json)。 Header组件默认自带16px底部外间距，声明和兼容边界见同一页头模块。

6.47 为独立 `filterGroup` 增加 `display:"select"` 与 `align:"right"`，支持图表卡左侧按钮、右侧下拉共享查询筛选。入口 `/pages/filter-group-page`，声明与状态规则见[独立筛选](docs/page-metadata/components/filterGroup.md)。

6.46 补齐 `selection:{mode:"multiple",required:true}` 的非空多选：保持离散集合并拒绝清空，单选仍至多一个。七主题 IOC 合成验收入口为 `/ioc-header-review`；完整声明、主线迁移及证据边界见[筛选声明](docs/page-metadata/filters.md#ioc-业务批量场景与必选多选646)。

6.50 新增 `query.queryModes`：固定单选筛选选择完整静态 DQE 查询，允许不同分支提交不同完整查询并共享稳定结果字段契约；真实表路由须实测，原始字段不同使用6.57页面响应映射。Chart 保持同一个 `data.main`，其他筛选按当前分支绑定下推；演示 `/pages/query-mode-chart-demo`，声明与限制见[查询分支](docs/page-metadata/queries-and-bindings.md#query-modes)。

6.56 允许 DQE `output_dims` 中的现成计数或金额显式映射为页面数值度量，直接用于图表系列；不改写查询或自动聚合。声明与限制见[结果字段角色](docs/page-metadata/fields.md#dqe-output-measures)，验收入口 `/pages/stored-count-measures`。

## 从需求到页面

本地创作可先用页面 JSON 和指标说明 MD 识别组件用数、指标候选、取数条件与缺口；已有页面的局部呈现修改只查所涉属性，不要求重新读取全部数据协议。工具与证据分层见[本地 Skill 维护](docs/agents/local-authoring-skill-maintenance.md)，可观察页面见[指标匹配与字段呈现](pages/capabilities/layout/local-authoring-knowledge-demo.json)。匹配报告和查询候选是创作期产物，不新增页面字段，不等于真实查询已验证。

创作先取得受治理的数据上下文，确定性工具按页面构建规格装配完整页面，经过校验后交统一运行时。数据上下文、会话、执行身份与修订信息不写进页面文档。页面协议可表达、Authoring工具已支持、外部服务已接通分别举证。

新建页面先明确布局形态（Dashboard／Report）并显式声明 `layout`；外框含义与默认值见[页面与布局](docs/page-metadata/page.md#创作时显式选择布局形态)。本地创作 Skill 在生成前完成用户确认并按形态读取成型页面范式；这不新增资产类别或协议字段。

页面拥有命名数据源、筛选器和内容分区；组件的数据槽引用数据源，字段绑定引用结果字段契约。queryField属于查询字段空间，页面字段id和筛选器dimension不能靠同名隐式绑定。数据快照是运行状态，不是作者文档。

查询失败时，页面 UI 组件呈现空数据，具体错误打印到控制台，内部错误态及 `data-error` 事件保留。普通查询的 `totalCount` 与返回行数不一致仅告警，继续渲染已有行；详见[查询异常与结果总数](docs/page-metadata/data-sources.md#查询异常与结果总数)。

页面搭建的拖动手柄、组件清单拖动排序、蓝色选框、就地操作条与删除属于创作期交互，不新增页面协议字段。组件顺序与宽度仍由 `sections[].components`、`layout.span` 声明；空分区草稿与删除行为见[内容分区与布局](docs/page-metadata/sections-and-layout.md#页面搭建中的移动与删除)，验收页面为 `pages/platform/platform-canvas-experience.json`。

表格 select 列筛选统一从本表完整匹配结果取候选，保留其他条件并排除自身表头条件，不新增 scope 配置。候选分页和搜索独立于表格；已选值失配时保留。弹层按内容自适应宽度。语义及远程能力边界见[明细表候选值](docs/page-metadata/components/table.md#列筛选候选值)。

## 文档结构与维护分工

表格 `selection.writes` 通过声明的维度筛选器联动下游查询；有真实值的选择列与链接列显示下划线；显示缺省文案的单元格为普通文本，不响应选择、导航或详情点击。完整声明、查询订阅与内联入口边界见[单元格点击与筛选联动](docs/page-metadata/components/table.md#单元格点击与筛选联动)，可观察示例为 [table-cell-selection](pages/capabilities/table/table-cell-selection.json)。

表格的普通、预测矩阵与内嵌变体采用 TinyVue OS 网格外观，`reportCompact` 保持既有紧凑外观；范围及可观察示例见[表格渲染外观与变体](docs/page-metadata/components/table.md#渲染外观与变体)。此调整不新增协议字段。

本文件维护页面协议概览、版本边界与阅读导航。使用步骤与跨字段示例由专题文档维护，字段语义由模块维护，精确结构表从Schema生成；同一规则在所属文档维护后由其他入口引用。

| 文档层次 | 职责与入口 |
|---|---|
| 协议总览 | 本文件：页面组成、能力边界、版本与专题导航 |
| 参数与筛选专题 | [PAGE-PARAMETERS.md](PAGE-PARAMETERS.md)：维度与时间输入、初始化、页内筛选、期间文字、时间窗口和兼容用法 |
| 查询依赖专题 | [级联查询](docs/cascading-queries.md)：结果绑定、请求顺序、明细完整性、计算与完整示例 |
| 集成应用接入专题 | [报告导出与PDF下载](docs/report-export.md)：内置下载、后台编码、运行环境及失败处理 |
| 模块语义源与生成参考 | `docs/page-metadata/`维护作者语义；[模块参考](contracts/metriccanvas/page/reference/README.md)提供Schema生成的字段表、分支、合法示例和反例，同时分发到Authoring Bundle与Skill |

[机器索引](contracts/metriccanvas/page/reference/index.json)记录Schema位置、模块与示例覆盖；[完整Schema](contracts/metriccanvas/page/reference/schema.json)与参考正文同时生成。修改模块语义或示例索引后运行 `pnpm authoring:contracts`，不要手工维护分发副本。

6.56 支持 AI Summary 作为组合卡子组件；`scope: "container"` 显式总结直接所属区域，摘要须位于区域或页面正文最前。文字不进入分析输入，容器嵌套与既有数据规则不变。见 [AI 总结](docs/page-metadata/components/aiSummary.md)，验收入口 `/pages/report-ai-summary-regions`。

6.55 支持 DQE object 查询：显式 `object_type/output_fields/filter.fields`、对象时间字段绑定及共享交互/完整结果执行。见[对象查询契约](docs/page-metadata/queries-and-bindings.md#655-dqe-对象查询)，验收入口 `/pages/dqe-object-query-demo`。

## 快速查阅与验证

需要先观察效果再查配置时，使用[页面示例与能力索引](pages/README.md#能力索引)。页面试验场按布局、独立组件目录和数据与联动三个维度查找推荐场景；数据主线覆盖取数、条件、关联、交互、结果范围与跨页输出，并按页面实际 Dashboard／Report 布局形态筛选具体功能与直接相关的演示。同一场景跨入口复用，集中展示实际演示、目录 README 操作说明、数据关系、组件配置和当前文档试改。全部实际文件在 `/files` 中自动发现，可按文件夹、组件、布局和数据来源组合查找；移动文件保留 id 和 `/pages/<id>` 地址，无需逐页登记。推荐场景的归属信息属于开发工具，不进入页面协议或本地创作 Skill 的运行依赖；目录递归校验见[文件与目录校验](docs/page-metadata/validation.md#文件与目录校验)。

| 使用场景 | 规则与用法 | 完整页面或接入示例 |
|---|---|---|
| 声明页面结构、布局与组件 | [页面与布局](contracts/metriccanvas/page/reference/page.md)、[组件参考](contracts/metriccanvas/page/reference/components/README.md) | [完整页面示例索引](contracts/metriccanvas/page/reference/examples/README.md) |
| 打开时指定维度范围与报告期间 | [当前分层参数](PAGE-PARAMETERS.md#当前分层参数新页面) | [分层参数页面](packages/page/fixtures/contract-valid/grouped-params-page.json) |
| 顶部切换月份或日期并联动查询与文字 | [时间参数与顶部筛选](PAGE-PARAMETERS.md#时间参数与顶部筛选) | [报告页头时间筛选页面](pages/capabilities/filters/report-date-filter-example.json) |
| 先查对象集合，再查明细并关联展示 | [级联查询](docs/cascading-queries.md) | [商务SDT报告](pages/business/report/sdt/business-sdt-cascade-example.json) |
| 从其他页面通过 URL 打开指定 Tab（6.33） | [Tab 初值](docs/page-metadata/components/tabContainer.md#url-初始化页签633)、[链接传参](docs/page-metadata/actions-and-navigation.md#链接传参与目标页签) | [来源页](pages/capabilities/navigation/tab-url-source.json)、[目标页](pages/capabilities/navigation/tab-url-initialization.json) |
| 配置每张表的独立搜索与完整Excel导出 | [表格工具区](docs/table-export.md) | [表格工具区示例](packages/page/fixtures/contract-valid/table-toolbar-page.json) |
| 配置 IOC 公共页头（6.36） | [IOC 公共页头](docs/page-metadata/page.md#ioc-公共页头632) | [普通](pages/capabilities/ioc-header/scenarios/ioc-header-overview-demo.json)、[密集](pages/capabilities/ioc-header/scenarios/ioc-header-dense-filter-demo.json)、[详情](pages/capabilities/ioc-header/scenarios/ioc-header-detail-demo.json) |
| 配置 PDF / PNG 导出按钮（6.31） | [报告页头](docs/page-metadata/components/reportHeader.md#导出按钮631) | [导出图片](pages/capabilities/export/report-png-export.json)、[单张长图](pages/capabilities/export/report-png-long-export.json) |
| 配置 Report 工具带内置 PDF 下载与按钮文字（6.28） | [报告页头](docs/page-metadata/components/reportHeader.md#内置-pdf-下载628) | [内置PDF下载页面](pages/capabilities/export/report-pdf-export.json) |
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

`timePoint.min` 从6.24起声明可选的最早月份/日期，下限包含自身；选择器、手工提交、URL和筛选状态共同约束。字段语义见[筛选声明](docs/page-metadata/filters.md#时间点下限624)，可操作场景见[商务SDT单月报告](pages/business/report/sdt/business-sdt-report-monthly.json)。

## 级联查询

决策意见明细提供合同与商务记录合并分页的[合成预览说明](docs/page-metadata/components/table.md)及[运行入口](pages/capabilities/table/README.md#决策意见明细)：沿用现有 query、初始 order 与表格分页，通过 Playground 专用适配器演示全局排序和类型筛选；不增加通用合并源协议。

查询结果绑定自6.14起由下游 `source.query.resultBindings` 声明，读取上游原始维度集合形成查询输入；6.19起可用where独立筛选输入行而保留上游结果；6.20起允许查询分页窗口输入及任意列查询排序驱动依赖更新；与用户筛选状态分别管理。完整声明、执行顺序、边界及与 `pivot`/`joinAggregate` 的协作见[级联查询专题](docs/cascading-queries.md)，字段表见[查询定义与显式绑定](contracts/metriccanvas/page/reference/queries-and-bindings.md)。

逐字段配置讲解见[首轮查询、任意列排序与分页级联](docs/page-metadata/queries-and-bindings.md#配置解读首轮查询任意列排序与分页级联)：连起来配置字段映射、初始order、表格query分页与下游resultBindings。查询分页窗口提供本轮输入，totalCount表示业务总行数；sections顺序不决定查询执行顺序。

## 动态标题与文本组合（6.23）

所有文本取值位置可使用 `{"parts":[{"filter":"report-month","format":"period"}," 经营分析报告"]}`，主标题随已应用的时间筛选更新。片段也可引用打开时固定的参数，声明和缺值语义见[文本组合](docs/page-metadata/params-and-text-values.md#文本片段组合623)。完整验收统一在 [Report 时间选择与联动](pages/capabilities/filters/report-date-filter-example.json)，按文字联动、范围查询和未来时间限制分节展示。

## 多查询表格（6.22）

`pagedJoin` 组合查询源复用普通查询定义，通过稳定业务键投影到独占组合表；支持完整行域的排序、跨源数值范围、搜索与分页。声明及边界见[数据源](docs/page-metadata/data-sources.md#多查询组合源-pagedjoin622)和[表格](docs/page-metadata/components/table.md#数值范围和组合表622)。可运行验收页为 [multi-query-table.json](pages/capabilities/table/multi-query-table.json)，打开方式和逐步预期见[页面验收场景](pages/README.md#多查询表格)。页面使用本地 DQE Sim，不证明真实 DQE 能力。

新功能交付须按[必选验收要求](docs/agents/feature-acceptance.md)同步页面场景、本规范对应模块和本地创作 Skill。

验收页同时对照当前排序序号与固定预签金额排名：前者使用 `ordinalField`；后者由普通查询返回排名字段，再通过 `projection` 关联，切换排序和表格筛选时保留原名次。排名范围与并列规则由提供该字段的查询定义，组合源不隐式重算。

## 报告下载与完整导出

Report 顶层页头可用 `reportHeader.props.pdfExport`（6.28）启用引擎内置 PDF 下载，并按需配置按钮名称和文件名；声明、默认值与示例见[报告页头](docs/page-metadata/components/reportHeader.md#内置-pdf-下载628)。标准下载由引擎按原有布局连续保存，采用零外边距；主线程分批准备画面，Web Worker负责编码，移除取消按钮和旧withExportView入口。整页下载保留成功取得的内容，部分取数失败不阻断其余内容；下载成功不代表数据完整。下载范围、限制与演示统一见[报告导出与PDF下载接入](docs/report-export.md)。

Report顶层页头统一声明`exportButtons`（6.31），每项配置`format`、`label?`、`filename?`、`scale?`；一项一个按钮，点击直接下载。PDF默认2倍、支持2/3/4倍；PNG默认3倍、支持3/4倍，始终只输出一张完整PNG。不支持的scale值按未配置处理，回退对应默认倍率，不阻止打开或下载。旧`pdfExport`/`pngExport`保留读取兼容；声明与限制见[报告页头](docs/page-metadata/components/reportHeader.md#导出按钮631)。

## 版本、初始化与持久化

平台云宝创作入口的页面 ID 与会话 ID 分别定位页面资产与对话。每轮自然语言操作使用前端当前完整工作副本，包括未保存修改；会话、锁和可访问路径不写入页面协议，也不增加 Schema 版本。左上角标题直接更新 `meta.title` 并保留其他本地修改。详见[页面与创作身份边界](docs/page-metadata/page.md)、[接入说明](docs/pangu-agent-authoring.md)与[可观察场景](pages/platform/README.md#云宝创作与最新工作副本)。

新文档写当前作者版本和 `layout`。已支持版本的 `layoutForm` 在输入边界兼容读取，双字段同时出现拒绝；布局兼容规范化不自动升级其他能力。历史修订先核验原文hash，迁移结果另存新修订。详见[布局迁移](docs/page-metadata/layout-migration.md)。

使用 local-authoring 继续开发旧页面时，先运行独立 `upgrade-page.mjs` 检查；可迁移时保留原始字节与报告，再升级工作文件并继续原任务。升级规则、版本范围和语义缺口见[旧页面继续开发](docs/page-metadata/page.md#旧页面继续开发与显式升级)，可观察场景见[升级示例](pages/capabilities/layout/README.md#旧页面升级后继续开发)。此创作期能力不扩大运行时的旧版本读取范围。

MC 内容包提供相同产品实现的版本检查和显式升级能力，输出读取兼容性、能力下限、升级结果及未验项；内容包、页面协议和模板分别记录版本。整体替换后先检查旧文件，迁移写入新目录，保留原始字节与报告，由 Skill 决定采用。该流程不改变既有保存、发布或旧修订读取策略。

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

查询结果中的 `number` / `money` 度量采用单元格容错：异常值归一化为 `null`，数字字符串转换，保留全部数据行；`nullable: false` 的数值度量缺失改为非阻断告警。初始行、动态响应、嵌套数值明细和组合结果的规则一致；维度、字段映射及结构仍严格校验。完整规则见[查询数值容错](docs/page-metadata/fields.md#查询数值度量的容错)，验收见 [query-numeric-tolerance](pages/capabilities/query/query-numeric-tolerance.json)。

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

6.34 支持 Dashboard 顶层指标卡 `layout.before` 连接文字，双侧间距缺省 8px，保留外层 12 列；整组自动拉宽至所占列宽，以 1px 灰边、16px 圆角白底区域包裹，每张小卡保留独立白底灰边，文字双侧 gap 固定；完整场景见 [指标卡连接排布](pages/capabilities/layout/metric-card-equation.json)。

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

7.11 `aiSummary`（独立摘要完整复用 SDT 渐变背景、白框、浅紫内容区；6.56：组合卡内摘要、显式 scope: container 与顶部结构约束；6.51：Report 双模式、区域范围、异步调用与会话缓存；6.52：数据源 ID 直接引用；6.53：正式命名 relatedDataSources；6.54：非空 body 直接展示，否则根据提示词和范围生成，无需 mode） → [模块参考](contracts/metriccanvas/page/reference/components/aiSummary.md)。

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
- `detailViews`：snapshot 复用快照，query 以必需显式绑定隔离取数；`openDetail.view` 与旧 `fields` 互斥。表格列可声明互斥的独立 `openDetail` / `navigate`。 含表格的详情视图自动使用宽版弹窗／抽屉：容器宽度的90%，最大1440px，窄屏保留32px宽度余量；加载、空结果和错误时保持一致。规则见[详情表格浮层宽度](docs/page-metadata/components/table.md#详情表格的浮层宽度)，无需新增元数据字段。
- `timeFill` / `selectField`：明确日/月范围补齐和有限模式字段选择。
- 柱图 series 的 `kind` / `axis`：柱线混合、轴单位校验。
- 字段绑定 `missingText`：消费者缺失文案，数值类型与刻度不变。

具体约束见 [ADR-0096](docs/adr/0096-ioc-view-state-and-post-query-presentation.md)。6.11继续可读，但使用上述能力的文档必须写6.12。

所有时间选择器默认禁止未来时间，覆盖点、范围、Dashboard 年／季／月及精确时间输入；URL 和手工输入同样受限。当前自然期间保持完整查询范围，详见[时间选择的默认上限](docs/page-metadata/filters.md#时间选择的默认上限)。

`timePoint.disableFuture: true` 从6.25起禁止未来月份／日期，当前期间可选；上限随本地当前日期推进，控件、手工输入、URL与参数初始化共同约束。见[禁止未来时间](docs/page-metadata/filters.md#禁止未来时间625)及[交互验收页](pages/capabilities/filters/report-date-filter-example.json)。

6.27 增量：Dashboard 顶部 timeRange 的年／季／月／近一年选择形态，声明、状态及查询规则见[期间筛选](docs/page-metadata/filters.md#dashboard-期间选择627)。
6.29 曾引入图表 `props.filter`；该旧声明现已统一迁移为独立 `filterGroup`。固定按钮组可控制多个查询消费者，详见[独立筛选按钮组](docs/page-metadata/components/filterGroup.md)。

6.37 新增[业务筛选](docs/page-metadata/filters.md#business-filters)：单多选、封闭枚举、结构树、候选依赖与hint；共用执行入口先核验当前候选再复用初始结果或查询，不在页头内另建规则解释器。

6.38增加USD静态money、非递归FieldBinding.byFilter、numberRange约束/单位/预设及metricByFilter。参见[金额范围](docs/page-metadata/filters.md#amount-range)、[字段选择](docs/page-metadata/field-bindings-and-formats.md#field-selection)和`pages/capabilities/ioc-header/scenarios/ioc-header-currency-demo.json`。不同币种结果保持独立静态字段，不提供前端换汇；旧普通相等范围兼容。

## 6.39 复杂时间与可信期间输入

共用筛选新增 `timeRange.display:"modes"`、完整静态 `query.timeModes`、时间 `presets`、`availability` 和动态维度 `candidateWindow`；边界见[筛选语义](docs/page-metadata/filters.md)、[查询绑定](docs/page-metadata/queries-and-bindings.md)。实际验收为 `pages/capabilities/ioc-header/scenarios/ioc-header-time-modes-demo.json`、`ioc-header-time-presets-demo.json`、`ioc-header-availability-demo.json`、`ioc-header-calendar-window-demo.json`，均为本地合成数据。旧年季月/近一年、详情单月、离散月份和 datetime 保持各自语义。可信期间事实由 RuntimeView/embed 的可选稳定 `displayInputs` 源提供，不写入 Page/参数/URL；本批不开放 Condition、任意对象路径或权限表达式。

### 6.40 跨页传值

导航可显式配置`validateTargetInputs:true`，集成应用提供目标输入投影；校验row/param/filter映射，拒绝缺必需值、类型/粒度不兼容及无目标能力，普通URL兼容。目标独立校验并等待当前候选；显式开启`strictURLInputs:true`时，非法筛选URL不回退默认查询。见[交互与导航](docs/page-metadata/actions-and-navigation.md)。无视图恢复，B6挂起。

`strictURLInputs:true`由页面显式开启，兼容规范化升版本不自动开启。来源和目标可分别选择该策略；本批三个验收页均开启。受控编辑使用`set_url_input_validation`，enabled=false仅删除该标记。
条件呈现与动作资格见[条件规则](docs/page-metadata/conditions.md)：6.35就地声明visibleWhen/enabledWhen，父级约束后代，子项不反推父级。

表格静态搜索选项（6.42）：`props.toolbar.search.options` 声明静态枚举、每项单文本字段与 placeholder，`defaultValue` 可选。切换保留关键词并立即精确搜索；清空保留选项；与既有条件 AND，导出沿用已提交状态。旧 `fields/placeholder` 继续包含匹配。声明与限制见[明细表](docs/page-metadata/components/table.md#静态搜索选项642)，可观察页面见[字段切换示例](pages/capabilities/table/table-search-options-demo.json)。

6.43：维度下拉默认支持本地搜索，`searchable:false` 关闭；普通树可声明 `treeSelection:descendants|independent|leaf`。`selection` 继续使用6.37的对象协议，`level`结构树不变。见[筛选声明](docs/page-metadata/filters.md)与IOC选择控件场景。

6.44新增一层行内子表格，声明与限制见[表格：行内子表格](docs/page-metadata/components/table.md#row-expansion)。默认仅内容和分页，父行嵌套明细与按父行查询分页显式分支；模板取数与状态按展开实例隔离，导出范围待确认。

标题按页面layout分别呈现：Dashboard分区标题与text.heading使用黑色16px左对齐无装饰标题；Report保留独立标题层级。plain只表示分区无外壳，不表示共用标题。参见[分区与布局](docs/page-metadata/sections-and-layout.md)及[看板标题验收](pages/capabilities/layout/dashboard-title-styles.json)、[报表标题验收](pages/capabilities/layout/report-title-styles.json)。

6.45 独立 `filterGroup` 将固定单选按钮组从图表属性提升为可布局组件，支持 Dashboard 正文、组合卡、多个查询消费者和统一显隐。旧 `chart.props.filter` 统一迁移，不保留兼容入口。声明、边界与验收见[筛选按钮组](docs/page-metadata/components/filterGroup.md)。

## 表格自动序号（6.48）

普通表格通过 `props.rowNumber: {}` 开启独立序号列，可设置标题、宽度和左固定；排序筛选后重新编号，跨页连续，完整导出从1开始。声明及边界见[表格自动序号列](docs/page-metadata/components/table.md#自动序号列648)，可运行场景为 [table-row-number](pages/capabilities/table/table-row-number.json)。

Tab 6.49 支持普通内容与组合卡，显式 `props.contentLayout: "grid"` 复用12列栅格，旧纵向布局兼容；首次进入取数、切换保活、活动项URL恢复及Report全展开规则见[Tab容器](docs/page-metadata/components/tabContainer.md)。可观察场景：[tab-mixed-content](pages/capabilities/layout/tab-mixed-content.json)。

Dashboard白底容器中的指标卡自动补充统一边框，组合卡只保留外框；声明与呈现边界见[指标卡](docs/page-metadata/components/metricCard.md)。

普通柱图及组合图的柱系列默认16px，`reportForecast` 保留40px，见[柱状图](docs/page-metadata/components/barChart.md)。纯指标组合采用现有 `metricGrid` 自适应高度。

指标卡与筛选的同框布局复用内容分区：card 提供白底无边框外观，section.title 在上，filterGroup 在其下左对齐，Before 四卡行自适应铺满所占列。连接排布盒在 card 内不重复绘制外框。见[指标连接排布](docs/page-metadata/sections-and-layout.md)与 `/pages/metric-card-equation`。

6.57 查询分支响应映射：`queryModes.cases.*.fieldMappings` 在页面端连接不同原始字段与稳定结果字段；普通指标保留名称字符串，不支持 `{name,alias}`。见[查询定义与绑定](docs/page-metadata/queries-and-bindings.md#query-modes)。

MC 内容包随本协议同步生成，包含同源字段语义、规则、例子、版本/迁移及工具契约；入口见 [MC 维护与验收](docs/agents/local-authoring-skill-maintenance.md#mc-同步完成条件)。本批未新增页面字段或改变页面语义，完整性与旧页诊断的可观察场景见 `/pages/mc-content-layout-demo`；静态成功、引擎回放与真实部署分别报告。

## 表格原文容错与独立置顶行（6.60）

表格的异常标量保留原文并告警，本地升降序统一将空白及纯横杠排最后；有效类型值继续用于计算和交互。props.pinnedTop 声明独立完整查询槽，列级 pinnedTop 显式绑定汇总字段；每页首行展示、无序号、不占分页计数，汇总失败不阻塞明细但阻止完整 Excel 导出。声明和限制见[表格模块](docs/page-metadata/components/table.md)，结果证据见[字段契约](docs/page-metadata/fields.md)。可观察页面为 table-value-tolerance、table-missing-sort、table-pinned-summary，均为合成数据。

6.61 新增 `pagedUnion` 分页合并源：按成员显式字段/常量/null 投影统一列，逐行保留全部记录，在完整匹配范围整体排序、搜索、筛选、计数、分页和导出；表格可按来源选择详情导航。声明、执行限制与真实接入边界见[数据源](docs/page-metadata/data-sources.md#paged-union)和[表格](docs/page-metadata/components/table.md#source-navigation)，验收页为 [multi-source-table.json](pages/capabilities/table/multi-source-table.json)。

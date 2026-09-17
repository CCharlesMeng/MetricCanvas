# MetricCanvas 页面元数据规范

页面元数据是统一运行时消费的声明式JSON文档。当前作者协议为 **6.4**，公开读取兼容5.0—5.4及6.0—6.4；读取5.x后规范化为6.x运行态文档，新文档仍只写当前6.x版本。结构事实由 `packages/page/src/schema/` 单向导出；未声明属性不被接受。

## 从需求到页面

创作先取得受治理的数据上下文，确定性工具按页面构建规格装配完整页面，经过校验后交统一运行时。数据上下文、会话、执行身份与修订信息不写进页面文档。页面协议可表达、Authoring工具已支持、外部服务已接通分别举证。

页面拥有命名数据源、筛选器和内容分区；组件的数据槽引用数据源，字段绑定引用结果字段契约。queryField属于查询字段空间，页面字段id和筛选器dimension不能靠同名隐式绑定。数据快照是运行状态，不是作者文档。

## 快速查阅与验证

维度与时间参数的统一现行说明见[页面参数：维度与时间](PAGE-PARAMETERS.md)，包含概念、字段用途、查询绑定、时间窗口及保存行为。

1. 从[模块参考](contracts/metriccanvas/page/reference/README.md)按任务或JSON路径定位；[组件选型](contracts/metriccanvas/page/reference/components/README.md)说明用途与数据形状。
2. 选择模块内的完整JSON例子，保留其显式数据/参数/筛选依赖；字段表中的联合分支分别阅读，不能合并必填项。
3. 使用仓库现有 `pnpm validate <页面 JSON 所在目录>` 进行完整页面校验。静态例子不证明真实DQE或SSE成功；执行结果仍须经过受控端口。

[机器索引](contracts/metriccanvas/page/reference/index.json)记录Schema位置、模块、枚举和示例覆盖；[完整Schema](contracts/metriccanvas/page/reference/schema.json)与参考正文同时生成。作者语义位于 `docs/page-metadata/`，详细字段表只在生成参考维护一份。

## 版本、初始化与持久化

新文档写6.4和layout；6.0的layoutForm在输入边界兼容读取，双字段同时出现拒绝。规范化保留已支持版本的能力边界，旧文档迁移另存新修订；先核验历史原文hash，再规范化。详见[布局迁移](docs/page-metadata/layout-migration.md)。

页面参数是一次初始化的不可变输入，筛选器是页内可变状态。6.2维度参数支持单值/多值和显式query.paramBindings/filter.initialParam；实际执行值与URL初始化的边界见[参数与文本](contracts/metriccanvas/page/reference/params-and-text-values.md)及[执行消费契约](docs/plan/authoring-tickets-126/t18-execution-contract.md)。运行时替换后的副本不作为模板原文保存。

Schema元数据另见[数据上下文规则](docs/schema-metadata.md)，页面构建规格与工具能力另见[Authoring Bundle](metriccanvas-authoring/README.md)。

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

6.3 新增确定性时间参数与查询窗口绑定。日期/月取值固定于初始化，按指定时间查询，不回退最新期；结构、窗口边界与实施限制见[时间参数](docs/page-metadata/time-parameters.md)。

6.4新增 `yearToDate` / `monthToDate` 具名窗口，不带unit，终点为绑定参数的报告基准期；保留6.3旧窗口写法兼容。

# 页面参数：维度、时间与页内筛选

<a id="页面参数维度与时间的现行方案"></a>

本文是页面参数的使用专题，承接[页面元数据总规范](PAGE-METADATA.md)。当前作者协议为 **6.16**；版本与可读范围以总规范及生成契约为准。本文先说明当前分层参数、打开与保存、顶部时间筛选和共享窗口规则，再说明程序化提取，最后集中保留旧数组参数的兼容用法。字段表由Schema生成，见[参数参考](contracts/metriccanvas/page/reference/params-and-text-values.md)。

## 阅读入口

| 任务 | 章节 |
|---|---|
| 新建页面声明维度与时间输入 | [当前分层参数](#当前分层参数新页面) |
| 指定另一个业务范围或期间并保存 | [打开、保存与显示](#打开保存与显示分层参数) |
| 用参数初始化顶部日期筛选并联动查询与期间文字 | [时间参数与顶部筛选](#时间参数与顶部筛选) |
| 同一基准期驱动当月、全年、近N期和累计窗口 | [查询时间窗口与指标口径](#查询时间窗口与指标口径) |
| 提取、填值或显式迁移参数 | [程序化提取与填值](#程序化提取与填值) |
| 读取与维护旧数组/default/paramBindings文档 | [旧数组参数兼容](#旧数组参数兼容) |

## 当前分层参数（新页面）

新结构为 `params: { query?: { dimensions?: [...], times?: [...] }, display?: [...] }`。分层依据是**消费位置**：`params.query` 下的输入落进 DQE 请求体，`params.display` 下的只被文本取值和导航消费，哪儿也不落。两层共享同一个 ID 空间，引用处只写 id，不写所在层。各层可省略，至少声明一个参数。

`query.dimensions` 使用 `id/dim_name/dim_value_list`；`query.times` 使用 `id/granularity/start/end`；`display` 每项为 `id/type/value`，保留标题等 string/number/boolean 输入。

新参数不使用 default；required 缺省 true。模板省略实际值，时间起止必须成对填写。值不全时不能执行，原始文档保持不变。

### 时间输入怎样被查询消费

**一个时间输入就是一个包含区间，单点写成 `start` 与 `end` 相同。** 查询侧在 `filter.time` 上整段引用它，是否派生由引用决定：

```json
"time": { "period": "month", "is_aggregate": false, "param": "report-period" }

"time": { "period": "month", "is_aggregate": true, "param": "report-month",
          "window": { "kind": "lastN", "unit": "month", "n": 12 } }
```

不写 `window` 就原样用参数值的起止；写了 `window` 就以参数值为基准点派生区间，此时被引用的输入必须是单点。「点 / 区间」与「派生 / 原样用」是两条独立的轴，同一个页面里两种写法可以共存，一个基准月因此仍能驱动整份报告的多个窗口。窗口取值见[查询时间窗口与指标口径](#查询时间窗口与指标口径)，两条路共用同一套日历算术。

维度在 `filter.dims[].dim_value_list` 上原位引用 `{param: id}`；`period` 与 `is_aggregate` 始终留在查询侧。引用不得与筛选绑定或旧 `paramBindings` 共同控制同一条件，也不得与查询体里的字面量起止并存。

完整字段、引用、URL 与兼容规则见[生成的参数参考](contracts/metriccanvas/page/reference/params-and-text-values.md)；[正交化设计背景](docs/evidence/page-parameters/2026-09-21-page-params-orthogonal-shape.md)保留当时形状与spike，完整页面见[时间参数示例](packages/page/fixtures/contract-valid/grouped-params-page.json)。URL 里时间是纯文本——单点写 `?report-month=2026-03`，区间写 `?report-period=2026-01..2026-06`；维度仍使用重复键；显式非法输入不回退保存值。

### 当前声明的四个位置

| 位置 | 职责 |
|---|---|
| `params.query.{dimensions,times}`、`params.display` | 声明输入与保存的实际值；无值模板省略值 |
| DQE请求体中的原位 `{param: id}` 引用 | 将固定输入用于明确的维度条件或时间窗口 |
| 文本位置的 `{param: id, format?: ...}` | 显示打开时已确定的输入 |
| `filters.initialParam` 与查询 `filterBindings` | 参数只初始化筛选器，随后由可变筛选状态控制查询 |

### 参数与页内筛选怎样配合

筛选器用 `initialParam` 引用参数初值，与筛选器的 `default` 互斥；初始化后由筛选状态控制查询，不回写参数。维度筛选初始化需要显式的 `paramBindings` 与 `filterBindings` 指向同一目标和初值来源，层级维度初值落在 `defaultLevel`；时间筛选初始化直接使用 `filterBindings`，完整配置见[时间参数与顶部筛选](#时间参数与顶部筛选)。

同一查询条件只能有一个有效来源。参数原位引用不能再与筛选绑定或旧 `paramBindings` 共同控制同一目标；维度初始化的配套绑定规则见[查询定义与绑定](contracts/metriccanvas/page/reference/queries-and-bindings.md)。时间筛选不再叠加固定时间参数绑定。

## 打开、保存与显示分层参数

参数在页面实例初始化后固定，页内筛选不会回写参数。URL或调用方输入只影响本次实例；改变下次打开的保存值，需要显式保存参数的 `dim_value_list`、`start/end` 或 `value`。执行用副本中的已解析条件不作为参数模板原文保存。

| 输入 | URL表示 | 未提供时 |
|---|---|---|
| 维度集合 | `?regions=EU&regions=APAC` | 使用保存的 `dim_value_list` |
| 单点月份或日期 | `?report-month=2026-03` | 使用保存的成对 `start/end` |
| 月份或日期范围 | `?report-period=2026-01..2026-06` | 使用保存的成对 `start/end` |

分层参数的显式非法输入不回退保存值，缺必需输入时不能执行。执行回执已核验的实际输入与筛选值为初始化权威，不再次用URL或模板值覆盖。

参数文字用 `{param:"report-period",format:"period"}` 显示固定期间。需要文字随读者筛选变化时，用 `{filter:"report-period-filter",format:"period"}`；两者分别引用参数ID和筛选器ID。精确格式与缺值规则见[文本取值参考](contracts/metriccanvas/page/reference/params-and-text-values.md)。

## 时间参数与顶部筛选

页面参数确定打开时的输入；时间筛选器保存页内可变状态。需要读者切换期间时，应同时声明筛选器、查询绑定、控件位置和期间文字。以下用法对应报告页头 `reportHeader`；dashboard 的顶部工具栏消费页面筛选声明，布局形态本身不能代替查询绑定。

### 配置步骤

1. 在 `filters` 声明 `timeRange` 或 `timePoint`。范围用 `precision`，单点用 `granularity`；月份值使用 `YYYY-MM`，日期值使用 `YYYY-MM-DD`。
2. 设置初值。可以用 `default`，也可以用 `initialParam` 引用 `params.query.times` 中精度匹配的必需时间参数，两者互斥。单点筛选要求参数 `start` 与 `end` 相同；参数只提供初值，后续筛选不回写参数。
3. 在每个需要联动的页面数据源的 `source.query.filterBindings` 中绑定筛选器。范围使用 `{target:"time"}`；单点驱动时间窗口时使用 `{target:"time",window:...}`。同一查询时间目标不能再有固定起止或参数引用。
4. 在 `reportHeader.props.filterIds` 按顺序引用筛选器，将控件放在封面上方工具带，宽容器右对齐、窄容器换行。
5. 要显示当前已应用期间，在 `reportHeader.props.asOf.value` 显式写 `{filter:"筛选器id",format:"period"}`。`filterIds` 只决定控件位置；字面量保持静态，`param` 引用仍显示打开时的参数值。

### 月份范围完整页面与配置摘录

[完整页面 JSON](pages/report-date-filter-example.json)包含参数、筛选器、DQE查询、结果字段契约、报告页头和月度明细表。以下摘录关键配置；省略的字段契约、查询体和表格声明请从完整页面读取，不能将此片段单独提交校验。

```json
{
  "schemaVersion": "6.15",
  "params": {
    "query": {
      "times": [
        {"id": "report-period", "granularity": "month", "start": "2026-01", "end": "2026-06"}
      ]
    }
  },
  "filters": [
    {"id": "report-period-filter", "type": "timeRange", "precision": "month", "label": "报告期间", "required": true, "initialParam": "report-period"}
  ],
  "dataSources": {
    "monthly-usage": {
      "source": {
        "type": "query",
        "query": {
          "filterBindings": {"report-period-filter": {"target": "time"}}
        }
      }
    }
  },
  "sections": [
    {
      "id": "header",
      "container": "plain",
      "components": [
        {
          "id": "report-header",
          "type": "reportHeader",
          "layout": {"span": 12},
          "props": {
            "title": "Tokens 月度用量报告",
            "filterIds": ["report-period-filter"],
            "asOf": {"label": "当前期间", "value": {"filter": "report-period-filter", "format": "period"}}
          }
        }
      ]
    }
  ]
}
```

该示例保留6.15能力版本；新建页面使用当前作者版本。页头日期筛选与月份范围要求至少6.13，显式筛选文本引用要求至少6.15。6.13/6.14页面继续按旧期间派生规则读取，不应将新版文本引用直接加进旧版本文档。

月份或日期范围使用 `timeRange`；单个月份或单个日期使用 `timePoint`，如 `granularity:"month"` 配合 `window:{kind:"period",unit:"month"}`。单点也可通过显式窗口驱动当年、近N期或年初至基准期查询；各查询独立声明窗口，不改变指标统计口径。

### 已应用期间与页面文字

读者提交完整合法的日期输入后，绑定查询与期间文字使用同一已应用筛选值；输入草稿不改变查询，未绑定的查询不重查。`{param: id}` 显示打开时的参数值，`{filter: id, format: "period"}` 显示当前期间；区间显示为“开始 至 结束”，两端相同只显示一个值。静态文字保持静态。

操作与5173预览入口见[页面试验场](apps/playground/README.md#时间筛选与级联查询示例)，PDF下载与捕获期间规则见[报告导出接入](docs/report-export.md#与时间筛选配合)。字段表分别见[报告页头](contracts/metriccanvas/page/reference/components/reportHeader.md)、[筛选声明](contracts/metriccanvas/page/reference/filters.md)、[查询绑定](contracts/metriccanvas/page/reference/queries-and-bindings.md)与[文本取值](contracts/metriccanvas/page/reference/params-and-text-values.md)。

<a id="5-时间窗口与指标口径的分界"></a>
<a id="报告基准期查询时间窗口与指标口径"></a>

## 查询时间窗口与指标口径

| 概念 | 回答的问题 | 示例 |
|---|---|---|
| 报告基准期 | 本次看哪一期？ | 时间参数或已应用单点时间筛选为2026年3月 |
| 查询时间窗口 | 读取哪些期间？ | 当月、最近12个月、所在全年 |
| 指标统计周期与计算口径 | 一个值代表什么、如何计算？ | 月流水、年累计流水、月同比 |

下表的日历窗口同时适用于分层参数原位引用、单点时间筛选绑定和旧数组参数绑定；引用位置由各自声明分支决定。范围输入直接使用起止，带窗口的输入必须是单点。

**窗口不改变指标口径。** 如果数据服务在3月分区中已经返回年累计值，查询3月即可；不能因名称含“年累计”就改查1—3月再求和。同比、环比、预测版本也不会因时间绑定而自动计算。

### 已支持的窗口

| `window` 示例 | 含义 | 输入与结果 |
|---|---|---|
| `{kind:"period",unit:"month"}` | 基准所在完整月 | 月参数2026-03 → 2026-03 |
| `{kind:"period",unit:"year"}` | 基准所在完整自然年 | 月参数2026-03 → 2026-01至12 |
| `{kind:"period",unit:"year",offset:-1}` | 上一个完整自然年 | 月参数2026-03 → 2025-01至12 |
| `{kind:"period",unit:"day",offset:-1}` | 基准日前一天 | 日参数2024-03-01 → 2024-02-29 |
| `{kind:"lastN",unit:"month",n:12}` | 含基准月的最近12个月 | 2026-03 → 2025-04至2026-03 |
| `{kind:"lastN",unit:"day",n:7}` | 含基准日的最近7天 | 2024-03-01 → 2024-02-24至2024-03-01 |
| `{kind:"yearToDate"}` | 年初至基准期 | 月参数2026-03 → 2026-01至03 |
| `{kind:"monthToDate"}` | 月初至基准期 | 日参数2026-03-15 → 2026-03-01至15 |

规则：

- `period` 的单位是 `day/month/year`，`offset` 按单位移动完整周期，缺省0。
- `lastN` 的 `n` 是正整数，单位与输入精度一致：月参数按月、日参数按日。
- `yearToDate` / `monthToDate` 表示年初/月初至报告基准期，不读取系统今天，也无需 `unit`。
- 月参数不能推断某一天；日参数可取所在完整月或年，返回日期起止。
- 起止包含。计算只依赖输入和规则，不读取系统当前时间，也不受进程时区影响。越出年份范围时报错。

### 无数据如何处理

**按指定期间查询，无数据就呈现空结果，不回退到另一月份或最新可用期。** 服务故障、权限错误或查询被拒绝仍显示对应查询错误，不当成无数据。

当前能力不包含最新可用期自动获取、财年/周规则、Tab切换查询粒度或历史预测版本选择。物理分区、年度目标字段和财经接口参数的映射仍由数据服务契约确定；年度目标值不等于全年时间窗口。

## 程序化提取与填值

`extractPageParams(page, context)` 从已验证查询提取维度取值、固定时间区间与已有时间筛选链路。`context.baseline` 标识精确基线；同名维度不自动共享，跨查询合并依赖调用方提供的维度身份。候选不会自动改写页面。日期查询合并依赖精确基线绑定的 `timeIdentities`；标量日期字段依赖 `timePointFields` 证据，缺证据时保持独立身份，不根据日期字面量猜测关系。

`applyPageParamSelection(extraction, selectedIds, textReplacements)` 在副本上生成当前分层参数与原位引用，并返回 `originalValues`。它检查原值回填后的 DQE 请求与来源等价，移除内嵌初始行；含原值的组合文本须显式提供替换，不能全局字符串替换。已由筛选绑定控制的维度不提取为固定参数；已有旧数组参数必须先显式迁移，不能在提取时覆盖。

日期提取确认原子生成时间参数、筛选器、查询绑定、页头位置和显式期间引用；单点驱动多个窗口时保留明确的 `window`。已有静态文字和已声明文本引用保留，只有对应日期字面量可以替换为期间引用。

`resolvePageParams(page, suppliedValues)` 返回保留引用的填值文档 `document` 和用于执行的副本 `resolvedPage`。维度输入为字符串数组，时间输入为 `{start,end}`，精度来自声明；缺失、未知或非法显式值都拒绝执行。未填值模板结构合法不等于可执行。

`migrateParamBindings(page)` 显式迁移旧数组和查询绑定，写出当前版本，并保留来源不变。窗口移至 `filter.time.window`；仍由筛选器控制的查询目标保留原绑定。可选查询参数或无法确定唯一维度字段的旧输入拒绝迁移。`filter.time.start/end` 下的 `{param,part}` 写法已退役，不作为兼容输入。

这些 API 不保存或发布页面，不证明真实 DQE、Relay 或 Java 服务已完成接线。

## 旧数组参数兼容

以下章节仅描述兼容的旧数组分支。`default`、`multiple`、`type:"time"` 与 `paramBindings` 的写法和限制不用于当前分层参数；维护旧页面时仍受总规范的可读版本和能力下限约束。窗口算术由前文统一说明，旧章节锚点保留。

### 1. 一句话理解

**页面参数保存“这次看什么”的输入；每个查询明确声明如何使用这些输入。**

例如，一份流水分析报告保存两个参数：“代表处＝北京代表处”“报告月份＝2026-02”。打开时可以传入另一组值，得到另一个页面实例：

- 代表处参数让绑定它的查询增加代表处条件。
- 报告月份让绑定它的查询生成当月、全年或其他声明的查询时间窗口。
- 页头可引用同一组值，显示本次实例的代表处与报告月份。

声明参数不会自动影响全页。**只有显式绑定的查询或引用它的文本才受影响。**

### 2. 四个位置分别做什么

| 位置 | 职责 | 可以理解为 |
|---|---|---|
| 页面顶层 `params` | 声明参数名称、类型、必需性和保存的默认值 | 输入清单 |
| 查询中的 `paramBindings` | 指定参数如何作用于这个查询 | 输入的使用说明 |
| 文本位置的 `{ "param": "参数id" }` | 显示该参数的实际值 | 页面上的取值引用 |
| `filters` 与查询的 `filterBindings` | 管理页面打开后的可变筛选状态 | 页内交互 |

参数在一次初始化后固定。修改页内筛选不会反向修改参数；使用另一组参数，需要打开另一实例或由宿主重新初始化。跨页链接可以显式携带参数。

### 3. 参数怎样保存

以下是页面顶层的局部片段，不是完整页面：

```json
{
  "schemaVersion": "6.5",
  "params": [
    {
      "id": "representative-office",
      "type": "dimension",
      "required": true,
      "label": "代表处",
      "default": "北京代表处"
    },
    {
      "id": "report-month",
      "type": "time",
      "granularity": "month",
      "required": true,
      "label": "报告月份",
      "default": "2026-02"
    }
  ]
}
```

| 字段 | 含义 | 必需性 |
|---|---|---|
| `id` | 稳定标识；URL、查询绑定、文本引用通过它找参数 | 必填；页面内唯一，不与筛选器id重复 |
| `type` | 参数类型：维度为 `dimension`，时间为 `time`；也保留 `string/number/boolean` 标量类型 | 必填 |
| `required` | 初始化时是否必须得到有效值；默认值也可以满足要求 | 必填 |
| `label` | 人能读懂的参数名称，用于缺值提示等 | 可选 |
| `default` | 没有外部输入时采用的保存值；非法输入的处理见[URL初始化规则](#url初始化规则) | 可选 |
| `multiple` | 维度参数是否多值；缺省为单值 | 仅维度参数可用 |
| `granularity` | 时间输入精度，`month` 或 `date` | 时间参数必填 |

`label` 不参与查询、不生成筛选控件，也不自动成为页头标签。“代表处”是参数名称，“北京代表处”是取值，两者用途不同。删掉 `label` 不影响正常查询，但缺值提示更难理解。

`required` 和 `default` 不重复：前者要求“必须有值”，后者提供“未传值时用什么”。每个声明参数必须至少有一个消费者，不能只声明而不使用。

### 4. 维度参数

维度参数回答“看哪个业务范围”，例如代表处、地区。声明、查询绑定与页内筛选初值分别配置。

#### 维度的值

维度值使用数据服务认可的稳定字符串值。若服务使用编码，应保存编码，不能根据中文显示名猜测编码。本报告演示使用“北京代表处”作为取值。

多值声明示例：

```json
{
  "id": "regions",
  "type": "dimension",
  "multiple": true,
  "required": true,
  "default": ["EU", "APAC"]
}
```

多值不能包含重复值、空字符串，也不能用空数组表示有效默认值。可选参数无值时，应省略 `default`；对应查询不增加该参数条件。权限限制仍由数据服务执行。

<a id="4-查询怎样消费参数"></a>

#### 维度查询绑定

绑定位于 `dataSources.<数据源id>.source.query.paramBindings`。下面是查询的局部片段，键为已声明的维度参数 `id`：

```json
{
  "paramBindings": {
    "representative-office": {
      "target": "dimension",
      "queryField": "代表处"
    }
  }
}
```

`target: "dimension"` 生成 `queryField` 指定的维度条件。例如“北京代表处”变成 `dim_name: "代表处"`、`dim_value_list: ["北京代表处"]`。这是结构化绑定，不是将字符串任意插入SQL。不同数据源可绑定同一参数；同一查询中的同一维度目标只能有一个参数来源。

<a id="6-参数与页内筛选怎样配合"></a>

#### 旧维度参数与页内筛选

维度参数可以只负责打开时的初始选择：

1. 维度筛选器用 `initialParam` 引用维度参数，不再另写 `default`。层级维度的初值落在 `defaultLevel` 那一层；时间筛选使用分层 `times` 输入，见[时间参数与顶部筛选](#时间参数与顶部筛选)。
2. 查询同时声明该参数的 `paramBindings` 和该筛选器的 `filterBindings`，两者指向同一维度目标。
3. 初始化后，由筛选状态控制查询。用户修改或清空筛选，不会恢复参数默认值，也不会修改参数。

无筛选器控制的查询，仍保留本次参数确定的维度条件。绑定目标不能同时在查询体里再写一份静态维度条件。

### 5. 时间参数

时间参数回答“本次看哪一期”。按以下顺序配置：保存报告基准期 → 各查询声明时间窗口 → 按原有指标口径取数 → 页头显示同一个实际基准期。只在页头显示月份，不会改变查询。

#### 报告基准期的声明

以下为 `params` 中的一项；用于查询时间绑定时必须声明 `required: true`：

```json
{
  "id": "report-month",
  "type": "time",
  "granularity": "month",
  "required": true,
  "label": "报告月份",
  "default": "2026-02"
}
```

#### 时间的值

- `granularity: "month"`：月份，例如 `2026-03`。
- `granularity: "date"`：日期，例如 `2024-02-29`，会校验日期与闰日是否合法。
- 年份范围为0001—9999；时间参数为单值。

输入精度只说明“输入的是月份还是日期”，不决定指标如何计算或多久刷新。

#### 查询时间窗口绑定

绑定位于 `dataSources.<数据源id>.source.query.paramBindings`。同一个报告月份可被多个查询消费，每个查询独立声明自己的窗口；维度绑定与时间绑定可同时存在于同一映射中。

```json
{
  "paramBindings": {
    "report-month": {
      "target": "time",
      "window": { "kind": "period", "unit": "month" }
    }
  }
}
```

#### 时间查询的原始声明和执行结果

绑定前，查询体保留时间粒度和聚合设置，不写固定起止：

```json
{ "filter": { "time": { "period": "month", "is_aggregate": true } } }
```

当实际参数为 `2026-03`，当月窗口生成：

```json
{
  "filter": {
    "time": {
      "period": "month",
      "is_aggregate": true,
      "start": "2026-03",
      "end": "2026-03"
    }
  }
}
```

运行时只把起止写入副本，保留原有聚合设置与指标。窗口及指标口径见[查询时间窗口与指标口径](#查询时间窗口与指标口径)。当前接入要求：月参数对应查询 `period=month`，日参数对应 `period=day`；不隐式转换查询粒度。

#### 时间初始化与保存

通过 `?report-month=2026-03` 打开页面时，本次报告基准期为2026年3月；绑定的查询和页头引用均消费该实际值。

- URL未传该键：使用保存的 `default`；仍缺值时按 `required` 处理。
- 显式空值、非法月份/日期或重复URL键：阻止初始化，不回退默认值。
- 通过URL打开另一月份不会保存该月份；要改变下次默认值，须显式修改并保存页面文档。
- 查询窗口只依赖输入，不读取系统今天。相同输入生成相同条件，不保证实时数据服务始终返回相同结果。

完整的维度/时间对照见[URL初始化规则](#url初始化规则)，页头 `asOf.value` 的写法见[页面显示](#页面显示)。

#### 时间绑定约束

- 每个查询只允许一个时间参数来源，且该参数必须为必需参数；可选时间参数可用于可选文本。
- 时间绑定查询不能同时由时间筛选器控制，也不能保留静态 `start/end`。
- 月参数对应查询 `period=month`，日参数对应 `period=day`；不隐式转换查询粒度。
- 时间绑定查询不会使用无法证明属于当前参数的内嵌旧数据行；经过核验的执行回执仍可提供数据快照。
- 旧数组的 time 仍为单值；6.6 分组 times 已支持显式日期/月区间。旧[时间区间参数提案](docs/archive/page-time-range-proposal/time-range-parameters.md)不属于现行协议。

<a id="7-打开页面保存页面与显示参数"></a>

### 6. 打开页面、保存页面与显示参数

#### URL初始化规则

URL键就是参数 `id`。例如：`?report-month=2026-03`。

| 情况 | 维度参数 | 时间参数 |
|---|---|---|
| URL未提供键 | 使用default；无default时按required处理 | 相同 |
| 显式空值或非法值 | 使用有效default；仍无值时按required处理 | 阻止初始化，不回退default |
| 重复URL键 | 多值参数接收列表；单值参数视为非法 | 非法，阻止初始化 |
| 可选参数没有值 | 不添加对应参数条件 | 可用于可选文本；查询时间绑定必须引用必需参数 |

多值采用重复键，例如 `?regions=EU&regions=APAC`，不按逗号拆分；URL特殊字符应按普通URL规则编码。

#### 保存值与运行值

保存的页面包含参数声明、默认值和查询绑定。通过URL打开另一月份，只改变这次页面实例，不会自动把新月份保存为默认值。要让下次默认打开新月份，必须显式修改并保存页面文档的 `default`。

运行时在副本中生成查询条件。已核验的执行回执若带有实际参数与筛选值，按执行回执消费，不再用URL或模板默认覆盖。

时间绑定查询不会使用无法证明属于当前参数的内嵌旧数据行；经过核验的执行回执仍可提供数据快照。参数确定性指“相同输入生成相同查询条件”，不承诺实时数据服务在不同时间返回相同结果。

#### 页面显示

```json
{
  "title": "流水分析报告",
  "badge": { "param": "representative-office" },
  "asOf": {
    "label": "报告月份",
    "value": { "param": "report-month" }
  }
}
```

该片段用于报告页头属性，显示实际参数值。引用是整个属性取值，不支持模板字符串拼接。时间参数可显示规范字符串，也可在支持的版本显式使用 `format:"period"`；可选参数缺值时，引用所在文本属性按既有规则移除。

<a id="8-实际页面与查阅入口"></a>

### 7. 实际页面与查阅入口

[流水分析报告参数版](pages/flow-analysis-report-params.json)是完整业务演示：

- 保存“北京代表处”和“2026-02”两个默认值。
- 12个查询都绑定代表处与报告月份。
- 7个月度查询取报告当月，2个趋势查询取所在完整自然年；另有3个趋势查询分别取上月、近12个月（含报告月份）、年初至报告月份。
- 页头引用同一参数。演示数据与真实数据服务接通是不同的验证事项。

进一步查阅：

- [页面元数据规范](PAGE-METADATA.md)：页面整体结构与版本入口。
- [生成的参数参考](contracts/metriccanvas/page/reference/params-and-text-values.md)：精确字段、联合分支与合法示例。
- [时间参数合法夹具](packages/page/fixtures/contract-valid/time-params-page.json)：多查询使用不同窗口。
- [Schema真源](packages/page/src/schema/)与[时间窗口实现](packages/page/src/time-param.ts)：结构与执行规则的实现依据。

版本边界：维度参数与初始化绑定由6.2引入；确定性时间参数与窗口绑定由6.3引入。6.4引入`yearToDate`与`monthToDate`，6.3的`toDate + unit`保留兼容。当前可读版本与能力下限见[页面元数据规范](PAGE-METADATA.md#版本初始化与持久化)；5.x只走读取规范化，新文档写当前作者版本。

6.6 分组 times 已支持区间；历史讨论另见[时间区间参数提案](docs/archive/page-time-range-proposal/time-range-parameters.md)，不属于本文现行协议。

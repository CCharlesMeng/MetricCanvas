# 页面参数：维度与时间的现行方案

本文是 MetricCanvas 页面参数的现行说明。当前协议为 **6.5**。先读本节的新文档规则；后续编号章节保留 6.2—6.4 的 `default / paramBindings / URL` 兼容路径和时间窗口说明，不作为新模板的生成方式。

## 6.5：同一页面的无值模板与填值文档

模板和填值页面使用同一 Page Schema。模板的所选参数省略 `value/default`；填值页面只增加 `params[].value`，查询引用、组件、字段与布局保持不变。结构合法不代表输入完整：无值模板可保存，执行前必须补齐必需参数。

| 位置 | 当前规则 |
|---|---|
| `params[].required` | 6.5 可省略，等价于 true；旧版本仍要求显式声明 |
| `params[].value` | 本次实际值，与 default 互斥；显式 suppliedValues 优先，非法显式值失败而不回退 |
| `dimension` | 单值非空字符串，multiple=true 时为非空、无重复字符串数组 |
| `timeRange` | 声明 granularity=month/date；value 为同精度的 `{start,end,granularity}` 闭区间，校验真实日历与先后顺序 |
| DQE 维度 | `filter.dims[].dim_value_list: {param:"region"}`；查询引用必须必填 |
| DQE 时间 | `filter.time.start/end: {param:"report-period",part:"start"/"end"}`；双端同源，保留 period 与 is_aggregate |
| 基准期窗口 | `time` 参数的双端引用须携带相同 window，继续支持下文的 period/lastN/yearToDate 等规则 |

只允许上述 DQE 取值位置；原字段 `dim_value_list/is_aggregate` 不改拼写。单查询不得混用原位引用和旧 paramBindings。普通业务数据不参与引用替换。参数 ID 精确匹配，`report-period` 与 `report_period` 不兼容。

独立入口 `resolvePageParams(document, suppliedValues?)` 返回保留引用的填值 `document`、供执行的 `resolvedPage`、`effectiveInputs`，或带 code/path/param/message 的 issues。输入原对象不变；模块不取数、不读 URL/历史、不保存。外部可先填写 value 再调用，也可把值单独传入。timeRange 尚无 URL 编码协议，应走程序通道；普通维度/标量旧 URL 路径保留，已填 value 不被 URL 覆盖。

运行时共用同一物化逻辑，缺值先阻止请求；参数化页面的 query initial 不作为本次数据。关联 initialParam 的维度只初始化筛选，后续清空不复活固定条件；同参数的未绑定查询仍保持本次固定值。已确认输入初始化的筛选不受旧 URL 覆盖。按指定期间返回空结果，不找最近有数据期。

创作期用 `extractPageParams` 读取可信已验真的精确基线；跨源共享需要提供维度身份，无依据时分开。`applyPageParamSelection` 按人工选择提取简单维度与固定区间，保留原值/覆盖摘要，原值回填逐查询等价才成功。复合字面文本必须显式审阅替换。只有覆盖超过半数且多于一个查询的候选默认勾选。所选参数保存无值，预览值及 query initial 不保存。

旧绑定通过 `migrateParamBindings` 显式迁移，窗口不变；不能证明等价的可选查询绑定拒绝迁移。新发布接现有 Java 单次提交路径，queued/unknown 不是发布成功，未知结果不重写。真实提供方仍需单独接入。

完整例子：[无值模板](packages/page/fixtures/contract-valid/inline-params-page.json)、[填值页面](packages/page/fixtures/contract-valid/inline-params-values-page.json)、[Tokens 五查询](packages/page/fixtures/parameter-extraction/tokens-parameter-source.json)。程序交接与调用示例见[外部接入](docs/plan/page-parameter-inlining/external-integration.md)。

## 旧版本兼容路径（以下编号章节）

## 1. 一句话理解

**页面参数保存“这次看什么”的输入；每个查询明确声明如何使用这些输入。**

例如，一份流水分析报告保存两个参数：“代表处＝北京代表处”“报告月份＝2026-02”。打开时可以传入另一组值，得到另一个页面实例：

- 代表处参数让绑定它的查询增加代表处条件。
- 报告月份让绑定它的查询生成当月、全年或其他声明的查询时间窗口。
- 页头可引用同一组值，显示本次实例的代表处与报告月份。

声明参数不会自动影响全页。**只有显式绑定的查询或引用它的文本才受影响。**

## 2. 四个位置分别做什么

| 位置 | 职责 | 可以理解为 |
|---|---|---|
| 页面顶层 `params` | 声明参数名称、类型、必需性和保存的默认值 | 输入清单 |
| 查询中的 `paramBindings` | 指定参数如何作用于这个查询 | 输入的使用说明 |
| 文本位置的 `{ "param": "参数id" }` | 显示该参数的实际值 | 页面上的取值引用 |
| `filters` 与查询的 `filterBindings` | 管理页面打开后的可变筛选状态 | 页内交互 |

参数在一次初始化后固定。修改页内筛选不会反向修改参数；使用另一组参数，需要打开另一实例或由宿主重新初始化。跨页链接可以显式携带参数。

## 3. 参数怎样保存

以下是页面顶层的局部片段，不是完整页面：

```json
{
  "schemaVersion": "6.4",
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
| `default` | 没有外部输入时采用的保存值；非法输入的处理见第7节 | 可选 |
| `multiple` | 维度参数是否多值；缺省为单值 | 仅维度参数可用 |
| `granularity` | 时间输入精度，`month` 或 `date` | 时间参数必填 |

`label` 不参与查询、不生成筛选控件，也不自动成为页头标签。“代表处”是参数名称，“北京代表处”是取值，两者用途不同。删掉 `label` 不影响正常查询，但缺值提示更难理解。

`required` 和 `default` 不重复：前者要求“必须有值”，后者提供“未传值时用什么”。每个声明参数必须至少有一个消费者，不能只声明而不使用。

### 维度的值

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

### 时间的值

- `granularity: "month"`：月份，例如 `2026-03`。
- `granularity: "date"`：日期，例如 `2024-02-29`，会校验日期与闰日是否合法。
- 年份范围为0001—9999；时间参数为单值。

输入精度只说明“输入的是月份还是日期”，不决定指标如何计算或多久刷新。

## 4. 查询怎样消费参数

绑定位于 `dataSources.<数据源id>.source.query.paramBindings`。以下是一个查询的局部片段：

```json
{
  "paramBindings": {
    "representative-office": {
      "target": "dimension",
      "queryField": "代表处"
    },
    "report-month": {
      "target": "time",
      "window": { "kind": "period", "unit": "month" }
    }
  }
}
```

映射的键是参数 `id`，值是它在这个查询中的用途：

- `target: "dimension"`：生成 `queryField` 指定的维度条件。例如北京代表处变成 `dim_name: "代表处"`、`dim_value_list: ["北京代表处"]`。
- `target: "time"`：根据参数和 `window` 计算查询起止期间。

它是结构化绑定，不是把字符串任意插入SQL。不同数据源可绑定同一参数；同一查询中的同一维度目标只能有一个参数来源。

### 时间查询的原始声明和执行结果

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

运行时只把起止写入副本，保留原有聚合设置与指标。当前接入要求：月参数对应查询 `period=month`，日参数对应 `period=day`；不隐式转换查询粒度。

## 5. 时间窗口与指标口径的分界

| 概念 | 回答的问题 | 示例 |
|---|---|---|
| 报告基准期 | 本次看哪一期？ | 2026年3月 |
| 查询时间窗口 | 读取哪些期间？ | 当月、最近12个月、所在全年 |
| 指标统计周期与计算口径 | 一个值代表什么、如何计算？ | 月流水、年累计流水、月同比 |

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

## 6. 参数与页内筛选怎样配合

维度参数可以只负责打开时的初始选择：

1. 筛选器用 `initialParam` 引用参数，不再另写 `default`。
2. 查询同时声明该参数的 `paramBindings` 和该筛选器的 `filterBindings`，两者指向同一维度目标。
3. 初始化后，由筛选状态控制查询。用户修改或清空筛选，不会恢复参数默认值，也不会修改参数。

无筛选器控制的查询，仍保留本次参数确定的维度条件。绑定目标不能同时在查询体里再写一份静态维度条件。

时间参数当前用于固定时间输入：每个查询只允许一个时间参数来源，且不能同时由时间筛选器控制；绑定查询也不能保留静态 `start/end`。

## 7. 打开页面、保存页面与显示参数

### URL初始化规则

URL键就是参数 `id`。例如：`?report-month=2026-03`。

| 情况 | 维度参数 | 时间参数 |
|---|---|---|
| URL未提供键 | 使用default；无default时按required处理 | 相同 |
| 显式空值或非法值 | 使用有效default；仍无值时按required处理 | 阻止初始化，不回退default |
| 重复URL键 | 多值参数接收列表；单值参数视为非法 | 非法，阻止初始化 |
| 可选参数没有值 | 不添加对应参数条件 | 可用于可选文本；查询时间绑定必须引用必需参数 |

多值采用重复键，例如 `?regions=EU&regions=APAC`，不按逗号拆分；URL特殊字符应按普通URL规则编码。

### 保存值与运行值

保存的页面包含参数声明、默认值和查询绑定。通过URL打开另一月份，只改变这次页面实例，不会自动把新月份保存为默认值。要让下次默认打开新月份，必须显式修改并保存页面文档的 `default`。

运行时在副本中生成查询条件。已核验的执行回执若带有实际参数与筛选值，按执行回执消费，不再用URL或模板默认覆盖。

时间绑定查询不会使用无法证明属于当前参数的内嵌旧数据行；经过核验的执行回执仍可提供数据快照。参数确定性指“相同输入生成相同查询条件”，不承诺实时数据服务在不同时间返回相同结果。

### 页面显示

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

该片段用于报告页头属性，显示实际参数值。引用是整个属性取值，不支持模板字符串拼接。时间参数当前按规范字符串展示；可选参数缺值时，引用所在文本属性按既有规则移除。

## 8. 实际页面与查阅入口

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

版本边界：维度参数与初始化绑定由6.2引入；确定性时间参数与窗口绑定由6.3引入。6.4引入`yearToDate`与`monthToDate`，6.3的`toDate + unit`保留兼容。当前读取兼容5.0—5.4及6.0—6.5；5.x只走读取规范化，新文档写6.5。

显式日期/月区间已在6.5实现，以本文首节及生成契约为准；[旧提案](docs/plan/time-range-parameters.md)仅为历史设计资料。

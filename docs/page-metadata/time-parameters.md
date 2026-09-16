# 确定性时间参数（6.3）

报告基准期由页面参数指定，统一运行时生成各查询的查询时间窗口。按指定期间查询；无数据由数据快照呈现空结果，不回退默认期或最新可用期。数据服务故障仍呈现查询错误，不伪装为空结果。

## 完整声明接缝

页面声明：

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

查询声明（放在 `dataSources.<id>.source.query`）：

```json
{
  "language": "dqe",
  "body": {
    "dsl_list": [{
      "output_dims": ["month"],
      "output_metrics": ["flow"],
      "filter": { "time": { "period": "month", "is_aggregate": false }, "dims": [], "metrics": [] },
      "order": {}
    }]
  },
  "paramBindings": {
    "report-month": { "target": "time", "window": { "kind": "lastN", "unit": "month", "n": 12 } }
  }
}
```

输入 `?report-month=2026-03` 后，运行副本的 `filter.time` 为：

```json
{ "period": "month", "is_aggregate": false, "start": "2025-04", "end": "2026-03" }
```

原始页面参数、绑定与查询体不被改写；重新打开或跨页导航可传递另一个月份。页头使用 `{ "param": "report-month" }` 引用相同输入，第一版按规范字符串展示。

## 参数和窗口闭集

- `granularity: "month"`：真实日历月份 `YYYY-MM`。
- `granularity: "date"`：真实日历日期 `YYYY-MM-DD`，校验闰日。
- 年份范围为 0001—9999。时间参数为单值，不接受逗号列表或重复 URL 键。
- 仅 URL 未提供键时使用保存的 `default`。显式非法、空或重复输入阻止初始化，不偷偷使用另一月份。
- 用于查询的时间参数必须 `required: true`。缺少输入不允许退化为无时间约束查询。

| 窗口 | 规则 | 示例 |
|---|---|---|
| `{kind:"period",unit:"month"}` | 基准所在完整月 | 月参数2026-03→2026-03；日参数2024-02-15→2024-02-01至29 |
| `{kind:"period",unit:"year",offset:-1}` | 基准所在年的上一完整自然年 | 月参数2026-03→2025-01至12 |
| `{kind:"period",unit:"day",offset:-1}` | 基准日前一天 | 日参数2024-03-01→2024-02-29 |
| `{kind:"lastN",unit:"month",n:12}` | 含基准月的最近12个月 | 2026-03→2025-04至2026-03 |
| `{kind:"lastN",unit:"day",n:7}` | 含基准日的最近7天 | 2024-03-01→2024-02-24至2024-03-01 |
| `{kind:"yearToDate"}` | 自然年起点至基准期 | 月参数2026-03→2026-01至03 |
| `{kind:"monthToDate"}` | 自然月起点至基准期 | 日参数2026-03-15→2026-03-01至15 |

`period.offset` 为整数，缺省0；移动的是完整周期，不进行月底日期猜测。`lastN.n` 为正整数；单位与输入精度一致。月参数不能使用day窗口。起止包含；日历算术不读取系统时间，也不受进程时区影响。派生窗口越出年份范围即拒绝。

## 查询所有权与交付边界

- 每个查询只允许一个时间参数来源；不允许同时存在时间 `filterBindings`。
- 绑定查询必须声明 `filter.time`，保留 `period/is_aggregate` 等属性，但不能再声明静态 `start/end`。
- 第一版月参数要求查询 `period=month`、日参数要求 `period=day`。不隐式转换查询分组粒度；输入精度与指标统计周期在领域上仍独立。
- 不绑定的查询保持原样；物理分区字段、目标年度字段或财经接口字段由相应数据服务契约确定，不能把 `target_year=2026` 冒充全年范围。
- 带时间绑定的查询不使用无当前参数执行凭据的 `source.initial`；已由 `prepareExecution` 核验的执行回执仍按原消费契约使用。
- 本轮不增加最新可用期查询、自动回退、财年/周规则、动态Tab粒度切换或历史预测版本能力。
- 累计、同比/环比仍遵守指标契约。读取当月分区的累计指标不改成年初至今再求和。全年窗口也不自动产生“截至当时”的预测版本。

## 流水分析报告接入

`pages/flow-analysis-report-params.json` 保存代表处与报告月份。7个月度查询使用当月窗口，2个月度趋势查询使用所在完整自然年；保留各指标与查询聚合设置。该页沿用已有演示查询字段，生产取数仍依赖数据服务支持相应契约。

验证见 `packages/page/tests/time-params.test.ts`、`time-param-bindings.test.ts` 与 `packages/engine/runtime/tests/time-param-initialization.test.ts`。跨语言静态校验矩阵由 `tools/scripts/export-authoring-contracts.ts` 输出至 `contracts/metriccanvas/page/conformance/time-param-bindings.json`。

## 6.4 窗口命名

新页面优先使用 `yearToDate` / `monthToDate`，不带 `unit`，声明版本至少6.4。终点是绑定参数的报告基准期。旧 `toDate + unit` 继续兼容6.3。

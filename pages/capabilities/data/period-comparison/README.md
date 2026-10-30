# 同比环比

## 使用配置（Schema 6.77）

完整可复制配置见 [period-comparison-demo.json](period-comparison-demo.json)。修改真实业务时替换查询指标、维度和字段映射，并用稳定业务编号作为关联键；示例的 customer/sales/rate 为合成字段。查询和计算由页面数据源声明，表格列引用计算后的字段。

1. 顶部筛选声明 `type: "timeRange"`、`display: "period"`、`precision: "date"`，通过 `iocHeader.filterIds` 引用。默认值例如 `{"mode":"month","value":"2026-10"}`。
2. 三期查询均声明 `source.resultScope: "complete"`，指标查询使用日边界并按实际服务契约聚合，示例为 `filter.time: {"period":"day","is_aggregate":true}`。保留相同的业务条件与字段粒度。
3. 在三个查询的 `filterBindings` 中绑定同一个顶部筛选，只改变比较种类：

```json
{
  "period": {
    "target": "time",
    "periodComparison": {
      "kind": "previousPeriod",
      "fact": "sales-through"
    }
  }
}
```

| 查询 | kind | 时间规则 |
|---|---|---|
| 当期 | current | 所选期间截至可信统计截止日 |
| 上期 | previousPeriod | 月移1月、季度移3月、年和近一年移12月 |
| 去年同期 | previousYear | 前移12月 |

近一年是前十二个完整自然月，不包含当前月。未完成期间保持相同日历进度，月末和闰日钳制到目标月最后一天；完整期间比较完整自然期间。年与近一年的同比、环比基期相同，列仍可分别展示。

`fact` 引用宿主 `DisplayInputsSnapshot.periods` 中的可信截止事实，三期使用同一个事实。以下仅为宿主输入的 periods 片段，不是页面 JSON 字段：

```json
{
  "periods": {
    "sales-through": {
      "status": "ready",
      "granularity": "date",
      "latest": "2026-10-28"
    }
  }
}
```

宿主还须提供有效的权限上下文、时区和适用的筛选版本；缺失或过期时查询失败。不能用页面可编辑值或浏览器日期冒充实际统计截止日。选择2026年10月且截止10月28日时，三期分别查询2026-10-01至28、2026-09-01至28、2025-10-01至28。

4. 建立空 `inline` 计算数据源，按 `unionKeys → joinAggregate → delta → ratio` 声明 compute。`unionKeys` 对三期业务键取并集，保留历史独有对象；三个 `joinAggregate` 按键关联各期指标，`aggregate: "unique"` 要求每期每个键只有一条结果。各 output 均须在该数据源 fields 中声明为 number/measure。
5. 销售额可在 `joinAggregate.values[]` 上显式配置 `onMissing: "zero"`；未声明时缺记录为 null。已返回的 null 单元格、失败请求都不会补零。比率通常保持 null，其范围聚合应由服务端按分子/分母口径计算。

环比增长率的 compute 片段（此前已关联 current-sales 和 previous-sales）：

```json
[
  {"op":"delta","minuend":"current-sales","subtrahend":"previous-sales","output":"previous-sales-delta"},
  {"op":"ratio","numerator":"previous-sales-delta","denominator":"previous-sales","output":"previous-growth","scale":100,"onZeroDenominator":"null"}
]
```

同比将基期字段换为 year-ago-sales。零分母（包括0/0）输出 null；负分母沿用原带符号公式。百分点只做 delta，例如50−40=10，要求输入为0–100百分刻度，不猜测0–1比例。

6. 表格 `data.main` 引用计算数据源，`rowKey` 使用业务键；配置 `pagination: {"mode":"local","pageSize":5}`。增长率字段用 `percent-2-signed`，百分点字段用 `points-1-signed`，`missingText: "—"`。例如：

```json
{
  "title": "环比增长率",
  "field": {"data":"main","field":"previous-growth","format":"percent-2-signed","missingText":"—"},
  "sortable": true,
  "filterable": {"mode":"numberRange"}
}
```

排序、筛选、分页发生在完整比较结果上；`toolbar.export: {"format":"xlsx","filename":"同比环比"}` 导出完整匹配集合。任一期失败时表格显示持续错误和重试入口，不能导出不完整结果。

## 后端分页与规模边界

本次 periodComparison 支持完整读取后的计算与本地分页，每个查询最多10000行、60秒，超限明确失败。不能把演示中的 local 改为 query：当前校验禁止比较源直接查询分页，也禁止作为 pagedJoin/pagedUnion 成员；periodComparison 与 periodPolicy/window 互斥，查询不得另设固定时间或 limit/offset。

引擎普通查询分页及 pagedJoin 按需选页补列能力仍可独立使用。将期间比较接入“后端选业务编号页，再按相同编号补齐三期并计算”的路径属于后续扩展，本次未交付。该路径还需保证稳定业务行域、准确总数、跨查询数据一致性及历史独有对象覆盖；若按同比环比全局排序筛选，后端必须能据计算结果选页，或采用完整读取。

真实DQE聚合、权限和宿主截止事实需集成验收，演示成功不代表真实服务已通过。

## 演示与验收

入口 `/pages/period-comparison-demo`；无需URL参数。使用 `pnpm dev:playground` 启动，页面专属合成网关自动接入。页面 JSON 为本目录 `period-comparison-demo.json`；合成明细、聚合算法和可信截止事实在 `apps/playground/fixtures/period-comparison.ts`，截止2026-10-28，绝非真实DQE。

1. 默认2026-10：甲的环比增长率20%、同比50%、环比差值+10.0P；乙0/0显示—；丙缺达成率显示—。
2. 总计8个客户、每页5个。翻页看到丁、仅去年；它们当期销售额按声明补零，历史有值时增长率-100%，达成率不补零。
3. 点击“环比增长率”排序，可把原在第二页的末行（300%）排到第一；表头数值筛选大于等于100后仅丙和末行。空值排最后。
4. 切换年/季/月/近一年。年与近一年同比、环比相同；各期查询重新使用对应日期范围，指标是范围内日记录聚合，达成率重新以分子/分母汇总。近一年随打开时钟定位；测试固定2026-10-29。
5. 点击导出，导出完整匹配结果而不是当前5行，保留排序和格式。
6. `/pages/period-comparison-demo?state=error` 演示去年同期请求失败；表格不得显示成功比较结果或生成不完整导出。`?state=duplicate` 演示源内重复业务键被拒绝。`?state=retry` 首次失败，点击持续显示的“重试”按钮后成功。

单元/集成测试覆盖缺截止事实、闰日、月末、负基期、缺记录与空单元格区分、查询失败、完整排序、导出状态、取消及过期回执。浏览器验收与结果记录见 `docs/evidence/period-comparison/acceptance.md`。真实服务的指标聚合、权限、事实来源和超过完整读取预算的业务另验。

# 表格期间比较

已确认：月/季度/年/前十二个完整月；月环比前移一月，季环比前移三月，年和近一年环比均前移一年；同比前移一年。未完成周期按可信统计截止日保持相同日历进度，月末/闰日钳制到目标月最后一天。各期稳定业务键取并集；完整计算后排序、筛选、分页和导出。零分母/未知值为空；失败不能补零或生成不完整导出。

## 声明与职责

沿现有 query.filterBindings.time 增加 periodComparison，与 periodPolicy/window 互斥。fact 是宿主 DisplayInputsSnapshot.periods 的键，不是 URL 参数或页面自报的数据截止日。current、previousPeriod、previousYear 三个普通完整查询均消费同一个顶部期间筛选与同一个 fact，业务谓词保持一致。指标查询显式使用 day，服务端负责该范围的指标聚合；不在浏览器对月度比率求和。

```json
{
  "target": "time",
  "periodComparison": { "kind": "previousYear", "fact": "sales-through" }
}
```

完整页面见 pages/capabilities/data/period-comparison/period-comparison-demo.json。组合源复用空 inline + unionKeys + joinAggregate + delta/ratio。joinAggregate.values 每个度量可声明 onMissing: null|zero，省略等价 null；只对缺关联记录补零，不把已返回的空单元格或失败补零。

```json
{
  "op": "joinAggregate", "source": "current", "keys": [{"local":"customer","foreign":"customer"}],
  "values": [{"field":"sales","output":"currentSales","aggregate":"unique","onMissing":"zero"}],
  "onMissing": "null"
}
```

增长率用 delta 后 ratio(scale=100,onZeroDenominator=null)；百分点值要求输入采用0–100刻度，delta 后用 points-1-signed 展示，不自动猜测百分刻度。

## 边界

复用完整读取预算（每个查询最多10000行、执行/导出60秒）；超过预算明确失败，不退回只算当前页。合成网关提供完整聚合结果；真实DQE的指标、权限、聚合口径与期间事实由集成方提供并另验。

## 柱图按字段排序（6.132）

复用用途：按未绘制的合计字段降序排列堆叠柱，或按维度升序排列横向柱图。

参考对象：`/pages/bar-category-order` 的 `by-total` 按计算字段 `totalCount` 降序，`by-region` 按 `region` 升序，`source-order` 沿用数据源行序。

移植边界：将 `order.field` 绑定目标图表 `data.main` 的结果字段。业务总数可由查询返回或复用 `sumFields`，各分段字段继续绑定到 `series`。示例数据为内联合成数据。

可观察预期与环境：运行 `pnpm dev:playground`，打开 `/pages/bar-category-order`，无需 DQE 或 URL 参数。总数降序为 B、A、C、E、D，B 与 A 同值保留原序，E 为零，D 为空。点击首柱打开 B 区明细。切换「已签」图例后仍按该顺序显示。横向图从上到下为 A、B、C、D、E，未配置排序的对照图保持 C、B、D、A、E。

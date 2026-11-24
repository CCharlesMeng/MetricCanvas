## 指标卡变化项显隐

复用用途：在一张卡内按已应用的统计期间切换同比、环比，保留主、次指标值。

参考对象：页面 JSON（原入口：`metric-card-change-visibility.json`） 的 `rates` 指标卡及 `period` 筛选器。两组变化项分别在 `rows` 和 `secondaryRows` 下声明。

移植边界：映射目标页的期间筛选器 ID 和同口径同比、环比字段。示例数值来自内联合成数据。

可观察预期与环境：运行 `pnpm dev:playground`，打开 `/pages/metric-card-change-visibility`，无需 URL 参数。默认月显示两行环比，切换年、季显示两行同比，切换近一年时只保留次指标「较目标」。签约完成率、回款完成率始终可见。自动验收使用同一份 JSON 校验典型非法条件，并在报表宿主中核对 PDF/PNG 的冻结展示。

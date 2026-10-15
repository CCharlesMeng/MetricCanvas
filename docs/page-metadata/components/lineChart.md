# 折线图 lineChart

展示指标随时间或有序维度的变化趋势。适用于趋势、走势、按日/月变化、时间序列。数据形状：一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段。

用于沿有序维度观察趋势；序列measure与横轴dimension显式绑定，不把随机类别顺序冒充时间趋势。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文可通过 `props.filter` 在左上角配置独立单选筛选。选项名称和值分离，default 与查询绑定显式声明；见[图表独立筛选](../filters.md#chart-local-filter)和 `chart-local-filter-page` 完整页面。

# 饼图 pieChart

展示少量类别对整体的占比或构成。适用于占比、构成、份额，且类别数量较少。数据形状：一个 dimension 类别字段 + 一个 metric 数值字段。

表达类别占比，维度与度量明确；数据是否适合占比仍取决于业务可加总性。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文可通过 `props.filter` 在左上角配置独立单选筛选。选项名称和值分离，default 与查询绑定显式声明；见[图表独立筛选](../filters.md#chart-local-filter)和 `chart-local-filter-page` 完整页面。

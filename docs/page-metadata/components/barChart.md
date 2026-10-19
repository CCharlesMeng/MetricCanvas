# 柱状图 barChart

比较离散类别之间的大小或展示分类分布。适用于区域/渠道/产品对比、分类分布、多指标类别比较。数据形状：一个 dimension 类别字段 + 一个或多个 metric 字段。

每个series显式绑定measure并声明适用角色，维度轴来自dimension字段。forecast/actual等角色与色彩语义应与真实业务口径一致。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文可通过 `props.filter` 在左上角配置独立单选筛选。选项名称和值分离，default 与查询绑定显式声明；见[图表独立筛选](../filters.md#chart-local-filter)和 `chart-local-filter-page` 完整页面。

6.32 的隐含高级入口 `props.echartsOption` 用于显式要求的 ECharts 呈现定制；普通创作优先使用上面的封闭属性。规则、保护路径、console 诊断与降级见[高级呈现扩展](../chart-option.md)。

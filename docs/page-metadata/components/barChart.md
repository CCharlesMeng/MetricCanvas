# 柱状图 barChart

比较离散类别之间的大小或展示分类分布。适用于区域/渠道/产品对比、分类分布、多指标类别比较。数据形状：一个 dimension 类别字段 + 一个或多个 metric 字段。

每个series显式绑定measure并声明适用角色，维度轴来自dimension字段。forecast/actual等角色与色彩语义应与真实业务口径一致。

6.56 起，DQE 通过 `output_dims` 返回的现成计数或金额也可显式声明为数值度量，再绑定 `series[].field`；图表直接使用每行数值，不重新聚合。声明见[结果字段角色](../fields.md#dqe-output-measures)，柱图、明细与零值/缺失对照见 `stored-count-measures` 示例。

## 默认柱宽

所有内置柱系列的默认宽度统一为 **16 CSS px**，包括普通、分组、堆叠、横向条形、`reportForecast` 以及混合图中的柱系列；横向图的16px表示条形厚度。折线系列不设置柱宽。宽度不随容器或类别数量自动放大。

这是公共呈现默认值，不新增页面字段或协议版本。已有高级 `props.echartsOption.series[].barWidth` 显式配置仍按高级扩展规则覆盖默认值；普通页面无需为16px添加高级配置。

可观察场景：`/pages/bar-width-defaults`，使用内联合成数据，覆盖上述变体及显式32px覆盖的对照。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

6.32 的隐含高级入口 `props.echartsOption` 用于显式要求的 ECharts 呈现定制；普通创作优先使用上面的封闭属性。规则、保护路径、console 诊断与降级见[高级呈现扩展](../chart-option.md)。

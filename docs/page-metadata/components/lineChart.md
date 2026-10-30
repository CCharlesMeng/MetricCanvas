# 折线图 lineChart

展示指标随时间或有序维度的变化趋势。适用于趋势、走势、按日/月变化、时间序列。数据形状：一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段。

用于沿有序维度观察趋势；序列measure与横轴dimension显式绑定，不把随机类别顺序冒充时间趋势。

## 双轴刻度与网格线

`dualAxis: true` 的双数值轴默认以主轴为基准，副轴通过 ECharts `alignTicks` 对齐刻度位置，只由主轴绘制网格线；两侧轴标签、字段展示格式和单位继续保留。柱图、折线图和柱线混合图采用同一策略，单轴沿用原默认行为。

自动对齐可能扩展副轴显示范围，不修改原始数据。已有 `props.echartsOption` 显式配置仍按高级扩展规则覆盖默认值；显式固定 `min`、`max`、`interval` 或关闭 `alignTicks` 时，刻度受该配置约束，不承诺继续自动对齐。

可观察场景：`/pages/dual-axis-alignment`，使用内联合成数据，包含双轴柱图、双轴折线图、柱线混合图与单轴对照；默认仅一套水平网格线，左右刻度位于相同高度。本次只调整呈现默认值，不新增页面字段或协议版本。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

6.32 的隐含高级入口 `props.echartsOption` 用于显式要求的 ECharts 呈现定制；普通创作优先使用上面的封闭属性。规则、保护路径、console 诊断与降级见[高级呈现扩展](../chart-option.md)。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。

## 数值格式

标签、悬浮提示及数值轴使用[统一数值格式规则](../field-bindings-and-formats.md#chart-number-format)。未声明格式时默认显示两位小数，不隐式缩放为万；显式 `number` 可保留原值，声明 `compact-wan-0` 可显式采用万单位。完整场景：`/pages/chart-number-format`。

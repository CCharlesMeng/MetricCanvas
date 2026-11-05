# 柱状图 barChart

比较离散类别之间的大小或展示分类分布。适用于区域/渠道/产品对比、分类分布、多指标类别比较。数据形状：一个 dimension 类别字段 + 一个或多个 metric 字段。

每个series显式绑定measure并声明适用角色，维度轴来自dimension字段。forecast/actual等角色与色彩语义应与真实业务口径一致。

6.56 起，DQE 通过 `output_dims` 返回的现成计数或金额也可显式声明为数值度量，再绑定 `series[].field`；图表直接使用每行数值，不重新聚合。声明见[结果字段角色](../fields.md#dqe-output-measures)，柱图、明细与零值/缺失对照见 `stored-count-measures` 示例。

## 默认柱宽

独立查询提供的整体均值可通过 `joinAggregate.keys: []` 关联为主行集的一列，再用普通 bar 系列展示；不需要给每个代表处保存重复常量。完整语义见[独立单行指标关联](../compute.md#独立单行指标关联683)，场景 `/pages/chart-global-benchmark` 为两根分组柱与两条折线。均值源自行绑定期间及站点，省略区域绑定可保持全局范围。

所有内置柱系列的默认宽度统一为 **16 CSS px**，包括普通、分组、堆叠、横向条形、`reportForecast` 以及混合图中的柱系列；横向图的16px表示条形厚度。折线系列不设置柱宽。宽度不随容器或类别数量自动放大。

这是公共呈现默认值，不新增页面字段或协议版本。已有高级 `props.echartsOption.series[].barWidth` 显式配置仍按高级扩展规则覆盖默认值；普通页面无需为16px添加高级配置。

可观察场景：`/pages/bar-width-defaults`，使用内联合成数据，覆盖上述变体及显式32px覆盖的对照。

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

<a id="chart-series-visibility"></a>

## 系列条件显隐（6.87）

`props.series[].visibleWhen` 使用[展示条件](../conditions.md)，支持字段系列和常量系列；柱线组合中的柱和折线均适用。省略时始终具有展示资格。系列没有行上下文，不能引用 `row`；筛选器必须已声明且类型与操作匹配。单系列条件本身可作为筛选消费方，内联页面也能观察显隐效果。

```json
{
  "id": "trend",
  "type": "barChart",
  "layout": { "span": 12 },
  "data": { "main": "trend" },
  "props": {
    "categoryField": "month",
    "dualAxis": true,
    "series": [
      { "field": "sales", "label": "销售额", "kind": "bar", "axis": "primary" },
      {
        "field": "rate", "label": "达成率", "kind": "line", "axis": "secondary",
        "visibleWhen": { "filter": "scope", "part": "values", "op": "containsAny", "values": ["office"] }
      }
    ]
  }
}
```

示例需声明 `scope` 维度筛选器和 `trend` 数据源（`month` 为维度，`sales/rate` 为度量）；完整合法页面见 `/pages/chart-series-visibility`。

条件读取当前已应用的筛选状态和已有外部事实，错误、缺失和等待均不展示。条件不满足时系列、图例、悬浮提示和常驻标签同步消失，用户点击图例不能恢复被条件排除的系列；再次满足时自动恢复。原声明序、配色槽位、堆叠次序和高级 `echartsOption.series[]` 补丁对应关系保留。堆叠合计按当前可见系列重新计算。

没有可见系列使用的数值轴隐藏轴名、刻度和网格线；仍保留内部轴索引，避免其他系列绑定错轴。仅副轴仍在使用时独立绘制刻度和网格线。全部系列被隐藏时保留图表标题、容器及类别轴，不把展示投影当作源数据为空。查询定义、筛选状态及共享源行集不改变，也不因系列隐藏停止查询。PDF/PNG 使用导出捕获的条件状态；显示资格不能替代服务端授权。

新条件仅可在 Schema 6.87 及以后声明，旧系列省略该字段时沿用原行为。本能力没有新增显示模式、轴显隐开关或脚本入口。

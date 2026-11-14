# 柱状图 barChart

比较离散类别之间的大小或展示分类分布。适用于区域/渠道/产品对比、分类分布、多指标类别比较。数据形状：一个 dimension 类别字段 + 一个或多个 metric 字段。

## 分类组合系列与页头筛选

`/pages/chart-customer-series` 使用现有声明展示四个大区、每组“华为 NA”和“商业客户”两根柱子。查询通过 `filterBindings` 消费 IOC 页头客户分类，按大区与客户级别返回可加总金额；在同一页面数据源中先 `pivot` 为卓越、核心、战略、商业客户四列，再用 `sumFields` 合计前三列为华为 NA。柱图 `data.main` 引用该结果，两个 `series[].field` 分别读取合计与商业客户字段，明细表复用同一结果。

选择战略时华为 NA 只包含战略，商业客户无匹配值；选择战略与商业客户时两根柱子各保留自己的分类。`sumFields.onMissing:"ignore"` 忽略部分缺项、全部缺项保留 null，真实 0 保留；空结果不制造四组行，失败不转为零。不要将 `pivot.columns[].categories` 的多个候选误作求和，该列表只取首个匹配类别；也不要依赖同字段静态查询条件与页头绑定自动取交集。比率、均值及去重数不直接套用金额加总口径。

该场景仅复用既有协议与计算阶段，不新增 Schema 或系列级查询配置。合成 Adapter 核对实际编码条件后返回分组数据；不代表真实 DQE 服务已验真。操作与预期见页面目录 README。

<a id="bar-series-average"></a>

## 前端均值柱系列（6.103）

字段柱系列可声明 `aggregate: "avg"`，对该字段在当前图表全部输入行中的有效值求算术平均，并在每个原类别展示相同均值。同一图表用两个系列并排比较当前值和均值，均值系列的标签、单位、颜色、格式与显隐沿用既有系列属性。完整组件示例：

```json
{
  "id": "office-average",
  "type": "barChart",
  "layout": { "span": 12 },
  "data": { "main": "rep-office-efficiency" },
  "props": {
    "categoryField": "rep-office",
    "showValueLabels": true,
    "series": [
      { "field": "decision-count", "label": "当前值", "unit": "次" },
      { "field": "decision-count", "label": "均值", "aggregate": "avg", "unit": "次" }
    ]
  }
}
```

0及负数参与，空值与非有限值不计入分母；全空均值为空，空行集不制造类别。使用原始值计算后再格式化。每个均值系列只计算自己绑定的字段，不混合不同字段或单位；省略 aggregate 的系列逐行展示当前值。均值仅支持字段柱系列，不支持常量、折线、堆叠或预测。混合图内普通折线仍按原类别和数值展示。

计算范围是当前快照全部图表输入行，包括缩放窗口以外的类别；不依赖表格当前页或图例隐藏状态。期间或查询筛选刷新输入后重算。每个均值柱对应原类别，原类别当前值缺失时仍可显示有效的整体均值。均值系列不写入页面数据源、表格或表格导出；均值柱不触发原始业务行的点击联动或下钻，当前值柱保留原交互。PNG/PDF共用相同计算。

算术平均不是按决策次数加权的平均，也不是公司整体指标的查询口径。完整合成场景 `/pages/sdt-period-aggregation` 的底部图：甲的两根柱为120和90，乙为60和90，丙当前值为空、均值为90；切月后甲10和7.5，乙5和7.5。横轴不增加“均值”类别。

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

`series[].field` 与 `series[].value` 是互斥来源分支；固定基线可使用 `{"value":2,"kind":"line","axis":"secondary","unit":"天"}`。常量分支不要求 field，支持 unit。类别和指标系列共同沿用数据源行序，常量不会触发按类别重排；排序仍在该数据源的 DQE `body.dsl_list[0].order.order_by_field/type` 声明，使用原查询字段名，不对常量配置排序。示例 `/pages/query-sort-baseline` 同时展示 2 天与 5 人基线及查询降序。

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。

## 数值格式

标签、悬浮提示及数值轴使用[统一数值格式规则](../field-bindings-and-formats.md#chart-number-format)。数值轴默认在轴顶显示单位，刻度只显示数字；横向图在数值轴末端显示，双轴分别处理。无格式与可信语义时默认两位小数，不隐式缩放为万；显式 `number` 保留原值，`compact-wan-0` 显式采用万单位。场景：`/pages/chart-number-format`、`/pages/chart-axis-unit`。

<a id="chart-series-visibility"></a>

## 系列条件显隐（6.89）

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

没有可见系列使用的数值轴隐藏轴名、刻度和网格线；仍保留内部轴索引，避免其他系列绑定错轴。仅副轴仍在使用时独立绘制刻度和网格线。全部系列被隐藏时保留图表标题、容器及类别轴，不把展示投影当作源数据为空。

系列显隐与表格列显隐共用[按需取数规则](table.md#table-column-visibility)，不新增 Schema 字段。先合并共享消费者与执行依赖；普通单项 DQE 查询可从 `output_metrics` 移除无使用者的独立字符串指标，并同步本次请求字段映射。类别与分组维度始终保留，全部系列隐藏时仍可查询类别行集；可见常量系列继续沿类别行集重复取值。计算、关联、业务筛选、默认排序及其他组件依赖的指标保留，复杂查询保守保留完整输出。页面保存的查询定义、完整结果字段契约及筛选状态不变。重新显示按当前已应用筛选恢复读取，迟到旧响应不能覆盖新结果。PDF/PNG 使用导出捕获的条件与同一依赖规则；显示资格不能替代服务端授权。查询请求的合成验收入口 `/pages/conditional-query-demand`。

`joinAggregate` 还会按实际消费字段裁剪无使用者的关联值和独占依赖，具体边界见[按需关联计算](../compute.md#conditional-compute-demand)。仍被可见系列、共享消费者、排序或后续计算使用的依赖保持严格失败；期间不匹配不作为空结果处理。合成场景 `/pages/conditional-compute-demand`。

新条件仅可在 Schema 6.89 及以后声明，旧系列省略该字段时沿用原行为。本能力没有新增显示模式、轴显隐开关或脚本入口。

## 自定义展示单位

6.94 起系列可声明 `unit`，图例名称、数值标签与悬浮提示共用。声明、单位与缩放组合、缺失及导出规则见[展示单位](../field-bindings-and-formats.md#display-unit)。场景 `/pages/chart-table-unit`。

## 堆叠合计标签

`stacked: true` 配合 `showStackTotalLabels: true` 在每个类别显示当前系列的数值合计，包含负数扣分。标签锚定可见堆叠的外端，与柱体保持 8 CSS px 间距；正负混合时置于正值柱顶，显示值仍为含扣分的净合计；全负数置于负值外端，横向条形相应置于右侧或左侧。无需声明额外的“总分”系列；未开启时不显示合计。`/pages/partner-health-interactions` 使用前端计算的合成得分，四类得分含负数风险扣分；业务 `/pages/partner-health` 的地区部和代表处图表均开启此配置。

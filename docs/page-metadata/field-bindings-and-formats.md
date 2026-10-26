# 数据槽、字段绑定与格式

data槽把组件关联到页面数据源；字段绑定引用该槽中的结果字段，可用显式source指定受支持的其它槽。match按声明维度取值选择对应行，不能充当通用查询表达式。

format优先于字段defaultFormat；未设置时走组件/类型的既有格式行为。number保留数值语义，number-1/2控制小数位，number-grouped千分位；compact-wan/yi是数量单位缩放。percent-*直接以原数值加百分号，0.42不自动变42%；需要ratio.scale:100或正确的原始刻度。

text不执行HTML，日期格式只格式化日期值。语义HTML须用专用字段类型。

## 带符号普通数值（6.17起）

全部 `number` 格式都有对应的带符号版本，保留原格式的精度与千分位规则：

| 原格式 | 带符号格式 | 版本下限 | 正数示例 | 零值示例 |
|---|---|---|---|---|
| `number` | `number-signed` | 6.17 | `+1.234` | `0` |
| `number-1` | `number-1-signed` | 6.17 | `+1.2` | `0.0` |
| `number-2` | `number-2-signed` | 6.18 | `+1.23` | `0.00` |
| `number-grouped` | `number-grouped-signed` | 6.18 | `+1,234.568` | `0` |

`number-2-signed` 的 `±0.004` 均显示 `0.00`，`±0.005` 分别显示 `+0.01`、`-0.01`。`number-grouped-signed` 沿用当前千分位格式默认最多三位小数的舍入策略，`±0.0004` 均显示 `0`，`±0.0005` 分别显示 `+0.001`、`-0.001`。所有带符号普通数值格式共用零值的符号、正负颜色及变化箭头规则。

`number-signed` 保留 `number` 的原始数值精度，正数加 `+`、负数保留 `-`、零无符号；`number-1-signed` 保留一位小数后判断符号。`1.24` 显示 `+1.2`，`-1.24` 显示 `-1.2`，`0.04`、`-0.04` 与负零均显示 `0.0`。不乘100、不追加百分号，适用于天数或次数的绝对变化。单位仍由组件的单位声明提供。空值及非有限数值显示缺失文案。

```json
{ "data": "main", "field": "avg-decision-time-change", "format": "number-1-signed" }
```

表格数字列与指标卡变化项采用以上格式时，`colorRule.mode: "sign"` 的颜色及变化箭头与展示精度一致：舍入后零为普通文字且无箭头；显示非零才按正负映射颜色和方向。字段 `defaultFormat` 继承后遵循相同规则，显式绑定 `format` 仍优先。`fixed` 颜色继续按声明包含有效零。既有格式（包括 `percent-2-signed`）继续按原始值判断方向。仅影响展示，不修改查询、原始数据、计算或排序；6.16 可读但不能声明这些新格式。


## 按百万呈现

数值格式 `compact-million-0`、`compact-million-1`、`compact-million-2` 将原始值除以1,000,000，分别保留0、1、2位小数，使用千分位并附加“百万”。例如1,234,567分别显示“1百万”“1.2百万”“1.23百万”。仅改变展示，不改写数据源、查询或计算输入；小值仍按百万显示，不自动切回万/亿。空值显示“—”。

字段绑定示例（组件的 `main` 数据槽需绑定含 `revenue` 字段的数据源）：

```json
{ "data": "main", "field": "revenue", "format": "compact-million-2" }
```

也可在结果字段声明 `defaultFormat: "compact-million-2"`，由支持字段默认格式的组件继承；显式 `format` 优先。数值参数的文本引用可写 `{ "param": "target", "format": "compact-million-2" }`。当前 Schema 6.11 支持以上格式。

原始值必须以基础单位提供：金额字段若存人民币元，1,234,567元显示“1.23百万”，货币含义由字段标签或标题说明。不要把已经换算为百万的数据再次应用该格式；`unit: "百万"` 只是单位描述，不执行换算。`cny-adaptive` 保持原有自适应规则。

## 显式数字颜色与图表标签（6.16）

表格数字列及指标卡变化项可就地声明 `colorRule`。`{"mode":"fixed","color":"green"}` 对全部有效数字（包括零）固定染色；`{"mode":"sign","positive":"red","negative":"green"}` 按原始正负值映射；6.17新增的带符号普通数值格式按展示精度判断，见上节。颜色只接受 `red` / `green`；正负模式的零和所有模式的缺失值保持普通文字颜色。字段绑定必须为 `number` / `money`。同一字段在不同展示位置可使用不同规则，不从数据源或页面继承颜色。

`colorRule` 与表格 `visual: "signed"`、`dangerValues` 或指标卡旧 `tone` 同时声明时校验失败。旧页未使用新规则时保留旧染色与箭头行为；使用新规则的指标卡箭头独立按方向显示 ↑ / ↓；6.17新增的带符号普通数值格式按展示精度，其余按原始正负值，颜色不控制方向。

柱状图、折线图和柱线混合图可声明 `categoryLabels: {"mode":"all","rotate":45}`，全部展示完整类别名称，不自动抽样隐藏或默认缩放到前20个类别。`mode: "auto"` 保留原有类别显示策略；`rotate` 范围为 -90—90。横向柱状图作用于类别Y轴。

同类图表可声明 `showValueLabels: true`，逐柱或逐节点常驻显示对应格式化数值，零值显示，缺失不伪造节点。混合图逐系列显示。堆叠柱显示各段值。数字格式服从字段绑定 `format` 优先于 `defaultFormat`，与 tooltip 一致。不得同时开启旧 `showPointLabels` / `showSegmentLabels` / `showStackTotalLabels`，以免重复显示。旧开关继续可读。

常驻数字贴近对应柱端或折线节点；密集场景也不把数字移到远离节点的交错行，不使用全局垂直避让拉开距离。图例和绘图区的空间仍独立预留，不能用移动数字代替图例布局。

表格需要优先在正常尺寸容器内展示全部列时，显式声明 `fit: "container"`。列 `width` 在此模式下作为比例权重，表头及内容允许完整换行；保留文字和短数字所需的最小列宽，窄容器允许表格内部横向滚动，不强制均分或无限压缩。普通表格高度可随内容增长，适配不删除列、不以省略号替代正文；embedded 与 forecastMatrix 仍保留其专用呈现约束。`fit: "content"` 保留内容及像素列宽优先的行为。

旋转标签与数值标签可以使图表高度增加，数字标签不会通过隐藏重叠标签自动省略。系列图例、坐标轴名称与绘图区的间距由统一运行时根据直接容器计算；页面不声明像素位置。静态导出保留这些标签。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

6.15 新增 `period`：用于时间输入的统一展示，单点原值显示，范围“开始 至 结束”，同端点折叠为单点。`{filter, format:"period"}` 读取已应用状态；`{param, format:"period"}` 读取打开时的参数值。没有 period-compact 或自定义连接词。

<a id="field-selection"></a>

## 静态货币字段选择（6.38）

FieldBinding增加非递归`{byFilter:{filterId,cases:{RMB:{data:"main",field:"base-cny",format:"number-grouped"},USD:{data:"main",field:"base-usd",format:"number-grouped"}}}}`。cases叶子是原StaticFieldBinding（字符串或data/field/format/missingText/match对象），不能再次byFilter。控制筛选必须是required单选封闭枚举，cases穷尽有效选项，无默认货币兜底。FieldReference、导航行字段和compute输入仍是静态字段，不接受该分支。

校验遍历每个一致选择组合，覆盖非默认case的字段、槽、role、match、表格冲突及图表同轴货币。组合数量最多4096，超过时拆分页面。字段选择仅用于静态money字段；units存在时同case货币必须一致。运行和静态导出统一按已应用/捕获的筛选投影成静态叶子；没有合法选择时相关呈现等待选择，导出拒绝，不从首case猜货币。

所选字段的标签、单位和格式一起投影，覆盖对应表格列和金额消费者的旧单位文案；依赖该选择的表格清掉旧排序、表头条件、搜索和页码。XLSX在首次等待前冻结组件、筛选和所选case，保留基本单位数值与对应货币标题。图表、表格和计算仍保留两套静态字段，不将不同currency输入混加，也不用selectField制造伪CNY输出。

结果字段money支持显式CNY（元）和USD（美元）；currency不执行汇率转换。`usd-adaptive`显示带千分位、两位小数和“美元”，并非汇率换算；`cny-adaptive`继续人民币元/万/亿规则。金额格式必须与静态货币一致。已有组件另显示单位时优先number-grouped等纯数字格式，避免重复单位。

完整场景：[金额与币种](examples/currency-selection-page.json)。

字段选择投影只替换表格字段列标题与单位；显式指标行label、系列label/name和组件业务标题保持上下文含义。money自适应格式已带货币单位时不再追加独立unit，避免双重单位。

<a id="chart-constant-values"></a>

## 图表配置项常量取值（6.59）

柱图与折线图的每个 series 使用 field 或 value 二选一；饼图、地图与仪表的主数值使用 valueField 或 value 二选一。保留全部旧字段写法，不能将 value 嵌在 field 下。常量为有限数字或 null；地图 tooltipFields 和 pinnedSummary.fields 的展示项也支持标量 value。

```json
{"series":[{"field":"actual","label":"实际值"},{"value":2,"label":"基线"}]}
```

value:0 是有效常量；null 遵循该图表的缺失行为。常量可同级声明 format、unit、currency 和 missingText；字段分支的格式仍写在原绑定中。常量不继承其他系列的格式，不自动换算刻度；cny-adaptive/usd-adaptive 要求显式匹配的 CNY/USD。显式混合图的常量系列需要 unit，并继续校验同轴单位和币种。常量与普通系列一样参与堆叠、合计、图例、标签和tooltip；actual/forecast 仍受统计月边界约束。

多行位置沿当前行集逐项取常量，不改变查询或数据快照。饼图为每个现有类别取同一个值；地图为现有地域取值，不给底图中缺少记录的地域补数。结构字段（横轴、类别、地域身份、匹配、层级和 action 行引用）继续要求真实字段。仪表 props.value 可在未声明组件 data 时独立显示。

图表级 emptyBehavior 缺省/default 保持原空态；showConstants 在查询成功零行时允许呈现常量。该策略不绕过加载和错误，不补造类别、地域或业务行；空横轴折线仍保留空图。数据有行但数值均为 null 不属于零行；常量系列仍沿这些类别呈现。无数据源的纯常量仪表直接显示，不需要 showConstants。

沿真实行展开的常量点保留原行点击上下文；没有真实行时不制造字段或行身份。运行时和静态导出共用取值及空态规则。场景：[chart-constant-values-page](examples/chart-constant-values-page.json)，浏览器入口与步骤见 pages/capabilities/chart/README.md。

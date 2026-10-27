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


页面协议 6.66。结构真源为本册[schema.json](schema.json)，SHA256 `e7f5230350505dabd870d3a3fc2bc89260da817a02f5494721017a894035cce7`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6d657472696344617461"></a>

### `@metricData`

Schema位置：`#/definitions/metricData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["main"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963446174612f70726f706572746965732f6d61696e"></a>

### `@metricData.main`

Schema位置：`#/definitions/metricData/properties/main`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主数据槽，值引用已声明页面数据源。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963446174612f70726f706572746965732f636f6d70617265"></a>

### `@metricData.compare`

Schema位置：`#/definitions/metricData/properties/compare`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 对比数据槽。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963446174612f70726f706572746965732f746172676574"></a>

### `@metricData.target`

Schema位置：`#/definitions/metricData/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e67"></a>

### `@fieldBinding`

Schema位置：`#/definitions/fieldBinding`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f30"></a>

### `@fieldBinding · anyOf[0]`

Schema位置：`#/definitions/fieldBinding/anyOf/0`。目标：[#/definitions/staticFieldBinding](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/staticFieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e67"></a>

### `@staticFieldBinding`

Schema位置：`#/definitions/staticFieldBinding`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f30"></a>

### `@staticFieldBinding · anyOf[0]`

Schema位置：`#/definitions/staticFieldBinding/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f31"></a>

### `@staticFieldBinding · anyOf[1]`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["data","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f64617461"></a>

### `@staticFieldBinding · anyOf[1].data`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@staticFieldBinding · anyOf[1].field`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d697373696e6754657874"></a>

### `@staticFieldBinding · anyOf[1].missingText`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/missingText`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; maxLength=100 | Schema未设默认；装配/运行时默认见语义说明 | 字段缺值时的展示文字，不生成业务数值。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@staticFieldBinding · anyOf[1].format`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 只控制当前组件中这一次字段绑定的展示格式 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d61746368"></a>

### `@staticFieldBinding · anyOf[1].match`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/match`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["field","equals"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按声明维度等值选择行。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d617463682f70726f706572746965732f6669656c64"></a>

### `@staticFieldBinding · anyOf[1].match.field`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/match/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d617463682f70726f706572746965732f657175616c73"></a>

### `@staticFieldBinding · anyOf[1].match.equals`

Schema位置：`#/definitions/staticFieldBinding/anyOf/1/properties/match/properties/equals`。目标：[#/definitions/scalar](fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式相等匹配值。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f31"></a>

### `@fieldBinding · anyOf[1]`

Schema位置：`#/definitions/fieldBinding/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["byFilter"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f627946696c746572"></a>

### `@fieldBinding · anyOf[1].byFilter`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/byFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["filterId","cases"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | Schema6.38非递归字段选择；只选择已有静态money字段，所有case均校验。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f627946696c7465722f70726f706572746965732f66696c7465724964"></a>

### `@fieldBinding · anyOf[1].byFilter.filterId`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/byFilter/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 控制器必须为required单选封闭枚举，无未知值或首case回退。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f627946696c7465722f70726f706572746965732f6361736573"></a>

### `@fieldBinding · anyOf[1].byFilter.cases`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/byFilter/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 穷尽启用枚举项，每个case只能为静态FieldBinding，元数据与导出同已应用case。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f627946696c7465722f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@fieldBinding · anyOf[1].byFilter.cases{key}`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/byFilter/properties/cases/additionalProperties`。目标：[#/definitions/staticFieldBinding](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f7374617469634669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/staticFieldBinding | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f627946696c7465722f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@fieldBinding · anyOf[1].byFilter.cases · propertyNames`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/byFilter/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c65"></a>

### `@colorRule`

Schema位置：`#/definitions/colorRule`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f30"></a>

### `@colorRule · oneOf[0]`

Schema位置：`#/definitions/colorRule/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","color"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f302f70726f706572746965732f6d6f6465"></a>

### `@colorRule · oneOf[0].mode`

Schema位置：`#/definitions/colorRule/oneOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="fixed" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "fixed" | 用于选择@colorRule · oneOf[0].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f302f70726f706572746965732f636f6c6f72"></a>

### `@colorRule · oneOf[0].color`

Schema位置：`#/definitions/colorRule/oneOf/0/properties/color`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["red","green"] | Schema未设默认；装配/运行时默认见语义说明 | 固定数字颜色，只接受red/green；缺失值不染色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "red" | 统一主题的红色，业务含义由当前声明确定。 |
| "green" | 统一主题的绿色，业务含义由当前声明确定。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f31"></a>

### `@colorRule · oneOf[1]`

Schema位置：`#/definitions/colorRule/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","positive","negative"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f312f70726f706572746965732f6d6f6465"></a>

### `@colorRule · oneOf[1].mode`

Schema位置：`#/definitions/colorRule/oneOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="sign" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "sign" | 用于选择@colorRule · oneOf[1].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f312f70726f706572746965732f706f736974697665"></a>

### `@colorRule · oneOf[1].positive`

Schema位置：`#/definitions/colorRule/oneOf/1/properties/positive`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["red","green"] | Schema未设默认；装配/运行时默认见语义说明 | 原始数值大于零时使用的颜色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "red" | 统一主题的红色，业务含义由当前声明确定。 |
| "green" | 统一主题的绿色，业务含义由当前声明确定。 |

<a id="schema-232f646566696e6974696f6e732f636f6c6f7252756c652f6f6e654f662f312f70726f706572746965732f6e65676174697665"></a>

### `@colorRule · oneOf[1].negative`

Schema位置：`#/definitions/colorRule/oneOf/1/properties/negative`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["red","green"] | Schema未设默认；装配/运行时默认见语义说明 | 原始数值小于零时使用的颜色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "red" | 统一主题的红色，业务含义由当前声明确定。 |
| "green" | 统一主题的绿色，业务含义由当前声明确定。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e6365"></a>

### `@fieldReference`

Schema位置：`#/definitions/fieldReference`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f30"></a>

### `@fieldReference · anyOf[0]`

Schema位置：`#/definitions/fieldReference/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f31"></a>

### `@fieldReference · anyOf[1]`

Schema位置：`#/definitions/fieldReference/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["data","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f312f70726f706572746965732f64617461"></a>

### `@fieldReference · anyOf[1].data`

Schema位置：`#/definitions/fieldReference/anyOf/1/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@fieldReference · anyOf[1].field`

Schema位置：`#/definitions/fieldReference/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61696e44617461"></a>

### `@mainData`

Schema位置：`#/definitions/mainData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["main"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61696e446174612f70726f706572746965732f6d61696e"></a>

### `@mainData.main`

Schema位置：`#/definitions/mainData/properties/main`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主数据槽，值引用已声明页面数据源。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f72794c6162656c73"></a>

### `@categoryLabels`

Schema位置：`#/definitions/categoryLabels`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f72794c6162656c732f70726f706572746965732f6d6f6465"></a>

### `@categoryLabels.mode`

Schema位置：`#/definitions/categoryLabels/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["auto","all"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "auto" | 由当前组件既有自动规则选择。 |
| "all" | 全部类别名称同时呈现，不自动隐藏或只展示前20个。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f72794c6162656c732f70726f706572746965732f726f74617465"></a>

### `@categoryLabels.rotate`

Schema位置：`#/definitions/categoryLabels/properties/rotate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | minimum=-90; maximum=90 | Schema未设默认；装配/运行时默认见语义说明 | 类别标签旋转角度，范围-90到90。 |

<a id="schema-232f646566696e6974696f6e732f7461626c6544617461"></a>

### `@tableData`

Schema位置：`#/definitions/tableData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1; required=["main"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65446174612f6164646974696f6e616c50726f70657274696573"></a>

### `@tableData{key}`

Schema位置：`#/definitions/tableData/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65446174612f70726f70657274794e616d6573"></a>

### `@tableData · propertyNames`

Schema位置：`#/definitions/tableData/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](errors/data-slot-unknown-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](errors/field-binding-undeclared-slot.json)、[unknown-component-field](errors/unknown-component-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](errors/field-binding-role-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](errors/match-field-unknown.json)、[match-field-not-dimension](errors/match-field-not-dimension.json)、[match-value-type-mismatch](errors/match-value-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `explicit-color-local`：显式颜色只绑定数字且不与旧染色声明冲突。反例：[color-rule-legacy-conflict](errors/color-rule-legacy-conflict.json)、[color-rule-nonnumeric](errors/color-rule-nonnumeric.json)、[color-rule-tone-conflict](errors/color-rule-tone-conflict.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `chart-value-label-exclusive`：常驻数值标签不与旧标签重复启用。反例：[value-label-bar-conflict](errors/value-label-bar-conflict.json)、[value-label-line-conflict](errors/value-label-line-conflict.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `presentation-capability`：颜色与图表标签声明由6.16引入。反例：[presentation-before-6.16](errors/presentation-before-6.16.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `signed-number-format-capability`：带符号普通数值格式由6.17引入。反例：[signed-number-binding-before-6.17](errors/signed-number-binding-before-6.17.json)、[signed-number-default-before-6.17](errors/signed-number-default-before-6.17.json)、[signed-number-param-before-6.17](errors/signed-number-param-before-6.17.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `signed-number-family-capability`：两位小数与千分位带符号数值格式由6.18引入。反例：[signed-number-two-decimal-before-6.18](errors/signed-number-two-decimal-before-6.18.json)、[signed-number-grouped-before-6.18](errors/signed-number-grouped-before-6.18.json)、[signed-number-family-param-before-6.18](errors/signed-number-family-param-before-6.18.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `currency-selection`：6.38金额范围和静态货币字段选择。反例：[currency-before-6.38](errors/currency-before-6.38.json)、[currency-case-missing](errors/currency-case-missing.json)、[currency-metric-mismatch](errors/currency-metric-mismatch.json)、[currency-negative-default](errors/currency-negative-default.json)、[currency-equal-default](errors/currency-equal-default.json)、[currency-compute-mixed](errors/currency-compute-mixed.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [million-formats-page](examples/million-formats-page.json)：完整合法页面；查询仅为静态契约证据。
- [compute-page](examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [explicit-presentation-page](examples/explicit-presentation-page.json)：完整合法页面；查询仅为静态契约证据。
- [signed-number-page](examples/signed-number-page.json)：完整合法页面；查询仅为静态契约证据。
- [signed-number-family-page](examples/signed-number-family-page.json)：完整合法页面；查询仅为静态契约证据。
- [currency-selection-page](examples/currency-selection-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-values-page](examples/chart-constant-values-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-branches](examples/chart-constant-branches.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）

- `#/definitions/fieldBinding/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/sections/0/components/0/props/rows/0/valueField`。
- `#/definitions/staticFieldBinding/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/sections/0/components/0/props/rows/0/valueField`。
- `#/definitions/staticFieldBinding/anyOf/1`：[合法完整页面](examples/component-metricCard-primaryDetail.json)，JSON Pointer `#/sections/0/components/0/props/rows/0/valueField`。
- `#/definitions/fieldBinding/anyOf/1`：[合法完整页面](examples/time-binding-branches-page.json)，JSON Pointer `#/sections/0/components/0/props/rows/0/valueField`。
- `#/definitions/colorRule/oneOf/0`：[合法完整页面](examples/explicit-presentation-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/2/colorRule`。
- `#/definitions/colorRule/oneOf/1`：[合法完整页面](examples/explicit-presentation-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/1/colorRule`。
- `#/definitions/fieldReference/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/2/props/actions/0/field`。
- `#/definitions/fieldReference/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/actions/0/field`。

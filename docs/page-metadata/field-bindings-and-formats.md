# 数据槽、字段绑定与格式

data槽把组件关联到页面数据源；字段绑定引用该槽中的结果字段，可用显式source指定受支持的其它槽。match按声明维度取值选择对应行，不能充当通用查询表达式。

组件绑定的显式format优先；未声明时先按可信字段类型、币种、单位及语义格式选择统一规则，再回退字段defaultFormat；不从指标名或字段id猜测。number保留数值语义，number-1/2控制小数位，number-grouped千分位；compact-wan/yi是数量单位缩放。percent-*直接以原数值加百分号，0.42不自动变42%；需要ratio.scale:100或正确的原始刻度。

text不执行HTML，日期格式只格式化日期值。语义HTML须用专用字段类型。

<a id="numeric-value-display"></a>

## 整数与缺失值的统一显示

系统缺失占位符统一为 `--`：两个相邻的 ASCII 短横线（U+002D），不含空格。表格、指标卡、进度环、仪表、图表画布及悬浮提示使用同一文案，百分比缺失也只显示 `--`，不追加百分号或数值单位。旧 `—`、`–`、`-`、`- -`、`--%`、`- -%` 占位符在缺失时归一；其他显式业务 `missingText` 保留。真实字符串不改写。null、undefined 和非有限数值是缺失；0、false 仍为真实值。空结果的“暂无数据”状态保持。

所有数值预设在原精度、千分位及单位换算后，舍弃小数末尾零；若小数部分全为零，就省略小数点。例如 `number-2` 的 50 显示 `50`，`percent-1/2` 的 50 均显示 `50%`，`compact-wan-1` 的 10000 显示 `1万`。舍入后成为整数也遵循此规则；非整数按声明精度四舍五入后舍弃小数末尾零，如 `number-2` 的 12.5 显示 `12.5`。带符号、金额、百分点与图表默认格式共用这一规则，仅改变展示文本，不改变原值、计算、排序或导出数值类型。

完整合成场景 `/pages/numeric-value-display` 覆盖表格、指标卡、缺失进度环、整数百分比、真实零、负数、单位缩放和自定义缺失文案；图表标签、提示和坐标轴在 `/pages/chart-number-format` 对照。


## 统一语义格式（6.93）

不增加字段；复用 `format` / `defaultFormat` 和现有类型、币种、单位，补充封闭格式预设。组件显式 `format` 始终优先；新语义预设的 `defaultFormat` 可显式区分单位相同但用途不同的指标，其次才按字段语义选档。money 的 currency 决定 CNY/USD，原始金额保持基本货币单位。数值的百分号单位或百分比来源格式表示 0–100 刻度。人/户/个默认计数，核/卡/台默认资源量，分钟默认套餐时长，条默认消息；Bytes/KB至YB及对应bit或每秒单位默认容量/速率。没有可信单位的普通number沿用既有格式，不猜测。

所有阈值先按原始绝对值选档，再四舍五入，保留负号；小数末尾零舍弃。移动端按宿主视口宽度不超过760px识别，PC/SSR默认使用PC档；窄PC组件仍按PC档。人民币1万至10万仅此一档在移动端和PC有精度差异。

| 类型/格式 | 按原始绝对值选档 |
|---|---|
| `cny-adaptive` | <1万：整数元；1万至10万：移动最多1位/PC最多2位小数万；10万至1亿：整数万；1亿至10亿：最多2位小数亿；10亿起：最多1位小数亿 |
| `usd-adaptive` | <1万：整数美元；1万至100万：最多1位小数K；100万至1亿：整数K；1亿起：整数M。两端一致，不换汇 |
| `percent-adaptive` / `percent-adaptive-signed` | <10%：最多2位小数，微小非零值增加到首个非零小数位，0.001%保留；10%至100%：最多1位；100%至500%：整数；500%起显示“上升>500%”/“下降>500%”。signed普通正值加+，零无符号；两端一致 |
| `percent-raw` | 个性化百分比保留原始精度并附加%，99.999显示99.999%，0.001显示0.001%；不乘100 |
| `count-adaptive` | <1万：整数；1万至10万：最多1位小数万；10万起：整数万，保留声明单位 |
| `resource-adaptive` | <1万：整数原单位；1万至1亿：最多2位小数万原单位；1亿起：最多2位小数亿原单位 |
| `bytes-adaptive` | 按声明输入单位做1024级进，Bytes、KB、MB、GB、TB、PB、EB、ZB、YB；基本单位取整，其余最多2位小数。bit和byte不互换，/s不丢失；超过YB仍以YB显示 |
| `minutes-adaptive` | <1000分钟：整数分钟；1000至10000分钟：最多2位小数千分钟；10000起：最多2位小数万分钟 |
| `messages-adaptive` | <1万条：整数条；1万起：最多2位小数万条 |
| `billing-hours` | 明确以秒为原值，除以3600显示最多2位小数小时；即使原始field.unit为秒，展示也为小时。不得对已是小时的值再次使用 |

资源TB和存储TB使用相同基础单位时，通过 `defaultFormat:"resource-adaptive"` 显式选择前者；默认TB为存储容量。计费必须显式选择 `billing-hours`，不能仅看到秒就推断为计费。人力精确到个人时，组件写 `format:"number-grouped"` 并声明单位“个”；不会缩放为万。资源率明确写 `format:"percent-2"` 保持最多两位精度；SLO/SLA可写 `format:"percent-raw"`，保留99.999或0.001等原始精度。小于1e-20的自适应百分比保留原始科学计数文本，避免归零。

同比/环比沿已有 `delta` 后 `ratio(scale:100)` 声明：当 ratio 的分子引用前序 delta 输出，分母与该 delta 的减数字段相同时，引擎识别为相对变化；基期缺失、零或负数时返回null并显示 `--`，不依赖 `onZeroDenominator` 伪造零。一般 ratio 相除保留原有正负分母及零处理。比率变化项显示正负号，指标卡默认不显示趋势箭头，表格按显式 `arrowRule` 决定；绝对变化项沿原规则。展示格式和单位缩放不改变计算、筛选、排序、原始行或Excel数值类型；Excel的自适应文字为导出时冻结的显示格式。

完整内联合成入口 `/pages/semantic-numeric-display` 展示上述规则、移动/PC切换、显式例外、增长基期和图表缺失字符；不代表真实DQE或线上发布。


## 百分比创作与覆盖边界

创作工具使用可信 `scale: "percent"`，或无冲突的 `%` / `％` 原始单位，确认原值已是百分数刻度。完整、部分和未知覆盖均可默认采用 `percent-2`；覆盖率只限制依赖全量分布的紧凑尺度推断。来源 `defaultFormat: "number*"` 是显示建议，不能覆盖已确认的百分数刻度；工具改用 `percent-2` 并返回 `PRESENTATION_FORMAT_ADJUSTED`，关联数据源和字段身份。来源原始描述保留。`fraction`、`unknown` 和已缩放刻度不能据名称猜为百分数，也不自动乘100。

组件显式 `format` 仍优先，已有页面或没有来源描述的显式默认格式保持；本批不重写已有页面或保存规则。组件显式 `percent-0/1/2` 保持对应最大精度，微小非零值如 `0.0001` 显式用 `percent-2` 显示 `0%`；作为来源默认建议时按统一语义规则自适应显示 `0.0001%`。工具保留百分号及原值，并返回 `PRESENTATION_PRECISION_LIMIT`，不改成无单位的 number 来掩盖限制；需要核对时可在明细列显式用 `number` 查看原值。零与缺失分别显示 `0%` 与缺失文案。

场景 `/pages/authoring-percent-coverage` 使用程序格式决策对应的 inline 合成数据：12.5 显示 12.5%，微小正负值按自适应精度显示，在相邻原值列可核对，显式 `percent-1` 显示 12.5%。它验证渲染与覆盖优先级；真实查询覆盖、格式调整和精度告警由查询回归验证，不代表真实 DQE 或 Relay 已接入。local 直接编辑页面沿此相同格式语义，静态校验不宣称已验证来源业务刻度。

## 带符号普通数值（6.17起）

全部 `number` 格式都有对应的带符号版本，保留原格式的精度与千分位规则：

| 原格式 | 带符号格式 | 版本下限 | 正数示例 | 零值示例 |
|---|---|---|---|---|
| `number` | `number-signed` | 6.17 | `+1.234` | `0` |
| `number-1` | `number-1-signed` | 6.17 | `+1.2` | `0` |
| `number-2` | `number-2-signed` | 6.18 | `+1.23` | `0` |
| `number-grouped` | `number-grouped-signed` | 6.18 | `+1,234.568` | `0` |

`number-2-signed` 的 `±0.004` 均显示 `0`，`±0.005` 分别显示 `+0.01`、`-0.01`。`number-grouped-signed` 沿用当前千分位格式默认最多三位小数的舍入策略，`±0.0004` 均显示 `0`，`±0.0005` 分别显示 `+0.001`、`-0.001`。所有带符号普通数值格式共用零值的符号、正负颜色及变化箭头规则。

`number-signed` 保留 `number` 的原始数值精度，正数加 `+`、负数保留 `-`、零无符号；`number-1-signed` 保留一位小数后判断符号。`1.24` 显示 `+1.2`，`-1.24` 显示 `-1.2`，`0.04`、`-0.04` 与负零均显示 `0`。不乘100、不追加百分号，适用于天数或次数的绝对变化。单位仍由组件的单位声明提供。空值及非有限数值显示缺失文案。

```json
{ "data": "main", "field": "avg-decision-time-change", "format": "number-1-signed" }
```

表格数字列与指标卡变化项采用以上格式时，`colorRule.mode: "sign"` 的颜色及变化箭头与展示精度一致：舍入后零为普通文字且无箭头；显示非零才按正负映射颜色和方向。字段 `defaultFormat` 继承后遵循相同规则，显式绑定 `format` 仍优先。`fixed` 颜色继续按声明包含有效零。既有格式（包括 `percent-2-signed`）继续按原始值判断方向。仅影响展示，不修改查询、原始数据、计算或排序；6.16 可读但不能声明这些新格式。


## 按百万呈现

数值格式 `compact-million-0`、`compact-million-1`、`compact-million-2` 将原始值除以1,000,000，分别保留0、1、2位小数，使用千分位并附加“百万”。例如1,234,567分别显示“1百万”“1.2百万”“1.23百万”。仅改变展示，不改写数据源、查询或计算输入；小值仍按百万显示，不自动切回万/亿。空值显示“--”。

字段绑定示例（组件的 `main` 数据槽需绑定含 `revenue` 字段的数据源）：

```json
{ "data": "main", "field": "revenue", "format": "compact-million-2" }
```

也可在结果字段声明 `defaultFormat: "compact-million-2"`，由支持字段默认格式的组件继承；显式 `format` 优先。数值参数的文本引用可写 `{ "param": "target", "format": "compact-million-2" }`。当前 Schema 6.11 支持以上格式。

原始值必须以基础单位提供：金额字段若存人民币元，1,234,567元显示“1.23百万”，货币含义由字段标签或标题说明。不要把已经换算为百万的数据再次应用该格式；`unit: "百万"` 只是单位描述，不执行换算。`cny-adaptive` 按统一语义金额规则呈现。

## 显式数字颜色与图表标签（6.16）

表格列从6.99起可独立声明 `arrowRule`，支持与 `colorRule` 对称的固定规则和按正负映射规则：上箭头、下箭头或不显示均由声明决定，不由颜色推导。sign 的零/缺失不显示，fixed 包含有效零但排除缺失；精度判断复用数值方向语义。默认箭头前置，`position:"after"` 可后置，屏幕与 Excel 顺序一致。声明与导出见[列级上下箭头](components/table.md#table-trend-arrows)，入口 `/pages/table-trend-arrows`。

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

结果字段money支持显式CNY（元）和USD（美元）；currency不执行汇率转换。`usd-adaptive`按统一美元/K/M档位显示，并非汇率换算；`cny-adaptive`继续人民币元/万/亿规则。金额格式必须与静态货币一致。已有组件另显示单位时优先number-grouped等纯数字格式，避免重复单位。

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

## 百分点差值（6.77）

`points-1-signed` 将已计算的百分点差值显示为 `+10P`、`-2.5P` 或 `0P`，保留一位小数，不乘100。输入比例若采用0–1刻度须先在指标契约中明确转换为百分点刻度；不自动猜测。空值显示缺失文案，舍入为零时不带正负号，方向和颜色同样为中性。它仅格式化数值，不改变计算、排序和筛选。示例 `/pages/period-comparison-demo`。

<a id="chart-number-format"></a>

## 柱线图数值格式一致性

柱状图、折线图及柱线混合图的数值标签和悬浮提示统一调用通用格式化：组件字段绑定 `format` 优先，其次字段 `defaultFormat`；常量使用自身 `format`。字段或常量均未声明格式时，默认采用 `number-2`，非整数保留两位小数；不自动分组或缩放为万。显式 `number` 可保留原值。真实零保留；缺失节点不补零，悬浮提示使用绑定的 `missingText` 或“--”。系列图例显示名称，名称中的数字不作为度量格式化。

同一数值轴上的系列格式一致时，刻度使用该格式；格式不一致时，刻度使用不带单位的 `number-2`，各系列标签和悬浮提示仍保留各自格式。隐藏轴及显式高级呈现配置继续遵循原声明。

旧 `showSegmentLabels`、`showStackTotalLabels`、`showPointLabels` 也遵循上述优先级；`reportForecast` 不再隐式将无格式的轴和标签缩放为万。依赖旧隐式万单位的页面需在字段或绑定中显式声明 `compact-wan-0`；已声明格式的页面行为不变。本次修正呈现默认行为，不新增字段或 Schema 版本，也不改变原始数值、查询和排序。

验收入口：`/pages/chart-number-format`，内联合成数据，覆盖默认两位小数、零、负值、缺失、格式继承和显式保留原值。

## 同比格式（6.87）

`yoy-p-signed` 是固定的同比展示预设，先将原始数值四舍五入保留两位小数，再乘100，以无千分位的整数追加大写 `P`。例如 `0.123456 → 0.12 → +12P`、`-0.05678 → -0.06 → -6P`、`0.29 → +29P`。它不执行同比计算，也不猜测输入刻度；只改变展示，计算、排序和筛选仍使用原值。需要已经采用0–100刻度、不乘100的百分点差值时，沿用 `points-1-signed`。

表格列示例：

```json
{
  "field": { "data": "main", "field": "yoy", "format": "yoy-p-signed" },
  "colorRule": { "mode": "sign", "positive": "red", "negative": "green" }
}
```

也可声明数值结果字段的 `defaultFormat: "yoy-p-signed"`，显式绑定格式优先。正负号、按正负着色和变化箭头共用舍入后的方向；`±0.004`、`0` 和负零均显示 `0P`，无符号、普通颜色、无箭头；`±0.005` 分别显示 `+1P`、`-1P`。固定颜色规则仍按已有约定为有效零着色。缺失值显示 `--` 或绑定的 `missingText`。仅6.87及以后可声明，旧版本使用时报能力版本错误，原有格式保持原行为。

合成验收入口 `/pages/yoy-p-format-demo`，无需查询服务或URL参数。运行 `pnpm dev:playground` 后打开该路由，核对原值列、显式格式列和字段默认列；正值红色、负值绿色，零与缺失值普通颜色。

## 金额去尾零与美元KM（6.88）

新增三种显式格式；`cny-adaptive` 和 `usd-adaptive` 从6.93起遵循上面的统一语义规则；本节三个显式个性化格式保留自身精度和单位。基础金额仍为元或美元，不执行汇率换算。按币种选择两个静态 money 字段，不能仅给同一个数值换符号。万元/K 预缩放数据须在进入货币金额字段前还原基本单位，不能重复缩放。

| 格式 | 币种 | 规则 |
|---|---|---|
| `cny-adaptive-trimmed-no-yuan` | CNY | 人民币 A：小额无“元”，万/亿带单位 |
| `cny-adaptive-trimmed` | CNY | 人民币 B：小额带“元”，万/亿带单位 |
| `usd-adaptive-km` | USD | 美元 $/K/M，符号均在数字后 |

人民币两种格式都按原始绝对值选档：＜1万取整；1万～＜10万除1万，最多1位小数；10万～＜1亿除1万取整；1亿～＜10亿除1亿，最多2位小数；≥10亿除1亿，最多1位小数。两种格式只在万元以下的“元”后缀上不同。

美元按原始绝对值选档：＜1万取整加 `$`；1万～＜100万除1000，最多1位小数加 `K`；100万～＜1亿除1000取整加 `K`；≥1亿除100万取整加 `M`。

数字部分一律去尾零、加千分位。对绝对值四舍五入后恢复负号，正数不加 `+`；原始负零和舍入后的零不带负号。舍入不重新选档：9,999.6美元显示 `10,000$`，99,999,999元显示 `10,000万`，不是重新提升单位。±105,000元分别显示 `11万`、`-11万`；±1,005,500美元分别显示 `1,006K`、`-1,006K`。这些为明确规范化的业务规则，不复刻旧系统字符串位数和负数 Math.round 的偶然行为。

```json
{
  "valueField": {
    "byFilter": {
      "filterId": "currency",
      "cases": {
        "RMB": { "data": "main", "field": "amount-cny", "format": "cny-adaptive-trimmed" },
        "USD": { "data": "main", "field": "amount-usd", "format": "usd-adaptive-km" }
      }
    }
  }
}
```

`amount-cny` 声明 `type:"money", role:"measure", currency:"CNY"`；`amount-usd` 声明相应 USD；currency 筛选为 required 单选封闭枚举。默认格式、直接组件绑定、非默认 byFilter case 和图表常量都检查币种一致性。数值参数也可显式使用这些格式；组件绑定优先于字段 defaultFormat。选择投影抑制重复的独立单位文案；小额无“元”的 A 格式也不额外补“元”。

合成页面 `/pages/operation-money-formats` 同时展示人民币 A/B、美元和旧格式，并以币种筛选驱动指标卡、图表和表格。屏幕及静态呈现消费同一格式函数；XLSX 保留基本单位原数值与币种标题，不把 `2.5亿`、`250M` 当作金额数据写回。此场景只证明本地合成数据、展示及导出，不代表真实 Operation Map、DQE、Relay 或部署验收。完整声明见[合成验收页](examples/operation-money-formats.json)，启动与操作见仓库 pages/capabilities/data/README.md。

<a id="display-unit"></a>

## 图表系列与表格列展示单位（6.94）

柱/线/混合图用 `series[].unit`：图例为“审批时长（天）”，标签及提示为“12.5 天”；非空单位使单系列也显示图例。表格字段列 `unit` 作用于主数值与置顶汇总，支持列组及展开子表；次字段、徽标、枚举、异常回退原文不追加。饼图沿用 `legend.columns[].unit`。

```json
{"type":"barChart","id":"duration-chart","layout":{"span":6},"data":{"main":"sample"},"props":{"categoryField":"category","series":[{"field":{"data":"main","field":"duration","format":"number-1"},"label":"审批时长","unit":"天"}],"showValueLabels":true}}
```

```json
{"type":"table","id":"duration-table","layout":{"span":12},"data":{"main":"sample"},"props":{"columns":[{"field":{"data":"main","field":"duration","format":"number-1"},"title":"审批时长","unit":"天"}]}}
```

以上声明要求 `sample` 含有类别与数值字段。单位是组件局部展示声明，不从结果字段契约 `unit` 自动追加，不改变查询、数值、计算、排序、筛选或货币语义；币种字段选择保留显式局部单位。未声明时保留原呈现。空字符串表示不追加；有效零与负值追加，缺失与非数字保留原文。数值轴保留原格式，不逐刻度追加本单位。

`format` 独立负责精度及缩放。`compact-wan-1` 与 `unit:"万元"` 将原值125000显示为“12.5 万元”，运行时合并预设“万”与显式“万元”的重叠后缀；`percent-1` 与 `unit:"%"` 保持“25%”。格式已完整包含指定单位时不再追加，其他单位在格式化结果后以一个空格连接，不猜测业务换算。Excel 保留基本单位数值，通过单元格数字格式展示捕获的单位文本；PNG/PDF沿运行时呈现。

`/pages/chart-table-unit` 的 inline 合成场景覆盖柱线混合图、饼图图例、分组列、汇总、缩放、百分号、零、负值及缺失；不代表真实 DQE/Relay。

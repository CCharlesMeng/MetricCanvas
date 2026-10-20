# 查询定义与显式绑定

当前受控查询语言为DQE。查询体遵循真实协议分支，模型不得拼任意SQL或表达式。filterBindings对象键引用页面筛选器；dimension目标必须声明queryField，time目标不带window时绑定时间范围，带window时绑定时间点。页面字段id、筛选器dimension和DQE字段属于不同空间。

未绑定到某源的筛选变化不触发该源；绑定字段须存在于合法查询位置。paramBindings用于6.2维度初始化，目标唯一、共享源显式声明，不与同目标静态条件或多个参数竞争。页面只声明目标，不声明服务权限。

6.13 的 filterBindings `{target:"time",window:...}` 引用 timePoint，窗口使用明确的 period/yearToDate/monthToDate/lastN 等声明，保留查询 period/is_aggregate。没有 window 的 time 目标仍引用 timeRange。查询时间只能有一个筛选来源；窗口精度不隐式转换，绑定不得与固定起止/参数引用并存。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 查询结果绑定 6.14

query.resultBindings在下游查询声明source、field、target dimension、queryField和maxValues；读取上游查询的原始归一化string/number维度，去重集合作为普通维度谓词。每查询仍只有一项dsl_list。空上游不发请求；未知字段、计算产出、目标冲突、循环和超限拒绝；最大集合1000。上游须完整、声明有限limit且无offset，或在6.20声明查询分页窗口；局部表格视图不改变输入。新增级联链不复用缺输入证明的initial。

## 查询输入行过滤 6.19

每个 `resultBindings` 可以增加可选 `where`，先在该绑定的 `source` 原始归一化结果中筛行，再提取 `field`。上游完整结果保持不变，多个下游可各自筛选；缺省where沿用全部原始行。过滤字段可为原始维度或度量，提取字段仍为原始string/number维度，目标仍为dimension。过滤及提取不消费compute产出，不读取局部表格视图。

```json
{"source":"projects","field":"project-id","target":"dimension","queryField":"项目编号","maxValues":500,"where":{"all":[{"field":"status","op":"eq","value":"进行中"},{"field":"amount","op":"gt","value":1000000}]}}
```

条件节点严格互斥：非空all/any组合，或field/op叶子。eq/ne使用value，in/notIn使用非空values，gt/gte/lt/lte使用数值value，isNull/isNotNull不声明value。最多4层组合、64个叶子，每个values最多1000项。字段必须来自同一上游并有queryField映射，数组明细和语义HTML不能参与。日期/时间支持合法契约字符串的等值与集合匹配，不支持有序比较。

字面量必须与字段类型相符：number/money为有限数值，boolean为布尔，string/date/datetime为字符串；有序比较只允许number/money。比较使用原始单位，不进行展示舍入、类型转换或字符串裁剪。null在所有普通比较中均不匹配，包括ne/notIn；需要空值使用isNull。首版仅字面量，不支持筛选器/页面参数引用、表达式、函数或字段路径。

先核验原始声明范围与字段契约，再过滤、提取、去重与排序，最后检查maxValues；上限只限制最终去重集合。过滤后空集合跳过下游请求，不删除条件后查询全部。选中行提取字段无效仍报错；原始响应契约违规不因过滤隐藏。Top5只在该5行内过滤；6.20起也可在本轮查询分页窗口内过滤。

导出用本轮原始结果执行同一规则，输入规则不写用户筛选或URL。多个绑定是独立集合条件的AND，不能替代组合键匹配。完整复用例子见本模块query-result-where-page示例；真实DQE/Relay接入与模型创作需各自验收。

## 排序与查询分页驱动结果绑定 6.20

显式query分页表格的查询数据源可以作为resultBindings的source。沿用现有绑定字段，不增加inputScope，也不传上游页码给下游。分页源的DQE order声明正整数limit及offset:0，不声明resultScope:complete；下游where仅筛本轮实际返回的窗口，再提取field的去重集合。totalCount表示全部匹配行数，可大于窗口行数。

任意已映射的可排序列、方向及多列优先级变化，都会重置该数据源到第一页。服务端先排序后分页；运行时按结果绑定依赖图使受影响查询失效，等输入就绪后更新，各分支可并行。翻页与改每页条数遵循同一机制，受影响的下游分页查询也回到第一页。只改变行次序、最终输入集合相同，可以复用缓存。无依赖的查询保持原状。

窗口大小按本轮实际请求核验，包括交互修改后的每页条数；空集合、错误传播、超限与迟到结果保护沿用既有规则。完整结果和固定TopN仍保留原范围约束。窗口源不能承担grandTotal、groupSubtotal或timeFill的全量统计。局部展示排序不作为查询结果绑定输入。

共享单次执行使用第一页窗口；导出固定捕获时的查询页、大小、排序，并重新取该窗口与依赖结果，不隐式扩大为全量。该组合的能力下限为6.20，旧版本使用明确拒绝。

## 配置解读：首轮查询、任意列排序与分页级联

以下是6.20完整示例query-result-page-window-page的关键片段，省略了其余结果字段与展示属性，不能把片段单独当作完整页面。三个数据源分别是projects、details-high和details-low；表格通过data.main消费对应数据源，查询通过resultBindings声明输入依赖。

### 1. 页面字段与查询字段映射

```json
{
  "project-id": {"type":"string","role":"dimension","queryField":"项目编号","nullable":true},
  "amount": {"type":"money","role":"measure","queryField":"金额","currency":"CNY","unit":"元","nullable":false,"defaultFormat":"number-grouped"},
  "duration": {"type":"number","role":"measure","queryField":"时长","unit":"天","nullable":true}
}
```

columns[].field、resultBindings[].field和where.field使用页面字段id；DQE output_dims、output_metrics、order与下游谓词使用查询字段名。点击执行周期列时提交duration，通过queryField映射为时长。where中的金额阈值使用原始元值，展示格式不改变比较值。

### 2. 首轮查询与窗口大小

projects.source.query的DQE查询体声明202610月份、需要的输出维度和度量，order为：

```json
{"by":[{"field":"金额","type":"desc","priority":1}],"limit":10,"offset":0}
```

初始金额降序只是默认查询顺序。服务端先对全部匹配项目排序，再取前10行。每页10条时，第3页的生效查询offset为20；改变任何已声明可排序列后，排序规则更新且offset回到0。Shift追加多列排序，priority按提交次序从1开始。运行时的页码、页大小与排序变化形成生效查询，不写回页面模板。

分页源不声明resultScope:complete。响应totalCount表示全部匹配行数，例如80；rows只包含本轮窗口，例如10行。页面JSON保存查询定义，80行演示数据由本地DQE仿真返回，不是页面内嵌的inline行。

### 3. 表格接通查询分页与列排序

```json
{
  "data":{"main":"projects"},
  "props":{
    "columns":[
      {"field":"project-id","title":"项目编号","sortable":true},
      {"field":"duration","title":"执行周期（天）","sortable":true}
    ],
    "pagination":{"mode":"query"},
    "rowKey":"project-id"
  }
}
```

data.main选择数据源，sortable开放列头交互，pagination.mode=query使排序和翻页提交新的查询。首轮每页大小来自order.limit，交互修改后使用本轮实际大小。rowKey用于识别表格行，不代替查询结果绑定的field。

本例项目清单的五列都开放查询排序。下方评估表声明pagination.mode=none，其列头排序只调整已返回完整结果的展示顺序；本例也没有查询依赖评估表。要让其他表格成为查询联动起点，需要按相同方式声明查询分页及被下游消费的结果绑定。

### 4. 下游独立过滤与字段提取

下面片段位于details-high.source.query.resultBindings：

```json
[{
  "source":"projects",
  "field":"project-id",
  "target":"dimension",
  "queryField":"项目编号",
  "maxValues":500,
  "where":{"all":[
    {"field":"status","op":"eq","value":"进行中"},
    {"field":"amount","op":"gt","value":3000000}
  ]}
}]
```

| 配置 | 含义 |
|---|---|
| source | 本轮原始行来自projects。查询分页时仅为当前窗口。 |
| where.all | 同时满足进行中与金额大于300万元；不删除projects中的行。 |
| field | 过滤后提取project-id。提取目标仍为原始string/number维度。 |
| target与queryField | 在下游DQE项目编号维度位置追加集合条件，不是改写上游查询。 |
| maxValues | 最终去重集合最多500项；不是分页大小，协议硬上限为1000。 |

假设筛出P-041与P-056，下游filter.dims补入：

```json
[{"dim_name":"项目编号","dim_value_list":["P-041","P-056"]}]
```

下游只收到编号集合，上游排序规则、offset和limit不作为绑定参数传给下游。金额用于过滤，并不作为下游指标条件。details-low使用同样的状态条件与amount lte 3000000，因此两个下游独立消费同一个窗口，可以并行查询。筛出空集合时跳过该下游请求，呈现空结果，不省略条件后查询全量。

两组评估源声明resultScope=complete，表示返回本轮选中编号条件下的完整评估结果，不表示查询所有项目。projects的当前窗口行、评估的条件内完整行、totalCount三个范围不能混用。

### 5. 依赖、执行与导出

本例依赖为projects→details-high和projects→details-low；依赖声明在resultBindings.source中。sections排列、layout.span、标题里的01/02/03只决定展示，不规定请求次序。依赖关系由页面显式声明；本轮执行集合与执行时机随排序、分页和输入就绪状态变化。引擎不根据列名猜测依赖，也不支持依赖成环。

任意合法查询排序进入同一机制：更新上游状态并回到第一页，使其直接与间接依赖失效，等待本轮输入就绪再执行。汇合查询等待所有输入；无关查询保持原结果；过期请求不能覆盖新结果。字段集合相同可以复用下游有效查询缓存。

共享单次执行消费第一页；导出捕获当前页、页大小和排序，重新取得该窗口后计算下游输入。该级联链导出保留窗口范围，普通无级联的分页表仍按完整导出规则取数。固定TopN和完整结果源继续保留既有选择范围及排序覆盖保护。

6.37业务筛选的allBehavior:unrestricted只影响穷尽封闭枚举的动态谓词，不能删除body中的静态条件；普通SourceProgram读取、capture、组合查询及导出均传入同一筛选声明。新动态候选在seeds/initial复用和执行前核验；未通过只阻断相关源。见[筛选](filters.md#business-filters)。

6.38金额范围可用互斥metricByFilter选择静态money查询字段，绑定与单位货币必须匹配。控制币种作为隐式查询依赖参与SourceProgram、组合查询成员、筛选门禁与导出；金额值已是基本单位，不在DQE下推时再次乘scale。参见[金额范围](filters.md#amount-range)和[静态字段选择](field-bindings-and-formats.md#field-selection)。

## 6.39 静态时间查询模式

普通query继续 `body/filterBindings`。模式查询使用 `timeModes:{filterId,cases:{day?:{body,filterBindings},month?:{body,filterBindings},isoWeek?:{body,filterBindings}}}`，与根body/filterBindings/paramBindings互斥；每case是一个完整静态DQE请求体，穷尽控制筛选的配置模式。day/month/isoWeek静态period分别为day/month/week。每case必须显式绑定该时间范围，输出同一组结果字段/类型/货币及queryField别名映射；所有case均参与静态校验、参数引用及依赖分析；同页时间模式与字段选择的联合验证组合共用4096上限，超限返回可定位的协议错误。

SourceProgram、Node执行入口、分页/组合查询、导出统一选择合法已应用模式；没有首case回退。未证明模式/事实上下文的initial/seeds/执行快照不复用；捕获查询的时间及筛选谓词按冻结条件重编译，不能让旧谓词绕过可信上限。一次read冻结时钟、条件、事实与相关filterRevision，导出亦冻结。Relay部署入口可传可信context，但本批只验证公共Node执行和本地合成HTTP；真实Relay/DQE week聚合及私有周码未验真。


页面协议 6.42。结构真源为本册[schema.json](schema.json)，SHA256 `653ef9706e83d0d4a4b2f13478cf737ce9dfec67f60a491cb737a2135ae4ebf8`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f706167655175657279"></a>

### `@pageQuery`

Schema位置：`#/definitions/pageQuery`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676551756572792f6f6e654f662f30"></a>

### `@pageQuery · oneOf[0]`

Schema位置：`#/definitions/pageQuery/oneOf/0`。目标：[#/definitions/dqeQuery](queries-and-bindings.md#schema-232f646566696e6974696f6e732f6471655175657279)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dqeQuery | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6471655175657279"></a>

### `@dqeQuery`

Schema位置：`#/definitions/dqeQuery`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["language"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f6c616e6775616765"></a>

### `@dqeQuery.language`

Schema位置：`#/definitions/dqeQuery/properties/language`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dqe" | Schema未设默认；装配/运行时默认见语义说明 | 受控查询语言判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dqe" | 用于选择@dqeQuery.language分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e6773"></a>

### `@dqeQuery.resultBindings`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 查询原始维度集合到下游维度谓词的显式绑定；空集合跳过请求。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d73"></a>

### `@dqeQuery.resultBindings[]`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["source","field","target","queryField","maxValues"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f736f75726365"></a>

### `@dqeQuery.resultBindings[].source`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@dqeQuery.resultBindings[].field`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f746172676574"></a>

### `@dqeQuery.resultBindings[].target`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.resultBindings[].queryField`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f6d617856616c756573"></a>

### `@dqeQuery.resultBindings[].maxValues`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/maxValues`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 去重集合的正整数上限，最大1000；超限报错而非截断。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f7768657265"></a>

### `@dqeQuery.resultBindings[].where`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/where`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 下游独立筛选上游原始行；缺省读取全部行，不修改上游快照。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f726573756c7442696e64696e67732f6974656d732f70726f706572746965732f77686572652f616c6c4f662f30"></a>

### `@dqeQuery.resultBindings[].where · allOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/resultBindings/items/properties/where/allOf/0`。目标：[#/definitions/queryResultWhere](queries-and-bindings.md#schema-232f646566696e6974696f6e732f7175657279526573756c745768657265)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryResultWhere | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c745768657265"></a>

### `@queryResultWhere`

Schema位置：`#/definitions/queryResultWhere`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f30"></a>

### `@queryResultWhere · anyOf[0]`

Schema位置：`#/definitions/queryResultWhere/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["all"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f302f70726f706572746965732f616c6c"></a>

### `@queryResultWhere · anyOf[0].all`

Schema位置：`#/definitions/queryResultWhere/anyOf/0/properties/all`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64 | Schema未设默认；装配/运行时默认见语义说明 | 非空条件集合，所有条件满足；最多4层组合、64个叶子。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f302f70726f706572746965732f616c6c2f6974656d73"></a>

### `@queryResultWhere · anyOf[0].all[]`

Schema位置：`#/definitions/queryResultWhere/anyOf/0/properties/all/items`。目标：[#/definitions/queryResultWhere](queries-and-bindings.md#schema-232f646566696e6974696f6e732f7175657279526573756c745768657265)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryResultWhere | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f31"></a>

### `@queryResultWhere · anyOf[1]`

Schema位置：`#/definitions/queryResultWhere/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["any"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f312f70726f706572746965732f616e79"></a>

### `@queryResultWhere · anyOf[1].any`

Schema位置：`#/definitions/queryResultWhere/anyOf/1/properties/any`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64 | Schema未设默认；装配/运行时默认见语义说明 | 非空条件集合，任意条件满足；最多4层组合、64个叶子。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f312f70726f706572746965732f616e792f6974656d73"></a>

### `@queryResultWhere · anyOf[1].any[]`

Schema位置：`#/definitions/queryResultWhere/anyOf/1/properties/any/items`。目标：[#/definitions/queryResultWhere](queries-and-bindings.md#schema-232f646566696e6974696f6e732f7175657279526573756c745768657265)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryResultWhere | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f32"></a>

### `@queryResultWhere · anyOf[2]`

Schema位置：`#/definitions/queryResultWhere/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f322f70726f706572746965732f6669656c64"></a>

### `@queryResultWhere · anyOf[2].field`

Schema位置：`#/definitions/queryResultWhere/anyOf/2/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f322f70726f706572746965732f6f70"></a>

### `@queryResultWhere · anyOf[2].op`

Schema位置：`#/definitions/queryResultWhere/anyOf/2/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["eq","ne"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "eq" | 原始标量严格等值；null不匹配。 |
| "ne" | 原始标量严格不等值；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f322f70726f706572746965732f76616c7565"></a>

### `@queryResultWhere · anyOf[2].value`

Schema位置：`#/definitions/queryResultWhere/anyOf/2/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f322f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@queryResultWhere · anyOf[2].value · anyOf[0]`

Schema位置：`#/definitions/queryResultWhere/anyOf/2/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f322f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@queryResultWhere · anyOf[2].value · anyOf[1]`

Schema位置：`#/definitions/queryResultWhere/anyOf/2/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f322f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@queryResultWhere · anyOf[2].value · anyOf[2]`

Schema位置：`#/definitions/queryResultWhere/anyOf/2/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f33"></a>

### `@queryResultWhere · anyOf[3]`

Schema位置：`#/definitions/queryResultWhere/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","values"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f6669656c64"></a>

### `@queryResultWhere · anyOf[3].field`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f6f70"></a>

### `@queryResultWhere · anyOf[3].op`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["in","notIn"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "in" | 原始值严格属于字面量集合；null不匹配。 |
| "notIn" | 原始值严格不属于字面量集合；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f76616c756573"></a>

### `@queryResultWhere · anyOf[3].values`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1000 | Schema未设默认；装配/运行时默认见语义说明 | 非空同类型字面量集合，最多1000项；不强制类型转换。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@queryResultWhere · anyOf[3].values[]`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f76616c7565732f6974656d732f616e794f662f30"></a>

### `@queryResultWhere · anyOf[3].values[] · anyOf[0]`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/values/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f76616c7565732f6974656d732f616e794f662f31"></a>

### `@queryResultWhere · anyOf[3].values[] · anyOf[1]`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/values/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f332f70726f706572746965732f76616c7565732f6974656d732f616e794f662f32"></a>

### `@queryResultWhere · anyOf[3].values[] · anyOf[2]`

Schema位置：`#/definitions/queryResultWhere/anyOf/3/properties/values/items/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f34"></a>

### `@queryResultWhere · anyOf[4]`

Schema位置：`#/definitions/queryResultWhere/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f342f70726f706572746965732f6669656c64"></a>

### `@queryResultWhere · anyOf[4].field`

Schema位置：`#/definitions/queryResultWhere/anyOf/4/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f342f70726f706572746965732f6f70"></a>

### `@queryResultWhere · anyOf[4].op`

Schema位置：`#/definitions/queryResultWhere/anyOf/4/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["gt","gte","lt","lte"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gt" | 原始number/money值大于阈值，按原始单位。 |
| "gte" | 原始number/money值大于等于阈值，按原始单位。 |
| "lt" | 原始number/money值小于阈值，按原始单位。 |
| "lte" | 原始number/money值小于等于阈值，按原始单位。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f342f70726f706572746965732f76616c7565"></a>

### `@queryResultWhere · anyOf[4].value`

Schema位置：`#/definitions/queryResultWhere/anyOf/4/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f35"></a>

### `@queryResultWhere · anyOf[5]`

Schema位置：`#/definitions/queryResultWhere/anyOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f352f70726f706572746965732f6669656c64"></a>

### `@queryResultWhere · anyOf[5].field`

Schema位置：`#/definitions/queryResultWhere/anyOf/5/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7175657279526573756c7457686572652f616e794f662f352f70726f706572746965732f6f70"></a>

### `@queryResultWhere · anyOf[5].op`

Schema位置：`#/definitions/queryResultWhere/anyOf/5/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["isNull","isNotNull"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "isNull" | 只匹配合法null值；缺字段仍是契约错误。 |
| "isNotNull" | 只匹配合法非null值；缺字段仍是契约错误。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f6479"></a>

### `@dqeQuery.body`

Schema位置：`#/definitions/dqeQuery/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["dsl_list"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 静态正文或页面参数文本取值；bodyFormat决定是否走受控语义HTML。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c697374"></a>

### `@dqeQuery.body.dsl_list`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE协议中的查询DSL列表。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d73"></a>

### `@dqeQuery.body.dsl_list[]`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.body.dsl_list[]{key}`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list/items/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d732f70726f70657274794e616d6573"></a>

### `@dqeQuery.body.dsl_list[] · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e6773"></a>

### `@dqeQuery.paramBindings`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 参数id到查询维度目标的显式绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.paramBindings{key}`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@dqeQuery.paramBindings{key} · oneOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f746172676574"></a>

### `@dqeQuery.paramBindings{key} · oneOf[0].target`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.paramBindings{key} · oneOf[0].queryField`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@dqeQuery.paramBindings{key} · oneOf[1]`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","window"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f746172676574"></a>

### `@dqeQuery.paramBindings{key} · oneOf[1].target`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="time" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "time" | 用于选择@dqeQuery.paramBindings{key} · oneOf[1].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f77696e646f77"></a>

### `@dqeQuery.paramBindings{key} · oneOf[1].window`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1/properties/window`。目标：[#/definitions/timeWindow](params-and-text-values.md#schema-232f646566696e6974696f6e732f74696d6557696e646f77)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timeWindow | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 确定性查询时间窗口：由绑定参数推导起止，起止包含；不决定指标口径。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f70726f70657274794e616d6573"></a>

### `@dqeQuery.paramBindings · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e6773"></a>

### `@dqeQuery.filterBindings`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 筛选器id到当前查询目标的显式绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.filterBindings{key}`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@dqeQuery.filterBindings{key} · anyOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[0].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.filterBindings{key} · anyOf[0].queryField`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","levelQueryFields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c6473"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].levelQueryFields`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=2 | Schema未设默认；装配/运行时默认见语义说明 | 层级维度筛选器逐级声明的谓词字段：键是层级id，值是该层的DQE字段；必须逐级写全。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].levelQueryFields{key}`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c64732f70726f70657274794e616d6573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].levelQueryFields · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f32"></a>

### `@dqeQuery.filterBindings{key} · anyOf[2]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[2].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="time" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "time" | 用于选择@dqeQuery.filterBindings{key} · anyOf[2].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f77696e646f77"></a>

### `@dqeQuery.filterBindings{key} · anyOf[2].window`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2/properties/window`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 确定性查询时间窗口：由绑定参数推导起止，起止包含；不决定指标口径。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f77696e646f772f616c6c4f662f30"></a>

### `@dqeQuery.filterBindings{key} · anyOf[2].window · allOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2/properties/window/allOf/0`。目标：[#/definitions/timeWindow](params-and-text-values.md#schema-232f646566696e6974696f6e732f74696d6557696e646f77)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timeWindow | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f33"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timePoint" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timePoint" | 用于选择@dqeQuery.filterBindings{key} · anyOf[3].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3].queryField`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f76616c7565466f726d6174"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3].valueFormat`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3/properties/valueFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["iso","compact"] | Schema未设默认；装配/运行时默认见语义说明 | 时间点取值送进谓词的写法：iso原样YYYY-MM，compact去掉分隔符。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "iso" | 时间点原样送 YYYY-MM / YYYY-MM-DD。 |
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f34"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField","whenTrue"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="boolean" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].queryField`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e54727565"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenTrue`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenTrue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 布尔筛选器勾选时下推的取值；不勾选默认无条件。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e547275652f6974656d73"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenTrue[]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenTrue/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e46616c7365"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenFalse`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenFalse`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 布尔筛选器显式为假时下推的取值；缺席即不勾选不加条件。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e46616c73652f6974656d73"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenFalse[]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenFalse/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f35"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="numberRange" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "numberRange" | 数值度量的包含端点范围；按原始单位比较，一端可缺省。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metric`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metric`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 数值区间谓词作用的DQE指标名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c746572"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metricByFilter`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["filterId","cases"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 金额度量由required单选封闭枚举选择，cases必须穷尽并匹配静态money币种；选择器为隐式查询依赖。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f66696c7465724964"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metricByFilter.filterId`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 引用金额units使用的required单选封闭枚举筛选。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f6361736573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metricByFilter.cases`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 每个启用枚举值必须且只能映射一个已声明同币种money queryField。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metricByFilter.cases{key}`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/cases/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metricByFilter.cases · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f70726f70657274794e616d6573"></a>

### `@dqeQuery.filterBindings · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f646573"></a>

### `@dqeQuery.timeModes`

Schema位置：`#/definitions/dqeQuery/properties/timeModes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["filterId","cases"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 与普通body/filterBindings互斥；filterId引用modes筛选，cases完整声明每一模式的静态查询体及绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f66696c7465724964"></a>

### `@dqeQuery.timeModes.filterId`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 显式引用当前页面已声明筛选器；timeModes要求modes范围，metricByFilter要求required单选枚举。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f6361736573"></a>

### `@dqeQuery.timeModes.cases`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 完整穷尽已声明模式或封闭枚举的静态case，没有隐式首项回退。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.timeModes.cases{key}`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["body","filterBindings"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f626f6479"></a>

### `@dqeQuery.timeModes.cases{key}.body`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["dsl_list"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 静态正文或页面参数文本取值；bodyFormat决定是否走受控语义HTML。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c697374"></a>

### `@dqeQuery.timeModes.cases{key}.body.dsl_list`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/body/properties/dsl_list`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE协议中的查询DSL列表。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d73"></a>

### `@dqeQuery.timeModes.cases{key}.body.dsl_list[]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/body/properties/dsl_list/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.timeModes.cases{key}.body.dsl_list[]{key}`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/body/properties/dsl_list/items/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d732f70726f70657274794e616d6573"></a>

### `@dqeQuery.timeModes.cases{key}.body.dsl_list[] · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/body/properties/dsl_list/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e6773"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 筛选器id到当前查询目标的显式绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key}`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f746172676574"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[0].target`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/0/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[0].queryField`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[1]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","levelQueryFields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f746172676574"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[1].target`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/1/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c6473"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[1].levelQueryFields`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=2 | Schema未设默认；装配/运行时默认见语义说明 | 层级维度筛选器逐级声明的谓词字段：键是层级id，值是该层的DQE字段；必须逐级写全。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[1].levelQueryFields{key}`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c64732f70726f70657274794e616d6573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[1].levelQueryFields · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f32"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[2]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f746172676574"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[2].target`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/2/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="time" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "time" | 用于选择@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[2].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f77696e646f77"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[2].window`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/2/properties/window`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 确定性查询时间窗口：由绑定参数推导起止，起止包含；不决定指标口径。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f77696e646f772f616c6c4f662f30"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[2].window · allOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/2/properties/window/allOf/0`。目标：[#/definitions/timeWindow](params-and-text-values.md#schema-232f646566696e6974696f6e732f74696d6557696e646f77)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timeWindow | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f33"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[3]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f746172676574"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[3].target`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/3/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timePoint" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timePoint" | 用于选择@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[3].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[3].queryField`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/3/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f76616c7565466f726d6174"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[3].valueFormat`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/3/properties/valueFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["iso","compact"] | Schema未设默认；装配/运行时默认见语义说明 | 时间点取值送进谓词的写法：iso原样YYYY-MM，compact去掉分隔符。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "iso" | 时间点原样送 YYYY-MM / YYYY-MM-DD。 |
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f34"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField","whenTrue"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f746172676574"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4].target`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="boolean" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4].queryField`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e54727565"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4].whenTrue`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4/properties/whenTrue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 布尔筛选器勾选时下推的取值；不勾选默认无条件。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e547275652f6974656d73"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4].whenTrue[]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4/properties/whenTrue/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e46616c7365"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4].whenFalse`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4/properties/whenFalse`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 布尔筛选器显式为假时下推的取值；缺席即不勾选不加条件。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e46616c73652f6974656d73"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[4].whenFalse[]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4/properties/whenFalse/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f35"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5]`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f746172676574"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].target`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="numberRange" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "numberRange" | 数值度量的包含端点范围；按原始单位比较，一端可缺省。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].metric`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/metric`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 数值区间谓词作用的DQE指标名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c746572"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].metricByFilter`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["filterId","cases"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按required单选币种选择静态基本单位metric，各case与units货币一致。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f66696c7465724964"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].metricByFilter.filterId`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 显式引用当前页面已声明筛选器；timeModes要求modes范围，metricByFilter要求required单选枚举。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f6361736573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].metricByFilter.cases`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 完整穷尽已声明模式或封闭枚举的静态case，没有隐式首项回退。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].metricByFilter.cases{key}`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/cases/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963427946696c7465722f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings{key} · anyOf[5].metricByFilter.cases · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5/properties/metricByFilter/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f66696c74657242696e64696e67732f70726f70657274794e616d6573"></a>

### `@dqeQuery.timeModes.cases{key}.filterBindings · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f74696d654d6f6465732f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@dqeQuery.timeModes.cases · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/timeModes/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `query-field-mapping`：query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射。反例：[query-field-without-mapping](errors/query-field-without-mapping.json)、[query-field-duplicate-mapping](errors/query-field-duplicate-mapping.json)、[query-field-not-output](errors/query-field-not-output.json)、[query-detail-item-duplicate-mapping](errors/query-detail-item-duplicate-mapping.json)、[query-dimension-role-mismatch](errors/query-dimension-role-mismatch.json)、[query-role-mismatch](errors/query-role-mismatch.json)、[query-output-unmapped](errors/query-output-unmapped.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `filter-binding`：筛选绑定引用已声明筛选器，time / dimension 目标类型匹配，层级绑定逐级声明谓词字段。反例：[level-query-fields-on-flat-filter](errors/level-query-fields-on-flat-filter.json)、[level-query-fields-missing-level](errors/level-query-fields-missing-level.json)、[level-query-fields-undeclared-level](errors/level-query-fields-undeclared-level.json)、[hierarchy-filter-flat-query-field](errors/hierarchy-filter-flat-query-field.json)、[time-point-target-not-time-point](errors/time-point-target-not-time-point.json)、[boolean-target-not-boolean](errors/boolean-target-not-boolean.json)、[number-range-target-not-number-range](errors/number-range-target-not-number-range.json)、[time-point-initial-param-not-times](errors/time-point-initial-param-not-times.json)、[time-point-initial-param-precision](errors/time-point-initial-param-precision.json)、[time-point-initial-param-range](errors/time-point-initial-param-range.json)、[time-point-initial-param-and-default](errors/time-point-initial-param-and-default.json)、[time-point-initial-param-without-query-target](errors/time-point-initial-param-without-query-target.json)、[unknown-filter-binding](errors/unknown-filter-binding.json)、[filter-binding-time-target-not-time-range](errors/filter-binding-time-target-not-time-range.json)、[filter-binding-dimension-target-not-dimension](errors/filter-binding-dimension-target-not-dimension.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-extensions`：6.39 显式时间模式、可信期间事实、快捷范围及V2月份窗口。反例：[time-before-6.39](errors/time-before-6.39.json)、[time-case-missing](errors/time-case-missing.json)、[time-query-xor](errors/time-query-xor.json)、[time-period-mismatch](errors/time-period-mismatch.json)、[time-output-mismatch](errors/time-output-mismatch.json)、[time-default-week](errors/time-default-week.json)、[time-availability-default](errors/time-availability-default.json)、[time-fact-kind](errors/time-fact-kind.json)、[time-window-static-options](errors/time-window-static-options.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [dimension-params-page](examples/dimension-params-page.json)：完整合法页面；查询仅为静态契约证据。
- [hierarchy-binding-page](examples/hierarchy-binding-page.json)：完整合法页面；查询仅为静态契约证据。
- [non-dimension-bindings-page](examples/non-dimension-bindings-page.json)：完整合法页面；查询仅为静态契约证据。
- [query-cascade-page](examples/query-cascade-page.json)：完整合法页面；查询仅为静态契约证据。
- [query-result-where-page](examples/query-result-where-page.json)：完整合法页面；查询仅为静态契约证据。
- [query-result-where-branches](examples/query-result-where-branches.json)：完整合法页面；查询仅为静态契约证据。
- [query-result-page-window-page](examples/query-result-page-window-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-modes-page](examples/time-modes-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-presets-page](examples/time-presets-page.json)：完整合法页面；查询仅为静态契约证据。
- [availability-page](examples/availability-page.json)：完整合法页面；查询仅为静态契约证据。
- [calendar-window-page](examples/calendar-window-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-binding-branches-page](examples/time-binding-branches-page.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）

- `#/definitions/pageQuery/oneOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/control-data/source/query`。
- `#/definitions/queryResultWhere/anyOf/0`：[合法完整页面](examples/query-result-where-page.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where`。
- `#/definitions/queryResultWhere/anyOf/1`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/8`。
- `#/definitions/queryResultWhere/anyOf/2`：[合法完整页面](examples/query-result-where-page.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/0`。
- `#/definitions/queryResultWhere/anyOf/2/properties/value/anyOf/0`：[合法完整页面](examples/query-result-where-page.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/0/value`。
- `#/definitions/queryResultWhere/anyOf/2/properties/value/anyOf/1`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/1/value`。
- `#/definitions/queryResultWhere/anyOf/2/properties/value/anyOf/2`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/2/value`。
- `#/definitions/queryResultWhere/anyOf/3`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/3`。
- `#/definitions/queryResultWhere/anyOf/3/properties/values/items/anyOf/0`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/3/values/0`。
- `#/definitions/queryResultWhere/anyOf/3/properties/values/items/anyOf/1`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/4/values/0`。
- `#/definitions/queryResultWhere/anyOf/3/properties/values/items/anyOf/2`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/5/values/0`。
- `#/definitions/queryResultWhere/anyOf/4`：[合法完整页面](examples/query-result-where-page.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/1`。
- `#/definitions/queryResultWhere/anyOf/5`：[合法完整页面](examples/query-result-where-branches.json)，JSON Pointer `#/dataSources/details-high/source/query/resultBindings/0/where/all/8/any/0`。
- `#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dataSources/sales/source/query/paramBindings/regions`。
- `#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/current/source/query/paramBindings/report-month`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/dataSources/map-data/source/query/filterBindings/map-region`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/dataSources/opportunity-list/source/query/filterBindings/region`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2`：[合法完整页面](examples/report-date-filters-page.json)，JSON Pointer `#/dataSources/sales/source/query/filterBindings/period-filter`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3`：[合法完整页面](examples/availability-page.json)，JSON Pointer `#/dataSources/bound/source/query/filterBindings/month`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/dataSources/opportunity-list/source/query/filterBindings/key-office`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/dataSources/opportunity-list/source/query/filterBindings/bidding-amount`。
- `#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/0`：[合法完整页面](examples/calendar-window-page.json)，JSON Pointer `#/dataSources/bound/source/query/timeModes/cases/month/filterBindings/months`。
- `#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/1`：[合法完整页面](examples/time-binding-branches-page.json)，JSON Pointer `#/dataSources/main/source/query/timeModes/cases/month/filterBindings/closed`。
- `#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/2`：[合法完整页面](examples/time-modes-page.json)，JSON Pointer `#/dataSources/bound/source/query/timeModes/cases/day/filterBindings/period`。
- `#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/3`：[合法完整页面](examples/time-binding-branches-page.json)，JSON Pointer `#/dataSources/main/source/query/timeModes/cases/month/filterBindings/point`。
- `#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/4`：[合法完整页面](examples/time-binding-branches-page.json)，JSON Pointer `#/dataSources/main/source/query/timeModes/cases/month/filterBindings/flag`。
- `#/definitions/dqeQuery/properties/timeModes/properties/cases/additionalProperties/properties/filterBindings/additionalProperties/anyOf/5`：[合法完整页面](examples/time-binding-branches-page.json)，JSON Pointer `#/dataSources/main/source/query/timeModes/cases/month/filterBindings/amount`。

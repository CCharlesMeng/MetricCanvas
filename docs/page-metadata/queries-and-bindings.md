# 查询定义与显式绑定

## 查询独立期间策略

6.67 起，指标查询的时间绑定可声明 `periodPolicy`，消费 `display:"period"` 筛选器的已应用选择。固定粒度写 `{target:"time",periodPolicy:{kind:"fixed",period:"month"}}`；按所选周期写 `{target:"time",periodPolicy:{kind:"selection",supportedPeriods:["month","year"]}}`。支持粒度由作者按已确认的数据能力声明，不由控件推断；不支持时拒绝查询，不回退。

新策略独占查询粒度与起止，原始 `filter.time` 保留 `is_aggregate` 等原有语义，禁止同时声明 `period/start/end/param`，也不能与绑定的 `window/queryField/valueFormat` 混用。对象查询暂不消费此策略。timeModes 已由其 day/month/isoWeek 模式拥有时间配置，不叠加此期间策略；普通查询与 queryModes 的全部 case 支持该策略。缺少策略的旧绑定保持原有精度配对和编码。

固定按日、月、年分别生成 YYYY-MM-DD、YYYY-MM、YYYY。选年固定月覆盖十二个月；选月固定日覆盖完整自然月。固定年可扩大到所选窗口涉及的完整自然年，工作台预览明确标记扩大；它不计算年度得分。按选择时，年使用 year、月使用 month，近一年默认 month；近一年使用已应用的前十二个完整月窗口，不在请求或导出时重新取当前时间。直接季度 DQE 编码尚未确认，按选择遇到季度明确拒绝；季度选择仍可由固定日/月策略覆盖整季，不隐式改写策略。

工作台逐查询配置并预览实际粒度与期间。新绑定从原查询可确认的一致 period 预选固定策略，缺少或分支不一致时要求选择。旧绑定显示“保留旧协议”，主动选择新策略才转换该查询全部静态分支，保留指标、维度、fieldMappings 和 is_aggregate；同一筛选器允许新旧查询并存。整个编辑先校验再应用，失败保留原稿。此能力不自动求和、平均、切换指标或查询路线。

验收入口：`period-query-columns-demo`，同时展示固定日/月查询与按期间模式切换表格列；数据性质及操作见页面目录 README。

6.56 起，`output_dims` 中的现成数值可在结果字段契约中显式声明为数值度量；查询体、行粒度和筛选绑定保持作者声明。平铺与分组写法、普通查询与各静态查询分支使用相同规则。声明及限制见[结果字段角色](fields.md#dqe-output-measures)，完整示例为 `stored-count-measures`。

当前受控查询语言为DQE。查询体遵循真实协议分支，模型不得拼任意SQL或表达式。filterBindings对象键引用页面筛选器；dimension目标必须声明queryField，time目标不带window时绑定时间范围，带window时绑定时间点。6.68起普通DQE可同时声明queryField和valueFormat，将时间范围绑定到指定维度字段。页面字段id、筛选器dimension和DQE字段属于不同空间。

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
{"order_by_field":"金额","type":"desc","limit":10,"offset":0}
```

初始金额降序只是默认查询顺序。服务端先对全部匹配项目排序，再取前10行。每页10条时，第3页的生效查询offset为20；改变任何已声明可排序列后，排序规则更新且offset回到0。排序方向兼容 ASC/DESC 与 asc/desc，发送时归一为小写。指标 DQE 只支持单字段排序；显式多字段排序在发请求前返回 DQE_CONFIG_ERROR，不截断、不生成 order.by。运行时的页码、页大小与排序变化形成生效查询，不写回页面模板。

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

普通query继续 `body/filterBindings`。模式查询使用 `timeModes:{filterId,cases:{day?:{body,filterBindings},month?:{body,filterBindings},isoWeek?:{body,filterBindings}}}`，与根body/filterBindings/paramBindings互斥；每case是一个完整静态DQE请求体，穷尽控制筛选的配置模式。day/month/isoWeek静态period分别为day/month/week。网关对week起止值复用日期精度校验并保留传输period:week；这是既有页面时间模式，不扩展创作query_data的year/month/day粒度枚举。每case必须显式绑定该时间范围，输出同一组结果字段/类型/货币及queryField映射；所有case均参与静态校验、参数引用及依赖分析；同页时间模式与字段选择的联合验证组合共用4096上限，超限返回可定位的协议错误。

SourceProgram、Node执行入口、分页/组合查询、导出统一选择合法已应用模式；没有首case回退。未证明模式/事实上下文的initial/seeds/执行快照不复用；捕获查询的时间及筛选谓词按冻结条件重编译，不能让旧谓词绕过可信上限。一次read冻结时钟、条件、事实与相关filterRevision，导出亦冻结。Relay部署入口可传可信context，但本批只验证公共Node执行和本地合成HTTP；真实Relay/DQE week聚合及私有周码未验真。

<a id="query-modes"></a>

## 6.50 固定单选查询分支

一个页面数据源表示一份稳定结果，不等于一张物理表。`queryModes` 允许按普通维度筛选的固定单选值选择不同完整 DQE 查询；各查询提交不同业务指标，数据网关提交生效查询；真实指标到表的路由须由实际 DQE 环境确认。页面不增加数据库地址、物理表推断、自由 SQL 或渲染期查询生成。

```json
{
  "language": "dqe",
  "queryModes": {
    "filterId": "business",
    "cases": {
      "contracts": {
        "body": {"dsl_list": [{"output_dims": ["月份"], "output_metrics": ["签约金额"], "filter": {"dims": [], "metrics": []}, "order": {}}]},
        "filterBindings": {"region": {"target": "dimension", "queryField": "签约区域"}},
        "fieldMappings": {"month":"月份", "amount":"签约金额"}
      },
      "opportunities": {
        "body": {"dsl_list": [{"output_dims": ["月份"], "output_metrics": ["商机金额"], "filter": {"dims": [], "metrics": []}, "order": {}}]},
        "filterBindings": {"region": {"target": "dimension", "queryField": "商机区域"}},
        "fieldMappings": {"month":"月份", "amount":"商机金额"}
      }
    }
  }
}
```

这是查询定义片段；完整页面还声明 `business` 和 `region` 筛选器、固定选项、结果字段与组件。`business` 必须由固定单选 `filterGroup` 提供选项，或声明 `options` 及 `selection:{mode:"single",required:true}`。case 键与全部可用选项全等，不允许缺项、额外项、首项回退、动态候选、多选、空选或自由条件匹配。`queryModes`、`timeModes` 和根 `body` 三选一；模式查询不声明根 `filterBindings/paramBindings`，各 case 显式声明完整 `body/filterBindings`。首版不嵌套时间模式；普通时间筛选仍可在 case 内绑定。选择器不能同时作为本 case 的 DQE 谓词。

从 6.57 起，case 可用 `fieldMappings` 显式声明“页面字段 id → 本分支原始响应字段名”。上例的根 `fields` 声明 `month` 和 `amount` 的类型/角色/货币/单位，不声明 `queryField`；每个 case 都须完整映射全部外部结果字段，不映射计算产出或未知字段。选择 case 时同时解析请求与响应映射，映射不发送给 DQE。不同原始列名由页面归一化为同一稳定字段，不要求 DQE 重命名普通指标。普通指标使用名称字符串；仅公式列使用显式 `{formula,alias}`，`{name,alias}` 被拒绝。旧版无 `fieldMappings` 的分支保留根 `fields.queryField`，要求各 case 的原始输出一致。不能混用这两种映射位置；使用分支映射的查询拒绝缺少分支证明的 initial。类型、角色、货币、单位和行粒度保持一致。物理来源与业务口径由创作期分别验证；静态字段校验不证明两条真实查询的业务可比性。不能把人民币与美元、金额与数量或明细与汇总共用一个结果字段冒充一致；此类需求拆分独立契约与呈现。

统一运行时先按已应用筛选选择 case，再编译该 case 的普通筛选与参数引用。只执行当前 case，同一选择器可控制多个数据源，所有结果消费者共享数据快照；分支选择本身计入查询依赖，不需要虚构 DQE 维度。case 外不声明受控组件列表。所有静态 case 都参与校验、参数引用、依赖分析；候选门禁只核验当前分支实际消费的筛选及祖先，未激活分支的候选未就绪不阻断当前分支；时间模式、查询模式与字段选择共用4096组合上限。

浏览器、SourceProgram 与公共 Node 执行共用选择实现；本场景覆盖屏幕请求、冻结分支的完整读取和取消/迟到响应。分页及组合查询的兼容性按本批专项回归报告，不把共用代码当作真实 DQE 验收。缓存按实际生效查询及筛选条件隔离；取消和迟到结果保护沿用统一查询执行。没有分支上下文证明的 initial、seeds 和执行快照不直接复用；捕获查询须与冻结条件的分支相符，导出固定捕获的分支与区域，不在导出过程中跟随屏幕切换。运行期非法选择阻断相关查询，不改查其他表。URL 非法值仍按既有固定筛选控件规则恢复默认。

验收：`query-mode-chart-demo`，Dashboard 一张折线图、合计卡和共享结果明细表；签约与商机由 DQE Sim 的两组独立固定数据提供；指标名、区域名、月份粒度、人民币单位及无维度求和均为样例约定，未验证真实数据目录/物理表路由或聚合语义。切换口径与区域应改变实际请求中的业务指标、区域目标字段和图表数值。演示数据与真实 DQE/Relay、数据库权限及业务数值验真分开报告。


## 6.55 DQE 对象查询

对象查询仍使用 `source.type:query` 和 `language:dqe`；原始 `body.dsl_list` 恰好一个查询项，以 `query_type:object` 识别，`object_type` 必须明确。`output_fields` 为非空、不重复的字段名数组，不与 `output_dims/output_metrics` 混用。每项输出仍须有显式 `queryField` 映射；角色、类型、单位、可空性依据已有对象字段信息声明，不能从返回样例猜测。`columns:null` 不影响归一化。上游原始行保留，商务编号不自动成为唯一行键；结果绑定提取集合时才去重。

<a id="object-query-parameters"></a>

### 统一对象调用参数（2026-10-30 用户确认）

全部对象调用，包括明细、筛选后的重查及列候选查询，都使用同一结构；不按调用用途另造参数名。无条件时仍发送 `filter:{fields:[]}`，无排序或分页时仍发送 `order:{}`。`object_type` 与字段名保留数据上下文中的精确名称，不擅自修正拼写。用户提供的参数范例为：

```json
{
  "dsl_list": [{
    "query_type": "object",
    "object_type": "Partner Health/Custormer Partner Evaluation Score",
    "output_fields": ["地区部", "客户对伙伴的评价得分", "国内或海外"],
    "filter": {"fields": [{"field_name": "国内或海外", "value_list": ["国内"], "operator": "="}]},
    "order": {}
  }]
}
```

该范例确认的是对象参数结构，不是返回字段类型或后端自动去重保证。对象条件统一为 `field_name/value_list/operator`；不发送指标查询的 `filter.dims/filter.metrics`、`dim_name/dim_value_list` 或 `output_dims/output_metrics`。等值条件使用 `=`，既有范围条件和排序分页继续使用本节已定义的运算符及 `order` 字段。传输层可批量多个独立逻辑查询；每个页面数据源仍只声明一个查询项。精确范例由确定性编码回归核对。

- 源码/验证定位：`packages/data-execution/fixtures/object-query-parameters.json`、`packages/data-execution/tests/object-column-candidates.test.ts`。

对象列候选沿同一结构查询原 `object_type`，仅将 `output_fields` 改为目标列的真实查询字段；保留区域、时间、业务条件、搜索和其他列条件，仅移除本列条件及表格排序分页。默认请求 `order:{}`，不读取其他明细输出字段。显式配置 `columnCandidates.maxRows` 或集成配置 `columnCandidatesMaxRows` 时，投影也遵守该上限，使用对应 limit/offset 限制单次返回；超过上限报告 `DQE_CANDIDATE_LIMIT_EXCEEDED`，不返回部分候选。服务可能返回重复值，前端只对这份候选投影去重、搜索和分页；不会改变主查询行数或把当前10条的取值当成完整候选。必须返回准确 `total_count`，与返回行数不符（含缺失总数、默认截断、非空却报0）时不接受部分候选，也不偷偷扩大为全字段扫描。此方式完整读取目标字段的匹配投影，不等于后端 DISTINCT。仅声明 limit 的固定TopN不自动移除业务窗口，配置了 fullQuery 时沿既有完整查询兜底保留业务范围，否则要求可信候选适配；显式 `encodeColumnCandidates` 优先。验收页 `/pages/business-rejection-details-pagination-10` 使用本地HTTP合成数据，真实服务的投影完整性、权限和隐式上限仍单列验真。

对象条件使用 `filter.fields:[{field_name,value_list,operator}]`。静态原始条件保持；显式页面绑定接管其目标字段的默认条件，清空可选筛选后不恢复该字段的静态默认条件；未绑定字段保持。表头筛选、搜索继续以 AND 收窄，日期表头使用同字段已声明的时间格式。维度、层级、布尔、数值区间及查询结果绑定消费现有页面状态；对象数值区间直接落在字段条件，不发送 `filter.metrics`。`operator:'='` 的多值列表按集合等值语义编码，其真实后端行为须验真。原始未知运算符保留给上游，不能由页面端清洗删除。

时间范围仍使用 `target:time`，对象分支必须增加 `queryField` 和 `valueFormat:iso|compact|datetime`。`window` 继续绑定 timePoint，未声明 window 时绑定 timeRange。例如：

```json
{"period":{"target":"time","queryField":"特价审批通过时间","valueFormat":"datetime"}}
```

`iso` 保留页面日期/月；`compact` 去掉连字符；`datetime` 明确采用源日历、秒精度和闭区间，起点补 `00:00:00`、终点补 `23:59:59`，月范围扩为对应月首日至月末日，不进行时区转换。不同精度/时区必须由可信接入适配，不能猜测。普通指标查询的 time 绑定保持原规则，不接受对象字段或格式。

固定维度参数可以在对应 `value_list` 使用 `{param:id}`。固定日期参数使用同字段成对引用：`{param:id,part:start|end,valueFormat:...}`，分别对应 `>=` 和 `<=`，必须来自同一个 `params.query.times` 参数及同一格式，不能混入该字段固定条件或绑定。可在成对引用中声明完全相同的 `window`，此时参数必须为单点并遵循既有窗口精度规则。参数解析仅修改查询副本。旧 paramBindings 的 time 分支在对象查询也须声明 queryField/valueFormat。

查询分页继续使用 `order.offset/limit`。子表格、关联选页和分页合并不自动追加第二排序键；没有其他排序时子表格才以行键升序作为唯一排序。单字段排序编码为 `order_by_field/type`；显式多字段排序需要数据网关的可信 `encodeObjectSort`，未提供时明确报错，不静默丢键或本地排序。文本包含搜索仍需可信 `encodeSearch`；对象列候选使用上文的单字段对象投影或显式 `encodeColumnCandidates`，不能从当前页生成完整候选。

窗口、有限选择、complete 的用途边界及取消、缓存、URL、筛选写入规则与普通 DQE 一致。对象 complete 源经共享范围读取取得完整行集后再计算或关联；显式完整导出使用完整读取入口。分页失败、总数变化或累计行数超出总数时不返回部分对象结果冒充完整结果；不收紧普通指标查询原有兼容规则。导出单表最多 10000 行，结果绑定去重集合最多 1000 值，超限拒绝而不截断。没有真实记录标识时不能从重复投影行推断上游重复翻页，也不能据此删除重复行；稳定分页需真实服务验真。

完整 Dashboard 场景为 `/pages/dqe-object-query-demo`，使用 DQE Sim 合成记录；操作与证据边界见 `pages/capabilities/query/README.md`。用户提供的实际回执（请求1000行却仅返回10行、total_count1393）只作为响应兼容夹具，不能证明分页、排序、计数或真实业务口径。

<a id="metric-field-time"></a>

## 指定时间字段的范围下推（6.68）

普通 DQE（output_dims/output_metrics）查询的 `filterBindings` 可使用已有的 `target:time`，同时显式声明 `queryField` 与 `valueFormat:iso|compact|datetime`。例如审批期间绑定为：

```json
{"mtime":{"target":"time","queryField":"审批完成时间","valueFormat":"datetime"}}
```

绑定到日/月精度的 timeRange，或通过 window 绑定 timePoint；月份先展开为真实起止日（含闰年），datetime 再展开为起日00:00:00至止日23:59:59，按来源日历表达，不转换时区。普通DQE生成同名维度的两个 `filter.dims` 比较条件（operator为 `>=` 和 `<=`），不伪造统计 `filter.time`。原有静态条件保留并以AND叠加，不因期间选择放宽。字段与格式须成对声明；未声明二者时沿用统计时间槽的既有规则，对象查询仍使用filter.fields。

指定字段必须是已确认的可筛选DQE维度标识；输出列存在不等于服务已支持范围谓词，真实接入须验证编码及筛选后的准确total_count。完整关联预算仍保留，但针对服务返回的匹配行域生效。不能把limit缩小当成缩小总数，也不能用读取后本地筛选解决读取预算超限。

完整示例为 `record-join-demo`，业务配置为 `business-rejection-details`：主表下推审批期间，基本信息通过商务ID补列并显式声明期间不适用。示例使用合成数据；真实DQE能力单独验收。

## 查询时间精度与执行前校验

指标 DQE 的 `filter.time` 声明时间粒度与起止值；实际值必须同精度：`year` 使用 `YYYY`，`month` 使用 `YYYY-MM`，`day` 使用 `YYYY-MM-DD`。既有 `M` 别名和无分隔符的 `YYYYMM` / `YYYYMMDD` 可等价规范化；年份为 0001–9999，日期必须存在且开始不晚于结束。

`month + 20260401/20260930`、`year + 2026-04/2026-09` 均不合法，不能截去精度或放大范围。创作公共查询层在授权请求摘要和结果身份固定前规范化；strict/relaxed 都拒绝确定性时间错误。浏览器在筛选绑定应用后的最终指标 DQE 项上执行同样校验；失败为 `DQE_QUERY_REJECTED`，不发 HTTP。首次查询与重查的规范时间保持一致。字段时间谓词继续使用其显式 `valueFormat` 契约，不能把某个部署的紧凑编码推广到所有端点。

本次未改页面字段结构与历史页面读取版本；旧页可以读取，执行非法时间范围时会失败。无起止值的时间声明仍可供筛选绑定填充，不隐式补时间。没有批量升级或静默修正历史页面。显式 `periodPolicy` 的期间选择仍沿其现行契约解析，不把任意日范围当成期间选择。

可观察入口：`/pages/authoring-contract-reliability`，使用说明见同目录 README。共享跨语言向量由产品测试维护。

## 自动同比环比查询（6.77）

顶部 `display: "period"` 时间筛选可驱动三个普通查询源，分别查询本期、上期及去年同期。每个源须声明 `resultScope: "complete"`，共用相同业务条件、稳定业务键和可信截止事实；不能带 limit/offset 或查询分页。绑定示例：

```json
{"period":{"target":"time","periodComparison":{"kind":"previousYear","fact":"sales-through"}}}
```

`kind` 为 `current`、`previousPeriod` 或 `previousYear`；`fact` 引用宿主 `DisplayInputsSnapshot.periods`，必须为当前权限上下文和筛选版本下的 ready 事实。`latest` 是实际统计截止时间，日精度使用该日、月精度使用该月末；不能用浏览器当前日期、URL 或页面自报日期替代。事实缺失、过期或所选期间尚未开始统计时明确失败。事实更新重新查询，不复用未记录事实上下文的 initial。

先将本期截至 `min(所选期间末日, latest)`，再派生基期：月环比前移一月，季度环比前移三月，年度和近一年环比前移一年；同比统一前移一年。因此年度、近一年同环比基期相同。近一年仍指已应用的前十二个完整月，不在请求或导出时重新按时钟定位。未完成期间保持相同日历进度，闰日/月末截到目标月最后一天；已完成期间比较完整自然期间。

`periodComparison` 与 `periodPolicy`、`window` 互斥。指标查询必须显式保留 `filter.time: {"period":"day","is_aggregate":true}`（聚合开关按实际指标契约声明），不能另有固定 start/end/param/window；对象查询可沿用 `queryField` 和 `valueFormat`。所有派生请求使用日边界，季度不依赖未确认的 DQE quarter 编码。服务端须按范围返回正确的指标值，季度/年比率不能由客户端简单累加月度比率。

完整比较表复用 `unionKeys → joinAggregate → delta → ratio`，以各期稳定业务键并集保留本期和历史对象；完整计算后才做本地排序、表头筛选、分页与导出。每个查询复用最多10000行/60秒的完整读取预算，超过预算明确失败，不以当前页冒充全量。比较期失败不补零；依赖表格显示失败，导出不得产生不完整文件。大于该预算的业务需要上游提供完整比较结果，不能把该方案当作无限规模浏览器关联。

完整可操作场景：`/pages/period-comparison-demo`，页面及合成数据说明见 `pages/capabilities/data/period-comparison/README.md`。合成网关验证运行链，真实 DQE 聚合与宿主事实需集成方另外验收。

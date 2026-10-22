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

<a id="query-modes"></a>

## 6.50 固定单选查询分支

一个页面数据源表示一份稳定结果，不等于一张物理表。`queryModes` 允许按普通维度筛选的固定单选值选择不同完整 DQE 查询；各查询可以关联不同数据对象，数据网关仍提交生效查询并按显式别名归一化。页面不增加数据库地址、物理表推断、自由 SQL 或渲染期查询生成。

```json
{
  "language": "dqe",
  "queryModes": {
    "filterId": "business",
    "cases": {
      "contracts": {
        "body": {"dsl_list": [{"output_dims": ["月份"], "output_metrics": [{"name": "签约金额", "alias": "金额"}], "filter": {"dims": [], "metrics": []}, "order": {}}]},
        "filterBindings": {"region": {"target": "dimension", "queryField": "签约区域"}}
      },
      "opportunities": {
        "body": {"dsl_list": [{"output_dims": ["月份"], "output_metrics": [{"name": "商机金额", "alias": "金额"}], "filter": {"dims": [], "metrics": []}, "order": {}}]},
        "filterBindings": {"region": {"target": "dimension", "queryField": "商机区域"}}
      }
    }
  }
}
```

这是查询定义片段；完整页面还声明 `business` 和 `region` 筛选器、固定选项、结果字段与组件。`business` 必须由固定单选 `filterGroup` 提供选项，或声明 `options` 及 `selection:{mode:"single",required:true}`。case 键与全部可用选项全等，不允许缺项、额外项、首项回退、动态候选、多选、空选或自由条件匹配。`queryModes`、`timeModes` 和根 `body` 三选一；模式查询不声明根 `filterBindings/paramBindings`，各 case 显式声明完整 `body/filterBindings`。首版不嵌套时间模式；普通时间筛选仍可在 case 内绑定。选择器不能同时作为本 case 的 DQE 谓词。

所有 case 输出同一组维度与度量别名，映射到页面数据源唯一的结果字段契约；类型、角色、货币、单位和行粒度保持一致。物理来源与业务口径由创作期分别验证；静态字段校验不证明两条真实查询的业务可比性。不能把人民币与美元、金额与数量或明细与汇总共用一个结果字段冒充一致；此类需求拆分独立契约与呈现。

统一运行时先按已应用筛选选择 case，再编译该 case 的普通筛选与参数引用。只执行当前 case，同一选择器可控制多个数据源，所有结果消费者共享数据快照；分支选择本身计入查询依赖，不需要虚构 DQE 维度。case 外不声明受控组件列表。所有静态 case 都参与校验、参数引用、依赖分析；候选门禁只核验当前分支实际消费的筛选及祖先，未激活分支的候选未就绪不阻断当前分支；时间模式、查询模式与字段选择共用4096组合上限。

浏览器、SourceProgram、公共 Node 执行、分页/组合查询和导出共用选择实现。缓存按实际生效查询及筛选条件隔离；取消和迟到结果保护沿用统一查询执行。没有分支上下文证明的 initial、seeds 和执行快照不直接复用；捕获查询须与冻结条件的分支相符，导出固定捕获的分支与区域，不在导出过程中跟随屏幕切换。运行期非法选择阻断相关查询，不改查其他表。URL 非法值仍按既有固定筛选控件规则恢复默认。

验收：`query-mode-chart-demo`，Dashboard 一张折线图、合计卡和共享结果明细表；签约与商机由 DQE Sim 的两张独立合成表提供。切换口径与区域应改变实际请求中的业务指标、区域目标字段和图表数值。演示数据与真实 DQE/Relay、数据库权限及业务数值验真分开报告。

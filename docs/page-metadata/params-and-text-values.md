# 页面参数与文本取值

当前创作使用分层参数：params.query 定义查询输入，params.display 定义呈现输入；无值模板与填值实例共用页面协议。作者版本与能力下限见[页面、版本与布局](page.md)，本模块维护参数和文本取值的字段语义，使用流程由仓库根目录 `PAGE-PARAMETERS.md` 维护。

旧数组参数：页面参数是一次初始化的不可变取值；筛选器是页内可变状态。标量参数保留string/number/boolean；6.2的dimension单值使用非空string，multiple:true使用非空、无重复string[]。URL多值用重复键，不拆逗号。标量/维度参数的非法URL输入回退唯一default；必需参数缺值不阻止页面呈现；仅依赖这些输入的查询及其组合、计算结果呈现空态，不发送请求。

文本取值引用为{param:id}，由声明取值并按可选format格式化；必需文本不能引用可能缺失的参数。initialParam只把实际参数用于筛选初值，不能与filter.default双默认；6.11起timePoint筛选器与层级维度筛选器同样可用，前者引用单点times参数，后者的初值落在defaultLevel那一层；paramBindings显式指定查询目标，后续筛选清空不会复活原值。受筛选控制的目标不同时写静态参数条件。

执行回执的appliedInputs/filterValues是初始化权威；浏览器不再次用URL或模板默认覆盖。服务权限优先级不由Schema证明。

<a id="url-缺参的页面呈现"></a>

## URL 缺参的页面呈现

统一运行时在页面文档合法时始终呈现页头、筛选、表头与静态内容。URL 缺少必需页面参数或参数显式无效时，依赖这些输入的页面数据源及其组合、结果绑定和计算消费者使用本次实例的空数据投影；不发送相关请求，不复用旧 initial，不把缺参解释为不限条件。无关数据源继续正常工作，翻页、排序、候选读取和完整导出共用该投影。重新加载并补齐合法输入后从原始声明恢复查询。无需新增页面字段或修改 required。

缺失的必需参数在动态文字中显示“—”，parts 的固定文字保留。原本可选且未传的参数仍按原规则移除整个文本属性，不改变其查询不限语义。占位文字只用于呈现，不写入查询、页面参数值或保存的页面文档。服务端 resolvePageParams 与执行准备入口继续拒绝必需输入不全的执行；可呈现不等于可执行。strictURLInputs 仍拒绝显式无效输入的取数和默认值回退，目标导航输入校验不改变。

合成入口 `/pages/missing-url-inputs`：无 entity 时相关表格为空且静态内容可见；带 `?entity=合成对象` 后按查询声明读取。该场景与业务页 `/pages/rep-business-result-account-detail` 覆盖缺参及补参；合成请求和浏览器空态不证明真实 DQE 已接通。

## Embed 的 URL 输入

Embed 的 `mount` 和完整 `update` 在省略 `initialSearch` 时自动读取当前 window 的 URL：合并 `location.search` 与 `#/...?...` / `#!/...?...` 路由查询串，同名键由 hash 路由整组覆盖，重复值保留；普通锚点不作为参数。显式 `initialSearch`（包括空串）优先且不再合并 URL，空串用于隔离宿主 URL。只在挂载/更新时读取，不监听地址变化、不读取父窗口。初始化通过后自动清理未声明的 URL 参数；地址回写与 Angular 适配规则见[URL 参数清理](actions-and-navigation.md#url-参数清理与地址同步)。参数解析、必需/单值校验与执行回执输入的权威性沿现行规则；直接使用 RuntimeView 时仍由集成应用传入 initialSearch。合成入口 `/pages/embed-url-params?account-name=合成账号甲` 及 embed 的 `examples/url-params.html`，不访问真实账号或 DQE。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

可选参数缺失时，文本引用所在属性整体移除，数组位置按已有解析规则移除；必填文本只能引用必需参数。每个声明参数必须有消费者，6.2的查询初始化/筛选初值绑定也计入消费，既有conformance规则标识名保持兼容。参数格式要与类型相容；导航的`source:param`也是显式读取途径。


## 确定性时间参数

本节描述兼容的旧数组 `type:"time"` 与 `paramBindings` 分支；当前分层参数的声明与原位引用见下文“分层参数与查询侧时间窗口”。两者共用窗口日历算术。

时间参数声明 `type: "time"`、`granularity: "month" | "date"`，值分别为真实日历的 YYYY-MM / YYYY-MM-DD（0001—9999年）。仅未提供URL键时使用default；显式非法、空串或重复时间键阻止初始化，不回退默认月份。时间文本引用可显示原值，6.15起可显式使用period格式，不接受数值格式。

查询通过 `paramBindings.<参数id> = {target:"time",window:...}` 引用必需时间参数。每个查询只有一个时间参数来源，不与时间filterBindings共同控制；query.body内必须保留filter.time，不能同时声明start/end。month参数要求period=month，date参数要求period=day；这只是第一版接入限制，不是把输入精度与指标统计周期等同。

窗口：`{kind:"period",unit:"day"|"month"|"year",offset?:整数}` 表示完整周期（offset缺省0）；`{kind:"lastN",unit:"day"|"month",n:正整数}` 表示含基准期的最近N期；6.4新增 `{kind:"monthToDate"}` / `{kind:"yearToDate"}` 表示自然月/年起点至基准期，不读取系统今天，无需unit。旧 `{kind:"toDate",unit:"month"|"year"}` 保持兼容。月参数不能推断某一天；lastN单位须与输入精度一致（month→month、date→day）。日期计算为确定性日历算术，不读取时钟，不受进程时区影响；起止包含。生成窗口越出0001—9999年时报错。

运行时仅改副本中的查询起止，保留period、is_aggregate及指标；无数据呈现空结果，不回退最新期。时间绑定查询不消费没有参数执行凭据的source.initial旧行；经过prepareExecution核验的执行回执仍是权威。累计、同比/环比、历史预测版本、结果按小时分组与物理分区路由不由此规则计算。

## 分层参数与查询侧时间窗口

params 增加对象分支，按消费位置分两层：params.query.{dimensions,times} 落进 DQE 请求体，params.display 只被文本取值与导航消费。三个数组均为可选非空数组，至少声明一个参数。dimensions 每项为 id、dim_name、可选 dim_value_list；times 每项为 id、granularity、可选且成对的 start/end；display 每项为 id、type 与可选 value。两层 ID 全局唯一，required 缺省 true，label 可选；新结构不接受 default。

维度统一非空去重字符串数组。时间精度 month/date，校验真实日历及起止顺序。一个 times 项就是一个包含区间，单点写成 start 与 end 相同；多个 times 是独立输入，查询显式按 ID 选择；period 与 is_aggregate 留在查询侧。未填值模板允许校验与保存，但必需输入不全不能执行。

原位引用限于 DQE filter.dims[].dim_value_list 的 {param:id} 和 filter.time 的 {period,is_aggregate?,param,window?}。时间引用不写 window 时原样取参数起止，写 window 时以参数值为基准点派生，此时被引用输入必须是单点——已填值的在声明期判，未填值模板留到取值代入时报。window 的取值与语义同上一节，单位须与输入精度相容。引用的参数必须声明在 params.query 下；引用不得与筛选/旧参数绑定双控、不得与查询体字面量起止并存、不得出现在其他请求位置。执行前在副本解析，带引用的查询不消费未经核验的 initial 旧行。

文本区间显示 start 至 end，相同起止显示一次，维度多值用顿号连接。URL 维度用重复键；时间是纯文本，单点写 2026-03，区间写 2026-01..2026-06，未传使用保存实际值，显式非法不回退。旧数组/default/time-window 保持兼容，规范化保存不把分层结构改写为数组。

审批人等仅供下钻的固定输入可直接声明为可选的 query.dimensions 参数，由适用查询的 paramBindings 指定目标。参数不等同于维度筛选器，不会请求候选值。记录模式组合源允许各成员独立消费参数；非记录模式仍要求全员消费同组参数。声明与运行边界见[记录模式](data-sources.md)，合成入口 `/pages/record-join-query-params?approver-name=合成审批人甲`。参数缺值时不增加条件；文本 parts 中的可选参数缺值会使整个标题属性省略。

## 筛选文本取值（6.15）

文本取值增加 `{filter: "筛选器id", format?: "格式预设"}` 分支，与 `{param: "参数id", format?: ...}` 互斥。这两个分支均为整值替换；6.23 可用下述 parts 分支显式组合片段，不接受模板表达式。筛选引用允许在所有既有文本取值位置声明，包括页头、副标题、内容分区标题、普通文本与嵌套组件；dataSources 内的请求体和业务数据不参与文本解析。

filter 读取当前已应用筛选状态，初次从 default/initialParam/URL 或执行回执初始化，随后随筛选变化更新；param 在打开时确定，页内筛选不能修改它。静态字面量不被筛选覆盖；控件位置和文本引用分别声明。未应用的输入草稿不改变期间。

统一格式 `period` 只用于 time/timeRange 参数和 timePoint/timeRange 筛选器：月份/日期单点原样显示，区间为“开始 至 结束”，两端相同只显示一个值，清空 period 筛选引用显示“全部期间”。其他筛选文本缺值显示“—”；维度多值以“、”连接，布尔为 true/false，数值范围可对两端应用既有数值格式，单端范围使用 ≥/≤。不提供 period-compact 或 rangeSeparator。

```json
"asOf": {
  "label": "报告期间",
  "value": { "filter": "report-period-filter", "format": "period" }
}
```

参数提取确认后，原子增加筛选器、查询绑定、页头位置以及显式期间引用；保留已有静态文字或已声明引用，只有对应日期字面量可以改为期间引用。导出捕获当前已解析的文字和筛选状态，在等待完整数据期间不会跟随后续筛选变化。

<a id="文本片段组合623"></a>

## 文本片段组合（6.23）

所有既有文本取值位置增加 `{parts: [...]}`，包括报告主标题、说明、期间、内容分区标题、普通文本与嵌套组件。parts 是 1—64 个片段的有序数组，每项仅允许字符串、`{param, format?}` 或 `{filter, format?}`；不允许嵌套组合、脚本、模板表达式或额外字段。各片段按原顺序连接，空格和标点由作者在字符串片段中明确写出；不增加隐式分隔符或时间格式。必需文本的最终字符串仍须非空。

```json
{"title":{"parts":[{"filter":"report-month","format":"period"}," 经营分析报告"]}}
```

参数片段只读取打开时实际值；筛选片段读取当前已应用状态，输入草稿不参与投影。日期继续使用 period：单点显示规范月份/日期，区间显示“开始 至 结束”，同起止折叠为单点，清空为“全部期间”。任一可选参数片段缺值时整个文本属性（或该数组项）移除，不能留下半句；因此必需标题不能依赖可选参数片段。引用存在性与格式相容性在连接前逐项校验，dataSources 内的请求体与业务数据不参与文本解析。

物化后组件只接收字符串；渲染期按整个文本位置重新投影组合，不重新初始化参数或查询。导出捕获已解析文字，准备期间的后续筛选不会改变本次导出标题。保存与规范化保留 parts 声明。存量字符串与整值引用继续按原语义读取，parts 能力下限为6.23。

时间选择统一使用验收页面 `report-date-filter-example`：单月与范围文字联动分区覆盖月份主标题、独立范围、同起止、清空、多筛选组合和参数文字；范围明细分区保留 DQE 仿真查询联动，禁止未来时间分区覆盖月份／日期边界。文字和受限时间控件不驱动明细查询。日期型、非法输入、可选参数、版本和导出捕获另由行为测试覆盖；仿真不代表真实 DQE 集成。

6.35新增的就地条件与层级状态语义见[条件显隐与动作资格](conditions.md)，旧页面原有行为保持。

## 表头参数消费者（6.85）

表头 select 叶子列的 initialParam 引用 params.query.dimensions 字符串维度参数，作为实例初值，与 defaultValues 互斥；不要求固定 paramBindings，不得重复永久控制目标。参数保存值提供缺省，URL 重复键提供多值；缺席可选参数不限，非法值拒绝。初值只在新实例消费，TableSession 拥有之后的已提交选择，清空、分页、刷新、Tab、恢复空视图与导出不补回 URL。allBehavior 的全选规则、静态 main 范围和查询限制见[Table 正文](components/table.md#table-header-params)。

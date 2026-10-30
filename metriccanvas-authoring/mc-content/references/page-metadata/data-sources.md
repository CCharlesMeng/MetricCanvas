# 页面数据源与初始行

已有页面与指标说明可先形成组件/字段到指标候选、查询条件和缺口的对应表；同名不自动等同于同口径，物理表字段不自动等同于 DQE 指标/维度。缺时间、过滤编码、聚合或连接关系时保留未知；资料齐全再形成协议候选，真实执行并核对结果字段后才作为已验证查询写回页面。匹配报告不是页面字段。 局部修改已有可信绑定时，只核对受影响对象、共享消费者和源依赖；指标匹配报告按任务需要形成。独立 Skill 的组件范围仅缩小读取输出，全页校验与真实查询验真要求保持不变。`local-authoring-scoped-data-demo` 展示两表共享同一合成指标与独立内容，便于核对相关消费者和修改范围。`local-authoring-knowledge-demo` 用内联合成数据展示金额、百分刻度和列宽；真实服务验真另行举证。

页面数据源使用inline静态行或query受控查询。源id来自dataSources对象键，组件data槽引用它。每个数据源声明结果字段契约；数据快照ready/empty/error是运行态，不回写文档。

query.initial保存捕获时间和匹配该查询的初始行，只能在当前条件与声明初值匹配时使用；变更后由网关查询。执行bootstrap初始结果另走执行端口，条件标识与查询定义一致才复用，不与旧initial混用。非查询分页数据源即使 initial.rows.length 小于 initial.totalCount，也直接呈现内嵌初始行，不为补齐数据自动查询；组件提示当前载入条数与总数，不将部分数据当成完整结果。空 initial.rows 同样是可复用快照；未知总数不推断完整性。查询分页的持久化initial仍需有效totalCount与完整第一页，动态结果的总数不一致不阻止显示已有行。跨数据源计算继续使用本轮返回行。

可选compute作用于已归一化行集。inline行使用页面字段id；query结果经queryField映射。静态JSON通过校验不证明真实DQE成功。

查询数值度量在进入快照和 compute 前归一化为有限数字或 `null`，单个异常值不再拒绝整份查询；首屏 initial、动态响应和一层嵌套明细使用同一规则，详见[结果字段契约](fields.md#查询数值度量的容错)。`nullable: false` 的数值度量缺失只告警，普通 query 的缺字段和结构错误仍会失败；组合源可在有界整理阶段兼容，见下文。`query-numeric-tolerance` 是对应完整合成验收示例。

## 查询异常与结果总数

查询失败在内部保留错误分类及 `data-error` 嵌入事件，页面 UI 组件按空数据呈现，不显示错误标题、错误码或错误消息。错误通过 `console.error` 打印页面、数据源、引用组件及具体原因；DQE 字段校验同时打印可用的行号、字段和预期类型。日志不包含原始数据行、字段值、凭据或上游响应正文。关联查询失败时 AI 总结也呈现空态。

未启用6.76按需查询分页的组合源遇到成员异常时，可进入兼容整理；历史`pagedJoin`（含 records）与 `pagedUnion` 共用下述[组合表格异常兼容](#table-result-recovery)。显式查询分页分支失败后不启动完整整理。不可恢复的查询错误仍保留原分类与来源定位；诊断不得包含业务行、键值、筛选值或响应正文。

普通查询的有效 `totalCount` 小于返回行数，或 `resultScope: complete` 声明的完整结果与总数不一致时，通过 `console.warn` 打印 `TOTAL_COUNT_MISMATCH`，保留返回行与原始总数，继续渲染、计算及查询结果绑定。查询分页当前窗口已返回行时，不因较小的总数自动跳页；不符合完整第一页规则的动态窗口不回填到持久化 initial。分页窗口少于业务总数本身是正常情况，不告警。总数格式非法、缺少分页必需总数、返回行数超过请求上限、字段映射或结构不合法仍为错误。完整导出与组合查询源的跨页完整性规则保持独立。

### 有返回行但总数为零

普通页面显示时，`resultScope: "complete"` 的对象查询若 `total_count: 0` 且返回行非空，保留已返回行和原始总数0；不将实际行数改写成已验证总数，不继续按矛盾总数分页，不采集为可信initial。普通指标查询沿用上一节既有兼容规则。数值0、负数与字段缺失语义保持。`columns: null`不影响按queryField映射。

通过 `console.warn` 输出 `TOTAL_COUNT_MISMATCH`：页面、数据源及JSON路径、引用组件/绑定路径、实际返回条数、原始总数和 `completeness: "unverified"`。页面不显示技术报错或伪称无数据，辅助数据槽同样能按已有rowKey关联；正常0行/总数0不告警。告警不包含业务数据行、筛选值或凭据。

父子表格的 `rowExpansion.selection` 同样保留这些父行，按已有行进行层级父行投影与本地分页，允许展开已有父行；继续校验行键和父级匹配，完整父子导出仍拒绝矛盾总数。合成验收入口 `/pages/query-zero-total-hierarchy`。

此对象查询兼容仅允许已有行的显示与无跨源依赖的本源计算；对象完整结果的非零总数矛盾仍失败。完整导出、结果绑定、跨源计算和组合源不将此回执认定为完整输入；字段映射、结构、请求上限、取消及授权边界保持。独立的本地验收入口 `/pages/query-zero-total-demo` 展示主槽异常、辅助槽异常及正常空结果，具体步骤见`pages/capabilities/query/README.md`。本地合成响应和捕获响应重放不等于真实服务联调。

验收使用完整合成页面 `query-numeric-tolerance`：正常返回八行；测试在 DQE HTTP 边界分别注入缺字段、维度类型错误、总数小于或大于返回行数，核对空组件、全部返回行及控制台诊断。对应浏览器测试为 `result-diagnostics.spec.ts`；本地证据不代表真实 DQE 或部署验收。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 多查询组合源 pagedJoin（6.22）


`pagedJoin` 只引用页内已有普通查询源，复用查询定义，独立产出组合表的公开数据快照。成员必须无 compute、无 resultBindings、无业务 TopN/窗口，并声明 `resultScope: complete`。普通结果与内部选页、补列结果隔离；定义引用只传播参数/筛选失效，不改变固定级联顺序。

`domainMember` 定义业务行域；各成员按显式单个非空 string/number 维度键关联，`projection` 覆盖最终字段。类型、角色、单位和币种一致，可能缺匹配的列允许 null。网络、权限或查询配置错误整轮失败；结果异常按下文兼容。序号由 `ordinalField` 生成，与稳定 `rowKey` 分开。

同源可兑现全部排序/筛选且 `canSelectPage` 已经真实验真时，先选页编码，再取各成员编码内的完整行；否则在最大 1000 行的完整行域上关联、筛选、稳定排序并分页。不能筛当前页冒充全局处理。完整本地路径在排序末尾补业务键升序，远端选页仅请求声明的业务排序；缺值在升降序都排尾；可空原始排序字段未确认上游 null 编码时走完整路径。

每个组合源只由一张单槽查询分页表独占；多个组合源可共用普通成员定义。独立图表仍消费完整普通结果。`initial` 保存最终页面字段与默认第一页视图，不是 DQE 原始行；缺少组合 initial 时不会借成员 ordinary initial 拼页。完整导出冻结已提交视图，取得所有匹配行，最多 10000 行/60 秒；结果异常允许整理可用行并附 warning；导出包含“数据异常说明”工作表，不能将缺项文件称为完整原始结果。

`canSelectPage` 是能力声明，静态校验、仿真和样本不能证明真实行域覆盖、计数、排序或粒度。真实 DQE 接入需单列验收；未兑现能力应设为 false 使用有界完整路径。

验收场景 `multi-query-table` 使用 8 个代表处合成数据：预签金额降序第一页为上海、北京、广州，切换召开率降序后为上海、深圳、北京，独立图表仍使用全部 8 行。本节生成的 `paged-join-page` 完整示例展示成员引用与投影；可运行场景另含搜索、导出和独立完整表，分别验证结果隔离与全部匹配行。

6.44查询子表格引用的专属query源从首屏取数中排除；展开后在父行独立作用域中执行。分页、搜索和排序仅改变该实例的生效查询，不改变页面数据源定义、主页面快照或全页筛选。详见[行内子表格](components/table.md#row-expansion)。

6.59 的表格置顶行复用独立普通 query 源，显式 complete 且不使用查询窗口；不改变 main 的明细行域或 pagedJoin 语义。数据网关结果、缓存及计算快照同步保留 cellFallbacks 展示证据，普通查询回填 initial 时恢复原始标量；字段仍按有效类型值参与计算和结果绑定。完整声明见[表格置顶行](components/table.md#table-pinned-top)。

## 按需组合查询分页（6.76）

新建组合表格默认使用 `source.pagination: {"mode":"query","pageSize":10,"batchSize":10}`，两个大小均显式声明，范围1—1000。基准成员 `domainMember` 决定一行代表什么；选页成员决定本轮先查询哪个源。选页请求使用 `offset=pageIndex*pageSize`、`limit=pageSize`，其他成员只按本页去重关联键补列，每批编码和单次读取窗口受 batchSize 限制。pageSize 改小会减少业务页，batchSize 改小只会拆分本页补列。表格继续声明 `pagination.mode:"query"`。

新分支不声明 fallback。成员仍引用页内完整普通 query 定义，无 compute、resultBindings 或业务窗口；这些定义作为内部角色执行，不能污染其独立消费者的完整结果。canSelectPage 必须证明当前条件下的行域、每键一行、准确总数和排序可代表最终表格；后端不需要支持跨源关联。能力不成立直接拒绝，不回退完整关联或异常数据全量整理。

同一时刻只保留一个成员的表格排序和过滤，后提交成员覆盖其他成员状态，同成员条件继续组合，页码回到第一。页面筛选、参数、固定业务和权限条件始终保留。B过滤后不会恢复A默认排序；无显式排序时沿用B查询排序，缺省按B关联键排序。可空字段排序须经后端null顺序验证，当前执行器对未证明的可空排序明确拒绝。

记录变体保留 `records:{"maxBytes":67108864,"timeoutMs":60000}`，每次请求独立超时，最终页受字节预算约束；批次只写 pagination.batchSize，不写 records.batchSize、maxRows 或 timeFilters。rowKey 必须投影基准查询真实唯一记录字段，成员 key 仍是关联键。多条基准记录可共享关联键，补列同键多条仍失败。第一阶段补列成员不能接管记录选页，操作会提示能力不足并保留原页。

新模式不自动完整预热候选。打开菜单才查询，并以该成员操作提交后将保留的条件计算候选和缓存：保留业务条件与本成员其他列条件，清除其他成员表格条件及目标列条件；菜单打开不提交状态。不能准确表达组合完整候选域时不可用，不走历史完整关联。候选网关沿用独立的200行批次、默认1000行总预算，不受浏览10/10配置影响。旧模式的空闲预热保持。

表格 `isNull` 明确表示字段为空或补列缺匹配，不等于空字符串。目前后端完整为空能力未确认，新模式对此操作提示不可用，不在当前页筛空、不删除旧条件或扩大查询。新模式的真实字段映射、稳定分页与总数仍须真实DQE验真。

完整场景：`paged-join-on-demand`、`record-join-on-demand`，本册完整声明见下方生成示例 `paged-join-query-page`、`record-join-query-page`，入口分别为 `/pages/paged-join-on-demand`、`/pages/record-join-on-demand`。均为合成数据。未声明 pagination.mode 的页面继续下述历史规则，不会因新版运行时自动切换；迁移时清理fallback、旧records批次、本地时间条件，并补真实记录标识。不能仅把canSelectPage改成true来通过检查。


## 当前序号与固定业务排名

`ordinalField` 只产出当前排序、筛选后的行序号，分页连续编号，不能声明某个指标的固定业务排名。固定业务排名由普通查询提供独立结果字段，例如预签金额查询同时返回 `bidding_amount` 和 `bidding_rank`；组合源通过 `projection` 按业务键关联该字段，不将其指定为 `ordinalField`。排名范围、指标方向和并列规则由上游查询负责，完整行域取数与页内补列须返回一致的名次；当前页内重新编号不能替代业务排名。

`paged-join-fixed-rank-page` 完整示例使用这一配置。运行场景的两张表独占不同组合源，共用普通查询定义：召开率降序第一页相同，但当前序号为 1、2、3，预签金额排名为 1、4、2。Sim 在完整月份行域按金额降序、编码升序生成名次，表格筛选与搜索保留它；这只是示范查询契约，不证明真实 DQE 已支持排名算子。

<a id="paged-union"></a>

## 分页合并源 pagedUnion（6.61）

`pagedUnion` 引用两个或更多页内普通查询页面数据源，将各来源字段显式投影到同一份结果字段契约，逐行合并后整体排序、计数和查询分页。内容相同的记录照常保留，不聚合、不去重。Table 只绑定该合并源的 `data.main`，并由一张单槽查询分页表独占。

`source.rowKey` 和 `source.sourceField` 分别命名最终行键与来源标识；两者声明为非空 string 维度且不得重名。`members` 的键是稳定来源 ID。每个成员引用已有查询定义，声明非空 string/number 维度 `rowKey`；来源内唯一性由上游保证，运行时检查已读取范围，重复或缺失时进入有界异常整理。最终行键是来源 ID 与原始行键的结构化编码，来源标识无需展示。

成员也可选择组合键（6.72）或显式 UUID（6.73），见[成员行键策略](#分页合并成员行键策略673)。

行键重复、缺失/类型错误及来源排序不一致时，先保留内部严格校验的错误分类，再按下文完整整理可用结果；页面与 Excel 用 `TABLE_RESULT_RECOVERED` 提示来源及处理方式。验收入口 `/pages/multi-source-table?rowFailure=duplicate`、`?rowFailure=missing-key`、`?rowFailure=order` 均使用合成响应。

每个成员的 `projection` 必须覆盖所有非身份输出字段；每项恰好声明 `{ "field": "成员页面字段" }` 或 `{ "value": "常量" }`，缺字段显式写 `{ "value": null }`。类型、角色、单位、币种和可空性必须兼容；比例刻度由上游契约统一，不换算货币、重算比例或执行表达式。外部响应字段仍由成员的 `queryField` 归一化。首期只合并标量字段；成员无 compute、resultBindings、业务 TopN/分页窗口及嵌套组合。普通成员可供独立组件消费，合并视图不会覆盖成员快照。

```json
{
  "type": "pagedUnion",
  "rowKey": "rowKey",
  "sourceField": "memberId",
  "members": {
    "contract": { "source": "contract", "rowKey": "contract-id", "projection": {
      "name": { "field": "contract-name" }, "amount": { "field": "contract-amount" }, "kind": { "value": "合同" }
    } },
    "commercial": { "source": "commercial", "rowKey": "commercial-id", "projection": {
      "name": { "field": "project-title" }, "amount": { "value": null }, "kind": { "value": "商务" }
    } }
  },
  "ordering": { "default": [{ "field": "amount", "direction": "desc" }], "sortableFields": ["amount", "name"], "nulls": "last" },
  "pagination": { "pageSize": 20 }
}
```

该片段是 `source`，需要配套结果字段契约与成员查询；完整合法示例为 `paged-union-page`，可运行验收页为 `multi-source-table`。

`ordering.default` 使用最终页面字段，作用于两个来源的全部匹配记录；首屏表头同步显示，移除用户排序恢复默认。各源先应用映射后的同一业务排序，不自动追加行键排序。指标 DQE 使用 order_by_field/type 单字段格式，显式多字段在请求前失败。统一运行时按业务排序归并，跨来源等值时按来源 ID 升序，来源内等值时保留服务返回顺序；不要求姓名或行键升序。null 升降序均排末尾。来源必须提供相同的比较语义（含字符串排序规则）、稳定有序流、准确匹配总数；运行时发现已读取序列不相容时重新完整整理后全局排序，不仅重排当前批次。

搜索与筛选先作用完整匹配范围，再计数与分页。同列多选为 OR，不同条件为 AND；多字段搜索为字段间 OR，并与筛选条件取 AND。常量命中搜索时该来源无需再按搜索过滤；常量不满足筛选或搜索时可排除整个来源。null 不命中普通值筛选或文本搜索。候选值合并各参与来源的完整匹配域并去重，仅移除当前候选列条件；不会去重数据记录。首期沿用既有候选值协议，不新增“仅缺失值”选项。任一来源不支持所需候选接口时明确返回不可用。每来源及跨源候选最多 10000 项，超限报错；包含搜索依赖集成应用已验证的 `encodeSearch`，默认 DQE 不自动获得该能力。

冷跳深页需要扫描全局前缀，使用最多 4 个视图检查点、每源 200 行缓冲；普通请求池最多缓存 256 个成功结果并淘汰旧项。一次浏览最多扫描 100000 行，读取最多 60 秒，超限明确失败。刷新、排序、筛选、页大小或权限上下文变化不会复用不相容进度。计数变化清除进度并重试一次，持续变化后改走有界整理并标注完整性未确认；页码越界按本轮可用总数纠正。网络、权限、配置与资源错误仍整轮失败。数据按实时 offset 浏览，多次请求不提供事务快照，同总数内容变化可能无法检测。

完整导出冻结已提交视图，按全局顺序取得全部匹配记录，重复记录保留；沿用 10000 行/60 秒限制，超限、网络、权限与配置失败仍不给文件；截断、重复行键等结果异常按下文输出可用行并附异常说明。`initial` 与 pagedJoin 使用相同的最终字段行与默认第一页视图结构，成员 initial 不能冒充合并输入全集。查询标量的原文展示证据随成员字段映射到最终字段，并按归并后的行序保留在快照、完整导出和采集的 initial 中；它不参与排序、计算或行身份。

可运行 `multi-source-table` 使用两个合成普通分页端点，覆盖异字段、来源常量、null、默认整体排序、搜索、候选筛选、分页、Excel 导出与来源详情导航。静态校验、模拟网关与浏览器不证明真实 DQE 已满足上述能力。


<a id="分页合并成员行键策略673"></a>

## 分页合并成员行键策略（6.73）

每个 `pagedUnion.members` 成员必须且只能选择一种策略：单字段 `rowKey`、组合字段 `rowKeyFields`、或 `rowKeyGeneration: "uuid"`。按成员独立选择，可在同一合并源中混用；不配置时仍按既有契约报错，不会遇到 null 后自动切换。

6.72 起，成员可改用 `rowKeyFields` 声明有序组合行键，与 `rowKey` 或 `rowKeyGeneration` 三选一。数组至少包含两个不同的来源原始页面字段 id；每个字段均须有 `queryField`、`role: "dimension"`、`type: "string" | "number"` 和 `nullable: false`。例如按“审批人 × 代表处”返回的结果应声明 `"rowKeyFields": ["commercial-approver", "commercial-office"]`，不能只用审批人作行键。它组合现有结果字段，不新增查询字段、不改变查询粒度、不生成 DQE 表达式，也不改变 `pagedJoin` 的关联键。

每个分量必须是符合声明类型的非空字符串或有限数字；null、缺字段、空字符串和纯空白字符串均是无效身份，整理时跳过对应行，不补键、不裁剪原值、不将数字转换为文字。整个组合在业务契约上须唯一，同一审批人跨代表处可保留，同一来源组合重复仅保留第一条并告警；跨来源相同组合因来源 ID 不同而分别保留。字段顺序就是身份顺序，变更顺序会改变身份。组合身份编码为 `[来源ID, [分量1, 分量2, ...]]` 的 JSON 字符串，避免分隔符碰撞并保留类型；旧 `rowKey` 继续编码为 `[来源ID, 单值]`，历史页面与 initial 身份不变。

`initial` 继续使用最终字符串行键，并按成员声明核对身份中的来源、分量数量、每个位置的类型及非空值。组合键不自动参与排序，不追加第二排序字段，也不提供事务快照；现有实时 offset 分页的排序稳定性要求保持。可观察入口为 `/pages/multi-source-composite-key`，包含同人跨代表处、跨来源相同组合及组合重复/空分量故障场景。


6.73 起，信任上游保证业务行正确性、稳定分页、无重叠及无漏行时，可显式声明 `rowKeyGeneration: "uuid"`，不再要求来源提供业务行键。UUID v4 由执行端安全随机源为每条已取回记录生成，最终行键为 `[来源ID, UUID]` 的 JSON 字符串。它只标识本次读取中的返回行，不是审批人编码或业务主键。

```json
{ "source": "contract", "rowKeyGeneration": "uuid", "projection": {
  "name": { "field": "contract-name" }, "amount": { "field": "contract-amount" }, "kind": { "value": "合同" }
} }
```

此策略允许参与展示的审批人、代表处为 null，但来源字段和最终投影字段须按实际数据声明可空；UUID 不填充业务列、不放宽其他字段类型和非空约束。相同业务行（包括分页重叠返回的行）都会保留并计数，不能依靠 UUID 检测它们；组合键和单键模式按下文跳过空键并保留首条重复键。正常快速路径仍校验每批长度、准确总数和全局排序，异常走完整整理；资源限制保持。切换 UUID 本身不会修复上游排序或分页问题，也不改变 `pagedJoin` 的关联键。

UUID 随已取回的行保存在缓冲区、检查点和 initial 中，复用时保持原值；重新取数、视图变化、缓存失效、刷新和完整导出可产生新 UUID，不保证跨请求一致。`initial` 校验来源、UUID v4 结构及唯一性。运行环境没有安全随机源时返回 `DQE_CONFIG_ERROR`，不退化为索引或弱随机数。不要将临时行键用作详情页业务定位、持久化引用或跨刷新身份；这些场景应投影上游业务标识。

完整示例 `paged-union-generated-key`；合成浏览器入口 `/pages/multi-source-generated-key`，`?rowFailure=missing-composite-key` 仍显示含 null 代表处的行，`?rowFailure=duplicate-composite` 保留重复业务组合，`?rowFailure=order` 整理后显示 warning。旧组合示例在前两项故障下跳过坏行并告警。此验收不代表真实 DQE/Relay 已保证数据正确性。

## 审批记录与当前信息补列（6.66）

`pagedJoin.source.records` 显式启用记录模式，保留主表每条原始记录，成员 `key` 仅为关联键。旧页面不声明 `records`，继续使用原有一键一行、选页补列及最大1000行完整关联规则。

记录模式配置 `batchSize`（1—1000）、`maxBytes`（1024—134217728）及 `timeoutMs`（1—120000）。6.69 起 `maxRows` 可省略，表示不限制主表行数；显式值仍为1—100000的正整数预算。旧版本须声明 `maxRows`。`fallback.maxRows` 不限制 records 行数。指标与对象查询均保留显式排序；未声明时仅按成员关联键升序，不追加排序字段。显式对象多字段排序仍需可信 `encodeObjectSort`，否则失败。表格排序在完整关联后执行。执行器检查准确 `totalCount`、完整窗口和跨批总数；按去重关联键分批补列。主表重复关联键保留，补列表重复键保留第一条，额外编码忽略，截断按可用结果告警；网络、权限、配置和超限仍失败。无事务快照令牌；关联键可重复，单字段排序与总数检查不能证明跨批内容稳定性，仍须真实 DQE 验真。

`timeoutMs` 按批重置，验收 `/pages/record-join-batch-timeout`。

配置示例：

```json
"records": {
  "batchSize": 500,
  "maxBytes": 67108864,
  "timeoutMs": 60000
}
```

省略后仍完整读取、补列、全局筛选和排序，不截断结果；字节、超时、取消及总数/窗口检查保持。示例 `/pages/record-join-no-row-limit` 使用100001条合成记录及128 MiB字节预算。

`rowKey` 与关联键分离：可投影主表真实唯一记录字段；若该字段不在 `projection`，必须声明非空string维度，由执行器按完整读取顺序生成快照内标识。该标识仅在此快照内稳定，不作为跨刷新业务ID；完全相同的两条记录仍保留两行。持久化第一页 initial 无法恢复完整内部快照，因此记录模式重新读取，不借第一页推断后续记录。

`records.timeFilters` 显式声明本地时间筛选：键引用日或月精度 `timeRange`，`field` 引用主表的最终投影字段，`valueFormat` 声明 `iso`（YYYY-MM-DD）、`compact`（YYYYMMDD）或 `datetime`（YYYY-MM-DD HH:mm:ss）；返回值须符合声明格式和真实日历，非法值明确失败。`datetime` 对月份、日期展开为起日00:00:00、止日23:59:59，按来源本地日历比较，不做时区转换。主表查询不再声明相同筛选绑定；完整读取后先筛主表，再补列。筛选不伪造 `filter.time`，也不需要补列表存在统计期间字段；本地过滤意味着主表读取预算覆盖区域内所有被读取记录，而非仅期间内结果。

6.68起，已确认可下推的审批时间应使用主表查询 `filterBindings` 的 `target:time + queryField + valueFormat`（见[指定时间字段](queries-and-bindings.md#metric-field-time)），并移除同一筛选的 `records.timeFilters`。先由上游筛选并返回匹配总数，再检查记录预算、分批读取和补列。仍需本地过滤的既有页面继续显式使用 `records.timeFilters`；其预算始终按过滤前读取范围计算。两种声明不能对同一个筛选重复配置。

成员 `notApplicableFilters` 仅用于记录模式的非主表成员，显式列出由其他成员消费、而自己不适用的筛选；不能与已消费筛选重叠、不能引用未知筛选。其余业务筛选仍须消费，成员自己的静态条件和权限条件保留。此声明不绕过权限，也不授予取数范围。

完整关联成功后才对全部匹配审批记录执行搜索、表头筛选、稳定排序和当前页切片，`totalCount` 按记录数计算。同一 SourceProgram 保存一份受已声明资源限制约束的完整快照；翻页、排序、搜索、表头条件复用它，区域、期间、上下文或显式刷新使其失效。表头候选使用该结果，保留其他条件，仅排除自身列条件；不受完整导出10000行限制。导出复用相同规则，仍遵守10000行/60秒限制，不能用部分扫描结果充当完整文件。

合成验收入口：`/pages/record-join-demo` 为1205条审批；`/pages/object-record-join-demo` 为对象主表分批读取、指标补列及全局表格操作。`pages/business-rejection-details.json` 是业务配置；真实DQE字段、数据粒度、区域语义、HCS排除和服务完整性须真实环境确认。


<a id="table-result-recovery"></a>

## 组合表格异常兼容

`pagedUnion` 与 `pagedJoin`（含 records）默认兼容动态结果异常，已有页面无需新增配置或改写版本。页面声明、inline 行和持久化 initial 的结构校验保持严格。普通 query 独立消费者仍使用原契约；内部 `resultPolicy` 不是页面字段，也不发送到 DQE 请求体。

正常数据继续使用既有选页、补列或有序流。发现缺字段、非对象行、无效/重复键、窗口截断、缺少/矛盾总数或来源排序异常后，按原查询的业务、权限和静态条件重新有界读取；原始窗口长度先用于推进 offset，然后才做清理。标量字段缺失或不可用对象补 null，页面显示既有 missingText（默认 —）；已有可展示标量原文回退保持。null 或非对象行无有效身份时跳过，不生成假的业务键。单键、组合键及关联键始终使用真实有效类型值；同一来源重复身份保留最先返回的一条，不合计、不覆盖；跨来源同内容不去重。UUID 模式仍保留有内容的重复业务记录。

普通关联先按 domainMember 形成可用业务行域，补列缺匹配时主行保留、补充字段为 null；补充结果中的额外键忽略。records 保留同一关联键的多条不同记录，仅按最终记录身份去重，无效本地审批时间跳行。不可用来源若只发生结果形状错误，可以保留其他可用来源；权限拒绝、配置错误、网络错误、取消与超时保持原失败语义。

整理完成后，才按当前视图进行全局筛选、搜索、排序、计数和分页；totalCount 表示本轮可用匹配行数，不是已验证的上游原始总数。短窗口、总数不可确认或变化会另行提示“结果可能有缺项”。来源未加载部分的异常无法由快速路径提前发现；同总数内容变化仍不能证明事务一致性。

表格上方以一条可展开提示呈现“部分数据异常，当前展示可用结果”，其中列明来源、处理方式及次数。数据快照的 warnings 与控制台 `TABLE_RESULT_RECOVERED` 保留同一脱值诊断；错误日志、告警和导出说明都不带原始业务值。存在 warning 的结果不采集为可复用组合 initial；数据准备好后刷新会重新请求，正常数据恢复原路径并移除 warning。

Excel 允许缺项，数据工作表导出整理后的全部匹配行，而非当前页；缺值默认 —，另附“数据异常说明”工作表，说明文件可能有缺项、来源、处理方式和次数。正常文件不额外增加说明表。导出不会把缺项结果冒充完整原始数据，也不自动产生聚合补值。资源上限、授权、过滤条件和取消规则不放宽。

异常整理使用最多200行的来源批次和64MiB默认字节预算；普通 pagedJoin 仍受 fallback.maxRows 限制。records 保留声明的 maxRows/maxBytes/timeoutMs，未声明主行预算时异常整理最多100000行；正常无预算记录路径不变。pagedUnion 整理时全来源原始扫描合计最多100000行，导出最多扫描10000行；导出的可用匹配结果仍最多10000行。默认60秒、记录模式声明的超时、取消和过期回执均有效，超限明确失败。

合成入口 `/pages/table-data-recovery` 同时展示缺字段、对象值、不规则行、重复来源 key 与重复补充记录；`?recoveryState=ready` 演示数据准备好后恢复无告警。页面位于 `pages/capabilities/table/table-data-recovery.json`，模拟数据与故障注入在 `apps/playground/fixtures/table-recovery.ts`；无需 DQE Sim。真实 DQE/Relay 行为须另验。


页面协议 6.77。结构真源为本册[schema.json](schema.json)，SHA256 `3e3abe3dbef48003227a8d96f3aa43d01149423952180076840aeeb1b1d61ba4`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f64617461536f75726365"></a>

### `@dataSource`

Schema位置：`#/definitions/dataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617461536f757263652f616e794f662f30"></a>

### `@dataSource · anyOf[0]`

Schema位置：`#/definitions/dataSource/anyOf/0`。目标：[#/definitions/inlineDataSource](data-sources.md#schema-232f646566696e6974696f6e732f696e6c696e6544617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/inlineDataSource | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f75726365"></a>

### `@inlineDataSource`

Schema位置：`#/definitions/inlineDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["fields","source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f6669656c6473"></a>

### `@inlineDataSource.fields`

Schema位置：`#/definitions/inlineDataSource/properties/fields`。目标：[#/definitions/fields](fields.md#schema-232f646566696e6974696f6e732f6669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fields | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f636f6d70757465"></a>

### `@inlineDataSource.compute`

Schema位置：`#/definitions/inlineDataSource/properties/compute`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按顺序执行的封闭具名算子。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f636f6d707574652f616c6c4f662f30"></a>

### `@inlineDataSource.compute · allOf[0]`

Schema位置：`#/definitions/inlineDataSource/properties/compute/allOf/0`。目标：[#/definitions/compute](compute.md#schema-232f646566696e6974696f6e732f636f6d70757465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compute | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f736f75726365"></a>

### `@inlineDataSource.source`

Schema位置：`#/definitions/inlineDataSource/properties/source`。目标：[#/definitions/inlineSource](data-sources.md#schema-232f646566696e6974696f6e732f696e6c696e65536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/inlineSource | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f75726365"></a>

### `@inlineSource`

Schema位置：`#/definitions/inlineSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","rows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f74797065"></a>

### `@inlineSource.type`

Schema位置：`#/definitions/inlineSource/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="inline" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "inline" | 用于选择@inlineSource.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f7773"></a>

### `@inlineSource.rows`

Schema位置：`#/definitions/inlineSource/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f77732f6974656d73"></a>

### `@inlineSource.rows[]`

Schema位置：`#/definitions/inlineSource/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f77732f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@inlineSource.rows[]{key}`

Schema位置：`#/definitions/inlineSource/properties/rows/items/additionalProperties`。目标：[#/definitions/fieldValue](fields.md#schema-232f646566696e6974696f6e732f6669656c6456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f77732f6974656d732f70726f70657274794e616d6573"></a>

### `@inlineSource.rows[] · propertyNames`

Schema位置：`#/definitions/inlineSource/properties/rows/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617461536f757263652f616e794f662f31"></a>

### `@dataSource · anyOf[1]`

Schema位置：`#/definitions/dataSource/anyOf/1`。目标：[#/definitions/queryDataSource](data-sources.md#schema-232f646566696e6974696f6e732f717565727944617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryDataSource | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f75726365"></a>

### `@queryDataSource`

Schema位置：`#/definitions/queryDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["fields","source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f6669656c6473"></a>

### `@queryDataSource.fields`

Schema位置：`#/definitions/queryDataSource/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f6669656c64732f616e794f662f30"></a>

### `@queryDataSource.fields · anyOf[0]`

Schema位置：`#/definitions/queryDataSource/properties/fields/anyOf/0`。目标：[#/definitions/queryFields](fields.md#schema-232f646566696e6974696f6e732f71756572794669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryFields | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f6669656c64732f616e794f662f31"></a>

### `@queryDataSource.fields · anyOf[1]`

Schema位置：`#/definitions/queryDataSource/properties/fields/anyOf/1`。目标：[#/definitions/groupedQueryFields](fields.md#schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/groupedQueryFields | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f636f6d70757465"></a>

### `@queryDataSource.compute`

Schema位置：`#/definitions/queryDataSource/properties/compute`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按顺序执行的封闭具名算子。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f636f6d707574652f616c6c4f662f30"></a>

### `@queryDataSource.compute · allOf[0]`

Schema位置：`#/definitions/queryDataSource/properties/compute/allOf/0`。目标：[#/definitions/compute](compute.md#schema-232f646566696e6974696f6e732f636f6d70757465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compute | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f736f75726365"></a>

### `@queryDataSource.source`

Schema位置：`#/definitions/queryDataSource/properties/source`。目标：[#/definitions/querySource](data-sources.md#schema-232f646566696e6974696f6e732f7175657279536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/querySource | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f75726365"></a>

### `@querySource`

Schema位置：`#/definitions/querySource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","query"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f74797065"></a>

### `@querySource.type`

Schema位置：`#/definitions/querySource/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f726573756c7453636f7065"></a>

### `@querySource.resultScope`

Schema位置：`#/definitions/querySource/properties/resultScope`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="complete" | Schema未设默认；装配/运行时默认见语义说明 | complete 声明完整结果；计算不把分页窗口当作全量。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "complete" | 用于选择@querySource.resultScope分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f696e697469616c"></a>

### `@querySource.initial`

Schema位置：`#/definitions/querySource/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f696e697469616c2f616c6c4f662f30"></a>

### `@querySource.initial · allOf[0]`

Schema位置：`#/definitions/querySource/properties/initial/allOf/0`。目标：[#/definitions/embeddedInitialRows](data-sources.md#schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f7773)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/embeddedInitialRows | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f7773"></a>

### `@embeddedInitialRows`

Schema位置：`#/definitions/embeddedInitialRows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["capturedAt","rows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f63617074757265644174"></a>

### `@embeddedInitialRows.capturedAt`

Schema位置：`#/definitions/embeddedInitialRows/properties/capturedAt`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z&#124;[+-]\\d{2}:\\d{2})$" | Schema未设默认；装配/运行时默认见语义说明 | 内嵌行的有效RFC3339捕获时间。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f7773"></a>

### `@embeddedInitialRows.rows`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f77732f6974656d73"></a>

### `@embeddedInitialRows.rows[]`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f77732f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@embeddedInitialRows.rows[]{key}`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows/items/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f77732f6974656d732f70726f70657274794e616d6573"></a>

### `@embeddedInitialRows.rows[] · propertyNames`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f746f74616c436f756e74"></a>

### `@embeddedInitialRows.totalCount`

Schema位置：`#/definitions/embeddedInitialRows/properties/totalCount`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 查询总条数；不能用当前页rows.length冒充。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f7175657279"></a>

### `@querySource.query`

Schema位置：`#/definitions/querySource/properties/query`。目标：[#/definitions/pageQuery](queries-and-bindings.md#schema-232f646566696e6974696f6e732f706167655175657279)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageQuery | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f64617461536f757263652f616e794f662f32"></a>

### `@dataSource · anyOf[2]`

Schema位置：`#/definitions/dataSource/anyOf/2`。目标：[#/definitions/pagedJoinDataSource](data-sources.md#schema-232f646566696e6974696f6e732f70616765644a6f696e44617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pagedJoinDataSource | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e44617461536f75726365"></a>

### `@pagedJoinDataSource`

Schema位置：`#/definitions/pagedJoinDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["fields","source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e44617461536f757263652f70726f706572746965732f6669656c6473"></a>

### `@pagedJoinDataSource.fields`

Schema位置：`#/definitions/pagedJoinDataSource/properties/fields`。目标：[#/definitions/fields](fields.md#schema-232f646566696e6974696f6e732f6669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fields | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e44617461536f757263652f70726f706572746965732f736f75726365"></a>

### `@pagedJoinDataSource.source`

Schema位置：`#/definitions/pagedJoinDataSource/properties/source`。目标：[#/definitions/pagedJoinSource](data-sources.md#schema-232f646566696e6974696f6e732f70616765644a6f696e536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pagedJoinSource | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f75726365"></a>

### `@pagedJoinSource`

Schema位置：`#/definitions/pagedJoinSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","rowKey","domainMember","members","projection","ordering","pagination","onMissing"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f74797065"></a>

### `@pagedJoinSource.type`

Schema位置：`#/definitions/pagedJoinSource/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="pagedJoin" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "pagedJoin" | 用于选择@pagedJoinSource.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f726f774b6579"></a>

### `@pagedJoinSource.rowKey`

Schema位置：`#/definitions/pagedJoinSource/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f646f6d61696e4d656d626572"></a>

### `@pagedJoinSource.domainMember`

Schema位置：`#/definitions/pagedJoinSource/properties/domainMember`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 完整结果定义业务行域的成员 ID。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d62657273"></a>

### `@pagedJoinSource.members`

Schema位置：`#/definitions/pagedJoinSource/properties/members`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 复用页内普通查询定义的成员映射；定义引用不构成固定级联。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedJoinSource.members{key}`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["source","key","canSelectPage"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f736f75726365"></a>

### `@pagedJoinSource.members{key}.source`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6b6579"></a>

### `@pagedJoinSource.members{key}.key`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/key`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["field","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 成员结果业务键和显式编码输入目标。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6b65792f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.members{key}.key.field`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/key/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6b65792f70726f706572746965732f71756572794669656c64"></a>

### `@pagedJoinSource.members{key}.key.queryField`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/key/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f63616e53656c65637450616765"></a>

### `@pagedJoinSource.members{key}.canSelectPage`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/canSelectPage`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 经数据侧验真：覆盖相同行域、一键一行，且支持排序、总数和稳定键排序；不能从样本推断。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6e6f744170706c696361626c6546696c74657273"></a>

### `@pagedJoinSource.members{key}.notApplicableFilters`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/notApplicableFilters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 仅记录模式非主表成员：显式声明其他成员消费、自己不适用的业务筛选，不得重叠或漏配。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6e6f744170706c696361626c6546696c746572732f6974656d73"></a>

### `@pagedJoinSource.members{key}.notApplicableFilters[]`

Schema位置：`#/definitions/pagedJoinSource/properties/members/additionalProperties/properties/notApplicableFilters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6d656d626572732f70726f70657274794e616d6573"></a>

### `@pagedJoinSource.members · propertyNames`

Schema位置：`#/definitions/pagedJoinSource/properties/members/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f70726f6a656374696f6e"></a>

### `@pagedJoinSource.projection`

Schema位置：`#/definitions/pagedJoinSource/properties/projection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 最终字段到成员原始字段的显式一对一投影；序号除外。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedJoinSource.projection{key}`

Schema位置：`#/definitions/pagedJoinSource/properties/projection/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["member","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6d656d626572"></a>

### `@pagedJoinSource.projection{key}.member`

Schema位置：`#/definitions/pagedJoinSource/properties/projection/additionalProperties/properties/member`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 投影所属成员 ID。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.projection{key}.field`

Schema位置：`#/definitions/pagedJoinSource/properties/projection/additionalProperties/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f70726f6a656374696f6e2f70726f70657274794e616d6573"></a>

### `@pagedJoinSource.projection · propertyNames`

Schema位置：`#/definitions/pagedJoinSource/properties/projection/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e67"></a>

### `@pagedJoinSource.ordering`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["default","sortableFields","nulls"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 全局排序声明与交互可排序字段集合。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c74"></a>

### `@pagedJoinSource.ordering.default`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c742f6974656d73"></a>

### `@pagedJoinSource.ordering.default[]`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/default/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["field","direction"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c742f6974656d732f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.ordering.default[].field`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/default/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c742f6974656d732f70726f706572746965732f646972656374696f6e"></a>

### `@pagedJoinSource.ordering.default[].direction`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/default/items/properties/direction`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["asc","desc"] | Schema未设默认；装配/运行时默认见语义说明 | 按原始值升序或降序，缺值始终排尾。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "asc" | 按原始可比较值升序，缺值仍排尾。 |
| "desc" | 按原始可比较值降序，缺值仍排尾。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f736f727461626c654669656c6473"></a>

### `@pagedJoinSource.ordering.sortableFields`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/sortableFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 允许交互全局排序的最终投影字段。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f736f727461626c654669656c64732f6974656d73"></a>

### `@pagedJoinSource.ordering.sortableFields[]`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/sortableFields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f6e756c6c73"></a>

### `@pagedJoinSource.ordering.nulls`

Schema位置：`#/definitions/pagedJoinSource/properties/ordering/properties/nulls`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="last" | Schema未设默认；装配/运行时默认见语义说明 | 缺值升降序均排尾；未验证 DQE 缺值排序时完整关联。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "last" | 用于选择@pagedJoinSource.ordering.nulls分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e"></a>

### `@pagedJoinSource.pagination`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 分页来源与大小配置；query与local条件不同。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f616e794f662f30"></a>

### `@pagedJoinSource.pagination · anyOf[0]`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["pageSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f616e794f662f302f70726f706572746965732f7061676553697a65"></a>

### `@pagedJoinSource.pagination · anyOf[0].pageSize`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/anyOf/0/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f616e794f662f31"></a>

### `@pagedJoinSource.pagination · anyOf[1]`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","pageSize","batchSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f616e794f662f312f70726f706572746965732f6d6f6465"></a>

### `@pagedJoinSource.pagination · anyOf[1].mode`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/anyOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f616e794f662f312f70726f706572746965732f7061676553697a65"></a>

### `@pagedJoinSource.pagination · anyOf[1].pageSize`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/anyOf/1/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f616e794f662f312f70726f706572746965732f626174636853697a65"></a>

### `@pagedJoinSource.pagination · anyOf[1].batchSize`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/anyOf/1/properties/batchSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 按需补列的编码分组和单次响应窗口上限，1至1000；默认创作显式写10，不扫描完整业务行域。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f66616c6c6261636b"></a>

### `@pagedJoinSource.fallback`

Schema位置：`#/definitions/pagedJoinSource/properties/fallback`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["maxRows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 有界完整关联策略的限制。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f66616c6c6261636b2f70726f706572746965732f6d6178526f7773"></a>

### `@pagedJoinSource.fallback.maxRows`

Schema位置：`#/definitions/pagedJoinSource/properties/fallback/properties/maxRows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 完整行域和每个补列成员均不得超出，最大 1000 行。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f6e4d697373696e67"></a>

### `@pagedJoinSource.onMissing`

Schema位置：`#/definitions/pagedJoinSource/properties/onMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="null" | Schema未设默认；装配/运行时默认见语义说明 | 成功无匹配行输出 null；失败不能冒充缺行。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f6f7264696e616c4669656c64"></a>

### `@pagedJoinSource.ordinalField`

Schema位置：`#/definitions/pagedJoinSource/properties/ordinalField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前排序筛选下生成的数值行序号，不充当关联键。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f726473"></a>

### `@pagedJoinSource.records`

Schema位置：`#/definitions/pagedJoinSource/properties/records`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["maxBytes","timeoutMs"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 显式启用逐条保留审批记录的多对一补列；行键独立于关联键。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f626174636853697a65"></a>

### `@pagedJoinSource.records.batchSize`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/batchSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 每次单表分页及关联键集合的批次大小，1至1000。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f6d6178526f7773"></a>

### `@pagedJoinSource.records.maxRows`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/maxRows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=100000 | Schema未设默认；装配/运行时默认见语义说明 | 可选；6.69起省略表示不限制行数。显式值1至100000，限制本地时间筛选前的主表读取量；字节与超时保持。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f6d61784279746573"></a>

### `@pagedJoinSource.records.maxBytes`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/maxBytes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1024; maximum=134217728 | Schema未设默认；装配/运行时默认见语义说明 | 原始成员行与最终投影的累计UTF-8字节预算，超限整轮失败。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f74696d656f75744d73"></a>

### `@pagedJoinSource.records.timeoutMs`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/timeoutMs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=120000 | Schema未设默认；装配/运行时默认见语义说明 | 主表/补列表每次分页请求的超时预算（含排队）；每批重置，不限整轮耗时。超时整轮失败且不缓存部分结果。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f74696d6546696c74657273"></a>

### `@pagedJoinSource.records.timeFilters`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/timeFilters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 本地时间筛选映射，键引用日/月timeRange；字段必须投影自主表，补列成员须声明不适用。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f74696d6546696c746572732f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedJoinSource.records.timeFilters{key}`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/timeFilters/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["field","valueFormat"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f74696d6546696c746572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.records.timeFilters{key}.field`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/timeFilters/additionalProperties/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f74696d6546696c746572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f76616c7565466f726d6174"></a>

### `@pagedJoinSource.records.timeFilters{key}.valueFormat`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/timeFilters/additionalProperties/properties/valueFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["iso","compact","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 时间点取值送进谓词的写法：iso原样YYYY-MM，compact去掉分隔符。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "iso" | 时间点原样送 YYYY-MM / YYYY-MM-DD。 |
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f7265636f7264732f70726f706572746965732f74696d6546696c746572732f70726f70657274794e616d6573"></a>

### `@pagedJoinSource.records.timeFilters · propertyNames`

Schema位置：`#/definitions/pagedJoinSource/properties/records/properties/timeFilters/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c"></a>

### `@pagedJoinSource.initial`

Schema位置：`#/definitions/pagedJoinSource/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["capturedAt","rows","totalCount","view"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f63617074757265644174"></a>

### `@pagedJoinSource.initial.capturedAt`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/capturedAt`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z&#124;[+-]\\d{2}:\\d{2})$" | Schema未设默认；装配/运行时默认见语义说明 | 内嵌行的有效RFC3339捕获时间。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f7773"></a>

### `@pagedJoinSource.initial.rows`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f77732f6974656d73"></a>

### `@pagedJoinSource.initial.rows[]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f77732f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedJoinSource.initial.rows[]{key}`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/rows/items/additionalProperties`。目标：[#/definitions/fieldValue](fields.md#schema-232f646566696e6974696f6e732f6669656c6456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f77732f6974656d732f70726f70657274794e616d6573"></a>

### `@pagedJoinSource.initial.rows[] · propertyNames`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/rows/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f63656c6c46616c6c6261636b73"></a>

### `@pagedJoinSource.initial.cellFallbacks`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/cellFallbacks`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 已归一化组合快照的原文证据；随行序保存与恢复。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f63656c6c46616c6c6261636b732f616c6c4f662f30"></a>

### `@pagedJoinSource.initial.cellFallbacks · allOf[0]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/cellFallbacks/allOf/0`。目标：[#/definitions/cellFallbacks](fields.md#schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/cellFallbacks | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f746f74616c436f756e74"></a>

### `@pagedJoinSource.initial.totalCount`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/totalCount`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 查询总条数；不能用当前页rows.length冒充。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f76696577"></a>

### `@pagedJoinSource.initial.view`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["pageIndex","pageSize","sort","predicates"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 采集时的规范化已提交视图；组合 initial 必须匹配默认第一页。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f70616765496e646578"></a>

### `@pagedJoinSource.initial.view.pageIndex`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/pageIndex`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 从零开始的页码。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7061676553697a65"></a>

### `@pagedJoinSource.initial.view.pageSize`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f7274"></a>

### `@pagedJoinSource.initial.view.sort`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/sort`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 优先级顺序排列的全局排序数组；空数组恢复组合默认排序。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f72742f6974656d73"></a>

### `@pagedJoinSource.initial.view.sort[]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/sort/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["field","direction"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f72742f6974656d732f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.initial.view.sort[].field`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/sort/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f72742f6974656d732f70726f706572746965732f646972656374696f6e"></a>

### `@pagedJoinSource.initial.view.sort[].direction`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/sort/items/properties/direction`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["asc","desc"] | Schema未设默认；装配/运行时默认见语义说明 | 按原始值升序或降序，缺值始终排尾。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "asc" | 按原始可比较值升序，缺值仍排尾。 |
| "desc" | 按原始可比较值降序，缺值仍排尾。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f70726564696361746573"></a>

### `@pagedJoinSource.initial.view.predicates`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 最终字段上的 AND 条件；会话条件不写回定义；默认 initial 必须为空。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d73"></a>

### `@pagedJoinSource.initial.view.predicates[]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f30"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","values"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0].field`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f6f70"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0].op`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="in" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "in" | 原始值严格属于字面量集合；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c756573"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0].values`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 显式选择集合，保留字符串或数值类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0].values[]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c7565732f6974656d732f616e794f662f30"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0].values[] · anyOf[0]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c7565732f6974656d732f616e794f662f31"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[0].values[] · anyOf[1]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f31"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[1]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[1].field`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f312f70726f706572746965732f6f70"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[1].op`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/1/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["gte","lte"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gte" | 原始number/money值大于等于阈值，按原始单位。 |
| "lte" | 原始number/money值小于等于阈值，按原始单位。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[1].value`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f32"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[2]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[2].field`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f6f70"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[2].op`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dateRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dateRange" | 日期范围筛选控件。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f66726f6d"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[2].from`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f746f"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[2].to`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f33"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[3]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f332f70726f706572746965732f6669656c64"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[3].field`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/3/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f332f70726f706572746965732f6f70"></a>

### `@pagedJoinSource.initial.view.predicates[] · anyOf[3].op`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/3/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="isNull" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "isNull" | 只匹配合法null值；缺字段仍是契约错误。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736561726368"></a>

### `@pagedJoinSource.initial.view.search`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/search`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["fields","query"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 已提交文本搜索；首版组合搜索使用有界完整关联，草稿不进入。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f6669656c6473"></a>

### `@pagedJoinSource.initial.view.search.fields`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/search/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@pagedJoinSource.initial.view.search.fields[]`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/search/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f7175657279"></a>

### `@pagedJoinSource.initial.view.search.query`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/search/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f6d61746368"></a>

### `@pagedJoinSource.initial.view.search.match`

Schema位置：`#/definitions/pagedJoinSource/properties/initial/properties/view/properties/search/properties/match`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="equals" | Schema未设默认；装配/运行时默认见语义说明 | 按声明维度等值选择行。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "equals" | 用于选择@pagedJoinSource.initial.view.search.match分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64617461536f757263652f616e794f662f33"></a>

### `@dataSource · anyOf[3]`

Schema位置：`#/definitions/dataSource/anyOf/3`。目标：[#/definitions/pagedUnionDataSource](data-sources.md#schema-232f646566696e6974696f6e732f7061676564556e696f6e44617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pagedUnionDataSource | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e44617461536f75726365"></a>

### `@pagedUnionDataSource`

Schema位置：`#/definitions/pagedUnionDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["fields","source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e44617461536f757263652f70726f706572746965732f6669656c6473"></a>

### `@pagedUnionDataSource.fields`

Schema位置：`#/definitions/pagedUnionDataSource/properties/fields`。目标：[#/definitions/fields](fields.md#schema-232f646566696e6974696f6e732f6669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fields | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e44617461536f757263652f70726f706572746965732f736f75726365"></a>

### `@pagedUnionDataSource.source`

Schema位置：`#/definitions/pagedUnionDataSource/properties/source`。目标：[#/definitions/pagedUnionSource](data-sources.md#schema-232f646566696e6974696f6e732f7061676564556e696f6e536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pagedUnionSource | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f75726365"></a>

### `@pagedUnionSource`

Schema位置：`#/definitions/pagedUnionSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","rowKey","sourceField","members","ordering","pagination"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f74797065"></a>

### `@pagedUnionSource.type`

Schema位置：`#/definitions/pagedUnionSource/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="pagedUnion" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "pagedUnion" | 用于选择@pagedUnionSource.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f726f774b6579"></a>

### `@pagedUnionSource.rowKey`

Schema位置：`#/definitions/pagedUnionSource/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f736f757263654669656c64"></a>

### `@pagedUnionSource.sourceField`

Schema位置：`#/definitions/pagedUnionSource/properties/sourceField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 最终来源标识字段；由成员 ID 生成的非空 string 维度。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d62657273"></a>

### `@pagedUnionSource.members`

Schema位置：`#/definitions/pagedUnionSource/properties/members`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=2 | Schema未设默认；装配/运行时默认见语义说明 | 至少两个普通查询来源，逐行保留全部记录；来源 ID 不随显示名变化。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedUnionSource.members{key}`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","projection","rowKey"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f736f75726365"></a>

### `@pagedUnionSource.members{key} · anyOf[0].source`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 覆盖全部非身份输出列；每列显式映射字段、常量或 null。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key}`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[0].field`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[1].value`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[1].value · anyOf[2]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f33"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection{key} · anyOf[1].value · anyOf[3]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f70726f6a656374696f6e2f70726f70657274794e616d6573"></a>

### `@pagedUnionSource.members{key} · anyOf[0].projection · propertyNames`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f726f774b6579"></a>

### `@pagedUnionSource.members{key} · anyOf[0].rowKey`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","projection","rowKeyFields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f736f75726365"></a>

### `@pagedUnionSource.members{key} · anyOf[1].source`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 覆盖全部非身份输出列；每列显式映射字段、常量或 null。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key}`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[0].field`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[1].value`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[1].value · anyOf[2]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f33"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection{key} · anyOf[1].value · anyOf[3]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70726f6a656374696f6e2f70726f70657274794e616d6573"></a>

### `@pagedUnionSource.members{key} · anyOf[1].projection · propertyNames`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f726f774b65794669656c6473"></a>

### `@pagedUnionSource.members{key} · anyOf[1].rowKeyFields`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/rowKeyFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=2 | Schema未设默认；装配/运行时默认见语义说明 | 6.72起可用，与rowKey和rowKeyGeneration三选一；至少两个不同的来源原始非空string/number维度，按声明顺序组成来源内唯一身份，不参与排序。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f726f774b65794669656c64732f6974656d73"></a>

### `@pagedUnionSource.members{key} · anyOf[1].rowKeyFields[]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/rowKeyFields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f32"></a>

### `@pagedUnionSource.members{key} · anyOf[2]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","projection","rowKeyGeneration"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f736f75726365"></a>

### `@pagedUnionSource.members{key} · anyOf[2].source`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 覆盖全部非身份输出列；字段类型和可空性仍须兼容。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key}`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[0].field`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[1].value`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[1].value · anyOf[2]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f33"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection{key} · anyOf[1].value · anyOf[3]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f70726f6a656374696f6e2f70726f70657274794e616d6573"></a>

### `@pagedUnionSource.members{key} · anyOf[2].projection · propertyNames`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f726f774b657947656e65726174696f6e"></a>

### `@pagedUnionSource.members{key} · anyOf[2].rowKeyGeneration`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/rowKeyGeneration`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="uuid" | Schema未设默认；装配/运行时默认见语义说明 | 6.73起显式选择uuid，与rowKey和rowKeyFields三选一；仅标识本次返回行，业务重复与分页重叠由上游保证。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "uuid" | 用于选择@pagedUnionSource.members{key} · anyOf[2].rowKeyGeneration分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f70726f70657274794e616d6573"></a>

### `@pagedUnionSource.members · propertyNames`

Schema位置：`#/definitions/pagedUnionSource/properties/members/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e67"></a>

### `@pagedUnionSource.ordering`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["default","sortableFields","nulls"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 全局排序声明与交互可排序字段集合。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c74"></a>

### `@pagedUnionSource.ordering.default`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c742f6974656d73"></a>

### `@pagedUnionSource.ordering.default[]`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/default/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["field","direction"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c742f6974656d732f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.ordering.default[].field`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/default/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f64656661756c742f6974656d732f70726f706572746965732f646972656374696f6e"></a>

### `@pagedUnionSource.ordering.default[].direction`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/default/items/properties/direction`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["asc","desc"] | Schema未设默认；装配/运行时默认见语义说明 | 按原始值升序或降序，缺值始终排尾。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "asc" | 按原始可比较值升序，缺值仍排尾。 |
| "desc" | 按原始可比较值降序，缺值仍排尾。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f736f727461626c654669656c6473"></a>

### `@pagedUnionSource.ordering.sortableFields`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/sortableFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 允许交互全局排序的最终投影字段。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f736f727461626c654669656c64732f6974656d73"></a>

### `@pagedUnionSource.ordering.sortableFields[]`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/sortableFields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6f72646572696e672f70726f706572746965732f6e756c6c73"></a>

### `@pagedUnionSource.ordering.nulls`

Schema位置：`#/definitions/pagedUnionSource/properties/ordering/properties/nulls`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="last" | Schema未设默认；装配/运行时默认见语义说明 | 各来源使用相同比较规则，null 升降序始终排末尾；不相容时报错。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "last" | 用于选择@pagedUnionSource.ordering.nulls分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f706167696e6174696f6e"></a>

### `@pagedUnionSource.pagination`

Schema位置：`#/definitions/pagedUnionSource/properties/pagination`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["pageSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 分页来源与大小配置；query与local条件不同。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f706167696e6174696f6e2f70726f706572746965732f7061676553697a65"></a>

### `@pagedUnionSource.pagination.pageSize`

Schema位置：`#/definitions/pagedUnionSource/properties/pagination/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c"></a>

### `@pagedUnionSource.initial`

Schema位置：`#/definitions/pagedUnionSource/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["capturedAt","rows","totalCount","view"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f63617074757265644174"></a>

### `@pagedUnionSource.initial.capturedAt`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/capturedAt`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z&#124;[+-]\\d{2}:\\d{2})$" | Schema未设默认；装配/运行时默认见语义说明 | 内嵌行的有效RFC3339捕获时间。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f7773"></a>

### `@pagedUnionSource.initial.rows`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f77732f6974656d73"></a>

### `@pagedUnionSource.initial.rows[]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f77732f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedUnionSource.initial.rows[]{key}`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/rows/items/additionalProperties`。目标：[#/definitions/fieldValue](fields.md#schema-232f646566696e6974696f6e732f6669656c6456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f726f77732f6974656d732f70726f70657274794e616d6573"></a>

### `@pagedUnionSource.initial.rows[] · propertyNames`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/rows/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f63656c6c46616c6c6261636b73"></a>

### `@pagedUnionSource.initial.cellFallbacks`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/cellFallbacks`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 已归一化组合快照的原文证据；随行序保存与恢复。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f63656c6c46616c6c6261636b732f616c6c4f662f30"></a>

### `@pagedUnionSource.initial.cellFallbacks · allOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/cellFallbacks/allOf/0`。目标：[#/definitions/cellFallbacks](fields.md#schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/cellFallbacks | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f746f74616c436f756e74"></a>

### `@pagedUnionSource.initial.totalCount`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/totalCount`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 查询总条数；不能用当前页rows.length冒充。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f76696577"></a>

### `@pagedUnionSource.initial.view`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["pageIndex","pageSize","sort","predicates"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 采集时的规范化已提交视图；组合 initial 必须匹配默认第一页。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f70616765496e646578"></a>

### `@pagedUnionSource.initial.view.pageIndex`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/pageIndex`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 从零开始的页码。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7061676553697a65"></a>

### `@pagedUnionSource.initial.view.pageSize`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f7274"></a>

### `@pagedUnionSource.initial.view.sort`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/sort`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 优先级顺序排列的全局排序数组；空数组恢复组合默认排序。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f72742f6974656d73"></a>

### `@pagedUnionSource.initial.view.sort[]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/sort/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["field","direction"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f72742f6974656d732f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.initial.view.sort[].field`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/sort/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736f72742f6974656d732f70726f706572746965732f646972656374696f6e"></a>

### `@pagedUnionSource.initial.view.sort[].direction`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/sort/items/properties/direction`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["asc","desc"] | Schema未设默认；装配/运行时默认见语义说明 | 按原始值升序或降序，缺值始终排尾。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "asc" | 按原始可比较值升序，缺值仍排尾。 |
| "desc" | 按原始可比较值降序，缺值仍排尾。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f70726564696361746573"></a>

### `@pagedUnionSource.initial.view.predicates`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 最终字段上的 AND 条件；会话条件不写回定义；默认 initial 必须为空。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d73"></a>

### `@pagedUnionSource.initial.view.predicates[]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f30"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","values"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0].field`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f6f70"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0].op`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="in" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "in" | 原始值严格属于字面量集合；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c756573"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0].values`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 显式选择集合，保留字符串或数值类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0].values[]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c7565732f6974656d732f616e794f662f30"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0].values[] · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f302f70726f706572746965732f76616c7565732f6974656d732f616e794f662f31"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[0].values[] · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f31"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[1].field`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f312f70726f706572746965732f6f70"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[1].op`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/1/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["gte","lte"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gte" | 原始number/money值大于等于阈值，按原始单位。 |
| "lte" | 原始number/money值小于等于阈值，按原始单位。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[1].value`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f32"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[2]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[2].field`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f6f70"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[2].op`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dateRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dateRange" | 日期范围筛选控件。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f66726f6d"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[2].from`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f322f70726f706572746965732f746f"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[2].to`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f33"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[3]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f332f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[3].field`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/3/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f707265646963617465732f6974656d732f616e794f662f332f70726f706572746965732f6f70"></a>

### `@pagedUnionSource.initial.view.predicates[] · anyOf[3].op`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/3/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="isNull" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "isNull" | 只匹配合法null值；缺字段仍是契约错误。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f736561726368"></a>

### `@pagedUnionSource.initial.view.search`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/search`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["fields","query"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 已提交文本搜索；首版组合搜索使用有界完整关联，草稿不进入。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f6669656c6473"></a>

### `@pagedUnionSource.initial.view.search.fields`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/search/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@pagedUnionSource.initial.view.search.fields[]`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/search/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f7175657279"></a>

### `@pagedUnionSource.initial.view.search.query`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/search/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f696e697469616c2f70726f706572746965732f766965772f70726f706572746965732f7365617263682f70726f706572746965732f6d61746368"></a>

### `@pagedUnionSource.initial.view.search.match`

Schema位置：`#/definitions/pagedUnionSource/properties/initial/properties/view/properties/search/properties/match`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="equals" | Schema未设默认；装配/运行时默认见语义说明 | 按声明维度等值选择行。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "equals" | 用于选择@pagedUnionSource.initial.view.search.match分支；同分支其它约束同时成立。 |

## 语义规则与反例（生成）

- `query-initial-rows-normalize`：DQE 内嵌初始行按 queryField 归一化，数值度量容错，维度和结构严格校验。反例：[initial-row-missing-query-field](errors/initial-row-missing-query-field.json)、[initial-row-scalar-object](errors/initial-row-scalar-object.json)、[initial-row-scalar-array](errors/initial-row-scalar-array.json)、[initial-row-date-object](errors/initial-row-date-object.json)、[initial-row-semantic-html-too-large](errors/initial-row-semantic-html-too-large.json)、[initial-row-detail-missing-query-field](errors/initial-row-detail-missing-query-field.json)、[initial-row-detail-null-not-allowed](errors/initial-row-detail-null-not-allowed.json)、[initial-row-detail-type-mismatch](errors/initial-row-detail-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `inline-rows-contract`：inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）。反例：[inline-row-undeclared-field](errors/inline-row-undeclared-field.json)、[inline-row-missing-field](errors/inline-row-missing-field.json)、[inline-row-null-not-allowed](errors/inline-row-null-not-allowed.json)、[inline-row-type-mismatch](errors/inline-row-type-mismatch.json)、[inline-row-date-invalid](errors/inline-row-date-invalid.json)、[inline-row-datetime-invalid](errors/inline-row-datetime-invalid.json)、[inline-row-semantic-html-type](errors/inline-row-semantic-html-type.json)、[inline-row-detail-undeclared-field](errors/inline-row-detail-undeclared-field.json)、[inline-row-detail-missing-field](errors/inline-row-detail-missing-field.json)、[inline-row-detail-null-not-allowed](errors/inline-row-detail-null-not-allowed.json)、[inline-row-detail-type-mismatch](errors/inline-row-detail-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `captured-at-valid`：内嵌初始行的 capturedAt 须为有效的 RFC 3339 日期时间。反例：[captured-at-invalid-month](errors/captured-at-invalid-month.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-initial-rows`：查询分页的内嵌初始行必须声明 totalCount 且是完整第一页。反例：[pagination-initial-without-total-count](errors/pagination-initial-without-total-count.json)、[pagination-initial-not-full-page](errors/pagination-initial-not-full-page.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `paged-join`：6.22 组合表全局视图与普通查询定义引用。反例：[table-number-range-before-6.22](errors/table-number-range-before-6.22.json)、[paged-join-initial-predicate-null](errors/paged-join-initial-predicate-null.json)、[paged-join-initial-predicate-in](errors/paged-join-initial-predicate-in.json)、[paged-join-initial-predicate-numeric](errors/paged-join-initial-predicate-numeric.json)、[paged-join-initial-predicate-date](errors/paged-join-initial-predicate-date.json)、[paged-join-before-6.22](errors/paged-join-before-6.22.json)、[paged-join-unknown-member](errors/paged-join-unknown-member.json)、[paged-join-invalid-key](errors/paged-join-invalid-key.json)、[paged-join-invalid-projection](errors/paged-join-invalid-projection.json)、[paged-join-member-topn](errors/paged-join-member-topn.json)、[paged-join-shared-root](errors/paged-join-shared-root.json)、[paged-join-invalid-initial](errors/paged-join-invalid-initial.json)、[table-number-range-non-numeric](errors/table-number-range-non-numeric.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `paged-union`：多来源逐行合并、显式字段投影与全局视图。反例：[union-uuid-old](errors/union-uuid-old.json)、[union-uuid-conflict](errors/union-uuid-conflict.json)、[union-initial-predicate-null](errors/union-initial-predicate-null.json)、[union-initial-predicate-date](errors/union-initial-predicate-date.json)、[union-initial-predicate-numeric](errors/union-initial-predicate-numeric.json)、[union-initial-predicate-in](errors/union-initial-predicate-in.json)、[union-before-6.61](errors/union-before-6.61.json)、[union-missing-source](errors/union-missing-source.json)、[union-missing-mapping](errors/union-missing-mapping.json)、[union-incompatible-unit](errors/union-incompatible-unit.json)、[union-null-required](errors/union-null-required.json)、[union-source-window](errors/union-source-window.json)、[union-invalid-key](errors/union-invalid-key.json)、[union-source-navigation-field](errors/union-source-navigation-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `paged-union-composite-key`：6.72来源内有序非空组合行键，旧单字段声明保持。反例：[union-composite-before-version](errors/union-composite-before-version.json)、[union-composite-repeated-field](errors/union-composite-repeated-field.json)、[union-composite-nullable-field](errors/union-composite-nullable-field.json)、[union-composite-unknown-field](errors/union-composite-unknown-field.json)、[union-composite-measure-field](errors/union-composite-measure-field.json)、[union-composite-empty-fields](errors/union-composite-empty-fields.json)、[union-composite-scalar-conflict](errors/union-composite-scalar-conflict.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [query-dashboard](examples/query-dashboard.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-page](examples/paged-join-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-fixed-rank-page](examples/paged-join-fixed-rank-page.json)：完整合法页面；查询仅为静态契约证据。
- [query-numeric-tolerance](examples/query-numeric-tolerance.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-page](examples/paged-union-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-branches](examples/paged-union-branches.json)：完整合法页面；查询仅为静态契约证据。
- [record-join-page](examples/record-join-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-composite-key](examples/paged-union-composite-key.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-composite-branches](examples/paged-union-composite-branches.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-generated-key](examples/paged-union-generated-key.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-query-page](examples/paged-join-query-page.json)：完整合法页面；查询仅为静态契约证据。
- [record-join-query-page](examples/record-join-query-page.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）

- `#/definitions/dataSource/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/metrics`。
- `#/definitions/dataSource/anyOf/1`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers`。
- `#/definitions/queryDataSource/properties/fields/anyOf/0`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields`。
- `#/definitions/queryDataSource/properties/fields/anyOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
- `#/definitions/dataSource/anyOf/2`：[合法完整页面](examples/paged-join-page.json)，JSON Pointer `#/dataSources/office-overview`。
- `#/definitions/pagedJoinSource/properties/pagination/anyOf/0`：[合法完整页面](examples/paged-join-page.json)，JSON Pointer `#/dataSources/office-overview/source/pagination`。
- `#/definitions/pagedJoinSource/properties/pagination/anyOf/1`：[合法完整页面](examples/paged-join-query-page.json)，JSON Pointer `#/dataSources/projects/source/pagination`。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0`：[语义拒绝反例](errors/paged-join-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/0`：[语义拒绝反例](errors/paged-join-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/1`：[语义拒绝反例](errors/paged-join-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/1`：[语义拒绝反例](errors/paged-join-initial-predicate-numeric.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2`：[语义拒绝反例](errors/paged-join-initial-predicate-date.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/3`：[语义拒绝反例](errors/paged-join-initial-predicate-null.json)：显式为空属于已提交运行视图，持久化initial仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/dataSource/anyOf/3`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/0`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/localRowId`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`：[合法完整页面](examples/paged-union-branches.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/constantNumber/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`：[合法完整页面](examples/paged-union-branches.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/constantFlag/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/0/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/commercial/projection/missingNote/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1`：[合法完整页面](examples/paged-union-composite-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/0`：[合法完整页面](examples/paged-union-composite-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/localRowId`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1`：[合法完整页面](examples/paged-union-composite-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`：[合法完整页面](examples/paged-union-composite-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`：[合法完整页面](examples/paged-union-composite-branches.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/constantNumber/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`：[合法完整页面](examples/paged-union-composite-branches.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/constantFlag/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/1/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`：[合法完整页面](examples/paged-union-composite-key.json)，JSON Pointer `#/dataSources/opinions/source/members/commercial/projection/missingNote/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/0`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/localRowId`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/literalNumber/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/literalFlag/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/anyOf/2/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`：[合法完整页面](examples/paged-union-generated-key.json)，JSON Pointer `#/dataSources/opinions/source/members/commercial/projection/missingNote/value`。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0`：[语义拒绝反例](errors/union-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/0`：[语义拒绝反例](errors/union-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/1`：[语义拒绝反例](errors/union-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/1`：[语义拒绝反例](errors/union-initial-predicate-numeric.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2`：[语义拒绝反例](errors/union-initial-predicate-date.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/3`：[语义拒绝反例](errors/union-initial-predicate-null.json)：显式为空属于已提交运行视图，持久化initial仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。

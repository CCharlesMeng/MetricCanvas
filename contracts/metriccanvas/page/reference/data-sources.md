# 页面数据源与初始行

已有页面与指标说明可先形成组件/字段到指标候选、查询条件和缺口的对应表；同名不自动等同于同口径，物理表字段不自动等同于 DQE 指标/维度。缺时间、过滤编码、聚合或连接关系时保留未知；资料齐全再形成协议候选，真实执行并核对结果字段后才作为已验证查询写回页面。匹配报告不是页面字段。`local-authoring-knowledge-demo` 用内联合成数据展示金额、百分刻度和列宽；真实服务验真另行举证。

页面数据源使用inline静态行或query受控查询。源id来自dataSources对象键，组件data槽引用它。每个数据源声明结果字段契约；数据快照ready/empty/error是运行态，不回写文档。

query.initial保存捕获时间和匹配该查询的初始行，只能在当前条件与声明初值匹配时使用；变更后由网关查询。执行bootstrap初始结果另走执行端口，条件标识与查询定义一致才复用，不与旧initial混用。非查询分页数据源即使 initial.rows.length 小于 initial.totalCount，也直接呈现内嵌初始行，不为补齐数据自动查询；组件提示当前载入条数与总数，不将部分数据当成完整结果。空 initial.rows 同样是可复用快照；未知总数不推断完整性。查询分页的持久化initial仍需有效totalCount与完整第一页，动态结果的总数不一致不阻止显示已有行。跨数据源计算继续使用本轮返回行。

可选compute作用于已归一化行集。inline行使用页面字段id；query结果经queryField映射。静态JSON通过校验不证明真实DQE成功。

查询数值度量在进入快照和 compute 前归一化为有限数字或 `null`，单个异常值不再拒绝整份查询；首屏 initial、动态响应和一层嵌套明细使用同一规则，详见[结果字段契约](fields.md#查询数值度量的容错)。`nullable: false` 的数值度量缺失只告警，查询字段缺失、维度错误与结构错误仍会失败。`query-numeric-tolerance` 是对应完整合成验收示例。

## 查询异常与结果总数

查询失败在内部保留错误分类及 `data-error` 嵌入事件，页面 UI 组件按空数据呈现，不显示错误标题、错误码或错误消息。错误通过 `console.error` 打印页面、数据源、引用组件及具体原因；DQE 字段校验同时打印可用的行号、字段和预期类型。日志不包含原始数据行、字段值、凭据或上游响应正文。关联查询失败时 AI 总结也呈现空态。

普通查询的有效 `totalCount` 小于返回行数，或 `resultScope: complete` 声明的完整结果与总数不一致时，通过 `console.warn` 打印 `TOTAL_COUNT_MISMATCH`，保留返回行与原始总数，继续渲染、计算及查询结果绑定。查询分页当前窗口已返回行时，不因较小的总数自动跳页；不符合完整第一页规则的动态窗口不回填到持久化 initial。分页窗口少于业务总数本身是正常情况，不告警。总数格式非法、缺少分页必需总数、返回行数超过请求上限、字段映射或结构不合法仍为错误。完整导出与组合查询源的跨页完整性规则保持独立。

验收使用完整合成页面 `query-numeric-tolerance`：正常返回八行；测试在 DQE HTTP 边界分别注入缺字段、维度类型错误、总数小于或大于返回行数，核对空组件、全部返回行及控制台诊断。对应浏览器测试为 `result-diagnostics.spec.ts`；本地证据不代表真实 DQE 或部署验收。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 多查询组合源 pagedJoin（6.22）

`pagedJoin` 只引用页内已有普通查询源，复用查询定义，独立产出组合表的公开数据快照。成员必须无 compute、无 resultBindings、无业务 TopN/窗口，并声明 `resultScope: complete`。普通结果与内部选页、补列结果隔离；定义引用只传播参数/筛选失效，不改变固定级联顺序。

`domainMember` 定义业务行域；各成员按显式单个非空 string/number 维度键关联，`projection` 覆盖最终字段。类型、角色、单位和币种一致，可能缺匹配的列允许 null。查询失败整轮失败。序号由 `ordinalField` 生成，与稳定 `rowKey` 分开。

同源可兑现全部排序/筛选且 `canSelectPage` 已经真实验真时，先选页编码，再取各成员编码内的完整行；否则在最大 1000 行的完整行域上关联、筛选、稳定排序并分页。不能筛当前页冒充全局处理。排序末尾补业务键升序，缺值在升降序都排尾；可空原始排序字段未确认上游 null 编码时走完整路径。

每个组合源只由一张单槽查询分页表独占；多个组合源可共用普通成员定义。独立图表仍消费完整普通结果。`initial` 保存最终页面字段与默认第一页视图，不是 DQE 原始行；缺少组合 initial 时不会借成员 ordinary initial 拼页。完整导出冻结已提交视图，取得所有匹配行，最多 10000 行/60 秒；窗口截断、重复键和总数变化均失败，不提供部分结果。

`canSelectPage` 是能力声明，静态校验、仿真和样本不能证明真实行域覆盖、计数、排序或粒度。真实 DQE 接入需单列验收；未兑现能力应设为 false 使用有界完整路径。

验收场景 `multi-query-table` 使用 8 个代表处合成数据：预签金额降序第一页为上海、北京、广州，切换召开率降序后为上海、深圳、北京，独立图表仍使用全部 8 行。本节生成的 `paged-join-page` 完整示例展示成员引用与投影；可运行场景另含搜索、导出和独立完整表，分别验证结果隔离与全部匹配行。

### 当前序号与固定业务排名

`ordinalField` 只产出当前排序、筛选后的行序号，分页连续编号，不能声明某个指标的固定业务排名。固定业务排名由普通查询提供独立结果字段，例如预签金额查询同时返回 `bidding_amount` 和 `bidding_rank`；组合源通过 `projection` 按业务键关联该字段，不将其指定为 `ordinalField`。排名范围、指标方向和并列规则由上游查询负责，完整行域取数与页内补列须返回一致的名次；当前页内重新编号不能替代业务排名。

`paged-join-fixed-rank-page` 完整示例使用这一配置。运行场景的两张表独占不同组合源，共用普通查询定义：召开率降序第一页相同，但当前序号为 1、2、3，预签金额排名为 1、4、2。Sim 在完整月份行域按金额降序、编码升序生成名次，表格筛选与搜索保留它；这只是示范查询契约，不证明真实 DQE 已支持排名算子。

6.44查询子表格引用的专属query源从首屏取数中排除；展开后在父行独立作用域中执行。分页、搜索和排序仅改变该实例的生效查询，不改变页面数据源定义、主页面快照或全页筛选。详见[行内子表格](components/table.md#row-expansion)。

6.59 的表格置顶行复用独立普通 query 源，显式 complete 且不使用查询窗口；不改变 main 的明细行域或 pagedJoin 语义。数据网关结果、缓存及计算快照同步保留 cellFallbacks 展示证据，普通查询回填 initial 时恢复原始标量；字段仍按有效类型值参与计算和结果绑定。完整声明见[表格置顶行](components/table.md#table-pinned-top)。

<a id="paged-union"></a>

## 分页合并源 pagedUnion（6.61）

`pagedUnion` 引用两个或更多页内普通查询页面数据源，将各来源字段显式投影到同一份结果字段契约，逐行合并后整体排序、计数和查询分页。内容相同的记录照常保留，不聚合、不去重。Table 只绑定该合并源的 `data.main`，并由一张单槽查询分页表独占。

`source.rowKey` 和 `source.sourceField` 分别命名最终行键与来源标识；两者声明为非空 string 维度且不得重名。`members` 的键是稳定来源 ID。每个成员引用已有查询定义，声明非空 string/number 维度 `rowKey`；来源内唯一性由上游保证，运行时检查已读取范围，重复或缺失时报错。最终行键是来源 ID 与原始行键的结构化编码，来源标识无需展示。

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

`ordering.default` 使用最终页面字段，作用于两个来源的全部匹配记录；首屏表头同步显示，移除用户排序恢复默认。各源先应用映射后的同一排序并追加来源内行键升序，再由统一运行时按业务排序、来源 ID 升序、原始行键升序归并。null 升降序均排末尾。来源必须提供相同的比较语义（含字符串排序规则）、稳定有序流、准确匹配总数；运行时发现已读取序列不相容会失败，不能通过重排当前批次修复上游排序。

搜索与筛选先作用完整匹配范围，再计数与分页。同列多选为 OR，不同条件为 AND；多字段搜索为字段间 OR，并与筛选条件取 AND。常量命中搜索时该来源无需再按搜索过滤；常量不满足筛选或搜索时可排除整个来源。null 不命中普通值筛选或文本搜索。候选值合并各参与来源的完整匹配域并去重，仅移除当前候选列条件；不会去重数据记录。首期沿用既有候选值协议，不新增“仅缺失值”选项。任一来源不支持所需候选接口时明确返回不可用。每来源及跨源候选最多 10000 项，超限报错；包含搜索依赖集成应用已验证的 `encodeSearch`，默认 DQE 不自动获得该能力。

冷跳深页需要扫描全局前缀，使用最多 4 个视图检查点、每源 200 行缓冲；普通请求池最多缓存 256 个成功结果并淘汰旧项。一次浏览最多扫描 100000 行，读取最多 60 秒，超限明确失败。刷新、排序、筛选、页大小或权限上下文变化不会复用不相容进度。计数变化清除本轮进度并最多重试一次；页码越界按本轮总数纠正。任一参与来源失败，整轮失败，不展示半份结果。数据按实时 offset 浏览，多次请求不提供事务快照，同总数内容变化可能无法检测。

完整导出冻结已提交视图，按全局顺序取得全部匹配记录，重复记录保留；沿用 10000 行/60 秒限制，超限、截断、重复行键及来源失败均不给部分文件。`initial` 与 pagedJoin 使用相同的最终字段行与默认第一页视图结构，成员 initial 不能冒充合并输入全集。

可运行 `multi-source-table` 使用两个合成普通分页端点，覆盖异字段、来源常量、null、默认整体排序、搜索、候选筛选、分页、Excel 导出与来源详情导航。静态校验、模拟网关与浏览器不证明真实 DQE 已满足上述能力。


页面协议 6.61。结构真源为本册[schema.json](schema.json)，SHA256 `4c59f431d4af3e0561590734831d09c7d8886f5f612f4866d8ec2af8a447f130`。字段表自动生成；可选不等于有默认值。

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
| "object" | 类型/分支 | required=["type","rowKey","domainMember","members","projection","ordering","pagination","fallback","onMissing"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
| "object" | 本分支必填 | required=["pageSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 分页来源与大小配置；query与local条件不同。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f706167696e6174696f6e2f70726f706572746965732f7061676553697a65"></a>

### `@pagedJoinSource.pagination.pageSize`

Schema位置：`#/definitions/pagedJoinSource/properties/pagination/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f70616765644a6f696e536f757263652f70726f706572746965732f66616c6c6261636b"></a>

### `@pagedJoinSource.fallback`

Schema位置：`#/definitions/pagedJoinSource/properties/fallback`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["maxRows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 有界完整关联策略的限制。 |

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
| "object" | 动态键的值 | required=["source","rowKey","projection"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f736f75726365"></a>

### `@pagedUnionSource.members{key}.source`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f726f774b6579"></a>

### `@pagedUnionSource.members{key}.rowKey`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e"></a>

### `@pagedUnionSource.members{key}.projection`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 覆盖全部非身份输出列；每列显式映射字段、常量或 null。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f70657274696573"></a>

### `@pagedUnionSource.members{key}.projection{key}`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[0].field`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[1].value`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[1].value · anyOf[2]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f33"></a>

### `@pagedUnionSource.members{key}.projection{key} · anyOf[1].value · anyOf[3]`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676564556e696f6e536f757263652f70726f706572746965732f6d656d626572732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726f6a656374696f6e2f70726f70657274794e616d6573"></a>

### `@pagedUnionSource.members{key}.projection · propertyNames`

Schema位置：`#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
- `paged-join`：6.22 组合表全局视图与普通查询定义引用。反例：[table-number-range-before-6.22](errors/table-number-range-before-6.22.json)、[paged-join-initial-predicate-in](errors/paged-join-initial-predicate-in.json)、[paged-join-initial-predicate-numeric](errors/paged-join-initial-predicate-numeric.json)、[paged-join-initial-predicate-date](errors/paged-join-initial-predicate-date.json)、[paged-join-before-6.22](errors/paged-join-before-6.22.json)、[paged-join-unknown-member](errors/paged-join-unknown-member.json)、[paged-join-invalid-key](errors/paged-join-invalid-key.json)、[paged-join-invalid-projection](errors/paged-join-invalid-projection.json)、[paged-join-member-topn](errors/paged-join-member-topn.json)、[paged-join-shared-root](errors/paged-join-shared-root.json)、[paged-join-invalid-initial](errors/paged-join-invalid-initial.json)、[table-number-range-non-numeric](errors/table-number-range-non-numeric.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `paged-union`：多来源逐行合并、显式字段投影与全局视图。反例：[union-initial-predicate-date](errors/union-initial-predicate-date.json)、[union-initial-predicate-numeric](errors/union-initial-predicate-numeric.json)、[union-initial-predicate-in](errors/union-initial-predicate-in.json)、[union-before-6.61](errors/union-before-6.61.json)、[union-missing-source](errors/union-missing-source.json)、[union-missing-mapping](errors/union-missing-mapping.json)、[union-incompatible-unit](errors/union-incompatible-unit.json)、[union-null-required](errors/union-null-required.json)、[union-source-window](errors/union-source-window.json)、[union-invalid-key](errors/union-invalid-key.json)、[union-source-navigation-field](errors/union-source-navigation-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [query-dashboard](examples/query-dashboard.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-page](examples/paged-join-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-fixed-rank-page](examples/paged-join-fixed-rank-page.json)：完整合法页面；查询仅为静态契约证据。
- [query-numeric-tolerance](examples/query-numeric-tolerance.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-page](examples/paged-union-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-branches](examples/paged-union-branches.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/data-source.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/paged-union.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/validate-paged-union.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/dataSource/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/metrics`。
- `#/definitions/dataSource/anyOf/1`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers`。
- `#/definitions/queryDataSource/properties/fields/anyOf/0`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields`。
- `#/definitions/queryDataSource/properties/fields/anyOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
- `#/definitions/dataSource/anyOf/2`：[合法完整页面](examples/paged-join-page.json)，JSON Pointer `#/dataSources/office-overview`。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0`：[语义拒绝反例](errors/paged-join-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/0`：[语义拒绝反例](errors/paged-join-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/1`：[语义拒绝反例](errors/paged-join-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/1`：[语义拒绝反例](errors/paged-join-initial-predicate-numeric.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/pagedJoinSource/properties/initial/properties/view/properties/predicates/items/anyOf/2`：[语义拒绝反例](errors/paged-join-initial-predicate-date.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-join`）。此项不计入合法示例覆盖。
- `#/definitions/dataSource/anyOf/3`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/0`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/localRowId`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/0`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/businessType/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/1`：[合法完整页面](examples/paged-union-branches.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/constantNumber/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/2`：[合法完整页面](examples/paged-union-branches.json)，JSON Pointer `#/dataSources/opinions/source/members/contract/projection/constantFlag/value`。
- `#/definitions/pagedUnionSource/properties/members/additionalProperties/properties/projection/additionalProperties/anyOf/1/properties/value/anyOf/3`：[合法完整页面](examples/paged-union-page.json)，JSON Pointer `#/dataSources/opinions/source/members/commercial/projection/missingNote/value`。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0`：[语义拒绝反例](errors/union-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/0`：[语义拒绝反例](errors/union-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/0/properties/values/items/anyOf/1`：[语义拒绝反例](errors/union-initial-predicate-in.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/1`：[语义拒绝反例](errors/union-initial-predicate-numeric.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。
- `#/definitions/pagedUnionSource/properties/initial/properties/view/properties/predicates/items/anyOf/2`：[语义拒绝反例](errors/union-initial-predicate-date.json)：视图类型复用已提交条件，但文档 initial 仅允许默认无条件视图。（规则 `paged-union`）。此项不计入合法示例覆盖。

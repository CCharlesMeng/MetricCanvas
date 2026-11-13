# 交互与导航

受控action支持写筛选与导航。writeFilter目标须存在且类型匹配；表格selection只把受控字段/固定值映射到允许目标。URL导航使用目标页面公开参数名，保留标准anchor能力，宿主可选择接管。

表格列selection与link同时存在时selection优先。行导航只在声明的入口列触发。当前页字段、目标页面参数和筛选器id不能靠同名猜映射。文本链接与普通URL不开放脚本执行。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 当前内容工具边界

#137只开放add/update/remove_dimension_filter、set/remove_table_link五项原子操作。筛选声明和完整绑定集合一起修改；仅现有DQE dimension queryField，不改原查询body/order/initial，也不借此创建params、initialParam、paramBindings或层级筛选。悬空级联、参数或导航引用阻止删除。

表格链接可定位Tab子树/分组列；必须显式给出安全href及非空row/param/filter映射。selection抢占、多navigate歧义或共享目标不一致会拒绝；删除最后链接时清导航并保留其它动作。它不是通用actions或表头筛选编辑器。

`t11-evidence.md`记录两形态真实Chrome→createDqeGateway→本地HTTP，选择/清空raw_region、未绑定表格保留，以及真实anchor跳转携row/param/filter/fixed/hash。实际外部DQE、权限及目标业务页仍待独立联调。源码定位：`metriccanvas-authoring/tool/metriccanvas_authoring/pages/editing/interaction_editing.py`、`page_editing.py`，公开回归`test_content_interactions.py`。

<a id="链接传参与目标页签"></a>

## 链接传参与目标页签

现有 URL 导航允许在 `href` 中配置固定查询参数，并用 `query` 显式绑定动态来源。文本组件的 `props.links[]`、表格列的 `navigate` 和组件动作中的 `navigate` 使用同一目标结构；行字段来源只在有当前行的入口适用。

```json
{
  "label": "查看销售明细",
  "href": "/pages/tab-url-initialization?sales-tab=detail#tabs"
}
```

上例为文本组件的一项链接；目标容器配置 `initialTabUrlParam: "sales-tab"`，且声明 `id: "detail"` 的 Tab。该初值接收能力自 6.33 起支持，来源侧链接传参为既有能力。

动态链接的 `query` 键是**目标页面公开的 URL 参数名**，绑定内容指向**当前来源页**的页面参数、筛选器或行字段。以下为一项文本链接（来源页须声明 `preferred-tab` 参数）：

```json
{
  "label": "按参数打开页签",
  "href": "/pages/tab-url-initialization",
  "query": { "sales-tab": { "source": "param", "id": "preferred-tab" } }
}
```

| 取值来源 | `query` 单项配置示例 | 适用条件 |
|---|---|---|
| 固定值 | 写入 `href`，例如 `?sales-tab=detail` | 固定入口；`query` 不提供 literal 分支 |
| 页面参数 | `{"source":"param","id":"preferred-tab"}` | 来源页已声明该参数 |
| 筛选状态 | `{"source":"filter","id":"tab-choice"}` | 来源页已声明筛选器；范围使用 `part: "from" / "to"`，层级可用 `part: "level"` |
| 当前行字段 | `{"source":"row","field":"tab-id"}` | 表格链接等有当前行数据的入口；字段须为可传参的标量 |

运行时只携带显式配置的值，保留 `href` 中其他静态参数和 `#` 锚点。有有效动态值时覆盖同名静态参数，并按普通 URL 编码；数组写成重复键，缺值时保留原静态值。Tab 初值仅接受单个合法 id，因此多选筛选器输出多个同名值时会回退默认页签。

参数位于 URL 的标准查询部分；`/#/detail?sales-tab=detail` 的 hash 内参数不会被引擎自动解析。集成应用负责将目标 URL 的查询部分作为 `initialSearch` 传给渲染引擎，并保持普通 anchor 的打开新标签页等能力。

目标页签的优先级、异常回退、命名互斥和初始化边界由 [Tab 容器](components/tabContainer.md#url-初始化页签633)维护。完整可运行的双页配置见 `tab-url-source` 与 `tab-url-initialization`，完整示例由本模块索引分发；目标部署路径由集成应用提供，不由本仓页面 id 推断。

6.39：modes范围的导航筛选引用支持part:"mode"；显式映射目标mode/from/to三个查询键，目标页按整组校验。不把模式放入普通月份或timePoint参数，不依赖同名猜测。完整示例见time-modes-page。

## 6.40 显式跨页传值

`navigate`及文本链接可声明`validateTargetInputs:true`，由集成应用的`RuntimeNavigation.resolveTargetInputs(href,{signal})`提供目标当前页级公开声明投影。`projectNavigationInputs(document)`验证并提取pageId/params/filters，不含业务结果、凭据或授权候选，排除详情私有筛选。投影未就绪/失败/缺能力时链接没有可导航href，操作返回navigation-error及原因；销毁或换页忽略旧投影。集成应用保证目标身份与实际路由对应。未声明该意图的普通URL保持兼容。

仅映射query声明的row/param/filter，保留0/false，多值重复编码；不按同名继承。受控链接缺值清除href同名静态旧值后再验必需输入。显式映射的必需值缺失时，即使目标有默认值也拒绝，避免进入另一实体。未知目标键、单值重复、类型/层级/枚举不符、半范围及不完整mode/from/to拒绝；季度或多月不能取起点变成详情单月。目标授权候选由目标实例加载确认，相关查询保持门禁。

6.40声明`strictURLInputs:true`的目标页面显式非法筛选URL给错误，不回退默认查询；非法数字/布尔/重复单值页面参数不回退default，相关数据区域呈现空态，页面结构保留，见[缺参呈现](params-and-text-values.md#url-缺参的页面呈现)。`RuntimeNavigation.resolveHref`可映射集成应用部署路径，真实href和点击共用映射。仅传值，无分页/排序/Tab/滚动/行展开/来源视图恢复。

实际示例：navigation-source-page、navigation-list-page、navigation-detail-page。Playground来源`/pages/ioc-header-navigation-source-demo`；清单直达需`?origin=直接入口`，详情需`?project-id=P001&project-name=示例项目&origin=直接入口&month=2026-09&currency=RMB&regions=north`。清单切季度或点缺编码行拒绝；概览缺目标能力链接提示不可用。B6挂起。

`strictURLInputs:true`由页面显式开启，兼容规范化升版本不自动开启。来源和目标可分别选择该策略；本批三个验收页均开启。受控编辑使用`set_url_input_validation`，enabled=false仅删除该标记。

目标输入投影排除不可由URL覆盖的旧数组固定参数；该旧模式整体不接收筛选URL，因此其筛选也不作为可传入接口。strictURLInputs与旧数组固定参数互斥，应显式使用分组参数；不自动迁移业务页。
6.35新增的就地条件与层级状态语义见[条件显隐与动作资格](conditions.md)，旧页面原有行为保持。

## IOC Region 默认 URL 输入

目标页使用 IOC Header 并认领 Region 时，默认接受 `region-dept` 与 `rep-office` 参数，无需页面 URL 映射。来源导航可显式把行字段、参数或筛选 value 映射到 `query.rep-office` 或 `query.region-dept`，键名决定目标层级，不再映射 level。目标输入投影从实际 Header 推导组织输入能力，同组按 URL 顺序取最后值；筛选来源的层级必须与目标键一致。候选权限仍由目标页验证，旧 value/level 链接继续兼容。完整合成目标为 `/pages/ioc-region-url-demo`；声明和边界见[筛选声明](filters.md#region-level-url)。

<a id="url-参数清理与地址同步"></a>

## URL 参数清理与地址同步

页面声明、页面参数和筛选初始化通过后，统一运行时清理本次输入查询串中的未知键：保留页面参数 id、筛选器实际 URL 键（含别名、范围分量和 IOC Region 标准键）、Tab 的 `initialTabUrlParam` 与 `tab.<组件id>`，以及集成应用在 `RuntimeNavigation.preserveSearchParams` 指定的宿主键。不按参数内容猜类型，不改写保留值、重复值及相对顺序，不把默认值补入地址。已声明的非法值仍按原初始化规则诊断；阻止初始化时不清理地址。此行为不增加页面字段或 Schema 能力下限。

仅实际删除未知键时，初始化调用一次 `RuntimeNavigation.replaceSearch(search)`，传入不带 `?` 的完整保留查询串；该清理不发送 `filter-change` / `tab-change`，不触发重查。后续筛选、Tab 和来源页回跳上下文沿用清理规则，已删除参数不会重新带回。表头的 `initialParam` 仍是本次会话的初值，不因地址替换重新读取。

`RuntimeView` 不直接操作浏览器地址，由集成应用提供可选的 `replaceSearch`；Embed 自动补齐缺省实现，宿主自定义回调优先。默认实现在当前 window 用 `history.replaceState(history.state, '', url)` 替换当前历史记录；保持路径、普通锚点及历史状态，不刷新页面、不新增记录、不模拟 `popstate` / `hashchange`，不访问父窗口。识别 `#/...` / `#!/...` 时同时清理外层与 hash 查询；保留键原有位置，同名键以 hash 为准且删除外层旧副本，新筛选或 Tab 键写入 hash 路由查询。回写异常只报告诊断，不中断页面查询。

宿主控制参数通过接入配置认领，例如 `navigation:{preserveSearchParams:['resource','tenant']}`，不进入页面 JSON。自定义回调可以额外补回自己维护的参数。显式 `initialSearch` 仍决定本次输入；空串没有可清理的初始化键，因此不会因初始化改写地址。之后的筛选或 Tab 操作仍经地址适配器同步；需要完全自行管理地址时提供自己的回调。

Angular 等路由框架应覆盖 `replaceSearch`，经自身 Router 更新 query 并替换当前记录；仅改浏览器 history 不能保证 Router 的内部状态同步。集成应用的 Angular 适配器使用 `Router.parseUrl` / `navigateByUrl(...,{replaceUrl:true})` 并保留重复键、路径和 fragment。路由订阅只在页面身份变化时调用 mount/update；清理或页内筛选导致的 query 变化不回灌完整 update。Router 的导航事件、守卫、取消与实际 Operation Map 生命周期由宿主验证，核心引擎不依赖 Angular。

完整合成页面 `/pages/url-input-cleanup?account=合成账号&active=true&view=detail&unused=删除` 展示账号、筛选及页签初始化，地址应移除 `unused`；`active=invalid` 展示输入错误并保留原地址。此页面只有合成内联数据；真实宿主路由与服务接入另验。

## 详情标题的当前行取值

6.106 起，列动作和组件动作的 `openDetail.title` 可声明固定标题或 `{parts:[固定文字,{field:当前行字段,format:可选格式},…]}`。快照与查询详情共用同一取值规则；旧 `titleField` 继续读取，与 `title` 互斥。完整声明、空值与版本边界见[详情组合标题](components/table.md#detail-composed-title)，合成场景 `/pages/partner-health-interactions` 包含组合标题的表格入口与固定标题的图表入口。


页面协议 6.119。结构真源为本册[schema.json](schema.json)，SHA256 `2f51e336d88b44d7b755c701af9563b5c3f7e1d0acfbb1fd3d81efed3ae89b60`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f616374696f6e73"></a>

### `@actions`

Schema位置：`#/definitions/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 类型/分支 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616374696f6e732f6974656d73"></a>

### `@actions[]`

Schema位置：`#/definitions/actions/items`。目标：[#/definitions/componentAction](actions-and-navigation.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentAction | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e"></a>

### `@componentAction`

Schema位置：`#/definitions/componentAction`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f30"></a>

### `@componentAction · anyOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f30"></a>

### `@componentAction · anyOf[0] · anyOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["on","writeFilter","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f6f6e"></a>

### `@componentAction · anyOf[0] · anyOf[0].on`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/on`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="click" | Schema未设默认；装配/运行时默认见语义说明 | 触发动作的受控事件。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "click" | 用于选择@componentAction · anyOf[0] · anyOf[0].on分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[0] · anyOf[0].visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[0] · anyOf[0].visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[0] · anyOf[0].enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[0] · anyOf[0].enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f777269746546696c746572"></a>

### `@componentAction · anyOf[0] · anyOf[0].writeFilter`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/writeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 写入已声明dimension筛选器。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@componentAction · anyOf[0] · anyOf[0].field`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/field`。目标：[#/definitions/fieldReference](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f302f70726f706572746965732f6c6576656c"></a>

### `@componentAction · anyOf[0] · anyOf[0].level`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/0/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f31"></a>

### `@componentAction · anyOf[0] · anyOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["on","writeFilter","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f6f6e"></a>

### `@componentAction · anyOf[0] · anyOf[1].on`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/on`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="click" | Schema未设默认；装配/运行时默认见语义说明 | 触发动作的受控事件。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "click" | 用于选择@componentAction · anyOf[0] · anyOf[1].on分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[0] · anyOf[1].visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[0] · anyOf[1].visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[0] · anyOf[1].enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[0] · anyOf[1].enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f777269746546696c746572"></a>

### `@componentAction · anyOf[0] · anyOf[1].writeFilter`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/writeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 写入已声明dimension筛选器。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@componentAction · anyOf[0] · anyOf[1].value`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f616e794f662f312f70726f706572746965732f6c6576656c"></a>

### `@componentAction · anyOf[0] · anyOf[1].level`

Schema位置：`#/definitions/componentAction/anyOf/0/anyOf/1/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f31"></a>

### `@componentAction · anyOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["on","navigate"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6f6e"></a>

### `@componentAction · anyOf[1].on`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/on`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="click" | Schema未设默认；装配/运行时默认见语义说明 | 触发动作的受控事件。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "click" | 用于选择@componentAction · anyOf[1].on分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[1].visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[1].visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[1].enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[1].enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e61766967617465"></a>

### `@componentAction · anyOf[1].navigate`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["href"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控URL与参数来源映射。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[1].navigate.visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[1].navigate.visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[1].navigate.enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[1].navigate.enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f68726566"></a>

### `@componentAction · anyOf[1].navigate.href`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/href`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 目标URL，必须通过安全协议及结构检查。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f76616c6964617465546172676574496e70757473"></a>

### `@componentAction · anyOf[1].navigate.validateTargetInputs`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/validateTargetInputs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 显式要求集成应用提供目标输入投影后才允许跨页导航；仅传URL输入，不恢复视图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择@componentAction · anyOf[1].navigate.validateTargetInputs分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f7175657279"></a>

### `@componentAction · anyOf[1].navigate.query`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f70657274696573"></a>

### `@componentAction · anyOf[1].navigate.query{key}`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[0].source`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@componentAction · anyOf[1].navigate.query{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[0].field`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[1].source`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@componentAction · anyOf[1].navigate.query{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[1].id`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2].source`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@componentAction · anyOf[1].navigate.query{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2].id`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2].part`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f70726f70657274794e616d6573"></a>

### `@componentAction · anyOf[1].navigate.query · propertyNames`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f32"></a>

### `@componentAction · anyOf[2]`

Schema位置：`#/definitions/componentAction/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["on","openDetail"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f6e"></a>

### `@componentAction · anyOf[2].on`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/on`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="click" | Schema未设默认；装配/运行时默认见语义说明 | 触发动作的受控事件。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "click" | 用于选择@componentAction · anyOf[2].on分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[2].visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[2].enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c"></a>

### `@componentAction · anyOf[2].openDetail`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 点击在页内打开详情浮层，读被点那一行，不离开当前页。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["surface","fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f73757266616365"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].surface`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/surface`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["modal","drawer"] | Schema未设默认；装配/运行时默认见语义说明 | 浮层形态：modal居中、drawer右侧贴边；尺寸与层级由渲染引擎决定。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "modal" | 居中模态浮层。 |
| "drawer" | 右侧贴边抽屉。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f7469746c65"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].title`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].title · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/title/allOf/0`。目标：[#/definitions/detailTitle](actions-and-navigation.md#schema-232f646566696e6974696f6e732f64657461696c5469746c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/detailTitle | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c65"></a>

### `@detailTitle`

Schema位置：`#/definitions/detailTitle`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按顺序拼接固定文字与当前行字段，不执行表达式 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f30"></a>

### `@detailTitle · anyOf[0]`

Schema位置：`#/definitions/detailTitle/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f31"></a>

### `@detailTitle · anyOf[1]`

Schema位置：`#/definitions/detailTitle/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["parts"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f312f70726f706572746965732f7061727473"></a>

### `@detailTitle · anyOf[1].parts`

Schema位置：`#/definitions/detailTitle/anyOf/1/properties/parts`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64 | Schema未设默认；装配/运行时默认见语义说明 | 按声明顺序连接的1—64个固定文字或当前行字段片段，不自动添加分隔符 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f312f70726f706572746965732f70617274732f6974656d73"></a>

### `@detailTitle · anyOf[1].parts[]`

Schema位置：`#/definitions/detailTitle/anyOf/1/properties/parts/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f312f70726f706572746965732f70617274732f6974656d732f616e794f662f30"></a>

### `@detailTitle · anyOf[1].parts[] · anyOf[0]`

Schema位置：`#/definitions/detailTitle/anyOf/1/properties/parts/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f312f70726f706572746965732f70617274732f6974656d732f616e794f662f31"></a>

### `@detailTitle · anyOf[1].parts[] · anyOf[1]`

Schema位置：`#/definitions/detailTitle/anyOf/1/properties/parts/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f312f70726f706572746965732f70617274732f6974656d732f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@detailTitle · anyOf[1].parts[] · anyOf[1].field`

Schema位置：`#/definitions/detailTitle/anyOf/1/properties/parts/items/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5469746c652f616e794f662f312f70726f706572746965732f70617274732f6974656d732f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@detailTitle · anyOf[1].parts[] · anyOf[1].format`

Schema位置：`#/definitions/detailTitle/anyOf/1/properties/parts/items/anyOf/1/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-0","number-1","number-signed","number-1-signed","number-2-signed","number-3-signed","number-4-signed","number-5-signed","number-grouped-signed","number-2","number-3","number-4","number-5","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","cny-adaptive-trimmed","cny-adaptive-trimmed-no-yuan","usd-adaptive-km","count-adaptive","resource-adaptive","bytes-adaptive","minutes-adaptive","messages-adaptive","billing-hours","percent-adaptive","percent-adaptive-signed","percent-0","percent-1","percent-2","percent-raw","points-1-signed","yoy-p-signed","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-0" | 6.113新增：四舍五入为无千分位整数，半值远离零，舍入零为0，不缩放，不改变原值。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-3-signed" | 最多保留3位小数并去尾零，正数加+、舍入零无符号，颜色及箭头按展示方向；6.107新增。 |
| "number-4-signed" | 最多保留4位小数并去尾零，正数加+、舍入零无符号，颜色及箭头按展示方向；6.107新增。 |
| "number-5-signed" | 最多保留5位小数并去尾零，正数加+、舍入零无符号，颜色及箭头按展示方向；6.107新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-3" | 最多保留3位小数并去尾零，无千分位；6.107新增。 |
| "number-4" | 最多保留4位小数并去尾零，无千分位；6.107新增。 |
| "number-5" | 最多保留5位小数并去尾零，无千分位；6.107新增。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元按原始绝对值切换美元/K/M，小额取整，1万至100万按K最多1位小数，100万至1亿按K取整，1亿起按M取整。 |
| "cny-adaptive-trimmed" | 6.88：人民币元/万/亿去尾零；原始绝对值选档、对称舍入，小额带元。 |
| "cny-adaptive-trimmed-no-yuan" | 6.88：人民币去尾零，小额不带元，其余与 cny-adaptive-trimmed 一致。 |
| "usd-adaptive-km" | 6.88：美元按原始绝对值分 $/K/M，去尾零、千分位及对称舍入。 |
| "count-adaptive" | 人数等计数按万缩放：小于1万取整，1万至10万最多1位小数，10万起取整；保留声明单位。 |
| "resource-adaptive" | 资源量按原单位、万、亿选档，缩放后最多2位小数；同为TB时可显式区别于存储容量。 |
| "bytes-adaptive" | 从声明的Bytes/KB至YB或bit单位按1024换算，保留bit/byte及每秒维度；最多2位小数。 |
| "minutes-adaptive" | 分钟按分钟、千分钟、万分钟选档，缩放后最多2位小数。 |
| "messages-adaptive" | 条数小于1万取整，1万起按万条显示且最多2位小数。 |
| "billing-hours" | 原始秒数除以3600显示小时，四舍五入至最多2位小数，不改写原值。 |
| "percent-adaptive" | 百分数刻度按量级选精度，保留微小非零值，绝对值500起显示上升或下降>500%。 |
| "percent-adaptive-signed" | 自适应百分比的普通正值带+、负值带-、零无符号；绝对值500起显示方向与>500%。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-raw" | 个性化百分比保留原值精度并附加百分号，不乘100、不按量级舍入；用于SLO/SLA与微小比率。 |
| "points-1-signed" | 百分点值保留一位小数和符号，追加P，不乘100。 |
| "yoy-p-signed" | 同比原值先四舍五入保留两位小数，再乘100显示整数并追加大写P；正数带+，舍入零中性；6.87新增。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 时间窗口：基准所在完整周期；offset按指定unit移动周期。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f7469746c654669656c64"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].titleField`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/titleField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 详情浮层标题取被点行的该字段；省略时用组件标题。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f7469746c654669656c642f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].titleField · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/titleField/allOf/0`。目标：[#/definitions/fieldReference](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c6473"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].fields`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].fields[]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c64732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].fields[].label`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/fields/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c64732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[0].fields[].field`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0/properties/fields/items/properties/field`。目标：[#/definitions/fieldReference](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f31"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["surface","view"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f73757266616365"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].surface`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/surface`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["modal","drawer"] | Schema未设默认；装配/运行时默认见语义说明 | 浮层形态：modal居中、drawer右侧贴边；尺寸与层级由渲染引擎决定。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "modal" | 居中模态浮层。 |
| "drawer" | 右侧贴边抽屉。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f76697369626c655768656e"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].visibleWhen`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].visibleWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f656e61626c65645768656e"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].enabledWhen`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].enabledWhen · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f7469746c65"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].title`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].title · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/title/allOf/0`。目标：[#/definitions/detailTitle](actions-and-navigation.md#schema-232f646566696e6974696f6e732f64657461696c5469746c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/detailTitle | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f7469746c654669656c64"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].titleField`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/titleField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 详情浮层标题取被点行的该字段；省略时用组件标题。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f7469746c654669656c642f616c6c4f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].titleField · allOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/titleField/allOf/0`。目标：[#/definitions/fieldReference](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f76696577"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].view`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/view`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 引用已经声明的详情视图 id。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e6773"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 显式映射详情参数来源，支持行、页面参数或筛选器。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key}`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[0].source`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[0].field`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[1].source`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[1].id`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[2]`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[2].source`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[2].id`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings{key} · oneOf[2].part`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f322f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f70726f70657274794e616d6573"></a>

### `@componentAction · anyOf[2].openDetail · anyOf[1].bindings · propertyNames`

Schema位置：`#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `url-navigation-source-contract`：URL 与来源绑定可校验，目标存在性与必填项由目标负责。反例：[ioc-title-row-source](errors/ioc-title-row-source.json)、[ioc-title-root-row-source](errors/ioc-title-root-row-source.json)、[ioc-title-unsafe-url](errors/ioc-title-unsafe-url.json)、[ioc-title-missing-title](errors/ioc-title-missing-title.json)、[navigation-invalid-authority](errors/navigation-invalid-authority.json)、[navigation-invalid-port](errors/navigation-invalid-port.json)、[navigation-scheme-without-authority](errors/navigation-scheme-without-authority.json)、[navigation-unsafe-url](errors/navigation-unsafe-url.json)、[navigation-missing-row-field](errors/navigation-missing-row-field.json)、[navigation-unknown-param](errors/navigation-unknown-param.json)、[navigation-wrong-filter-part](errors/navigation-wrong-filter-part.json)、[navigation-text-row-source](errors/navigation-text-row-source.json)、[navigation-text-unsafe-url](errors/navigation-text-unsafe-url.json)、[navigation-url-input-collision](errors/navigation-url-input-collision.json)、[navigation-url-input-wrong-part](errors/navigation-url-input-wrong-part.json)、[navigation-clicked-slot-missing-field](errors/navigation-clicked-slot-missing-field.json)、[navigation-legacy-target-rejected](errors/navigation-legacy-target-rejected.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `metric-row-link-needs-navigate`：指标行声明 link 时组件必须至少有一个 navigate 动作。反例：[metric-row-link-without-navigate](errors/metric-row-link-without-navigate.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `actions-live-only`：旧版本writeFilter只允许query组件；6.35的本地入口必须有查询或显隐消费方。反例：[write-filter-on-inline-component](errors/write-filter-on-inline-component.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `write-filter-target`：回写目标是已声明的 dimension 筛选器。反例：[write-filter-undeclared](errors/write-filter-undeclared.json)、[write-filter-non-dimension](errors/write-filter-non-dimension.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `navigation-filter-source`：导航绑定只能引用已声明的筛选器。反例：[navigation-filter-undeclared](errors/navigation-filter-undeclared.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [partner-health-interactions](examples/partner-health-interactions.json)：完整合法页面；查询仅为静态契约证据。
- [url-navigation-page](examples/url-navigation-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-export-detail-bindings](examples/reference-export-detail-bindings.json)：完整合法页面；查询仅为静态契约证据。
- [tab-url-source](examples/tab-url-source.json)：完整合法页面；查询仅为静态契约证据。
- [time-modes-page](examples/time-modes-page.json)：完整合法页面；查询仅为静态契约证据。
- [navigation-source-page](examples/navigation-source-page.json)：完整合法页面；查询仅为静态契约证据。
- [navigation-list-page](examples/navigation-list-page.json)：完整合法页面；查询仅为静态契约证据。
- [navigation-detail-page](examples/navigation-detail-page.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-region-url-demo](examples/ioc-region-url-demo.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/actions.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/navigation.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime/src/navigate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/navigate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime/src/navigation-inputs.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/filter-url.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime-ui/src/url-search.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/src/browser-navigation.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/componentAction/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/actions/0`。
- `#/definitions/componentAction/anyOf/0/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/actions/0`。
- `#/definitions/componentAction/anyOf/0/anyOf/1`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sections/0/components/0/props/action`。
- `#/definitions/componentAction/anyOf/1`：[合法完整页面](examples/component-button.json)，JSON Pointer `#/sections/0/components/0/props/action`。
- `#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/sections/0/components/0/props/actions/0/navigate/query/page-title`。
- `#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1`：[合法完整页面](examples/url-navigation-page.json)，JSON Pointer `#/sections/0/components/0/props/actions/0/navigate/query/project`。
- `#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/sections/0/components/0/props/actions/1/navigate/query/region`。
- `#/definitions/componentAction/anyOf/2`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/sections/1/components/0/props/actions/0`。
- `#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/0`：[合法完整页面](examples/partner-health-interactions.json)，JSON Pointer `#/sections/0/components/0/props/actions/0/openDetail`。
- `#/definitions/detailTitle/anyOf/0`：[合法完整页面](examples/partner-health-interactions.json)，JSON Pointer `#/sections/0/components/0/props/actions/0/openDetail/title`。
- `#/definitions/detailTitle/anyOf/1`：[合法完整页面](examples/partner-health-interactions.json)，JSON Pointer `#/sections/0/components/1/props/columns/2/openDetail/title`。
- `#/definitions/detailTitle/anyOf/1/properties/parts/items/anyOf/0`：[合法完整页面](examples/partner-health-interactions.json)，JSON Pointer `#/sections/0/components/1/props/columns/2/openDetail/title/parts/1`。
- `#/definitions/detailTitle/anyOf/1/properties/parts/items/anyOf/1`：[合法完整页面](examples/partner-health-interactions.json)，JSON Pointer `#/sections/0/components/1/props/columns/2/openDetail/title/parts/0`。
- `#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/sections/1/components/0/props/actions/0/openDetail`。
- `#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/sections/1/components/0/props/actions/0/openDetail/bindings/detail-customer`。
- `#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1`：[合法完整页面](examples/reference-export-detail-bindings.json)，JSON Pointer `#/sections/2/components/0/props/actions/0/openDetail/bindings/detail-customer`。
- `#/definitions/componentAction/anyOf/2/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2`：[合法完整页面](examples/reference-export-detail-bindings.json)，JSON Pointer `#/sections/3/components/0/props/actions/0/openDetail/bindings/detail-customer`。

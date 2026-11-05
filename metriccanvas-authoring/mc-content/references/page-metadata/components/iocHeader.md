# IOC 页头

普通组件外壳，属性复用旧 IOC Header。仅允许首 section 首位，span固定12，最多一个；跟随section条件和分组，不绑定数据源。身份、筛选认领、返回、只读、吸顶、导出及读取迁移语义由[页面模块](../page.md#ioc-页头进入分区681)统一维护。

完整合成场景：`ioc-header-section-placement`（混排与显隐）、`ioc-header-section-groups`（分组）、`ioc-header-section-sticky`（吸顶）。均可在Playground按页面id访问。

重点国代标准 boolean 筛选 `key-office` / `key-national-only` 勾选后默认覆盖 Region，页头和筛选声明无需添加 `overridesFilters`。Region 保留完整候选和最新选择；取消勾选后恢复 Region，时间、客户级别及权限继续生效。默认覆盖不提供名单，集成应用仍须完成授权名单桥接。详见[布尔筛选覆盖](../filters.md#boolean-filter-overrides)。


页面协议 6.87。结构真源为本册[schema.json](../schema.json)，SHA256 `4b54a9241be2802fede679f8abd2eff42e52c23de8f6447432819e2ede4c1f5d`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e74"></a>

### `@iocHeaderComponent`

Schema位置：`#/definitions/iocHeaderComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@iocHeaderComponent.id`

Schema位置：`#/definitions/iocHeaderComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@iocHeaderComponent.visibleWhen`

Schema位置：`#/definitions/iocHeaderComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@iocHeaderComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/iocHeaderComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@iocHeaderComponent.type`

Schema位置：`#/definitions/iocHeaderComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="iocHeader" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "iocHeader" | 用于选择@iocHeaderComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@iocHeaderComponent.layout`

Schema位置：`#/definitions/iocHeaderComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@iocHeaderComponent.props`

Schema位置：`#/definitions/iocHeaderComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | IOC页级身份与筛选位置声明；不承担查询编排，见page.md的IOC公共页头。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e74697479"></a>

### `@iocHeaderComponent.props.identity`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 可选身份行；省略不自动使用目录标题。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f7469746c65"></a>

### `@iocHeaderComponent.props.identity.title`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@iocHeaderComponent.props.identity.title · allOf[0]`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/title/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f636f6465"></a>

### `@iocHeaderComponent.props.identity.code`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/code`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 标签与业务编码整体显示；缺值整体省略。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f636f64652f70726f706572746965732f6c6162656c"></a>

### `@iocHeaderComponent.props.identity.code.label`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/code/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f636f64652f70726f706572746965732f76616c7565"></a>

### `@iocHeaderComponent.props.identity.code.value`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/code/properties/value`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f6465736372697074696f6e"></a>

### `@iocHeaderComponent.props.identity.description`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/description`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["text"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 说明文本。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f6465736372697074696f6e2f70726f706572746965732f74657874"></a>

### `@iocHeaderComponent.props.identity.description.text`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/description/properties/text`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 纯文本说明，沿用TextValue引用。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f6465736372697074696f6e2f70726f706572746965732f70726573656e746174696f6e"></a>

### `@iocHeaderComponent.props.identity.description.presentation`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/description/properties/presentation`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["inline","tooltip"] | Schema未设默认；装配/运行时默认见语义说明 | 说明直接显示或通过键盘可达说明入口展开。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "inline" | 在身份区直接显示说明。 |
| "tooltip" | 通过可聚焦说明入口展开完整文字。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f74616773"></a>

### `@iocHeaderComponent.props.identity.tags`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/tags`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 标签集合。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d73"></a>

### `@iocHeaderComponent.props.identity.tags[]`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/tags/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","text"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d732f70726f706572746965732f6964"></a>

### `@iocHeaderComponent.props.identity.tags[].id`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/tags/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d732f70726f706572746965732f74657874"></a>

### `@iocHeaderComponent.props.identity.tags[].text`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/tags/items/properties/text`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 业务标签文字；缺值不产生空色块。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d732f70726f706572746965732f746f6e65"></a>

### `@iocHeaderComponent.props.identity.tags[].tone`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/tags/items/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["neutral","info","success","warning","danger"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "neutral" | 中性标签，不推断业务含义。 |
| "info" | 提示信息标签。 |
| "success" | 显式成功语义标签。 |
| "warning" | 显式提醒语义标签。 |
| "danger" | 显式危险语义标签。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f6661637473"></a>

### `@iocHeaderComponent.props.identity.facts`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 显式期间/时间事实；不根据类别自动生成当前时间。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d73"></a>

### `@iocHeaderComponent.props.identity.facts[]`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","kind","label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f6964"></a>

### `@iocHeaderComponent.props.identity.facts[].id`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f6b696e64"></a>

### `@iocHeaderComponent.props.identity.facts[].kind`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["queryPeriod","latestDataPeriod","refreshedAt","generatedAt"] | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "queryPeriod" | 显式已应用查询期间。 |
| "latestDataPeriod" | 由可信输入给出的最新数据期。 |
| "refreshedAt" | 可信数据刷新时间，缺值省略。 |
| "generatedAt" | 可信页面生成时间，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@iocHeaderComponent.props.identity.facts[].label`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c7565"></a>

### `@iocHeaderComponent.props.identity.facts[].value`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@iocHeaderComponent.props.identity.facts[].value · anyOf[0]`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value/anyOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@iocHeaderComponent.props.identity.facts[].value · anyOf[1]`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fact","part"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f312f70726f706572746965732f66616374"></a>

### `@iocHeaderComponent.props.identity.facts[].value · anyOf[1].fact`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value/anyOf/1/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f312f70726f706572746965732f70617274"></a>

### `@iocHeaderComponent.props.identity.facts[].value · anyOf[1].part`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value/anyOf/1/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["latest","latestComplete","refreshedAt","generatedAt"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "latest" | 事实粒度下最新有数据期间，不隐含完成。 |
| "latestComplete" | 事实粒度下最新完成期间；缺少时不可回退latest。 |
| "refreshedAt" | 可信服务实际刷新时间，使用带时区ISO输入；不取浏览器当前时间。 |
| "generatedAt" | 可信产物生成时间，使用带时区ISO输入；不取浏览器当前时间。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6261636b"></a>

### `@iocHeaderComponent.props.back`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/back`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 返回意图；必须同时有合法returnContext和back处理函数。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择@iocHeaderComponent.props.back分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726561644f6e6c79"></a>

### `@iocHeaderComponent.props.readOnly`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/readOnly`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.41：页内筛选只读，所有用户筛选写入共用只读门禁；不是服务权限。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6e6f7465"></a>

### `@iocHeaderComponent.props.note`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/note`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 页头说明；可用于只读原因，纯文本。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f66696c746572496473"></a>

### `@iocHeaderComponent.props.filterIds`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/filterIds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 按序唯一认领静态可见的页级筛选；不含图表独立或详情私有筛选。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f66696c7465724964732f6974656d73"></a>

### `@iocHeaderComponent.props.filterIds[]`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/filterIds/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726573656e746174696f6e"></a>

### `@iocHeaderComponent.props.presentation`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/presentation`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 仅改变密度和折叠，不改变筛选语义。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726573656e746174696f6e2f70726f706572746965732f64656e73697479"></a>

### `@iocHeaderComponent.props.presentation.density`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/presentation/properties/density`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["normal","compact"] | Schema未设默认；装配/运行时默认见语义说明 | 普通或紧凑页头。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "normal" | 正常密度（缺省）。 |
| "compact" | 紧凑密度，不改查询。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726573656e746174696f6e2f70726f706572746965732f636f6c6c61707365"></a>

### `@iocHeaderComponent.props.presentation.collapse`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/presentation/properties/collapse`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["none","firstRow","overflow"] | Schema未设默认；装配/运行时默认见语义说明 | 保持全部筛选或按实测首行折叠；隐藏项退出焦点序列。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "none" | 全部展开（缺省）。 |
| "firstRow" | 按实际换行收起到首行。 |
| "overflow" | 按数量组织筛选；密集时前四项常驻，其余进入更多筛选，搜索放回内容区。compact 不收纳。 |

<a id="schema-232f646566696e6974696f6e732f696f63486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726573656e746174696f6e2f70726f706572746965732f6c61796f7574"></a>

### `@iocHeaderComponent.props.presentation.layout`

Schema位置：`#/definitions/iocHeaderComponent/properties/props/properties/presentation/properties/layout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["stacked","inline"] | Schema未设默认；装配/运行时默认见语义说明 | 6.41：stacked 身份与筛选上下排，inline 身份与筛选行内排布；按宿主容器响应。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "stacked" | 身份区与筛选区上下排布；缺省。 |
| "inline" | 标题与筛选行内排布；窄容器换行。 |

## 语义规则与反例（生成）

- `ioc-header-component`：首section首组件全宽、唯一且不混写旧根字段。反例：[ioc-component-detail](../errors/ioc-component-detail.json)、[ioc-component-position](../errors/ioc-component-position.json)、[ioc-component-span](../errors/ioc-component-span.json)、[ioc-component-mixed](../errors/ioc-component-mixed.json)、[ioc-component-count](../errors/ioc-component-count.json)、[ioc-component-old-version](../errors/ioc-component-old-version.json)、[ioc-component-legacy-version](../errors/ioc-component-legacy-version.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-iocHeader.json)：独立完整页面，保留必要语义依赖。
- [ioc-header-section-placement](../examples/ioc-header-section-placement.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-component-availability-page](../examples/ioc-component-availability-page.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-component-ioc-header-page](../examples/ioc-component-ioc-header-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-iocHeader.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "header",
  "type": "iocHeader",
  "layout": {
    "span": 12
  },
  "props": {
    "identity": {
      "title": "表头初值下钻入口（合成）"
    }
  }
}
```


## 联合分支见证（生成）

- `#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value/anyOf/0`：[合法完整页面](../examples/ioc-component-availability-page.json)，JSON Pointer `#/sections/0/components/0/props/identity/facts/0/value`。
- `#/definitions/iocHeaderComponent/properties/props/properties/identity/properties/facts/items/properties/value/anyOf/1`：[合法完整页面](../examples/ioc-component-availability-page.json)，JSON Pointer `#/sections/0/components/0/props/identity/facts/1/value`。

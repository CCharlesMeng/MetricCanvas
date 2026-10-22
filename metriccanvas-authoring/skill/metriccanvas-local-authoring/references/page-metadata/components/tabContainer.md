# Tab 容器 tabContainer

在同一卡位切换多张表格,不占用额外栅格行。适用于概览 / TOP / 丢单这类互斥表格需要共用一块区域。数据形状：不绑定页面数据源；每个 Tab 内的表格自己声明数据槽。

活动面板只呈现声明Tab，子组件类型受限；切换不生成另一份页面文档。嵌套边界由Schema分支限定，不能递归塞任意容器。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

<a id="url-初始化页签633"></a>

## URL 初始化页签（6.33）

每个容器可用 `props.initialTabUrlParam` 声明自己的公开 URL 参数名。参数值必须精确匹配 `props.tabs[].id`，不使用标签或数组下标。以下片段属于容器的 `props`，需与 `tabs` 一起配置：

```json
{ "defaultTab": "overview", "initialTabUrlParam": "sales-tab" }
```

打开 `?sales-tab=detail` 时初始选中 `id: "detail"`。优先级为单个合法 URL 值 → `defaultTab` → 第一个 Tab。参数缺失、空字符串、重复键（即使值相同）、未知 id 均回退；不修剪值、不忽略大小写。URL 按普通查询参数解码一次；未声明接收参数的容器保持原行为。

同页多个容器使用不同参数名，例如 `?sales-tab=detail&support-tab=closed`。参数名不得与本页页面参数 id、筛选器实际 URL 参数名（包含别名、范围与层级分量）或其他容器的 `initialTabUrlParam` 重复，冲突在页面校验时拒绝。

该配置是页面实例的初始呈现输入，由统一运行时消费集成应用传入的 `initialSearch`。纯呈现组件不读取浏览器地址。初始化后用户可自由切换，切换不回写 URL；筛选更新与数据刷新不重新应用初值。新建页面实例或显式改变 `initialSearch` 时重新初始化。不新增页面参数声明，不改变查询执行和报告导出的既有全 Tab 展开行为，也不负责自动滚动到容器。

来源页面必须使用目标容器公开的参数名和 Tab id。固定值写在 `href` 中，动态值使用既有 `query` 的 row / param / filter 显式绑定；配置方法见[链接传参与目标页签](../actions-and-navigation.md#链接传参与目标页签)。普通导航不加载目标页面校验其配置；目标 Tab 改名或删除后，旧链接按上述规则回退，应同步更新引用它的来源页面。

创作工具的 `add_tab_container` 可直接声明 `initialTabUrlParam`；`set_properties` 可修改它和 `defaultTab`。写入 URL 初值字段时自动采用当前写出版本，普通标题编辑保留已有配置，冲突或非法页签配置由完整页面校验拒绝。

完整场景为 `tab-url-initialization`，来源页面为 `tab-url-source`。两页均使用内联演示数据，仅验证链接和页签行为。

6.35条件呈现及相关限制见[条件显隐](../conditions.md)；子项全部隐藏不自动收起父容器。


页面协议 6.48。结构真源为本册[schema.json](../schema.json)，SHA256 `fa5b4a20d1d04e7e0facdf453ad0940288964298858a84091b558b17f7c7ad74`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e74"></a>

### `@tabContainerComponent`

Schema位置：`#/definitions/tabContainerComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@tabContainerComponent.id`

Schema位置：`#/definitions/tabContainerComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@tabContainerComponent.visibleWhen`

Schema位置：`#/definitions/tabContainerComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tabContainerComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tabContainerComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@tabContainerComponent.type`

Schema位置：`#/definitions/tabContainerComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="tabContainer" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "tabContainer" | 用于选择@tabContainerComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@tabContainerComponent.layout`

Schema位置：`#/definitions/tabContainerComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@tabContainerComponent.props`

Schema位置：`#/definitions/tabContainerComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["tabs"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@tabContainerComponent.props.title`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tabContainerComponent.props.title · allOf[0]`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@tabContainerComponent.props.variant`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["compact","analysisStack"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |
| "analysisStack" | 分析纵向堆叠呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64656661756c74546162"></a>

### `@tabContainerComponent.props.defaultTab`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/defaultTab`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始Tab id，须存在于tabs。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f696e697469616c54616255726c506172616d"></a>

### `@tabContainerComponent.props.initialTabUrlParam`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/initialTabUrlParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 6.33 起显式声明初始化 Tab 的 URL 参数名；值匹配 Tab id，缺失、空值、重复或未知值回退 defaultTab / 首个 Tab。与本页其他 URL 输入名称互斥。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f74616273"></a>

### `@tabContainerComponent.props.tabs`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/tabs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 非空Tab集合，每项id唯一。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746162732f6974656d73"></a>

### `@tabContainerComponent.props.tabs[]`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/tabs/items`。目标：[#/definitions/tabItem](../components/tabContainer.md#schema-232f646566696e6974696f6e732f7461624974656d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabItem | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d"></a>

### `@tabItem`

Schema位置：`#/definitions/tabItem`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f30"></a>

### `@tabItem · anyOf[0]`

Schema位置：`#/definitions/tabItem/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","label","component"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f6964"></a>

### `@tabItem · anyOf[0].id`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f76697369626c655768656e"></a>

### `@tabItem · anyOf[0].visibleWhen`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tabItem · anyOf[0].visibleWhen · allOf[0]`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@tabItem · anyOf[0].label`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f636f6d706f6e656e74"></a>

### `@tabItem · anyOf[0].component`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/component`。目标：[#/definitions/tableComponent](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 单个受控组件声明。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f31"></a>

### `@tabItem · anyOf[1]`

Schema位置：`#/definitions/tabItem/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","label","components"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f6964"></a>

### `@tabItem · anyOf[1].id`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f76697369626c655768656e"></a>

### `@tabItem · anyOf[1].visibleWhen`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tabItem · anyOf[1].visibleWhen · allOf[0]`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@tabItem · anyOf[1].label`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f636f6d706f6e656e7473"></a>

### `@tabItem · anyOf[1].components`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/components`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 受控子组件集合；容器白名单与顶层集合不同。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f636f6d706f6e656e74732f6974656d73"></a>

### `@tabItem · anyOf[1].components[]`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/components/items`。目标：[#/definitions/tableComponent](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `tab-container`：Tab id 唯一且 defaultTab 已声明。反例：[tab-id-duplicate](../errors/tab-id-duplicate.json)、[tab-default-unknown](../errors/tab-default-unknown.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `tab-url-initialization`：6.33 Tab 显式 URL 初值与页面输入名称互斥。反例：[tab-url-before-6.33](../errors/tab-url-before-6.33.json)、[tab-url-empty-key](../errors/tab-url-empty-key.json)、[tab-url-duplicate-key](../errors/tab-url-duplicate-key.json)、[tab-url-filter-conflict](../errors/tab-url-filter-conflict.json)、[tab-url-param-conflict](../errors/tab-url-param-conflict.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-tabContainer.json)：独立完整页面，保留必要语义依赖。
- [compact](../examples/component-tabContainer-compact.json)：独立完整页面，保留必要语义依赖。
- [analysisStack](../examples/component-tabContainer-analysisStack.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [tab-url-initialization](../examples/tab-url-initialization.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-tabContainer.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "support-tabs",
  "type": "tabContainer",
  "layout": {
    "span": 6
  },
  "props": {
    "title": "support-tabs",
    "initialTabUrlParam": "support-tab",
    "tabs": [
      {
        "id": "open",
        "label": "未关闭工单",
        "component": {
          "id": "support-tabs-open",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "demo"
          },
          "props": {
            "title": "未关闭工单：内联演示数据",
            "columns": [
              {
                "field": "name",
                "title": "演示内容"
              }
            ]
          }
        }
      },
      {
        "id": "closed",
        "label": "已关闭工单",
        "component": {
          "id": "support-tabs-closed",
          "type": "table",
          "layout": {
            "span": 12
          },
          "data": {
            "main": "demo"
          },
          "props": {
            "title": "已关闭工单：内联演示数据",
            "columns": [
              {
                "field": "name",
                "title": "演示内容"
              }
            ]
          }
        }
      }
    ]
  }
}
```


## 联合分支见证（生成）

- `#/definitions/tabItem/anyOf/0`：[合法完整页面](../examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0`。
- `#/definitions/tabItem/anyOf/1`：[合法完整页面](../examples/composite-page.json)，JSON Pointer `#/sections/1/components/0/props/tabs/1`。

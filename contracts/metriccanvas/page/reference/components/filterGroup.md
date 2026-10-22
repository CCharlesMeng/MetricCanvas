# 独立筛选 filterGroup

6.45 引入，旧图表筛选采用本次明确批准的受控迁移。

Dashboard 正文中的独立固定单选筛选组件，也可放入组合卡。组件不承载数据、不强制卡面或标题；沿用原图表筛选按钮的圆角、配色、键盘与窄屏换行行为。

```json
{
  "id": "channel-filter",
  "type": "filterGroup",
  "layout": {"span": 12},
  "visibleWhen": {"filter":"scope","part":"values","op":"containsAny","values":["DOMESTIC"]},
  "props": {
    "filterId": "channel",
    "options": [{"label":"直营","value":"CN"},{"label":"加盟","value":"OVERSEAS"}]
  }
}
```

`filterId` 引用同页普通维度筛选器，例如 `{"id":"channel","type":"dimension","dimension":"region","default":["CN"]}`。`options` 是非空固定候选列表，各 value 唯一；label 仅用于展示，value 写入统一筛选状态、URL 和查询。default 必须是候选中的恰好一个值。不使用层级、级联、initialParam 或另一份声明级候选、选择策略。

作用范围只由查询定义中的 `filterBindings` 决定；至少一个查询必须消费这个筛选器。允许多个查询绑定同一筛选器，也允许指标卡、图表或其他组件共同消费受影响结果。不增加受控组件 ID 列表，不按控件位置隐式划范围，不要求复制共享数据源。未绑定且不依赖受影响结果的数据源不因本控件切换刷新。

组件顶层 `visibleWhen` 与筛选声明的 `visibleWhen`、静态 `visible:false` 及祖先门禁由统一展示模块组合求值。隐藏控件保留筛选状态和查询绑定；内容分别声明自己的条件。再次显示恢复已有选择。候选项固定，不因页头切换自动改变，也不请求候选端口。只读页面禁用按钮或下拉；加载、空结果、查询失败不移除独立控件。

同一筛选器只能声明一个 filterGroup，不在页头重复显示。Report、详情视图、动态候选、多选与空选不在首批范围。非法或多值 URL 输入回退声明默认项；运行期非法写入保留已应用选择。静态导出共用冻结筛选与展示投影，以当前选中 label 替代按钮或下拉。

旧图表 `props.filter` 已移除，校验器给出明确迁移提示，不提供旧渲染分支。迁移将 filterId/options 移到独立组件，保留筛选声明、默认项、查询绑定和稳定业务值；需要保持同组布局时使用组合卡。四类图表均可作为组合卡的叶子组件，不开放递归容器。

验收入口：`filter-group-page` 展示图表卡左上按钮切换指标、右上区域下拉，两项通过查询绑定共同刷新图表与合计；`filter-group-state-page` 展示带符号指标卡、一控多、独立与卡内布局、页头条件显隐、无关对照和 URL 恢复；`chart-local-filter-page` 为四类旧图表声明迁移后的页面。这些场景数据均为本地合成数据，不代表真实 DQE、Relay 或生产接入验收。

## 固定单选下拉与对齐（6.47）

`props.display` 可取 `buttons`（省略时的默认值）或 `select`。下拉复用现有维度筛选控件，保持固定候选、必选单选、不请求候选端口；状态、URL、条件显隐、只读与静态导出与按钮完全一致。`props.align` 可取 `left`（默认）或 `right`，只控制控件在所占栅格中的对齐，不改变查询范围。显式配置任一属性均要求 6.47。

图表卡中的两个控件各占 `layout.span:6`，图表占 12；右侧使用 `{"filterId":"region","display":"select","align":"right","options":[{"label":"全部区域","value":"all"},{"label":"华东","value":"east"},{"label":"华南","value":"south"}]}`。两个筛选器分别绑定 queryField，组合条件由查询消费。示例的 `all` 是合成数据集显式提供的全区域汇总行，不代表通用的“不过滤”值，也不能把该业务值移植到真实查询。

按钮切换指标仍是显式筛选：合成数据有 `toolbar_metric` 维度，图表和合计查询都绑定它以及区域维度；不同指标的单位和内容分别通过集中 `visibleWhen` 选择。运行时不替换查询字段、不执行脚本。原型链接 `/prototypes/chart-filter-toolbar` 重定向到正式示例。

指标卡分区可复用相同声明：section.container:card、section.title、span:12 的 filterGroup、连续 Before 指标卡依次组成白底无边框区域；标题和筛选均靠左，筛选在标题下方。示例 `/pages/metric-card-equation` 的 all/east/south 是合成汇总数据中的显式区域值，all 不代表通用的清除查询条件。


页面协议 6.49。结构真源为本册[schema.json](../schema.json)，SHA256 `f7595ffbdcf2fe8b269b74567933759d72d6ed3067022eb2cc8fc84196ac0f34`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e74"></a>

### `@filterGroupComponent`

Schema位置：`#/definitions/filterGroupComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@filterGroupComponent.id`

Schema位置：`#/definitions/filterGroupComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@filterGroupComponent.type`

Schema位置：`#/definitions/filterGroupComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filterGroup" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filterGroup" | 用于选择@filterGroupComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@filterGroupComponent.layout`

Schema位置：`#/definitions/filterGroupComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@filterGroupComponent.visibleWhen`

Schema位置：`#/definitions/filterGroupComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@filterGroupComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/filterGroupComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@filterGroupComponent.props`

Schema位置：`#/definitions/filterGroupComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["filterId","options"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f66696c7465724964"></a>

### `@filterGroupComponent.props.filterId`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 引用页面独立普通维度筛选器；初值由该筛选器 default 声明，查询范围仅由 filterBindings 声明。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f646973706c6179"></a>

### `@filterGroupComponent.props.display`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/display`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["buttons","select"] | Schema未设默认；装配/运行时默认见语义说明 | 6.47固定单选呈现：buttons（默认）或select；共用筛选状态、固定候选和查询绑定。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "buttons" | 固定单选按钮，省略display时保持此呈现。 |
| "select" | 复用维度下拉，固定候选且必选单选。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616c69676e"></a>

### `@filterGroupComponent.props.align`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/align`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","right"] | Schema未设默认；装配/运行时默认见语义说明 | 6.47控件在所占栅格内左/右对齐，默认left；不改变筛选范围。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6f7074696f6e73"></a>

### `@filterGroupComponent.props.options`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/options`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 固定单选候选列表，label 用于展示，value 进入查询与 URL，各 value 唯一。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6f7074696f6e732f6974656d73"></a>

### `@filterGroupComponent.props.options[]`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/options/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@filterGroupComponent.props.options[].label`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/options/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f76616c7565"></a>

### `@filterGroupComponent.props.options[].value`

Schema位置：`#/definitions/filterGroupComponent/properties/props/properties/options/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

## 语义规则与反例（生成）

- `filter-group`：6.45 Dashboard 独立固定单选筛选按钮组、多查询与统一显隐。反例：[filter-group-version](../errors/filter-group-version.json)、[filter-group-report](../errors/filter-group-report.json)、[filter-group-detail](../errors/filter-group-detail.json)、[filter-group-invalid-default](../errors/filter-group-invalid-default.json)、[filter-group-duplicate-options](../errors/filter-group-duplicate-options.json)、[filter-group-duplicate-control](../errors/filter-group-duplicate-control.json)、[filter-group-no-binding](../errors/filter-group-no-binding.json)、[filter-group-removed-chart-filter](../errors/filter-group-removed-chart-filter.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `filter-group-presentation`：6.47固定单选下拉和左右对齐。反例：[filter-select-version](../errors/filter-select-version.json)、[filter-select-default](../errors/filter-select-default.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-filterGroup.json)：独立完整页面，保留必要语义依赖。
- [filter-group-page](../examples/filter-group-page.json)：完整合法页面；查询仅为静态契约证据。
- [filter-group-state-page](../examples/filter-group-state-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-local-filter-page](../examples/chart-local-filter-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-filterGroup.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "map-filter",
  "type": "filterGroup",
  "layout": {
    "span": 12
  },
  "props": {
    "filterId": "map-region",
    "options": [
      {
        "label": "中国区",
        "value": "CN"
      },
      {
        "label": "海外",
        "value": "OVERSEAS"
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/filter-group.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/filter-group.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime/src/presentation.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime-ui/src/dashboard/FilterGroup.svelte`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

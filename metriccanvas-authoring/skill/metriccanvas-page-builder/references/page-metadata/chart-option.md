# 图表高级 ECharts 呈现扩展

自 6.32 起，`barChart`、`lineChart`、`pieChart` 可声明隐含 `props.echartsOption`。它是正式协议中的高级入口，属性面板不展示、AI 默认不主动生成；只在用户明确要求 ECharts 定制，或现有属性不足且用户已接受时使用。普通编辑保留已有配置；切换图表类型时清除并向 console 说明，撤销恢复。

## 声明与合并

根必须是 JSON 对象，值只允许普通 JSON，嵌套不超过64层。允许字符串模板，不执行函数、函数字符串或表达式。该子树不参与 MetricCanvas 的 param/filter/parts 文本解析。

```json
{"echartsOption":{"animation":false,"series":[{},{"lineStyle":{"width":3}}]}}
```

同一允许路径透传优先；对象递归合并，颜色、半径等普通数组整体替换。null 是显式值，不是删除操作。`series` 仅接受对象数组，按页面 `props.series` 的声明序补充；柱图 stackOrder 改变绘制序时对应关系保持。空数组无补丁、空对象保留该项，不增删系列；饼图只有一项。xAxis/yAxis 对象补充第0轴，数组按既有轴索引补充，不能创建轴。删除配置后恢复基础呈现。

保留 ECharts 原生属性层级：series.itemStyle 不自动压过每个数据项更具体的 itemStyle；引擎不为此重写受保护数据。模板可替换当前显示格式，原始数值和组件字段绑定保持。

## 允许入口与保护

允许 color、backgroundColor、textStyle、grid、legend、tooltip、xAxis、yAxis、series，以及 animation、animationDuration/Update、animationDelay/Update、animationEasing/Update、stateAnimation。grid/legend/tooltip 为单个对象；饼图没有 grid 或轴。grid 边距参与布局，必要的防裁切空间由引擎修正。静态导出关闭动画、去掉缩放控件、展示完整结果。

系列数据、类别轴 data、dataset/encode/dimensions、系列 id/name/type、stack、轴/坐标系归属、事件接管和关闭既有点击行为均拒绝。baseOption/options/media/timeline、visualMap/geo/graphic/toolbox/dataZoom、markPoint/markLine/markArea 不属于本批开放面。链接、外部图片、额外下载、原始 HTML/CSS、回调位置及原型修改相关键同样拒绝。formatter 仅在 tooltip、axisLabel、label 中接受字符串模板；valueFormatter 等函数专用位置不开放。tooltip 模板只允许纯文本（无尖括号 HTML 标记），换行可配合 richText 模式；呈现值不接受 CSS 声明片段（非 formatter 字符串中的分号）、url/image-set/expression 或可执行 URL。

产品校验检查 JSON、上述保护与集合边界，错误返回精确 JSON Pointer；不复制完整 ECharts Schema。部分未知属性可能被 ECharts 忽略或警告，校验通过不保证每个属性都有效，也不保证会触发回退。

## 失败、降级和诊断

非法 JSON、受保护路径、越界等校验错误直接拒绝，不降级绕过。通过校验后，扩展构造、合并、布局或绘制抛错时，销毁失败实例，干净基础配置回退一次；基础配置自身失败则保留标题和容器、绘图区留空。原页面配置保留。resize 不重新启用已失败的扩展，有效数据或配置变化后重新尝试。

本能力诊断只写 console，包含组件 id/type、stage、path 和原始 cause。页面、toast、tooltip 和导出按钮不展示错误文字；CLI/工具/独立校验器仍返回结构化错误。无法定位叶子时使用选项入口路径，不虚构位置。导出视图发生降级或基础绘制失败就终止 PDF/PNG，无下载，原因只 console；其他既有错误处理保持。

完整场景 `chart-echarts-option-page` 由本模块的示例路由提供，全部为内联演示数据。数据/结构拒绝由契约反例验证；绘制恢复与导出终止由浏览器故障注入验证，不依赖某个 ECharts 属性恰好报错。地图和其他组件不支持本入口。

货币字段选择同样只消费页面协议拥有的字段绑定；不透明`echartsOption`内部的`byFilter`等同名键不声明IOC能力、不参与选择器依赖，也不被运行时货币投影改写。


页面协议 6.45。结构真源为本册[schema.json](schema.json)，SHA256 `23830b5ce5063c01351c5ddc96f736dd0d80aaf80e7f094dec8a47eb23b8d190`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e"></a>

### `@chartOption`

Schema位置：`#/definitions/chartOption`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 高级 ECharts 呈现 JSON；数据、结构和交互由引擎管理，不执行代码 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e2f6164646974696f6e616c50726f70657274696573"></a>

### `@chartOption{key}`

Schema位置：`#/definitions/chartOption/additionalProperties`。目标：[#/definitions/chartOptionValue](chart-option.md#schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartOptionValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c7565"></a>

### `@chartOptionValue`

Schema位置：`#/definitions/chartOptionValue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f30"></a>

### `@chartOptionValue · anyOf[0]`

Schema位置：`#/definitions/chartOptionValue/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f31"></a>

### `@chartOptionValue · anyOf[1]`

Schema位置：`#/definitions/chartOptionValue/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f32"></a>

### `@chartOptionValue · anyOf[2]`

Schema位置：`#/definitions/chartOptionValue/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f33"></a>

### `@chartOptionValue · anyOf[3]`

Schema位置：`#/definitions/chartOptionValue/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f34"></a>

### `@chartOptionValue · anyOf[4]`

Schema位置：`#/definitions/chartOptionValue/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f342f6974656d73"></a>

### `@chartOptionValue · anyOf[4][]`

Schema位置：`#/definitions/chartOptionValue/anyOf/4/items`。目标：[#/definitions/chartOptionValue](chart-option.md#schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartOptionValue | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f35"></a>

### `@chartOptionValue · anyOf[5]`

Schema位置：`#/definitions/chartOptionValue/anyOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f352f6164646974696f6e616c50726f70657274696573"></a>

### `@chartOptionValue · anyOf[5]{key}`

Schema位置：`#/definitions/chartOptionValue/anyOf/5/additionalProperties`。目标：[#/definitions/chartOptionValue](chart-option.md#schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartOptionValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e56616c75652f616e794f662f352f70726f70657274794e616d6573"></a>

### `@chartOptionValue · anyOf[5] · propertyNames`

Schema位置：`#/definitions/chartOptionValue/anyOf/5/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172744f7074696f6e2f70726f70657274794e616d6573"></a>

### `@chartOption · propertyNames`

Schema位置：`#/definitions/chartOption/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `chart-echarts-option`：6.32 三图高级呈现 JSON、保护数据结构、系列和轴补丁边界。反例：[chart-option-before-6.32](errors/chart-option-before-6.32.json)、[chart-option-legacy-version](errors/chart-option-legacy-version.json)、[chart-option-html-template](errors/chart-option-html-template.json)、[chart-option-css-fragment](errors/chart-option-css-fragment.json)、[chart-option-data-protected](errors/chart-option-data-protected.json)、[chart-option-series-overflow](errors/chart-option-series-overflow.json)、[chart-option-wrapper-forbidden](errors/chart-option-wrapper-forbidden.json)、[chart-option-other-component](errors/chart-option-other-component.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [chart-echarts-option-page](examples/chart-echarts-option-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/chart-option.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/components/charts.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/chartOptionValue/anyOf/0`：[合法完整页面](examples/chart-echarts-option-page.json)，JSON Pointer `#/sections/0/components/1/props/echartsOption/grid/top`。
- `#/definitions/chartOptionValue/anyOf/1`：[合法完整页面](examples/chart-echarts-option-page.json)，JSON Pointer `#/sections/0/components/1/props/echartsOption/grid/right`。
- `#/definitions/chartOptionValue/anyOf/2`：[合法完整页面](examples/chart-echarts-option-page.json)，JSON Pointer `#/sections/0/components/1/props/echartsOption/animation`。
- `#/definitions/chartOptionValue/anyOf/3`：[合法完整页面](examples/chart-echarts-option-page.json)，JSON Pointer `#/sections/0/components/3/props/echartsOption/backgroundColor`。
- `#/definitions/chartOptionValue/anyOf/4`：[合法完整页面](examples/chart-echarts-option-page.json)，JSON Pointer `#/sections/0/components/1/props/echartsOption/series`。
- `#/definitions/chartOptionValue/anyOf/5`：[合法完整页面](examples/chart-echarts-option-page.json)，JSON Pointer `#/sections/0/components/1/props/echartsOption/grid`。

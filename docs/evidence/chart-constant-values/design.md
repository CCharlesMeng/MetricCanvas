# 图表配置项支持常量取值：方案与架构影响

日期：2026-10-26。

状态：Schema 6.59 本仓实现与本地验收完成，方案作为决策依据留存；main 交付与远端 CI 以交付回执为准。本文保留实施前差分并更新最终裁决；现行声明以字段绑定/组件取值文档为准，验收与剩余边界见[实施结果](result.md)。

## 1. 已确认的产品原则

需求起点是在查询驱动的图表中手动增加一个固定值为 2 的折线。用户最终明确：**某个配置项的数据可以来源于常量**。能力属于配置项的取值来源，不新增“基线”组件或专用 referenceLines 协议。

已确认：

1. 配置项从字段取值或直接声明常量；沿用 `field` / `value` 二选一的简洁形式，不使用 `field: { value: 2 }`。
2. 通用取值逻辑共享，覆盖全部图表类型，并包括仪表。不能只实现 lineChart 后称为完成。
3. 常量按消费位置原有的类型和呈现语义工作。普通系列继续使用普通系列的图例、坐标轴、标签和颜色规则。
4. 多行位置的标量常量按当前行集重复取值；单值位置直接取值。
5. 查询空数据时是否继续显示常量内容可配；策略放在**图表级**，不放在每个常量项上。默认沿用现有空态行为。
6. 首轮不扩展手工序列、独立横轴、任意公式或表达式。常量不变成第三种页面数据源，也不要求给查询结果逐行增加固定字段。

“所有图表”是组件覆盖范围；“某个配置项”是取值能力的落点。不能据此把结构、身份和交互所需的字段引用一并改成任意值。

## 2. 声明方向

### 2.1 柱图与折线图的系列

```json
{
  "series": [
    { "field": "actual", "label": "实际值" },
    { "value": 2, "label": "基线" }
  ]
}
```

原有字符串和显式数据槽字段绑定保持可读；常量系列不声明一个虚假的字段。`field` 与 `value` 必须有且只有一个，按属性是否存在判断，`0` 不能被当成未配置。

柱线混合继续复用既有 `kind: "line"` 和 `axis`，常量来源不改变混合图现有约束。`kind`、`role`、`axis`、`stackOrder` 与取值来源是不同职责。

### 2.2 已使用 valueField 的入口

饼图、地图和仪表目前使用 `props.valueField`，不宜为统一名称而迁移所有旧页面。建议在同一级增加互斥的 `props.value`：

```json
{ "valueField": "amount" }
```

或：

```json
{ "value": 2 }
```

已采用同级 `valueField` / `value` 互斥联合，保留旧字段声明。公共语义可以统一，旧属性名不必全部重命名。一个对象存在多个取值位置时，逐项登记映射，不能给整个对象堆一个含义不明的 `value`。

### 2.3 空数据声明

已采用图表级 `props.emptyBehavior: "default" | "showConstants"`，缺省等同 `default`。

`showConstants` 表示在必要呈现上下文仍成立时允许显示常量内容，不表示创建横轴类别、地域记录或查询结果。它也不将加载中、查询失败、无权限和字段值全部缺失自动归为查询空结果。

## 3. 实施前基线与架构冲击

以下是实施前源码基线及本次职责差分，代码已按后续进度完成；不表示运行中的部署已经采用这些代码。

| 影响面 | 当前事实与入口 | 必要改变 | 影响程度 |
|---|---|---|---|
| 页面协议 | [charts.ts](../../../packages/page/src/schema/components/charts.ts) 的 `chartSeriesZ` 必填 `field`；饼图必填 `valueField`；[map-chart.ts](../../../packages/page/src/schema/components/map-chart.ts)、[gauge.ts](../../../packages/page/src/schema/components/gauge.ts) 同样只接受字段 | 增加严格互斥的取值分支、图表级空态策略，覆盖普通和所有现有变体 | 高 |
| 字段契约工具 | [field.ts](../../../packages/page/src/field.ts) 的 `FieldBinding`、`fieldName`、`staticFieldBinding` 全部以真实字段为前提 | 保留字段专用工具；新增独立的取值来源模型，不能让 `fieldName` 为常量返回假字段名 | 高 |
| 语义校验 | [validate.ts](../../../packages/page/src/validate.ts) 的 `componentErrors`、`resolveBinding` 检查槽、字段、role、格式；混合图还读取字段的单位和币种 | 字段分支保留原检查；常量分支按消费位置检查值和语义，互斥错误返回精确路径 | 高 |
| 展示格式 | [component-data.ts](../../../packages/engine/widgets/src/shared/component-data.ts) 的 `resolveField` 返回字段定义，`fieldValue` 最终读取行字段 | 提供统一取值模块，分开处理原始值、最终展示信息与可选行身份；常量不继承某个碰巧排在前面的字段 | 高 |
| 图表翻译 | [柱图](../../../packages/engine/widgets/src/components/bar-chart/options.ts)、[折线](../../../packages/engine/widgets/src/components/line-chart/options.ts)、[饼图](../../../packages/engine/widgets/src/components/pie-chart/options.ts)、[地图](../../../packages/engine/widgets/src/components/map-chart/options.ts) 多处直接 `row[resolved.field]` | 数值读取、缺失过滤、总量、标签、tooltip 和轴格式一并改为共享取值；不能只替换绘图 data | 高 |
| 仪表 | [Gauge.svelte](../../../packages/engine/widgets/src/components/gauge/Gauge.svelte) 用 `fieldValue` 读取第一行；[page.ts](../../../packages/page/src/page.ts) 的 `isChartComponent` 不包括 gauge | 仪表纳入本次验收，但不能全局扩大 `isChartComponent` 而意外改变其他交互调用点 | 中 |
| 数据槽与运行态 | 图表和仪表都必填 [mainDataZ](../../../packages/page/src/schema/primitives.ts)；[RuntimeSurface.svelte](../../../packages/engine/runtime-ui/src/RuntimeSurface.svelte) 按槽投影数据；[ComponentRenderer.svelte](../../../packages/engine/runtime-ui/src/ComponentRenderer.svelte) 假定存在 main | 支持常量项不依赖额外槽；完整无数据源组件需要额外处理可省略 data、依赖识别和渲染入参 | 高 |
| 空态与错误态 | [widget-host-state.ts](../../../packages/engine/runtime-ui/src/widget-host-state.ts) 把 empty 和 error 都投影为 `ready, rows: []`；[WidgetHost.svelte](../../../packages/engine/runtime-ui/src/WidgetHost.svelte) 仍渲染标题与组件内容 | 在原始状态丢失之前求值空态策略，防止查询错误被误当“允许显示常量的空结果” | 高 |
| 字段选择 | [field-selection.ts](../../../packages/page/src/field-selection.ts) 的 byFilter 目前只选择静态 money 字段 | 保留现有字段选择协议；常量项不制造字段依赖，不顺带允许按筛选切换常量或执行换算 | 中 |
| 预测边界 | [bar-forecast-boundary.ts](../../../packages/page/src/bar-forecast-boundary.ts) 针对 series.field 检查初始行与统计月边界 | 常量系列的 actual/forecast role 必须有明确规则，不得直接跳过边界校验 | 中 |
| 创作与编辑 | [property-edit.ts](../../../apps/platform/src/lib/workbench/property-edit.ts) 当前有系列标签编辑；[component-building.ts](../../../apps/platform/src/lib/workbench/component-building.ts) 根据结果字段生成组件 | 新增来源切换和常量输入时互斥清理，切换图表类型、撤销和预览保持协议；不要凭空宣称现有面板已有完整绑定编辑器 | 中 |
| 本地创作与分发 | [local-authoring-data-analysis.ts](../../../tools/scripts/local-authoring-data-analysis.ts) 沿 Schema 识别字段绑定；[Python binding_keys](../../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/components/field_bindings.py) 枚举字段身份 | 常量不能被报告成“缺失字段/待匹配指标”；审计直接消费者，新增共享协议节点必须进入知识和独立校验器生成链 | 中 |
| 版本和契约 | [version.ts](../../../packages/page/src/version.ts) 维护能力下限；[page-reference.ts](../../../tools/scripts/page-reference.ts) 从产品 Schema 导出参考与分支覆盖 | 新能力按增量次版本登记，补合法/非法契约向量，实施时以 current 为准，不预占某个版本号 | 中 |

结论：这是一次**涉及页面协议、校验、统一运行时和全部图表消费者的公共能力扩展**。变更范围较广，但可以沿取值模块集中实现；不需要改 DQE 查询定义、数据网关取数协议、结果行粒度或具名算子。

## 4. 推荐的模块划分

### 4.1 协议模块继续归 page

候选类型仅说明职责：

```ts
type ComponentValueSource =
  | { field: FieldBinding; value?: never }
  | { value: ScalarFieldValue; field?: never };
```

该类型不要求页面增加一层 source 包装。消费位置可沿用 `field` 或 `valueField` 等既有键，Schema 与读取器将其映射到同一个内部模型。类型与 Zod Schema 都归 `packages/page`，不迁到 widgets，不在各图表复制判别规则。

保留 `FieldBinding` 为字段绑定，保留 `FieldReference` 为字段引用。`match`、rowKey、层级字段、查询输出映射、计算输入、action 所需的行字段仍有真实字段身份，不能一概替换为常量。

普通图表度量位置只接受有限数值常量，不能把字符串 `"2"` 隐式转成数字。是否允许 null 取决于消费位置的缺失契约；`value: null` 与没有声明 value 必须可区分。字符串、布尔等标量仅在消费位置本来接受对应类型时有效。数组、对象和可执行表达式不进入首轮通用常量分支。

### 4.2 统一取值模块

在现有共享组件数据模块旁承接三个职责：

1. 解析来源：字段绑定或常量；只为真实字段报告数据槽、字段定义与依赖。
2. 按当前位置读取原始值：字段按既有 rowIndex/match 规则读取；常量直接返回。多行图表沿已有行循环调用，不修改数据快照。
3. 解析消费位置的展示信息和可选行上下文；字段继续继承自己的 defaultFormat，常量从消费位置获得明确的展示信息。

共享返回值应能区分字段来源与常量来源。不要给常量创建伪造 `ResolvedFieldDefinition`，不要把常量写进页面数据源、结果字段契约或查询响应。

纯渲染组件继续只消费确定的入参、上抛事件；不发起查询、不访问页面全局状态，也不各自解释查询失败。

### 4.3 展示语义与单位是实际难点

普通 `value: 2` 不应附带一套必填元数据。它作为原始数值使用，百分数和万/百万等展示仍遵循现有刻度规则，不自动乘 100 或转换金额。

但当前显式混合系列要求每个结果字段声明单位和同轴币种，常量没有结果字段契约。**仅添加 value 并绕过 resolveBinding，会削弱现有同轴语义保护。** 本批采用常量项显式 format/unit/currency，不在运行时继承其他字段或猜测轴语义；混合图常量要求自己的单位，同轴单位与币种继续一致。工作台从既有字段切换为常量时将原绑定的展示信息写入常量项。

## 5. 全图表覆盖与呈现规则

| 类型/变体 | 常量作为数值来源的含义 | 必须同时验证的路径 |
|---|---|---|
| 普通柱图、横向柱图 | 每个已有类别都使用该常量 | 横向轴、标签、tooltip、默认柱宽、颜色、空类别 |
| 堆叠柱图 | 常量作为普通段参与堆叠 | 堆叠顺序、段值、合计与总标签，不能自动当成不参加堆叠的阈值 |
| 柱线混合、双轴 | value 系列按既有 kind/axis 绘制 | 主次轴、同轴单位与币种、图例顺序、缺失值、点击索引 |
| reportForecast | 常量来源仍受预测形态业务规则约束 | actual/forecast role、统计月边界、图例和合计；不得悄悄降为普通柱图 |
| 折线、面积、堆叠折线 | 沿现有横轴逐点读取同一个值 | 平滑、面积、堆叠、数据缩放、数字标签、双轴格式 |
| 饼、环、compactRing | 每个已有类别的取值均为该常量 | 数值过滤、百分比、颜色按类别稳定、扇区与原始行点击身份一致 |
| 地图、散点、effect、regionalOverview | 已有地域行使用常量 | 值域、分档图例、tooltip、散点大小、层级筛选、固定摘要 |
| 仪表、mini | 当前值直接读取常量 | min/max、进度、数值格式、无 main 数据槽、点击动作 |

地图底图中没有业务数据行的地域不能自动被赋值；饼图也不能因声明一个常量就额外追加一个未声明类别。常量只替代配置项的取值来源，不隐含行集扩充。

地图 tooltip 等辅助展示入口需要在实施清单中逐项登记，不能只覆盖主 valueField。类别/名称的展示取值与用于匹配、下钻、地域识别的结构字段要分开审计；“适配所有图表”不能退化成只适配其中部分呈现分支。

## 6. 空数据、无数据源与交互

### 6.1 数据状态与无数据源情况

| 情况 | 目标规则 |
|---|---|
| 查询有行且字段正常 | 字段系列按行读取，常量系列按同一行集展开 |
| 查询有行但度量全为 null | 不等同零行；已有类别可支撑常量系列正常显示 |
| 查询成功且零行 | 读取图表级空态策略；default 保持既有空态，showConstants 仅呈现具备上下文的常量内容 |
| 全部必需取值为常量，且无需业务行身份 | 允许不声明组件 data；例如仪表应直接显示，不需要构造一个假的 inline 数据源 |
| 查询加载中或失败 | 保留既有状态和错误分类；不能因为存在常量就宣称查询成功或复用旧类别 |

当前 `renderableDataSnapshot` 会丢失 empty/error 的区别，因此图表级策略必须基于原始状态决定，再将受控结果交给纯渲染组件。不要从 `rows.length === 0` 反推查询成功空结果。

### 6.2 无业务行时缺少呈现上下文

空数据时“允许显示”不能单独决定线段端点、饼图类别或地域。仪表可直接显示；其他图表需要仍有效的横轴/类别/地域上下文。

本批保留既有横轴/类别/地域上下文，不新增独立域声明。无横轴折线仍为空图，地图无业务地域行时不额外赋值；仪表可以直接显示常量。空数据策略控制可呈现的常量内容，不承诺零类别时凭空绘制水平线。

### 6.3 常量不是行身份

常量系列沿真实行集展开时，可使用该点原有的横轴/类别行执行已声明的行交互；常量本身不生成一个字段名。不得因常量来源就一概丢失已有行上下文。

没有真实行的常量图形不制造业务数据行。无数据源仪表的固定动作复用既有无行事件上下文，字段引用仍受数据槽校验约束。仅依赖固定值、页面参数或筛选状态的动作可按现有能力处理；要求行字段的动作必须获得合法行上下文，否则拒绝或禁用。导航、详情、地图下钻和导出均需要覆盖这一差异。

## 7. 与现有架构决策及并行工作的关系

| 现有结论 | 本方案的关系 |
|---|---|
| [ADR-0003](../../adr/0003-strict-declarative-spec.md)：严格声明式 | 标量 JSON 常量兼容；不引入表达式、函数和任意求值 |
| [ADR-0013](../../adr/0013-format-belongs-to-component-field-binding.md)：格式归组件字段绑定 | 保留字段分支现状；常量新增消费位置展示语义，正式实施时需记录这项扩展 |
| [ADR-0022](../../adr/0022-page-data-sources.md)：页面数据源为 inline/query | 常量属于组件配置，不新增数据源类型；无数据源组件的依赖与宿主态属于本批新增职责 |
| [ADR-0051](../../adr/0051-additive-minor-versions-for-page-schema.md)：增量次版本 | 旧字段写法和默认空态保持；新增分支及使用能力检查。不得借机重命名旧 valueField 或移除旧页面读取 |
| [ADR-0071](../../adr/0071-four-release-artifacts-with-standalone-page-protocol.md)：协议归 page | 取值来源的类型与校验归 page，渲染读取归 engine，不让 Schema 依赖 ECharts/Svelte |
| [ADR-0110](../../adr/0110-hidden-echarts-presentation-options.md)：高级呈现不改数据结构 | echartsOption 现有保护继续有效；正式常量由基础图表翻译生成，不开放 series.data、markLine 或越界系列作为绕过路径 |
| 并行表格方案 `docs/plan/2026-10-26-table-tolerance-and-pinned-row.md`（不随本批复制） | 共享数据宿主态、格式和组件数据模块可能相交；本批不把 FieldBinding 全局扩成常量，避免顺带改变 rowKey、表格列和置顶行校验 |

已在 CONTEXT.md 增加“组件取值”，保留“组件字段绑定”的字段引用含义；[ADR-0119](../../adr/0119-component-values-can-use-constants.md) 记录取舍，并并入页面文档结构主题页。

## 8. 已冻结的实施裁决

| 项目 | 本批结论 |
|---|---|
| 来源声明 | series 使用 field/value；饼图、地图、仪表使用 valueField/value；都严格互斥 |
| 辅助展示 | 地图 tooltipFields 和 pinnedSummary.fields 使用 field/value；结构身份字段保持字段引用 |
| 空态 | 图表级 default/showConstants；保留原始来源状态，错误与加载不按成功空结果处理 |
| 格式和单位 | 常量显式 format/unit/currency/missingText；运行时不继承其他字段；金额格式与同轴语义严格校验 |
| 预测 role | 常量也执行预测边界；错误定位到 series 声明，不伪造查询行字段路径 |
| 无数据源 | 输入自足的仪表可省略 data；其他图表仍需 main 提供类别/地域身份 |
| 字段选择 | FieldBinding/FieldReference 不扩成常量；byFilter 保持原语义 |
| 类型切换 | 兼容图表保留常量来源；多系列到单值或无法保留轴分配时保持原图并返回原因 |

这些规则已落到协议、共享读取、运行时和创作操作，不再保留待定属性名或自动继承规则。

## 9. 实施顺序与验收

### P0：冻结输入位置和语义

- [x] 清点全部图表主取值、辅助展示、结构身份字段，给出明确的字段键/常量键映射。
- [x] 收口第 8 节的同轴语义、空图上下文、预测 role 和可省略 data 条件。
- [x] 冻结正式协议名称及决策记录，实施时读取最新 versionPolicy，不提前占用次版本。

### P1：公共协议与校验

- [x] 增加共享取值类型和 Schema；字段/常量互斥，覆盖 0、负值、null、非法类型、非有限数与错误路径。
- [x] 保留字段存在性、role、match、货币选择、单位和已有版本检查；新增常量消费位置校验。
- [x] data 可省略仅用于输入自足的组件；有字段引用仍必须有合法槽和结果字段契约。

### P2：统一运行时与共享读取

- [x] 共享解析、取值、展示信息和行上下文；不写入页面数据源或快照。
- [x] 基于原始宿主态处理空态策略，覆盖无数据源、零行、全 null、加载中和查询失败。
- [x] 更新 RuntimeSurface、ComponentRenderer、WidgetHost 所需协作；其他数据组件维持现状。

### P3：全图表与交互

- [x] 按第 5 节逐类型和变体验收，柱图的普通/堆叠/预测/混合分支分别检查。
- [x] 同步数据过滤、总量、标签、tooltip、轴、图例、地域摘要和散点；共享读取不能只停在 series.data。
- [x] 真实行点击和纯常量无行点击分别覆盖，导出消费同一捕获状态和取值规则。

### P4：创作、文档与独立分发

- [x] 工作台用已有组件完成字段/常量选择和输入，切换时删除另一分支；验证撤销、预览和类型切换。新增呈现若与现有样式冲突，按仓库规则先展示差异再审核。
- [x] 更新 PAGE-METADATA.md、字段绑定/取值说明及各图表模块；当前计划不能代替正式协议参考。
- [x] 从产品真源生成 contracts 和 metriccanvas-local-authoring 知识、示例、独立校验器及清单；常量不得作为用数需求或缺失字段上报。
- [x] 审计直接字段工具的 Python/TS 调用点；只对实际受影响行为回归，不默认扩展其他历史 Skill 或真实 DS 模型验收。

### 验收矩阵

按[功能与协议能力验收要求](../../agents/feature-acceptance.md)执行：

1. 在 pages/ 增加或扩展显式 `layout: "dashboard"` 的可运行场景，至少覆盖四种 ChartComponent 和仪表、常量 2、混合/双轴、零值、空数据两种策略及错误态。目录 README 写清入口和观察步骤。
2. 浏览器验证实际图形与图例/提示/点击/筛选更新，静态导出验证同一状态；失败/权限不能被常量掩盖。
3. 合法/非法契约向量、共享读取与运行态测试证明语义；保存旧页面回归，不能只验证新例子。
4. 仓外复制安装 local-authoring 后运行页面校验，检查知识、引用及哈希闭合。真实 DQE/Relay 和生产部署单列结果，不用 Sim 或单元测试代替。
5. 每次实际编码执行[复杂度规则](../../agents/code-complexity.md)，编码前识别职责，编码后测量修改函数及全部新增辅助函数；先测基线，不向已复杂的 componentErrors 或 RuntimeSurface 继续堆分支。

## 10. 实施结果与边界

实现位于隔离工作树 `/Users/moon/.codex/worktrees/chart-constant-values/DataDashboard`，基于 `ea40f664`。共享取值、五类图表、空态与导出、创作入口、协议/ADR/文档和独立 Skill 已完成；[实施结果](result.md) 保留命令、浏览器、PDF、复杂度和剩余项。

Playground 入口 `/pages/chart-constant-values-page`。页面和工作台浏览器均为本地合成输入；没有运行真实 DQE/Relay、DS 模型或生产部署。存量复杂度超限按原口径列出，没有声称全仓清零。本批按用户授权交付 main；CI 由完整提交 SHA 核对。

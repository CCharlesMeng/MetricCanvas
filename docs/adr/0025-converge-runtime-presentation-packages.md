---
status: accepted
---

# 表现层包边界按纯渲染职责收敛，widgets 只留页面组件

ADR-0024 把创作期包边界收敛到与运行时一侧同一标准，并在收敛中确立了两条可复用的判据:**真实消费者只有一个时，模块边界足以替代包边界**;**同一概念在两处各自定义即为真元归一违规**。本决策把同两条判据施加到表现层包 `packages/widgets` 内部——ADR-0024 当时把它列为「完整兑现 ADR-0006」的一侧，那是就依赖方向而言的,包内的能力归属没有被检视。

检视结论是:`widgets` 的 26 个源文件平铺在 `src/` 一层,包内已经形成 table、chart、metric、filter、host、markdown 六个互不交叉的高内聚簇,但这些簇只存在于 import 图里,不存在于目录结构上;同时包里住着三组文件,它们在包内零消费者,只服务包外。

本决策不改变页面协议、页面 Schema 与任何组件的渲染结果。

## 决策

**`widgets` 的职责收紧为「页面组件的纯渲染实现」。** `docs/frontend-runtime-capabilities.md` 的模块职责表早已把该包定义为「根据就绪数据和 props 绘制内容,上报交互事件」,不负责数据获取、筛选状态和页面导航;`CONTEXT.md` 的「纯渲染组件」词条同样规定只消费数据快照与字段契约。按这条职责线,以下三组文件迁出该包:

- **`WidgetHost` 与 `widget-host-state` 迁入 `runtime-ui`。** 它在 `widgets` 内零消费者,唯一使用者是 `RuntimeView`;它渲染的是 `DataSnapshot` 的 loading 与空态,即**数据态**,而它自身的职责恰恰是让组件「只经 ready 快照渲染」——它是执行这条边界的闸门,应站在闸门的运行时一侧。其原注释已记录它落在 `widgets` 是权宜之计,理由是「`runtime` 包框架无关(零 svelte 依赖)容不下 Svelte 组件」;该理由针对的是纯 TS 的 `packages/runtime`,而 `packages/runtime-ui` 正是 ADR-0002 所定的 Svelte 视图层,阻碍已不存在。
- **`DimensionFilter`、`TimeRangeFilter` 与筛选树逻辑迁入 `runtime-ui/filters`。** 职责表把「筛选控件」判给 `runtime-ui`,实现却在 `widgets`,属文档与代码漂移。领域上筛选器对应 `Page.filters`,不是 `sections[].components`,它们不是「组件」,留在 `components/` 之外又会让该包出现第二个不相干主题。
- **`SafeMarkdown` 与其解析模块迁入 `runtime-ui/ai-summary`。** 它在 `widgets` 内零消费者,唯一使用者是 `AiSummaryView`,存在的理由就是渲染 AI 总结正文。ADR-0019 要求 AI 总结垂直组件的 Host、会话、私有 Adapter 与纯渲染 View 在同一组件目录内高内聚分工,而正文渲染此前隔着一个包。迁入后该垂直模块完整。

**`aiSummary` 不进 `widgets`。** 该组件类型缺一个 `widgets` 实现不是缺口:按 ADR-0019 它是内化执行的**生成型**垂直组件,其 Host 依赖 `PageDataSnapshots`、其 Adapter 发起 SSE 请求并处理身份与 cookie。把它搬进 `widgets` 会让该包新增对 `runtime` 的依赖并首次出现网络代码,与上述职责线及 `CONTEXT.md` 的纯渲染组件定义直接冲突。`components/` 的完整性由「纯渲染」定义,不由「schema 组件类型全集」定义。

**`widgets/src` 按组件类型分目录,与 `page/src/schema/components/` 对齐。** 目录名取 schema 组件类型的 kebab 形式,`.svelte` 取其 PascalCase 形式,目录内 `.ts` 用角色词命名且不重复目录名(`table/columns.ts` 而非 `table/table-columns.ts`)。根目录只留唯一 barrel `index.ts`,沿用 ADR-0019 落地样板 `runtime-ui/ai-summary/` 的既有约定:kebab 子目录、组件子目录不建 barrel、测试保持 `tests/` 平铺并直达真实源码路径。

**共享内核只收被两个以上组件目录真实消费的部分。** `shared/` 放字段解析、格式化、ECharts 宿主与跨图表的 option 片段;单一组件私有的构造留在组件目录内(如面积渐变只在折线图、圆角只在柱状图、进度环只在指标卡)。这是 ADR-0019「只有出现真实的多组件共享能力时才提取公共 Module」在包内的应用,避免投机抽象。

**barrel 导出面收敛到真实消费面。** 原 24 个导出中,字段解析函数、数据槽投影类型、格式化函数与表头布局类型在包外均零引用。公开面显著大于真实消费面会放大后续结构调整的破坏半径,故只保留组件本身与统一运行时编排表格视图确需的纯函数与契约类型。

**顺带收掉三处真元归一违规。** 「数据值 → 有限数字」此前在格式化模块、表格 rateBar 与图表数据缺口处各有一份实现,统一为 `shared/value-format.ts` 的单一导出;地图的 `nameMap` 改名规则在 option 构造与点击回查中各写一遍,统一为一处;涨跌语义色的 hex 在指标卡、排行卡与表格样式中各写一份,改为引用运行时定义的 `--mc-color-positive` / `--mc-color-negative` token,沿用该仓已有的 `var(--token, fallback)` 写法。

## Consequences

- `widgets` 的依赖仍只有 `page`,包内不含网络代码,职责表与 `CONTEXT.md` 的纯渲染组件定义与代码一致,不需要修订文档。
- 「筛选控件归 `runtime-ui`」的文档与代码漂移由代码追上文档而消除。
- ADR-0019 的 AI 总结垂直模块首次在单一目录内完整。
- 对外零破坏:包外消费者只经 `@metriccanvas/widgets` 根出口导入,`package.json` 的 `exports` 仍只开 `"."`,全仓无深路径穿透。
- 新增一个页面组件类型的改动链路不变(仍需改 `page` schema、`runtime-ui` 的集中分发与 `widgets` 实现),但 `widgets` 一侧从「往平铺目录里再加两个文件」变为「新增一个自包含目录」。
- 统一数值判定顺带修掉一处潜在缺陷:`mapOption` 的 `visualMap` 取值区间此前会被任一非数值行的 `NaN` 污染整条色阶,现已有回归用例锁定。
- 遗留债务未在本决策内解决,记录于下节。

## 待决与遗留

**包名 `widgets` 与符号 `WidgetHost` 的术语归属。** ADR-0006 第 3 条把包名 `widgets` 的理由写为「取自规格字段,让读规格与读代码用同一个词」,但该规格字段自 ADR-0017 的 Schema 硬切换后已改为 `sections[].components`,根级 `widgets` 现被校验器作为旧版遗留字段显式拒绝;`CONTEXT.md` 全文无 `widget` 词条,正式术语是「组件」「纯渲染组件」。ADR-0006 的 Consequences 又明确要求「包名与词汇表绑定,词汇表术语变更需评估包/端口命名级联」,因此这是一笔由 ADR-0006 自己规定要偿还、但至今未偿还的欠账。本决策不代为改名:改名波及 `package.json`、跨包 import 与公开符号,且 `WidgetHost` 迁入 `runtime-ui` 后其名字里的 "Widget" 更为突出,应作为一次独立的命名决策处理。

**`Table.svelte` 的职责边界。** 该文件仍有约 990 行,排序状态机、分页页码窗口算法与 rateBar 列内聚合仍内联在组件里,与同目录已抽出的纯模块边界不一致;15 个 `.svelte` 组件当前零测试覆盖,与逻辑未抽干净是同一件事的两面。

**跨包真元归一。** `page` 包内 `DataRow` 与 `Row` 是同结构双名且消费方按文件分裂;`escapePointer` 在该包内有三份本地实现;运行时对外事件联合类型在 `runtime-ui` 与 `embed` 各定义一份。三者权威方均不在 `widgets`,不在本决策范围。

**四个图表的标题样式仍逐字重复。** 按组件类型分目录后该重复跨目录,去重需要引入共享标题组件,会改动组件 DOM 结构,而这些组件尚无测试保护,故不在本次一并处理。

## Considered Options

- 把 `aiSummary` 整体搬进 `widgets/components/`,使该目录覆盖全部 schema 组件类型:需要 `widgets` 新增 `runtime` 依赖与网络能力,并修订 `CONTEXT.md` 与职责表对纯渲染组件的定义,以「目录看起来完整」换取职责线破损,不采用。
- 保留 `WidgetHost`、筛选控件与 `SafeMarkdown` 在 `widgets`,只在包内重组目录:三者在包内零消费者,留下会使「纯渲染组件包」的职责线继续含混,且筛选控件的文档漂移得不到消除,不采用。
- 为共享内核新建 `shared/` 之外的角色目录(如 `primitives/` 与 `atoms/` 分列):该仓无此先例,且会为四个文件引入两个新词,不采用。
- 三个折柱饼图合为一个 `charts/` 目录以对齐 `page/src/schema/components/charts.ts` 的文件粒度:锚点取组件**类型**比取 schema 的文件切分更稳定,且合并后新增图表类型仍需改动共享文件,不采用。
- 一并抽取共享标题组件与拆分 `Table.svelte`:两者都改动组件 DOM 或状态机,而受影响组件零测试覆盖,与本次「结构调整可由既有测试与类型检查完整验证」的前提不符,记为遗留。

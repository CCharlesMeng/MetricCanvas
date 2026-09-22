# 分区容器与通用行对齐设计

## 背景

内容分区的外观此前由多处信息共同决定：Schema 里的 4 个业务命名 `section.variant`、`RuntimeSection` 中 6 组按组件组合与子组件 `props.variant` 的推断 class，以及固定为 `{ type: "grid", columns: 12 }` 却仍要求声明的 `section.layout`。同一事实存在多个真源，页面 JSON 无法直接说明最终布局，更换子组件表现可能意外改变父级外观，违反真元归一与 ADR-0021。

排行明细的行高同步实现 `sync-ranking-detail-row-heights.ts` 硬编码纯渲染组件内部 class（`.ranking-detail-cell`、`.ranking-detail-row`），只在 `reportCustomerAnalysis` 分区启用，且直接写入子组件 DOM 的 `min-height`，违反 DOM 所有权。行高同步是普遍诉求（排行、表格、指标明细都可能成对比较），不应是排行特例，也不应引入页面 JSON 的 `family` 字符串。

## 方案

### 分区容器（Section Container）

页面协议升级到 Schema 5.0：

- 删除 `section.variant` 与 `section.layout`。12 列 Grid 是统一运行时不变量，不再进入页面文档；组件宽度仍由 `layout.span` 表达。
- 新增可选 `section.container`，封闭三档、命名表现中性：
  - `plain`：无容器，组件完全自带外观（报告头、摘要指标卡行、分隔标题）；
  - `panel`：渐变章节面板 + 居中图标标题 + 内层白底承载网格（报告章节）；
  - `card`：白色小节卡片 + 左对齐小标题（章节内的分析小节）。
- 缺省（不声明 `container`）保持通用看板外观：白色分区 + 角标标题 + 带边框的组件单元格。
- `RuntimeSection` 删除全部组合推断与子组件 `props.variant` 穿透读取；外观只由 `container` 决定，三档下单元格一律无镶边（chromeless），组件自带表面。
- 两个正式页面的章节外观统一为 `panel` 一档（原 `reportOverview` 与 titled 推断两种章节样式合并，间距取 12px 网格间距，保留内层白底与图标标题），`reportCustomerAnalysis`/`reportDimensionAnalysis` 合并为 `card` 一档。视觉基线随之重建。
- 原 `reportHeading` 分区的大标题样式内化为 `text` 组件新 variant `heading`（32px 居中 + 两侧装饰图标由组件自绘），分区本身用 `plain`。
- `connectPrevious` 保留现状（ADR-0021 已认可的通用语义）；出现真实的内部协作需求前不封装组合式深 Module。
- 迁移是一次性硬切换：旧推断逻辑只在迁移时执行最后一次，把每个分区的现状归类写成显式 `container`，随后推断代码删除。

### 通用行对齐（Row Alignment）

行高同步成为统一运行时不变量，不进入页面 JSON：

- 对齐契约放在 `packages/widgets/src/shared/row-alignment.ts`：具备能力的纯渲染组件发布 `{ anchor, measure(), apply() }`——组件自己测量自己的行轨自然高度、自己把逐轨最小高度写回自己的 DOM；内容变化（如明细展开收起）通过句柄 `changed()` 主动告知。统一运行时从头到尾不触碰组件内部 DOM。
- 深 Module `packages/runtime-ui/src/row-alignment.ts` 独占分组、测量调度、RAF 合帧、ResizeObserver、fonts 就绪与清理：按自己拥有的单元格 rect 判定同一视觉行，按单元格上自己渲染的 `data-component-type` 与 `data-component-variant` 判定兼容（同类型且同 variant 才同步），响应式堆叠成单列后自动复原。
- 触发规则：同一父 Grid、同一视觉行内、同 type 同 variant、已发布对齐能力的 ≥2 个组件，按轨道序号对齐，取各轨最大自然高度。
- 首批只有 `rankingDetailCard` 发布对齐能力；`table` 等组件确认视觉后再接入。
- 删除 `sync-ranking-detail-row-heights.ts`。

## 边界

- 不新增业务布局类型、`family` 字符串、`group` 层级或递归布局；页面树保持 分区 → 组件 两层。
- 不在 JSON 暴露 padding、gap、surface、titleAlign 等样式轴；`container` 新档位必须证明"结构上不可区分且视觉上必须不同"才能增加。
- 行对齐不跨分区、不跨视觉行、不跨组件类型；单参与者不做任何事。
- 数据流不变：布局树不加工或转发业务数据。

## 验收标准

- Schema 5.0 拒绝 `section.variant`、`section.layout` 与未知 `container` 值；全部在库页面、fixture 与示例迁移到 5.0 并通过 `pnpm validate`；
- 除 `id` 外相同的页面元数据仍产生相同 DOM 与计算样式（ADR-0021 门禁不回归）；
- `runtime-ui` 源码不含纯渲染组件内部 class 选择器；行对齐仅通过发布的契约协作；
- 流水分析报告：客户视角两张排行卡同视觉行时逐行等高，窄屏堆叠后复原；
- 客户活动风险简报：主表-明细表 `connectPrevious` 行为不变；
- 赛道/产业视角单表分区不触发任何对齐行为；
- `pnpm validate`、`pnpm test`、`pnpm check`、`pnpm test:embed` 通过，视觉走查确认两页新基线。

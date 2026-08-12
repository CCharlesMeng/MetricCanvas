---
status: accepted
---

# 分区容器单一真源与行对齐运行时不变量

内容分区的外观此前由三处信息共同决定：Schema 的 4 个业务命名 `section.variant`（`reportOverview` 等）、统一运行时按组件组合与子组件 `props.variant` 推断的 6 组分区样式，以及固定为 12 列却仍要求声明的 `section.layout`。同一事实存在多个真源，页面 JSON 无法直接说明最终布局，更换子组件表现可能意外改变父级外观。真正不可从结构派生的差异只有一位信息——两组结构相同的无标题指标卡行，一组裸排、一组要共享面板——因此把这一位信息收敛为唯一声明。

页面协议升级为 `schemaVersion: "5.0"`（硬切换，存量文档在库内一次性迁移，旧推断逻辑在迁移时执行最后一次后删除）：

- 删除 `section.variant` 与 `section.layout`。12 列 Grid 与组件 `layout.span` 的语义是统一运行时不变量，列数不进入页面文档。
- 新增可选 `section.container`，封闭三档、命名表现中性：`plain`（无容器，组件自带外观）、`panel`（渐变章节面板 + 居中图标标题 + 内层白底）、`card`（白色小节卡片 + 左对齐小标题）。缺省保持通用看板外观（白色分区 + 带边框组件单元格）。
- 三档容器下组件单元格一律无镶边，表面由纯渲染组件自带；原 `reportOverview` 与标题推断两种章节外观合并为 `panel` 一档，原两个分析类 variant 合并为 `card` 一档，视觉基线随之重建。
- 原 `reportHeading` 的大标题样式内化为 `text` 组件 variant `heading`，由组件自绘图标与排版。
- 新增 `container` 档位必须证明"结构上不可区分且视觉上必须不同"，防止枚举退化回业务配方。
- `connectPrevious` 保留（ADR-0021 已认可的通用语义）；出现真实的内部协作需求前不为主表-明细表封装组合式深 Module。

行高同步从"排行特例 + 分区 variant 触发 + 穿透组件 DOM"改为通用的**行对齐运行时不变量**，页面 JSON 零新增：

- 对齐契约（`widgets/shared/row-alignment.ts`）：具备能力的纯渲染组件发布 `{ anchor, measure(), apply() }`，自己测量、自己写回自己的 DOM；内容变化经句柄 `changed()` 告知。
- 深 Module（`runtime-ui/row-alignment.ts`）独占分组、调度、观察与清理：以自己拥有的单元格 rect 判定同一视觉行，以单元格上自己渲染的 `data-component-type`/`data-component-variant` 判定兼容。
- 触发规则：同一父 Grid、同一视觉行、同类型且同 `props.variant`、已发布能力的 ≥2 个组件，行轨按序号取最大自然高度对齐；响应式堆叠成单列后自动复原。统一运行时不出现任何组件内部选择器。
- 首批只有 `rankingDetailCard` 发布能力；其他组件确认视觉后再接入。

## Considered Options

- 继续扩展分区 `variant` 或按组件组合推断父级布局：多真源且名字含糊，被 ADR-0021 与本决策共同否决。
- 在 JSON 暴露 padding、gap、surface、titleAlign 等样式轴：退化为自由样式 DSL，拒绝。
- 完全由结构派生外观（标题有无、树深度）：被"裸排指标卡行 vs 面板指标卡行"这一结构不可区分的反例证伪。
- 引入 `group` 层级或 `rows`/`stack` 递归布局：当前没有需要独立 DOM 所有权的场景，页面树保持分区 → 组件两层。
- 行对齐用页面 JSON 的 `family` 字符串或业务性 `rankingComparison` 组合：把普遍能力钉死在业务命名上，拒绝。
- 行对齐在父级显式声明 `align` 标记：可预测性略高，但为普适行为向每个对比对征税；与"columns 恒为 12"同类的规则放代码不放 JSON，必要时可加显式开关，方向可逆。
- CSS subgrid 共享行轨：原生 `<table>` 无法加入外层 Grid 轨道，组件内部多层带 padding 的包装必须全部改为 subgrid 等于反向规定组件内部结构，且父级需要数据行数才能声明轨道数，拒绝。

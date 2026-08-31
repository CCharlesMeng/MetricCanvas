# 验收摘要

**可验收**：本次检视没有阻断级问题，也没有需要你决定的事项。

## 需要你处理

### 1. 新范式：Page Metadata 保持 Section → Component，不新增中间实体。运行时根以 mc-runtime 承载页面壳与工具栏响应；RuntimeSection 为每个 Component 生成的 DOM 布局盒以 mc-component-box 承载 Widget 容器响应。该布局盒是运行时实现细节，共享运行时与 Widget 不读取全局 viewport。；依据样本 5 处

- **类型**：规范候选
- **你的决定**：采纳：Page Metadata 保持 Section → Component；mc-component-box 仅表示 RuntimeSection 为 Component 生成的 DOM 布局盒，不新增元数据实体。（2026-08-31）
- 理由：中间层的 Grid 落位、创作态安装点、卡面和容器查询都是运行时职责，不构成独立领域概念。

### 2. 规范不再成立：columnTracks 是跨组件比例的 Page Metadata 真源；组件根恒占满 RuntimeSection 依据 component.layout 生成的组件布局盒，不复制页面列宽、页面 id 或布局形态。Widget 内部若有固有内容宽度，应由自身内容声明派生，不得复制页面设计结果。（质疑 COMP-5）；依据样本 5 处

- **类型**：规范候选
- **你的决定**：采纳：columnTracks 负责跨组件比例，Widget 根不保存页面派生宽度；宽表的内容下限由自身列声明汇总得出。（2026-08-31）
- 理由：组件只应依赖自身输入与所在容器，不应复制 450px、1168px、1632px 等特定页面的设计结果。


## 这次判了什么

已判并通过：还原检视、布局检视、规范检视、质量检视。

**主动少判了这些，理由如下：**
- 导航：classify_diff 命中的导航文件包含开工前既有未提交改动；本 Story 在 Canvas 路由中的所有权仅限 dashboard 外框宽度样式，未改变路由、入口或查询参数。

## 顺带改到的文件（计划外承接）

| 文件 | 属哪个 Task | 为什么必须一并改 |
| --- | --- | --- |
| packages/runtime-ui/src/RuntimeView.svelte | Task 2 | 质量复审证明 Section 需要稳定的宿主级 inline-size 容器，必须由运行时根建立 mc-runtime 边界。 |
| packages/runtime-ui/src/dashboard/DashboardToolbar.svelte | Task 2 | IOC compact 工具栏仍读取全局 viewport；同一宿主宽度下会产生隐性联动，需随宿主容器规则一并迁移。 |
| packages/widgets/src/components/metric-card/MetricCard.svelte | Task 2 | IOC 概览与机会分析复用该 Widget，其窄宽规则必须统一读取运行时组件布局盒 mc-component-box。 |
| packages/widgets/src/components/map-chart/MapChart.svelte | Task 2 | IOC 项目概览复用该 Widget，图例回流必须由运行时组件布局盒而非外部 viewport 决定。 |
| packages/runtime-ui/tests/project-detail-responsive.test.ts | Task 2 | 原测试冻结了父网格读取子 variant 的旧契约，需改写为两级命名容器与禁止 viewport 媒体查询的静态契约。 |
| packages/widgets/tests/composite-card-surface.test.ts | Task 2、Task 3、Task 4 | 原测试冻结了固定宽度与页面派生媒体查询，需改写为 Widget 只读取组件布局盒的回归契约。 |

## 交 sdd-init-frontend 的规范候选

| 编号 | 类别 | 质疑对象 | 结论 | 现象 | 依据样本 |
| --- | --- | --- | --- | --- | --- |
| NC-1 | 新范式 |  | Page Metadata 保持 Section → Component，不新增中间实体。运行时根以 mc-runtime 承载页面壳与工具栏响应；RuntimeSection 为每个 Component 生成的 DOM 布局盒以 mc-component-box 承载 Widget 容器响应。该布局盒是运行时实现细节，共享运行时与 Widget 不读取全局 viewport。 |  | packages/runtime-ui/src/RuntimeView.svelte、packages/runtime-ui/src/RuntimeSection.svelte、packages/runtime-ui/src/dashboard/DashboardToolbar.svelte、packages/widgets/src/components/metric-card/MetricCard.svelte、packages/widgets/src/components/map-chart/MapChart.svelte |
| NC-2 | 规范不再成立 | COMP-5 | columnTracks 是跨组件比例的 Page Metadata 真源；组件根恒占满 RuntimeSection 依据 component.layout 生成的组件布局盒，不复制页面列宽、页面 id 或布局形态。Widget 内部若有固有内容宽度，应由自身内容声明派生，不得复制页面设计结果。 |  | pages/ioc-project-detail.json、packages/runtime-ui/src/RuntimeSection.svelte、packages/widgets/src/components/report-header/ReportHeader.svelte、packages/widgets/src/components/key-value-panel/KeyValuePanel.svelte、packages/widgets/src/components/composite-card/CompositeCard.svelte |

## 要往下追的话

- 冻结的验收基线：`dev-baseline.md`
- 逐条声明与它的证据：`alpha-tests.md`
- 全部覆盖明细与结构化结论：`review-results.json`（共 2 条交接项、0 条判定不适用）

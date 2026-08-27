# IOC 项目地图首页还原度改进规划

## 状态与用途

- 状态：规划完成，等待新会话建立正式 SDD Story 后实施。
- 本文件是跨会话实施交接，不是 `sdd-task-frontend` 生成的正式 `tasks.md` 或 `alpha-tests.md`。
- 本轮只记录决策、实施接缝、文件职责和候选验收契约，不修改产品代码，也不修改已验收的 IOC-S2 Story。
- 新会话必须先创建独立 Story，并基于本规划冻结设计事实、`story-delta-spec.md`、`tasks.md` 与 `alpha-tests.md`，之后才能改代码。

## 依据

- 设计事实：`docs/design-facts/project-overview.json`
- 当前页面：`pages/ioc-project-overview.json`
- 已验收旧 Story：`DataDashboard-sdd/requirements/ioc-operation-map-restore/stories/schema52-project-map-wip-closeout`
- 旧 Story 仅作为历史证据来源，不在本次改进中重新打开或改写。
- 当前浏览器勘察事实：
  - 1920px 视口下，地图容器约为 `y=233.7..1079.7`。
  - 地图 `safeArea` 相对容器约为 `x=613.3, y=280, width=1258.7, height=566`。
  - 当前图例页面位置约为 `x=645.3, y=964.7..1071.7`，实际锚定在 `safeArea` 左下角，而不是投影地图内容左侧。

## 问题陈述

上一轮验收覆盖了页面结构、卡片横向排列、卡片高度和遮挡关系，但没有冻结以下视觉契约：

1. 顶部区域是否符合 dashboard 场景。当前页面强行复用 `ReportHeader`，导致标题、筛选器和报告功能被拆成不合适的两层结构，外观与功能都偏离设计稿。
2. `CompositeCard` 内部内容是否按设计稿形成明确的指标、环图、分类列表、仪表盘和计数器组合。当前验收只证明“组件存在且卡片约 280px 高”，没有证明内部视觉几何关系正确。
3. 地图图例是否相对实际投影内容定位。当前验收只证明图例没有越界或遮挡，没有证明它紧贴地图内容左侧。

本次 Story 的目标是扩展以上验收契约，而不是重做整个项目地图首页。

## 已确认决策

1. 保留 `CompositeCard`。
   - 它是页面元数据中的组合编排 Module，Interface 继续负责标题、列跨度、分隔线、卡片表面和内部 12 列自动布局。
   - 它不识别具体子组件类型，不包含按 `MetricCard`、`PieChart` 等类型分支的 Implementation。

2. 不新增一个大一统的 `DashboardSummaryCard`。
   - 指标、环图、分类列表、仪表盘和计数器保持为独立叶子 Module。
   - 页面元数据继续显式组合这些 Module，使每块内容可以独立演进和测试。

3. dashboard 首页不再渲染 `ReportHeader`。
   - 页面标题属于页面级元数据，而不是某个可见报告组件。
   - runtime 为 `layoutForm: dashboard` 提供专用 `DashboardToolbar`，统一承载标题和筛选器。
   - report 页面继续使用 `ReportHeader`，两种场景不混用。

4. 地图图例锚定实际地图投影矩形。
   - `safeArea` 仍是布局输入，但图例不再直接锚定 `safeArea` 左下角。
   - 地图选项与图例位置共享同一个“投影矩形”纯几何事实，避免两套算法漂移。

5. 不添加页面 ID 条件分支。
   - 所有差异通过页面布局形态、组件显式 variant 和通用几何 Interface 表达。

6. `meta.title` 作为向后兼容的 5.2 页面元数据扩展处理。
   - 旧页面不提供时仍可解析并使用兼容回退。
   - 不因这一个可选描述字段提升页面 Schema minor version。

## Module 与 Seam 设计

### 1. 页面标题与 DashboardToolbar

数据流：

```text
page.meta.title
       │
       ├── page-list-entry：列表标题优先读取 meta.title
       │                    兼容回退到首个 ReportHeader，再回退到 page id
       │
       └── RuntimeView(layoutForm=dashboard)
                         │
                         └── DashboardToolbar
                              ├── 页面标题
                              └── FilterBar（保留现有筛选交互）
```

- `DashboardToolbar` 是 runtime-owned Module。
- 它的 Interface 只接收标题和页面已有筛选配置/状态；不复制筛选逻辑。
- `FilterBar` 仍负责筛选项、交互状态和动作派发，作为工具栏内部可复用 Module。
- `ReportHeader` 保持 report 场景 Interface，不增加 dashboard 特例。
- `pages/ioc-project-overview.json` 写入页面标题并移除 header section；现有筛选器及其交互保持不变。

候选视觉契约：

- 1920px 基准下，标题与筛选器位于同一约 80px 高的工具栏。
- 标题相对工具栏左侧约 32px、顶部约 22px，字号/行高约为 `24px/36px`。
- 标题文案为“全球/区域作战地图”。
- 不出现报告描述、报告动作或为 report 场景准备的空占位。
- 缩窄视口时工具栏允许自然换行或切换紧凑排列，不遮挡第一行卡片。

涉及文件及职责：

- `packages/page/src/schema/page.ts`
  - 为页面 `meta` 增加可选 `title`，保持旧页面兼容。
- `packages/page/src/page-list-entry.ts`
  - 列表标题优先读取 `meta.title`，保留旧回退链。
- `packages/page/tests/page-list-entry.test.ts`
  - 覆盖新标题、旧 `ReportHeader` 回退和 id 回退。
- `packages/runtime-ui/src/dashboard/DashboardToolbar.svelte`（新增）
  - 实现 dashboard 标题与筛选器的统一布局。
- `packages/runtime-ui/src/RuntimeView.svelte`
  - 根据页面布局形态组合 `DashboardToolbar`，不检查页面 ID。
- `packages/runtime-ui/src/filters/FilterBar.svelte`
  - 只做适配工具栏所需的通用尺寸/布局 Interface，不接管标题。
- `pages/ioc-project-overview.json`
  - 写入 `meta.title`，删除 `ReportHeader` section，保留筛选器。
- `packages/runtime/tests/ioc-project-overview.test.ts`
  - 固化页面不再声明 `ReportHeader`、标题存在、筛选交互仍在。
- `PAGE-METADATA.md`
  - 记录页面级标题语义及兼容回退。

### 2. CompositeCard 与紧凑叶子 Module

`CompositeCard` 只提供外壳和编排 Leverage：

- 标题区。
- 卡片表面。
- 内部 12 列网格与 `span`。
- 分隔线。
- 紧凑内容可消费的密度/颜色/间距上下文变量。

叶子 Module 各自拥有视觉 Implementation：

| Module | 显式展示 Interface | 职责 |
| --- | --- | --- |
| `MetricCard` | 新增 `compactStrip`、`compactStack`；保留现有 `compactSummary` 兼容 | 数值、单位、标签、同比/环比及横排或窄列基线 |
| `PieChart` | 新增 `compactRing` | 小尺寸环图、中心文本及与图例的相对布局 |
| `CategoryBreakdown` | 新增 `compactList` | 紧凑分类色标、名称、数值和行距 |
| `Gauge` | 新增 `mini` | 小尺寸仪表、中心值与阈值表达 |
| `KeyValuePanel` | 新增 `counterStrip` | 评审类计数器的横向等分排列 |

约束：

- 页面元数据不暴露 `MetricValue`、`MetricLabel`、`Divider` 这类微型公共组件；它们如有必要，只作为叶子 Module 的私有 Implementation Seam。
- `CompositeCard` 不根据 child type 注入不同 DOM 或 CSS 分支。
- 叶子 Module 的 variant 是有限枚举，不使用任意 class 名或页面私有样式字符串。
- `compactSummary` 继续接受并保持既有页面行为；项目地图首页改用含义明确的新 variant。
- 容器查询可以作为 Implementation 手段，但不能替代页面元数据中的明确展示意图。

首页三张卡片的组合配方：

1. 商机卡：`MetricCard.compactStrip` + `PieChart.compactRing` + `CategoryBreakdown.compactList` + `Gauge.mini`。
2. 项目分层卡：`MetricCard.compactStack` + `PieChart.compactRing` + `CategoryBreakdown.compactList` + `MetricCard.compactStrip`。
3. 评审卡：`MetricCard.compactStrip` + `KeyValuePanel.counterStrip`。

候选视觉契约：

- 1920px 基准下仍保持三卡横排、约 `4/4/3` 栅格跨度和约 280px 高度。
- 每张卡的内部行分组、分隔线位置和内容基线与设计事实一致。
- 数值、单位、标签和趋势不互相挤压；同一指标组的数值基线一致。
- 环图、图例和分类列表形成单一视觉组，不出现图表悬空或图例远离。
- 子 Module 不再绘制与 `CompositeCard` 重复的卡片表面、阴影或外边框。
- 1920、1366、1280px 视口下三张卡视觉比例稳定；760px 下进入自然纵向流，不横向溢出。

涉及文件及职责：

- `packages/page/src/schema/components/metric-card.ts`
  - 增加明确的紧凑横排/窄列 variant，并保留旧 variant。
- `packages/page/src/schema/components/charts.ts`
  - 为 `PieChart` 增加 `compactRing` Interface。
- `packages/page/src/schema/components/gauge.ts`
  - 为 `Gauge` 增加 `mini` Interface。
- `packages/page/src/schema/components/key-value-panel.ts`
  - 为 `KeyValuePanel` 增加 `counterStrip` Interface。
- `packages/page/src/schema/components/category-breakdown.ts`
  - 为 `CategoryBreakdown` 增加 `compactList` Interface。
- `packages/page/src/schema/components/composite-card.ts`
  - 仅在 variant 契约或白名单校验需要时修改；不得加入 child type 布局知识。
- `packages/widgets/src/components/composite-card/CompositeCard.svelte`
  - 只维护外壳、网格、分隔线和共享上下文变量。
- `packages/widgets/src/components/metric-card/MetricCard.svelte`
  - 实现指标条与窄指标列。
- `packages/widgets/src/components/pie-chart/PieChart.svelte`
- `packages/widgets/src/components/pie-chart/options.ts`
  - 实现紧凑环图的 DOM 与图表选项几何。
- `packages/widgets/src/components/category-breakdown/CategoryBreakdown.svelte`
  - 实现紧凑分类列表。
- `packages/widgets/src/components/gauge/Gauge.svelte`
  - 实现迷你仪表盘。
- `packages/widgets/src/components/key-value-panel/KeyValuePanel.svelte`
  - 实现计数器条。
- `pages/ioc-project-overview.json`
  - 用显式 variant 重组三张卡，保留 `CompositeCard`。

需要扩展的测试面：

- 页面组件 schema/contract 测试。
- `MetricCard` variant 测试。
- `PieChart` options 测试。
- `Gauge`、`CategoryBreakdown`、`KeyValuePanel` 渲染测试。
- `CompositeCard` surface 与组合集成测试。
- 首页页面元数据回归测试。

### 3. 地图投影矩形与图例锚点

当前根因：

- `MapChart.svelte` 使用覆盖整个 `safeArea` 的 legend positioning frame。
- `.map-legend` 再通过 `left: 8px; bottom: 8px` 定位，因此图例落在 `safeArea` 左下角。
- 地图投影实际使用 `min(safeArea.width, safeArea.height)` 的方形并居中，投影内容左边缘与 `safeArea` 左边缘不是同一位置。

目标数据流：

```text
safeArea
   │
   └── projectionRect(safeArea) 纯函数
          ├── mapOption：设置 geo/map 的实际几何
          └── legend frame：锚定投影内容左侧并约束垂直范围
```

- `projectionRect` 是地图 Module 内共享的纯几何 Interface。
- 地图 option 与图例定位必须消费同一个返回值，不重复计算投影方形。
- 图例仍采用正常 DOM，以保持可访问性和响应式能力。
- 移动端可以回到地图之后的正常文档流；桌面端才采用投影矩形内的定位。

候选验收契约：

- 1920、1366、1280px 下，图例左边缘紧邻实际地图投影内容左边缘，而不是 `safeArea` 左边缘。
- 图例整体位于地图投影内容的垂直范围内。
- 图例不与顶部卡片、地图 Tab 或底部表格重叠。
- 760px 下图例处于正常流并完整可见，不产生横向溢出。
- 地图投影与图例定位不包含项目地图页面 ID 分支。

涉及文件及职责：

- `packages/widgets/src/components/map-chart/options.ts`
  - 提供/消费共享投影矩形，并据此生成地图选项。
- `packages/widgets/src/components/map-chart/legend.ts`
  - 由共享投影矩形生成 legend frame/position style。
- `packages/widgets/src/components/map-chart/MapChart.svelte`
  - 组合投影结果与图例 DOM，不再直接把图例锚定到整个 `safeArea`。
- `packages/widgets/src/components/map-chart/map-chart-options.test.ts`
  - 验证不同 `safeArea` 比例下的投影矩形和地图几何。
- `packages/widgets/src/components/map-chart/map-chart-legend.test.ts`
  - 验证图例相对投影矩形的锚定、边界和移动端策略。

## 正式 Story 建议拆分

新会话运行 `sdd-task-frontend` 时，按“一项任务只承载一种主要变更形态”拆分：

1. 页面标题契约与列表回退链（logic）。
2. DashboardToolbar、首页 header 移除与视觉还原（restore）。
3. 紧凑叶子 variant 的 schema 契约与纯选项逻辑（logic）。
4. 五类紧凑叶子 Module 与首页三卡组合还原（restore）。
5. 地图共享投影矩形及几何测试（logic）。
6. 图例消费投影矩形并完成相对位置还原（restore）。

正式任务应为每一项声明：

- 变更形态与主要风险。
- 具体文件和每个文件的单一职责。
- 对应的 GWT 功能声明。
- 最小充分验证命令。
- 需要回归的共享消费者。

## 验证矩阵候选

正式 Story 冻结时，将以下内容写入 `alpha-tests.md`：

| 维度 | 验证内容 |
| --- | --- |
| schema | 新可选页面标题、五类 variant、旧页面和旧 variant 兼容 |
| runtime | dashboard 使用工具栏；report 继续使用 `ReportHeader`；筛选交互不回退 |
| widget | 各紧凑叶子 Module 的结构、选项和响应式行为 |
| map geometry | 投影矩形在宽/高不同 safeArea 中都与地图 option、图例一致 |
| page contract | 首页无 `ReportHeader`、保留 `CompositeCard`、三卡配方正确 |
| visual | 1920px 设计基准截图和关键区块 rect/关系断言 |
| responsive | 1366、1280、760px，无溢出、遮挡或内容脱离 |
| regression | report 页面、其他 `CompositeCard`、其他地图页面行为保持不变 |

视觉验收不能只比较整页截图；至少分别冻结以下区块：

- dashboard 顶部工具栏。
- 三张 `CompositeCard` 的内部内容区。
- 地图投影与图例关系区。

## 非目标

本 Story 不处理：

- GraphQL 或真实后端数据接入。
- 筛选枚举来源改造。
- 地图行政区代码解析或地理数据源变更。
- 项目级别筛选新增。
- 图标/资产体系重构。
- 项目详情页、列表页的功能或视觉重做。
- `CompositeCard` 的删除或替换。

共享 Module 的变更必须回归相关页面，但回归不等于扩张本 Story 的产品范围。

## 风险与回退策略

1. 页面标题契约影响页面列表。
   - 用 `meta.title → ReportHeader → page id` 的明确回退链保持兼容。
   - 若 dashboard toolbar 还原失败，可仅回退 runtime 组合，保留兼容的元数据字段。

2. 新 variant 影响共享 widget。
   - 所有新视觉都通过新增枚举值启用，默认和旧 variant 不改语义。
   - 回退时只需把首页元数据改回旧 variant，不删除兼容契约。

3. `CompositeCard` 再次吸收叶子知识。
   - code review 必须检查是否出现 child type 分支或页面 ID 分支；出现即拒绝合入。

4. 地图 option 和图例几何再次漂移。
   - 二者必须依赖同一个 `projectionRect` 结果；测试同时断言两端消费关系。

5. 只在 1920px 下视觉正确。
   - 视觉基准以 1920px 为主，同时把 1366、1280、760px 列为强制回归视口。

## 新会话启动清单

1. 阅读本文件、`docs/design-facts/project-overview.json`、当前首页元数据和相关 widget/runtime 实现。
2. 在 SDD 工作区为本次改进创建新的独立 Story，不修改 IOC-S2 已验收目录。
3. 将本规划中的设计事实转成冻结的 `story-delta-spec.md`，重点补齐顶部工具栏、卡片内部和地图图例三类视觉契约。
4. 使用 `sdd-task-frontend` 生成正式 `tasks.md` 与 `alpha-tests.md`，按上述六项任务拆分。
5. 使用 `sdd-dev-frontend` 实施，先做逻辑契约与红灯，再做视觉还原与浏览器证据。
6. 完成后使用 `sdd-review-frontend` 分别执行 restore、layout、convention、quality、test 五个 lens。

建议新会话开场指令：

> 阅读 `docs/plan/ioc-project-overview-fidelity-refinement.md`，为该改进创建新的 SDD Story，并使用 `sdd-task-frontend` 生成正式任务和验收账本；确认后再使用 `sdd-dev-frontend` 实施。不得修改已验收的 IOC-S2 Story。保留 `CompositeCard`，不新增大一统卡片组件。

## 本轮执行记录

- 只新增本规划文件。
- 未修改产品代码、页面元数据或旧 SDD Story。
- 未运行测试或浏览器验证。

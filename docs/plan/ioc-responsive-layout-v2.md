# IOC 响应式布局 V2 方案

> 状态：Implemented（2026-08-31）。三层宽度所有权、全组件响应契约门禁与 IOC 1980px 回归已落地。
>
> 范围：统一运行时、全部 17 种 Page Component、全部已声明 variant、组合卡与 Tab 的嵌套组件，以及四个 IOC 页面。

## 1. 结论

现有四层宽度所有权继续保留：宿主提供可用宽度，页面的布局形态决定外框，内容分区分配顶层组件布局盒，组件只负责盒内呈现。需要推翻的是“保留旧 viewport 数值，只把 `@media` 改成 `@container`”这条迁移方法。

V2 使用三个响应输入，并严格限制消费者：

| 响应输入 | 建立者 | 唯一消费者 | 负责的变化 |
| --- | --- | --- | --- |
| `mc-runtime` | `RuntimeView` | `runtime-ui` 的页面外框、工具栏、筛选栏、内容分区 | 页面级和跨组件排布 |
| `mc-component-box` | 直接布局所有者：`RuntimeSection`、`CompositeCard`、`TabContainer` | 该盒内的直接 Page Component | 组件自身的内部排布 |
| 匿名 self container | 确有局部排布需求的组件根或内部区域 | 该组件自己的后代 | 图形、指标行等局部细节 |

不新增 Page Metadata 字段，不向组件传 `desktop` / `mobile` / `density`，不把断点注册成运行时配置。断点属于具体组件 variant 的 Implementation；页面和调用方只看到原有 props 与数据槽 Interface。

## 2. 已确认的失败模式

旧规则的参照物是 viewport，迁移后变成组件布局盒。`viewport <= 760` 与 `component box <= 760` 不是同一条件。

在 CSS 1980px 下，机会分析页顶部分区按 `[2, 2, 3, 3]` 正确得到四列，但第三、第四张组合卡各自只有约 565px。通用的 `CompositeCard <= 760` 规则因此把卡内三个 `span: 4` 子组件改成单列。项目概览三张组合卡的组件布局盒也都小于旧阈值，受到同类影响。

这证明问题不是某一页的 `columnTracks`，而是响应规则缺少三个事实：

1. 哪一层拥有被改变的排布；
2. 阈值由哪种内容约束推导；
3. 规则适用于哪些 variant。

## 3. Module、Interface 与 Seam

### 3.1 布局树

```text
Host
└── RuntimeView                            [mc-runtime]
    ├── DashboardToolbar / FilterBar       [只读 mc-runtime]
    └── RuntimeSection                     [顶层布局所有者]
        └── Component cell                 [mc-component-box]
            └── Page Component
                ├── Leaf Component         [只读直接组件布局盒]
                ├── CompositeCard          [嵌套布局所有者]
                │   └── Composite slot     [mc-component-box]
                │       └── Leaf Component
                └── TabContainer           [嵌套布局所有者]
                    └── Active child box   [mc-component-box]
                        └── Table Component
```

页面元数据仍是 `Section → Component`，组合卡和 Tab 的既有受控嵌套不变。这里的布局盒都是渲染时 DOM Adapter，不是新的领域实体。

### 3.2 深 Module 划分

| Module | Interface | Implementation 隐藏的复杂度 | Seam / Adapter |
| --- | --- | --- | --- |
| Runtime Layout | Page Metadata、宿主可用宽度 | 页面外框、工具栏、内容分区回流、顶层栅格 | `RuntimeView` 的 `mc-runtime` |
| Direct Component Box | “给直接子组件一个确定的 inline-size” | 顶层 Grid、组合卡 12 列、Tab 当前内容槽的不同 DOM | `.cell`、`.composite-slot`、Tab 子组件盒三个 Adapter |
| Widget Internal Layout | 既有 props 与数据槽 | variant 排版、局部换行、图形缩放、内部滚动 | 每个 Page Component 根 |
| Responsive Contract Harness | `type × variant × box width → layout signature` | fixture、宽度注入、重叠与溢出测量、规则覆盖盘点 | Playwright + 静态契约测试 |

不建立生产态的“组件断点注册表”。那会把每个 Widget 的 Implementation 复制到中央 Interface，形成浅 Module；调整一个 variant 时还要同时修改中央表和组件 CSS，Locality 更差。中央只建立测试契约目录，不参与运行时渲染。

## 4. 必须长期成立的不变量

### RL-1：页面与组件不反向读取

- `RuntimeSection` 不读取子组件 `type` 或 `props.variant` 来推断列轨和响应模式。
- Page Component 不读取页面 id、布局形态、viewport 宽度或兄弟组件宽度。
- 组合卡只按自身布局盒和自己的受控子组件声明排布。

### RL-2：同盒同结果

同一 Page Component 在相同 `mc-component-box` 宽度、相同 props、相同数据下，不论外部 viewport 和页面宽度如何，布局签名必须相同。

### RL-3：阈值重新推导

- 旧 `@media` 数值不得机械复制到组件查询。
- 优先用流式布局、`minmax`、`clamp`、换行和内部滚动消除断点。
- 只有横排变纵排、双列变单列等离散拓扑变化才使用 `@container`。
- 阈值由该 variant 的最小可用内容宽度推导，并以阈值两侧的浏览器契约固定。
- 通用 selector 只有在所有 variant 的内容结构与最低宽度一致时才允许；否则必须按 variant 分治。

### RL-4：根盒与固有尺寸分离

- Page Component 根默认填满直接组件布局盒，并允许收缩。
- 禁止根节点保存页面设计结果、兄弟比例或宿主宽度。
- 图标、Gauge/Pie 的拨盘、表格列宽、正文行长上限等固有内容尺寸可以保留，但必须有明确的 overflow 或收缩策略。
- Table 列声明派生的内容下限属于 Table；页面派生的整表宽度不属于 Table。

### RL-5：溢出有唯一所有者

- Page 文档不得被任一 Page Component 撑出水平滚动。
- Table 的 `.scroll`、受控 Markdown 的代码块等显式滚动面是合法 overflow owner。
- 普通文本、指标、图表、组合卡、排行卡不得把水平溢出转嫁给 Page。
- `backdrop` 是既有受控叠放，不计为重叠缺陷；其他组件矩形不得无声明相交。

### RL-6：每条响应规则都有行为证据

- Widget 内每个离散 `@container` 规则必须有唯一响应契约 id。
- 静态测试扫描源码，发现没有契约 id 的尺寸查询即失败。
- 响应契约目录必须覆盖 schema 中全部 `type × variant`；新增类型或 variant 而未登记场景时 CI 失败。
- 静态测试只证明所有权和覆盖关系，不能替代浏览器布局断言。

### RL-7：`@media` 的允许范围

- `packages/widgets` 禁止用 `@media (max-width/width)` 控制几何。
- `runtime-ui` 的页面几何使用 `mc-runtime`，不直接读取全局 viewport。
- `print`、`prefers-reduced-motion`、pointer/hover 等非 inline-size 媒体能力不受此禁令影响。
- Canvas 创作/预览应用自身的编辑器 UI 不属于 Page Component，可保留 app 壳级媒体查询。

## 5. 全部 Page Component 迁移矩阵

组件全集以 `packages/page/src/schema/component.ts` 的判别联合为准。当前共 17 种类型、约 53 个 `type × variant` 分支；`aiSummary` 当前没有页面实例，也必须进入契约目录。

| Page Component | variant 范围 | V2 响应类型 | 迁移要求 |
| --- | --- | --- | --- |
| `reportHeader` | default、`projectDetail` | variant 局部回流 | 根填满组件布局盒；标题、标签、摘要分别按自己的内容下限回流；重推 `projectDetail` 的离散切换条件 |
| `metricCard` | default、`summary`、`activityProgress`、`compactSummary`、`dualSummary`、`compactStrip`、`compactStack` | variant 局部回流 + 匿名局部容器 | 删除无行为价值的通用旧阈值；逐 variant 固定指标行方向、双面板拓扑和进度环可用区；复核现有匿名窄宽规则 |
| `barChart` | default、`reportForecast` | 流式图表 | 图表容器跟随盒宽并触发 ECharts resize；语义说明和坐标标签不得撑宽根盒 |
| `lineChart` | default | 流式图表 | 与 BarChart 共用图表宿主的尺寸契约，无离散断点时不新增查询 |
| `pieChart` | default、`compactRing` | 流式外框 + 固有拨盘 | 固有图形尺寸允许保留，但必须在更窄盒内缩放或受控降级；组合卡内仍只读直接 slot |
| `table` | default、`reportCompact`、`embedded`、`forecastMatrix` | 内部滚动 | 根和滚动层填满盒；列声明汇总内容下限；删除页面派生整表宽度；各 variant 的 padding/表头策略不复用 viewport 阈值 |
| `mapChart` | default、`regionalOverview` | 流式图形 + 图例局部回流 | Map 画布跟随盒宽；图例的浮动/静态切换按图例与地图的实际可用区推导；安全区通道保持分区职责 |
| `gauge` | default、`mini` | 固有拨盘 + 流式标签 | 拨盘尺寸是内部固有尺寸，不是根宽；窄盒内保证标签、数值和点击区不溢出 |
| `tabContainer` | default、`compact`、`analysisStack` | 嵌套布局所有者 | 根填满盒；移除 compact 页签轨和 panel 的页面派生固定宽；为每个活动子组件建立直接 `mc-component-box`；表格溢出仍归 Table |
| `compositeCard` | default、`compact`、`projectNorms`、`metricGrid` | 嵌套布局所有者 | 立即删除无差别的通用单列切换；四个 variant 分别推导宽/窄拓扑；宽模式必须尊重子组件 `span`；slot 继续提供直接组件布局盒 |
| `rankingCard` | default | 流式列表 | 名称截断、数值与变化列在盒内稳定；内部纵向滚动不能变成页面横向滚动 |
| `rankingDetailCard` | default、`report` | 流式列表 + 行对齐 | 保持行对齐 Interface；长名称、Badge、语义明细在窄盒内换行，不通过页面宽度切换 |
| `keyValuePanel` | default、`counterStrip`、`detailSummary`、`detailNormMatrix` | variant 局部回流 | 默认列数、计数条、详情摘要、指标矩阵分别建契约；重推现有 900/760/520 的真实内容阈值，禁止通用 `dl` 误伤特殊 variant |
| `categoryBreakdown` | default、`compactList` | 流式紧凑表 | 列头、类别、度量的最低可读宽度有明确策略；与 Pie 的按类别取色契约不变 |
| `fieldText` | default、`plain`、`quote`、`narrativeShort`、`narrativeMeeting`、`narrativeRisk`、`narrativeProgress` | 流式文本 | 根填满盒；正文自然换行；variant 的内距和最小高度不再依赖旧 viewport 数值 |
| `text` | default、`plain`、`heading`、`insight`、`reportInline`、`riskNotice` | 流式文本 | 标题、语义 HTML、链接和风险提示均自然换行；`maxWidth` 只表示正文行长，不改变根盒所有权 |
| `aiSummary` | default、`reportInline` | 流式 Markdown | 加载、错误、流式正文都填满盒；长链接、表格和代码块分别换行或在内部滚动；无当前页面实例也要有 fixture |

## 6. 运行时 UI 与非 Page Component 范围

| 模块 | V2 规则 |
| --- | --- |
| `RuntimeView` | 唯一建立 `mc-runtime`；看板与报表外框继续由布局形态决定 |
| `RuntimeSection` | 只翻译 `columnTracks` / `span`，建立顶层直接组件布局盒；页面窄宽时的跨组件单列回流继续由 `mc-runtime` 决定 |
| `DashboardToolbar` | 只读 `mc-runtime`；不得根据某个页面或筛选数量写页面专用宽度 |
| `FilterBar` | 只读 `mc-runtime`，优先 flex wrap；单个筛选控件只维护自己的最低交互尺寸 |
| 7 种筛选控件 | 控件宽度服从 FilterBar 分配；下拉面板和树列表的滚动归控件自己 |
| `WidgetHost` | 加载、错误、空态与 ready 态共享同一个组件布局盒，不引入另一套宽度 |
| AI Summary runtime UI | SSE 状态不改变宽度所有权；Markdown 的局部 overflow owner 明确 |
| Canvas preview/editor | 属 app 壳，不是 Page Component；自身 viewport 媒体查询不向运行时或 Widgets 泄漏 |

## 7. 测试体系

### 7.1 Schema 驱动的覆盖门禁

新增测试侧响应契约目录，枚举全部 `type × variant`，并与页面 schema 判别联合交叉校验：

- 17 种 Page Component 一个不少；
- optional variant 的 default 分支单独覆盖；
- 新增类型或 variant 时，未增加响应 fixture 则测试失败；
- 每项声明行为类型：`fluid`、`reflow`、`scroll-owner` 或 `layout-owner`；
- 每项声明正常内容与合法长内容 fixture；AI Summary 使用独立受控 fixture。

该目录只在测试中存在，不导出给运行时。

### 7.2 组件盒浏览器契约

每个场景通过统一运行时渲染到受控组件布局盒，采集与断言：

- 组件根与直接布局盒宽度一致；
- 相同盒宽、不同外部 viewport 的布局签名完全一致；
- 离散查询在阈值两侧分别满足宽/窄签名；
- 图表 canvas/SVG 位于根盒内并随盒宽更新；
- 普通组件无水平溢出、无非声明重叠；
- Table、Markdown code block 等只有登记的内部节点持有水平滚动；
- 组合卡和 Tab 的嵌套子组件读到自己的直接盒，而不是顶层 Section 盒。

布局签名使用结构事实，不依赖整页截图像素：行分组、列分组、flex/grid 方向、根与盒矩形、scroll owner、可见裁断。视觉还原另外使用页面级基线。

### 7.3 四个 IOC 页面回归

1980 默认效果必须至少固定这些事实：

1. 四个 IOC Page 占满宿主且 Page 无水平滚动；
2. 机会分析顶部四张组合卡处于同一视觉行；第三、第四张卡的三个 `span: 4` 子组件同排；
3. 项目概览顶部三张组合卡同排，卡内 `span: 12` 独占行，`span: 3/6/3` 与其他声明按 12 列结构落位；
4. 项目详情的跨组件比例只来自 `columnTracks`，所有组件根填满自己的内容单元；
5. 机会清单与所有宽表只有内部滚动，不扩大 Page 文档宽度。

运行时进入既有页面窄宽区间时，`RuntimeSection` 可以把顶层组件改成单列；组件内部是否进一步回流，仍只由其直接组件布局盒和对应 variant 契约决定。

### 7.4 静态架构门禁

- Widgets 不出现尺寸型 viewport 媒体查询；
- Widgets 不包含 IOC 页面 id、布局形态 selector 或页面派生根宽；
- `mc-runtime` 只由 runtime-ui 建立和消费；
- 所有顶层与受控嵌套 Page Component 都有直接 `mc-component-box`；
- 每个离散容器查询都有响应契约 id，且 id 在测试目录中存在；
- 固定尺寸按“根几何 / 固有内容 / overflow 内容”分类，未分类的新字面量失败，而不是维护一个无限放宽的白名单。

## 8. 分阶段实施计划

### Phase 1：先建立红灯与覆盖目录

产品代码不先动。先让机会分析和项目概览的已确认回归变红，并建立 17 类型、全部 variant 的 fixture 覆盖门禁。现有只检查“出现 `@container`”的静态断言改为所有权与契约覆盖断言。

主要落点：

- `packages/embed/tests/browser/responsive-layout.spec.ts`：组件盒与 IOC 页面浏览器契约；
- `packages/embed/tests/browser/responsive-fixtures.ts`：测试侧全组件 fixture 目录；
- `packages/widgets/tests/responsive-contract.test.ts`：查询、固定尺寸与 fixture 覆盖门禁；
- `packages/runtime-ui/tests/project-detail-responsive.test.ts`：保留 `mc-runtime` / `mc-component-box` 所有权断言，删除错误的语法目标。

### Phase 2：补齐三个 Direct Component Box Adapter

确认顶层 Section、组合卡 slot、Tab 活动子组件都给直接子组件建立同一 Interface。保持页面协议、数据投影和递归分发不变。

主要落点：

- `packages/runtime-ui/src/RuntimeSection.svelte`；
- `packages/runtime-ui/src/ComponentRenderer.svelte`；
- `packages/widgets/src/components/composite-card/CompositeCard.svelte`；
- `packages/widgets/src/components/tab-container/TabContainer.svelte`。

### Phase 3：先修两个嵌套布局所有者

按 `compact`、`projectNorms`、`metricGrid`、default 分治组合卡排布，删除通用旧阈值；Tab 根与内容槽改为填满组件布局盒，并把表格 overflow 交回 Table。该阶段应首先恢复两个已知错误页面的 1980 顶部结构。

### Phase 4：迁移有离散查询的叶子组件

逐 variant 处理 `MetricCard`、`KeyValuePanel`、`ReportHeader`、`FieldText`、`MapChart`、`Table`。每删除或重推一条规则，都使用同一个组件盒契约完成 RED→GREEN；不以“源码不再有 `@media`”作为完成条件。

### Phase 5：覆盖无查询组件与固有尺寸

为 `BarChart`、`LineChart`、`PieChart`、`Gauge`、`RankingCard`、`RankingDetailCard`、`CategoryBreakdown`、`Text`、`AiSummary` 补齐盒宽、长内容、图形 resize 和 overflow 契约。只有实证表明需要离散拓扑变化时才新增容器查询。

### Phase 6：跨页收口与规则清理

在最终依赖闭包上验证四个 IOC 页面和现有报表页面；删除无消费者的旧自定义属性、死规则和只证明语法的测试。把响应式所有权写入 ADR，现有 `columnTracks`、Section Container、组合卡 ADR 保持不变。

## 9. 文件所有权

| 文件范围 | 职责 |
| --- | --- |
| `packages/runtime-ui/src/RuntimeView.svelte` | runtime 容器与页面外框 |
| `packages/runtime-ui/src/RuntimeSection.svelte` | 顶层栅格、页面级回流、顶层直接组件布局盒 |
| `packages/runtime-ui/src/dashboard/`、`filters/` | runtime 级工具栏和筛选响应 |
| `packages/runtime-ui/src/ComponentRenderer.svelte` | 嵌套组件渲染接缝，不决定 Widget 内部排布 |
| `packages/widgets/src/components/<type>/` | 对应 Page Component 的全部内部布局与固有尺寸 |
| `packages/page/src/schema/components/` | 组件和 variant 枚举事实源；本方案不新增响应字段 |
| `packages/embed/tests/browser/` | 真实 CSS 布局、同盒同结果、跨页回归 |
| `packages/widgets/tests/` | 全组件覆盖、查询所有权、固定尺寸分类 |
| `packages/runtime-ui/tests/` | runtime 与直接组件盒 Interface |

## 10. 回滚与风险控制

- 每个 Phase 必须在自身声明转绿后再进入下一阶段，避免一次性重写全部 CSS 后无法定位回归。
- 回滚按组件或 variant 恢复其上一份内部 Implementation，不回退 Page 满宽、`columnTracks` 或直接组件布局盒 Interface。
- 禁止把已知回归临时修成页面 id selector、机会分析专用 class 或恢复 Widget 的 viewport 查询。
- 没有外部视觉基线的 variant 只承诺结构、溢出和一致性；不得为了“统一”发明新的视觉数值。

## 11. 完成定义

以下条件全部满足，才算彻底解决：

1. schema 的 17 种组件与全部 variant 均被响应 fixture 覆盖；
2. 所有离散尺寸查询均有阈值两侧的浏览器行为证据；
3. 相同组件布局盒在不同 viewport 下布局签名相同；
4. 四个 IOC 页面 1980 默认结构与已确认基线一致；
5. 项目概览和机会分析的组合卡不再被正常桌面卡宽误判成移动端；
6. Page 无组件造成的水平滚动或非声明重叠；
7. 新增 Page Component 或 variant 时，缺少响应分类和 fixture 会在 CI 中失败；
8. Page Metadata 没有新增 viewport、breakpoint、desktop/mobile 或像素布局字段。

## 12. 计划输入降级说明

现有 `docs/plan/ioc-1980-width/` 缺少 `sdd-task-frontend` 要求的 `story-delta-spec.md`（SC/BR/GWT）和 codespec schema 指令，因此本文没有改写原 Story 的 `tasks.md` / `alpha-tests.md`，也没有伪造新的 `UNVERIFIED` 追溯账本。本次实施是针对已确认回归的布局重构，不依赖外部设计源还原，按仓库约定使用普通 TDD 验证链收口。

## 13. 实施验证（2026-08-31）

- 测试侧目录由 Page Component 判别联合约束，覆盖 17 种组件和 53 个 default/variant 分支；
- 四个 IOC 页面的 1980px 页面满宽、无页面级横向溢出、组合卡列轨与 Tab 直接组件布局盒均有真实浏览器回归；
- 同一项目详情组件盒在 1980/1200/700 外部 viewport 下的布局签名一致；
- `pnpm test`：170 个测试文件、1380 个测试通过；
- Embed Playwright：29/29 通过；
- `pnpm check`、`pnpm validate`、`git diff --check` 均通过。

---
status: accepted
---

# 响应式布局按统一运行时、直接组件布局盒与组件内部三层拥有

IOC 页面从 viewport 媒体查询迁移到容器查询后出现了一个反直觉回归：1980px 页面顶部分区按 `[2, 2, 3, 3]` 正确排成四列，但约 565px 宽的组合卡命中通用 `max-width: 760px` 规则，卡内三个 `span: 4` 子组件被误排成三行。项目概览的组合卡也受到同类影响。

问题不在权重列轨，而在迁移方法。`viewport <= 760px` 与 `component box <= 760px` 是不同事实；保留旧数值、只把 `@media` 改成 `@container`，等于改变条件含义却假定行为不变。

## 决策

**响应式布局分成三层宽度所有权。** `RuntimeView` 建立 `mc-runtime`，只供统一运行时的页面外框、工具栏、筛选栏与内容分区使用；直接布局所有者为每个直接子组件建立 `mc-component-box`，只供该 Page Component 使用；确有局部排布需求的组件可以建立匿名 self container，只供自己的后代使用。

**直接布局所有者当前只有三个 Adapter：** `RuntimeSection` 的顶层组件单元、`CompositeCard` 的卡内 slot、`TabContainer` 的活动面板。三者使用同名 `mc-component-box`，使嵌套 Page Component 总是读取最近的直接布局盒。该 DOM 盒是统一运行时实现细节，不是页面元数据实体；页面结构仍是内容分区直接拥有组件，组合卡与 Tab 保持既有受控嵌套。

**组件不读取 viewport、页面 id、布局形态或兄弟比例。** 相同组件在相同直接组件布局盒宽度、相同 props 与数据下，外部 viewport 不同也必须产生相同布局结果。统一运行时不得读取子组件 type 或 variant 来反向推断父网格。

**旧 viewport 阈值不得机械迁移。** 优先用流式 Grid/Flex、`minmax`、`clamp`、自然换行和受控内部滚动消除离散断点。只有确实发生横排/纵排等拓扑变化时才保留容器查询；阈值由具体 variant 的内容下限推导，规则必须有唯一响应契约与浏览器行为证据。容器无法知道任意子组件内容下限时，不得写通用回流规则；因此组合卡始终执行其卡内 12 列 `span` 声明，子组件在自己的 slot 内响应。

**组件根与固有内容尺寸分离。** Page Component 根默认填满直接组件布局盒并允许收缩。图标、拨盘、表格列宽、正文行长上限等固有内容尺寸可以保留，但必须有收缩策略或明确的内部 overflow owner。页面不得被组件撑出横向滚动；表格滚动层、Markdown 代码块等登记过的内部滚动面可以持有溢出。

**该决策不改变 Page Metadata。** 不增加 viewport、breakpoint、desktop/mobile、density 或像素布局字段，也不建立生产态中央断点注册表。组件 variant 的响应实现保持在组件内部；中央只保留测试侧 `type × variant` 覆盖目录。

**全部 Page Component 进入同一门禁。** 测试侧目录受页面组件判别联合约束，覆盖当前 17 种类型与 53 个 default/variant 分支；新增类型或 variant 未登记响应分类时类型检查失败。每条离散尺寸容器查询必须登记唯一契约。真实浏览器回归固定“同盒同结果”、直接组件根不越界、唯一溢出所有者，以及四个 IOC 页面 1980px 默认结构。

## Consequences

- `mc-component-box` 只表达可用 inline-size，不表达桌面端或移动端；命中某个宽度不自动意味着要改成上下布局。
- 嵌套布局多一层 DOM Adapter，但组件不再需要宽度 props、ResizeObserver 协议或页面专用 selector，Page Metadata 也没有响应式字段。
- `CompositeCard` 与 `TabContainer` 是布局所有者；普通叶子组件只消费直接布局盒，确有局部需要时再建立匿名 self container。
- 表格的列内容下限仍属于表格；IOC 设计派生的 516、550、532、1168、1584 等根宽不再属于组件实现。
- `print`、`prefers-reduced-motion`、pointer/hover 等非尺寸媒体能力不受“禁止尺寸型 viewport 查询”约束；Canvas 编辑器壳也不属于 Page Component。

## Considered Options

- **继续使用 viewport 媒体查询。** 否决：同一组件在不同宿主或嵌套层级中会因页面宽度而产生不同结果，恢复页面耦合。
- **把旧断点原样改成容器查询。** 否决：这正是本次回归的直接原因，两个参照物语义不同。
- **给组件传 `desktop` / `mobile` 或实际宽度 props。** 否决：调用方必须理解每个组件内部排布，Interface 变宽且嵌套层继续传播。
- **把所有组件断点注册到生产态中央表。** 否决：variant Implementation 被复制为中央 Interface，修改一个组件需要跨文件同步，Locality 更差。
- **彻底不用容器查询。** 否决：地图注释、详情页头和局部指标等确有离散拓扑变化；问题是所有权与阈值来源，不是容器查询能力本身。

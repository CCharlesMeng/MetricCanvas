# MetricCanvas UI

独立 Svelte 5 基础组件库，同仓工程维护，独立 SemVer。安装 `@metriccanvas/ui` 与 `svelte >=5.29.0 <6`，使用标准 Svelte 构建，无源码 alias 或专用预处理器。

UI 仅接收中性值、行列与事件，不依赖页面协议、渲染引擎、ECharts、DQE 或页面资产。OS Theme 资源随组件发布，浮层留在原挂载根。普通 Svelte 应用沿用自身样式构建；直接挂载 ShadowRoot 时使用 Svelte Vite 插件的 `emitCss:false`，使样式随组件注入挂载根，embed 已采用该配置。组件实现与视觉证据分别登记；包骨架不表示组件已验收。

第三方资源归属见 LICENSE；工程入口见 [构建与仓外消费](../../tools/package-build/README.md)。

Grid 的可选 `headers` 接收按列 key 对应的 Svelte snippet，用于列头筛选等展示。筛选条件和请求由调用者持有；窄屏堆叠时保留自定义列头，确保操作仍可访问。

DatePicker 单点精度新增 year（YYYY）与 quarter（YYYY-Qn），输入分别显示 YYYY 年与 YYYY 年 Qn；年季范围编辑不在该入口支持范围内。原有 month/date 单点与范围模式保持原样。Dashboard 的组合筛选与相对月份计算由运行时适配器及页面协议负责。

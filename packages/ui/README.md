# MetricCanvas UI

独立 Svelte 5 基础组件库，同仓工程维护，独立 SemVer。安装 `@metriccanvas/ui` 与 `svelte >=5.29.0 <6`，使用标准 Svelte 构建，无源码 alias 或专用预处理器。

UI 仅接收中性值、行列与事件，不依赖页面协议、渲染引擎、ECharts、DQE 或页面资产。OS Theme 资源随组件发布，浮层留在原挂载根。普通 Svelte 应用沿用自身样式构建；直接挂载 ShadowRoot 时使用 Svelte Vite 插件的 `emitCss:false`，使样式随组件注入挂载根，embed 已采用该配置。组件实现与视觉证据分别登记；包骨架不表示组件已验收。

第三方资源归属见 LICENSE；工程入口见 [构建与仓外消费](../../tools/package-build/README.md)。

Grid 的可选 `headers` 接收按列 key 对应的 Svelte snippet，用于列头筛选等展示。筛选条件和请求由调用者持有；窄屏堆叠时保留自定义列头，确保操作仍可访问。

DatePicker 单点精度新增 year（YYYY）与 quarter（YYYY-Qn），输入分别显示 YYYY 年与 YYYY 年 Qn；年季范围编辑不在该入口支持范围内。原有 month/date 单点与范围模式保持原样。Dashboard 的组合筛选与相对月份计算由运行时适配器及页面协议负责。

`Select` 保留 `value: string` / `onchange(string)`，新增 `searchable?: boolean`，默认开启面板内候选搜索。需要数组值时使用 `Selection`，它的 `value: string[]` 和 `onchange(string[])` 始终受控；`multiple=false` 为单选，`tree=true` 展示 `UiTreeOption.children`，所有节点使用稳定 `value`，`label` 只显示，`selectable=false` 为不可提交的结构节点。`treeSelection` 可取 independent（中立组件默认，只操作自身）、descendants（本节点及候选后代）、leaf（仅叶子）；单选始终只提交一个自身值，leaf 单选父节点只展开。

`Selection` 的 `searchable=true`、`disabled=false`、`clearable=false` 可独立配置；`statusText` / `statusError` 显示加载、空结果或错误。多选标签固定单行并在区内横向滚动，移除只回传对应值的删除；候选缺少已选值时回显原稳定码。组件不取数，不提供远程搜索/懒加载/分页，也不保存业务状态。页面维度筛选适配器的缺省父选后代与 string[] 单选约束由页面协议另行声明，不能从视觉树自动推断业务查询。

键盘：打开默认聚焦搜索；无搜索时聚焦首个可操作项；上下/Home/End移动候选，树左右键展开/收起/返回父级，Enter选择，Escape关闭并回焦。鼠标滚轮在标签溢出时用于横向滚动；删除按钮可直接获得键盘焦点。演示及自动验收见 [IOC选择控件](../../pages/README.md#ioc-页头选择控件)。

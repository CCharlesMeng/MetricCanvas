# MetricCanvas 创作组件

`MetricCanvas` 为 Svelte 集成应用提供选中、拖拽、行内编辑与意图回传。它复用 `runtime-ui` 的渲染主体和内容分区布局，不复制查询、筛选或组件渲染实现。只做正式渲染的集成应用继续使用 `RuntimeView`，无需安装本包。

```svelte
<script lang="ts">
  import { MetricCanvas, type AuthoringIntent } from '@metriccanvas/metric-canvas';
  // document、dataGateway、selected、running 由集成应用提供。
  function handleIntent(intent: AuthoringIntent) {
    // 集成应用处理选中与编辑意图，并回传新的 selected 或页面文档。
  }
</script>

<MetricCanvas
  {document}
  {dataGateway}
  {selected}
  enabled={!running}
  inlineControls={false}
  onintent={handleIntent}
/>
```

运行输入沿用 `RuntimeViewProps`：`document`、`dataGateway`、`aiSummary`、`initialSearch`、`navigation`、`onevent`、`pageRevisionId`。创作输入包括 `selected`、`draftSections`、`inlineControls`、必填 `onintent`，以及默认开启的 `enabled`。

- `enabled` 只切换创作行为，保留同一个渲染会话；关闭时页面原有点击交互恢复。选中、控件开关不重启查询、不清空筛选和分页。替换 `document` 沿用统一运行时的初始化语义。
- `draftSections` 只调整已校验组件的分区与顺序，允许保留草稿空分区；重复、遗漏或未知组件会使草稿布局整体回退为正式布局。它不进入页面校验与取数输入。
- `onintent` 回传选中、移动与编辑。移动的 destination 是移除源组件之前的插槽，集成应用可用 `normalizeAuthoringDropTarget` 换算；页面文档、属性面板、保存与撤销历史仍归集成应用。

## 交付与组合接缝

正式包名为 `@metriccanvas/metric-canvas`，与 page、engine、embed 锁步为 `1.0.0-rc.1`，已解除 private，尚未执行 registry 发布。本包使用 Svelte attachments，peer 范围为 `>=5.29.0 <6`；当前版本与 5.29.0 均通过仓外 tarball 安装、构建和 Chrome / Edge 浏览器门禁。

本包使用 `@metriccanvas/engine/ui/composition` 的四项导出：`RuntimeSurface`、`RuntimeSection`、`ComponentContent`、`sectionGridColumnCount`。该子入口不从渲染包默认入口转出，但仍是需要版本管理的跨包 Interface，#100 必须显式对账。

`RuntimeSurface.sectionsContent` 接收已校验的内容分区及绑定到当前数据快照的组件渲染片段。`RuntimeSection` 保留网格、布局盒、行对齐和安全区所有权，通过 `cellAttachment`、`cellOverlay`、`emptyContent` 接受局部装饰；attachment 必须清理监听器与自己添加的属性。创作代码不读取或修改纯渲染组件内部 DOM，也不改变取数编排。

## 验证

- `pnpm --filter @metriccanvas/metric-canvas check`
- `pnpm --filter @metriccanvas/metric-canvas test:browser`
- `pnpm exec vitest run packages/metric-canvas/tests packages/embed/tests/authoring-isolation.test.ts`
- `pnpm test:embed`

浏览器回归覆盖查询与筛选状态连续性、原交互拦截与恢复、标题/宽度回写、跨分区拖拽、草稿空分区隔离及卸载清理。纯渲染门禁同时检查安装依赖、实际构建模块图及 JS/CSS 产物，防止仅换导出而残留创作代码。

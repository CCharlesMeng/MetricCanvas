# 宿主契约

MetricCanvas 统一运行时不路由、也不决定自己有多宽。应用外壳（门户或 `packages/embed` 嵌入方）拥有路由、返回栈、面包屑和挂载容器的几何。Canvas 是同一份契约的参考实现，不是生产宿主。

面包屑是宿主的导航 UI。页面标题栏（`reportHeader`）是页面内容，由页面参数驱动。二者视觉上可以相邻，所有者不同。

## 宿主必须交出宽度

页面外框几何由页面文档的 `layoutForm` 决定，它是唯一真源（[ADR-0052](./adr/0052-dashboard-layout-form-backdrop-and-safe-area.md)）：

| `layoutForm` | 页面期望的容器 |
|---|---|
| `report`（缺省） | 不敏感。页面自己定宽居中，宿主给多宽都对 |
| `dashboard` | **挂载容器的可用宽度就是页面宽度。** 宿主不得再加 `max-width` 或水平内边距 |

看板形态的页面在定宽容器里就是错的：满幅布局、铺底层与分区内的悬浮排布都按"页面拥有全部宽度"设计。门户若有统一的内容区宽度限制，渲染看板页时必须让这一页跳出该限制，或者不接受看板形态的页面。

运行时**不能**检测到宿主违反了这一条：它只看到一个较窄的容器，并按该宽度正常渲染。因此这是宿主侧的实现义务，没有运行时兜底。

`apps/canvas` 的参考做法：正式路由的页面外框按 `layoutForm` 切换，报表沿用定宽居中，看板去掉内边距并使用宿主实际交付的全部可用宽度。1980px 是 IOC Page 的回归视口，不是宿主固定槽宽，也不会进入组件契约。顶栏、侧栏与菜单树仍归生产门户，不进入 Canvas Page、`RuntimeView` 或 `packages/embed`。

Page Metadata 的结构仍然是 `Section → Component`，不存在中间业务实体。运行时仅为每个 Component 生成一个组件布局盒（`mc-component-box`），用来承接 `component.layout`、Grid 落位、创作态安装点和容器查询边界；它是 DOM / CSS 实现细节，不是 Page Metadata 层级。组件根节点只占满这个布局盒；跨组件比例只属于 Page Metadata 的 `columnTracks`，组件不得反向读取 Page id、布局形态或全局视口来推断自身宽度。

## 导航：运行时发出什么

`RuntimeView` / `mount({ onEvent })` 的 `navigate` 事件：

| 字段 | 含义 |
|---|---|
| `type` | 恒为 `"navigate"` |
| `pageId` | 目标页面 id |
| `search` | 目标页查询串，不含前导 `?` |
| `sourcePageId` | 来源页 id |
| `sourceSearch` | 来源页当前查询串（筛选 + 页面参数） |

`RuntimeNavigation.navigate` 收到同一组字段，另加宿主自己用 `href()` 拼好的 `href`。

运行时到此为止：不调用 `history`，不改地址栏，不维护跨页返回栈。

## 导航：宿主必须做什么

1. **入向**：把当前 URL 的查询串交给 `initialSearch`（或 `mount` / `update` 的同名字段），不含 `?`。运行时据此水合筛选状态与页面参数。
2. **出向**：接到 `navigate` 后，路由到目标页并用新的 `search` 重新挂载（Canvas 用 `goto`；嵌入方按自己的路由器跳）。
3. **回跳**：用 `sourcePageId` + `sourceSearch` 自己记录来源。怎么记（路由栈、URL、会话存储）由宿主决定。
4. **深链接**：直接打开详情页时没有来源。必须明确处置——隐藏回退入口，或回到声明的默认上级页——不要留一个点了没反应的箭头。
5. **查询串原样保留**：不要改写或丢弃 `p:`（页面参数）以及筛选前缀 `d:` / `h:` / `t:` / `m:` / `b:` / `n:` / `s:`。宿主可以另加自己的参数，运行时会忽略未识别的键。

## `packages/embed` 的 `navigate` 载荷

```js
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  initialSearch: location.search.slice(1),
  onEvent(event) {
    if (event.type !== 'navigate') return;
    hostRememberReturn(event.pageId, event.sourcePageId, event.sourceSearch);
    hostRouter.navigate(event.pageId, event.search);
  }
});
```

Embed 不修改宿主 URL。`update({ document, initialSearch })` 用于宿主跳到新页之后重新水合。

## 查询串约定

| 前缀 | 含义 |
|---|---|
| `p:` | 页面参数，不进筛选状态 |
| `d:` | 扁平维度筛选 |
| `h:` | 层级维度筛选（携带当前层级） |
| `t:` | 时间范围 |
| `m:` | 时间点 |
| `b:` | 布尔（仅勾选时占位） |
| `n:` | 数值区间 |
| `s:` | 搜索 |

完整形状以 `@metriccanvas/runtime` 的筛选状态编解码为准。宿主不要自己拼这些前缀。

## Canvas 参考实现

`apps/canvas` 用 `sessionStorage` 按目标页 id 记录来源，并在页面标题栏**上方**画一条「返回」面包屑。刷新后回跳仍在；深链接没有记录则不画箭头。

# 宿主契约

MetricCanvas 统一运行时（渲染引擎）不拥有应用路由器、返回栈或面包屑，也不决定自己有多宽。直接调用引擎的应用拥有挂载容器的几何。IOC 微前端子应用和 platform 自行处理应用集成，单页嵌入不要求实现微前端协议。Canvas 是同一份契约的参考实现，不是生产宿主。

面包屑是宿主的导航 UI。页面标题栏（`reportHeader`）是页面内容，由页面参数驱动。二者视觉上可以相邻，所有者不同。

## 接入与状态边界

[ADR-0066](adr/0066-self-contained-rendering-engine-host-boundary.md) 确认宿主边界；[ADR-0067](adr/0067-url-navigation-with-explicit-parameter-bindings.md) 的 URL 导航已由 #109 实现，具体 6.0 协议见 [ADR-0068](adr/0068-plain-url-navigation-protocol.md)。

- Svelte/创作宿主用 npm 入口；普通 HTML/异构宿主通过 JS 地址加载预构建引擎，再 `mount(target, options)`，使用返回的 `update`/`destroy`。`packages/embed` 是 JS 挂载入口所在包，不是独立应用或自定义元素。构建与发包方式以 #100 为准。
- 引擎统一提供字体、颜色、间距等视觉呈现，宿主不配置字体、主题或自定义 CSS。`--mc-*` 是实现细节。已有页面文档的受控布局与组件配置继续生效；现有系统字体回退不保证跨操作系统字体完全一致。
- JS 挂载入口的样式随产物注入 Shadow DOM。宿主不依赖内部 DOM/类名；npm 入口亦不承诺能抵挡宿主任意 CSS 覆盖。无需安装 shadcn-svelte 作为接入前置。
- 宿主自行获取页面文档并处理获取失败/重试，再传 `document`；渲染入口不接 `PageRepository`。页面校验与运行期间的数据状态归引擎。
- 动态查询由宿主提供 `dataGateway`。可用随引擎入口提供的 `createDqeGateway` 按端点配置构造；端点、请求凭据及其更新由宿主负责，只有用到维度候选值时才需要相应能力。仅内联页面不必提供数据网关。真实身份、CORS 与生产接线由 #101/#3 对账。
- 取数失败通过现有数据错误语义报告；宿主负责登录恢复及重试，引擎不增加身份端口，不承诺自动登录或无损恢复。凭据可在宿主网关内部更新，不必仅为刷新凭据替换整个网关对象。
- `update(input)` 是完整运行输入替换，`document` 必填，省略的可选输入不会沿用旧值。文档、网关或初始查询串变化按既有语义初始化，不保证保留筛选与分页；同容器同时只允许一个实例，`destroy` 可重复调用，销毁后不能继续 `update`。

## 筛选与 URL 的可选同步

运行时通过 `filter-change` 事件输出编码后的 `search`，宿主自行选择是否同步 URL。参考方式替换当前 URL，避免每次筛选新增一条浏览历史；**不要把这次 URL 写入立即原样回灌 `update`**。实际切页或浏览器前进/后退恢复时，再传完整输入与初始查询串。查询串未编码的分页、排序与滚动位置不在恢复承诺内。

```js
function onEvent(event) {
  if (event.type !== 'filter-change') return;
  const url = new URL(window.location.href);
  url.search = event.search; // 独立单页示例：宿主参数需由应用保留/合并。
  window.history.replaceState(window.history.state, '', url);
  // 本次不调用 runtime.update；引擎已经持有最新筛选状态。
}
```

## URL 导航

页面内容提供方声明 `href` 与可选 `query` 绑定，承担部署地址变化后的链接调整。相对地址按浏览器文档基址解析，不按引擎 JS 地址解析。无需 pageId 地址解析器或导航回调，链接默认按浏览器语义跳转。

动态参数可取当前行、当前页面参数或当前筛选值，只携带显式声明内容。普通值使用标准查询编码，多选重复键，范围与层级拆键；非空绑定覆盖同名键，缺值省略并保留基础地址中的值，其他查询键与 hash 保留。引擎不探测目标页面或预检其必填项。文本、表格链接和指标卡使用 anchor；图表直接点击内容，不增加提示框中的导航入口。

取消的是导航目标对 pageId 的依赖，页面资产身份和修订归属仍保留。导航栈、面包屑和来源恢复继续归应用。

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

## 可选导航接管

`RuntimeView` 与 JS 挂载入口均接收可选的 `navigation`。`navigation.navigate(target)` 返回 `true` 表示宿主已接管，否则继续默认导航。只拦截普通主键点击；修饰键与新标签操作保持浏览器语义。`onEvent` 是观察通知，不通过其返回值接管导航。

```js
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  initialSearch: location.search.slice(1),
  navigation: {
    navigate(target) {
      const url = new URL(target.href, document.baseURI);
      if (!hostRouter.owns(url)) return false;
      hostRememberReturn(url, target.sourcePageId, target.sourceSearch);
      hostRouter.navigate(url);
      return true;
    }
  }
});
```

`navigate` 事件字段：`type: "navigate"`、完整目标 `href`、来源 `sourcePageId` 与来源查询串 `sourceSearch`。删除旧目标 `pageId/search` 和 `navigation.href()` 解析器。来源字段供宿主记录返回路径，不用于解析目标地址。

宿主实际切页、同页更换 URL 参数、浏览器前进/后退时，用完整 `update({ document, initialSearch, ... })` 重新初始化。`filter-change` 仅同步 URL 时不立即回灌；未编码的排序、分页和滚动位置不保证恢复。

## 查询串约定

| 输入 | 示例 |
|---|---|
| 页面参数 | `code=A001&month=2026-04`，按接收页声明转换类型 |
| 维度多选 | `region=SH&region=BJ` |
| 层级维度 | `region=SH-01&region.level=office` |
| 时间或数值范围 | `period.from=2026-04-01&period.to=2026-04-30` |
| 时间点、布尔、搜索 | `month=2026-04&active=false&search=cloud` |

页面参数键为其 id；筛选键缺省为 id（范围、层级有上述后缀），可通过筛选声明的 `urlParams` 显式映射成目标需要的 `value/from/to/level` 键名。未声明键保留并忽略。6.0 不解析旧的 `p:/d:/h:/t:/m:/b:/n:/s:` 前缀；旧文档与旧链接需要显式迁移。

## Canvas 参考实现

`apps/canvas` 用 `sessionStorage` 按目标页 id 记录来源，并在页面标题栏**上方**画一条「返回」面包屑。刷新后回跳仍在；深链接没有记录则不画箭头。

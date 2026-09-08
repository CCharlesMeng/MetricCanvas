# 集成应用契约

MetricCanvas 统一运行时（渲染引擎）不拥有应用路由器、返回栈或面包屑，也不决定自己有多宽。直接调用引擎的应用拥有挂载容器的几何。IOC 微前端子应用和 platform 自行处理应用集成，单页嵌入不要求实现微前端协议。Canvas 是同一份契约的参考实现，不是生产环境的集成应用。

面包屑是集成应用的导航 UI。页面标题栏（`reportHeader`）是页面内容，由页面参数驱动。二者视觉上可以相邻，所有者不同。

## 接入与状态边界

[ADR-0066](adr/0066-self-contained-rendering-engine-host-boundary.md) 确认集成应用边界；[ADR-0067](adr/0067-url-navigation-with-explicit-parameter-bindings.md) 的 URL 导航已由 #109 实现，具体 6.0 协议见 [ADR-0068](adr/0068-plain-url-navigation-protocol.md)。

- Svelte/页面搭建类集成应用用 npm 入口；普通 HTML/异构集成应用通过 JS 地址加载预构建引擎，再 `mount(target, options)`，使用返回的 `update`/`destroy`。`packages/embed` 是 JS 挂载入口所在包，不是独立应用或自定义元素。构建与发包方式以 #100 为准。
- 引擎统一提供字体、颜色、间距等视觉呈现，集成应用不配置字体、主题或自定义 CSS。`--mc-*` 是实现细节。已有页面文档的受控布局与组件配置继续生效；现有系统字体回退不保证跨操作系统字体完全一致。
- JS 挂载入口的样式随产物注入 Shadow DOM。集成应用不依赖内部 DOM/类名；npm 入口亦不承诺能抵挡集成应用任意 CSS 覆盖。无需安装 shadcn-svelte 作为接入前置。
- 集成应用自行获取页面文档并处理获取失败/重试，再传 `document`；渲染入口不接 `PageRepository`。页面校验与运行期间的数据状态归引擎。
- 动态查询由集成应用提供 `dataGateway`。可用随引擎入口提供的 `createDqeGateway` 按端点配置构造；端点、请求凭据及其更新由集成应用负责，只有用到维度候选值时才需要相应能力。仅内联页面不必提供数据网关。真实身份、CORS 与生产接线由 #101/#3 对账。
- 取数失败通过现有数据错误语义报告；集成应用负责登录恢复及重试，引擎不增加身份端口，不承诺自动登录或无损恢复。凭据可在集成应用的网关内部更新，不必仅为刷新凭据替换整个网关对象。
- [ADR-0069](adr/0069-local-boundary-substitutes-and-host-owned-credentials.md) 明确所有数据请求的请求头与相关 Cookie 均由集成应用决定，覆盖集成应用向 DQE、页面资产和公共 Chat 发出的请求。本仓不新增开发身份适配器或用户切换器，不自行补默认用户或覆盖集成应用提供的凭据；Cookie 由浏览器按集成应用选择的请求策略处理。该边界不免除服务端必填字段与权限校验，具体接口与 CORS 接线由 #101/#105/#106 对账。
- `update(input)` 是完整运行输入替换，`document` 必填，省略的可选输入不会沿用旧值。文档、网关或初始查询串变化按既有语义初始化，不保证保留筛选与分页；同容器同时只允许一个实例，`destroy` 可重复调用，销毁后不能继续 `update`。

## 平台的运行配置注入

这一段与上面不同层：上面是渲染引擎对集成应用的要求，这一段是**平台**（第一方集成应用）对装载它的集成门户的要求。平台以纯前端静态产物部署，没有服务端可以藏凭据或代理请求，因此端点与凭据只能由门户在运行时给（[ADR-0073](adr/0073-static-platform-direct-access-with-injected-runtime-config.md)）。

门户在平台的静态产物加载前设置一个全局对象，五个字段：

| 字段 | 说明 |
|---|---|
| `dqeEndpoint` | DQE 执行地址。相对路径表示同源反代，绝对地址表示 CORS 直连，两种部署形态共用同一份产物 |
| `pageAssetsBaseUrl` | Java 页面资产基址 |
| `authToken` | 随请求发出的 `X-Auth-Token`，用户态 token |
| `operatorId` | 随请求发出的 `X-Operator-Id` |
| `workspaceId` | 随请求发出的 `X-Workspace-Id` |

设置方式由部署形态决定：静态产物的入口 HTML 里注入一段脚本、同源父页面直接设置、或本地开发入口设置，平台不区分。

- **平台每次请求现读这个对象，不在启动时快照。** 门户刷新 token 后直接改字段即可，不需要重新挂载平台，也不需要回调。平台不提供登录界面、不做刷新重试：HTTP 401 按既有语义呈现为需要登录，重登由门户处理（ADR-0069 已定本仓不建登录体系）。
- **`operatorId` 是门户声明的 actor，不是平台验证过的 actor。** 可信性由同行的 `authToken` 承担，平台不校验二者是否同一人——它解不开 token，也挡不住能改请求头的人改校验代码。服务端应以 token 为准，二者不一致时拒绝。
- **配置缺失或不完整时平台照常启动**，页面目录与内联页面仍可查看，取数在调用时失败，且错误明确指出是集成应用未注入运行配置，不与网络失败混同。
- **平台不实现微前端协议。** 它是自包含静态 SPA，门户用 iframe、整页跳转、菜单链接或微前端框架装载它都可以。DQE 与 Java 页面资产需允许上述三个身份请求头跨源并允许携带凭据，这是对服务提供方的要求，对账见 #3 / #105。

### 平台页面资产访问

平台的页面目录、页面详情、精确修订预览与保存共用一个页面资产客户端。配置完整时按请求现读 Java 基址和三个身份头；基址已注入但缺身份时，以 `DQE_CONFIG_ERROR` 报告「集成应用未注入运行配置」。Node 适配器仍在的过渡期，仅缺少 `pageAssetsBaseUrl` 时回退应用 base 下的同源 `/api/pages`。

精确修订预览由平台客户端读取指定修订，再交给 `RuntimeView` 就地呈现；保存成功后按新修订 id 重新读取，编辑中的工作副本不会混入已保存修订。独立 Canvas 的 `VITE_PLATFORM_URL` 页面来源选择保持不变。Java 路径的 `dataContextVersion` 未提供时记录为 null，界面显示「未记录」，不把它解释为页面只含内联数据。

### 平台应用路由前缀

平台存活路由的导航使用 SvelteKit `resolve`。构建时通过 `METRICCANVAS_BASE_PATH=/metriccanvas pnpm --filter platform build` 配置前缀，默认空前缀；该值是构建期的 `paths.base`，不是五字段运行配置的一部分。SvelteKit 的构建期 base 与 qiankun 运行时分配的前缀能否对齐仍未验证；本接缝不代表已完成 qiankun 接入。模板库和发布确认路由的退场归 #102。

## 筛选与 URL 的可选同步

运行时通过 `filter-change` 事件输出编码后的 `search`，集成应用自行选择是否同步 URL。参考方式替换当前 URL，避免每次筛选新增一条浏览历史；**不要把这次 URL 写入立即原样回灌 `update`**。实际切页或浏览器前进/后退恢复时，再传完整输入与初始查询串。查询串未编码的分页、排序与滚动位置不在恢复承诺内。

```js
function onEvent(event) {
  if (event.type !== 'filter-change') return;
  const url = new URL(window.location.href);
  url.search = event.search; // 独立单页示例：集成应用自身的参数需由应用保留/合并。
  window.history.replaceState(window.history.state, '', url);
  // 本次不调用 runtime.update；引擎已经持有最新筛选状态。
}
```

## URL 导航

页面内容提供方声明 `href` 与可选 `query` 绑定，承担部署地址变化后的链接调整。相对地址按浏览器文档基址解析，不按引擎 JS 地址解析。无需 pageId 地址解析器或导航回调，链接默认按浏览器语义跳转。

动态参数可取当前行、当前页面参数或当前筛选值，只携带显式声明内容。普通值使用标准查询编码，多选重复键，范围与层级拆键；非空绑定覆盖同名键，缺值省略并保留基础地址中的值，其他查询键与 hash 保留。引擎不探测目标页面或预检其必填项。文本、表格链接和指标卡使用 anchor；图表直接点击内容，不增加提示框中的导航入口。

取消的是导航目标对 pageId 的依赖，页面资产身份和修订归属仍保留。导航栈、面包屑和来源恢复继续归应用。

## 集成应用必须交出宽度

页面外框几何由页面文档的 `layoutForm` 决定，它是唯一真源（[ADR-0052](./adr/0052-dashboard-layout-form-backdrop-and-safe-area.md)）：

| `layoutForm` | 页面期望的容器 |
|---|---|
| `report`（缺省） | 不敏感。页面自己定宽居中，集成应用给多宽都对 |
| `dashboard` | **挂载容器的可用宽度就是页面宽度。** 集成应用不得再加 `max-width` 或水平内边距 |

看板形态的页面在定宽容器里就是错的：满幅布局、铺底层与分区内的悬浮排布都按"页面拥有全部宽度"设计。门户若有统一的内容区宽度限制，渲染看板页时必须让这一页跳出该限制，或者不接受看板形态的页面。

运行时**不能**检测到集成应用违反了这一条：它只看到一个较窄的容器，并按该宽度正常渲染。因此这是集成应用侧的实现义务，没有运行时兜底。

`apps/canvas` 的参考做法：正式路由的页面外框按 `layoutForm` 切换，报表沿用定宽居中，看板去掉内边距并使用集成应用实际交付的全部可用宽度。1980px 是 IOC Page 的回归视口，不是集成应用固定的槽宽，也不会进入组件契约。顶栏、侧栏与菜单树仍归生产门户，不进入 Canvas Page、`RuntimeView` 或 `packages/embed`。

Page Metadata 的结构仍然是 `Section → Component`，不存在中间业务实体。运行时仅为每个 Component 生成一个组件布局盒（`mc-component-box`），用来承接 `component.layout`、Grid 落位、创作态安装点和容器查询边界；它是 DOM / CSS 实现细节，不是 Page Metadata 层级。组件根节点只占满这个布局盒；跨组件比例只属于 Page Metadata 的 `columnTracks`，组件不得反向读取 Page id、布局形态或全局视口来推断自身宽度。

## 可选导航接管

`RuntimeView` 与 JS 挂载入口均接收可选的 `navigation`。`navigation.navigate(target)` 返回 `true` 表示集成应用已接管，否则继续默认导航。只拦截普通主键点击；修饰键与新标签操作保持浏览器语义。`onEvent` 是观察通知，不通过其返回值接管导航。

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

`navigate` 事件字段：`type: "navigate"`、完整目标 `href`、来源 `sourcePageId` 与来源查询串 `sourceSearch`。删除旧目标 `pageId/search` 和 `navigation.href()` 解析器。来源字段供集成应用记录返回路径，不用于解析目标地址。

集成应用实际切页、同页更换 URL 参数、浏览器前进/后退时，用完整 `update({ document, initialSearch, ... })` 重新初始化。`filter-change` 仅同步 URL 时不立即回灌；未编码的排序、分页和滚动位置不保证恢复。

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

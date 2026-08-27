# routes.md — 加一个页面 / 一条路由要动哪几处?

**先读这条:本仓「加一个页面」多数情况下不动路由。** 看板页面是数据(`pages/*.json`),不是路由;只有当你要加一类**新的宿主界面**(比如又一个预览器)时才动下面这些。判据见 `PATTERN-ROUTE-2`。

## 路由机制

<!-- 覆盖:apps/canvas/src/routes/、apps/canvas/svelte.config.js、apps/canvas/vite.config.ts、packages/runtime-ui/src/types.ts、packages/runtime/src/(2026-08-24)。apps/platform/src/routes/ 只做了目录清点,未逐文件确认 -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `ROUTE-1` | `apps/canvas/src/routes/`,SvelteKit 文件式路由 | **无显式路由表**:目录结构即路径,`+page.svelte` 是页面,`[pageId]` 是动态段,`(viewer)` 是不进路径的路由组。加宿主界面就是加目录 | SvelteKit 构建期 |
| `ROUTE-2` | 路由 → 业务组件索引:`(viewer)/+page.svelte`(目录页)、`(viewer)/pages/[pageId]/+page.svelte`(看板页面查看器)、`(viewer)/preview/+page.svelte`(JSON 即时预览) | 三个业务界面的全集。「这条路径由谁渲染」从这里查;它们各自只被路由消费,不是可复用构件 | 各 1 处 |
| `ROUTE-3` | 布局容器:`routes/+layout.svelte`(全局 body 样式)、`routes/(viewer)/+layout.svelte`(顶栏 + 主区外框) | 两级布局。顶栏与品牌入口在第二级;**它刻意不再统一裁宽**,页面宽度由各路由自己的 `.page-frame` 与页面布局形态决定 | `(viewer)` 组下全部路由 |
| `ROUTE-4` | `routes/+layout.ts`(`ssr = false`、`prerender = false`)+ `svelte.config.js` 的 `adapter-static({ fallback: 'index.html' })` | SPA 装配约定:全客户端渲染、静态托管。**新增路由不要加 `+page.server.ts` 或 load 函数**,那会与静态 SPA 假设冲突 | 全部 canvas 路由 |
| `ROUTE-5` | `RuntimeNavigation`(`packages/runtime-ui/src/types.ts`)+ canvas 侧适配实现(`(viewer)/pages/[pageId]/+page.svelte` 内的 `navigation` 对象) | **跳转端口**:统一运行时只上抛跳转意图(`href` / `replaceSearch` / `navigate`),宿主决定怎么跳。这是本文件最值钱的一条,见 `PATTERN-ROUTE-1` | 统一运行时全部跳转点;canvas、embed、platform 三个宿主各自实现 |
| `ROUTE-6` | `pageHref` / `rememberPageReturn` / `pageReturnOf`(`apps/canvas/src/lib/page-return.ts`) | 参考宿主的回跳记录:运行时只上抛来源页与来源查询串,宿主自己记、自己执行返回;深链接无来源时隐藏回退入口。**这是宿主职责的样板,不是运行时能力** | 看板页面查看器路由 |
| `ROUTE-7` | 参数读取入口:`$app/state` 的 `page`(路径段与查询串)、`resolvePageParams`(`packages/runtime/src/page-params.ts`)、`FilterState.fromURL` / `toURL`(`packages/runtime/src/filter-state.ts`) | 三层各管一段。**宿主只读 `pageId` 与原始查询串**,查询串的语义解析在运行时,不要在路由层解析筛选值或页面参数 | 看板页面查看器路由;`RuntimeView.svelte` |
| `ROUTE-8` | 代码分割切点 | 两处:SvelteKit 的路由级自动分割,以及 `packages/widgets/src/components/map-chart/basemap.ts` 里地图底图的动态 `import()`。**页面文档不是分割切点**——它们经 `import.meta.glob` 惰性加载 | 构建期 |

## 规范

#### `PATTERN-ROUTE-1` · 跳转只经端口,统一运行时不碰 history / location

| 项 | 内容 |
| --- | --- |
| 规则 | `packages/runtime*` 与 `packages/widgets` 不得直接调用 `goto` / `history.*` / `location.assign` / 改 `location.href`。跨页跳转与查询串回写一律经 `ROUTE-5` 的端口;宿主侧才允许调框架跳转 API |
| 依据清单 | `ROUTE-5`、`ROUTE-6` |
| 依据样本 | `RuntimeView.svelte` 的 `navigate` / `textLink` 只调 `navigation?.navigate` 与 `navigation?.href`,端口缺席时退化为锚点占位;`$app/navigation` 的导入在 canvas 侧只出现在看板页面查看器一个文件 |
| 违例判定 | `packages/runtime/**`、`packages/runtime-ui/**`、`packages/widgets/**` 出现 `$app/navigation` 导入、`history.pushState` / `replaceState` 直调、`location.href =` 赋值 |

#### `PATTERN-ROUTE-2` · 加看板页面不改路由

| 项 | 内容 |
| --- | --- |
| 规则 | 新增一个看板页面 = 往 `STRUCT-7` 加一份 JSON,不改任何路由文件。`[pageId]` 动态段 + 页面仓储的 glob 会自动收进目录页与查看器。**计划里出现「注册路由」这类步骤就是错的** |
| 依据清单 | `ROUTE-1`、`ROUTE-2`、`ROUTE-7`、`STRUCT-7` |
| 依据样本 | `apps/canvas/src/lib/page-repository.ts` 用 `import.meta.glob('$pages/*.json')` 枚举;`(viewer)/+page.svelte` 直接渲染 `pageRepository.list()`;10 份页面文档没有任何一份在路由里出现过 |
| 违例判定 | 变更里为了加看板页面而新建路由目录,或把页面 id 写进路由代码 |

#### `PATTERN-ROUTE-3` · 无路由守卫、无鉴权路由

| 项 | 内容 |
| --- | --- |
| 规则 | canvas 侧**没有**任何在进入路由前能中断或改写跳转的机制:无 `hooks.client.ts`、无 load 守卫、无页面级鉴权判断。所有路由都是公开的。计划期据此**不要**挂守卫,检视**不得**判「需要登录的路由漏了守卫」 |
| 依据清单 | `ROUTE-1`、`ROUTE-4` |
| 依据样本 | `apps/canvas/src` 下无 `hooks.*` 文件(全仓只有 `apps/platform/src/hooks.server.ts`);canvas 三个路由页面无鉴权分支;数据请求靠 `credentials: 'same-origin'` 的 cookie,见 `PATTERN-API-4` |
| 违例判定 | 新增守卫或鉴权分支而本条未更新 |

#### `PATTERN-ROUTE-4` · URL 查询串的命名空间划分

| 项 | 内容 |
| --- | --- |
| 规则 | 同一个查询串被三方分用,前缀互不识别,谁也不许清掉别人的键:筛选状态占 `d:` / `h:` / `t:` / `m:` / `b:` / `n:` / `s:`,页面参数占 `p:`,宿主保留无前缀键(如精确修订预览的 `revision`)。加新的 URL 语义必须选一个新前缀,不能复用别人的 |
| 依据清单 | `ROUTE-7`、`DATA-3`、`DATA-4` |
| 依据样本 | `packages/runtime/src/filter-state.ts` 头部的前缀表;`page-params.ts` 说明 `fromURL` 认不出 `p:` 会原样忽略;`RuntimeView.svelte` 的 `mergedSearch` 只删筛选器自己声明的键 |
| 违例判定 | 出现无前缀的新查询参数,或某处用 `new URLSearchParams()` 从零重建查询串导致其他命名空间的键被丢弃 |

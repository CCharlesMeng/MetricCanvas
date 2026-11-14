# `@metriccanvas/embed`

`@metriccanvas/embed` 把 MetricCanvas 统一运行时挂载到普通 HTML 页面或第三方浏览器应用中。

这是渲染引擎的 JS 挂载入口，不是独立应用或自定义元素。集成应用通过 JS 地址加载并调用 `mount`；视觉呈现由引擎统一提供，集成应用不配置字体/主题。文档获取、数据网关与登录恢复等边界见[集成应用契约](../../docs/host-contract.md)。

当前页面协议为 **6.13**（读取支持 6.13/6.12/6.11/6.5/旧布局兼容分支）：页面声明普通 URL 与显式动态参数，默认浏览器导航；集成应用可选接管。协议与旧版本迁移见 [ADR-0068](../../docs/adr/0068-plain-url-navigation-protocol.md)。

构建产物：

| 文件 | 用途 |
|---|---|
| `dist/metriccanvas-runtime.global.js` | 经典 `<script>` 加载入口，等待 `MetricCanvas.ready` 后使用全局 API |
| `dist/metriccanvas-runtime.es.js` | ES module |
| `dist/chunks/*.js` | 两种入口共用的模块，带内容哈希，由浏览器自动加载 |
| `dist/package.json` | ESM 类型声明，复制到项目中仍须保留 |
| `dist/index.d.ts` | TypeScript 类型声明 |

## 构建

```bash
pnpm --filter @metriccanvas/embed build
```

构建面向支持原生 ES modules 的现代浏览器，语法目标为 ES2022。产物按图表、绘图基础、运行时、组件、第三方依赖和导出编码等职责拆为约十个模块；widgets 进一步分为表格、图表组件和其他控件，当前完整分发为 16 个 JS。单个 JS 文件原始体积不得超过 1,000,000 字节，由构建检查强制保证。Excel 与底图保持按需加载。组件样式仍由 JS 注入 Shadow DOM，不需要额外加载 CSS 或安装运行依赖。

图表通过 `echarts/core` 统一注册页面协议实际使用的柱、线、饼、地图及散点能力，保留图例、提示、区域着色、类别窗口、标签布局和 Canvas 导出。XLSX 使用只负责生成工作簿的 `write-excel-file/universal`，保留现有类型、格式、多级合并表头、冻结行、多表和异常说明，点击导出时才加载。ExcelJS 仅为开发依赖，用作测试中的独立读取器。构建回归另外约束图表依赖总计 ≤600,000 字节、XLSX 依赖总计 ≤100,000 字节，防止重新引入全量入口；这些数字是未压缩 JS 大小。大文件压缩会使用 Blob Worker，宿主 CSP 的 `worker-src` 需允许 `blob:`。

源码导入的 SVG、PNG、JPEG、GIF、WebP、AVIF、ICO 图片全部编码为 data URL，随 JS 携带，不再外置到 `assets/`。普通导入、`?url` 和 `?inline` 使用同一份图片内容，避免不同后缀重复编码。图片不依赖资源公共路径或 `import.meta.url`，集成应用二次打包时关闭 URL 资源解析也可显示。该规则覆盖大图，不按图片大小回退到文件地址。

内联图片计入每个 JS 文件的 1,000,000 字节上限。图片自身或同一分块内多张图片使 JS 超限时，构建在写出前失败，须先优化图片或减少分块内容；不会自动回退到外置图片。构建和分发门禁同时禁止重新输出图片文件。源码中的 `?raw` 文本导入、业务传入的图片地址和第三方代码内已有的数据 URL 不受此规则处理。

后续修改和交付统一执行[Embed 分发基线](../../docs/agents/embed-distribution.md)。可用 `pnpm --filter @metriccanvas/embed check:dist` 独立检查已构建目录；build、prepack 与 CI 自动执行同一门禁。

### 复制到项目后直接 import

将**完整 `dist/` 内容**复制到项目的静态资源目录（例如 `public/metriccanvas/`），保持两个入口、`chunks/` 与 `package.json` 的相对位置，再从一个公共入口使用：

```html
<div id="dashboard"></div>
<script type="module">
  import { mount } from '/metriccanvas/metriccanvas-runtime.es.js';
  const runtime = mount('#dashboard', { document: pageDocument });
</script>
```

`pageDocument` 为集成应用已取得的页面文档。在项目自身的 JS module 中也可以使用相对路径 import；浏览器或项目构建器会处理依赖，ES 接入无须等待 `ready`，`mount` 仍同步返回具有 `update` / `destroy` 的实例。

复制到 Webpack 5 项目的 `src/` 下时，连同 `package.json` 一起复制；其中的 `"type": "module"` 只作用于该分发目录，使构建器按 ESM 处理内部模块。旧版目录缺少此文件时，可在 `metriccanvas-runtime.es.js` 同级新增 `package.json`，内容为 `{"type":"module"}`，再重新构建项目。无需修改项目根目录的模块类型。缺失时，Webpack 可能对 Rolldown 的 CommonJS 兼容辅助代码产生 `Critical dependency: require function is used...` 警告。

Webpack 5 二次打包支持 Terser `compress.pure_getters:true`。行内子表在首次异步查询、翻页及失败重试完成后直接更新，不需要收起重开，也不需要增加页面配置。兼容性回归复制完整分发目录，在仓外工程重新压缩后通过公开 `mount` 验证，同时覆盖折叠缓存和加载中折叠后的迟到响应隔离。

通过 HTTP/HTTPS 提供文件，JS 响应使用 JavaScript MIME，图片响应使用对应图片 MIME；跨域部署须允许模块请求的 CORS，集成应用 CSP 须允许该资源地址的模块脚本与图片，并在 `img-src` 中允许内置小图使用的 `data:`。不要只复制入口文件，不使用 `file://` 直接打开。global 也消费同一份 ESM 模块，因此不作为旧浏览器降级包。

升级时发布完整目录，入口不设永久缓存，带哈希的 chunks 可长期缓存；保留仍被旧页面引用的分块及旧版本资源，或采用版本目录发布。

**global 加载时序变更：** 旧的同步 `<script>` 后立即调用 API 改为等待 `MetricCanvas.ready`。Promise 完成后所有既有公开 API 可用，失败时 Promise 拒绝；`mount`、`update`、`destroy` 本身的同步调用方式不变。重复加载同一个 global 入口复用已有对象与 ready。

## 挂载仅内联页面

```html
<div id="dashboard"></div>
<script src="./metriccanvas-runtime.global.js"></script>
<script type="module">
  await MetricCanvas.ready;
  const pageDocument = {
    schemaVersion: '6.1', layout: 'report',
    id: 'hello',
    dataSources: {},
    sections: [
      {
        id: 'main',
        components: [
          {
            id: 'header',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title: 'Hello MetricCanvas' }
          }
        ]
      }
    ]
  };

  const runtime = MetricCanvas.mount('#dashboard', {
    document: pageDocument
  });
</script>
```

`inline` 页面不需要数据网关。

## 挂载 DQE 页面

```html
<script>
  const dataGateway = MetricCanvas.createDqeGateway({
    endpoint: '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',
    credentials: 'include'
  });

  const runtime = MetricCanvas.mount('#dashboard', {
    document: pageDocument,
    dataGateway
  });
</script>
```

`query` 和包含查询数据源的 `mixed` 页面要求 `dataGateway`。

DQE 端点和鉴权由集成应用配置。端点、令牌和长期凭据不写入页面文档或静态 HTML。

Schema 元数据只用于页面创作，不传入 Embed。

Report 的动态 AI 总结由集成应用注入 `generate(question, contextInfo): Promise<string>`。contextInfo 包含限定范围内的数据源、字段、查询条件与结果；函数内部自行构建和消费 SSE，最终返回完整 HTML 或纯文字。页面文档不保存端点、鉴权或协议参数。

```js
// 独立文件实现 generate；同一个配置对象跨 Report 挂载复用后台任务与缓存。
const aiSummary = { generate, throttleMs: 1000, concurrency: 2 };
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  dataGateway,
  aiSummary
});
```

本仓 Playground 和 Platform 共用 [云宝助手实现](../engine/runtime-ui/src/ai-summary/adapters/yunbao-assistant.ts)，当前为本地 mock。内网替换该文件中的 generate 函数体即可。提供正文模式不需要此配置；动态模式缺少配置时仅摘要局部显示错误。

## ESM

```js
import {
  createDqeGateway,
  mount
} from './metriccanvas-runtime.es.js';

const dataGateway = createDqeGateway({
  endpoint: '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute'
});

const runtime = mount('#dashboard', {
  document: pageDocument,
  dataGateway
});
```

## 输入

```ts
interface RuntimeInput {
  document: unknown;
  dataGateway?: DataGateway;
  aiSummary?: AiSummaryConfig;
  initialSearch?: string;
  navigation?: RuntimeNavigation;
}
```

| 属性 | 说明 |
|---|---|
| `document` | 未校验的页面文档 |
| `dataGateway` | 查询页面使用的数据网关 |
| `aiSummary` | Report AI 总结调用与会话配置：`generate` 及可选节流、并发、缓存容量与过期时间 |
| `initialSearch` | 页面参数与筛选查询串；省略则自动读取当前 URL，显式空串禁用自动读取 |
| `navigation` | 可选接管；`navigate(target)` 返回 `true` 时阻止默认跳转 |

IOC 页头声明 `props.back:true` 后，浏览器可后退时默认显示返回按钮并调用当前窗口的 `history.back()`（优先 navigation.canGoBack，不支持时回退 history.length>1）。无需配置路由或 `returnContext`；可选 `navigation.back` 覆盖默认动作，提供函数即可显示。`returnContext.label` 可设置无障碍标签。无浏览器环境或判断不可后退时默认隐藏，静态导出不包含按钮；未声明 back 的页头不接管返回。此行为使用原生历史，不额外记录来源或恢复完整页面视图。 `props.back:"auto"` 已废弃，存量声明兼容为 `true`，同样按浏览器可否后退展示并调用 `history.back()`，无需来源记录。6.111 起可显式写 `back:false` 隐藏，省略同样隐藏。自定义覆盖统一用 `navigation.back`；旧 `returnContext.back` 不参与页头返回，`returnContext.label` 仍可设置无障碍标签。刷新、同页参数变化、新标签页和独立进入均遵循当前窗口的浏览器历史，不保证跳回下钻来源。合成验收入口：`/pages/ioc-default-back-source` → `/pages/ioc-default-back-target`，`/pages/ioc-back-hidden` 验证显式关闭。

Embed 的 `mount` 和完整 `update` 在省略 `initialSearch` 时自动读取当前 window 的 URL：合并 `location.search` 与 `#/...?...` / `#!/...?...` 路由查询串，同名键由 hash 路由整组覆盖，重复值保留；普通锚点不作为参数。显式 `initialSearch`（包括空串）优先且不再合并 URL，空串用于隔离宿主 URL。只在挂载/更新时读取，不监听地址变化、不读取父窗口。初始化通过后自动清理未声明的 URL 参数；地址回写与 Angular 适配规则见[URL 参数清理](../../docs/page-metadata/actions-and-navigation.md#url-参数清理与地址同步)。参数解析、必需/单值校验与执行回执输入的权威性沿现行规则；直接使用 RuntimeView 时仍由集成应用传入 initialSearch。合成入口 `/pages/embed-url-params?account-name=合成账号甲` 及 embed 的 `examples/url-params.html`，不访问真实账号或 DQE。

Embed 在 Shadow DOM 中渲染页面，以隔离集成应用样式。

**集成应用必须交出宽度。** 页面外框几何由页面文档的 `layout` 决定：声明 `dashboard` 的页面按满宽看板渲染，挂载容器的可用宽度就是页面宽度，集成应用不得再加 `max-width` 或水平内边距；`report`（缺省）自己定宽居中，对容器宽度不敏感。给定宽容器（例如门户的 1440 内容区）会让看板页在里面被裁掉，运行时检测不到这件事。集成应用的完整义务见 [集成应用契约](../../docs/host-contract.md)。

## 事件

`RuntimeEvent` 是 `@metriccanvas/engine/ui` 的 `RuntimeViewEvent` 的别名，事件形状以该类型定义为唯一真源。事件包括 `ready`、`invalid`、`version-error`、`configuration-error`、`data-error`、`auth-required`、`filter-change`、`tab-change`、`navigate`。

```js
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  dataGateway,
  onAuthRequired: ({ status }) => hostAuth.goToLogin(),
  onEvent(event) {
    if (event.type === 'navigate') {
      hostObserveNavigation(event.href, event.sourcePageId, event.sourceSearch);
    }
  }
});
```

Embed 通过事件通知筛选变化和导航。链接默认跳转；若要接管，使用 `navigation.navigate` 返回 `true`（见[集成应用契约](../../docs/host-contract.md)），不要在观察事件中重复跳转。筛选变化不会自动写入地址栏，集成应用可选择同步。查询串使用普通值，由接收页声明解释；没有私有类型前缀。

`data-error` 事件在页面数据源进入错误态(或错误内容变化)时上抛一次，携带页面数据源 id、稳定查询错误分类(`DataErrorEvent['code']`，未携带分类的异常为 `UNKNOWN`)与脱值消息。集成应用按 `code` 决定重试、引导重新登录或展示失败，不要解析 `message` 字符串。

`onAuthRequired` 是可选运行输入，适用于 DQE HTTP 401、403、419。传入后 MC 先终止当前页面请求、丢弃迟到结果并清理自身页面缓存，再通知 `auth-required {status}` 并调用一次方法；不等待登录、不重试、不更改凭据。未传方法时只通知，保留原有错误态。网关配置和页面 JSON 不变；其他错误不触发此处理。`update` 省略方法即移除，替换方法本身不重启查询；已失效实例须 `destroy` 后重新挂载。应用自行负责登录地址、凭据及自身缓存。具体范围见[集成应用契约](../../docs/host-contract.md#dqe-401--403--419-登录处理)。

`version-error` 表示页面声明的 `schemaVersion` 超出引擎支持区间，渲染与查询均停止。事件给出 `requiredSchemaVersion`（页面需要的协议版本）、`currentSchemaVersion`（引擎支持的最新协议版本）、`supportedSchemaVersions`（支持列表）与可读 `message`。这些字段指页面协议版本，与 npm 包 SemVer 无关。集成应用应提供支持该协议版本的引擎；不要自动改写页面版本。缺失或格式非法的 `schemaVersion` 仍通过 `invalid` 返回文档错误。更新为受支持的合法文档后，同一实例可恢复渲染。

## 生命周期

更新实例：

```js
runtime.update({
  document: nextPageDocument,
  dataGateway,
  initialSearch: 'region=east'
});
```

销毁实例：

```js
runtime.destroy();
```

生命周期规则：

- 同一目标元素同时只能挂载一个活动实例；
- 对同一 DOM 元素重复 `mount(target, options)` 会按 `update` 语义替换完整运行输入并返回原句柄，不创建第二个实例或抛出重复挂载错误；CSS 选择器和元素引用只要指向同一元素就共享实例；
- 重复 `mount` 使用本次 `onEvent` 替换旧回调，省略时移除旧回调；普通 `runtime.update(input)` 保留当前回调。各次 `mount` 返回的句柄相同，任一个句柄的 `destroy` 都会结束该实例，因此同一容器应有一个生命周期所有者；
- `update` 替换页面文档和运行依赖；
- 更新后，既有页面会话的异步结果不写入新页面；
- `destroy` 清理 Shadow DOM 和运行时会话；
- 重复调用 `destroy` 是安全操作；
- 已销毁实例不接受 `update`。

重复挂载、最新文档更新与销毁后重挂载的可操作示例：构建后运行 `pnpm --filter @metriccanvas/embed preview:examples`，访问 `/examples/mount-lifecycle.html`。同一页面文档也可在 Playground 的 `/pages/embed-mount-lifecycle` 查看，数据为内联合成计数；宿主 API 行为在 HTML 示例中验收。组件卸载时仍需调用 `destroy()`，清空容器或丢弃句柄不会销毁运行时会话。

## 配置错误

| 错误 | 条件 |
|---|---|
| `DATA_GATEWAY_REQUIRED` | 查询页面未提供数据网关 |
| `DATA_GATEWAY_INVALID` | 提供的数据网关不符合运行时端口 |

页面结构错误通过 `invalid` 事件返回。

## 示例

启动示例服务器：

```bash
pnpm --filter @metriccanvas/embed build
pnpm --filter @metriccanvas/embed preview:examples
```

地址：

```text
http://127.0.0.1:4175/examples/report.html
http://127.0.0.1:4175/examples/inline.html
http://127.0.0.1:4175/examples/query.html
http://127.0.0.1:4175/examples/esm.html
```

| 示例 | 内容 |
|---|---|
| `report.html` | 完整静态报告 |
| `inline.html` | 最小仅内联页面 |
| `query.html` | DQE 查询页面 |
| `esm.html` | ES module 接入 |
| `navigation.html` | 无导航适配器；由 `/pages/ioc-project-overview` 进入，概览→清单→详情 |

页面协议见 [PAGE-METADATA.md](../../PAGE-METADATA.md)。


6.1 的布局兼容读取与存量迁移见 [迁移说明](../../docs/page-metadata/layout-migration.md)：旧 `layoutForm` 仅在文档输入边界接受，双字段同时出现拒绝，规范化后只写6.1 `layout`。先核验原始修订hash，再规范化；历史修订不原地重写。

## 消费执行结果

已接可信执行适配器的宿主可以用 `loadExecution(request, executionPort, signal)` 加载，或用 `prepareExecution(request, response)` 校验已有回执，再挂载：

```js
const execution = await MetricCanvas.loadExecution(request, executionPort, signal);
const runtime = MetricCanvas.mount('#dashboard', {
  document: execution.document,
  execution,
  dataGateway // 后续筛选、分页继续使用既有网关
});
```

ESM 同名导出也可用。初始实际参数/筛选及逐源快照来自执行回执，URL 不覆盖它们。缺源、错目标、错条件、非法文档拒绝；部分源失败保留其它源。执行端口缺席返回 `CAPABILITY_UNAVAILABLE`。未传 execution 时沿用现有流程。

需要最后筛选记录时，由可信宿主创建 `createLastFilterRecorder(context, port, onStatus)`，将其 `record` 传给 `prepareExecution` 第三个参数。宿主在销毁或身份切换时调用 recorder.dispose，并给新实例新的 clientId。记录失败不回滚当前筛选；服务须保证历史写入顺序及权限复核。内部 DTO、来源核对、精确预览及待提供方确认的边界见 [执行消费契约](../../docs/archive/authoring-tickets-126/t18-execution-contract.md)。

## 完整 PDF 接入

从页面协议6.28起，Report顶层页头声明`props.pdfExport: {label: "下载报告", filename: "经营分析报告.pdf"}`即可启用内置下载；两项可省略，默认按钮为“下载 PDF”，文件名取页头标题。按钮与filterIds共用工具带，无日期控件也可显示。HTML运行时分包已包含PDF依赖，集成应用无需自行安装html2canvas或jsPDF，也无需编写下载回调。更新使用包含本能力的新运行时产物。

`withExportView`及其静态DOM类型已移除，不提供旧入口兼容。整页PDF只通过页面声明的内置按钮下载，没有取消按钮。图片与PDF编码在Dedicated Worker执行，主线程分批处理DOM；浏览器须支持Worker、ImageBitmap、OffscreenCanvas，宿主CSP允许`worker-src blob:`。范围、固定限额、错误与生命周期见[接入说明](../../docs/report-export.md)。

### Report 导出按钮（6.31）

在报表顶层页头统一配置`exportButtons: [{format, label?, filename?, scale?}]`，每项一个直接下载按钮；PNG默认3倍、支持3/4倍，PDF默认2倍、支持2/3/4倍；结果始终为一张完整PNG。单张长图由独立文档和Worker行流式编码生成，不提供多文件或其他图片格式回退。既有PDF独立保留；完整声明及运行限制见[报告页头](../../docs/page-metadata/components/reportHeader.md#导出按钮631)和[报告导出](../../docs/report-export.md)。[HTML例子](examples/report-image-download.html)直接消费`pages/capabilities/export/report-png-export.json`，不需集成应用安装截图/编码依赖。正常父文档水印被隔离，主动向frame注入的门户脚本仍需真实接入验收。

Tab混合内容的活动项使用 `tab.<组件id>` 查询参数。`navigation.replaceSearch` 接收初始化清理、筛选与页签更新；Embed 默认处理地址同步，事件用于观察与记录，无需再次写 URL，也不立即回灌 update。既有对事件联合做穷尽switch的消费者需要补充tab-change分支。组件局部筛选沿用既有筛选URL；表格分页、排序、搜索草稿和滚动不新增URL编码。


## 宿主共享筛选值示例

`examples/shared-filter-bridge.ts` 是可复制的宿主 Adapter 示例，复用 initialSearch 和 filter-change。应用创建一个 bridge，使用 projectNavigationInputs(document).filters 与显式 `{共享键:页面筛选器id}` 映射初始化查询串；合法的显式 URL 值优先。每次 filter-change 调用 recordSearch，切页时用同一 bridge 生成下一页输入，false 与清空都回写。clear 取消继承该值，目标页继续应用自身默认值。仅支持 boolean、dimension 和 timePoint 的公共项，并检查维度、层级声明和精度兼容；私有筛选不传入。

示例不通过 update 回灌每次页内变化，不创建跨页 FilterState 单例。未声明映射的筛选值留在各页，候选回执、表格与导出状态也不共享。应用负责 bridge 的用户会话生命周期；一个活动页面以外的实时同步需要额外宿主契约。execution 快照模式不叠加这层初始化。

运行 `MC_EMBED_EXAMPLE_PORT=4177 pnpm --filter @metriccanvas/embed preview:examples`，访问 `/pages/key-office-filter-demo`，其“切换页面”跳到目标页。两页只用合成 Adapter，sessionStorage 模拟宿主跨整页会话。接入真实 HeaderOptionService 时由宿主替换存储与候选逻辑，并验证真实字段、权限与编码。

## IOC Header RegionFilter

Schema 6.91 支持页头 `props.components` 组合控件。显式 `regionFilter` 自带标准组织层级，集成应用在原 dataGateway 上调用一次 `withOperationMapRegion(base, adapter)`，所有页面复用；业务查询仍使用原 `filterBindings.region`。接线示例、候选值约定与取消/失败边界见[Operation Map Region 接入](../../docs/host-contract.md#operation-map-region-接入)。

## 详情弹层与集成应用侧栏

详情弹窗和抽屉通过原生 `dialog.showModal()` 进入浏览器顶层，遮罩覆盖同一文档的整个窗口及集成应用侧栏，打开期间背景不可交互。页面仍可 mount 到小 div，弹层保留在原 ShadowRoot 内；无需新增挂载参数。关闭按钮、Esc、点击遮罩及首尾焦点循环可用，页面更新与 destroy 会清理弹层。iframe 内只能覆盖当前 iframe 文档。

运行 `pnpm build`、`MC_EMBED_EXAMPLE_PORT=4186 pnpm preview:examples`，打开 [带侧栏的小 div 挂载示例](http://127.0.0.1:4186/examples/detail-overlay.html)。它使用 `pages/capabilities/table/table-detail-overlay.json` 的内联合成数据，覆盖高层级侧栏、transform 和 overflow 裁剪，不依赖 DQE。

## 默认 URL 清理与 Angular 接入

初始化通过后自动删除未声明的 URL 参数；页面参数、筛选器实际 URL 名称和 Tab 输入保留，值不被重写，非法已声明输入仍按原规则报错。清理只替换当前历史记录，不刷新、不增加记录、不重查、不发送筛选或 Tab 变更事件。详细行为见[URL 参数清理与地址同步](../../docs/page-metadata/actions-and-navigation.md#url-参数清理与地址同步)。

普通浏览器接入无需提供 `replaceSearch`。宿主有自用参数时显式认领：

```ts
mount(container, {
  document,
  navigation: { preserveSearchParams: ['resource', 'tenant'] }
});
```

默认实现保留当前 `history.state`、路径、锚点，支持普通 query 与 `#/...?...` / `#!/...?...`；不访问父窗口、不派发伪造路由事件。`navigation.replaceSearch` 自定义实现优先，其他导航回调继续保留。地址回写支持同步或 `Promise<void>`，失败时输出诊断而不打断已初始化页面。需要自行管理地址时提供回调；完整 update 未再提供覆盖时恢复默认实现。多个实例共享同一宿主 URL 时，由宿主提供统一地址适配器协调。

Operation Map 使用 Angular，建议采用[完整 Angular 适配示例](examples/angular-navigation.ts)：

```ts
import { createAngularNavigation } from './angular-navigation';

const navigation = createAngularNavigation(router, ngZone, ['resource', 'tenant']);
const runtime = mount(container, { document, navigation });
```

示例通过 Angular Router 解析当前 UrlTree，只替换 query，保留重复键、宿主键、路径和 fragment，经 `NgZone.run` 执行 `navigateByUrl(...,{replaceUrl:true})`。Angular 自己处理 path/hash location strategy，引擎不引用 Angular 运行依赖。导航取消会作为同步失败诊断，不自动反复导航。

宿主订阅应按页面身份（例如 pageId / revisionId）变化装载文档；仅 query 变化不重新 mount/update，否则会重建页面会话和发起重复查询。清理及页内筛选使用同一接缝。Router 仍会产生导航事件，其守卫、resolver 与 Operation Map 的实际组件生命周期需要宿主环境确认。

合成演示：`/pages/url-input-cleanup?account=合成账号&active=true&view=detail&unused=删除`。本仓浏览器覆盖默认 ES/global 与自定义回调；不以合成回调测试替代真实 Operation Map 接入验收。

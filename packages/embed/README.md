# `@metriccanvas/embed`

`@metriccanvas/embed` 把 MetricCanvas 统一运行时挂载到普通 HTML 页面或第三方浏览器应用中。

这是渲染引擎的 JS 挂载入口，不是独立应用或自定义元素。宿主通过 JS 地址加载并调用 `mount`；视觉呈现由引擎统一提供，宿主不配置字体/主题。文档获取、数据网关与登录恢复等边界见[宿主契约](../../docs/host-contract.md)。

当前页面协议为 **6.0**：页面声明普通 URL 与显式动态参数，默认浏览器导航；宿主可选接管。协议与旧版本迁移见 [ADR-0068](../../docs/adr/0068-plain-url-navigation-protocol.md)。

构建产物：

| 文件 | 用途 |
|---|---|
| `dist/metriccanvas-runtime.global.js` | 经典 `<script>`，全局名为 `MetricCanvas` |
| `dist/metriccanvas-runtime.es.js` | ES module |
| `dist/index.d.ts` | TypeScript 类型声明 |

## 构建

```bash
pnpm --filter @metriccanvas/embed build
```

## 挂载仅内联页面

```html
<div id="dashboard"></div>
<script src="./metriccanvas-runtime.global.js"></script>
<script>
  const pageDocument = {
    schemaVersion: '6.0',
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

DQE 端点和鉴权由宿主应用配置。端点、令牌和长期凭据不写入页面文档或静态 HTML。

Schema 元数据只用于页面创作，不传入 Embed。

包含 `aiSummary` 的页面由宿主提供固定的 AI 总结连接配置。页面文档本身不保存端点或协议参数：

```js
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  dataGateway,
  aiSummary: {
    conversationBaseUrl: '/ai/conversations/',
    env: 'beta'
  }
});
```

`env` 可选。缺少 `aiSummary` 配置时，只由当前 AI 总结组件显示配置错误，页面其他内容继续渲染。

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
| `aiSummary` | AI 总结组件的连接配置，仅包含 `conversationBaseUrl` 与可选 `env` |
| `initialSearch` | 不含前导 `?` 的页面参数与筛选查询串 |
| `navigation` | 可选接管；`navigate(target)` 返回 `true` 时阻止默认跳转 |

Embed 在 Shadow DOM 中渲染页面，以隔离宿主样式。

**宿主必须交出宽度。** 页面外框几何由页面文档的 `layoutForm` 决定：声明 `dashboard` 的页面按满宽看板渲染，挂载容器的可用宽度就是页面宽度，宿主不得再加 `max-width` 或水平内边距；`report`（缺省）自己定宽居中，对容器宽度不敏感。给定宽容器（例如门户的 1440 内容区）会让看板页在里面被裁掉，运行时检测不到这件事。完整宿主义务见 [宿主契约](../../docs/host-contract.md)。

## 事件

`RuntimeEvent` 是 `@metriccanvas/runtime-ui` 的 `RuntimeViewEvent` 的别名，事件形状以该类型定义为唯一真源。当前事件类型：`ready`、`invalid`、`configuration-error`、`data-error`、`filter-change`、`navigate`。

```js
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  dataGateway,
  onEvent(event) {
    if (event.type === 'navigate') {
      hostObserveNavigation(event.href, event.sourcePageId, event.sourceSearch);
    }
    if (event.type === 'data-error' && event.code === 'DQE_AUTH_REQUIRED') {
      hostAuth.promptLogin();
    }
  }
});
```

Embed 通过事件通知筛选变化和导航。链接默认跳转；若要接管，使用 `navigation.navigate` 返回 `true`（见[宿主契约](../../docs/host-contract.md)），不要在观察事件中重复跳转。筛选变化不会自动写入地址栏，宿主可选择同步。查询串使用普通值，由接收页声明解释；没有私有类型前缀。

`data-error` 事件在页面数据源进入错误态(或错误内容变化)时上抛一次，携带页面数据源 id、稳定查询错误分类(`@metriccanvas/page` 的 `QueryErrorCode`，未携带分类的异常为 `UNKNOWN`)与脱值消息。宿主按 `code` 决定重试、引导重新登录或展示失败，不要解析 `message` 字符串。

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
- `update` 替换页面文档和运行依赖；
- 更新后，既有页面会话的异步结果不写入新页面；
- `destroy` 清理 Shadow DOM 和运行时会话；
- 重复调用 `destroy` 是安全操作；
- 已销毁实例不接受 `update`。

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

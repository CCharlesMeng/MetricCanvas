# `@metriccanvas/embed`

`@metriccanvas/embed` 把 MetricCanvas 统一运行时挂载到普通 HTML 页面或第三方浏览器应用中。

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

## 挂载静态页面

```html
<div id="dashboard"></div>
<script src="./metriccanvas-runtime.global.js"></script>
<script>
  const pageDocument = {
    schemaVersion: '4.0',
    id: 'hello',
    dataSources: {},
    sections: [
      {
        id: 'main',
        layout: { type: 'grid', columns: 12 },
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
}
```

| 属性 | 说明 |
|---|---|
| `document` | 未校验的看板页面文档 |
| `dataGateway` | 查询页面使用的数据网关 |
| `aiSummary` | AI 总结组件的连接配置，仅包含 `conversationBaseUrl` 与可选 `env` |
| `initialSearch` | 不含前导 `?` 的筛选状态查询串 |

Embed 在 Shadow DOM 中渲染页面，以隔离宿主样式。

## 事件

```ts
type RuntimeEvent =
  | { type: 'ready'; pageId: string }
  | { type: 'invalid'; errors: TypedError[] }
  | {
      type: 'configuration-error';
      code: 'DATA_GATEWAY_REQUIRED' | 'DATA_GATEWAY_INVALID';
      message: string;
    }
  | { type: 'filter-change'; search: string }
  | { type: 'navigate'; pageId: string; search: string };
```

```js
const runtime = MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  dataGateway,
  onEvent(event) {
    if (event.type === 'navigate') {
      hostRouter.navigate(event.pageId, event.search);
    }
  }
});
```

Embed 通过事件通知宿主筛选变化和页面导航，不修改宿主 URL。

## 生命周期

更新实例：

```js
runtime.update({
  document: nextPageDocument,
  dataGateway,
  initialSearch: 'region=d%3Aregion%3Aeast'
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
| `inline.html` | 最小静态页面 |
| `query.html` | DQE 查询页面 |
| `esm.html` | ES module 接入 |

页面协议见 [PAGE-METADATA.md](../../PAGE-METADATA.md)。

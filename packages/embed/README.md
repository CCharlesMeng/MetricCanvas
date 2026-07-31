# `@metriccanvas/embed`

面向普通 HTML 的 MetricCanvas 统一运行时挂载模块。构建后提供：

- `dist/metriccanvas-runtime.global.js`：经典 `<script>`，全局名 `MetricCanvas`
- `dist/metriccanvas-runtime.es.js`：ES module
- `dist/index.d.ts`：TypeScript 类型声明

## 最小用法

```html
<div id="dashboard"></div>
<script src="./metriccanvas-runtime.global.js"></script>
<script>
  const pageDocument = {
    schemaVersion: '3.0',
    id: 'hello',
    dataSources: {},
    sections: [{
      id: 'main',
      layout: { type: 'grid', columns: 12 },
      components: [{
        id: 'header',
        type: 'reportHeader',
        layout: { span: 12 },
        props: { title: 'Hello MetricCanvas' }
      }]
    }]
  };

  const runtime = MetricCanvas.mount('#dashboard', {
    document: pageDocument
  });
</script>
```

`inline` 看板页面不需要其他运行依赖。DQE `query` 或 `mixed` 看板页面额外传入数据网关：

```js
MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  dataGateway
});
```

宿主负责取得页面文档、配置生产 DQE 端点并完成鉴权。长期凭据不得写入页面文档、HTML 或构建产物。

Schema 元数据只服务创作期，不传入嵌入式统一运行时。DQE 页面需要的结果字段契约和查询字段映射已经包含在页面文档中。

筛选和跨页下钻通过 `onEvent` 通知宿主；嵌入模块不修改宿主 URL。

## 生命周期

- `runtime.update(input)`：替换页面文档与依赖，旧会话结果不会写入新页面；
- `runtime.destroy()`：清理实例，重复调用安全；
- 同一目标元素同时只能存在一个活动实例。

## 示例

`examples/report.html` 是面向最终展示的独立 HTML 页面，默认加载 `/pages/tokens-report.json`。该页面使用纯 `inline` 页面数据源，因此不需要数据网关。

```bash
pnpm --filter @metriccanvas/embed build
pnpm --filter @metriccanvas/embed preview:examples
```

打开：

```text
http://127.0.0.1:4175/examples/report.html
```

其他示例：

- `examples/inline.html`：v3 静态页面；
- `examples/query.html`：v3 DQE 动态页面；
- `examples/esm.html`：ES module 接入。

页面协议见仓库根目录 [PAGE-METADATA.md](../../PAGE-METADATA.md)。

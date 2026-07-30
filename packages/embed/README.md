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
    schemaVersion: '2.0',
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
```

inline 看板页面不需要其他依赖。query/mixed 看板页面必须额外传入当前
元数据快照和数据网关：

```js
MetricCanvas.mount('#dashboard', {
  document: pageDocument,
  catalog,
  dataGateway
});
```

宿主负责取得页面文档、元数据快照以及生产鉴权。长期凭据不得写入页面文档、
HTML 或构建产物。筛选和跨页下钻通过 `onEvent` 通知宿主；嵌入模块不修改宿主
URL。

## 生命周期

- `runtime.update(input)`：替换页面文档与依赖，旧会话结果不会写入新页面。
- `runtime.destroy()`：清理实例；重复调用安全。
- 同一目标元素同时只能存在一个活动实例。

## 最终报告页

`examples/report.html` 是面向最终展示的独立 HTML 页面：没有 Canvas 或页面搭建
工作台外壳，默认从 `/pages/tokens-report.json` 取得真实看板页面文档，并在客户端
挂载统一运行时。通过 `?page=<页面文档 URL>` 可替换页面来源；当前默认示例使用
纯 inline 页面，因此无需元数据快照或数据网关。

```bash
pnpm --filter @metriccanvas/embed build
pnpm --filter @metriccanvas/embed preview:examples
```

然后打开 `http://127.0.0.1:4175/examples/report.html`。其他可运行示例包括
`examples/inline.html`、`examples/query.html` 和 `examples/esm.html`。

# 页面数据执行

与浏览器引擎共用已有页面的参数物化、生效查询、查询结果绑定和DQE归一化。Node.js 22+可单独安装，依赖只有页面协议；不需要Svelte或ECharts。

```ts
import { createPageDataExecutor } from '@metriccanvas/data-execution';
import { createDqeGateway } from '@metriccanvas/data-execution/dqe';

const executor = createPageDataExecutor({
  gateway: createDqeGateway({ endpoint: trustedEndpoint, headers: trustedHeaders })
});
const filledMetadata = await executor.execute(metadata);
```

metadata是完整页面文档，params已填写本次值。输出只有完整页面副本：成功查询替换source.initial，失败保留输入中的旧initial；原本没有的仍没有。每次执行都重新取数，旧initial不进入本轮查询依赖。原始字段行写入initial，compute和查询引用保留，引擎负责最终计算。

执行主页面全部可执行查询源，含各Tab、未直接绑定组件的辅助源和snapshot详情。query详情按点击上下文另行执行。所有源不等于所有行：Top5仍取Top5，分页保留初始窗口，完整辅助源遵循resultScope。

改变查询参数时先使用`@metriccanvas/page`的`resolvePageParams(metadata, values)`填值，其返回document清除受影响源及下游旧initial；然后执行返回的document。同条件刷新保留旧initial，只改展示参数不清数据。直接手改params而保留旧initial，不会让execute自动识别旧数据属于哪个条件。

## Node程序

安装后命令为`metriccanvas-execute-page`。stdin只读完整metadata JSON，stdout只写完整metadata JSON；不可执行的页面或部署配置退出非零。源级查询失败仍按部分回填返回，退出零不表示所有源本次成功。

可信部署程序按每次调用供给：

| 环境变量 | 内容 |
|---|---|
| `METRICCANVAS_DQE_ENDPOINT` | 绝对DQE执行URL |
| `METRICCANVAS_DQE_HEADERS` | 当前调用身份所需请求头的JSON对象，缺省空对象 |
| `METRICCANVAS_DQE_TIMEOUT_MS` | 可选单次HTTP超时；缺省使用数据网关默认值 |

端点、身份和命令属于可信接入配置，不来自模型或metadata。需要代理、证书或动态凭据时，程序化使用`executePageDataProgram(metadata, config)`，从`@metriccanvas/data-execution/node`导入并注入fetchImpl。

`./runtime`供锁步版本引擎接入查询核心和初始化；浏览器订阅、缓存、取消与计算留在引擎。`./dqe`提供原数据网关导出，`@metriccanvas/engine/dqe`兼容再导出同一实现。

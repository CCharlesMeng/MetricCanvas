# Embed 分发基线

本基线适用于影响 embed 产物的运行时、组件、第三方依赖、构建配置与分发更新，是后续验证和交付的固定要求。

## 体积与入口

- **每个发布 JavaScript 文件未压缩原始体积 ≤1,000,000 字节。** `1M` 固定采用十进制口径；`.js`、`.mjs`、`.cjs`、公共入口与异步分块全部计入。压缩传输体积、归档体积或平均值不能替代逐文件检查。
- 超限时调整模块边界或减少依赖；上限属于用户确认的产品基线，调整上限需要用户明确变更要求。
- 保留稳定的 `metriccanvas-runtime.es.js` 与 `metriccanvas-runtime.global.js`。两种风格共用内部模块，ES 直接 import；global 在 `MetricCanvas.ready` 完成后提供原公开 API，`mount` 同步返回 `update` / `destroy` 实例。
- 以约十个分块为目标，widgets 按表格、图表组件和其他控件继续拆分后，当前门禁为完整分发 10–16 个 JS 文件；公共入口各小于 10,000 字节。Excel 与底图保留按需导入，组件样式继续注入挂载根。
- 图表由统一模块使用 `echarts/core` 注册页面协议及引擎生成选项需要的能力；高级 `echartsOption` 的既有允许范围保持。XLSX 使用 `write-excel-file/universal` 生成工作簿，ExcelJS 仅作开发依赖中的独立读取器。依赖回归门禁按 `charts~`、`excel~` 分别汇总，原始 JS 总计上限为 600,000 / 100,000 字节，不能通过换分块数量掩盖全量入口回流。大文件压缩使用 Blob Worker，宿主 CSP 的 `worker-src` 需允许 `blob:`。验证图表变体、地图与散点、类别窗口、图片导出，以及 Excel 数字/日期格式、合并表头、冻结行、多表和异常说明；Excel 仍在用户导出时加载。
- 完整目录须自包含：所有静态与动态字面量导入、模块相对 URL 引用指向包内实际文件。复制、发布和升级均包含完整 `chunks/`，分块由浏览器自动加载。
- 源码导入图片全部编码为 data URL，不生成外置图片或模块相对图片 URL，不按大小回退到文件地址。普通导入、`?url` 和 `?inline` 共用同一图片模块；`?raw` 文本和第三方预置数据 URL 保持原语义，业务传入图片地址保持由集成应用提供。内联数据计入 JS 体积门禁；单图或多图聚合使任一 JS 超过 1,000,000 字节时，构建在写出前失败，要求先优化图片或减少分块内容。构建与分发门禁均禁止外置图片文件。实际库构建回归覆盖超过原 8 KiB 阈值的大图，以及单图超限、多图聚合超限。
- 分发目录携带 `package.json` 的 `"type": "module"` 声明；复制到集成应用的源码目录时必须保留，不能依赖本仓或 npm 包外层的 ESM 声明。

## 必须执行的验证

1. `pnpm --filter @metriccanvas/embed build`：构建 JS 与声明，并自动执行 `check:dist`。任何文件超限、入口缺失、分块数量或引用闭合不符合要求，命令失败。
2. `pnpm --filter @metriccanvas/embed check:dist`：对本次已经生成的产物单独复核。CI 的产品构建 job 显式执行此项；prepack 通过 build 执行同一门禁。
3. `pnpm --filter @metriccanvas/embed check`：组件与宿主类型检查。
4. `pnpm --filter @metriccanvas/embed exec playwright test`：验证 ES/global、复制完整目录、公开 API、模块复用、加载失败与已有页面行为。内置图片须在页面 `<base>` 不同于分发地址时正确加载；Webpack 5 development/production 在 URL 资源解析开启和关闭两种配置下重新打包，内置图片及经真实 Embed 配置构建的大图均须正常解码。更换源码基线或转移实现后，对对应产物重新执行。
5. 实际打包并核对归档包含全部 JS；ZIP 或 tarball 解包后逐文件沿用相同体积上限。发布兼容性继续按 [构建与仓外兼容性门禁](../../tools/package-build/README.md) 执行。

分包匹配统一处理正斜杠、反斜杠与混合分隔符；依赖和产品源码的归属由 `tests/embed-chunking.test.ts` 对实际 Vite 配置回归。CI 的 `embed-distribution` 矩阵必须在 Linux、Windows **各自原生构建 embed**，执行同一 1 MB 门禁并上传完整 dist；该矩阵纳入最终 `ci` 汇总。Windows 上其他产品的分发通过，不能替代 Windows embed 构建通过。

该矩阵同时执行 `distribution.spec.ts` 与 `webpack-consumer.spec.ts`：完整复制到仓外独立目录，原生 ES/global 接入通过；Webpack 5 development/production 默认模块解析不得出现构建错误或依赖警告，重新打包后挂载、按需 Excel 导出与销毁通过。不得通过忽略 Critical dependency 警告或更改集成应用根模块类型代替修复分发边界。

验收记录给出源码提交/树与锁文件、构建参数、JS 文件数、最大文件及精确字节数、两种入口和浏览器结论。体积检查不能替代浏览器行为验收，源码检查不能替代发布归档核验。真实 DQE/Relay、远端 CI 与部署分别按实际证据报告。

机器检查真源为 `packages/embed/tests/bundle-output.test.mjs`；本页拥有基线口径，接入代码与完整复制方式见 [embed README](../../packages/embed/README.md)。

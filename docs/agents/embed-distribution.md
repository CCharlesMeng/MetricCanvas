# Embed 分发基线

本基线适用于影响 embed 产物的运行时、组件、第三方依赖、构建配置与分发更新，是后续验证和交付的固定要求。

## 体积与入口

- **每个发布 JavaScript 文件未压缩原始体积 ≤1,000,000 字节。** `1M` 固定采用十进制口径；`.js`、`.mjs`、`.cjs`、公共入口与异步分块全部计入。压缩传输体积、归档体积或平均值不能替代逐文件检查。
- 超限时调整模块边界或减少依赖；上限属于用户确认的产品基线，调整上限需要用户明确变更要求。
- 保留稳定的 `metriccanvas-runtime.es.js` 与 `metriccanvas-runtime.global.js`。两种风格共用内部模块，ES 直接 import；global 在 `MetricCanvas.ready` 完成后提供原公开 API，`mount` 同步返回 `update` / `destroy` 实例。
- 以约十个分块为目标，当前门禁为完整分发 10–14 个 JS 文件；公共入口各小于 10,000 字节。Excel 与底图保留按需导入，组件样式继续注入挂载根。
- 完整目录须自包含：所有静态与动态字面量导入指向包内实际文件。复制、发布和升级均包含完整 `chunks/`，分块由浏览器自动加载。

## 必须执行的验证

1. `pnpm --filter @metriccanvas/embed build`：构建 JS 与声明，并自动执行 `check:dist`。任何文件超限、入口缺失、分块数量或引用闭合不符合要求，命令失败。
2. `pnpm --filter @metriccanvas/embed check:dist`：对本次已经生成的产物单独复核。CI 的产品构建 job 显式执行此项；prepack 通过 build 执行同一门禁。
3. `pnpm --filter @metriccanvas/embed check`：组件与宿主类型检查。
4. `pnpm --filter @metriccanvas/embed exec playwright test`：验证 ES/global、复制完整目录、公开 API、模块复用、加载失败与已有页面行为。更换源码基线或转移实现后，对对应产物重新执行。
5. 实际打包并核对归档包含全部 JS；ZIP 或 tarball 解包后逐文件沿用相同体积上限。发布兼容性继续按 [构建与仓外兼容性门禁](../../tools/package-build/README.md) 执行。

验收记录给出源码提交/树与锁文件、构建参数、JS 文件数、最大文件及精确字节数、两种入口和浏览器结论。体积检查不能替代浏览器行为验收，源码检查不能替代发布归档核验。真实 DQE/Relay、远端 CI 与部署分别按实际证据报告。

机器检查真源为 `packages/embed/tests/bundle-output.test.mjs`；本页拥有基线口径，接入代码与完整复制方式见 [embed README](../../packages/embed/README.md)。

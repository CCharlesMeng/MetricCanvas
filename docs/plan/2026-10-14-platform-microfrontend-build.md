# Platform 微前端调试包与后续分块

日期：2026-10-14。用户已选择第一期方案二：保留 UMD 单文件，先解决浏览器源码调试；方案一记录为第二期，后续实施。第一期实施与验收结果见 [证据](../evidence/platform-debug-build.md)，命令与使用方式见 [平台打包与调试](../platform-build.md)。

## 第一期：独立调试包

范围：保留现有 Vite 构建和 qiankun HTML/UMD/CSS 交付，增加独立 debug profile。调试包沿用生产编译语义，JS/CSS 不压缩，附包含 TS/Svelte 源内容的 JS source map；CSS 不提供 map。生产和调试目录、归档及 SHA-256 分开，现有生产命令保留，新增统一打包命令和 CI 产物。

部署 Adapter 契约、固定 UMD 文件名和生命周期不变，两种包均可使用归档内自带的组合脚本。打包验证排除运行时开发入口与凭据、拒绝生产目录 map、校验调试 map 完整性与构建机绝对路径。源码树摘要覆盖 UI 与数据执行等实际源码依赖。

验收：生产/调试构建、独立构建、组合回归、真实 qiankun 候选 loader 的业务回归、下载调试归档后仓外组合、两个静态前缀、TS/Svelte 实际断点及错误堆栈源码映射。平台类型检查与真实门户验收分别报告，不能用 source map 文件存在替代实际命中。

## 第二期：真正分块（未实施）

### 目标与取舍

将资源组织、独立缓存和按需加载作为单独目标。当前微前端为 Vite library mode UMD，生产源码聚合为一个大文件；关闭压缩和加 map 解决调试，但不改变下载与缓存粒度。

本地 Rolldown 最小动态 import 探针表明：显式 `codeSplitting: true` 下，UMD/IIFE 各输出一个文件，ESM 才输出入口和 lazy chunk。现有 ESM 启动数据沙箱问题见 `docs/evidence/qiankun-platform/implementation.md`，不能直接把 ESM 替换视为已验证路线。

候选推荐：Vite 继续负责开发与独立入口；qiankun 微前端使用专用 Webpack 5 构建，输出经典脚本入口与 chunks。Svelte 官方 loader 提供 Svelte 5/TypeScript/CSS/source map 接线，但本仓与 qiankun 兼容性尚未验证。

代价：维护两套编译配置，需对齐 Svelte 版本、解析条件、别名、生产常量和样式处理；两者消费同一业务源码。第二期开始前重新核对当时的 Vite/Rolldown 与 qiankun 能力，再冻结工具选择。第一期批准不代表第二期可以自动切换工具链。

### 建议产物

```text
microfrontend/                 # 生产；debug 另有同结构目录和 maps
  index.html
  assets/
    platform.<hash>.js          # 生命周期入口与加载运行时
    vendor.<hash>.js            # 按实际依赖图分组
    charts.<hash>.js            # 大型图表依赖候选分组
    *.js                       # 动态块，例如地图资源
    *.css
  release.json
  portal-contract.d.ts
  compose-deployment.mjs
  pack-deployment.mjs
```

chunk 数量由依赖图和实际测量决定，不按源码目录逐文件机械分包。分块不等于懒加载：首屏必需资源仍完整加载；视图延迟初始化须按业务语义单独验证。

### 实施顺序

1. 测量当前产物总量、首屏请求、缓存更新量和慢加载位置，确定分块带来的实际收益。
2. 构建最小 Svelte/TypeScript/CSS/动态 chunk 探针，用锁定 qiankun 真 loader 验证沙箱 props、生命周期发现、动态资源、卸载重挂、不同静态路径前缀和 source map。
3. 将同一业务入口接入选定构建，沿用生产/调试两个 profile；抽离大依赖与共享资源，保留实际动态 import，核对编译语义一致性。
4. 将 HTML 与部署组合改为生成入口标记或 manifest，移除对固定文件名的耦合。Adapter 先执行、生命周期入口后执行；异步资源路径来自真实 entry 目录，不能跟随业务 URL。加载运行时使用平台独有命名空间。
5. 同步完整资源摘要、归档、下载后仓外组合、浏览器验收、CI 与 ADR-0093 现行结论，明确旧归档兼容策略。

### 修改范围与验收

预计涉及平台专用微前端构建配置、`vite.config.ts` 中的微前端接线、package scripts、工具依赖、打包/组合脚本、微前端验收、CI、构建文档及 ADR-0093。业务视图懒加载仅在必要且单独验证后纳入。

- 实际输出依赖/动态 chunks；HTML、加载运行时和发布清单均引用正确资源。
- 平台和 Adapter 的摘要、挂载 props、一次清理语义及仓外组合能力保持。
- 多静态路径、不同版本目录、缺失块 404、加载失败诊断、卸载重挂和跨实例隔离均通过。
- 生产/调试逻辑一致，调试断点与堆栈映射可用；测量报告分块前后总量、首屏量与缓存复用，未经测量不承诺性能提升。
- 类型检查、独立构建与两种 profile 的真 loader 回归通过。
- 本地、CI、真实门户、私有补丁及 Java/DQE/Relay 证据分层报告。

## 依据

本仓 `apps/platform/vite.config.ts`、`scripts/compose-deployment.mjs`、`src/microfrontend/entry.ts`、ADR-0093/0094。

- [Vite source map](https://vite.dev/config/build-options.html#build-sourcemap)
- [Svelte 官方 webpack loader](https://github.com/sveltejs/svelte-loader)
- [Webpack 输出与 chunk 配置](https://webpack.js.org/configuration/output/)
- [Webpack 资源路径](https://webpack.js.org/guides/public-path/)
- [Webpack source map](https://webpack.js.org/configuration/devtool/)

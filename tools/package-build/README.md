# 引擎交付物构建

`pnpm build:packages` 构建 page、engine、metric-canvas；默认 `pnpm build` 继续构建 embed 和平台。三个库包产出 ESM JS、类型声明和预处理后的 Svelte 组件。embed 维持自包含 ESM / IIFE 产物。

仓内 package.json 的 exports 保持源码入口；发布入口明确写在 publishConfig.exports。**使用 pnpm pack 打包**：pnpm 会把发布配置写成 tarball 中真正的 exports、main、types，并把 workspace 依赖改为版本号。集成应用只看到 dist 入口，可以使用自己的包管理器安装，不需要源码别名或 MetricCanvas 专用的 Svelte 预处理配置。不要用 npm pack 代替发布流程。

该方式利用 [pnpm 的 manifest 覆盖机制](https://pnpm.io/package_json#publishconfig)，仓内无需增加路径别名、私有解析条件或预构建步骤。所有包仍保留当前 private 与版本；解除 private、锁步版本和真正发布归后续执行票。

打包准备只操作 `.svelte-kit/package-input` 中的副本：

- Node ESM 相对引用补齐文件名和 `.js`；源码路径不变。
- SVG 转为导出 data URL 的 JS 模块；地图 JSON 转为独立 JS 模块，保留动态导入边界，不要求集成应用提供资源 loader。
- 使用 [Svelte 官方打包工具](https://svelte.dev/docs/kit/packaging) 与 vitePreprocess 生成同批 JS、组件和声明。声明不带指向未发布源码的 source map。
- `files: ["dist"]` 收窄产物；仓内校验 CLI、测试、构建暂存副本不发布。prepack 自动执行 build，避免代码与声明陈旧。

`pnpm packages:check` 实际打包四个交付物，检查 tarball 的全部入口、运行导出、声明导出、相对引用、文件范围，并用标准 Svelte 编译器编译全部组件。该门禁已接入 CI。它不替代 #115 的仓外安装/构建与最低 Svelte 版本验证，也不替代 #103 的真实异构集成验收。

# 引擎交付物构建

`pnpm build:packages` 构建 page、engine、metric-canvas；默认 `pnpm build` 继续构建 embed 和平台。三个库包产出 ESM JS、类型声明和预处理后的 Svelte 组件。embed 维持自包含 ESM / IIFE 产物。

仓内 package.json 的 exports 保持源码入口；发布入口明确写在 publishConfig.exports。**使用 pnpm pack 打包**：pnpm 会把发布配置写成 tarball 中真正的 exports、main、types，并把 workspace 依赖改为版本号。集成应用只看到 dist 入口，可以使用自己的包管理器安装，不需要源码别名或 MetricCanvas 专用的 Svelte 预处理配置。不要用 npm pack 代替发布流程。

该方式利用 [pnpm 的 manifest 覆盖机制](https://pnpm.io/package_json#publishconfig)，仓内无需增加路径别名、私有解析条件或预构建步骤。所有包仍保留当前 private 与版本；解除 private、锁步版本和真正发布归后续执行票。

打包准备只操作 `.svelte-kit/package-input` 中的副本：

- Node ESM 相对引用补齐文件名和 `.js`；源码路径不变。
- SVG 转为导出 data URL 的 JS 模块；地图 JSON 转为独立 JS 模块，保留动态导入边界，不要求集成应用提供资源 loader。
- 使用 [Svelte 官方打包工具](https://svelte.dev/docs/kit/packaging) 与 vitePreprocess 生成同批 JS、组件和声明。声明不带指向未发布源码的 source map。
- `files: ["dist"]` 收窄产物；仓内校验 CLI、测试、构建暂存副本不发布。prepack 自动执行 build，避免代码与声明陈旧。

`pnpm packages:check` 实际打包四个交付物，检查 tarball 的全部入口、运行导出、声明导出、相对引用、文件范围，并用标准 Svelte 编译器编译全部组件。该门禁已接入 CI。

## 仓外兼容性门禁

`pnpm compatibility:check` 对当前 Svelte 与最低版本 5.29.0 各执行一次完整矩阵，CI 以两个独立 job 执行。也可用 `--svelte=current` 或 `--svelte=5.29.0` 单独运行。

门禁默认从 **HEAD 的 Git 树**建立临时源码副本，执行既有 test/check/build，再实际打包四个交付物。在另一个仓外目录用 npm 安装 tarball，严格检查 peer、类型和全部公开入口，构建最小消费者，运行既有 embed 与画布浏览器测试。消费者没有源码别名或预处理器。page 另在独立 Node ESM 消费者安装执行，并检查没有引入 Svelte、ECharts。尚未发布的四包仅通过 npm overrides 指向本次 tarball，不替换框架版本。

验证未提交改动时，先只暂存本次交付文件，用 `git write-tree` 取得树 ID，再传 `--source-tree=<树 ID>`。输出包含该树 ID；不会把其他任务尚未完成的工作区改动混入验收，也不会改写本仓锁文件。`METRICCANVAS_COMPATIBILITY_DIR` 可指定工作区之外的结果目录，已存在的版本子目录会拒绝覆盖；未指定时自动创建临时目录。日志、浏览器版本、测试结果与 `summary.json` 留存其中。

5.29.0 的源码副本与消费者使用 Vite 6.3.6 / vite-plugin-svelte 5.1.1：当前插件 7.x 的 peer 下界高于 5.29，不能用忽略 peer 的方式声称兼容。四包声明的 Svelte peer 范围保持不变；embed 在该矩阵中也重新构建，确保其内嵌运行时代码使用最低版本。Vite 配置按工具版本选择单文件输出选项；embed 提供不含预处理器的显式 Svelte 配置，兼容 svelte-check 对旧插件的配置发现。

浏览器必须为真实 Chrome 和 Edge；先执行 `pnpm --filter @metriccanvas/embed exec playwright install --with-deps chrome msedge`，CI 自动执行此步。本机已有 Chrome 时，可用 `METRICCANVAS_EDGE_EXECUTABLE` 指定独立解包的官方 Edge 可执行文件。门禁记录实际启动版本，两种加载方式 ESM / script-IIFE 均由既有测试覆盖。该门禁不替代 #103 的外部真实集成应用验收。

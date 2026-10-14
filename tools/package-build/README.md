# 引擎交付物构建

`pnpm build:packages` 构建 ui、page、engine、metric-canvas；默认 `pnpm build` 继续构建 embed 和平台。四个库包产出 ESM JS、类型声明和预处理后的 Svelte 组件。embed 维持自包含 ESM / IIFE 产物。

仓内 package.json 的 exports 保持源码入口；发布入口明确写在 publishConfig.exports。**使用 pnpm pack 打包**：pnpm 会把发布配置写成 tarball 中真正的 exports、main、types，并把 workspace 依赖改为版本号。集成应用只看到 dist 入口，可以使用自己的包管理器安装，不需要源码别名或 MetricCanvas 专用的 Svelte 预处理配置。不要用 npm pack 代替发布流程。

该方式利用 [pnpm 的 manifest 覆盖机制](https://pnpm.io/package_json#publishconfig)，仓内无需增加路径别名、私有解析条件或预构建步骤。page、engine、metric-canvas、embed 四个产品交付物已解除 private，锁步版本以 manifest 为准；`@metriccanvas/ui` 独立 SemVer，不加入产品版本组；实际 registry 发布与真实集成应用验收由 #103 接续。

`productContractVersion` 从 page 的 package.json 读取，与四包发布版本一致；页面协议版本及读取/写出策略独立，以 `packages/page/src/version-policy.ts` 为准。`pnpm authoring:contracts` 单向生成产品中立契约和 Bundle 只读快照，`pnpm authoring:contracts:check` 对产品 manifest、Bundle 快照及契约锁检查版本分叉，并明确报告两侧版本。版本调整后须重新导出、更新摘要锁并通过全部门禁；Python 运行时继续只读取 Bundle，不加载 Node。

打包准备只操作 `.svelte-kit/package-input` 中的副本：

- Node ESM 相对引用补齐文件名和 `.js`；源码路径不变。
- SVG 转为导出 data URL 的 JS 模块；地图 JSON 转为独立 JS 模块，保留动态导入边界，不要求集成应用提供资源 loader。
- 使用 [Svelte 官方打包工具](https://svelte.dev/docs/kit/packaging) 与 vitePreprocess 生成同批 JS、组件和声明。声明不带指向未发布源码的 source map。
- `files: ["dist"]` 收窄产物；仓内校验 CLI、测试、构建暂存副本不发布。prepack 自动执行 build，避免代码与声明陈旧。

`pnpm packages:check` 实际打包五个交付物，检查 tarball 的全部入口、运行导出、声明导出、相对引用、文件范围，并用标准 Svelte 编译器编译全部组件。该门禁已接入 CI。

## 仓外兼容性门禁

`pnpm compatibility:check` 仅验证锁文件安装的当前 Svelte，CI 运行一个兼容性 job。`--svelte=current` 可显式选择当前版本；其他版本会被拒绝。2026-10-14 按用户决定移除 5.29.0 验证。

门禁默认从 **HEAD 的 Git 树**建立临时源码副本，执行既有 test/check/build，再实际打包五个交付物。在另一个仓外目录用 npm 安装 tarball，严格检查 peer、类型和全部公开入口，构建最小消费者，运行既有 embed 与画布浏览器测试。消费者没有源码别名或预处理器。page 另在独立 Node ESM 消费者安装执行，并检查没有引入 Svelte、ECharts。尚未发布的五包仅通过 npm overrides 指向本次 tarball，不替换框架版本。

验证未提交改动时，先只暂存本次交付文件，用 `git write-tree` 取得树 ID，再传 `--source-tree=<树 ID>`。输出包含该树 ID；不会把其他任务尚未完成的工作区改动混入验收，也不会改写本仓锁文件。`METRICCANVAS_COMPATIBILITY_DIR` 可指定工作区之外的结果目录，已存在的版本子目录会拒绝覆盖；未指定时自动创建临时目录。日志、浏览器版本、测试结果与 `summary.json` 留存其中。

CI 使用 `--source-checks=ci`：仅在 GitHub Actions 中，且 GITHUB_SHA、checkout 的 HEAD 和选定源码树一致时，源码副本省去重复 test/check，仍冻结安装、严格 peer 校验、build、实际打包及全部消费者验收。`tests` / `types` job 在同一 SHA 上执行完整源码检查，最终必需的 `ci` job 汇总五个并行任务；任何失败、取消或跳过均阻止通过。本地默认 `--source-checks=full` 保留完整检查，不能把 CI 模式的消费者结果单独报告为完整源码验证。

CI 仅上传 `summary.json`、包归档、命令日志、消费者 manifest/lockfile、浏览器结果及存在的失败附件。临时源码和消费者安装目录不上传。summary 记录源码提交/树、验证模式、委托检查以及各命令耗时和结果；失败时已完成的诊断仍保留。流水线与交付操作见 [CI 与范围交付](../../docs/agents/ci-delivery.md)。

源码副本保持冻结锁文件，消费者使用当前 Vite / vite-plugin-svelte 工具链，不再降级依赖或重写源码副本的 manifest。包内已有 Svelte peer 范围保留，但门禁只提供当前版本的兼容性证据。

浏览器必须为真实 Chrome 和 Edge；先执行 `pnpm --filter @metriccanvas/embed exec playwright install --with-deps chrome msedge`，CI 自动执行此步。本机已有 Chrome 时，可用 `METRICCANVAS_EDGE_EXECUTABLE` 指定独立解包的官方 Edge 可执行文件。门禁记录实际启动版本，两种加载方式 ESM / script-IIFE 均由既有测试覆盖。该门禁不替代 #103 的外部真实集成应用验收。

UI-only 消费者只安装 UI 与 Svelte，检查领域/图表依赖不可达，并独立类型检查、构建和真实控件的 Chrome 行为检查。第五包公开面加入统一快照与 tarball 检查。CI 矩阵已配置；配置存在不代表远端流水线已运行。

本地可用 `METRICCANVAS_TEST_BROWSERS=chrome` 做部分矩阵；summary 的 `completeBrowserMatrix` 为 false，不能报告 Chrome/Edge 门禁通过。CI 默认必须两浏览器均运行。

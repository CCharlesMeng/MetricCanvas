# #114 可发布构建验证（2026-09-08）

## 实现

- page、engine、metric-canvas 新增 build，使用固定版本的 @sveltejs/package 2.5.8 生成 ESM JS、类型声明和预处理后的 Svelte 组件。embed 维持原自包含 ESM / IIFE 形态。
- 仓内 exports 继续指向源码，publishConfig.exports/main/types 声明发布入口。真实 pnpm tarball 的这些字段全部指向 dist，不携带私有源码解析条件，也不要求集成应用配置别名。打包必须使用 pnpm pack，安装方可自行选择包管理器。
- 三个库包 files 收窄为 dist；四个交付物的 prepack 都先 build，代码和声明取自同一批输入。保持 private=true、version=0.1.0，版本推进与发布归后续票。
- 构建副本补齐相对 ESM 文件引用；SVG 转 data URL 的 JS 模块，地图 JSON 转独立动态 JS 模块。不把 Vite 资源 loader 约定带给集成应用。
- 新增 pnpm packages:check 并接入 CI：实际打包、解包，验证全部子路径与入口文件、源码/运行产物/声明导出名、包内引用、文件范围，并在不配置 preprocess 的情况下编译全部 Svelte 组件。
- 既有公开面快照未改；枚举代码抽成共享工具，仓内快照与 tarball 检查使用同一个导出名口径。

## 实证

| 检查 | 结果 |
|---|---|
| 三个库包 build | 全部通过 |
| 默认 pnpm build | 四个交付物与平台全部通过 |
| 真实 tarball | page 105 文件 / 2 入口；engine 249 文件 / 6 入口；metric-canvas 12 文件 / 2 入口；embed 6 文件 / 1 入口 |
| 组件编译 | engine 36 个、metric-canvas 2 个，全部直接由标准 Svelte 编译器通过 |
| 公开面 | 11 个入口的类型声明导出名与源码一致；三个库包运行导出名与源码值导出一致；原快照门禁通过 |
| 文件与依赖 | 不带原始 TS、测试或指向源码的 source map；发布依赖无 workspace:；page 运行依赖不含 ECharts/Svelte |
| 未预构建测试 | 移走 page/engine/metric-canvas 的 dist 后，131 文件通过 / 1 跳过，958 用例通过 / 12 跳过 |
| 未预构建类型检查 | pnpm check 全仓通过，Svelte 0 errors / 0 warnings |
| 未预构建应用构建 | 三个 dist 仍不存在时，分别构建 embed ESM/IIFE 与 platform 成功 |
| ESM / IIFE 浏览器回归 | Chrome 上独立版本失败、停止取数、更新恢复两项均通过 |
| 契约导出 | 183 product / 4 authoring / 1 interface 文件一致 |

构建暴露了一处既有审计范围问题：组合卡样式测试递归扫描 engine 中所有名含 src 的目录，把生成副本也算作源码。现已排除 dist、.svelte-kit 和 node_modules，构建脚本也清理自己的暂存目录；保持原有「源码只有一个赋值点」断言。

## 边界

本次 tarball 门禁检查交付物自身，尚不等于 #115 的工作区之外安装/构建、最低 Svelte 5.29.0 矩阵及 Chrome/Edge 版本实证。#116 版本锁步与 #103 真实集成/发布未在本票完成。平台仍使用 adapter-node，#104/#105 的外部接口和部署前置不变。

# #115 仓外产物与最低版本验证（2026-09-08）

## 门禁

`pnpm compatibility:check` 从明确 Git 树建立两个隔离源码副本，分别以当前 Svelte 5.56.6 与声明下界 5.29.0 执行既有 test/check/build，重新打包四个交付物，再在工作区之外用 npm 安装、类型检查、构建和运行浏览器用例。四包之间的未发布版本仅定向到本次 tarball；不使用源码路径别名或预处理器，不忽略 peer 冲突。page 另行独立安装，通过普通 Node ESM 校验页面，并确认未引入 Svelte / ECharts。

当前工具链为 Vite 8.1.5 / vite-plugin-svelte 7.2.0；最低版本使用 peer 区间匹配的 Vite 6.3.6 / vite-plugin-svelte 5.1.1。最低版本连 embed 自包含产物也重新构建，不以当前版本构建的 bundle 代替最低版本运行时。

CI 为两个版本分别执行门禁，安装真实 Chrome / Edge，并上传日志、浏览器版本与测试结果。复跑方式见 tools/package-build/README.md。

## 实证

验证源码树：`f1c7c82306899ad8e606da54ec238eab2076c9d0`。最终提交仅在此树之上调整 CI 环境变量的层级并追加本报告，产品与门禁实现不变。结果目录：`/private/tmp/115-matrix-d`，机器可读摘要为 `summary.json`。

| 检查 | Svelte 5.56.6 | Svelte 5.29.0 |
|---|---|---|
| 全仓既有测试 | 132 文件通过 / 1 跳过；955 用例通过 / 16 跳过 | 同左 |
| 全仓类型检查 | 通过，Svelte 0 errors / 0 warnings | 同左 |
| 四交付物与平台构建 | 通过 | 通过 |
| 四个真实 tarball 安装 | 通过，严格 peer 校验 | 同左 |
| page 独立 Node ESM | 校验成功，无 Svelte / ECharts | 同左 |
| 仓外公开入口类型与消费者构建 | 通过，skipLibCheck=false | 同左 |
| 既有浏览器用例 | 86 通过，0 失败 / 跳过 / 重试 | 86 通过，0 失败 / 跳过 / 重试 |

两轮均使用真实 Chrome **152.0.7977.76** 与 Edge **152.0.4191.66**。覆盖现有 ESM、script/IIFE、真实页面渲染、URL 导航、版本失败/更新恢复及画布编辑交互。最低版本全仓测试中的 16 个跳过项属于既有 CI 模式下的环境集成测试，浏览器测试没有跳过。

本机 Edge 来自官方企业更新 API 的 macOS universal 安装包，未执行系统安装，仅解包后通过 Playwright 指定可执行文件。SHA-256：`ea0cb511706321fbe7800d3e1d6b8e7c1237d9abea97d68a9ac56f7317479b38`；`pkgutil --check-signature` 验证为受信任的 Microsoft Developer ID Installer / notarized。

## 验证中修复的真实问题

- Vite 6 与 8 的单文件输出配置不同。embed 按 Vite 主版本选择 `inlineDynamicImports` / `codeSplitting`，两套工具链均维持单文件 ESM / IIFE。
- svelte-check 4.7 无法从旧版 Vite 插件自动发现 embed 配置；新增空的显式 Svelte 配置，无预处理器。
- 平台编辑页的 `valueOf` 函数被 Svelte 5.29.0 编译器错误地读取为转换表的原型属性，报 `context.state.transform[reference]?.read is not a function`。复现缩成函数与事件回调四行；只改名可通过，清空函数体仍失败。改名为 `inputValue`，补上编译真实编辑页的回归测试，最低版本下修复前红、修复后绿；原始完整构建也通过。

## 边界

本次证明仓外最小消费者与已声明最低框架版本可用。四包仍为 private=true、0.1.0，#116 接续契约同版与 rc.1。没有执行 registry 发布，也没有用最小消费者替代 #103 的真实异构集成应用验收；#104/#105 的静态化和页面资产接入前置不变。

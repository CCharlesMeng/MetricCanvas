# Platform 独立调试包本地验收

日期：2026-10-14。第一期已实施：Vite UMD 单文件生产包与独立调试包。第二期真正分块尚未实施，见 [两期计划](../plan/2026-10-14-platform-microfrontend-build.md)。使用命令、产物和 DevTools 操作见 [打包与调试](../platform-build.md)。

## 改动与证据范围

- `microfrontend-debug` 使用生产构建语义，仅关闭 JS/CSS 压缩、增加包含 TS/Svelte 源内容的 JS source map；CSS 可读但没有 CSS map。
- 独立目录/归档与 `release.json.profile` 区分两种产物；原生产命令保留，CI 配置新增双归档构建与真 qiankun 源码映射验收。
- 调试 map 纳入资源摘要，打包检查 TS/Svelte 映射完整性与绝对构建机路径；生产目录拒绝 map。源码树摘要增加 UI 和数据执行包，发布脚本也可脱离包 cwd 执行。
- 业务源码、部署 Adapter 契约、固定 UMD 入口与生命周期保持；当前工作区另有在途批次，归档包含当时的混合源码快照，本批没有提交或部署。

## 本地验证

| 检查 | 结果 |
|---|---|
| `pnpm --filter platform pack:microfrontend:all` | PASS，两个目录、归档和校验文件 |
| `pnpm --filter platform build` | PASS，独立入口；仍有已有的大 chunk 提示 |
| `pnpm --filter platform check` | PASS，Svelte 0 errors / 0 warnings，测试类型检查通过 |
| `pnpm exec vitest run apps/platform/tests/microfrontend` | PASS，3 files / 20 tests |
| `pnpm --filter platform test:microfrontend` | PASS，生产 profile、直接标准 props |
| `pnpm --filter platform test:microfrontend:debug` | PASS，debug profile、部署 Adapter 组合及源码映射探针 |
| 逐资源与归档 SHA-256 复核 | PASS，生产 6 个资源、调试 7 个资源，map 受摘要覆盖 |
| 所修改 JS 脚本语法与 diff whitespace | PASS |

业务浏览器回归覆盖内部导航、返回/前进/刷新、人工编辑与保存、取消离开、门户离开保护、本地弹窗、未知写入不重放、token 刷新、身份失效、卸载重挂/快速切换及失败挂载清理。每种 profile 的回归都有 4 次 fixture 写入；是真浏览器与 HTTP fixture，没有调用真实资产服务。

初次构建与类型检查遇到另一在途批次的 `data-execution` 文件尚未写齐及类型错误；其文件由该批次补齐后，本批重建和复验通过。没有为绕过错误而修改平台的依赖语义。

## 源码调试探针

对象：qiankun 2.10.16、Chromium 151.0.7922.34、真实 UMD/debug 归档、仓外部署 Adapter 合成 fixture。

`debug-browser.mjs` 从归档解压，使用解压目录自带的 `pack-deployment.mjs` 仓外组合；从两个不同资源前缀加载：`/releases/debug-one/` 与 `/static/nested/debug-two/`。

- Chrome Debugger 识别 qiankun eval 包装后的真实 `sourceURL`，`sourceMapURL` 为 `platform.umd.js.map`；相对该脚本 URL 请求 map，均为 HTTP 200。
- 通过 source map 反查生成位置设置浏览器断点，再对实际暂停位置反向核对：命中 `src/microfrontend/entry.ts:16`、`src/lib/PlatformRoot.svelte:11`。两种静态前缀均命中；entry 暂停帧中 `props.appList` / `props.roleList` 与门户 fixture 一致。
- 故意提供无效 `routeBase` 引发失败，将生成脚本错误堆栈映射回 `src/lib/integration/navigation.ts:3`，证明堆栈映射可用。
- 正常挂载与卸载各两次，Adapter connect/disconnect 各两次；失败挂载另验证错误堆栈。CSS 从相应静态目录加载，缺失 JS 返回 404。

此探针使用 CDP 生成位置断点和 source-map 消费器核对原始行号，没有操作 DevTools 图形界面。结论是浏览器实际执行代码、source map URL 和源码位置对齐；集成门户使用步骤记录在操作文档。

## 产物快照

版本：`1.0.0-rc.1`。基线提交：`ea6e453efa6bab0d580d31bd80baa2fcf979f01f`。`sourceDirty=true`，不是全部修改已提交或正式发布的证明。

生产与调试源码树 SHA-256 一致：`171bb667cf384c42e5019a7451891fa5b5b3d409c1773a4f583bffe07527427b`。

| profile | 归档大小 | 归档 SHA-256 |
|---|---|---|
| production | 773,194 bytes | `992d84a1b53c286b687e28f3464ebd0c51e3a58207a3d09a2e5b82575321b677` |
| debug | 3,467,816 bytes | `0c07148e5c139288a78f12d4d7663eda9ecf18ea946e86709d1d83562bf99c92` |

产物在 `apps/platform/dist/`，不纳入源码提交。该目录是本次构建快照，重新打包会更新摘要。

## 初次本地快照未运行的验证

远端 CI 尚未运行；实际内部门户、私有 qiankun 补丁、生产 CORS/身份及真实 Java/DQE/Relay 未验证；未提交、push 或部署。不得把本地合成门户通过当成真实接入完成。


## 范围交付前复验

用户要求提交并 push 后，从最新 `origin/main`（`34e4550017349dc715a420f0eff7a7229125eeeb`）创建隔离 worktree，仅移入本批 11 个构建、验收与文档文件。共享工作区的其他业务/协议/依赖改动没有移入，CI 已在远端生效的兼容性调整予以保留；计划索引仅移入本批的一行。

在该隔离范围重新通过生产/调试双归档、Platform 类型检查、20 项微前端测试、独立构建，以及两种 profile 的完整 qiankun 浏览器回归。下载归档后仓外部署组合、两个静态目录下的 TS/Svelte 断点和错误堆栈映射再次通过。

这次范围交付的源码树摘要为 `ef0c8030f5292b7ed536aa0b42e9d8911bbcda5996178b40aad4a44b559d6af8`；生产与调试一致。上文原始混合工作区的摘要与归档是前一实施快照，不代表本次范围交付的产物。

- `metriccanvas-platform-1.0.0-rc.1.tar.gz`：`2242bf2fad6f8d2a6ffb1a21d56b18886a12dc7bad9a21cd6792ba1fd27b1c4a`。
- `metriccanvas-platform-1.0.0-rc.1-debug.tar.gz`：`7b3af1ffd224d8a414efc60d7a44a46f50d88c11ea3bf38eb90ab9aa35be27c6`。

本节记录提交前复验。提交/远端 SHA 与 CI 结论应以实际 Git 和 GitHub Actions 结果确认；真实内部门户与服务验收仍未运行。

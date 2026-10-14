# Platform 打包与浏览器调试

平台微前端第一期沿用 Vite UMD 单文件，分别发布生产包和独立调试包。两者使用同一生产编译逻辑和 qiankun 生命周期，调试包只改变 JS/CSS 可读性并增加 JS source map。真正分块作为 [第二期计划](plan/2026-10-14-platform-microfrontend-build.md) 保留。

## 构建命令与产物

在仓库根目录执行：

```sh
# 同时生成生产与调试归档；CI 使用此命令。
pnpm --filter platform pack:microfrontend:all

# 分别生成，适合只更新其中一种产物。
pnpm --filter platform pack:microfrontend
pnpm --filter platform pack:microfrontend:debug
```

发布版本通过 `METRICCANVAS_PLATFORM_VERSION` 指定，默认 `1.0.0-rc.1`。

| 内容 | 生产包 | 调试包 |
|---|---|---|
| 静态目录 | `apps/platform/dist/microfrontend/` | `apps/platform/dist/microfrontend-debug/` |
| 归档 | `metriccanvas-platform-<version>.tar.gz` | `metriccanvas-platform-<version>-debug.tar.gz` |
| 归档校验 | 同级 `.tar.gz.sha256` | 同级 `.tar.gz.sha256` |
| 发布清单 profile | `production` | `debug` |
| JS/CSS | 压缩 | 不压缩 |
| 源码映射 | 不携带 | `assets/platform.umd.js.map`，包含 TS/Svelte 源内容 |

两个静态目录都包含 `index.html`、`assets/platform.umd.js`、`assets/platform.css`、`portal-contract.d.ts`、`release.json` 和两个部署组合脚本。调试包仍为单文件 UMD，不开启开发 fixture、本地身份或 Vite 开发入口。CSS 可读，但当前未生成 CSS source map。

`release.json` 记录 profile、Git 基线、工作区修改标志、源码树摘要和全部交付资源的 SHA-256。调试目录的 map 也受资源摘要校验；生产打包拒绝夹带 map。归档中的源内容支持脱离本地仓库调试。源码树摘要覆盖平台和所消费的 UI、引擎、页面、数据执行等包；`sourceDirty=true` 时产物含工作区修改，基线提交不代表所有改动已提交。

## 集成门户中调试

1. 解压调试归档到新的目录，核对同级 `.sha256`。
2. 用调试目录内附带的 `pack-deployment.mjs` 组合实际部署 Adapter，方法与生产包相同。不要仅替换 JS 而遗漏 map、CSS 或 Adapter。
3. 将门户的 `entry` 指向新的组合调试目录 `index.html`。业务 `activeRule` 和 Adapter 中的 `routeBase` 沿用原值；静态目录和业务路由是不同路径。
4. 在 Chrome/Edge DevTools 的 Settings → Preferences → Sources 中启用 JavaScript source maps。在 Sources 中用文件搜索打开 `entry.ts`、`portal-config.ts` 或 `PlatformRoot.svelte`，设置断点；重新挂载平台以命中挂载阶段断点。
5. 检查 `assets/platform.umd.js.map` 能返回 JSON，而不是门户 HTML 回退。qiankun 给脚本增加 `sourceURL`，map 引用按这个脚本 URL 解析，因此 map 必须与 UMD 文件同目录。DevTools 自己发起的 map 请求不一定显示在页面的 Network 列表，可直接打开资源 URL 核对。

部署组合示例（路径按实际目录填写）：

```sh
node /downloaded/platform-debug/pack-deployment.mjs \
  /downloaded/platform-debug \
  /private-adapter/dist/adapter.js \
  /private-release/metriccanvas-debug-<version>
```

调试结束后，将门户 entry 切回原生产目录。平台和部署 Adapter 的所有权、配置读取和身份变化语义见 [集成契约](host-contract.md#平台-html-微前端契约)。

## 本地验证

先生成两种归档，再执行：

```sh
pnpm --filter platform test:microfrontend
pnpm --filter platform test:microfrontend:debug
pnpm exec vitest run apps/platform/tests/microfrontend/deployment.test.ts apps/platform/tests/microfrontend/compose-deployment.test.ts
pnpm --filter platform check
pnpm --filter platform build
```

生产和调试业务回归共用 `production-browser.mjs`，调试通过 `MICROFRONTEND_PROFILE=debug` 选择独立目录，并覆盖部署 Adapter 模式。两次业务回归使用同一端口，应顺序执行。

`debug-browser.mjs` 另外从真实调试归档解压，仓外组合 Adapter，在真实 qiankun 2.10.16 沙箱下执行。它核对 map URL、两个静态路径前缀、挂载 props、生命周期、TS/Svelte 断点命中后的原始行号以及错误堆栈的源码映射。此为本地合成门户证据，不能代替实际内部门户、私有补丁及真实 Java/DQE/Relay 验收。

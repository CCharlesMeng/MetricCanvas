# Platform HTML 微前端实施与验收

日期：2026-09-28。以下为提交前的本地实现与验收快照；归档摘要对应当时工作区，Git 交付状态以提交记录和远端 CI 为准。尚未部署。沿用交接时已有的方案修改，另一个工作中的 IOC 能力差距文档不属于本次改动。

## 交付与运行方式

- 候选版本：`1.0.0-rc.1`；可用 `METRICCANVAS_PLATFORM_VERSION` 为下一次发布指定新版本，部署目录不可覆盖。
- Git 基线：`a252840bb304e51daab4f6b250f6e136f6784893`，`sourceDirty=true`。这不是包含全部本次实现的提交 SHA。
- 当前生产源码输入树 SHA-256：`4830efdae30f9a729dfa7433441a827bd6838542bd5c494d8dafa5ad4a34b085`。算法及输入范围见 `apps/platform/scripts/pack-microfrontend.mjs`。
- HTML entry：`apps/platform/dist/microfrontend/index.html`。
- 完整归档：`apps/platform/dist/metriccanvas-platform-1.0.0-rc.1.tar.gz`。
- 归档 SHA-256：`dcf70e6761524c1a515e8f53657fac80de8bdec6a549501fc445a13979f5a363`；同级 `.sha256` 文件可核验。
- 归档内容：HTML、`assets/platform.umd.js`、`assets/platform.css`、无包依赖的 `portal-contract.d.ts`、逐资源摘要和版本信息 `release.json`。UMD 将渲染资源一并打包，无浏览器 workspace 导入，无开发凭据/fixture。
- 独立产物：`apps/platform/build/`。独立与嵌入共用普通 Svelte、业务视图、实例服务和 URL 路由，分开构建且互不覆盖。

运行 `pnpm --filter platform pack:microfrontend` 重建静态归档。正式接入类型与注册示例、guard/SDK 所有权、回退规则、升级回滚见 [集成应用契约](../../host-contract.md)。采用运行时 `routeBase`；本次测试 `/metrics`，资源 URL 从 HTML entry 解析，不与用户路由混用。未设置 `<base>` 或接管门户标题。

## Kit 有界验证

验证对象：改造前生产构建，SvelteKit 2.70.2、Svelte 5.56.6、Vite 8.1.5、qiankun 2.10.16、Chromium 151.0.7922.34。

1. 原生产 HTML 经真实 `loadMicroApp` 加载：`TypeError: Cannot read properties of null (reading 'parentElement')`，对应 `document.currentScript.parentElement`。
2. 最小入口改为显式生命周期后，原生 ESM 读取不到沙箱内启动数据；把启动数据放在原生模块侧后可在目标容器显示。
3. `kit.start` 返回 `undefined`，入口只导出 `load_css/start`；unmount 后容器被 loader 移除，但 `beforeunload/visibilitychange/popstate/hashchange/pageshow` 各留下一个监听。检查当前 Kit 客户端源码也没有公共销毁接口。
4. 因而没有进入“Kit 全套通过”的结论。未继续侵入 Kit 私有 root/router 实现；按已授权交接的后备路径迁到普通 Svelte。对未知未来版本不作兼容性断言。

探针在 `apps/platform/tests/microfrontend/kit-probe.mjs`。复现需先准备改造前 Kit 的生产目录，再执行：

```sh
KIT_BUILD=/absolute/path/to/kit-production-build node apps/platform/tests/microfrontend/kit-probe.mjs
```

`QIANKUN_DIST` 可指向提供方锁定的 qiankun 2.x UMD。默认使用测试依赖中固定的 2.10.16。它是测试主应用的依赖，未打进平台，也没有在平台内启动第二层 qiankun。

## 证据分层

| 层 | 结果 | 已执行范围 |
|---|---|---|
| 全仓类型 | PASS | `pnpm check`，平台与页面试验场 Svelte 检查均 0 错误/警告 |
| 全仓确定性测试 | PASS | `pnpm test`：168 文件，1519 通过，1 跳过 |
| 最终平台与配置回归 | PASS | 32 文件，383 通过，1 跳过；跳过项需要在线 DQE 配置 |
| 生产静态构建 | PASS | 独立 build 与 HTML 微前端 build/pack；生产扫描未发现开发凭据、fixture、workspace 私有导入 |
| 测试主应用真实 qiankun | PASS，候选版本 | 2.10.16 loader 消费实际 HTML/CSS/UMD；不是用 mock 生命周期函数代替 |
| 人工业务路径 | PASS，HTTP 替身 | 生产独立与嵌入：目录、打开、编辑单次保存、重新打开；独立还覆盖发布、刷新、恢复和删除 |
| 目标门户 | NOT_RUN | 未收到门户 lockfile、容器/部署配置、真实路由 guard 和可访问环境 |
| 真实 Java/DQE/身份/CORS | NOT_RUN | HTTP 替身不证明生产协议、权限与网关可达 |
| 真实盘古/Relay/可信创作 | NOT_RUN | AI 单列；嵌入缺 SDK 时显示未接通，复用已有对话/可信创作确定性测试 |
| 远端 CI / 发布 | NOT_RUN | 已加入 CI 构建与归档上传步骤，尚未推送运行；无部署地址 |

浏览器脚本：`pnpm --filter platform test:microfrontend`。它启动一个临时测试门户并在退出时关闭，使用本仓固定 Playwright/Chromium，覆盖：

- 实际 loader 识别生命周期与生产 CSS/JS 加载；门户标题与区域保持不变。
- 挂载容器高度、页面弹层不锁门户 body、不 inert 门户节点。
- 内部列表/详情/编辑 URL、资源参数、前进/后退、深链接刷新，内部导航保持一次 ready。
- 未确认保存时取消按钮导航、内部后退和跨前缀后退，URL 与工作台一致；区域外保护由测试门户接入 guard。
- 同身份 token 更新后下一次请求使用新 token、不重建；身份变化停旧会话、取消请求并通知门户。
- 卸载后 DOM 消失、配置订阅数归零；重新进入和快速切换只保留一个实例。
- 已发送写入期间退出登录，重进保留未知操作，累计写入数不增加、不自动重发。
- ready 回调抛错的失败挂载，DOM 与订阅均清理。

生产独立入口通过 Vite preview 4174 消费 `build/`，复用了 `java-assets-browser.mjs`；开发独立入口 5196 同一路径亦通过。所有服务均为浏览器 HTTP 替身。生产资源仍较大：UMD 约 2.13 MB、gzip 约 685 KB；独立构建存在 Vite 大 chunk 提示，不影响本次功能通过，不据此宣称已完成性能验收。

## 所有权与剩余责任

门户需给明确容器高度、前缀激活与服务器回退，提供每请求配置源及真实更新通知，接好区域外按钮/浏览器后退的 guard，并等 unmount 后移除容器。测试门户的 single-spa 同步 guard 桥只用于候选测试；实际门户若有异步 guard，应在自己的路由提交前 await，不能直接套用同步取消示例。

SDK 适配方保证挂载有限返回并只销毁自己的实例。平台挂载只等本地组件初始化；现有对话生命周期会清理迟到挂载。真实 SDK 接线与权限不能由测试替身通过代替。

平台已停止旧会话新操作，卸载不自动保存/发布；已接受的服务端写入无法保证撤回。IndexedDB 数据库名 `metriccanvas-authoring`、版本 1、store `work` 和记录 key 未变化，连接按事务关闭；没有新增跨服务目标恢复隔离。首版同一部署固定 Java/DQE 服务目标，切目标后不得把原恢复记录当作新目标草稿使用。

目标门户团队接收归档后，还须验证其精确 qiankun 小版本、浏览器、CSP、真实 CORS/鉴权、真实人工业务闭环，再单列 AI 验收。平台未调用登录刷新、未发布 npm 包、未修改渲染引擎职责、Python 或 Relay 核心。

# qiankun 官方接入事实与版本边界

调研日期：2026-09-28。状态：方案输入，未完成真实集成验证。本文只依据官方文档、官方仓库与 npm 官方注册表；下文的“建议”是针对本次集成要求的推论，不是已经存在的 platform API。

## 1. 必须先识别现网版本

本次直接读取 [npm dist-tags](https://registry.npmjs.org/-/package/qiankun/dist-tags)，得到 `latest=2.10.16`、`rc=3.0.0-rc.22`、`next=3.0.0-rc.15`。标签会变动，实施时应使用集成门户 lockfile 中的精确版本。官方仓库仍声明 3.0 正在开发；不能把新文档示例默认为现网可用能力。[官方仓库](https://github.com/umijs/qiankun)

| 维度 | qiankun 2.x 文档 | qiankun 3.x 文档 |
|---|---|---|
| 文档入口 | `umijs.github.io/qiankun` | `qiankunjs.com` |
| 常规构建接入 | webpack UMD 或显式暴露生命周期 | 原生 ESM，官方 Vite bundler plugin |
| `entry` | URL 或 scripts/styles/html 对象 | HTML URL 字符串 |
| `container` | CSS selector 或 HTMLElement | HTMLElement |
| CSS 配置 | strictStyleIsolation / experimentalStyleIsolation | sandbox.styleIsolation |

两套参数不能混用。证据：[2.x API](https://umijs.github.io/qiankun/api/)、[3.x loadMicroApp](https://www.qiankunjs.com/api/load-micro-app)、[3.x Vite 接入](https://www.qiankunjs.com/cookbook/prepare-a-vite-app)。

## 2. 对本次边界的建议

建议结构是“集成门户通过 qiankun 装载外部业务子应用；业务子应用在自己的功能区域调用 platform adapter”。由外部业务子应用负责 qiankun 生命周期与独立发布，platform 提供可挂载、可更新、可销毁的框架中立契约。这样 platform 不必自己再注册为第二层 qiankun 子应用。

如果未来明确要求 platform 单独按 URL 发布和升级，再评估在该区域使用 `loadMicroApp`。官方将此 API 用于由应用代码控制的页面区域、tab、dialog；2.x 也支持手动装卸。但这是另一种部署边界，会多一套 HTML 加载、沙箱、版本与资源策略，不能与“作为业务子应用内部依赖”混为一谈。[2.x API](https://umijs.github.io/qiankun/api/)、[3.x loadMicroApp](https://www.qiankunjs.com/api/load-micro-app)

## 3. 生命周期与 Svelte 5

外部子应用需要暴露 `bootstrap`、`mount`、`unmount`；手动更新可提供 `update`。初始导入不能无条件挂载；独立运行分支与 qiankun 分支应分开。每次 `mount` 都必须能重建实例，`unmount` 必须释放资源；重新挂载时不能依赖模块顶层代码再次执行。[2.x 接入](https://umijs.github.io/qiankun/guide/getting-started/)、[3.x 生命周期示例](https://www.qiankunjs.com/tutorial/build-the-micro-app)

Svelte 5 官方支持 `mount(Component, { target, props })` 和 `unmount(instance)`，目标可为 Element 或 ShadowRoot。`mount` 返回时 effects/onMount 不保证已经运行；若 adapter 承诺 ready，应自行定义它代表“组件已挂载”还是“页面/数据已准备好”。5.13 起 `unmount` 返回 Promise，可等待退出动画。[Svelte imperative API](https://svelte.dev/docs/svelte/imperative-component-api)

推论：platform 应返回实例句柄，避免模块级单例；实例负责取消请求、清理监听/订阅/定时器、销毁组件、释放自己的 DOM。外部子应用应等待平台销毁完成，再结束自己的卸载流程。身份与端点变更由明确更新契约处理，不能依赖重读全局变量。

## 4. Vite、UMD 与 SvelteKit

Vite 官方 library mode 可以输出 ES/UMD；单入口默认 ES+UMD，多入口默认 ES+CJS；CSS 是额外的构建产物。因此“Vite 不能输出 UMD”不成立，但普通 Vite 应用构建不能直接等同于 qiankun 2.x 生命周期入口。[Vite library mode](https://vite.dev/guide/build#library-mode)

qiankun 3 官方提供 `@qiankunjs/bundler-plugin/vite`，原生 ESM 导出生命周期，不需要 UMD。文档示例覆盖 React/Vue；此次未获得 SvelteKit 直接接入的官方保证，不能把“支持 Vite”写成“已支持本仓 platform 的全部 Kit 行为”。[3.x Vite 接入](https://www.qiankunjs.com/cookbook/prepare-a-vite-app)

SvelteKit `adapter-static` 的职责是输出静态站点/SPA fallback，它不提供 qiankun 生命周期函数。推论：把依赖 `$app` 路由与 Kit 服务端端点的应用直接改成 library entry，需要先抽离对应能力；更可控的方案是独立浏览器入口复用 Svelte 组件，将导航、API、身份交给 platform adapter。仅修改 `paths.base/assets` 或改为静态输出，不构成 qiankun 接入完成。[SvelteKit adapter-static](https://svelte.dev/docs/kit/adapter-static)

## 5. 资源、路由、样式与发布

- 2.x 官方区分 webpack 构建时 publicPath 和运行时 publicPath；`__INJECTED_PUBLIC_PATH_BY_QIANKUN__` 是其 webpack 路径机制，不能直接当作 Vite 或 Kit 的自动配置。[2.x tutorial](https://umijs.github.io/qiankun/guide/tutorial/)
- 静态资源地址与业务路由前缀是不同配置。建议由业务子应用控制浏览器导航，platform adapter 使用受控导航回调；嵌入部分区域时避免另起整页路由器。
- 2.x strictStyleIsolation 使用 Shadow DOM，实验性样式隔离通过改写选择器实现，且不改写 `@keyframes`、`@font-face`、`@import`、`@page`。因此平台全局 reset、字体、body portal 与图表浮层必须独立核对；开启 JS sandbox 不代表完整样式隔离。[2.x API](https://umijs.github.io/qiankun/api/)
- 跨域正式部署必须由服务器/CDN配置 CORS；开发插件只解决开发/preview。HTML、JS、动态 chunk、CSS 等均需可达；带 cookie 时不能仅使用通配 ACAO。[3.x Vite 部署说明](https://www.qiankunjs.com/cookbook/prepare-a-vite-app)
- 3.x ESM 当前依赖动态 import maps；官方文档明确 Firefox 的兼容限制。CSP 还涉及 blob 与内联 import map，且当前没有统一 nonce 传播配置；不能默认新版本可直接替代现网 2.x。[浏览器要求](https://www.qiankunjs.com/guide/browser-support)、[CSP 要求](https://www.qiankunjs.com/guide/csp-requirements)

发布建议：platform 发布固定版本包，业务子应用锁版本并独立构建、验收与发布；含内容哈希的资源用长期不可变缓存，HTML/版本指针短缓存，保留上一版完整资源支持回滚。生产版本不能依赖本仓开发代理。以上是交付建议，尚未在目标门户验收。

## 6. 必须补齐的验收证据

1. 锁定目标 qiankun 精确版本、浏览器范围、外部子应用技术栈以及包依赖/独立 URL 部署选择。
2. 检查平台浏览器入口不依赖 Kit 服务端、整页导航与不可控全局单例；确定所有网络请求均能走正式注入端点。
3. 对生产构建验证首次挂载、更新、卸载、重挂载、并行实例、挂载中卸载；检查残留 DOM、订阅与请求。
4. 在真实集成门户验证深链接、刷新、返回/前进、鉴权刷新、跨域资源、CSS/浮层和可回滚发布。

本次只完成官方资料调研。未安装或实测任何 qiankun 插件，未证明 SvelteKit 整站可被 qiankun 装载，未完成真实门户/服务端/身份集成。

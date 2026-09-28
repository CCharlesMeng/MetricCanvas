# qiankun 官方接入事实与版本边界

> 2026-09-28 实施进度：源码、静态归档及候选 qiankun 2.10.16 测试主应用验收已落地；目标门户与真实服务仍为 NOT_RUN。现行实现、证据与交付摘要见 [实施验收](../../evidence/qiankun-platform/implementation.md)。下文方案阶段状态描述保留为交接基线。
调研日期：2026-09-28。状态：方案输入，未完成真实集成验证。本文只依据官方文档、官方仓库与 npm 官方注册表；下文的“建议”是针对本次集成要求的推论，不是已经存在的 platform API。

> 方案已调整：platform 直接交付 HTML 微前端，主应用按前缀激活，平台管理内部 URL 路由；不再采用外部子应用消费 npm 包的方案。SvelteKit 是否保留须经生命周期与路由验证。本文的官方事实与实施推论分开，实施范围以 [整体方案](./integration-plan.md) 为准。

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

## 2. 本次采用的部署边界

主应用直接装载 platform 的 HTML entry，platform 接入层提供 qiankun 生命周期；业务层通过框架无关的实例接口工作。此前建议的“外部子应用安装平台 npm 包”不再采用。

主应用按路径前缀激活平台，平台拥有前缀内路由；平台内部切换需更新 URL，并支持后退、刷新与深链接。平台独立发布静态资源，不引入第二层 qiankun。具体 Kit 复用和构建方式尚未验证。[2.x API](https://umijs.github.io/qiankun/api/)

## 3. 生命周期与 Svelte 5

platform 微前端入口需要暴露 `bootstrap`、`mount`、`unmount`；手动更新可提供 `update`。初始导入不能无条件挂载；独立运行分支与 qiankun 分支应分开。每次 `mount` 都必须能重建实例，`unmount` 必须释放资源；重新挂载时不能依赖模块顶层代码再次执行。[2.x 接入](https://umijs.github.io/qiankun/guide/getting-started/)、[3.x 生命周期示例](https://www.qiankunjs.com/tutorial/build-the-micro-app)

Svelte 5 官方支持 `mount(Component, { target, props })` 和 `unmount(instance)`，目标可为 Element 或 ShadowRoot。`mount` 返回时 effects/onMount 不保证已经运行；若 adapter 承诺 ready，应自行定义它代表“组件已挂载”还是“页面/数据已准备好”。5.13 起 `unmount` 返回 Promise，可等待退出动画。[Svelte imperative API](https://svelte.dev/docs/svelte/imperative-component-api)

推论：platform 应返回实例句柄，避免模块级单例；实例负责取消请求、清理监听/订阅/定时器、销毁组件、释放自己的 DOM。主应用应等待平台 unmount 清理完成，再移除外层容器。身份与端点变更由明确更新契约处理，不能依赖重读全局变量。

## 4. Vite、UMD 与 SvelteKit

Vite 官方 library mode 可以输出 ES/UMD；单入口默认 ES+UMD，多入口默认 ES+CJS；CSS 是额外的构建产物。因此“Vite 不能输出 UMD”不成立，但普通 Vite 应用构建不能直接等同于 qiankun 2.x 生命周期入口。[Vite library mode](https://vite.dev/guide/build#library-mode)

qiankun 3 官方提供 `@qiankunjs/bundler-plugin/vite`，原生 ESM 导出生命周期，不需要 UMD。文档示例覆盖 React/Vue；此次未获得 SvelteKit 直接接入的官方保证，不能把“支持 Vite”写成“已支持本仓 platform 的全部 Kit 行为”。[3.x Vite 接入](https://www.qiankunjs.com/cookbook/prepare-a-vite-app)

SvelteKit `adapter-static` 的职责是输出静态站点/SPA fallback，它不提供 qiankun 生命周期函数。推论：把依赖 `$app` 路由与 Kit 服务端端点的应用直接改成 library entry，需要先抽离对应能力；本次先验证 Kit 的容器启动、URL 路由与完整卸载能否复用；若无法局部解决，再使用普通 Svelte 入口与客户端 URL 路由。两条实现路径都必须保留前缀内地址同步和深链接体验，API 配置与身份由外部提供。仅修改 `paths.base/assets` 或改为静态输出，不构成 qiankun 接入完成。[SvelteKit adapter-static](https://svelte.dev/docs/kit/adapter-static)

## 5. 资源、路由、样式与发布

- 2.x 官方区分 webpack 构建时 publicPath 和运行时 publicPath；`__INJECTED_PUBLIC_PATH_BY_QIANKUN__` 是其 webpack 路径机制，不能直接当作 Vite 或 Kit 的自动配置。[2.x tutorial](https://umijs.github.io/qiankun/guide/tutorial/)
- 静态资源地址与业务路由前缀是不同配置。主应用控制平台路由前缀与激活，platform 控制前缀内 URL 路由。两层路由不得竞争或重复处理内部导航，刷新深链接须先回到主应用入口。
- 2.x strictStyleIsolation 使用 Shadow DOM，实验性样式隔离通过改写选择器实现，且不改写 `@keyframes`、`@font-face`、`@import`、`@page`。因此平台全局 reset、字体、body portal 与图表浮层必须独立核对；开启 JS sandbox 不代表完整样式隔离。[2.x API](https://umijs.github.io/qiankun/api/)
- 跨域正式部署必须由服务器/CDN配置 CORS；开发插件只解决开发/preview。HTML、JS、动态 chunk、CSS 等均需可达；带 cookie 时不能仅使用通配 ACAO。[3.x Vite 部署说明](https://www.qiankunjs.com/cookbook/prepare-a-vite-app)
- 3.x ESM 当前依赖动态 import maps；官方文档明确 Firefox 的兼容限制。CSP 还涉及 blob 与内联 import map，且当前没有统一 nonce 传播配置；不能默认新版本可直接替代现网 2.x。[浏览器要求](https://www.qiankunjs.com/guide/browser-support)、[CSP 要求](https://www.qiankunjs.com/guide/csp-requirements)

发布建议：platform 发布固定版本 HTML 与完整静态资源目录，主应用注册对应 entry；含内容哈希的资源用长期不可变缓存，HTML/版本指针短缓存，保留上一版完整资源支持回滚。生产版本不能依赖本仓开发代理。以上是交付建议，尚未在目标门户验收。

## 6. 必须补齐的验收证据

1. 锁定目标 qiankun 精确版本、浏览器范围、主应用技术栈与路由前缀；本次已选择 HTML URL 部署。
2. 检查平台浏览器入口不依赖 Kit 服务端，且路由不接管前缀外导航、不保留不可控全局单例；确定所有网络请求均能走正式注入端点。
3. 对生产构建验证首次挂载、配置变化、卸载、重挂载、挂载中卸载（首版单活动实例，不承诺 SDK 并行实例）；检查残留 DOM、订阅与请求。
4. 在真实集成门户验证外部功能区域深链接、刷新、返回/前进、鉴权刷新（包括平台内部 URL 同步和深链接）、跨域资源、CSS/浮层和可回滚发布。

本次只完成官方资料调研。未安装或实测任何 qiankun 插件，未证明 SvelteKit 整站可被 qiankun 装载，未完成真实门户/服务端/身份集成。

---
status: accepted
date: 2026-09-28
note: 平台 HTML 微前端与独立入口共用客户端 URL 路由；部分修订 0073；目标门户与真实服务待验
---

# 平台交付 HTML 微前端，配置与生命周期按实例拥有

按 [MC 交接](../plan/qiankun-platform/handoff-mc.md) 在 `apps/platform` 原地实施。集成门户管理平台路径前缀和区域外离开保护，平台管理前缀内 URL、浏览器历史、深链接与业务视图；交付 HTML、UMD、CSS 的完整静态目录，不发布平台 npm 包，不使用内存导航，不在平台里启动第二层 qiankun。

实际 Kit 生产产物在候选 qiankun 2.10.16 下因 `document.currentScript` 失败。最小生命周期适配绕过入口与 ESM 全局隔离后可显示，但 Kit `start` 返回 `undefined`，仅导出 `start/load_css`，卸载仍留下 `beforeunload/visibilitychange/popstate/hashchange/pageshow` 监听。完整清理需要侵入 Kit 内部运行时，而非局部入口适配。因此选择普通 Svelte 入口，独立和微前端共用客户端 URL 路由与原有业务视图。证据及复现见 [实施验收](../evidence/qiankun-platform/implementation.md)。这不是对所有 Kit/qiankun 版本兼容性的断言。

部分修订 ADR-0073 的「平台不实现微前端协议」「仅接受全局运行配置」「不提供配置回调」「不实现生命周期」：qiankun 相关处理集中在 `src/microfrontend`，业务消费实例服务、配置读取函数和导航接口。每次请求现读凭据；同身份 token 刷新不重挂；退出登录、身份/工作空间或服务目标变化使旧会话失效。无配置仍可挂载，取数失败；配置变为可用后由门户重挂。

保留 ADR-0073 的静态浏览器直连、门户拥有凭据、不自建登录、不自动刷新重试，以及 Java/DQE 协议。`application-runtime` 和页面试验场继续支持全局配置包装，独立平台入口将其转换为实例读取源；业务不读取门户全局变量。对话与可信创作按实例接线，缺接线时人工业务可继续，AI 明确不可用。

卸载只销毁，不自动保存/发布。已发送写入不可保证撤回，未知结果沿用原持久化记录并停止重发。保持 IndexedDB 数据库、key、版本与记录；首版固定服务目标，不支持跨服务域恢复隔离。部署使用不可变版本目录，深链接回退门户 HTML，静态资源缺失返回 404。候选测试主应用成功不等于目标门户、生产 CORS/鉴权或真实 Java/DQE/盘古/Relay 验收。

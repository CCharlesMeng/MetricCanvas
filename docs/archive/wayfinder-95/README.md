# #95 静态平台与渲染引擎独立交付（2026-09，已收口）

## 这批做了什么

把产品从「SvelteKit Node 服务端 + Postgres」搬成「静态 SPA 直连外部服务」，同时把渲染引擎拆成可独立发布的交付物，并让旧服务链整体退出主线。围绕 GitHub #95 地图展开，子票跨 #56、#99~#125。

三条主线：**静态化与运行配置注入**（#101/#104）、**四交付物与公开面门禁**（#100/#113~#116）、**旧链隔离与删除**（#102/#122~#125）。盘古接入（#106~#108）在本批只完成裁决与接入基线，真实接线未完成。

## 结论落在哪

现行结论按主题读：[领域建模、包边界与部署形态](../../adr/topics/domain-modeling-and-package-boundaries.md)（静态化、发布形态、集成应用改名）、[问数编排与口径治理](../../adr/topics/ask-orchestration-and-scope-governance.md)（盘古边界）、[页面生命周期与发布治理](../../adr/topics/page-lifecycle-and-publish-governance.md)（Java 接入）。

| ADR | 裁决 |
|---|---|
| [0066](../../adr/0066-self-contained-rendering-engine-host-boundary.md) | 引擎固定提供视觉呈现，应用集成归宿主 |
| [0067](../../adr/0067-url-navigation-with-explicit-parameter-bindings.md) / [0068](../../adr/0068-plain-url-navigation-protocol.md) | URL 导航与显式参数绑定，协议切到 6.0（#109 已实施） |
| [0069](../../adr/0069-local-boundary-substitutes-and-host-owned-credentials.md) | 本地首版用真实 Java HTTP + 内存存储，请求凭据归宿主 |
| [0070](../../adr/0070-consume-host-java-page-assets-api.md) | Java 服务由外部宿主提供，本仓只做接口消费 |
| [0071](../../adr/0071-four-release-artifacts-with-standalone-page-protocol.md) | 四个交付物锁步同版发布，页面协议独立成包 |
| [0072](../../adr/0072-integrating-application-rename-and-authoring-render-time-split.md) | 「宿主」改称集成应用；创作期与渲染期是一对对立时段 |
| [0073](../../adr/0073-static-platform-direct-access-with-injected-runtime-config.md) | 静态平台直连 DQE 与 Java，运行配置由集成应用注入 |
| [0074](../../adr/0074-browser-component-building-and-isolated-legacy-baseline.md) | 人工搭建归浏览器工作台，旧链隔离为可复现历史基线 |
| [0075](../../adr/0075-page-playground-as-development-tool.md) | 原 Canvas 更名页面试验场，退出默认交付 |
| [0076](../../adr/0076-formal-architecture-contract-scope-and-enforcement.md) | 形式化架构的范围与门禁（校验器**尚未实现**） |
| [0077](../../adr/0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) | 盘古只替换左侧对话，每轮 ask 返回本轮结果 |

注入契约写在 [`docs/host-contract.md`](../../host-contract.md)「平台的运行配置注入」段。旧链退出的完整历史索引是 [`docs/evidence/2026-09-08-legacy-baseline.md`](../../evidence/2026-09-08-legacy-baseline.md)，它同时是 git tag `legacy/pre-static-platform-2026-09-08` 的唯一索引。盘古接入的可验收行为清单在 [`docs/evidence/wayfinder-107-pangu-integration-baseline.md`](../../evidence/wayfinder-107-pangu-integration-baseline.md)，ADR-0077 正文直接引用它。

## 被推翻的方向

- **「CORS + 内网 SSO」是错的。** DQE 认的是用户态 header token（`X-Auth-Token` + `X-Operator-Id`），不是 SSO Cookie。地图原文按 ADR-0073 更正。
- **现有取数通路从未按该契约接过线**——`createServerDataGateway` 丢弃 `actor`，`createDqeGateway` 默认空 headers。浏览器直连是这三个身份头的第一次真实接线，不是「沿用既有」。
- **平台不实现微前端协议**，是自包含静态 SPA；只为 qiankun 预留四条接缝，生命周期导出 / public path / 卸载清理三条明确不预留。
- **独立 URL 只是开发与演示形态**，不接真实 DQE——否则本仓要自建换 token 逻辑，违反 ADR-0069。
- **第一方 Java 建设（ADR-0062）在本批被 ADR-0070 部分取代**：现有 Java 代码与旧 Swagger 不再自动充当宿主接口真源。
- **不再要求为等待生产门槛而把旧代码留在主线**（ADR-0074 改法）。

## 里面有什么

`wayfinder-*` 是各票的 grill 交接与事实核查快照——**顶部普遍带「本文是历史快照」的接续修正，读时以修正为准**；`intranet-deployment.md` 是内网部署记录；`pangu-apply-page-workbench.md` 是工作台应用页设计；13 份 `2026-09-0x` / `2026-09-1x` 是逐票交付实证（#56、#103、#104、#108、#109、#113~#116、#122、#124、#125）。

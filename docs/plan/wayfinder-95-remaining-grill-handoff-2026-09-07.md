# Handoff：#95 剩余决策票的 grill

状态快照：2026-09-07 22:45。仓库 `/Users/moon/Documents/Code/公司项目/DataDashboard`，GitHub `CCharlesMeng/MetricCanvas`，分支 `main`，HEAD `fa508db`。地图 [#95](https://github.com/CCharlesMeng/MetricCanvas/issues/95)。

**启动语句：**

> 读 `docs/plan/wayfinder-95-remaining-grill-handoff-2026-09-07.md`，继续地图 #95，grill #101。按地图规定走 `grilling` + `domain-modeling`。事实自己查，决策问用户。

---

## 一、开工前必须知道的词汇变更（2026-09-07 当晚落地）

**「宿主」已改称「集成应用 (Host)」**（[ADR-0072](../adr/0072-integrating-application-rename-and-authoring-render-time-split.md)）。词汇表新增「阶段与角色」段共七词条：创作期、渲染期、页面搭建、搭建画布、页面搭建工作台、平台、集成应用。输出必须用新词。

**改名只动一个意思。** 「宿主」在本仓罩着三个东西，只有「装载渲染引擎的应用」改名：

| 意思 | 改不改 | 在哪 |
|---|---|---|
| 装载渲染引擎的应用 | **改成集成应用** | `docs/host-contract.md` 等七份活文档已改完 |
| Java 宿主服务 `CDINL2DataBuilderService` | **不改** | `metriccanvas-page-assets/`、地图里几处 |
| 包内技术容器（`WidgetHost`、「ECharts 宿主」） | **不改** | `packages/runtime-ui`、`packages/widgets` |

**英文一律留 `host`**，所以文件名、代码标识符、锚点全部没动。ADR 正文与 `docs/plan/` 保留原措辞，不要顺手改。**票正文还写着「宿主」，动到时顺带改即可。**

### 两条被推翻的旧记载，不要照旧读

1. **「`CONTEXT.md` 没有渲染引擎词条」是误判。** 它一直在，形式是「统一运行时（Runtime，又称渲染引擎）」的别名。ADR-0071 曾据此把补齐词条列为 `@metriccanvas/engine` 的发包前置，**那句已更正，补齐不是发包前置**。
2. **「创作」没有重载。** ADR-0043 的创作期／渲染期对立与 ADR-0032 的「人机分工」证明创作期本就涵盖人工页面搭建，**ADR-0065 的「创作包」「创作画布」用词全部成立**，不要去改。

---

## 二、现在能 grill 的两张票

### #101 静态 platform 的数据与身份通路（用户已选定先做这张）

事实已勘察完，不要重新全仓翻。**核心冲突**：#3 的验收条件写着「凭据只存在于服务端配置，不进入浏览器产物、页面文档、日志或仓库」，而静态化后 platform 没有服务端可藏凭据、浏览器要直连 DQE。两句不能同时成立，除非 DQE 接受的是随 SSO 走的用户凭据。

**#99 与 #106 已经替它关掉三个问题，别再问：**

- **mock 身份摆哪**——#99/ADR-0069 已定：所有请求头与 Cookie 归集成应用，本仓不新增身份适配器、登录体系或用户切换器。#101 的范围因此收窄为「端点、请求配置／请求实现、Cookie/credentials 与 CORS 接线」。
- **Relay WebSocket 从浏览器直连的跨源与鉴权**——票正文还留着这一问，但 **#106 当晚的改向已经把它作废了**：对话 chrome 与对发送消息服务的实际调用全归盘古助手第二实例，platform 不直连 Relay WS。
- **通用知识污染**——已消解。

**真正的 frontier（第一轮该问的）：**

- **浏览器直连 DQE 时凭据是什么**：SSO cookie（需要 DQE 与 platform 同站或 DQE 显式允许凭据跨源）还是前端 token（那就进了浏览器产物，直接违反 #3）。
- **一条没解释的矛盾**：`apps/canvas` 已经是纯静态并直连 DQE，但它的默认 endpoint 是**相对路径** `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute`——它实际假设的是**同源反代**，而地图裁决的是 **CORS 直连**。已经跑着的那条路和裁决的那条路不是同一条，这个要先问清是裁决要改还是 canvas 是特例。
- **`X-Operator-Id` 静态化后怎么变可信**：Java 页面资产用它当 actorId，浏览器自己填意味着任何人能冒充任何 actor。与 #105 的接口对账相关但不等待它。
- **端点配置怎么进静态产物**：`VITE_*` 是构建期注入，换环境要重新构建；要不要改成运行时配置文件（`/config.json`）。

**一个外部闸门要早问用户**：DQE 侧能不能为此开 CORS 属于 #3 的外部依赖，票里明写「这一点要先确认再往下设计」。**开不了，CORS 直连整条路就不成立，得回头重看反代方案**——而 `apps/canvas` 的相对路径说明反代可能本来就是现实。别在这个未确认的前提上把下游设计做完。

现成抓手：`DqeGatewayConfig` 已有 `endpoint` / `headers` / `fetchImpl` / `timeoutMs` / `maxConcurrentBatches` / `credentials` / `diagnostics` / `devDetail`，`credentials` 就是 CORS 抓手。要拆掉的是 `apps/platform/src/lib/server/data-gateway.server.ts`（271 行）、两个自家端点、`hooks.server.ts`（50 行）、`identity.server.ts`（193 行）、`+layout.server.ts`（14 行）。

### #102 去留清单与删除时机

**它今天比昨天好开了**：这张票缺的前提正是「最终形态长什么样」，而 [ADR-0071](../adr/0071-four-release-artifacts-with-standalone-page-protocol.md) 刚定下四个交付物（`page` / `engine` / `metric-canvas` / `embed`）与目录按交付物分组。不知道最终形态就没法定删什么、何时删。用户已裁决「连删什么、何时删一起定」，理由是迁移期的双轨不裁决就会变成永久双轨。

注意 #102 还接着 ADR-0070 的尾巴：现有 Java 代码的去留归它，且现有 Java 代码不自动充当集成应用契约真源。

---

## 三、其余票为什么现在不能 grill

| 票 | 卡在什么 |
|---|---|
| [#105](https://github.com/CCharlesMeng/MetricCanvas/issues/105) Java 接口消费对账 | 等宿主服务方的 Java 接口资料。范围已被用户修正为「对接资料与前端接入对账」，不再设计后端 |
| [#107](https://github.com/CCharlesMeng/MetricCanvas/issues/107) Relay 事件面与问数编排 | 等 #106 的提供方回答 |
| [#108](https://github.com/CCharlesMeng/MetricCanvas/issues/108) 产物通道与会话恢复 | 等 #106 的提供方回答 |
| [#103](https://github.com/CCharlesMeng/MetricCanvas/issues/103) 引擎真发布与异构集成 | 决策前置齐了，是**执行票**。注意它把 ADR-0071 的重新分包吃进了自己范围（第一条完成标志就是「按发布单元那张票定下的形状发到内网 registry」），真实体量是四交付物重新分包 + 公开面门禁 + 真集成 |
| [#104](https://github.com/CCharlesMeng/MetricCanvas/issues/104) platform 静态产物真部署 | 等 #101 与 #102。这两张一决它就能开 |

[#106](https://github.com/CCharlesMeng/MetricCanvas/issues/106) 由用户在另一会话对外问答，提问稿见 `wayfinder-106-relay-chat-handoff-2026-09-07.md`。

---

## 四、并发警告

**#106 的会话与本会话共用同一个工作区。** 改地图 #95 的 body 前先 `gh issue view 95 --json body -q .body` 取一份快照，编辑后推送前再取一次 `diff` 比对；本会话已经踩过一次——用会话早期缓存的旧文本去匹配，结果那一行早被对面改过了。`docs/plan/` 下的文件优先认为是对面的产出，不要顺手改。

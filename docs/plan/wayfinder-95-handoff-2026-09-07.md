# Handoff：#95 platform 静态化与渲染引擎独立交付

状态快照：2026-09-07。已读取 #95 地图、全部子票状态和原生 blocked_by；新会话开工仍需刷新所选票的正文、评论、指派与阻塞状态。

**同日 #99 后续裁决：** 用户已确认真实 Java HTTP + 内存存储（接受重启清空）、DQE HTTP 仿真仅承诺已知协议与明确测试场景；所有数据请求的头与相关 Cookie 均归宿主，本仓不新增身份适配器或用户切换器；旧 scripted/lexical 模型仅作测试与迁移对照。见 [ADR-0069](../adr/0069-local-boundary-substitutes-and-host-owned-credentials.md)。#99 的 grill 已完成；下文其启动语句保留为历史，不再作为待讨论入口。#101 接线、#102 删除与 #104 验收分别承接执行。导航另一路已新增 ADR-0068，#109 以现场状态为准。

仓库：`/Users/moon/Documents/Code/公司项目/DataDashboard`；GitHub：`CCharlesMeng/MetricCanvas`；当前分支 `main`，HEAD 为 `5a93288`（创作隔离已交付）。

**#100 同日挂起交接：** 用户已确认支持范围、Svelte 下限、ESM/IIFE、统一版本、首版 1.0.0、发布门禁与 Chrome/Edge；Q5 发布单元与正式包名未决，七包只是助手建议。用户要求另开会话独立讨论，#100 保持 OPEN 并解除本会话认领。接续见 [#100 grill handoff](wayfinder-100-release-grill-handoff-2026-09-07.md) 或 [已持久化的挂起评论](https://github.com/CCharlesMeng/MetricCanvas/issues/100#issuecomment-5569086529)，讨论完成后再归档该决策票。

地图：[Wayfinding|platform 静态化与渲染引擎独立交付 #95](https://github.com/CCharlesMeng/MetricCanvas/issues/95)。这是原临时文件 `metriccanvas-wayfinder-95-handoff.md` 的后续交接；不要再按旧文件把 #96 当作未完成 frontier。

**#105 同日范围修正：** 用户明确 Java 服务不由本仓设计实现，直接消费宿主接口。停止旧的后端语义 grill，四项未确认建议不成立；#105 保持开放，转为接口消费资料与前端接入对账，见 [ADR-0070](../adr/0070-consume-host-java-page-assets-api.md)。现有 Java 代码仅作历史对照，去留交 #102，不自动作为宿主契约真源。下文旧 #105 设计职责已被此裁决取代。

## 先选工作：开发与独立设计分开

**现在可启动开发流程的是 #109，但它需要先完成票内协议设计，再编码；没有一张“全部字段和兼容规则已冻结、可以跳过设计直接实现”的新执行票。**

**本轮完成 #99 后，可独立 grill／设计的是 #100、#105；#101 的 #99 决策前置也已完成。** #106 可同时开展外部事实确认，但不是编码，也不能靠内部 grill 猜出提供方协议。其余开放子票都有下述前置。

### A. 可以启动开发流程

| 切片 | 现在可以做什么 | 开始编码前要完成什么 | 交付和依赖 |
|---|---|---|---|
| [#109 跨页导航改用 URL 与显式参数绑定](https://github.com/CCharlesMeng/MetricCanvas/issues/109) | 读取 ADR-0067，设计并实现 URL 导航、参数绑定和存量页面迁移；无需等待真实 DQE、身份或 #100 关闭 | 统一组件动作/text 链接形状；普通参数与 MetricCanvas 类型编码关系；query/hash 合并、同名键优先级、缺值行为；URL 校验与协议版本/兼容策略 | 原生 blocker 为空；产出代码、协议/契约更新、IOC 页面迁移和回归；#103 最终验收依赖它；公开面与 #100 对账 |

这张票已冻结的是“目标地址 + 显式参数绑定”和所有权，不是具体字段名。当前页面参数作为绑定来源是新增能力；不要把它误写成已有实现。当前协议仍是 5.4，不能原地静默硬切，按 ADR-0051 处理版本与迁移。

已知实现接缝和真实例子都在 #109 正文，不重新全仓勘察。特别注意 #56 后共享渲染主体已经移到 `packages/runtime-ui/src/RuntimeSurface.svelte`，不能再沿旧路径假设 `RuntimeView.svelte` 拥有全部状态。

**新会话启动语句：**

> 阅读 `docs/plan/wayfinder-95-handoff-2026-09-07.md`，继续地图 #95，只做 #109。读取地图、#109 正文和 #97/#98 最终裁决、ADR 基线及 ADR-0067。先完成票内尚未冻结的协议与迁移设计，再实施和回归；不要重开“URL 由页面声明”的已决方向。与 #100 对账公开面，不修改已完成 #56 的范围，不在 5.4 上静默硬切。

### B. 可以独立 grill／设计

以下三张票在原快照时均未指派，没有开放原生 blocker；#99 本轮已完成裁决，#100/#105 可各开一个会话。先形成裁决/设计，不能把“可开始讨论”当成“可以提前实施删除或发布”。

| 切片 | 主要裁决 | 预期产物 | 必须对账的交叉面 |
|---|---|---|---|
| [#99 本地第一个版本的 mock 边界](https://github.com/CCharlesMeng/MetricCanvas/issues/99)（已决） | 真 Java + 内存存储；DQE HTTP 仿真；请求头/Cookie 全归宿主；旧模型仅测试/迁移 | ADR-0069 已记录替代矩阵、规则与待执行验证 | 解锁 #101；#102 处理删除；#104 验证本地链路；Java 最终接口随 #105 |
| [#100 引擎发布单元与公开 API 门禁](https://github.com/CCharlesMeng/MetricCanvas/issues/100) | 正式包名/发布单元、源码或构建产物、版本支持策略、公开 API 快照、需先偿还的公开面欠账 | 发布设计、API/兼容门禁范围与可执行实施工作 | #96 已关闭；#56 已交付的 composition 子入口及 Svelte 下限已有评论记录；#109 导航面仍在迁移，最终不能冻结旧 pageId 契约 |
| [#105 Java 页面资产接口定义对账](https://github.com/CCharlesMeng/MetricCanvas/issues/105) | PUT/DELETE 语义、页面寻址、目录与精确修订、幂等/并发/错误信封、身份可信性、SLA、作者文件真源 | 可交付的 Swagger 2.0 + 裁决记录，明确后续实现差异 | `page_id` 全局唯一、PUT/DELETE 保留已定；身份须与 #101/#107 一致；治理语义须与 #102 一致；#109 取消导航 pageId 不删除资产身份 |

**#99 原启动语句（已完成，仅供追溯）：**

> 阅读本 handoff，继续地图 #95，只 grill #99。以用户已定“mock 只待在系统边界、不改变契约形状”为边界，逐项裁决本地 Java/MySQL、DQE、身份与旧模型兜底的替代方式。对账 #97 的宿主身份所有权和 #105/#106 的接口现实；本票先产决策，不提前实施静态化或删除。

**#100 启动语句：**

> 阅读本 handoff，继续地图 #95，只 grill 和设计 #100。读取 #96/#97/#98 的最终裁决及 #100 评论里的 #56 交付记录，把 runtime-ui/composition、Svelte 兼容范围、JS 地址 + mount 和 #109 的导航迁移纳入发布设计。独立创作包与无宿主样式配置已定，不重开；本票不直接发布 npm。

**#105 启动语句：**

> 阅读本 handoff 和 ADR-0070，继续地图 #95，只做 #105 的宿主 Java 接口消费对账。以票内宿主 Swagger 为输入，核对前端适配与实际接入所需事实；不设计或实现 Java，不重问 PUT/DELETE、存储、资源身份等提供方语义，不把未提供的接口当作不支持。请求头与 Cookie 归宿主。旧 Java 代码只作对照，改动去留交 #102，前端接线与验收交 #101/#104。

### C. 可立即开展的外部事实工作：#106

[#106 盘古助手对话客户端的待确认事项](https://github.com/CCharlesMeng/MetricCanvas/issues/106) 没有原生 blocker，标签是 `wayfinder:task`，是**提供方问答**，不是开发票。

- **2026-09-07 对象已改**：对话 chrome 归盘古助手第二实例（`window.pangu.instance`）；问数结果仍在 RuntimeView 旁路。platform 是微前端子应用，不重复加载 `loader.js`。发送消息服务的传输层不再问。
- 发送消息服务接口原文仍在 [#106 评论](https://github.com/CCharlesMeng/MetricCanvas/issues/106#issuecomment-5567401672)，仅作对照。现行提问稿见 `docs/plan/wayfinder-106-relay-chat-handoff-2026-09-07.md`（10 问，对象是盘古助手）。
- 对接时核实 #107 所需的受控 Skill 路由（`skillInfo` / `referrer`）和 `getCustomOnMessageEvent` 事件形状，以及 #108 所需的会话读回 / 持久化边界；不要凭猜测认定 adapter 已支持问数编排或产物通道。
- 用户或获明确授权的对接者取得提供方回答。不得在未获发送授权时替用户联系他人。
- **“没有”也是有效答案。** 缺答案不能当作接口不支持。票内第 1、4、8 项已内部关闭（改由盘古承担），不是「接口不支持」。

**启动语句：**

> 阅读 `docs/plan/wayfinder-106-relay-chat-handoff-2026-09-07.md`，继续地图 #95，只推进 #106。对象是盘古助手实例 API 与 adapter，不是自打发送消息服务。17 问已作废。已取得的回答逐条记录来源和日期，未知项保持未知，不猜协议，不实现适配器，也不自行发送消息给提供方。

## 后续队列：接线、设计与开发的前置

表中只列**当前开放的原生 blocker**；语义上需互相对账的票另写在说明里。

| 切片 | 开放 blocker | 前置到位后做什么 | 等待时最多可以准备什么 |
|---|---|---|---|
| [#101 静态 platform 的数据与身份通路](https://github.com/CCharlesMeng/MetricCanvas/issues/101) | 无（#99 已决） | 按宿主决定头/Cookie 的边界落实 CORS、端点与请求接线；与 #105/#106/#107 对齐接口，不再另建身份系统 | 可启动；未知提供方协议仍待确认 |
| [#102 去留清单与删除时机](https://github.com/CCharlesMeng/MetricCanvas/issues/102) | #100、#101 | 定包、服务端代码、路由、样例、旧模型/持久化的去留及删除门槛 | 依据现有票事实列清单；#105 治理与 #107/#108 Chat 结果会影响删除门槛，不能提前批量删代码 |
| [#107 Relay Chat 事件面与问数编排的对账](https://github.com/CCharlesMeng/MetricCanvas/issues/107) | #106 | 定事件映射、确认/取消、取数核对、Skill 路由，以及做不到时的产品边界 | 列缺口与条件分支；不能把通用 text 流当作已经支持问数编排 |
| [#108 页面构建产物的前端交付通道与会话恢复](https://github.com/CCharlesMeng/MetricCanvas/issues/108) | #106 | 定 artifact 通路、读取/恢复、检查点归属与缺能力时的处置 | 整理提供方所需能力与候选方案；ADR-0064 的完整产物/模型摘要隔离前置仍有效 |
| [#103 引擎在真实异构宿主里跑通](https://github.com/CCharlesMeng/MetricCanvas/issues/103) | #100、#109 | 真版本发布、真实异构宿主接入与 URL 导航验收，记录宿主代码成本 | 选择宿主/容器、整理现有示例；未发布、只跑仓内示例或只验证旧导航都不能称终点线完成 |
| [#104 platform 静态产物真部署](https://github.com/CCharlesMeng/MetricCanvas/issues/104) | #101、#102、#105、#107、#108 | 删除服务端依赖，改静态输出，打通五项产品能力并真实部署 | 收集载体/CI 发布事实，不先改 adapter 再拿假接口填坑 |

依赖主线（箭头表示先完成左边，右边才能收口）：

```text
#96 已决 → #100 ───────────────┬→ #103 真异构集成
#97/#98 已决 → #109 URL 迁移 ──┘

#99 已决 → #101 → #102 ───────┐
       │      ↑              │
       │    #100             ├→ #104 静态 platform 真部署
#105 Java 接口 ──────────────┤
#106 外部事实 → #107 编排 ────┤
              → #108 产物恢复 ┘
```

#104 还直接依赖 #101；图中省略重复连线，准确状态以表格及 GitHub 原生关系为准。

## 已完成与不再重开的边界

- #96/#97/#98 已关闭，关闭的是**决策**。完整裁决在票评论，不能只读最初的问题正文。
- #56 的创作隔离已经实现、专项回归通过并提交推送到 main：`5a93288450ee61268b0bf3f7bd85ef4e69a098e8`。保持关闭。交付报告：`docs/reviews/2026-09-07-metric-canvas-authoring-isolation.md`。报告记录的全仓 3 项原有 Ask 白名单失败不算全绿，后续检查需按当时状态重新确认。
- 独立创作包提供 `MetricCanvas`；正式渲染为 `RuntimeView`，共用 `RuntimeSurface`/分区布局。渲染包不得反向依赖创作包，宿主持有编辑文档、属性面板、保存和撤销历史；不等待 #55。
- 宿主不定制字体、颜色、间距或其他样式。**“仅开放字体”在本会话中已被用户推翻，不能恢复。** 页面协议已有的声明式配置保留。
- 宿主加载 `document`、提供 `dataGateway` 并处理端点/身份/登录恢复；引擎不增加 PageRepository 或身份端口。
- 异构侧通过 JS 地址 + mount，统一称渲染引擎；不另立“嵌入渲染器”概念。自定义元素、iframe 和引擎微前端协议不增加；IOC 子应用/platform 承担应用集成。
- URL 导航目标已定，代码未实现：普通绝对/相对链接 + 显式参数绑定，默认浏览器语义，宿主不必提供 pageId 解析。取消的是导航依赖，**不是页面资产身份**。
- update 为完整输入替换；运行依赖变化沿用初始化语义。filter-change 的 URL 同步由宿主选择，不立即原样回灌 update。仅切换创作控件不重启查询/不丢筛选分页；页面文档替换不承诺无损。
- Java/Relay/Python 的现行基线是 ADR-0060～0064。**浏览器不直连旧 Relay Chat 接口，也不自打「发送消息服务」；对话经盘古助手第二实例，由它调用发送消息服务。** 协议事实仍待 #106（adapter / `PanguQuery`），不能把旧调查中的 WebSocket 或已作废的 17 问当作现行集成面。

## 同时开会话时最容易冲突的接缝

1. **#100 与 #109：** 都影响公开导航 API 和支持的页面协议范围。#100 可以独立设计包/版本策略，最终 API 快照应以 #109 的迁移结果对账；不要为了并行留下两套永久导航契约。
2. **#99 与 #105：** 前者定替代位置，后者定 Java wire contract；边界 mock 不得固化即将废弃的接口形状。
3. **#101/#105/#107：** 浏览器自填 actor/user 的可信性是同一问题；先有结论的票留下可引用裁决，其他票显式对账，不各自发明身份模型。
4. **#102 与 #105/#107/#108：** Java 治理语义和 Chat 能力会决定哪些代码可删、何时删。“现有 Relay 可连”不是旧问数可删除的证据。
5. **#109 与 #89/#91：** 页面协议/中立契约会波及创作 Bundle。后两票不属于 #95 子票，仍开放，但本 handoff 没有验收它们的实际完成度；开工前读最新评论、代码和 ADR-0064。旧正文里的 build_page/保存修订职责可能已过时，不据旧清单重复实施。
6. **文档与地图：** 多会话会写同一份 `docs/adr/README.md`、`CONTEXT.md` 与 #95 正文。ADR 编号先现场扫描；更新地图前重新拉最新 body，只增改本票相关项。#105 正文中的“下一编号 0066”已经过时，当前已写至 0069，仍须现场重新扫描。

推荐并行分工：一个会话做 #109；另开会话做 #100；另一个做 #105 或接续 #101；提供方事实收集 #106 同时推进。每个会话默认只承接一张票。#99 已完成裁决；并行不等于最终结论互不需要对账。

## 新会话必须读取与保留的本地状态

先完整读一次 #95 地图，再读 `CONTEXT.md`、`docs/adr/README.md` 的相关基线和选中票的完整正文/评论。按问题展开具体 ADR，不把一份旧 ADR 当成全部现行结论。票里已有勘察事实和路径，优先复用，只复核当前任务会改变的接缝。

本次工作区有以下尚未提交的文档，**新 worktree/干净 clone 默认拿不到**；不能只 checkout main 就假定已获得本轮全部裁决：

- `docs/adr/0066-self-contained-rendering-engine-host-boundary.md`
- `docs/adr/0067-url-navigation-with-explicit-parameter-bindings.md`
- `docs/adr/README.md`
- `docs/host-contract.md`
- `CONTEXT.md`
- `docs/solution.md`
- `packages/embed/README.md`
- 本 handoff 文件。

最省事是在同一工作区续接。另开 worktree 时先从上面的原仓绝对路径读取并保留这批文档；若文档不在新工作树中，#97/#98 的完整裁决评论与 #109 正文是已持久化到 GitHub 的恢复依据。本 handoff 不代表这些文档已经提交或推送。

原文入口：

- [#97 最终裁决](https://github.com/CCharlesMeng/MetricCanvas/issues/97#issuecomment-5567555239)
- [#98 最终裁决](https://github.com/CCharlesMeng/MetricCanvas/issues/98#issuecomment-5567556449)
- [#105 宿主 Swagger 原文](https://github.com/CCharlesMeng/MetricCanvas/issues/105#issuecomment-5567257814)
- [#106 公共 chat 接口原文](https://github.com/CCharlesMeng/MetricCanvas/issues/106#issuecomment-5567401672)
- #100 评论含 #56 的 composition Interface、Svelte 下限、测试与 main 提交记录。

## 执行约定与收口

- issue 操作使用 `gh --repo CCharlesMeng/MetricCanvas`。macOS 下 `gh auth status`、需要网络/身份的 gh 和 git 命令从一开始使用沙箱提权，避免将 Keychain 隔离误报为凭据失效；批准前缀保持窄。
- 开工先刷新所选票的指派与阻塞状态，避免撞会话。认领票是该执行会话的第一个写操作：`gh issue edit <n> --repo CCharlesMeng/MetricCanvas --add-assignee @me`。
- grill/设计票按 `grilling` + `domain-modeling` 走，用户确认后才把决策落盘；本轮不要求再次确认 #96/#97/#98 已冻结结论。纯逻辑、协议、重构不因“前端”关键词自动走 SDD；只有对外部设计源还原视觉/结构才评估 SDD。
- 收口：完整答案写本票评论 → 关闭真正完成的票 → 重拉 #95 最新正文并追加一句决策索引 → 新执行工作先建票再连 sub-issue/blocked_by。原生关系使用数据库 id，不把 issue number 当 id。
- 对发布/部署票，构建成功、vite preview、仓内示例通过不能替代真实发布/部署；未达到终点线就如实保留待办。
- 当前环境可用性以地图为依据：Java 宿主、Relay、cdi-portal、内网 registry 有条件；真实 DQE/MySQL 不可达。新会话按需要复核，不把本地仿真结果当成生产能力。

## 尚不应扩大到本批的工作

#13 仍开放，剩真实登录态及生产示例，依赖 #3/#101 的结论；不是遗漏的独立开发入口。#55 与本次创作隔离独立，不把它恢复为硬前置。

长期 Java 接管服务端能力的顺序、宿主自带组件扩展、mock 退场时点和部分 #83 公开面欠账仍在地图留白；先由上述切片暴露真实需要，再拆票。Monitor、归因诊断、GraphQL 谓词、表格服务端能力等产品功能仍不属于本次部署/交付地图。

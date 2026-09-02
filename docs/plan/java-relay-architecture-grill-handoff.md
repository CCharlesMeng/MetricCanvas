# Java + Relay 目标架构 grill 续接记录

> 日期：2026-09-02
>
> 状态：Java 页面资产（ADR-0062）与 Relay/DQE 接线事实（ADR-0063）已裁决；独立创作 Bundle S0–S4 已完成；余下维度见第 12 节。
> 用途：新会话先读本文、`CONTEXT.md`、`docs/adr/README.md`、ADR-0060 与 ADR-0061，再从尚未裁决的下一维度继续。

## 1. 为什么重新设计

现有仓库已经实现一套 SvelteKit Node 全栈平台：承载页面搭建、Agent Runner、MCP、页面生命周期、会话、数据网关和模型 Adapter，并已有 PostgreSQL/MySQL 持久化适配工作。进一步讨论后出现三个新的硬约束：

1. 公司业务后端统一使用 Java，当前只能使用 Java 17 和 Spring Boot 3.5.15；
2. 生产环境希望彻底移除 Node 服务端进程，但 Svelte/Vite 前端构建阶段仍允许使用 Node；
3. 模型调用不能由 MetricCanvas 直接发起，只能进入公司内部 Relay/Data Agent，通过 Skill-Play 和 Python MCP Tool 使用固定内网模型。

因此，“Java 业务后端 + Node AI Runtime”也被否决，目标改为静态 Svelte SPA + Java 页面资产 Module + Relay/Python 创作期。

## 2. 已确认目标拓扑

```text
Svelte SPA（唯一产品界面）
├── 页面管理/加载/精确修订预览
│       └── Java 17 + Spring Boot 3.5.15
│               └── 页面资产 Module
│                       └── MySQL
└── Chat Interface（用户问题 + 受控 Skill key）
        └── Relay / Skill-Play / 固定内网模型
                └── MetricCanvas Skill
                        └── Python FastMCP Tools
                                ├── 数据上下文与 DQE
                                ├── 确定性页面装配算法
                                └── Java savePageRevision
```

生产环境没有 Node 服务端；Node 只存在于前端开发和 CI 构建阶段。Relay/Python 是目标生产拓扑中的独立运行时，不等于“所有后端都用 Java”。

## 3. 各 Module 的所有权

| Module | 拥有 | 明确不拥有 |
|---|---|---|
| Svelte SPA | 唯一用户界面、Chat 交互、页面管理、精确修订预览、统一运行时 | Skill 正文、模型 Secret、页面保存不变式 |
| Relay | 内网模型调用、Skill 加载、工具调度、对话、Agent Run | 页面元数据装配算法、页面数据库写入 |
| MetricCanvas Skill | 角色说明、触发规则、推荐创作流程、工具白名单、兜底话术 | 强事务、页面修订持久化、任意高权限数据访问 |
| Python Tool | 数据上下文/DQE Adapter、确定性页面装配、页面校验前置、Java 调用 | MySQL 直写、第二套页面资产真源 |
| Java 页面资产 Module | 页面校验、不可变页面修订、基线并发、幂等、身份审计、页面读取 | 模型调用、Agent 编排、页面布局算法 |
| DQE | 指标/维度/数据行权限、业务数据执行 | 页面资产权限、页面修订和发布状态 |

## 4. 页面生成不是 Relay 算法

讨论中曾把“Relay 负责 Agent 运行”误写成“Relay 生成页面元数据”，现已纠正。

目标链路是：

```text
自然语言问题
→ Relay/Skill 理解需求
→ 形成结构化装配输入（工作名 PageBuildSpec）
→ Python Tool 获取并验真查询
→ Python 页面装配算法生成 Page Metadata
→ 页面 Schema 校验
→ Java savePageRevision
→ 返回 pageId + revisionId + revisionNumber
→ Svelte 加载精确页面修订预览
```

模型负责有不确定性的语义判断；Python 算法负责确定性映射。模型不得自由决定组件 JSON、span、字段绑定或 `schemaVersion`。现有 TypeScript 装配逻辑、页面 Schema、组件能力目录及契约测试是 Python 迁移的参考基线，不应逐行翻译后失去行为对照。

“确定性”在本次讨论中最终解释为**约束确定性**：Relay 的工具调用轨迹允许变化，但未通过权限、DQE 验真、页面校验和保存准入的结果无法成为页面修订。

## 5. Java 首批范围

Java 是独立部署的模块化单体，不是微服务群。首批页面 Interface 暂定：

```text
savePageRevision
getLatestPage
getPageRevision
listPages
```

Interface 小不等于数据库覆盖写。建议的保存语义：

```text
第一次保存 A：插入 revision-1，latestRevisionId → revision-1
第二次保存 B：插入 revision-2，latestRevisionId → revision-2
getLatestPage：只返回 revision-2
```

因此首批可以只展示 `save/getLatest`，同时保留未来历史与回滚所需的数据。不可变修订只保存成功落库的页面元数据历史；完整 AI 思考和工具调用记录仍属于 Relay Run。

每个保存入口从第一次交付起必须支持：

- 当前 Page JSON Schema 复验；
- 稳定 `pageId` 与不可变 `revisionId`；
- `baseRevisionId` 基线冲突；
- `idempotencyKey` 重试重放；
- `actorId`、`sourceRunId`、`sourceSkillVersion` 与时间审计。

审核、发布、下线、回滚、定时发布和灾备流程本批挂起，不能从“有不可变修订”推断为已经实现。

## 6. “至少一次”与幂等

一次保存可能已经在 Java 成功提交，但响应在 Relay/Python 收到前断开。调用方无法判断结果，只能重试，因此同一逻辑请求可能到达 Java 一次或多次，这叫至少一次执行。

```text
idempotencyKey = run-123/save-page
第一次调用 → 创建 revision-7
第二次同 key → 不再创建，原样返回 revision-7
```

这不是要求 Relay 当前已经具备重启恢复；它首先是 Java 所有写入口的安全下限。Relay 是否保存 Run、能否自动恢复、模型调用是否会重复和取消如何传播仍需后续验证。

“Agent Worker”是浏览器关闭后继续执行 Agent Run 的后台执行者。在新拓扑中该职责属于 Relay，Java 不再建设 Agent Worker。

## 7. 权限与数据边界的已决部分

- 暂不在 MetricCanvas 自建租户模型，等待公司统一方案；业务域不得冒充租户。
- 不把创作权限、发现权限、执行权限拆成三套 MetricCanvas 申请流程；用户自行申请目标数据权限。
- DQE 是指标、维度和数据行权限真源；MetricCanvas 不使用后台高权限身份绕过用户权限。
- 用户无目标数据权限时，页面应提供明确、可行动的权限申请提示。
- 数据上下文结果必须按当前身份过滤，不能把全局快照无差别暴露给创作者。
- 统一运行时以当前查看者身份执行 DQE；发布者权限不传递给查看者。
- 公网模型不可接收用户问题、页面内容或 DQE 数据；只允许 Relay 内的固定内网模型。
- 即使是内网模型，也按最小必要原则传递字段与有限结果，不倾倒完整 DQE 结果。

鉴权与身份接入的技术方案不进入当前架构讨论与实施计划，由后续取得的内网对接方案承担。本节已决的数据边界保留，但不在 MetricCanvas 中先行设计 SSO、Cookie、JWT、Token、验签或身份传递任务。

## 8. Chat 与 Skill 的已决部分

Svelte 通过一个 Chat Interface 发起 AI 创作，并携带关键 Skill 标识，使 Relay 唤起特定 Skill。前端只传受控 key 和业务输入，例如：

```json
{
  "skillKey": "metriccanvas-page-builder",
  "message": "生成上个月收入分析页面",
  "pageId": null
}
```

真正的 `SKILL.md`、Skill 版本、工具白名单和 Plugin 权限由 Relay 服务端解析；浏览器不得提交或覆盖这些内容。Chat Interface 的 URL、流式事件协议、错误信封和 Relay 适配方式尚未确定。

首批交互只要求结构化步骤进度和保存后的精确修订预览，不要求流式渲染尚未完成、尚未校验的 Page Metadata。

## 9. Relay 输入文档带来的事实

本次讨论依据用户提供的《Data Agent Skill 开发指南》（2026-09-01）：

- Relay 是 Plan-Execute Agent Runtime；
- Data Agent 采用单层 Skill-Play 模式；
- `skill_play` 把 `SKILL.md` 注入当前对话上下文；
- Plugin 注册 Mode、Hook、Tool 与 Auth；
- Skill、Plugin 与 MCP 配置共同约束工具可见性；
- Python 3.12+ FastMCP Tool 可通过 stdio/SSE/Streamable HTTP 接入，现有 Data Agent 使用 stdio；
- Python Tool 推荐分为 interfaces/domain/infrastructure；
- 文档没有证明 Run 持久化、断点恢复、取消传播、结构化页面 artifact 事件或请求级身份注入能力。

因此最后五项不能靠猜测写入实现，必须在接触真实 Relay 仓库后验证。

## 10. 与当前仓库的差异

当前代码和旧 ADR 仍体现 Node 平台：

- `apps/platform` 是 SvelteKit Node 全栈应用；
- Agent Runner、Ask 编排、MCP、会话、身份和模型 Adapter 在 TypeScript 中；
- 页面生命周期已有 TypeScript memory/PostgreSQL/MySQL Adapter；
- ADR-0009 原定 Node + PostgreSQL；
- ADR-0024 把 Agent Runner 收敛进 `apps/platform`；
- ADR-0037/0057 已包含固定问数编排和确定性页面装配规则；
- ADR-0058 已定义会话检查点和临时页面态恢复。

ADR-0060 只改变目标架构，不意味着这些实现已经迁移。迁移规划必须明确哪些 TypeScript 行为移植到 Java、哪些装配算法移植到 Python、哪些能力由 Relay 接管、哪些旧代码最后删除。

## 11. 已挂起，不得暗自决定

- 审核、发布、定时发布、下线与业务回滚状态机；
- 页面模板发布治理强度；
- 数据库 RPO/RTO、PITR、备份频率和恢复演练；
- 租户模型；
- Java 数据访问选型（jOOQ、JdbcClient、MyBatis 等）；
- Maven/Gradle；
- Redis、消息队列和多实例部署；
- Relay Run 与现有分析会话/会话检查点的映射；
- Relay 对话与工具正文的保留期；
- Chat 流式协议、取消和断线重连；
- 外部 MCP 能力面。当前 MCP 只作为 Relay→Python 的内部 Adapter。

## 12. 逐维度 grill 状态

一次只讨论一个维度，避免同时铺开。

### 已退出当前计划：鉴权与身份接入

后续内网对接方案作为外部输入，当前不再拆解或排期。

### 已冻结并完成到 S4：独立创作 Bundle

决策见 [ADR-0061](../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)，分期实施与验收见 [`metriccanvas-authoring-bundle.md`](./metriccanvas-authoring-bundle.md)。Bundle 是原子发布容器，Skill 与 Python Tool 是两个平级 Module，只经 MCP Tool Interface 协作；仓根拥有产品中立契约，Bundle 自有 Authoring contracts 并携带锁定快照，Fake 与 fixture 只属于 Test Harness。该维度同时冻结了 Page Build Spec 的抽象层、FastMCP 只作为 Adapter、差分迁移、单 Bundle 版本与当前页面协议生成策略。

### 已裁决：Java 页面资产

Java 页面资产由当前仓库建设为第一方独立 Module，决策见
[ADR-0062](../adr/0062-first-party-java-page-assets-module.md)，切片与验收见
[`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md)。目录、构建、spec-first
OpenAPI、完整复验深度、指纹幂等、锁序、列类型与只接 `apps/platform` 的前端接线均已
冻结；公司 Java 约定已由 `调查报告/java-service.md` 回填，工程按可被
`CDINL2DataBuilderService` 吸收的三 module 形状建设。该维度同时把 `apps/canvas` 定位为
示例与参考宿主，并登记"platform 去 Node 服务端"为必经后续轨道。

### 已裁决：Relay 与 DQE 接线事实

`调查报告/relay.md` 与 `调查报告/dqe.md` 带回真实接口，决策见
[ADR-0063](../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)，接线切片 A1–A3 见
[`metriccanvas-authoring-bundle.md`](./metriccanvas-authoring-bundle.md)。第 9 节列出的
"文档没有证明"的五项现已有答案：Run 不持久化为一等实体（事件按 session 落库）、
无断点续跑（按 `session_id + version_id` 增量重放）、取消不终止 MCP 子进程、无结构化
页面 artifact 事件但 `result_summary` 可承载结构化对象、MCP 路径不注入请求级身份。
第 6 节的"至少一次"已由 Planner/模型重试证实，幂等键由 Tool 派生。第 8 节的
`skillKey` 示例修正为 Relay 的 WebSocket + `role_name`。第 7 节"以当前身份执行 DQE"在
创作期第一阶段以服务态身份偏离，生产门禁是 Relay Plugin 注入。

### 尚待后续 grill

0. **platform 去 Node 服务端**：ADR-0062 把"唯一产品界面"落到 `apps/platform`，其
   `adapter-node` 服务端职责如何分别交给 Relay（问数/Agent）与 Java（页面资产）并静态化，
   需单独裁决。
1. **Chat 接线与 Run 可靠性**：platform 以 WebSocket 接 Relay、`role_name` 唤起 Skill、
   `config.agent_context` 传业务参数、`result_summary` 透出修订标识、`interrupt` 与增量重放
   的前端处理；Relay 无 Run 持久化与续跑，取消对 MCP 尽力而为，这些事实限制该维度的目标。
2. **跨语言运行契约**：工具错误、进度事件和真实 Adapter 版本兼容。Page Schema、组件能力目录和页面构建规格的真源方向已由 ADR-0061 冻结；Relay 侧无结构化 artifact 事件，页面结果只能经 `result_summary`。
3. **发布工作流**：固定状态机、审批、定时发布、下线、业务回滚与发布可见性。
4. **运维与恢复**：部署拓扑、可观测性、审计保留、备份、RPO/RTO 和恢复演练。

## 13. 已形成的 ADR

- [ADR-0060：静态 Svelte、Java 页面治理与 Relay/Python 创作期取代 Node 平台](../adr/0060-static-svelte-java-page-governance-relay-python-authoring.md)
- [ADR-0061：自包含创作 Bundle 与中立契约单向导出](../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)
- [ADR-0062：第一方 Java 页面资产 Module 的工程、Interface 与持久化边界](../adr/0062-first-party-java-page-assets-module.md)
- [ADR-0063：Relay 与 DQE 真实接口对创作期边界的修正](../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)
- [ADR-0009](../adr/0009-node-postgres-platform-beside-runtime.md) 已标记为被 ADR-0060 取代。

独立创作 Bundle 已完成 S0–S4；接线切片 A1–A3 与 Java J1–J4 可并行开工；S5 切换依赖
二者完成。外部前置只剩测试环境地址、账号与 LiteLLM key 的线下获取。

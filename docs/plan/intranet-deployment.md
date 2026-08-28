# MetricCanvas 内网部署第一期方案

日期：2026-08-28

## 这份文档是什么

第一期内网部署的**范围、外部契约与任务清单**，可直接据此开工。它取代 `/private/tmp/metriccanvas-intranet-deployment-optimization-handoff-2026-08-28.md` 的「初步拆分结论」「初步 Adapter 方案」「初步上线顺序」三节（废弃理由见 §5），该交接稿的仓库事实核查部分仍有效。

**这不是 ADR。** 记录第一期怎么做，不新立架构决策。若实施中确认要改变部署所有权、查询协议或身份/权限归属，再单独判断是否满足 ADR 条件。

## 1. 第一期边界

### 1.1 验收切片

**首个业务域：数据地图与知识点。**

这个域在仓库里**零命中**（全库搜索 `数据地图` / `知识点` 无结果），内置数据上下文快照 `schema-metadata.example.json` 也不含它。自有语义层**有这个域且可以映射，但形态与 MetricCanvas 的数据上下文略有不同**，详细对齐待安排。

因此第一期多一个前置工作项：**为该域建立数据上下文**——业务域描述、指标条目、维度、时间维度与粒度能力。

⚠️ **映射对齐要早做，即使 A5 排在后面。** 判据是：这个域的概念能不能装进 `DataContextSnapshot` 的现有结构（`DataSchema` / `MetricEntry` / `DataField` / `DataRelationship`）。装得进，A5 就是纯 adapter 工作，改动锁在 `packages/mcp` 里；装不进——特别是「知识点」如果不是指标形态而是别的东西——那就是 **schema 工作，会触碰核心**，`formatVersion` 要递增，语义面投影、检索、创作期验真都要跟着动。两种情况的工作量与风险差一个量级，而这个判断只需要一次对齐会议就能做出，不需要等到 A5 开工。

**完成判据：** 该域的两到三个页面（其中至少一个由 AI 建页产出）在内网门户中，由真实用户以自己的身份打开，取到正确数据。

### 1.2 做

| 能力 | 说明 |
|---|---|
| 页面搭建工作台 | 人工搭建 + AI 建页（Agent 工具循环，非流式端点） |
| 发布治理 | 修订、发布租约、审计，沿用 ADR-0008 / 0010 |
| 真实取数 | 接自有 DQE，创作期验真与运行时取数共用同一 adapter |
| Embed 嵌入已有内网门户 | 同域部署 |
| 身份通道 | 认证接入 + actor 真实到达取数 adapter 的构造点 |
| MySQL 8.0 持久化 | 含独立的版本化迁移 Job |
| 语义 overlay | 平台侧补充声明，含回流通道 |

### 1.3 不做

| 能力 | 排除理由 |
|---|---|
| 问数（Ask） | 用户裁决 |
| 分析会话持久化（#52） | 分析会话只被问数的 SSE 端点消费，第一期不在链路上 |
| 指标需求条目台账 | 从会话事件聚合，随问数一起排除 |
| 远程 MCP transport | AI 建页在 Platform 进程内，`InMemoryTransport` 够用；只有一个 adapter 的 seam 是假 seam |
| SSE 支持要求 | AI 建页走非流式端点（`stream-endpoint.ts` 的 `mode` 硬编码为 `ask`），内网入口不需要支持 POST SSE |
| 维度候选值端口 | `RuntimeDataGateway = DataGateway & Partial<DimensionValuesGateway>`，能力缺席即 `unavailable`，筛选控件已有显式呈现 |
| overlay 的问数消费面 | 可加性、时间聚合的唯一消费者是问数校验；第一期只做创作期验真所需的闭集 |

### 1.4 一条新增的部署约束

AI 建页是一个**可能跑满 120 秒的普通 POST**（`AGENT_RUN_TIMEOUT_MS = 120_000`）。内网反向代理的请求超时必须放宽到 120 秒以上，否则建页会在网关层被掐断，客户端只能看到一个没有分类的连接错误。

## 2. 三条约束怎么被保证

验收不看「有没有写 adapter」，看下面三件事是否成立。

### 2.1 核心能力完备 → 契约测试

**每个外部 seam 一份契约测试，内存 fake 与真实 adapter 跑同一份。** 换外部系统时「有没有破坏核心能力」是机器判据。

仓库已有范例，不需要发明：`packages/page-lifecycle/tests/contract.ts` 的 `runPageLifecycleContract`（memory / postgres 共用，**已含并发用例**）、`apps/platform/tests/session-store.contract.test.ts` 的 `runAnalysisSessionStoreContract`、`packages/mcp/tests/data-context-contract.test.ts`。

**纪律：契约要改必须所有实现同时改并说明理由。** 不允许「先让新 adapter 通过，旧实现稍后跟上」——一旦开口，旧实现腐化成半成品，参照价值归零。

### 2.2 外部变更不污染核心 → seam 清单 + import 白名单

契约测试保证「换了还能用」，import 白名单保证「根本没人绕过 seam 直连」。两个都要。

已有形式：`apps/platform/tests/agent/dependency-boundary.test.ts` 与 `tests/ask/dependency-boundary.test.ts` 的文件级 import 白名单，其中 `runner.ts` 强制对 `@metriccanvas/mcp` 只能 `import type`。

**第一期新增两条守护：**

1. **跨包边界**：核心包（`page` / `runtime` / `widgets` / `runtime-ui`）不得 import 任何外部系统 adapter 或平台组合根。当前包依赖图（单向无环、汇点 `@metriccanvas/page`）完全靠 `package.json` 声明，没有任何自动化守护。
2. **身份不得绕过**：`getServerDataGateway` 只允许在身份绑定函数内被调用（见 A1）。

### 2.3 改动范围可控 → 沿用既有包边界

交接稿的「八个逻辑 Module」与仓库既有包边界不是一一对应，两张地图并存会让每次改动对着两张各论证一遍。**沿用 ADR-0006 / 0024 / 0025 收敛出的包边界当模块地图**，只叠一层标注：哪些包含有外部 seam、adapter 在哪。§4 每个任务明确列出触碰的模块。

## 3. 外部系统契约

五个 seam。**四个的 Interface 一个字不动，只加 adapter。**

### 3.1 取数：`DataGateway`

```
packages/runtime/src/ports.ts
fetchData(query: EffectiveQuery, diagnosticContext?, signal?): Promise<DataGatewayResult>
```

自有取数系统**原生接受 DQE**（已确认）。因此 `QUERY_LANGUAGES` 仍只有 `dqe`，`PageQuery` / `EffectiveQuery` 判别联合、取数单元派生、创作期验真、`filterBindings` 写入路径、`dispatch.ts` 的 language 分发表**全部不动**。

**身份注入位已经存在**，不需要新增接口：

```32:35:apps/platform/src/lib/server/data-gateway.server.ts
export interface ServerDataGatewayConfig {
  environment: ServerEnvironment;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
```

按请求构造 gateway、`headers` 带身份即可。gateway 只是一圈闭包，每请求构造不贵。

**adapter 必须满足的既有契约**（不是新要求，是 port 注释与 `docs/runtime-architecture.md` 已写死的，接外部系统时最容易被静默打断）：

1. **取消贯通**：`signal` 传递到底层网络请求，中止后的拒绝归类为 `DQE_CANCELLED`。运行时请求代次机制（issue #53）依赖它；退化成「丢弃迟到结果」会让快速切筛选时上游请求积压。
2. **批量执行**：同一微任务窗口的查询合并为 `dsl_list`，请求顺序与结果顺序一致，每项独立成败，数量不一致时拒绝批次。若上游不支持批量，adapter 退化为 N 个并发请求，需同步重新确认并发上限（当前 5）、错误隔离粒度与诊断记录的 `batchId`。
3. **诊断脱敏红线**（issue #47）：原始响应、数据行、字段值、筛选值、上游错误正文**没有任何字段**可以进诊断记录。`packages/data-gateway/tests/diagnostics.test.ts` 用敏感哨兵值断言，新 adapter 纳入同一套断言。

错误分类映射到 `QueryErrorCode` 封闭集（`packages/page/src/query-error.ts`），不新造分类。

### 3.2 数据上下文：`DataContextProvider` + overlay

```
packages/mcp/src/data-context.ts
current(): Promise<DataContextSnapshot>
```

无参、返回全量快照，所有检索在这份快照上做本地匹配。**第一期保持这个形状**，adapter 从语义层一次性拉取并缓存。有效前提是**指标条目规模在数百条以内**；超过之后需把检索下推给语义层（Interface 改成 search + resolve），那是核心内部改动，单独排批次。

**overlay：** 语义层给不了的事实（可加性、时间聚合方式、维度层级、别名补充）由平台侧维护，与语义层拉取内容合并成快照。它同时补齐缺失事实，并让「语义层换了、overlay 不变」成立。

**overlay 存 MySQL，按不可变修订建模**，复用页面修订的既有形状（修订链 + 审计事件）。**不放 Git**——overlay 是部署实例的数据不是产品的数据，放进产品仓库意味着语义层改一次口径就要发一次版。文件只作为导入导出格式。

**回流通道**（用户明确要求）：导出两个 overlay 修订之间的差异清单，人工递交数据侧。不指望语义层开放写接口。可审计性由修订链提供。

第一期 overlay 只需覆盖**创作期验真的清单校验闭集**（指标名、维度名、维度取值域、时间粒度）。可加性与时间聚合的唯一消费者是问数校验，随问数一起后置。

### 3.3 模型：`ModelProvider`

```
apps/platform/src/lib/server/agent/types.ts
complete(request: ModelRequest): Promise<ModelResponse>   // 非流式，chat + tool calling
```

自有大模型**支持 OpenAI 兼容接口**（已确认）。现有 `deepseek.server.ts` 就是标准 OpenAI 形状。接入 = `resolveAgentModelConfig` 增加一个 provider 分支 + 配置 `baseUrl` 与凭据。**核心零改动，`AskModelPort` 第一期不需要。**

### 3.4 身份

认证与传播是两件事，代价差一个数量级。

- **认证**：`identity.server.ts` 已经是唯一身份构造点。校验形式待定（§7）。
- **传播**：**不给 port 方法签名加 actor 参数**。照 `createRunScopedMcpConnector({ identity })` 的既有先例，把身份**烘焙进请求级 adapter 实例**。这个形状是踩过坑收敛出来的——`services.server.ts` 注释记着此前的模块级可变引用 `currentMcpIdentity` 会让同进程并发运行互相覆盖身份。

**传播有两条独立路径，不是一条：**

1. 走 `getPlatformServices()` 的 20 个路由——其中大部分（页面读取、模板、发布确认）经 `PageLifecycle`，**本来就在传 `LifecycleContext`**，不需要重新接线。
2. `/api/data/query` 与 `/api/data/dimension-values` **不经过 composition root**，自己 `getServerDataGateway(env)`，且连 `locals.identity` 都没解构。这两个文件是真正的缺口。

### 3.5 持久化

`PageLifecycle` / `TemplateLibrary` 已是完整可替换形状：两个工厂返回同一接口，不变式抽在 `invariants.ts` 共用，一份契约喂两个 harness，组合根按环境分支。**Interface 不动。**

内网是 **MySQL 8.0**，PostgreSQL 仅作 CI 参照物保留。按驱动拆包（§4.1）。

## 4. 任务清单

两条线并行。**持久化线在关键路径上**（发布治理依赖它，发布是「页面进门户」的必经环节），且纯重写、工作量确定、不依赖任何外部系统事实。

### 4.1 持久化线

#### P1 · 按驱动拆包

**触碰模块**：新建 `packages/persistence-postgres`、`packages/persistence-mysql`；`packages/page-lifecycle`、`packages/template-library` 收缩为端口 + 不变式 + memory + 契约 harness；`services.server.ts` 改 import。

按驱动而不是按领域拆——两个持久化领域（页面生命周期、模板库）共用同一个连接池，拆成四个包是无谓的 workspace 变动。内网部署只装 `persistence-mysql`。

**P1 是纯搬迁，零行为变化。验收判据：现有 PG 契约测试原样通过，不改一行断言。**

#### P2 · MySQL adapter

**触碰模块**：`packages/persistence-mysql`。驱动用 `mysql2`。

已核实的移植障碍，按严重程度：

| 障碍 | 说明 |
|---|---|
| `pg_advisory_xact_lock` 无对等物 | MySQL 的 `GET_LOCK` 是**会话级**，事务回滚不释放，连接池里泄漏一把锁会阻塞所有人。这是唯一需要重新设计的地方。替代路径：幂等表唯一键 + `FOR UPDATE`（8.0 可用 `SKIP LOCKED`） |
| `ADD COLUMN IF NOT EXISTS` 不支持 | 现有启动期建表（`ensureSchema`）直接不可移植，强制 P3 成为硬前置 |
| 默认隔离级别 | MySQL 默认 REPEATABLE READ，PostgreSQL 默认 READ COMMITTED，`FOR UPDATE` 后重读行为不同。显式设 READ COMMITTED，或在 RR 下重新验证 |
| 无 `timestamptz` | `TIMESTAMP` 受会话时区影响、`DATETIME` 无时区。发布租约 `expires_at` 的比较时间敏感，全链路显式 UTC，不依赖数据库时区转换 |
| 驱动写法 | `postgres.js` 的 tagged template 铺满 1200+ 行，`mysql2` 没有这个写法。**体量上最大的一块**，逐行重写，模板库再来一遍 |
| `uuid` 类型 | → `CHAR(36)` 或 `BINARY(16)` |

**不是障碍**：`document jsonb` 从不被 JSON 操作符查询（全 `packages/` 搜索 `->` / `->>` / `jsonb_` / `@>` 零命中），纯整份存取，MySQL 的 `JSON` 即可。`FOR UPDATE`、`bigserial → AUTO_INCREMENT`、外键都有对等物。

**验收判据**：MySQL harness 跑通 `runPageLifecycleContract` 全量，**包括并发用例**（同基线并发保存恰一成功、并发发布申请恰一持有租约）。testcontainers 照搬 PG 做法。

**顺手做**：把行到领域对象的映射（`toPublishRequestDetails` 一类）抽出共享，让两个 adapter 里只剩真正的 SQL。不单独排期。

#### P3 · 版本化迁移 Job

**触碰模块**：`packages/persistence-mysql`（移除启动期建表）、部署清单。

独立的迁移容器/Job，应用启动前执行。**不在应用启动时自迁移**：多副本下会并发执行，而 MySQL 的 DDL 大多不是事务性的，中途失败会留下半截 schema。独立 Job 也让 DBA 能在执行前审 SQL。

这笔债本来就要还（`services.server.ts` 注释已写「等 #52 的版本化迁移接入，不引入启动期建表」），MySQL 让它没法再拖。

#### P4 · overlay 持久化

**触碰模块**：`packages/persistence-mysql`（表与修订链）、`packages/mcp`（合并逻辑）。

不可变修订 + 审计事件 + 导入导出 + 差异导出。第一期只覆盖创作期验真闭集（§3.2）。

#### P5 · 开发环境切换

`compose.yaml` 换成 MySQL 8.0。PostgreSQL 从「开发数据库」降级为「CI 里的契约参照物」。

生产 MySQL、开发 PostgreSQL 是最容易出事的配置——漂移会在最贵的时候（生产）暴露。PG 的价值是「一个已知正确的对照实现」，这个价值在 CI 里就能兑现。

**PG 的退出条件**：MySQL 在内网稳定运行三个月以上、期间契约测试从未出现「PG 通过但 MySQL 失败」的分歧、且没有第二个需要 PG 的部署环境。三条同时满足即可删——但那时删不删都无所谓，它已经证明自己不再产生信息。

### 4.2 接入线

#### A1 · 身份绑定与部署角色

**触碰模块**：`services.server.ts`（主）、`hooks.server.ts`、`identity.server.ts`、`data-gateway.server.ts`、`api/data/query/+server.ts`、`api/data/dimension-values/+server.ts`。

四件事：

1. **`bindIdentity(services, identity)`**：保留现有 `getPlatformServices()` 调用不变，只在需要身份的路由包一层。选它而不是 `event.locals.services` 或给签名加参数，是因为后两者会让一次身份改造产生 20 个文件的 diff，而其中大部分路由经 `PageLifecycle` 本来就在传 `LifecycleContext`。
2. **取数两个路由改接线**：从 `getServerDataGateway(env)` 改为经身份绑定构造，`headers` 带身份。
3. **部署角色裁剪**：环境变量 `METRICCANVAS_ROLE=reader|authoring`。只读实例**根本不构造** Agent runner、MCP server、模型 provider、run registry——不是「路由不暴露」，是这些对象压根不存在。`PlatformServices` 拆成两个类型，让「只读实例上没有 AI 建页」成为编译期事实，而不是运行时 `if`。
4. **hooks 按角色决定默认 `clientId`**：当前硬编码 `createIdentity('workbench', ...)`，而 `CLIENT_ROLES.workbench = ['publisher']`——**所有请求默认携带发布权限**。只读部署下这明显是错的，reader 角色不给任何角色。

只读侧另外两条：**窄接口**（`PageLifecycle` 是 17 方法大接口，只读侧只需 `getPublished` / `getPublishedRevision` / `getPage` / `listPages`，用 `Pick<>` 传下去，先例见 `stream-endpoint.ts`）；**只读数据库账号**（被攻破也改不了页面修订，反代白名单做不到这一点）。

**验收判据**：断言 actor 到达取数 adapter 构造点；断言 `role=reader` 时 Agent/MCP/模型对象未被构造；import 白名单断言 `getServerDataGateway` 只在绑定函数内被调用。

**关于「预留」**：身份的校验形式与向取数系统传递的形式第一期不定（§7），但**通道是第一期必做**——请求上下文有 actor 并真实填充、adapter 构造参数有 actor 位、有测试断言它确实到达。两个形式定了之后，改的只是 adapter 内部怎么用，不动调用链。

#### A2 · CORS 收窄

**触碰模块**：三个文件，全在 `apps/platform/src/routes/api/runtime/`。

三个页面读取端点硬编码 `'access-control-allow-origin': '*'`。门户与 Platform 同域，**直接删掉**——同源请求不需要 CORS，留着是无谓的攻击面。

#### A3 · 模型 adapter

**触碰模块**：`agent-model-config.server.ts` + 一个新 provider 文件。OpenAI 兼容，增加一个分支。

#### A4 · 取数 adapter

**触碰模块**：`packages/data-gateway`、`data-gateway.server.ts`。依赖 A1 的身份位。

按 §3.1 的三条既有契约实现。创作期验真复用同一 adapter（`createRunAwareUnitQueryExecutor` 已是这个形状），**查询正确性标准只有一份**。

**验收判据**：诊断哨兵值断言（复用 `packages/data-gateway/tests/diagnostics.test.ts` 形式）；取消贯通测试；批量语义与错误分类映射的契约测试。`tools/dqe-sim` 作为契约测试的对照实现。

#### A5 · 数据上下文 adapter

**触碰模块**：`packages/mcp`、`services.server.ts`。依赖 A1、P4。

第一期只覆盖创作期验真所需闭集，并承载「数据地图与知识点」域（§1.1）。

#### A6 · Embed 接门户

**触碰模块**：`packages/embed`、`apps/platform`（版本端点与发布校验）。

门户**独立发版**，「版本一致」不可能靠机制保证，只能靠流程，而流程会漏。两件事：

1. **建议版本**：Platform 配置目标 runtime 版本，按 `DataContextVersionProvider` 的同款注入形状进 lifecycle 选项。**保存与预览告警放行**（不挡创作期探索，Canvas 正常可看），**发布时硬校验**——发布本就是治理闸门，且只有发布的页面进门户。
2. **运行期握手**：embed 加载页面时若 `schemaVersion` 超出支持集合，抛**专门分类**的错误（「宿主运行时版本过旧」），不混进通用页面校验失败列表。

**共享 npm 依赖不够**：即使门户与 embed 共享 workspace 依赖解决了构建期一致，Platform 是独立运行的服务，版本是**运行期**事实。「Platform 先升级、门户还没重新发版」是最常见的运维顺序，这个窗口照样漂移。

**一条方向性事实**：ADR-0051 的增量次版本策略保证「旧文档能被新 runtime 读」，这里需要的是反过来——「新文档能被旧 runtime 读」，这个方向策略不保证也做不到。所以 schema 次版本递增在内网是一次**跨团队协调**，不是单方面发版。

### 4.3 汇合：交付

**触碰模块**：新增部署产物，不碰源码。

容器镜像、部署清单、健康检查、Secret 注入、日志接入。日志接入必须把 §3.1 的脱敏红线带过去——新 adapter 的「顺手打个日志」是这条红线最可能被破掉的地方。

**副本策略**：第一期两个角色副本数都是 1。读写职责先在代码里分离（A1），起几组 Pod 是后话。扩容路径已存在且不需改核心：只读侧无状态可横向扩展，创作期侧因 `agentRuns` 是进程内 `Map` 需单副本或粘性。**别让只读路由依赖任何进程内状态**——这是扩容路径不被堵死的唯一前提。

### 4.4 开工顺序

**今天就能开工、不依赖任何未决事项的三项：**

- **P1 拆包**——纯搬迁，零行为变化，验收判据是现有契约测试原样通过；
- **A2 CORS**——三个文件的删除；
- **A3 模型 adapter**——只需要端点与凭据。

**紧随其后**：P2（MySQL adapter，关键路径，工作量最大，越早开工越好）与 A1（身份绑定，A4/A5 都依赖它）。

**需要并行推进的对齐**：「数据地图与知识点」的映射形态（§1.1，结论决定 A5 是 adapter 工作还是 schema 工作，应尽早做）；取数系统的取消与批量能力确认（决定 A4 的形状）。两项都不阻塞上面五项开工。

## 5. 被显式排除的方案

记下来避免以后重新捡起：

- **八 Module 逻辑分层**：制造第二张模块地图（§2.3）。
- **给 port 方法签名加 actor 参数**：波及运行时数据编排器、数据网关、创作期验真、问数检索、MCP 工具及全部测试替身，同时踩穿「不污染核心」与「范围可控」。
- **身份放到第三批**：第一次真实取数当天数据权限就是生产问题；无身份的服务账号 adapter 把真实数仓结果喂给门户所有人，等于第一批上线一个越权数据出口。
- **`event.locals.services` / `getPlatformServices(identity)`**：一次身份改造产生 20 个文件的 diff，而多数路由本来就在传 `LifecycleContext`。
- **overlay 存 Git**：overlay 是部署实例的数据不是产品的数据，放进产品仓库会让语义层改口径就要发版。
- **引入 ORM / query builder 消除 SQL 重复**：抹不平真正的差异（锁语义、DDL 方言、隔离级别默认值），却要跨两个包大改。
- **新增查询协议分支**：DQE 原生接受，不需要。
- **提前做远程 MCP transport 抽象**：只有一个 adapter 的 seam 是假 seam。
- **浏览器直连 DQE**：见 §7 末。

## 6. 已裁决事项

| # | 议题 | 裁决 |
|---|---|---|
| 1 | 议程顺序 | 先冻结外部 seam 契约，后定部署拓扑 |
| 2 | 身份传播时机 | 与第一次真实取数同批 |
| 3 | 身份传播机制 | 烘焙进请求级 adapter 实例，port 签名不动 |
| 4 | 数据权限执行方 | 全部交数据侧，MetricCanvas 只负责如实传身份且不绕过 |
| 5 | 数据上下文 seam 形状 | 第一期保持 `current()` 全量快照 |
| 6 | 语义 overlay | 做，存 MySQL 按不可变修订建模，回流走修订差异导出 |
| 7 | 第一期范围 | 不做问数；做 AI 建页 |
| 8 | 宿主形态 | 门户已有，走 embed，同域部署 |
| 9 | 多副本 | 第一期单副本，代码里先做读写职责分离 |
| 10 | 数据库 | MySQL 8.0；PostgreSQL 保留为 CI 参照物 |
| 11 | 持久化包结构 | 按驱动拆 `persistence-mysql` / `persistence-postgres`，不按领域拆 |
| 12 | 迁移执行 | 独立 Job，不在应用启动时自迁移 |
| 13 | 建议版本 | 保存告警、发布硬校验 |
| 14 | 请求级服务形状 | `bindIdentity` 包装，不改 `getPlatformServices` 签名 |
| 15 | 部署角色的类型表达 | 拆成两个类型，编译期选边 |
| 16 | 首个业务域 | 数据地图与知识点 |

## 7. 仍然开放

| 议题 | 状态 | 影响 |
|---|---|---|
| **「数据地图与知识点」的映射形态** | 待对齐，不阻塞开工 | 语义层有该域且可映射，但形态略有不同。对齐结论决定 A5 是 adapter 工作（锁在 `packages/mcp`）还是 schema 工作（触碰核心、`formatVersion` 递增）。见 §1.1 |
| 自有取数系统的取消与批量能力 | 阻塞 A4 的形状 | 不支持取消 → 请求代次机制退化；不支持批量 → adapter 改 N 路并发，需重定并发上限与错误隔离粒度 |
| Platform 如何验证门户身份 | 暂缓 | 推荐 JWT 验签（只需公钥、无网络往返、不耦合门户存储实现）。定下前 mock 保持不变，A1 的通道照做 |
| 取数 adapter 传递身份的形式 | 暂缓，先预留 | **红线：不能只传服务账号。** 那样数据侧无法做行级过滤，「权限全交数据侧」当场落空，且没有任何报错——查询照样成功，只是返回了这个用户不该看的数据行。这是第一期最容易静默出事的一处 |
| MySQL 实例与 DBA | 待确认 | 影响迁移 Job 的执行方式与审批流程 |

### 一处保留的反对意见：浏览器直连 DQE

已确认自有取数系统「可以直接前端执行」。**建议第一期不用**：

1. **诊断能力会消失。** `DqeDiagnosticRecord`（executionId、durationMs、rowCount、errorCode）是取数唯一的可观测通道，目前由 `/api/data/query` 落结构化日志。直连之后这条通道没了，或要靠浏览器上报——而 issue #47 的脱敏红线在浏览器侧无法保证。
2. **身份预留位会搬家。** §3.4 定的烘焙点在服务端 adapter 上，直连等于把它挪到浏览器，A1 白做。
3. **收益第一期用不上。** 直连省的是 Platform 中转开销，而第一期副本数是 1、门户流量未知，这还不是瓶颈。

直连**不违反 ADR-0034**——那条禁的是「组件与浏览器绕过数据网关端口直接发 HTTP」，直连方案里组件仍只认 `DataGateway` 端口，变的只是 adapter 里那一跳。真正被改变的是「端点与凭据不出服务端」，而在已鉴权的内网里端点不是秘密、凭据是用户自己的会话，风险模型与公网不同。

因此**保留为明确的扩容后备**：若 Platform 的取数中转成为瓶颈，切换成本是一个 adapter 的事，`DataGateway` 端口不变，核心零改动。

---
status: accepted
---

# 第一方 Java 页面资产 Module 的工程、Interface 与持久化边界

## Context

ADR-0060 把页面资产所有权交给 Java 17 / Spring Boot 3 / MySQL，ADR-0061 有意让创作
Bundle 在 Java 不可见时独立完成，Python 只以 `PageAssetPort` 表达消费端语义。结果是
Java 一直被误写成"等待外部 Interface"，仓库没有 Java 源码、工程或 CI。2026-09-02 的
grill 确认 Java 页面资产由本仓建设为第一方 Module，并裁决了目录、构建、Interface、
校验深度、幂等、持久化和前端接线的详细边界。`packages/page-lifecycle` 与
`packages/persistence-mysql` 是行为基线，不是目标实现。

同日对公司现有 Java 服务 `CDINL2DataBuilderService`（CDI 团队，亦是 DQE 代理层）的
调查回填了公司约定：`cbcbi-parent` 统一 parent POM、内部 Artifactory 禁直连外网、
MyBatis XML + Druid + MariaDB 驱动、Flyway 启动自动迁移、Swagger 2.0 + `dfs-codegen`
spec-first、Log4j2 + APM、tar.gz + Docker 镜像 + Fuxi 流水线、`/rest/cdi/{service}/v1/`
路径与 `X-Auth-Token` / `X-Operator-Id` / `X-Workspace-Id` 请求头、DDD 分层与 ArchUnit。
用户的长期目标是把页面资产并入该服务，当前先独立部署。

## Decision

**Java 是仓根 `metriccanvas-page-assets/` 下可被整体吸收的 Maven module 组。** 三个 module：
`page-assets-model`（Swagger 2.0 YAML + `dfs-codegen` 生成 delegate 与 model）、
`page-assets-service`（domain / application / adapter，ArchUnit 守边界）、
`page-assets-bootstrap`（仅 `StartUp`、Dockerfile 与启动脚本）。包根
`com.huawei.cdi.pageassets`，挂 `com.huawei.hwclouds.cbc:cbcbi-parent`，Spring Boot 版本
以 parent 为准。不使用 Maven Wrapper（内网禁直连，wrapper 会外网下载）。目标宿主是
`CDINL2DataBuilderService`：并入时丢弃 bootstrap，把前两个 module 拖进其 reactor；这是
部署单元的变化，不改变 ADR-0060 的所有权。

**跟随公司栈，只在有理由处分歧。** 数据访问 MyBatis XML Mapper，Druid 连接池，MariaDB
驱动，`DB_URL` / `DB_USERNAME` / `DB_PASSWORD` 环境变量 + `TitanCipherEnum` 解密；Log4j2
JSON 日志与 APM traceId；自定义 `/rest/cdi/{service}/v1/healthcheck`，不用 Actuator；
交付 tar.gz + Docker 镜像到内部 registry，版本用 Fuxi `release_version`，不另设 SemVer；
门禁为 SecSolar、SpotBugs、dt4j 覆盖率与 ArchUnit。有意分歧三处：JUnit 5 而非
JUnit 4 / PowerMock；不引入 Redis 或 `numa-lock`，锁用 MySQL `GET_LOCK`；表字符集
`utf8mb4`（页面文本可能含 4 字节字符，公司 `utf8` 会写入失败）。

**产品契约在构建时嵌入。** `contracts/metriccanvas/` 的 Page Schema、组件能力目录、
错误闭集与 conformance 向量作为只读快照嵌入 JAR，附 manifest 摘要；CI 与 Bundle 的
`contract-lock.json` 同样方式检查漂移。运行时不挂载、不远程拉取契约。

**HTTP Interface 是 spec-first 的单份资源式 API。** 作者文件是 `page-assets-model` 中的
Swagger 2.0 `rest-services-page-assets.yaml`（公司 codegen 输入）；CI 单向导出副本到
`contracts/metriccanvas/page-assets/` 并检查漂移，Python 与 TypeScript consumer 据副本
校验各自 client。不为 Python 与 Svelte 提供两套 façade，也不继承 `apps/platform` 现有
管理 API 与 runtime API 的两套响应形状。`{service}` 前缀由配置注入，并入宿主后只改
consumer 的 base URL。

```text
POST /rest/cdi/{service}/v1/pages/{pageId}/revisions                 savePageRevision
GET  /rest/cdi/{service}/v1/pages/{pageId}                           getLatestPage
GET  /rest/cdi/{service}/v1/pages/{pageId}/revisions/{revisionId}    getPageRevision
GET  /rest/cdi/{service}/v1/pages?after=&limit=                      listPages
```

保存请求体携带 `baseRevisionId`、`document`、`idempotencyKey`、`pageIdConfirmed`、
`source`（判别结构 `relay { sessionId?, runId?, skillVersion } | manual`）与可选
`dataContextVersion`。`actorId` 取公司网关约定的 `X-Operator-Id`；`X-Auth-Token` 由网关
校验、`X-Workspace-Id` 按网关要求接受，首批均不用于数据隔离（租户模型仍挂起），也不是
身份设计。保存与读取统一返回完整 `PageRevision`：`revisionId`、`revisionNumber`、
`pageId`、`baseRevisionId`、`document`、`contentHash`、`dataContextVersion`、`source`、
`createdBy`、`createdAt`。

**错误闭集与信封。** 稳定码为 `INVALID_PAGE`、`PAGE_ID_MISMATCH`、
`PAGE_ID_CONFIRMATION_REQUIRED`、`PAGE_NOT_FOUND`、`REVISION_NOT_FOUND`、
`REVISION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`NOT_SUPPORTED`。信封为 HTTP 状态语义 +
`{ code, message, details }`；公司现有服务自身有两套不一致信封，本 Module 的消费者只有
本仓 Python 与 platform Adapter，故保留 HTTP 语义并登记为有意分歧。`getPageRevision`
先判页面再判修订；`REVISION_CONFLICT` 只携带 `currentLatest { revisionId,
revisionNumber }`；`INVALID_PAGE` 携带契约定义的 `type/path/message`。Python 侧
`PAGE_REVISION_CONFLICT` 改名对齐。

**Java 完整复验页面，而不只跑 JSON Schema。** 复验包括 Page Schema 与全部跨引用不变式
（组件 id 唯一、`queryField` 映射、字段角色、组件字段绑定、筛选绑定等）。共享
conformance 向量是门禁，并扩充到逐条不变式各有正反例；TypeScript 与 Java 同跑同一组
向量。保存接受当前主版本内全部受支持 minor（当前 5.0–5.4），Python 只产出 current。
Java 不反查 Relay 或 DQE，Data Context 版本由调用方提供。

**身份与并发不变量继承基线。** `pageId` 由调用方提供，首保须 `pageIdConfirmed = true`
且 `baseRevisionId = null`；后续保存的 `baseRevisionId` 必须等于当前最新修订。
`revisionId` 由 Java 生成 UUIDv4，按公司惯例存 `char(32)` 无横线形式；`revisionNumber`
线性递增。幂等键作用域为 `(operation, actorId, idempotencyKey)` 并校验请求指纹：同键
同指纹原样重放，同键异指纹返回 `IDEMPOTENCY_CONFLICT`。幂等结果保留 7 天，由独立清理
任务回收。

**持久化。** 表 `t_pa_page`、`t_pa_page_revision`、`t_pa_idempotency`，`t_pa_` 前缀避免与
目标宿主撞名。事务锁序固定为幂等锁 → 页面锁 → 前置检查 → 页面复验 → 插入修订 → 更新
latest 指针 → 保存幂等结果；锁用 `GET_LOCK` 会话锁，不保留基线的 mutex 行表。列类型：
`char(32)` / `varchar(128)` 配 `utf8mb4_bin`、`DATETIME(3)` UTC、文档列 `MEDIUMTEXT`
（公司不用 `JSON` 列，本 Module 也不需要 JSON 查询）、`(page_id, revision_number)` 唯一。
`listPages` 只投影 `{ pageId, latestRevision { revisionId, revisionNumber, createdAt } }`，
按 `pageId` 码点序升序、游标严格大于，limit 默认 50 上限 100。首批不建发布、租约、
审计或模板表，也不预留 `published_revision_id` 列；修订不可变，无逻辑删除列。
Schema 由 Flyway 版本化，跟随公司做法在应用启动时 `migrate` 且 `validate-on-migrate`；
使用独立历史表 `flyway_page_assets_history`、独立 `locations` 与脚本前缀
`V{大版本}.{小版本}.{补丁}.{序号}__pa_*`，并入宿主后与其既有 Flyway 互不冲突。

**前端只接 `apps/platform`。** `apps/canvas` 定位为示例与参考宿主，只读 `pages/` 静态
数据，不接 Java。J4 以一个 Java HTTP Adapter 实现完整 `PageLifecycle`：四个接口真实调用
Java，其余方法返回稳定码 `NOT_SUPPORTED`，让 platform 界面如实显示首批未开放，而不是
让发布、回滚、历史在失去修订表后半工作。

**验收以真实第一方链路为准。** 本地纵切为真实 Python FastMCP stdio → Java HTTP →
MySQL → platform Adapter；外部 Relay 与 DQE 使用 Harness 替身。本地集成测试用
Testcontainers MySQL；公司 CloudBuild 是否允许 Docker socket 与 Artifactory 是否代理
Testcontainers 均未知，J3 首项是探针，失败则 CI 退到环境变量指定的公司测试库。

## Consequences

- ADR-0060 的"Svelte SPA 是唯一产品界面、生产不运行 Node"从此指向 `apps/platform`，
  而它是 `adapter-node` 全栈应用。"platform 去 Node 服务端"成为必经的后续轨道，需单独
  grill；本 ADR 不裁决其路径，但不再允许把 `apps/canvas` 默认为目标 SPA。
- `apps/platform` 的 `/api/runtime/pages` 随 canvas 脱钩失去消费者，J4 时标记废弃。
- `LifecycleErrorCode` 新增 `NOT_SUPPORTED`；platform 的发布与模板界面在 Java 模式下
  必须处理它。
- 基线中 Java 调用 `DataContextVersionProvider` 的做法被移除；Python 保存命令需补
  `source` 与 `dataContextVersion`，并校验 `baseRevision.pageId` 与命令 `pageId` 一致。
- conformance 向量从 6 个反例扩充到逐条不变式覆盖，是 J1 的显式工作量，不是附带产出。
- `cbcbi-parent` 锁定的 Spring Boot 版本未读到；若与既往口头约束 3.5.15 不一致，以 parent
  为准，不在本 ADR 写死版本号。
- 生产 DDL 是否需 DBA 工单、应用账号是否有 DDL 权限，调查未能确定；本 ADR 跟随公司现行
  的启动迁移，若后续被 DBA 流程否决，只改执行入口，不改脚本组织。
- 合并进 `CDINL2DataBuilderService` 时会改变 `{service}` 前缀、共用其数据源与网关身份；
  Python 与 platform Adapter 必须把 base URL 视为配置。
- 审核、发布、下线、回滚、修订历史、diff、模板生命周期、Run 可靠性、发布工作流与运维
  恢复仍在首批之外，不能从"有不可变修订"推断为已实现。

## Considered Options

- **直接作为 module 并入 `CDINL2DataBuilderService`。** 用户的长期目标，但当前跨仓与
  审批时机不允许；改为独立部署且结构可吸收，不采用立即并入。
- **Java 只跑 JSON Schema，跨引用不变式交给 Python。** 违反 ADR-0060 "保存 Implementation
  必须重新执行页面校验"，不采用。
- **OpenAPI 3 放仓根手写 Controller，不用公司 codegen。** 会让工程与目标宿主异构，
  合并时需重写 API 层，不采用；改为作者文件在 Java、副本导出到仓根。
- **Spring JdbcClient 手写 SQL。** 技术上更轻，但与宿主的 MyBatis XML 异构；SQL 只有
  数条，跟随公司栈代价可忽略，不采用。
- **`REVISION_CONFLICT` 携带完整当前修订。** 无消费者使用该文档且放大响应体，不采用。
- **幂等盲重放。** 同键异 payload 会静默返回旧结果，不采用。
- **从 `PageLifecycle` 拆出四接口子 Interface，其余留 TypeScript 基线。** 发布、回滚与
  历史都依赖修订表，修订归 Java 后"留基线"是空话，不采用。
- **J4 先接 `apps/canvas`。** canvas 是只读参考宿主，日常创作与管理都在 platform，不采用。
- **Flyway 作为流水线独立步骤。** 更稳，但与公司现行做法和目标宿主不同；在 DBA 流程
  未知时不另立流程，不采用。

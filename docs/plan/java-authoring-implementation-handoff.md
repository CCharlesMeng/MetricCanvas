# Java 页面资产与 Authoring 接线实施 handoff

> 日期：2026-09-03
>
> 状态：Java 轨 J1–J4 全部完成（2026-09-03）；A 轨 A1–A3 可开工，其中 A1 的幂等键派生 / `skillVersion`
> 与 A2 的 `IdentityPort` 首个 Adapter 已由 J4 顺带落地。各切片落地记录见
> [`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md) 对应节
>
> 决策：[ADR-0062](../adr/0062-first-party-java-page-assets-module.md)、
> [ADR-0063](../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)

## 新会话怎么开始

1. 按顺序读：本文 → ADR-0062 → ADR-0063 → [`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md)
   → [`metriccanvas-authoring-bundle.md`](./metriccanvas-authoring-bundle.md) 的"接线切片"节
   → [`docs/adr/README.md`](../adr/README.md) 速查表尾部三行。
2. 本机 `调查报告/` 目录（`java-service.md`、`relay.md`、`dqe.md`）是公司内部系统的事实来源，
   **不在 git 内**（含内网地址，仓库公开）。实现时遇到公司约定问题先查它，再问用户；
   新机器上没有这个目录就向用户索取。
3. 不再 grill 已裁决项。若实现中发现 ADR-0062/0063 的某条与事实冲突，停下来报告，不自行改决策。
4. 领 Issue 时在 Issue 内勾选清单项；一个 PR 对应一个切片（J1、J2…），不跨切片。

## J1 已交付什么（新会话直接用）

- 工程在 `metriccanvas-page-assets/`，读它的 `README.md` 即可本地构建：
  `mvn -Pgates verify`（JDK 17 走 Homebrew `openjdk@17`，Temurin cask 需 sudo 未装）。
  parent 是 `build-parent/` 本地占位，CI 用 `scripts/use-company-parent.sh` 切公司 parent。
- 校验器入口 `domain/page/PageValidator`（`validate` / `parse`），错误为 `TypedError(type, path, message)`；
  结构层是自写的 `Draft7Evaluator`，不是第三方 Schema 库。J2 只在此之上加接口与修订逻辑。
- 契约快照走 `adapter/outbound/contract/ClasspathContractSnapshot`，`contract-lock.json`
  由 `pnpm authoring:contracts` 一并生成（`--check` 查漂移）；改契约后先跑导出再跑 Java 测试，否则摘要不对。
- conformance 向量定义在 `tools/scripts/page-conformance-vectors.ts`（154 反例 + 10 合法 +
  `coverage.json`），Java `PageConformanceTest` 与 TS 同跑。
- 独立 CI job `java-page-assets` 在 `.github/workflows/ci.yml`。

## J2 已交付什么（新会话直接用）

- Interface 作者文件 `page-assets-model/src/main/resources/rest-services-page-assets.yaml`（Swagger 2.0），
  副本由 `pnpm authoring:contracts` 导出到 `contracts/metriccanvas/page-assets/`（`--check` 查漂移）。
  `{service}` 前缀经 `pageassets.base-path` 注入；`X-Operator-Id` = actorId。
- `page-assets-model/src/main/java` 是**手写**的、与 `dfs-codegen`（spring / delegatePattern）同形的
  `PagesApi` / `PagesApiDelegate` / `PagesApiController` 与 POJO；用户已裁决此策略。业务只实现 delegate
  （`adapter/inbound/rest/PagesDelegate`），不碰 model。`-Pcodegen` + `scripts/check-codegen-drift.sh`
  留给公司 CI 校验漂移，尚未在公司 CI 跑过。
- 领域：`domain/revision`（`SaveRevisionPolicy`、`RevisionFactory`、`ContentHash`）、`domain/idempotency`
  （作用域、指纹）、`domain/catalog`（码点序游标）、`domain/error`（闭集 + `PageAssetException`）。
  用例编排在 `application/PageAssetService`，经三个 Port：`PageRepository`、`IdempotencyRepository`、
  `PageWriteTransaction`（幂等锁 → 页面锁 → 事务）。
- `adapter/outbound/memory/InMemoryPageStore` 实现全部三个 Port，是 J3 MyBatis 适配器的行为基线；
  `ConcurrentSaveTest` 与 `PageAssetServiceTest` 是 J3 集成测试要在真实 MySQL 上复跑的清单。
- 契约测试 `PagesApiContractTest` 用 MockMvc 对齐 YAML 的路径、响应属性、错误码枚举与状态语义。
- 错误信封在 ADR-0062 闭集之外多了两个传输层码 `INVALID_REQUEST` / `INTERNAL_ERROR`（Spring MVC
  绑定 / 校验 / 路由错误与 500），已在 YAML、README 与 plan 登记为补充，未改 ADR。

## J3 已交付什么（新会话直接用）

- `PAGE_ASSETS_STORE=mysql` 走 `adapter/config/MySqlStoreConfiguration`：Druid + MariaDB 驱动 + 编程式 Flyway
  （历史表 `flyway_page_assets_history`，locations `db/migration/pageassets/`）+ `mybatis-spring`（不用 starter）。
  环境变量 `DB_URL` / `DB_USERNAME` / `DB_PASSWORD`，口令经 `SecretDecryptor` 接缝（缺省透传，公司环境注册
  TitanCipher 实现）。全部 Bean 名带 `pageAssets` 前缀，`@MapperScan` 限定本 Module，为并入宿主并存留位。
- Schema `V1.0.0.1__pa_init.sql`：`t_pa_page` / `t_pa_page_revision` / `t_pa_idempotency`，`utf8mb4_bin`、
  `datetime(3)`、`mediumtext`；列宽与 YAML `maxLength` 一致。加表 / 加列走 `V1.0.0.{n}__pa_*.sql`，别改已应用脚本。
- `adapter/outbound/persistence`：`MyBatisPageStore`（两个仓储 Port）、`MySqlPageWriteTransaction`
  （`GET_LOCK` 幂等锁 → 页面锁 → `TransactionTemplate`，锁连接与事务连接分开，提交后释放）、
  `IdempotencyPurgeTask`（每小时分批删 7 天前记录，逻辑在 `application/IdempotencyRetention`）。
- 集成测试 `MySqlPageStoreIntegrationTest`（15 例：Flyway 二次启动只 validate、utf8mb4_bin 排序与游标、
  并发 / 幂等 / 冲突、锁超时、清理、REST 通路）。数据库来源 `testing/MySqlTestDatabase` 三级退路：
  `PAGE_ASSETS_TEST_DB_URL` → Testcontainers `mysql:8.0` → 跳过。GitHub Actions 有 Docker，CI 实跑。
- **CloudBuild 探针尚未执行**：在公司 CI 上跑 `mvn verify`，看 `MySqlPageStoreIntegrationTest` 是跑了还是
  以"没有 Docker 也没有 PAGE_ASSETS_TEST_DB_URL"跳过；后者就设该变量指向公司测试库。这是 J3 留给公司 CI 的唯一动作。

## J4 已交付什么（新会话直接用）

- **一条命令复现整条链**：`pnpm slice:page-assets`（`tools/scripts/slice-page-assets.ts`）——Docker MySQL 8 →
  tar.gz 起 Java（没有产物会自动 `mvn package`）→ Python 真实 stdio MCP 子进程调 `build_page` → Java 落库 →
  platform Java Adapter 读精确修订并核对哈希 / 重放 / 冲突。要改任何一段接线，先跑它。CI `java-page-assets`
  job 也跑它。Python 优先用 `metriccanvas-authoring/tool/.venv/bin/python`（`uv venv -p 3.12 .venv` +
  `uv pip install -r tool/requirements.lock`），或 `METRICCANVAS_PYTHON` 指定。
- **Python**：`adapters/outbound/java_page_assets.py`（`PageAssetPort`，stdlib `urllib`）、
  `adapters/outbound/env_identity.py`（`IdentityPort`）、`domain/idempotency.py`（键派生）。`server.py` 读
  `METRICCANVAS_PAGE_ASSETS_BASE_URL` / `METRICCANVAS_OPERATOR_ID` / `METRICCANVAS_AUTH_TOKEN`。`build_page`
  MCP 签名是 `(page_id, spec, page_id_confirmed)`，没有 `idempotency_key`。Java 错误码原样进 `save` 阶段 issue。
- **TS**：`packages/page-assets-java` → `createJavaPageLifecycle({ baseUrl, readOperatorId, dataContext })`；
  `LifecycleErrorCode` 新增 `NOT_SUPPORTED`、`IDEMPOTENCY_CONFLICT`。platform 用
  `METRICCANVAS_PAGE_ASSETS=java` + `METRICCANVAS_PAGE_ASSETS_BASE_URL` 切换（`.env.example`），
  `lib/server/lifecycle-http.ts` 把 `NOT_SUPPORTED` 映射 501，管理页对历史 501 只显示最新修订并标注未开放。
- **Java 侧的 J4 修正**：请求指纹只覆盖 `pageId` / `baseRevisionId` / `document`（原因见下方坑）。

## 先做什么

Java 轨已收口。下一步是 **A 轨**（`metriccanvas-authoring-bundle.md` 接线切片节，先读其"J4 交叉登记"，
不要重做已落的项）与 **S5**。并入 `CDINL2DataBuilderService` 的时机与 CloudBuild 探针由用户决定。

**A1 第一步**：给 `metriccanvas-authoring/skill/metriccanvas-page-builder/SKILL.md` 加完整
frontmatter（`allowed-tools`、`metadata.mcp_servers`），给 `tool/` 加 `pyproject.toml` 并让
`scripts/check_bundle.py` 校验 sdist 可构建。这两项不需要任何外部环境。幂等键与 `skillVersion` 已完成。

**A2 第一步**：`DqeExecutionPort` 生产 Adapter 复用 `EnvIdentityPort`（同一对服务态头），
`POST /rest/cdi/cdinl2databuilderservice/v1/dsl/execute`，错误映射按 ADR-0063。

## 开工前必须知道的坑

- **Maven Wrapper 已废弃**：内网禁直连，`mvnw` 会外网下载 Maven；本机用系统 Maven。
- **Java 校验器不是 JSON Schema 校验**：`contracts/metriccanvas/page/schema.json` 只覆盖
  结构；`packages/page` 的 `validate()` 还做跨引用不变式。J1 要把这些不变式逐条移植，
  并把 `contracts/metriccanvas/page/conformance/` 从 6 个反例扩到逐条覆盖。TypeScript
  导出脚本随之更新，两边同跑。
- **Testcontainers 在公司 CI 上可能不可用**：集成测试已按"跳过而非失败"设计，探针只需看 CI 报告里该类是否被 skip。
- **MySQL 会话锁跟连接走**：池连接 `close()` 只是归还，未 RELEASE 的 `GET_LOCK` 会被下一位借用者继承，MySQL 8
  会报 "Deadlock found when trying to get user-level lock"。生产侧 RELEASE 失败即废弃连接；测试里要持锁的
  "外部会话"必须用裸 `DriverManager` 连接，不要从 Druid 借。
- **MySQL 8 + MariaDB 驱动**：`caching_sha2_password` 下非 SSL 连接必须 `allowPublicKeyRetrieval=true`，否则
  握手失败且错误信息不直观（表现为"60s 内未能接受 JDBC 连接"）。
- **锁超时别设太小**：同键并发重放在幂等锁上串行排队，16 路 × 一次完整校验就超过 2s；缺省 10s。
- **J2 的 codegen 同形是手写的**：`page-assets-model` 里的 delegate / model 没有经过真实 `dfs-codegen`
  校验，插件 goal 名与 `configOptions` 是按 swagger-codegen 常规写的；第一次在公司 CI 跑
  `scripts/check-codegen-drift.sh` 前先对照宿主 `model/pom.xml:43-101` 修正 pom，再按 diff 改手写源码。
- **`start.sh` 的 classpath 通配符要加引号**：J1 版本被 shell 先 glob 导致 tar.gz 起不来，J2 已修；
  改启动脚本后一定用打包产物冒烟一次。
- **幂等键跨页面共享**：作用域是 `(operation, actorId, key)`，不含 pageId。同一 actor 用同一 key 保存
  不同页面会得到 `IDEMPOTENCY_CONFLICT`；Python 派生键已带 pageId，测试键也要带。
- **幂等键不再由模型给**（J4 已落）：`build_page` 的幂等键为 `hash(pageId, baseRevisionId, canonical(spec))`，
  MCP 签名里没有 `idempotency_key`；不要再把它加回工具参数。
- **Java 指纹不含来源留痕**：Relay 每次工具调用可能是一次性 `uvx` 子进程，重试时 `source.sessionId` 必然不同。
  J2 曾把 `source` / `dataContextVersion` 放进指纹，J4 纵切第一次跑就把"同 Spec 重放"跑成了
  `IDEMPOTENCY_CONFLICT`；现指纹只含 `pageId` / `baseRevisionId` / `document`。往指纹里加字段前先问
  "重试时它会不会变"。
- **身份是服务态**（J4 已落 `EnvIdentityPort`）：读 MCP config `env` 的 `METRICCANVAS_OPERATOR_ID` /
  `METRICCANVAS_AUTH_TOKEN`。任何文档、`SKILL.md` 或 UI 文案都不得说"已按用户权限"。生产门禁见 ADR-0063。
- **DQE 只走 NL2SQL 服务的 `dsl/execute`**，永不直连 Lab。
- **`apps/canvas` 不接 Java**；platform 的 Java Adapter 已实现完整 `PageLifecycle`，未支持方法返回
  `NOT_SUPPORTED` → HTTP 501。给管理界面加新的生命周期调用时要处理 501，不要把它显示成失败。
- **Java 模式下模板库是内存的**：`METRICCANVAS_PAGE_ASSETS=java` 不建 PostgreSQL 连接，模板重启即空；
  `/api/runtime/pages` 已标记废弃且在 Java 模式恒为空（首批无"已发布"）。
- **Docker MySQL 就绪探测走 TCP**：镜像初始化期的临时实例只开 socket，socket ping 会提前成功，
  Java 随即启动失败；`slice-page-assets.ts` 用 `mysqladmin ping --protocol=tcp`。
- **错误码改名**（J4 已落）：Python 侧 `PAGE_REVISION_CONFLICT` → `REVISION_CONFLICT`。
- **Python 页面校验只是预检且有假阳性**：J1 扩充向量后发现 Python `validate_page_document`
  只对齐 21/154 个反例，并误拒含 detail 角色字段或分组查询字段的合法页面。未对齐项登记在
  `metriccanvas-authoring/test-harness/fixtures/page-conformance-pending.json`（测试断言其"仍不对齐"，
  补齐后必须移出）。A 轨接 DQE 真实数据前要知道这条预检会拦下合法页面；补齐还是删除留给 S5。

## 外部前置（只影响验收，不阻塞开工）

| 需要 | 用于 | 谁提供 |
|---|---|---|
| `cbcbi-parent` 实际 POM（Spring Boot 版本） | J1 确认 parent 兼容 | 用户从内部 Artifactory 取 |
| CloudBuild 是否有 Docker socket（否则给 `PAGE_ASSETS_TEST_DB_URL` 测试库） | J3 探针（代码已就位，只差在公司 CI 跑一次） | 用户或 CI 团队 |
| DQE/NL2SQL 测试环境地址 + 有权限/无权限两个账号 | A2、A3 真实验收 | 用户线下获取 |
| Relay 本地环境的 LiteLLM key | A1 真实模型验收 | 用户"绿区加群获取" |
| 生产 DDL 是否需 DBA 工单 | J3 执行入口（不改脚本） | 用户 |

## 已决但容易被重新讨论的点

这些在 grill 中被明确拒绝过，不要再提：

- 用 JdbcClient / OpenAPI 3 / 单 module 代替公司栈（为并入 `CDINL2DataBuilderService` 放弃）
- `REVISION_CONFLICT` 返回完整修订（无消费者）
- 从 `PageLifecycle` 拆子接口（发布/回滚依赖修订表，拆了也没数据）
- 让模型把 user id 当参数传（可伪造）
- 直连 Lab（绕过行级权限）
- 等 Relay 有 Run 概念再接（无期限）

## 尚未 grill 的维度（不要顺手决定）

platform 去 Node 服务端；Chat 接线与 Run 可靠性；跨语言运行契约；发布工作流；
运维与恢复；并入 `CDINL2DataBuilderService` 的时机。清单见
[`java-relay-architecture-grill-handoff.md`](./java-relay-architecture-grill-handoff.md) 第 12 节。

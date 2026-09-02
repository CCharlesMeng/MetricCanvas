# Java 页面资产与 Authoring 接线实施 handoff

> 日期：2026-09-02
>
> 状态：J1、J2 已完成（2026-09-02），J3–J4 与 A1–A3 可继续并行；J1 / J2 落地记录见
> [`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md) 对应切片节
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

## 先做什么

两条轨道互不依赖，可以并行。J1、J2 已完成，Java 轨下一步是 **J3**。

**J3 第一步**：探针，不是建表——在公司 CloudBuild 上验证 Testcontainers（Docker socket、Artifactory
是否代理 Testcontainers 与内部 MySQL 镜像）；失败则集成测试退到环境变量指定的公司测试库。本机可以先用
Docker 起 MySQL 8 / MariaDB 跑 Testcontainers。随后：Flyway `V1.0.0.1__pa_init.sql`（三张 `t_pa_*` 表，
列型按 ADR-0062，`t_pa_idempotency` 五列见 plan J2 落地记录）、MyBatis XML Mapper 实现三个 Port
（`PageWriteTransaction` 用 `GET_LOCK` 会话锁：先幂等锁名 `IdempotencyScope.lockName()` 再页面锁）、
7 天清理任务、Druid + MariaDB 驱动 + `DB_URL` / `DB_USERNAME` / `DB_PASSWORD`（`TitanCipherEnum`
解密在内部依赖里，本机拿不到时留接缝）。`pageassets.store=mysql` 切换，`memory` 保留。

**A1 第一步**：给 `metriccanvas-authoring/skill/metriccanvas-page-builder/SKILL.md` 加
frontmatter，给 `tool/` 加 `pyproject.toml` 并让 `scripts/check_bundle.py` 校验 sdist
可构建。这两项不需要任何外部环境。

## 开工前必须知道的坑

- **Maven Wrapper 已废弃**：内网禁直连，`mvnw` 会外网下载 Maven；本机用系统 Maven。
- **Java 校验器不是 JSON Schema 校验**：`contracts/metriccanvas/page/schema.json` 只覆盖
  结构；`packages/page` 的 `validate()` 还做跨引用不变式。J1 要把这些不变式逐条移植，
  并把 `contracts/metriccanvas/page/conformance/` 从 6 个反例扩到逐条覆盖。TypeScript
  导出脚本随之更新，两边同跑。
- **Testcontainers 在公司 CI 上可能不可用**：J3 第一件事是探针，不是建表。
- **J2 的 codegen 同形是手写的**：`page-assets-model` 里的 delegate / model 没有经过真实 `dfs-codegen`
  校验，插件 goal 名与 `configOptions` 是按 swagger-codegen 常规写的；第一次在公司 CI 跑
  `scripts/check-codegen-drift.sh` 前先对照宿主 `model/pom.xml:43-101` 修正 pom，再按 diff 改手写源码。
- **`start.sh` 的 classpath 通配符要加引号**：J1 版本被 shell 先 glob 导致 tar.gz 起不来，J2 已修；
  改启动脚本后一定用打包产物冒烟一次。
- **幂等键跨页面共享**：作用域是 `(operation, actorId, key)`，不含 pageId。同一 actor 用同一 key 保存
  不同页面会得到 `IDEMPOTENCY_CONFLICT`；测试与 J4 的 Python 派生键都要带 pageId（ADR-0063 已如此）。
- **幂等键不再由模型给**：A1 把 `build_page` 的幂等键改为
  `hash(pageId, baseRevisionId, canonical(spec))`；J2 的 Java 指纹幂等以此为前提。
- **身份是服务态**：A2 的 `IdentityPort` 第一个 Adapter 读 MCP config `env`。任何文档、
  `SKILL.md` 或 UI 文案都不得说"已按用户权限"。生产门禁见 ADR-0063。
- **DQE 只走 NL2SQL 服务的 `dsl/execute`**，永不直连 Lab。
- **`apps/canvas` 不接 Java**；J4 的 platform Adapter 实现完整 `PageLifecycle`，未支持方法
  返回 `NOT_SUPPORTED`，platform 发布/模板界面要处理它。
- **错误码改名**：Python 侧 `PAGE_REVISION_CONFLICT` → `REVISION_CONFLICT`（J4）。
- **Python 页面校验只是预检且有假阳性**：J1 扩充向量后发现 Python `validate_page_document`
  只对齐 21/154 个反例，并误拒含 detail 角色字段或分组查询字段的合法页面。未对齐项登记在
  `metriccanvas-authoring/test-harness/fixtures/page-conformance-pending.json`（测试断言其"仍不对齐"，
  补齐后必须移出）。A 轨接 DQE 真实数据前要知道这条预检会拦下合法页面；补齐还是删除留给 S5。

## 外部前置（只影响验收，不阻塞开工）

| 需要 | 用于 | 谁提供 |
|---|---|---|
| `cbcbi-parent` 实际 POM（Spring Boot 版本） | J1 确认 parent 兼容 | 用户从内部 Artifactory 取 |
| CloudBuild 是否有 Docker socket | J3 探针 | 用户或 CI 团队 |
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

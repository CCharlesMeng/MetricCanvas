# Java 页面资产与 Authoring 接线实施 handoff

> 日期：2026-09-02
>
> 状态：J1 已完成（2026-09-02），J2–J4 与 A1–A3 可继续并行；J1 落地记录见
> [`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md) J1 节
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

## 先做什么

两条轨道互不依赖，可以并行。J1 已完成，Java 轨下一步是 **J2**。

**J2 第一步**：先写 `rest-services-page-assets.yaml`（Swagger 2.0）定四个 Interface 的信封。
注意公司的 `dfs-codegen-maven-plugin`（`com.huaweicloud.dfs`）在内部 Artifactory，本机拿不到——
开工前先与用户确认本地策略（用户提供插件 / 本地手写与 codegen 同形的 delegate 并在 CI 校验漂移），
不要自行引入外网 codegen 替代。J2 的修订与幂等逻辑放 `domain/`，遵守 ArchUnit 分层。

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

# Java 页面资产与 Authoring 接线实施 handoff

> 日期：2026-09-02
>
> 状态：决策树前沿为空；J1–J4（Issue #90）与 A1–A3（Issue #91）可并行开工，尚未写任何代码
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

## 先做什么

两条轨道互不依赖，可以并行；如果只能先做一条，**先 J1**，因为它顺带扩充的 conformance
向量也是 A 轨的验收资产。

**J1 第一步**：在 `metriccanvas-page-assets/` 建三 module Maven 工程。parent 是
`cbcbi-parent`，但本机拿不到内部 Artifactory——**本地开发用一个最小的本地 parent 占位**
（只声明 Spring Boot BOM 与插件版本），`pom.xml` 里用 property 切换 parent 坐标，
并在 README 写明 CI 上换成公司 parent。不要为了能在本机跑而把公司依赖写死成外网坐标。

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

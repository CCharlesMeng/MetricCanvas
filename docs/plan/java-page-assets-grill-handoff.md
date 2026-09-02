# Java 页面资产 grill handoff

> 日期：2026-09-02
>
> 状态：J0 已于 2026-09-02 裁决并写入 [ADR-0062](../adr/0062-first-party-java-page-assets-module.md)；
> 实施切片见 [`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md)。本文保留为裁决
> 前的问题记录；下文"未决决策前沿"与"下一轮依赖问题"均已关闭，结论以 ADR-0062 为准。
>
> 上游决策：[ADR-0060](../adr/0060-static-svelte-java-page-governance-relay-python-authoring.md)

## 裁决结果摘要

- 未决前沿 13 项与下一轮 7 项全部裁决，见 ADR-0062。
- 公司 Java 约定已由 `调查报告/java-service.md` 回填（`cbcbi-parent`、MyBatis、Swagger 2.0 +
  `dfs-codegen`、Flyway 启动迁移、tar.gz + Docker、`X-Operator-Id`）；仍未确定的是 parent
  锁定的 Spring Boot 版本、生产 DDL 工单流程与 CI Docker socket。
- 与上轮推荐不同的裁决：J4 只接 `apps/platform`，`apps/canvas` 定位为示例与参考宿主；
  Java Adapter 实现完整 `PageLifecycle` 而非拆出子 Interface，未支持方法返回 `NOT_SUPPORTED`；
  工程按"可被 `CDINL2DataBuilderService` 整体吸收"的三 module 形状建设。
- 新登记欠账："platform 去 Node 服务端"是必经后续轨道，需另开 grill。
- Relay/DQE 事实对创作期的修正见 ADR-0063，不在本 handoff 范围。

## 下一会话怎么继续

1. 读 ADR-0062、ADR-0063 与实施计划，从 J1 开工。
2. 保持鉴权在设计与排期之外；`X-Operator-Id` 只是网关约定的调用者标识，不是身份设计。
3. J3 首项是 CloudBuild 上的 Testcontainers 探针；parent 的 Spring Boot 版本以读到的
   `cbcbi-parent` POM 为准。

完成标准：没有把推荐项、旧 TypeScript 行为或外部系统猜测写成已决规格。

## 已冻结边界

- Java 页面资产由当前仓库建设，不等待外部团队提供实现。
- 技术硬约束是 Java 17、Spring Boot 3.5.15 和 MySQL；生产不运行 Node 服务端。
- Java 是独立部署的模块化单体，拥有页面复验、不可变页面修订、基线并发、幂等与读取。
- 首批 application surface 只有 `savePageRevision`、`getLatestPage`、
  `getPageRevision`、`listPages`。
- 审核、发布、下线、回滚、修订历史、diff 和模板生命周期不进入首批。
- Python 拥有确定性页面装配并通过 Java 保存；Java 不调用模型、不复制装配算法。
- Svelte SPA 是唯一产品界面，保存后按 `pageId + revisionId` 加载精确页面修订预览。
- 仓根 `contracts/metriccanvas/` 是 Java、Python、TypeScript 共同消费的产品中立契约。

## 为什么此前没有 Java 实施计划

这不是 ADR 取消 Java。ADR-0061 有意把 `metriccanvas-authoring/` 限定为可在真实 Java、
Relay 和 DQE 尚不可见时独立完成的 Skill/Python Bundle；Issue #89 也只跟踪 Authoring
S2–S5。Java 被留在总 handoff 的“后续 grill”，但没有建立平行 J-track。

把 Java 写成“等待外部 Interface”是规划错误：Python 的 `PageAssetPort` 是消费端语义
边界，而 Java server Interface 应由本仓第一方 Module 定义。Java 的领域与事务核心已有
TypeScript/MySQL 行为基线，不依赖 Relay 或 DQE 即可设计和实现。

## 当前实现事实

- 最近的实现提交是 `426dbaf`：Authoring S0–S4 已完成，真实 FastMCP 进程只暴露
  `discover_data_context` 与 `build_page`，但生产组合根的 Data Context、DQE、Java 三个
  Adapter 均未配置。
- 仓库没有 Java 源码、Maven/Gradle 工程或 Java CI。
- `packages/page-lifecycle` 和 `packages/persistence-mysql` 是迁移行为基线，不是目标 Java
  Implementation。可迁移的首批不变量包括完整页面复验、首保确认、线性不可变修订、
  `baseRevisionId` 冲突、幂等重放和确定性列表游标。
- MySQL 基线的事务顺序是幂等锁 → 页面锁 → 前置检查 → 页面复验 → 插入修订 → 更新
  latest 指针 → 保存幂等结果；正式 Java Schema 与 migration 仍不存在。
- `apps/canvas` 已是静态 SPA并支持 `?revision=` 精确预览；远程 `PageRepository` 仍读取
  `apps/platform` 的 Node API。

## 还能继续的切片

| 轨道 | 当前状态 | 下一动作 | 门禁 |
|---|---|---|---|
| Authoring S0–S4 | 完成 | 仅维护契约与回归 | 无 |
| Authoring S5 | 部分完成 | 等价向量已冻结；最终宣布 Python 真源并删除 TS 双实现 | Java J4 + 真实 Relay/DQE |
| Java J0 | 可立即继续 grill | 冻结目录、构建、Interface、持久化与验收策略；产出 ADR/计划/Issue | 用户完成下列决策 |
| Java J1 | 待 J0 | 建独立工程、嵌入中立契约、建立 Page Validator 与共享向量 | J0 |
| Java J2 | 待 J0 | 四个 application Interface、稳定错误、不可变修订与并发/幂等领域测试 | J0 与 DTO/错误裁决 |
| Java J3 | 待 J0 | 正式 MySQL migration、事务锁序、真实 MySQL 集成测试与独立 Java CI | J0 与持久化裁决 |
| Java J4 | 待 J1–J3 | Python→Java Adapter、Svelte→Java Repository、精确修订本地纵切 | J1–J3 |
| Relay 接线 | 外部阻塞 | Skill 注册、Chat/进度/取消和真实 FastMCP 兼容验收 | 真实 Relay 仓库与协议 |
| DQE 接线 | 外部阻塞 | Data Context/DQE 生产 Adapter 与错误映射 | 真实 DQE Interface |
| Run 可靠性 | 可继续 grill | 持久化、至少一次、取消、恢复和超时 | Relay 事实会限制实现 |
| 发布/运维 | 挂起 | 另开维度 grill | 当前首批明确排除 |

J0–J4 是候选实施分解，不是已批准实现规格；J0 裁决后应重新计算切片。

## 已知契约缝隙

- Python `PageAssetPort.save_revision(JsonObject)` 只是 consumer Port，不能充当四接口的
  Java server contract。
- Python 保存命令缺少 ADR 要求的 `sourceRunId` 与 `sourceSkillVersion`；这两个字段属于
  修订来源，不属于 Page Build Spec。
- Python 测试使用 `PAGE_REVISION_CONFLICT`，现有 Page Lifecycle 稳定码是
  `REVISION_CONFLICT`，跨语言错误闭集尚未统一。
- Page Build Spec 的 `baseRevision` 含 pageId/revisionId/revisionNumber；Python 当前只把
  revisionId 传给保存，尚未校验基线 pageId 与命令 pageId 一致。
- Svelte 当前有管理 API 与 runtime API 两套响应形状；Java 首批不能不加裁决地复制两套。

## 未决决策前沿（已关闭，结论见 ADR-0062）

以下是裁决前的选项记录；括号内是当时的推荐答案：

1. 物理目录：仓根 `metriccanvas-page-assets/`、`services/page-assets/` 或 `apps/page-assets/`（推荐仓根）。
2. 构建强度：Maven Wrapper 单 build module + package/ArchUnit，或 Maven/Gradle 多 module（推荐前者）。
3. 数据访问：Spring JdbcClient、jOOQ 或 MyBatis（推荐 JdbcClient + 手写 SQL）。
4. Schema migration：MySQL 8 + Flyway 独立 migration Job，或应用启动迁移/继续待定（推荐独立 Job）。
5. 发布版本：独立 SemVer + 可执行 JAR，或与 Authoring Bundle 锁步/立即建设 OCI（推荐独立 SemVer + JAR）。
6. 产品契约：构建时嵌入固定快照，或运行时挂载/远程拉取（推荐嵌入 JAR并记录摘要）。
7. HTTP Interface：单份 spec-first OpenAPI 供 Python/Svelte consumer Adapter 使用，或双 façade/RPC（推荐单份资源式 API）。
8. Svelte 收敛：管理与创作迁入 `apps/canvas`，或改造 `apps/platform`/长期保留双 SPA（推荐迁入 Canvas）。
9. pageId：调用方提供并保留首保确认，或由 Java/Relay 生成（推荐调用方提供，Java生成 revisionId）。
10. 幂等：全局 operation+key并校验请求指纹，或盲重放/进程内保存（推荐请求指纹，异 payload 返回稳定冲突）。
11. 修订来源：保存命令使用 relay/manual 判别结构并由调用方提供 Data Context 版本，或裸 nullable/Java反查（推荐判别结构，Java不反查 Relay/DQE）。
12. 保存版本：接受当前主版本内全部受支持 minor，或只接受 current/任意 schema（推荐受支持 minor，Python只产 current）。
13. 本地纵切：真实 Python FastMCP→Java HTTP→Testcontainers MySQL→Svelte Adapter，外部 Relay/DQE 才用 Harness 替身；或继续全 Fake/等待外部（推荐真实第一方链路）。

## 下一轮依赖问题（已关闭，结论见 ADR-0062）

当时预计前沿确认后再批量裁决的问题：

- 四个 Interface 的路径、请求/响应 DTO 与 OpenAPI 所有权；
- `getPageRevision` 如何区分页面不存在和修订不存在；
- `REVISION_CONFLICT` 是否只返回 latest 标识，还是返回完整当前修订；
- `listPages` 的投影、游标、排序和 limit；
- 幂等记录保留期、mutex 行归档及固定锁序；
- revisionId 格式、时间/JSON/collation 约束和 migration 执行入口；
- Java CI job、契约变更触发条件与本地纵切命令。

# MetricCanvas 第一方 Java 页面资产实施计划

> 状态：J1、J2 完成（2026-09-02，本地占位 parent 下 `mvn -Pgates verify` 通过：165 个 conformance
> 向量与 TypeScript 逐条相同，四个 Interface 在内存仓储下通过全部领域与契约测试）；J3 可开工。
> 实现说明见 [`metriccanvas-page-assets/README.md`](../../metriccanvas-page-assets/README.md)
>
> 决策：[ADR-0062](../adr/0062-first-party-java-page-assets-module.md)、
> [ADR-0060](../adr/0060-static-svelte-java-page-governance-relay-python-authoring.md)
> 交付根：`metriccanvas-page-assets/`
> 目标宿主：`CDINL2DataBuilderService`（合并时机待定）

## 目标

在本仓建设 Java 17 / Spring Boot 3（版本随 `cbcbi-parent`）/ MySQL 的页面资产 Module，
承载 `savePageRevision`、`getLatestPage`、`getPageRevision`、`listPages` 四个 Interface，
以完整页面复验、不可变线性修订、基线并发、指纹幂等和来源审计作为每个写入口的下限；
随后把 Python Tool 的 `PageAssetPort` 与 `apps/platform` 的 `PageLifecycle` 接到 Java 上，
形成真实第一方本地纵切。工程形状按"可被目标宿主整体吸收"设计。

## 已回填的公司事实

| 项 | 采用 | 来源 |
|---|---|---|
| parent / 制品库 | `cbcbi-parent`；内部 Artifactory，无 Wrapper | 调查报告 1.3 / 1.5 |
| 数据访问 | MyBatis XML + Druid + MariaDB 驱动 | 2.1 / 2.2 |
| Schema | Flyway 启动 `migrate` + `validate-on-migrate`；独立历史表 | 2.7 |
| API | Swagger 2.0 + `dfs-codegen`；`/rest/cdi/{service}/v1/` | 4.5 / 3.4 |
| 请求头 | `X-Auth-Token`、`X-Operator-Id`（= actorId）、`X-Workspace-Id` | 3.4 |
| 交付 | tar.gz + Dockerfile + 内部 registry；Fuxi `release_version` | 3.1 / 3.9 |
| 日志/健康 | Log4j2 JSON + APM；自定义 healthcheck | 3.5 / 3.7 |
| 门禁 | SecSolar、SpotBugs、dt4j、ArchUnit | 1.6 / 4.2 |
| 未确定 | parent 锁定的 Spring Boot 版本；生产 DDL 工单流程；CI Docker socket | 1.4 / 2.7 / 3.8 |

有意分歧：JUnit 5、无 Redis（`GET_LOCK`）、`utf8mb4`、HTTP 状态语义信封。

## 目录

```text
metriccanvas-page-assets/
├── pom.xml                                   # parent: cbcbi-parent；modules 见下
├── README.md
├── contract-snapshot/                        # contracts/metriccanvas 只读快照（生成）
├── contract-lock.json
├── page-assets-model/
│   └── src/main/resources/rest-services-page-assets.yaml   # Swagger 2.0 作者文件
├── page-assets-service/
│   └── src/main/java/com/huawei/cdi/pageassets/
│       ├── domain/                           # PageRevision、不变量、错误闭集、页面校验器
│       ├── application/                      # 四个用例、幂等与锁序编排、Port
│       └── adapter/
│           ├── inbound/rest/                 # delegate 实现、错误信封、请求头解析
│           └── outbound/persistence/         # MyBatis Mapper、PO、契约快照加载
│   └── src/main/resources/
│       ├── mybatis/*Mapper.xml
│       └── db/migration/pageassets/V*.__pa_*.sql
├── page-assets-bootstrap/                    # StartUp、Dockerfile、start.sh（并入宿主时丢弃）
└── scripts/                                  # 快照同步、契约导出、本地纵切
contracts/metriccanvas/page-assets/rest-services-page-assets.yaml   # CI 导出副本
```

## 切片

### J1：工程、契约嵌入与页面校验器

- 三 module Maven 工程挂 `cbcbi-parent`；ArchUnit 规则限定 `com.huawei.cdi.pageassets..`；
  独立 CI job（先 GitHub Actions，CloudBuild 接入随宿主流程）。
- 嵌入 `contracts/metriccanvas` 快照，`contract-lock.json` 与根 manifest 摘要对齐；根
  `--check` 纳入四层漂移检查。
- Page Validator：JSON Schema draft-07 + 全部跨引用不变式，产出契约 `type/path/message`。
- 扩充 `contracts/metriccanvas/page/conformance/`，逐条不变式各有正反例；TypeScript 导出
  与验证同步，Java 与 TypeScript 同跑。
- 接受 `supportedVersions` 内全部 minor。

完成条件：Java 校验器在共享向量上与 TypeScript 逐条相同；向量覆盖率清单可机读。

J1 落地记录：

- Maven 不允许在 `<parent>` 坐标里写属性，"property 切换 parent" 落为：parent 版本 `local` +
  `relativePath` 指向 `build-parent/`（与公司 parent 同坐标的占位），CI 用
  `scripts/use-company-parent.sh` 改写版本；`cbcbi.parent.version` 属性只作脚本输入。
- 结构校验未引第三方 JSON Schema 库：向量里的结构错误由 ajv 产出且要求逐条相同，Java
  `Draft7Evaluator` 按 ajv v8 的关键字顺序与文案复现，只支持 Page Schema 用到的关键字子集。
- 向量从 6 个扩到 154 个反例 + 10 个合法样例 + `coverage.json`，反例带 `invariant` 字段与自检
  正则。三条语义判定在结构层就被拒绝（明细项非对象、明细超 100 项、timeRange 两端精度不一致），
  已在向量定义里登记为不可达。
- **跨轨发现**：Python `validate_page_document` 只对齐 21 个反例，且误拒两个合法样例
  （`output_dims` 含 detail 角色字段、按角色分组的查询字段）。J1 没有改 Python 校验器，而是把
  未对齐项登记到 `metriccanvas-authoring/test-harness/fixtures/page-conformance-pending.json`
  并在 Python 测试里断言"仍不对齐"，补齐后必须移出。是否补齐由 A 轨 / S5 裁决。

### J2：四个 Interface、稳定错误与领域测试

- 编写 `rest-services-page-assets.yaml`（Swagger 2.0），`dfs-codegen` 生成 delegate 与 model；
  CI 导出副本到 `contracts/metriccanvas/page-assets/` 并检查漂移。
- 实现前置判定（首保确认、`baseRevisionId` 冲突、`PAGE_ID_MISMATCH`）、修订构造
  （`char(32)` UUID、线性修订号、`contentHash`、`source`、`dataContextVersion`）。
- 指纹幂等 `(operation, actorId, idempotencyKey)`；`X-Operator-Id` 解析为 actorId。
- `getLatestPage`、`getPageRevision`（先页面后修订）、`listPages`（码点序游标）。
- 领域测试以内存仓储覆盖并发、幂等、冲突与不变量；契约测试对齐真实 delegate。

完成条件：四个 Interface 在内存仓储下通过全部领域与契约测试；信封与 YAML 一致。

J2 落地记录：

- `dfs-codegen-maven-plugin` 本机拿不到，用户裁决**本地手写与 codegen 同形的 delegate / model**：
  `page-assets-model/src/main/java` 按 `language=spring` / `delegatePattern=true` 输出形状手写，
  `-Pcodegen` 只在 CI 生成到 `target/`（不编译），`scripts/check-codegen-drift.sh` 归一化 diff。
  插件 goal 与 `configOptions` 尚未在公司 CI 验证，首次跑通时以宿主 `model/pom.xml:43-101` 修正。
- Swagger 2.0 的 basePath 不能带变量：YAML 写独立部署缺省 `/rest/cdi/pageassets/v1`，Controller 以
  `@RequestMapping("${pageassets.base-path:...}")` 注入，契约测试用非缺省 base-path 证明可配置。
- 错误码闭集之外新增两个**传输层码** `INVALID_REQUEST`（400/404/405 等 Spring MVC 绑定、校验、路由错误）
  与 `INTERNAL_ERROR`（500），YAML 与 README 已标注它们不属于 ADR-0062 业务闭集。ADR-0062 未预见
  Bean Validation / 非法 JSON 这一层，这是补充而非改决策；若要收进 ADR 另行登记。
- `X-Auth-Token` / `X-Workspace-Id` 在 YAML 里声明为可选（只接受不解释），`X-Operator-Id` 必填。
- 健康检查 `GET {base}/healthcheck` 随 YAML 一并落地（ADR-0062 决定的自定义端点，非 Actuator）。
- 幂等只记成功且不另存响应体，重放按 `(pageId, revisionId)` 取回不可变修订；`t_pa_idempotency` 因此只需
  作用域、指纹、pageId、revisionId、createdAt 五列，J3 建表按此。
- `listPages` 响应字段定名 `pages` + `nextAfter`（与查询参数 `after` 配对）；`latestRevision` 投影
  `{ revisionId, revisionNumber, createdAt }`。
- 顺带修正 J1 的 `start.sh`：`-classpath lib/*` 未加引号被 shell 先 glob，导致 tar.gz 包无法启动。
  现已用打包产物完成本地 HTTP 冒烟（healthcheck / 保存 / 目录 / 404）。
- 内存仓储放在 `src/main`（`pageassets.store=memory` 缺省），使 bootstrap 在 J3 前可运行；J3 加 `mysql`。

### J3：MySQL Schema、锁序与集成测试

- **首项探针**：在 CloudBuild 验证 Testcontainers（Docker socket、Artifactory 代理、
  内部 MySQL 镜像）；失败则 CI 集成测试退到环境变量指定的公司测试库。
- Flyway `V1.0.0.1__pa_init.sql`：`t_pa_page`、`t_pa_page_revision`、`t_pa_idempotency`；
  列类型按 ADR-0062；独立历史表 `flyway_page_assets_history`。
- MyBatis Mapper；事务锁序幂等锁 → 页面锁 → 前置检查 → 复验 → 插入修订 → 更新
  latest → 存幂等结果；`GET_LOCK` 会话锁。
- 幂等记录 7 天清理任务。
- 集成测试覆盖并发保存、幂等重放、冲突、游标与 `utf8mb4_bin` 排序。

完成条件：真实 MySQL 上集成测试通过；重复启动只 `validate` 不改表。

### J4：Python 与 platform 接线，真实本地纵切

- Python：`PageAssetPort` 的 HTTP Adapter（base URL 可配）；保存命令补 `source` 与
  `dataContextVersion`，幂等键按 ADR-0063 派生；校验 `baseRevision.pageId` 与命令一致；
  `PAGE_REVISION_CONFLICT` 改名 `REVISION_CONFLICT`；生产组合根配置 Java Adapter。
- platform：Java HTTP Adapter 实现完整 `PageLifecycle`，四接口真实调用，其余返回
  `NOT_SUPPORTED`；`services.server.ts` 可切换到 Java；发布与模板界面处理 `NOT_SUPPORTED`。
- `apps/canvas` 保持静态 `pages/` 仓储；`/api/runtime/pages` 标记废弃。
- `pnpm slice:page-assets`：一键起 MySQL、Java、Python 真实 stdio 子进程，用 Harness
  替身充当 Relay/DQE，走通保存 → Java 落库 → platform 加载精确修订。

完成条件：本地纵切在新 checkout 上一条命令复现；platform 在 Java 模式下管理页面与
预览精确修订，未开放能力如实显示。

## 与其他轨道的关系

- Authoring 接线切片（Relay/DQE 真实 Adapter）见 [`metriccanvas-authoring-bundle.md`](./metriccanvas-authoring-bundle.md)，
  依据 [ADR-0063](../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)。
- Authoring S5（宣布 Python 真源、删除 TS 双实现）在 J4 与接线切片完成后进行。
- "platform 去 Node 服务端"是 ADR-0062 登记的必经后续轨道，另开 grill。
- 并入 `CDINL2DataBuilderService` 的时机另行决定；并入时只丢弃 bootstrap、改 consumer
  base URL。
- 发布工作流、Run 可靠性、运维恢复与鉴权接入均不在本计划内。

# MetricCanvas 页面资产 Java Module 组

第一方 Java 17 / Spring Boot 3 / MySQL 页面资产（[ADR-0062](../docs/adr/0062-first-party-java-page-assets-module.md)），
承载 `savePageRevision` / `getLatestPage` / `getPageRevision` / `listPages` 四个 Interface，
目标宿主是 `CDINL2DataBuilderService`。实施切片见 [`docs/plan/metriccanvas-page-assets.md`](../docs/plan/metriccanvas-page-assets.md)。

当前状态：**J1、J2、J3 完成**（工程、契约嵌入、页面校验器、conformance 向量；四个 Interface、稳定错误信封、
指纹幂等、内存仓储与领域 / 契约测试；MySQL Schema、MyBatis 仓储、`GET_LOCK` 锁序与真实 MySQL 集成测试），
J4（接线）未开始。

## 目录

```text
metriccanvas-page-assets/
├── pom.xml                      # reactor；parent 为 cbcbi-parent（本机解析到 build-parent/）
├── build-parent/pom.xml         # 本地占位 parent：只声明 Spring Boot BOM 与插件版本，永不发布
├── contract-snapshot/           # contracts/metriccanvas 只读快照（由根导出脚本生成，勿手改）
├── contract-lock.json           # 快照 manifest 的 sha256（同上生成）
├── page-assets-model/           # Swagger 2.0 作者文件 + 与 dfs-codegen 同形的 delegate / model
│   └── src/main/resources/rest-services-page-assets.yaml   # 唯一作者文件；仓根 contracts/ 下是导出副本
├── page-assets-service/         # domain / application / adapter；ArchUnit 守边界
│   └── src/main/resources/db/migration/pageassets/   # Flyway V{大}.{小}.{补丁}.{序号}__pa_*.sql（独立历史表）
├── page-assets-bootstrap/       # StartUp、Dockerfile、start.sh、assembly（并入宿主时丢弃）
├── scripts/use-company-parent.sh
├── scripts/check-codegen-drift.sh   # CI（能访问 Artifactory）上比对手写 delegate/model 与 codegen 产物
└── spotbugs-exclude.xml
```

## 本机构建

需要 JDK 17 与系统 Maven（**不用 Maven Wrapper**：内网禁直连，wrapper 会外网下载）。

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home)
cd metriccanvas-page-assets
mvn -B verify            # 编译 + 单测 + conformance + ArchUnit + MySQL 集成测试（有 Docker 时）
mvn -B -Pgates verify    # 追加 SpotBugs（公司门禁之一）
```

MySQL 集成测试 `MySqlPageStoreIntegrationTest` 的数据库三选一（见 `testing/MySqlTestDatabase`）：环境变量
`PAGE_ASSETS_TEST_DB_URL`（+ `PAGE_ASSETS_TEST_DB_USERNAME` / `_PASSWORD`）指定的库 → 本机 Docker 上的
Testcontainers `mysql:8.0`（`PAGE_ASSETS_TEST_MYSQL_IMAGE` 可换）→ 都没有则整类跳过（不算失败）。
公司 CloudBuild 若没有 Docker socket，就设前者指向公司测试库；测试会清空其中的 `t_pa_*` 表。

本机没有内部 Artifactory，因此根 `pom.xml` 的 parent 版本是 `local`，经 `<relativePath>` 解析到
`build-parent/pom.xml`——一个与公司 parent **同坐标**（`com.huawei.hwclouds.cbc:cbcbi-parent`）的最小占位，
只声明 Spring Boot BOM、编译目标与常用插件版本。不要往里加公司内部依赖的外网替代坐标。

### 切换到公司 parent

Maven 不允许在 `<parent>` 坐标里写属性，所以切换由脚本完成，CI（能访问 Artifactory）上执行：

```bash
scripts/use-company-parent.sh              # 读根 pom 的 <cbcbi.parent.version>
scripts/use-company-parent.sh 26.08.101-m3-RELEASE
```

脚本只改根 pom `<parent>` 块的版本并清空 `relativePath`。parent 锁定的 Spring Boot 版本以 parent 为准
（ADR-0062），`build-parent/` 里的 3.5.x 只是本机能跑起来的最小集合，二者不一致时先怀疑本地占位。

## 契约嵌入

`contract-snapshot/` 是 `contracts/metriccanvas/` 的逐字节副本，由根目录 `pnpm authoring:contracts` 生成、
`pnpm authoring:contracts:check` 检查漂移（与创作 Bundle 的快照同一套脚本、同一层门禁）。
`page-assets-service` 构建时把它嵌入 JAR 的 `contracts/metriccanvas/`，并把 `contract-lock.json`
嵌入为 `contracts/contract-lock.json`；`ClasspathContractSnapshot.load()` 加载时核对
每个文件对 manifest、manifest 对 lock 的 sha256，任一漂移拒绝启动。运行时不挂载、不远程拉取契约。

## 页面校验器

`domain.page.PageValidator` 与 TypeScript 基线 `packages/page` 的 `parsePage` 逐步对应：

1. Page Schema 结构校验（draft-07）；失败时先给版本 / 组合卡的引导错误再去掉被解释过的结构噪声；
2. 能力下限（声明的 `schemaVersion` 是能力下限，接受 5.0–5.4 全部 minor）与页面参数判定；
3. 解析接缝：分组查询字段展开、DQE 内嵌初始行按 `queryField` 归一化、文本取值整值替换；
4. 替换后结构复检；
5. 全部跨引用不变式（筛选器、数据源与计算阶段、分区叠放层与列轨、组件绑定与专有规则、分页）。

结构校验没有用第三方 JSON Schema 库，而是 `Draft7Evaluator` 按 ajv v8（`allErrors: true`）的
关键字求值顺序与文案复现，因为共享向量里的结构错误由 ajv 产出、要求逐条相同。它只支持
Page Schema 实际用到的关键字子集，遇到未支持关键字在构造时即失败。

### conformance 向量

`contracts/metriccanvas/page/conformance/` 是门禁：`valid/` 每个文档必须零错误，`invalid/` 每个向量
的 `expected` 必须与 Java 输出逐条相同（type / path / message 与顺序）。向量由
[`tools/scripts/page-conformance-vectors.ts`](../tools/scripts/page-conformance-vectors.ts) 定义、
TypeScript 校验器产出 `expected`；`coverage.json` 是机读覆盖清单：每条不变式列出行使它的合法样例
（正例）与破坏它的反例。`PageConformanceTest` 逐向量运行并要求每条不变式两侧都非空。

新增不变式的流程：在 TypeScript 基线实现 → 在向量定义里登记正反例 → `pnpm authoring:contracts`
→ 在 Java 侧实现到 `mvn verify` 通过。

### 与基线的已知实现差异

- `capturedAt` 判定基线用 `Date.parse`；Java 复现 V8 对 ISO 8601 的字段范围校验（月 1–12、日 1–31、
  时 0–23 或 24:00、分秒 0–59、时区小时 ≤ 23，不按月校日）。其它形状退到 `OffsetDateTime.parse`。
- `pattern` 用 Java 正则；模式全部是 ASCII 字符类与锚点，`$` 在 Java `find()` 下会匹配末尾换行符之前，
  JS 不会——带尾随换行的 id 在两边判定不同，契约里的模式不接受换行，实际不可达。
- 数字转字符串（能力下限文案、`String(value)` 占位）按 JS 规则输出；JDK 17 `Double.toString` 在极少数
  非最短表示的浮点数上与 V8 有差，页面参数默认值与图例下界都不会命中。

## Interface（J2）

作者文件是 `page-assets-model/src/main/resources/rest-services-page-assets.yaml`（Swagger 2.0，公司
`dfs-codegen` 的输入）。`pnpm authoring:contracts` 把它逐字节复制到
`contracts/metriccanvas/page-assets/rest-services-page-assets.yaml`，`--check` 查漂移；Python 与 TypeScript
consumer 据副本校验各自 client，不要改副本。

```text
POST {base}/pages/{pageId}/revisions                savePageRevision   201 / 400 / 409 / 422
GET  {base}/pages/{pageId}                          getLatestPage      200 / 404
GET  {base}/pages/{pageId}/revisions/{revisionId}   getPageRevision    200 / 404（先判页面再判修订）
GET  {base}/pages?after=&limit=                     listPages          200
GET  {base}/healthcheck                             healthcheck        200（自定义，不用 Actuator）
```

- `{base}` = `/rest/cdi/{service}/v1`。Swagger 2.0 的 basePath 不能带变量，YAML 里写独立部署缺省值
  `/rest/cdi/pageassets/v1`；运行时由 `pageassets.base-path` 注入（`application.yaml` 默认
  `/rest/cdi/${pageassets.service-name}/v1`），并入宿主后只改这一项与 consumer 的 base URL。
- 请求头：`X-Operator-Id` 必填，即 actorId（`createdBy` 与幂等作用域）；`X-Auth-Token` 由网关校验、
  `X-Workspace-Id` 按网关要求接受，两者首批只接受不解释、不用于数据隔离。
- 错误信封 `{ code, message, details }`，HTTP 状态语义：`INVALID_PAGE` / `PAGE_ID_MISMATCH` → 422；
  `PAGE_ID_CONFIRMATION_REQUIRED` / `REVISION_CONFLICT` / `IDEMPOTENCY_CONFLICT` → 409；
  `PAGE_NOT_FOUND` / `REVISION_NOT_FOUND` → 404。`details` 只有两种取形：`INVALID_PAGE` 为
  `{ errors: [{ type, path, message }] }`，`REVISION_CONFLICT` 为 `{ currentLatest: { revisionId, revisionNumber } | null }`。
  Spring MVC 自己的绑定 / 校验 / 路由错误统一为传输层码 `INVALID_REQUEST`（4xx）与 `INTERNAL_ERROR`（500），
  它们不在 ADR-0062 的业务闭集内，YAML 已如此声明。
- 幂等：作用域 `(savePageRevision, actorId, idempotencyKey)`，指纹是请求体全部业务字段（含 `source` 与
  `dataContextVersion`）的规范化 JSON sha256。同键同指纹原样重放（仍 201），同键异指纹 409。只记成功；
  重放按 `(pageId, revisionId)` 取回不可变修订，不另存响应体。
- `contentHash` = sha256(canonical(document))，与 TypeScript 基线 `canonicalizeJson` 逐字节相同（键按
  UTF-16 码元排序、JS 数字文案）；修订存保存时提交的原样文档，不存解析产物。
- `createdAt` 固定 `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`（UTC 毫秒），`revisionId` 是 UUIDv4 的 32 位无横线形式。

### 与 dfs-codegen 的关系

`dfs-codegen-maven-plugin`（`com.huaweicloud.dfs`）只在内部 Artifactory 可得。`page-assets-model/src/main/java`
是按其 `language=spring` / `library=spring-mvc` / `delegatePattern=true` 输出形状**手写**的 `PagesApi` /
`PagesApiDelegate` / `PagesApiController` 与 POJO model（`@JsonAutoDetect` 字段级序列化、fluent setter、
Bean Validation 在 getter 上），业务实现只在 `adapter/inbound/rest` 实现 delegate，不碰 model module。
`-Pcodegen` 把插件产物生成到 `target/generated-sources/codegen`（不加入编译），
`scripts/check-codegen-drift.sh` 做归一化 diff（去注释、空白与 `@Api*` / `@Generated`）。第一次在公司 CI
上跑通前，插件 goal 与 `configOptions` 以宿主 `CDINL2DataBuilderService/model/pom.xml:43-101` 为准修正。

### 分层落点

- `domain/revision`：`PageRevision`、`RevisionSource`（`relay | manual`）、`SaveRevisionPolicy`（首保确认、
  基线冲突、完整复验、id 一致）、`RevisionFactory`、`ContentHash`；`domain/idempotency`：作用域、指纹、记录；
  `domain/catalog`：码点序、严格游标、limit 50/100；`domain/error`：闭集与 `PageAssetException`。
- `application/PageAssetService`：四个用例；保存的锁序固定为幂等锁 → 页面锁 → 前置检查 → 复验 → 插入修订 →
  更新 latest → 存幂等结果，经 `PageWriteTransaction` / `PageRepository` / `IdempotencyRepository` 三个 Port。
- `adapter/outbound/memory/InMemoryPageStore`：三个 Port 的进程内实现（`pageassets.store=memory`，缺省），
  锁序与 MySQL 侧一致，是 MyBatis 适配器的行为基线；`adapter/outbound/persistence`：MySQL 实现（下节）；
  `adapter/inbound/rest`：delegate 实现、模型映射、错误信封；`adapter/config/PageAssetsConfiguration`：组合根，
  `adapter/config/MySqlStoreConfiguration`：`store=mysql` 时的数据源 / Flyway / MyBatis 装配。

## MySQL 仓储（J3）

`PAGE_ASSETS_STORE=mysql` 时按 ADR-0062 跟随公司栈：Druid + MariaDB 驱动 + MyBatis XML Mapper + Flyway 启动迁移。

- **配置**：`DB_URL` / `DB_USERNAME` / `DB_PASSWORD`（与公司 `DataSourceConfig` 同名；`application.yaml` 映射到
  `pageassets.db.*`）。`DB_PASSWORD` 经 `adapter/config/SecretDecryptor` 解密，缺省原文透传；公司环境注册一个调用
  `TitanCipherEnum.TITAN_SCC_PRIVATE` 的 Bean 即覆盖。连接池参数缺省 initialSize 5 / minIdle 10 / maxActive 100 /
  maxWait 60s。MySQL 8 缺省 `caching_sha2_password` 且不走 SSL 时，URL 要带 `allowPublicKeyRetrieval=true`。
- **Schema**：`page-assets-service/src/main/resources/db/migration/pageassets/V1.0.0.1__pa_init.sql`，三张
  `t_pa_page` / `t_pa_page_revision` / `t_pa_idempotency`，`utf8mb4_bin`、`datetime(3)` UTC、文档 `mediumtext`，
  `(page_id, revision_number)` 唯一。Flyway 编程式装配：历史表 `flyway_page_assets_history`、独立 locations、
  `baselineOnMigrate` + `baselineVersion=0`、`validateOnMigrate`；重复启动只 validate。Spring Boot 的 Flyway
  自动配置关闭。启动日志里 MariaDB 驱动对 `performance_schema.user_variables_by_thread` 的 `SELECT command denied`
  WARN 来自 Flyway 探测，无害。
- **仓储与锁**：`MyBatisPageStore` 实现 `PageRepository` / `IdempotencyRepository`（Mapper XML 在
  `mybatis/pageassets/`）；`MySqlPageWriteTransaction` 实现 `PageWriteTransaction`——一条连接只做
  `GET_LOCK`（幂等锁 `pa:idem:…` → 页面锁 `pa:page:…`，都是 sha256 前缀）/ `RELEASE_LOCK`，另一条连接由
  `TransactionTemplate` 跑事务，锁在提交之后才释放；`GET_LOCK` 超时（`pageassets.db.lock-timeout-seconds`，
  缺省 10）抛 500。RELEASE 失败即废弃该池连接，避免会话锁随连接留在池里被下一位借用者继承。
- **清理任务**：`IdempotencyPurgeTask` 每小时（`pageassets.idempotency.purge-interval`）调用
  `application/IdempotencyRetention.purgeExpired()`，按 `created_at` 索引每批 1000 行删除 7 天前的幂等记录。
- **并入宿主**：所有 Bean 以 `pageAssets*` 命名并显式 `@Qualifier`，`@MapperScan` 只扫本 Module 的 mapper 包，
  Mapper XML 在 `mybatis/pageassets/` 而不是宿主的 `mybatis/*Mapper.xml` 通配范围内。

### 本地起服务

```bash
mvn -B -DskipTests package
tar -xzf page-assets-bootstrap/target/page-assets-bootstrap-*.tar.gz -C /tmp/pa
LOG_DIR=/tmp/pa/logs SERVER_PORT=18080 PAGE_ASSETS_SERVICE_NAME=pageassets /tmp/pa/script/start.sh
curl -s localhost:18080/rest/cdi/pageassets/v1/healthcheck
```

内存仓储重启即空。走 MySQL：

```bash
docker run -d --name pa-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=pageassets \
  -e MYSQL_USER=pa -e MYSQL_PASSWORD=pa -p 13306:3306 mysql:8.0
LOG_DIR=/tmp/pa/logs SERVER_PORT=18080 PAGE_ASSETS_STORE=mysql \
  DB_URL='jdbc:mariadb://127.0.0.1:13306/pageassets?allowPublicKeyRetrieval=true' DB_USERNAME=pa DB_PASSWORD=pa \
  /tmp/pa/script/start.sh
```

## 分层与门禁

`ArchitectureTest`：全部类在 `com.huawei.cdi.pageassets..`；`domain` ← `application` ← `adapter` 单向依赖；
`domain` 不依赖 Spring / MyBatis / Servlet（Jackson 树作为 JSON 表示允许）。
SpotBugs 以 `-Pgates` 开启，`spotbugs-exclude.xml` 只排除 record 与 JsonNode 载体上的
`EI_EXPOSE_REP*` 误报。SecSolar 与 dt4j 覆盖率是公司 CI 侧门禁，随宿主流程接入。

## 交付形态

跟随公司：`page-assets-bootstrap` 打 tar.gz（`lib/` 全部 JAR + `script/start.sh` + `conf/`），
`start.sh` 以 classpath 方式启动 `com.huawei.cdi.pageassets.StartUp`，日志 Log4j2 JSON 编码。
Dockerfile 的基础镜像经 `--build-arg BASE_IMAGE=` 注入，仓库不写死内网地址。
版本由 Fuxi `release_version` 经 `mvn versions:set` 注入，不另设 SemVer。

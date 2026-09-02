# MetricCanvas 页面资产 Java Module 组

第一方 Java 17 / Spring Boot 3 / MySQL 页面资产（[ADR-0062](../docs/adr/0062-first-party-java-page-assets-module.md)），
承载 `savePageRevision` / `getLatestPage` / `getPageRevision` / `listPages` 四个 Interface，
目标宿主是 `CDINL2DataBuilderService`。实施切片见 [`docs/plan/metriccanvas-page-assets.md`](../docs/plan/metriccanvas-page-assets.md)。

当前状态：**J1 完成**（工程、契约嵌入、页面校验器、conformance 向量），J2–J4 未开始。

## 目录

```text
metriccanvas-page-assets/
├── pom.xml                      # reactor；parent 为 cbcbi-parent（本机解析到 build-parent/）
├── build-parent/pom.xml         # 本地占位 parent：只声明 Spring Boot BOM 与插件版本，永不发布
├── contract-snapshot/           # contracts/metriccanvas 只读快照（由根导出脚本生成，勿手改）
├── contract-lock.json           # 快照 manifest 的 sha256（同上生成）
├── page-assets-model/           # Swagger 2.0 作者文件 + dfs-codegen（J2 落地，J1 仅骨架）
├── page-assets-service/         # domain / application / adapter；ArchUnit 守边界
├── page-assets-bootstrap/       # StartUp、Dockerfile、start.sh、assembly（并入宿主时丢弃）
├── scripts/use-company-parent.sh
└── spotbugs-exclude.xml
```

## 本机构建

需要 JDK 17 与系统 Maven（**不用 Maven Wrapper**：内网禁直连，wrapper 会外网下载）。

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home)
cd metriccanvas-page-assets
mvn -B verify            # 编译 + 单测 + conformance + ArchUnit
mvn -B -Pgates verify    # 追加 SpotBugs（公司门禁之一）
```

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

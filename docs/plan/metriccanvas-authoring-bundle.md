# MetricCanvas 独立创作 Bundle 实施计划

> 状态：S4 已完成；S5 首个无保存 `compose` Core/有序并发切片与 M1 首批 Agent 契约、
> Python 指标词解析切片已落地（2026-09-03）；
> Bundle 侧 A1–A3 可独立实现部分已落地（2026-09-03）：sdist/uvx、Relay MCP
> 配置、DQE HTTP Adapter、Lab Data Context HTTP Adapter 和投影治理闸；
> Java J4 已完成（2026-09-03）并顺带落了 A1 的幂等键派生 / `skillVersion` 与 A2 的 `IdentityPort`
> 首个 Adapter（见下方接线切片节的 J4 交叉登记）；`build_page` 暂作兼容包装；
> `compose_page` 已在显式 Relay 工具面注册，但仍等待 Relay artifact 双通道后才可对真实模型开放
>
> 决策：[ADR-0061](../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)、
> [ADR-0063](../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)、
> [ADR-0064](../adr/0064-agent-returns-page-artifact-relay-and-java-own-persistence.md)
> 交付根：`metriccanvas-authoring/`

## 目标

在不访问真实 Relay、Java 和 DQE 的条件下，交付一个可独立复制、启动、测试和验收的
创作 Bundle，逐步把当前 TypeScript 创作期确定性行为迁入 Python。Bundle 是 Skill、
Tool、Interface contracts 和锁定产品契约快照的原子发布容器，不把它们混成一个 Module。

## 冻结边界

- Skill 负责自然语言理解、消歧、用户确认和结果呈现；不导入 Python。
- Python Tool 负责 Page Build Spec 校验、查询与字段派生、验真、执行、组件选择、装配和
  当前 Page Schema 校验，并返回 `PageBuildArtifact`；不读取 Skill，不拥有持久化。
- 当前 `build_page` 仍在 `compose` 成功后通过 Java Port 保存，属于迁移兼容包装；目标架构删除
  `PageAssetPort`，由平台在用户显式沉淀时调用 Java。
- Skill 与 Tool 只通过 MCP Tool Interface 协作。FastMCP 是 Adapter，内部算法不是 tools。
- Page Build Spec 是模型与确定性算法的边界，不含 DQE 查询体、字段契约、组件 JSON、
  布局或页面协议版本。
- `pageId` 与幂等键属于 `build_page` command envelope，不进入 Page Build Spec；精确基线修订
  仍随修订场景放在 Page Build Spec 中。
- Python 不持久化 Relay Session/Run 或临时页面检查点，不直连 MySQL，不复制 Java 页面资产事务或 DQE 内部逻辑。
- Bundle 使用 Python 3.12+ sdist 交付，不发布到公共索引；Relay 以
  `uvx --from <tar.gz>` 构建临时 wheel 并启动，依赖版本锁定。
- 产品规则由仓根中立契约导出物承载，Bundle 只消费锁定快照，不手抄第二份规则清单。
- 内网鉴权与身份接入由后续内网对接方案承担，不进入本 Bundle 的设计与排期。

## 目录与所有权

```text
contracts/
└── metriccanvas/                         # 生成的产品中立契约；跨运行时共享
    ├── manifest.json
    ├── page/
    │   ├── schema.json
    │   ├── component-catalog.json
    │   ├── error-types.json
    │   └── conformance/{valid,invalid}/
    ├── query/error-codes.json
    └── data-context/schema.json

metriccanvas-authoring/                   # 一个原子发布 Bundle
├── bundle.json                           # Bundle 版本与两个 Module 入口
├── bundle.lock.json                      # Bundle 全内容摘要
├── contract-lock.json                    # 产品快照和 Authoring contracts 版本钉住
├── skill/
│   └── metriccanvas-page-builder/
│       └── SKILL.md                      # Relay/Agent Module
├── contracts/
│   ├── authored/page-build-spec.schema.json
│   ├── exported/{analysis-intents,build-page-conformance}.json
│   └── manifest.json                     # Skill↔Tool Interface contracts
├── contract-snapshot/                    # contracts/metriccanvas 的只读生成快照
├── tool/
│   ├── server.py                         # FastMCP stdio 进程入口
│   ├── requirements.in
│   ├── requirements.lock
│   └── metriccanvas_authoring/
│       ├── domain/                       # 确定性业务规则
│       ├── application/                  # 粗粒度用例与外部 Port
│       └── adapters/inbound/             # FastMCP 等入站 Adapter
├── test-harness/
│   ├── adapters/                         # 仅测试使用的 Fake
│   ├── fixtures/
│   ├── stdio_server.py                   # Fake Ports 的子进程组合根
│   └── tests/                            # 进程内 + 真实 stdio 黑盒
└── scripts/check_bundle.py
```

所有权判据：产品协议放仓根 `contracts/`；Skill↔Tool 接口放 Bundle `contracts/`；生产
算法只在 `tool/`；Fake/fixture/测试调用者只在 `test-harness/`。真实出站 Adapter 在接口
可见前不预造目录和 HTTP 信封。

## 契约同步

```text
TS/Zod/registry 作者真源
        │ 单向生成
        ▼
contracts/metriccanvas ──完全复制──▶ metriccanvas-authoring/contract-snapshot
        │                                    │
        └──────── manifest digest ───────────┘ contract-lock.json

Page Build Spec 作者文件 ───────▶ metriccanvas-authoring/contracts/manifest.json
分析意图及映射 TS 闭集 ──单向导出──┘
TS 装配与校验真源 ──生成───────▶ 跨语言正反例向量
```

根 CI 以 `--check` 只读重算并检查四层漂移：产品导出、Bundle 快照、Authoring
contracts、Bundle/contract locks。跨引用和能力不变式不能只靠 JSON Schema，必须保留
共享分类向量，并在迁移期由 TypeScript 与 Python 共同验证。

## 实施切片

当前进度（2026-09-02）：S0、S1 已完成并接入 CI，目录边界已按 ADR-0061 重构；
S2 已完成，Harness 可从 Page Build Spec 经粗粒度 application seam 调用数据上下文、DQE、
Java 页面资产三个 Port，并验证结构化调用、稳定错误 `code/path` 和当前页面协议产物。
S3 已完成 Data Context 结构校验、语义面投影/检索/敏感取值隐去、
名称/取值/时间粒度闭集、
DQE/结果字段契约派生、formula、运行期错误四段归因，以及柱状图/折线图组件硬闸
与装配垂直切片。当前 TS 装配支持的指标卡、柱、线、饼、表、排行组件已对齐，
口径组分区、报告页头和 12 列比例装箱已迁移。组件数据形状矩阵已上收为
产品组件目录的 `authoringShape`，
TypeScript 与 Python 共用单向导出的中立事实。分析意图映射同样由 TS
单向导出，Python 不再维护第二份转换表。

S3 的等价证据由生成向量锁定：一条完整构建向量同时比较实际 DQE
请求与 canonical Page JSON；5 条取数单元反例比较稳定 `code/path`；3 条 DQE
结果行反例确保错误在保存前归于 presentation 阶段。产品契约另导出 5 条
跨语言页面语义反例，覆盖查询映射、字段角色、组件字段绑定、筛选绑定和
全页组件 id 唯一性。Python 对其生成的完整页面执行 Page Schema、DQE 初始行字段
契约和上述跨引用不变式校验；Java 保存入口仍按 ADR-0060 对完整 Page 协议复验。

### S0：自包含骨架

- 创建 Bundle manifest、锁定依赖、Skill 与脚本入口。
- 加入真实 FastMCP stdio 子进程黑盒测试。
- 提供一条独立 `check` 命令并接入根 CI。

完成条件：新 checkout 安装锁定依赖后，可独立验证 manifest、契约摘要和 stdio MCP 往返。

### S1：产品中立契约导出

- 从 TypeScript 真源导出 Page Schema、组件能力目录、错误分类和数据上下文 Schema 到仓根。
- 导出有效页面 fixture 与最小无效分类向量。
- 为 Bundle 生成完全相同的只读快照和 manifest 摘要锁；`--check` 不写文件。

完成条件：修改 Page Schema、组件目录或快照而未重生成时，本地与 CI 明确失败。

### S2：Page Build Spec 与语义 Port

- Page Build Spec 只表达业务语义，并由 Bundle Authoring contracts 拥有。
- 定义数据上下文、DQE 执行与 Java 页面资产的语义 Port。
- Fake 只存在于 Test Harness，记录结构化调用，不假设真实 HTTP 路径或响应信封。

完成条件：Harness 能用 fixture 提交 Page Build Spec，并观察每个 Port 的结构化调用记录。

### S3：确定性核心迁移

按行为依赖顺序迁移：数据上下文投影与检索 → 取数单元清单校验与验真 → 组件硬闸与
意图排序 → 口径分区、页头、字段绑定和比例装箱 → 完整页面校验。

完成条件：冻结输入下，Python 与 TypeScript 的 canonical Page JSON 和稳定错误
`code/path` 等价。

状态：已完成。

### S4：Skill 与粗粒度工具

- Skill 使用逻辑能力名，不携环境路径、部署参数或算法实现细节。
- FastMCP 仅暴露 `discover_data_context` 与 `build_page` 两个粗粒度工具。
- Bundle/contract identity 通过 Resource/health/CLI 诊断，不作为模型工具。
- 工具返回结构化阶段进度、脱敏摘要和精确修订标识，不返回完整模型轨迹。

完成条件：真实 MCP 子进程能用 Fake Port 走通黄金场景，产生已保存修订标识和通过契约的页面。

状态：已完成。FastMCP 模型可见面仅有 `discover_data_context` 与
`build_page`；Page Build Spec 完整结构直接由 authored contract 注入 Tool Schema，
运行时仍由 application 校验器产生稳定 `code/path`。`build_page` 返回已完成
阶段、仅含单元数的脱敏摘要和精确修订标识；失败作为结构化结果返回，不伪装成
MCP 传输错误。`bundle_info` 继续只是 Resource。生产组合根对未接入的三个
出站 Adapter 显式失败；`test-harness/stdio_server.py` 仅为黑盒验收组合 Fake。

### S5：迁移切换

- 完整 Agent 前半链、两速生命周期、Relay/Chat/会话、差分、灰度与删除门禁见
  [`metriccanvas-agent-full-migration.md`](./metriccanvas-agent-full-migration.md)。本节只保留 Bundle 视角的切换摘要，
  不再把「页面 JSON 等价」误当成「Agent 功能全等价」。
- 冻结等价向量和差分报告。
- 宣布 Python 为页面装配真源，停止 TypeScript 装配实现演进。
- 删除双实现，保留产品中立契约导出和跨语言验收。

完成条件：目标创作链不执行 TypeScript/Node 服务端代码，冻结向量仍能在 CI 复现。

状态：等价向量已冻结；Java J4 已完成；A1–A3 的 Bundle 代码与
Harness 已完成，切换等待真实 Relay/模型/元数据/DQE 环境验收与按用户身份。

首个实现切片（2026-09-03）：新增 `application.compose_page` 与
`page-build-artifact.schema.json`，成功结果包含已校验页面文档、文档 SHA-256、
`dataContextVersion` 和 Bundle 版本；其依赖只有 Data Context 与 DQE 两个 Port。
多个取数单元已改为最多 6 个有序并发执行：并发完成顺序不改变产物顺序，多个失败按最低单元序号稳定归因。
原 `build_page` 改为薄兼容包装，在 compose 成功后才执行旧 Java 保存路径。
FastMCP 已提供互斥的 compatibility 与 Relay 工具面，目标 Skill 已改用 `compose_page`，并写明
MCP 注册、精确调用契约、九阶段状态机和安全失败条件。Relay 必须先提供完整 artifact 写检查点、
脱敏摘要回模型的双通道，才可把 Relay 工具面对真实模型开放；否则当前 Relay 会把完整页面与初始
数据行重新送入模型上下文。

## 接线切片（依据 ADR-0063）

**J4 交叉登记（2026-09-03，PR 见 `metriccanvas-page-assets.md` J4 节）**：Java 轨 J4 为了让 `build_page`
真实落库，已在本 Bundle 内完成以下原属 A1 / A2 的项，A 轨开工时直接复用、不要重做：

- `build_page` 幂等键由 Tool 派生 `hash(pageId, baseRevisionId, canonical(spec))`（`domain/idempotency.py`），
  MCP 工具签名已去掉 `idempotency_key`；`source.relay.skillVersion` 取 `bundle.json` 的 `bundleVersion`，
  `sessionId` 取 FastMCP `Context.session_id`，`runId` 留空待 Relay 提供（A1）。
- `IdentityPort` + 首个 Adapter `adapters/outbound/env_identity.py`（读 `METRICCANVAS_OPERATOR_ID` /
  `METRICCANVAS_AUTH_TOKEN`），只被 Java Adapter 使用；A2 的 DQE Adapter 复用同一 Port，不再另起身份来源。
- `PageAssetPort` 的 HTTP Adapter `adapters/outbound/java_page_assets.py`（stdlib `urllib`，不新增依赖）；
  `server.py` 按 `METRICCANVAS_PAGE_ASSETS_BASE_URL` 装配它。
- 保存命令补 `source` 与 `dataContextVersion`；`baseRevision.pageId` 校验；`PAGE_REVISION_CONFLICT`
  已改名 `REVISION_CONFLICT`。
- Java 侧指纹据纵切修正为只覆盖 `pageId` / `baseRevisionId` / `document`：Relay 一次性子进程重试时
  `sessionId` 必然不同，若进指纹会让 ADR-0063 预期的"重试命中幂等"变成 `IDEMPOTENCY_CONFLICT`。

Relay 与 DQE 的真实接口已由调查报告确认。外部前置仍有：测试环境地址、
账号与 LiteLLM key，Relay 仓内 Artifact Adapter/固定编排，以及 MetricService
维度取值的真实 URL/DTO 契约；Bundle 内可独立完成的部分见下方勾选项。

已知欠账（J1 扩充 conformance 向量后暴露）：Python `validate_page_document` 只对齐 21/154 个
反例，且误拒含 detail 角色字段或分组查询字段的合法页面；未对齐项见
`test-harness/fixtures/page-conformance-pending.json`。它只是创作期预检（Java 保存时完整复验），
补齐还是随 S5 删除双实现一起处理，另行裁决；A2/A3 真实验收若被它拦下合法页面，先查这份清单。

### A1：Relay 适配

- [x] `SKILL.md` 含 `name`、`description`、`allowed-tools`、`metadata.mcp_servers`，
  并写明 sdist 注册、两个工具的精确调用和外部 Adapter 前提。
- [x] `tool/pyproject.toml` 构建自包含运行时契约的 sdist；
  `relay/mcp_configs/metriccanvas-authoring.json` 以 `uvx --from <tar.gz>` 启动。
- ~~`build_page` 幂等键改为 Tool 派生 `hash(pageId, baseRevisionId, canonical(spec))`；
  `source.relay.skillVersion` 取自 `bundle.json`，`sessionId` / `runId` 可选。~~ 已由 J4 完成（见上）；
  `runId` 的 Relay 透传仍是外部验收项。
- [ ] 确认 Relay 是否能把 `runId` 递到工具调用。
- [ ] 在本地 Relay 环境用真实 LiteLLM/GLM 跑一次黄金场景，验证 inputSchema 深度可接受、
  `compose_page` 响应 ≤ 30s。

本仓证据：`uv build --sdist` 成功，并以
`METRICCANVAS_TOOL_SURFACE=relay uvx --from <local.tar.gz> metriccanvas-authoring`
完成安装与 stdio 启动。

完成条件：本地 Relay 以 `role_name` 唤起 Skill，真实模型经 MCP 调到 Tool，
Page Artifact Adapter 写入会话检查点并只向模型返回安全摘要。

### A2：身份与 DQE Adapter

- ~~`IdentityPort`：第一个 Adapter 从 MCP config `env` 读取服务态 `X-Auth-Token` /
  `X-Operator-Id`；ADR-0063 明确这不是生产形态。~~ 已由 J4 完成（`env_identity.py`），DQE Adapter 复用。
- [x] `DqeExecutionPort` 生产 Adapter：`POST /rest/cdi/cdinl2databuilderservice/v1/dsl/execute`，
  错误码按 ADR-0063 映射，多取数单元并发执行；永不直连 Lab。
- [x] 无权限时的可行动提示由
  `METRICCANVAS_DQE_FORBIDDEN_HINT` 部署配置承载，不改变 `DQE_FORBIDDEN` 错误分类。

完成条件：Harness 与真实测试环境各有一条 DQE 执行验收；错误分类与产品契约一致。

### A3：Data Context Adapter

- [x] `DataContextPort` 生产 Adapter：Lab 数据集列表/详情 → Schema 1.1；
  `isAgg` / `aggregator` 映射可加性与可证时间聚合；`dataContextVersion` 为
  数据集 `update_date` 摘要；已验证查询为空。
- [x] Lab 没有明示而 Schema 1.1 必填的 `isRatio` / `nullable` / `sensitive`
  通过外部投影治理配置补足；缺失时返回
  `DATA_CONTEXT_GOVERNANCE_REQUIRED`，不猜测。
- [x] 维度取值域保留 `DimensionValuePort` 并有 Harness 验证。
- [ ] MetricService 的真实 URL/DTO 契约到位后补 HTTP Adapter。
- [x] 发现全量、执行按身份，按 ADR-0063 登记。

完成条件：真实元数据经 Adapter 产出通过 Schema 1.1 校验的数据上下文快照。

### 生产门禁（不在 A1–A3 内）

- 按用户身份到达 Tool：首选 Relay Plugin `on_tool_execute_before` 注入，次选 Relay
  `MCPToolProxy` 改造；完成前不得宣称创作期已按用户鉴权。

第一方 Java 页面资产的决策见 [ADR-0062](../adr/0062-first-party-java-page-assets-module.md)，
切片见 [`metriccanvas-page-assets.md`](./metriccanvas-page-assets.md)；其 J4 已补齐本 Bundle
的 Java HTTP Adapter、保存命令的 `source` 与 `dataContextVersion`，并把
`PAGE_REVISION_CONFLICT` 改名为 `REVISION_CONFLICT`（见上方 J4 交叉登记）。

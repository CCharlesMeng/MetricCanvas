# MetricCanvas 创作架构

Bundle 0.3.0 的平台入口使用 protocol 2.0。用户决策见 [ADR-0083](../docs/adr/0083-platform-evidence-work-and-internal-draft-save.md)，部署接口与状态约束见[平台协议](contracts/authored/platform-v2-protocol.md)。旧候选链仍供兼容消费者使用，见[历史 v1 架构](ARCHITECTURE-V1.md)。

## 入口与业务范围

- `metriccanvas-platform-content` → `platform_server.create_platform_server`：读配置、发现、独立查询、创建、编辑，另保留 Relay 预览工具。compose/edit 内部保存平台草稿。
- `metriccanvas-platform-content-v1` → `unified_content_server`：旧候选协议与兼容 Skill，既有记录不转换、不删除。不是 v2 缺依赖时的回退。
- `metriccanvas-authoring` → `server`：普通问数/探索，临时页面态不自动保存；两工具 Skill 保持原协议。

目标工具面固定六项：`read_page_context`、`discover_data_context`、`query_data`、`compose_page`、`edit_page`、`page_metadata_emit_preview`，另有 resource `metriccanvas://bundle-info`。请求体不另写模型，直接以 `WithJsonSchema` 投影领域侧的 `QUERY_SCHEMA`/`COMPOSE_SCHEMA`/`EDIT_RESULT_SCHEMA`；工具面消费契约，不拥有契约。返回恒为 `{ok, modelSummary, artifactEnvelope}`，模型只读 `modelSummary`，程序产物只在 mutation 时产出 `artifactEnvelope`；异常在此收成 `rejected`/`unavailable` 闭集，实现细节不外泄。

入口模块只保留 CLI 委托，装配住在 `bootstrap/`：`platform.py` 是目标组合根，`compatibility.py` 显式承载旧入口，两者从同一个 `environment.py` 取适配器。端口按消费方归属（`data/`、`assets/`、`work/` 各自声明，服务态身份在 `adapters/service_identity.py`），不再有汇总的 `application/ports.py`；`application/` 包已随能力归位删除。

入站 MCP 是接入点而不是 Adapter：目标工具面在 `entrypoints/mcp/`，旧注册名的工具面与各自启动入口同处 `entrypoints/compat/`。出站按外部系统边界分组而不按方向分组：`adapters/firstparty/`（Lab Data Context、DQE、Java 页面资产、草稿生命周期、未接入的发布；不写作 `java/` 是因为 Lab 与 DQE 不是 Java 契约）、`adapters/relay/`（Relay 注入的只读输入与来自 MCP config 的服务态身份）、`adapters/storage/`（SQLite）。身份端口留在 `adapters/service_identity.py`，由全部出站适配器共用。`bootstrap/` 之外不 import 具体适配器。

宿主通过同一次请求注入可信上下文和提供方。默认独立 CLI 不能凭模型输入制造身份、计划确认或保存权限；缺依赖明确不可用。

## 职责与依赖

| 维护位置 | 拥有的行为 |
|---|---|
| `data/executable_units.py` | 取数单元派生、结果字段契约、DQE 请求体与查询源投影；不选组件、不排布局 |
| `data/query.py` | 共享查询派生、执行、源描述映射与字段核对；不构造页面 |
| `data/results.py` | 计划/证据授权、持久结果引用、失败去重、受限证据、作用域及版本检查 |
| `data/semantic_catalog.py` | 相关 Lab 指标精简投影、calculate_conf 识别、缺失/冲突与精确详情身份；不输出 SQL |
| `pages/referenced.py` | 消费结果引用后的章节装配与局部新增组件；不执行 DQE |
| `pages/editing/operation_batch.py` | 同步/异步共用的批次、依赖、回滚和 partial/unchanged 规则 |
| `pages/composition/page_building.py` | 消费取数单元装配整页与数据组件；产品可渲染与创作准入保持不同能力 |
| `work/state.py` | 单份工作稿、版本竞争和跨调用预算 |
| `assets/drafts.py` | 冻结提交、单次保存、回执核对、无需候选的恢复 |
| `delivery/preview.py` | 定义/预览分离、精确产物关联、Relay 准备预览 |
| `pages/platform_authoring.py` | 平台用例编排；业务规则不复制到 MCP 入站 |
| `entrypoints/mcp/platform_mcp.py` | 参数 Schema 与模型/程序通道投影 |
| `adapters/storage/platform_state.py` | SQLite 原子 CAS；新表与兼容记录共存 |
| `bootstrap/environment.py` | 由环境一次性选择出站适配器；未配置的能力返回说明原因的端口，不降级替换 |
| `bootstrap/platform.py` | 目标组合根，选择显式注入能力；无需旧候选存储或强保存能力 |
| `bootstrap/compatibility.py` | 旧入口的装配，与目标入口共用同一份适配器选择；不是 v2 的回退 |

依赖单向：`data` 不 import `pages.composition.page_building`，取数单元模型与查询源投影归 `data`，`pages` 消费它装配页面；两侧共同的构造失败类型在包根 `build_issues.py`，与 `canonical.py`、`runtime_assets.py`、`bundle_info.py` 同层。章节和新增组件不再生成临时整页再拆取。旧新装配调用共享查询内核；统一兼容入口也直接调用 `pages/composition/compose_content.py`，不创建 MCP Server 调自己的工具。纯规则不依赖 HTTP、MCP 或 SQLite。

## 状态与交付

计划确认和模型数据策略来自可信授权提供方；模型只提出请求。取数在已确认范围内执行，状态区分失败、空与有值；小结果完整展示，大结果明确返回/总量/截断，完整性未知保守报告。同一失败不重查，整体调用/时长/查询轮次/修复次数/返回量共享预算。

工作稿更新先竞争版本。页面合法且定义有变化才冻结保存，partial 保留独立成功与未受影响内容。冻结记录含完整提交定义和基线，不回读候选。未知或冲突不自动重发；恢复读取原记录，不重放写入。保存成功返回 draftId=ref.resourceId，同时保留 pageId/revisionId；下一次编辑以已验证 ref 为基线。

保存 document 去掉 query initial；previewJson 保留匹配的预览数据，inline 不剥离。Relay 预览入口只消费精确 artifactRef，卡片实际格式由部署 Adapter 实现。保存、预览准备和用户实际看到页面是不同状态；真实工作台交付必须另外验收。

## 真源与分发

页面产品事实仍来自 `packages/page` 与产品参考。现有 TypeScript 导出器生成产品契约、bundle snapshot 和安装参考；运行时 v2 输入 Schema 从公共页面结构/编辑输入和 v2 Python 定义注册，Skill 示例针对实际 MCP Schema 验证。Bundle manifest/lock 纳入新源码、协议和兼容资产。

wheel 与 sdist 都携带完整运行契约。`hatch_build.py` 仅在源码构建时收集契约；从 sdist 构建时消费已内嵌的 `_bundle`，不依赖仓外路径。

普通问数尚未迁移到 v2 模型证据通道，因此其 Skill 不调用新 query_data。共用的是底层查询与页面构造规则；不复制平台保存和身份语义。

## 验证范围

测试分为公共行为与状态/存储、实际 MCP Schema/Skill 契约、打包安装、正式渲染器本地夹具、真实模型轨迹。入口接线和生产回执不由本地替身证明。详见[实施记录](../docs/plan/2026-09-20-authoring-implementation-progress.md)与[Relay 接入](RELAY-HANDOFF.md)。

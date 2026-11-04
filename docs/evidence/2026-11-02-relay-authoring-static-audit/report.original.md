# MetricCanvas 创作能力现状报告与真实接缝清单 (合并版)

> **检查性质**: 源码 + 配置静态取证。**不是改造实施**。未移动文件、升级依赖、重生成内容包或修复问题。
> **检查日期**: 2026-11-02
> **转交目标**: MC 产品仓
> **证据层**: S=源码 C=配置 R=运行注册 T=隔离探针 P=真实服务回执。本仓为源码检出, 无运行进程 → R/T/P 多为 not_run。
> **本文件合并了 report.md / evidence.md / tool-contracts.json 三份交付物, 可一次性阅读。**

---

## 目录

1. [检查身份与范围](#1-检查身份与范围)
2. [实际架构与端到端调用链](#2-实际架构与端到端调用链)
3. [两种创作逻辑能力矩阵](#3-两种创作逻辑能力矩阵)
4. [Skill/脚本/产品事实/Relay 接线归属](#4-skill脚本产品事实relay-接线归属)
5. [当前真实接缝表](#5-当前真实接缝表)
6. [关键源码定位](#6-关键源码定位)
7. [实际工具契约清单 (tool-contracts)](#7-实际工具契约清单-tool-contracts)
8. [脱敏检查命令与结果](#8-脱敏检查命令与结果)
9. [不一致、失败与未知事项](#9-不一致失败与未知事项)
10. [交叉核验](#10-交叉核验)
11. [相比可信旧基线的差异](#11-相比可信旧基线的差异)
12. [已验证、推断与 not_run](#12-已验证推断与-not_run)
13. [对接 MC 共享能力所需的最小改动及兼容风险](#13-对接-mc-共享能力所需的最小改动及兼容风险)
14. [转交 MC 侧的简短结论](#14-转交-mc-侧的简短结论)
15. [完成前复核](#15-完成前复核)
16. [三 subagent 交叉核验汇总](#16-三-subagent-交叉核验汇总)

---

## 1. 检查身份与范围

| 项 | 值 | 来源(file:line) | 层 |
|---|---|---|---|
| 仓库 | D:/Code/0TMG/AI辅助研发/CDIRelayAgentService | git rev-parse | S |
| 分支 | feature_2026090792115_build_metadata | git | S |
| HEAD SHA | 663da7ea7f4a662f0e4bec678b7feea02951dc97 | git | S |
| 脏工作区 | 是 (9 文件未跟踪, 均为报告/日志/skill designs, 非生产代码) | git status | S |
| 检查层 | **S=源码 + C=配置**; R=运行注册 not_run; T=隔离探针 not_run; P=服务回执 not_run | — | — |
| 检查对象 | 实际 Skill (metriccanvas-platform-authoring) + MCP 服务 (metriccanvas-platform-content) + 2 个 Relay 插件 (authoring_turn_provider, authoring_preview_bridge) | — | — |
| Skill 名称 | metriccanvas-platform-authoring | SKILL.md:1 | C |
| Skill 物理路径 | workspace/agents/agent_workspace/.skills/metriccanvas-platform-authoring/ | find | S |
| MCP 服务模块 | metriccanvas_authoring.platform_server → entrypoints.mcp.platform_server | bundle.json:35 | C |
| MCP 服务代码路径 | workspace/agents/agent_workspace/local_mcp_servers/metriccanvas_platform_content/tool/metriccanvas_authoring/ | find | S |
| Python | not_run (本机 `python` 未在 PATH; 部署用 /opt/cloud 路径) | `python --version` | not_run |
| Node | v26.8.1 | `node --version` | R |
| bundleVersion | 0.3.1 | bundle.json:3 | C |
| bundleStatus | local-deployment-readiness-verified-internal-not-run | bundle.json:4 | C |
| productContractVersion | 1.0.0-rc.4 | contract-lock.json:4 | C |
| authoringContractVersion | 0.3.1 | contract-lock.json:6 | C |
| **pageSchemaVersion (运行时)** | **6.54** | contract-lock.json:8 → load_bundle_info() bundle_info.py:21 | S+C |
| pageSchemaVersion (stale lock) | 6.11 | bundle.lock.json:3 | C (stale, 不被读取) |
| pageSchemaVersion (snapshot) | 6.11 | contract-snapshot/manifest.json:3 | C (snapshot, 不被运行时读取) |
| pageSchemaVersion (mc-content) | 6.77 | mc-content.version.json:7978, product-contracts/manifest.json:3, runtime/contract-alignment.json:8 | C (tool_mc_query 报告值) |
| SKILL.md 声称 | 6.54 | SKILL.md:11 | C |
| platformProtocolVersion | 2.0 | bundle.json toolServices; bundle_info resource | C |
| MCP transport | stdio, python>=3.12 | bundle.json | C |
| MCP config | workspace/agents/agent_workspace/.relay/mcp_configs/metriccanvas-platform-content.json (cwd=/opt/cloud/... 部署路径) | find | C |

**重要说明**: 本仓为源码检出, **无运行进程**。所有结论基于源码静态分析 + 配置文件。MCP config 的 cwd/env 指向 `/opt/cloud/CDIRelayAgentService/...` (部署路径), 非本仓本地路径 — 本地无法用此 config 启动服务。版本字面量来自源码, 不来自运行进程观察。文件名/mtime/配置存在**不单独证明**当前运行的是它。

**MCP 服务生成模式** (subagent-C 确认): `src/relay/infrastructure/external/mcp/mcp_manager.py:105,415` `mode: "temp_subprocess"` — **每次工具调用生成临时子进程**, 非持久 stdio 连接。这影响: 进程内 lru_cache 跨调用不保留; 状态必须通过 per-turn 文件中转 (非进程内存)。

**Relay 对 ToolResult 的消费** (subagent-C 确认): Relay Core **只消费 `ToolResult.content` (= modelSummary), 丢弃 `structured_content`**。所以 modelSummary 是模型通道的唯一信息源, artifactEnvelope/interactionEnvelope 不进入模型。

**版本漂移结论**: 运行时 compose 的 document.schemaVersion = 6.54 (referenced.py:69 `load_bundle_info()['pageSchemaVersion']`)，与 SKILL.md 一致。bundle.lock.json (6.11) 和 manifest.json (6.11) 是过期/快照副本，**不被 load_bundle_info() 读取**。mc-content subtree (6.77) 由 tool_mc_query 报告, **与运行时输出 6.54 矛盾** — 模型可能被误导。

---

## 2. 实际架构与端到端调用链

### 2.1 实际架构

```
用户/前端 (WebSocket CONFIG 消息, 含 agent_context: user_id, user_no, env, page_metadata_id)
    │
    ▼
Relay Core (src/relay/)
    │  project_home = workspace/agents/agent_workspace/ (自包含项目根)
    │  SkillLoader (skill_loader.py:712) 加载 .skills/metriccanvas-platform-authoring/SKILL.md
    │    → 解析 frontmatter (name, allowed-tools[15], metadata.mcp_servers[metriccanvas-platform-content])
    │    → _load_skill_tools (skill_loader.py:781) 加载 scripts/tools.py 的 tool_ 函数
    │    → skill.allowed_tools 注入 system prompt (skill_play_tool.py:491)
    │    → 权限执行: agent_factory.py:653-681 filter_tools (agent-build 时白名单过滤, 非每次调用拦截)
    │
    ├─ [Plugin] authoring_turn_provider (on_tool_execute_before)
    │    turn_provider/plugin.py:485-614
    │    │  仅对 _METRICCANVAS_TOOLS (10 个创作工具) 触发
    │    │  turn_id = "turn-" + sha256(session_id)[:12]  (稳定 per-session)
    │    │  actor_id = agent_context.user_id (回退 env)
    │    │  若 agent_context.page_metadata_id 存在 → Java 加载已有页面 → existing 轮次
    │    │  否则 → new-page 轮次
    │    │  写状态文件 relay_authoring_state_{turn_id}.json (binding + documentJson)
    │    │  强制注入 args["context_ref"] = turn_id  (FastMCP 拒绝未知 kwargs)
    │    ▼
    ▼
MCP 工具调用 (FastMCP, stdio 临时子进程 — temp_subprocess 模式)
    platform_mcp.py:214-489 (@mcp.tool × 15)
    │  call() 包装 (platform_mcp.py:157-207):
    │    current_context_ref.set(tool_context_ref)  ← per-call ContextVar
    │    result = await method(*args, **kwargs)  ← application.*
    │    返回 ToolResult(content=modelSummary, structured_content={ok, modelSummary, artifactEnvelope})
    │
    ├─ application.read / discover / query / mutate / publish / preview / parameters.*
    │   (pages/platform_authoring.py PlatformAuthoring)
    │
    ├─ query_data → DqeHttpExecutionPort (adapters/firstparty/dqe_http.py:68)
    │    POST {base_url}/dsl/execute  ← 真实 Java DQE
    │
    ├─ compose_page/edit_page → mutate → saver.save (assets/drafts.py:51)
    │    is_draft=true (默认) → Java 保存接口 (HTTP)
    │    verify_current: sha256 对比 Java 当前文档 vs 本地基线 (drafts.py:44-49)
    │
    ├─ publish_page → saver.save(is_draft=false) → Java 发布接口
    │
    └─ page_metadata_emit_preview → FilePreviewAdapter 写 relay_authoring_preview_{turn_id}.json
        │  env==metric-canvas-platform → ready/artifactRef summary (pangu 风格)
        │  env!= → _emit_report_card (gzip+base64 previewJson, data-agent 风格)
        ▼
    [Plugin] authoring_preview_bridge (on_tool_execute_after)
        preview_bridge/plugin.py:144-191
        │  读 preview 文件, 缓存 previewJson 到 session metadata
        ▼
    [Plugin] authoring_preview_bridge (on_response_transform / on_response_final)
        preview_bridge/plugin.py:194-413
        │  替换 {{PAGE_METADATA_PREVIEW_JSON}} 占位符 或 兜底注入 {{RESPONSE_START}} + 卡片
        ▼
前端 (消费 pangu-entrance 卡片 OR data-agent template 卡片)
```

### 2.2 端到端调用链 (一条完整创作流)

**页面先行 (新建页面)**:
1. 用户消息 → WebSocket CONFIG (agent_context, 无 page_metadata_id)
2. Relay Core → Plan Agent → skill_play(metriccanvas-platform-authoring)
3. SkillLoader 加载 SKILL.md (allowed-tools[15] + mcp_servers[metriccanvas-platform-content])
4. 模型调 read_page_context(context_ref)
5. **turn_provider plugin on_tool_execute_before**: turn_id 派生, new-page binding, 写状态文件, 注入 context_ref
6. MCP 工具 application.read → 读状态文件 binding → 返回 pageId=new-page, workVersion
7. 模型调 discover_data_context → query_data (POST /dsl/execute 真实 DQE) → 拿 resultRef
8. 模型调 tool_mc_compile (布局标准编译) → tool_mc_query (查模板)
9. 模型调 compose_page(sources={source_id: resultRef}) → mutate → saver.save(is_draft=true) → Java
10. 模型调 edit_page(add_ai_summary) → mutate → saver.save
11. 模型调 submit_ai_summary_body → 写 aiSummary body 文件
12. 模型调 page_metadata_emit_preview → 写 preview 文件 → _emit_report_card (data-agent 风格)
13. **preview_bridge plugin on_tool_execute_after**: 缓存 previewJson 到 session metadata
14. 模型输出 {{RESPONSE_START}} + {{PAGE_METADATA_PREVIEW_JSON}}
15. **preview_bridge plugin on_response_final**: 替换占位符 / 兜底注入卡片
16. 前端消费卡片, 用户确认
17. 模型调 publish_page → saver.save(is_draft=false) → Java 发布

---

## 3. 两种创作逻辑能力矩阵

| 能力 | 页面先行 | 数据先行 | 证据 |
|---|---|---|---|
| 起点: 页面/设计输入 | **已实现** (read_page_context 返回现有页面; agent_context.page_metadata_id 注入加载已有页) | **已实现** (从业务问题/用数需求出发, discover_data_context) | turn_provider/plugin.py:514-560; SKILL.md workflows/create.md, edit.md |
| 用数需求提取 | **部分实现** (从页面组件反推, 但 SKILL.md 依赖模型理解而非工具自动提取) | **已实现** (discover_data_context 查业务域/指标/维度) | SKILL.md workflows/data-analysis.md; platform_mcp.py:221 |
| 数据发现/匹配 | **已实现** (discover_data_context) | **已实现** (discover_data_context) | platform_mcp.py:221-224 |
| 查询验真 | **已实现** (query_data 真实 DQE POST /dsl/execute) | **已实现** (同) | dqe_http.py:68; platform_mcp.py:227-229 |
| 源和字段映射 | **已实现** (compose sources: source_id→resultRef; compose() 组装 dataSources) | **已实现** (同) | referenced.py:54-117 (compose); referenced.py:65 (sources 映射) |
| 修改既有页面 | **已实现** (edit_page 多操作批; add_result_component 引用新 resultRef 重建组件) | **已实现** (同, 数据先行生成后可继续 edit) | platform_mcp.py:237-239; referenced.py:120-130 (edit) |
| 预览/保存 | **已实现** (page_metadata_emit_preview 双风格; saver.save is_draft=true) | **已实现** (同) | platform_mcp.py:281-298; drafts.py:51 |
| 换源 (保留布局换数据源) | **已实现** (edit.md:9 add_result_component + remove_component dependsOn 新增; 保留 section/layout) | **已实现** (同机制) | workflows/edit.md:9, 15; container_building.py:65 remove_component |
| 补字段 (原页面补查) | **已实现** (edit_page add_result_component 引用新 resultRef 到现有 section) | **已实现** (同) | workflows/edit.md:17; referenced.py:25-27 RESULT_OPERATION |
| 纯标题/布局修改不重新查数 | **已实现** (edit.md:13 "样式、标题、列宽: 直接生成受控 operations, 不调用发现或业务查询") | N/A | workflows/edit.md:13; operation_batch 处理 set_title 等不触发 query |
| 数据不足保留页面意图并报告缺口 | **部分实现** (compose 返回 partial + structure-missing 占位组件; SKILL.md 要求保留未完成状态) | **部分实现** (同) | referenced.py:109 (structure-missing 占位); referenced.py:114-116 (partial 状态) |
| 跨轮次同一工作副本 | **已实现** (turn_id 稳定 per-session; state 文件 per-turn; saver.verify_current 核对 Java 基线) | **已实现** (同) | turn_provider/plugin.py:57 (turn_id 稳定); drafts.py:20-49 (verify_current) |
| resultRef 跨轮次复用 | **已实现** (QueryResults.read by result_ref; RESULT_VERSION_STALE 校验; 但 result_ref 跨轮次被 RESULT_SCOPE_MISMATCH 阻止 — 见 §9) | **已实现** (同) | results.py:285 (read); errors/RESULT_VERSION_STALE.json; data/results.py:135-139 (RESULT_SCOPE_MISMATCH) |
| 原页面换源 vs 重建整页 | **支持原页面换源** (edit add_result_component + remove_component, 不需重建整页) | **支持** (同) | workflows/edit.md:9, 15, 17 |

**结论**: 两种创作逻辑在工具层**共享同一套工具** (15 个 MCP 工具), 差异在 SKILL.md workflows 的路由指引。工具能力对称支持两种路径的相互接续。

---

## 4. Skill/脚本/产品事实/Relay 接线归属

### 4.1 归属表

| 内容 | 归属 | 证据 |
|---|---|---|
| SKILL.md (创作方法论, 任务路由, 页面 Schema 6.54 声明) | **Relay 本地维护** (多次 BUG2026101900970 修改) | git log; SKILL.md:11 |
| workflows/ (create, edit, data-analysis, layout-authoring, parameters) | **Relay 本地维护** | git log |
| references/ (tools, execution, errors, examples, scenarios, finance-data-source-pitfalls, reading-design) | **Relay 本地维护** | git log |
| designs/ (layout-standards-frozen-design, mc-side-requirements, skill-side-implementation-plan) | **Relay 本地设计文档** (本仓工作产物) | git status (未跟踪) |
| mc-content/ (hand-maintained 副本, 含 scripts/, knowledge/, protocols/, product-contracts/, runtime/, errors/) | **MC 产品仓维护, 本仓手工副本** (mc-content.version.json + HANDOFF.md 说明整包替换; verify_package 启动校验) | mc-content/version.json; mc-content/HANDOFF.md |
| mc-content/scripts/*.py (mc_resources, mc_layout_compiler, mc_inspection, mc_schema_selection, mc_content) | **MC 产品仓维护** | mc-content/scripts/ |
| mc-content/scripts/*.mjs (inspect-page, read-knowledge, upgrade-page) | **MC 产品仓维护** (Node 脚本) | mc-content/scripts/ |
| scripts/tools.py (tool_mc_query/compile/inspect Skill 侧包装) | **Relay 本地维护** (薄 Adapter, 不复制 MC 技术真源) | scripts/tools.py:1-9 docstring |
| MCP 服务代码 (metriccanvas_authoring/) | **MC 产品仓维护** (bundle.json 声明 toolServices) | bundle.json:25-29 |
| adapters/relay/ (context_identity, content_baselines, iam_token, lifecycle_spool, env_identity, file_based_turns) | **Relay 扩展** (适配 Relay 的身份/状态/预览桥) | adapters/relay/ |
| adapters/firstparty/ (dqe_http, lifecycle_http, dataset_metadata_http, publish_unavailable, data_context_http) | **MC 产品仓维护** (Java/HTTP 适配) | adapters/firstparty/ |
| authoring_turn_provider plugin | **Relay 本地扩展** | .relay/plugins/authoring_turn_provider/ |
| authoring_preview_bridge plugin | **Relay 本地扩展** | .relay/plugins/authoring_preview_bridge/ |
| mcp_configs/metriccanvas-platform-content.json | **Relay 本地配置** | .relay/mcp_configs/ |
| template_js_config.json (unified_analysis_report) | **Relay 本地配置** | .relay/config/ |

### 4.2 多处重复维护的规则
1. **turn_id 派生**: turn_provider/plugin.py:57 与 preview_bridge/plugin.py:106 都有 `sha256(session_id)[:12]` — **重复实现** (需同步)。
2. **_depublish_document**: turn_provider/plugin.py:302-423 与 lifecycle_http.py (注释明确 "mirrors lifecycle_http._evaluate_window") — **双实现需一致**。
3. **_emit_preview_card / _emit_report_card**: preview_bridge/plugin.py:245-287 (pangu 风格) 与 platform_mcp.py:89-139 (data-agent 风格) — **两种风格分散在两处**。
4. **env 风格判读**: preview_bridge/plugin.py:63-75 与 platform_mcp.py:181 (_binding_env()) — **两处独立判读**。
5. **tool_mc_query/compile/inspect**: MCP 通道 (platform_mcp.py) 与 Skill 通道 (scripts/tools.py) — **重复注册同名工具** (见接缝表)。

---

## 5. 当前真实接缝表

| 能力/接口 | 调用方 | 提供方 | 实际入口 | 模型输入 | 程序输入 | 输出通道 | 状态所有者 | 副作用 | 版本/作用域要求 | 证据位置 | 验证层 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| context_ref 注入 | Relay (turn_provider plugin) | MCP 工具 (context_ref 参数) | turn_provider/plugin.py:608-610 `args["context_ref"]=turn_id` | 模型不可见 (程序注入) | turn_id=sha256(session_id)[:12] | MCP tool call args | turn_provider plugin (写状态文件) | 写 relay_authoring_state_{turn_id}.json | per-session 稳定 | S | S |
| 身份 (actor_id) | MCP 工具 (ContextIdentityPort) | Relay 状态文件 (binding.actorId) | turn_provider/plugin.py:528-549 写 binding | 不注入模型 (FastMCP 拒绝未知 kwargs) | agent_context.user_id → binding.actorId | 状态文件 | turn_provider plugin | 无 (读 agent_context) | per-user 动态 | S | S |
| 已有页面加载 | turn_provider plugin | Java (lifecycle collection) | turn_provider/plugin.py:201 `_load_existing_page` GET {base_url}/{page_metadata_id} | 不注入模型 | agent_context.page_metadata_id | Java HTTP 回执 | Java | GET 页面定义 | page_metadata_id 必须存在 | S | S |
| 页面基线 (workVersion/ref) | MCP read_page_context | Java (lifecycle current_match) | drafts.py:31 `service.current_match` | context_ref | Java 当前资源 | Java HTTP 回执 | Java | GET 当前资源 | ref 必须匹配 Java | S | S |
| 基线核对 (CURRENT_PAGE_STALE) | DraftSaver.verify_current | Java + 本地 sha256 | drafts.py:44-49 | 无 | Java doc hash vs local doc hash | require 失败抛 ContentBaselineError | Java (权威) | 无 | hash 必须相等 | S | S |
| 查询 (query_data) | MCP query_data | DqeHttpExecutionPort | dqe_http.py:91 POST {base_url}/dsl/execute | request (QUERY_SCHEMA) 或 result_ref | actor_id, workspace_id (binding) | DQE HTTP 回执 | Java DQE | POST 真实查询 | 授权 + planConfirmed | S | S |
| 查询证据 (resultRef) | MCP query_data (read) / compose (resolve_sources) | QueryResults.read | results.py:285 | result_ref | prepared.binding | 模型可见 (bounded evidence) | 进程内 state store | 读缓存 | resultRef 跨轮次复用受 RESULT_SCOPE_MISMATCH 限制 (turnId 是 SCOPE_KEY) | S | S |
| 草稿保存 (compose/edit) | MCP mutate | DraftSaver.save → Java | drafts.py:84 `service.save` POST | request (COMPOSE/EDIT_SCHEMA), expected_version | binding, is_draft=true (默认) | Java HTTP 回执 | Java (权威) | POST 保存 (is_draft=true) | SAVE_RECONCILIATION_REQUIRED 锁死 unknown/pending/rejected | S | S |
| 冻结提交 (SUBMISSION_IMMUTABLE) | DraftSaver | 进程内 store compare_and_swap | drafts.py:75-78 | 无 | binding scope + operation_id | store 回执 | 进程内 store | 锁定单次提交 | scope + commandSha256 一致 | S | S |
| 发布 (publish_page) | MCP publish | DraftSaver.save(is_draft=false) → Java | platform_authoring.py:273-276 | context_ref, page_id?, keep_dimension_values, page_url? | binding, is_draft=false | Java HTTP 回执 | Java | POST 发布 | saveStatus 不在 unknown/pending/rejected | S | S |
| 预览 (page_metadata_emit_preview) | MCP preview | FilePreviewAdapter + env 分支 | platform_mcp.py:281-298 | context_ref, artifact_ref, report_title?, subscribe_question? | env (binding), preview 文件 | ToolResult.content (modelSummary); data-agent 风格含 gzip+base64 previewJson | 预览文件 (per-turn) | 写 relay_authoring_preview_{turn_id}.json | artifact_ref 必须匹配 | S | S |
| 预览卡片注入 | preview_bridge plugin | Relay (on_response_final) | preview_bridge/plugin.py:332-413 | 无 | session metadata (缓存 previewJson) | response.content 替换/追加 | session metadata | 修改最终响应文本 | {{RESPONSE_START}} + 卡片标记 | S | S |
| {{PAGE_METADATA_PREVIEW_JSON}} 替换 | preview_bridge plugin | Relay (on_response_transform) | preview_bridge/plugin.py:194-225 | 无 | session metadata | response.text 替换占位符 | session metadata | 修改流式响应 | 占位符存在 + pangu 风格 (data-agent 风格跳过) | S | S |
| aiSummary body | MCP submit_ai_summary_body | 预览文件 (per-turn) | platform_mcp.py:267-278 | context_ref, component_id, body | 写 aiSummary body 文件 | 无 (仅写文件) | 预览文件 | 写 relay_authoring_summary_body_{turn_id}.json | body 生命周期: 预览注入, 保存时剥离 | S | S |
| 布局编译 (tool_mc_compile) | MCP tool_mc_compile | mc-content/scripts/mc_layout_compiler | platform_mcp.py:404-428 | envelope (templateRef+plan+userRequirements) | METRICCANVAS_LAYOUT_CONTENT_ROOT | ToolResult.content (json) | mc-content (静态) | 无 (只读编译) | plan 不得含 description/dateFilters/pagedJoins | S | S |
| 装配检查 (tool_mc_inspect) | MCP tool_mc_inspect | mc-content/scripts/mc_inspection | platform_mcp.py:431-489 | reference, inspection_spec | 预览文件 (relay_authoring_preview_turn-*.json) | ToolResult.content (json) | 预览文件 + mc-content | 无 (读 + 检查) | reference 匹配 preview 文件 artifactRef | S | S |
| tool_mc_query/compile/inspect **名称冲突** | MCP (platform_mcp.py) + Skill (scripts/tools.py) | 两个提供方 | platform_mcp.py:371/404/431 + scripts/tools.py:110/139/174 | 相同参数 Schema | 不同实现 (MCP 调 mc_content.py; Skill 调 mc_resources) | 相同工具名 | **未在源码中明确解析优先级** | 无 (只读) | **Relay 工具解析顺序未验证** | S | S (not_run R) |
| structured_content 消费 | Relay Core | MCP 工具返回 | platform_mcp.py:170,194,207 | 模型只看 content=modelSummary | structured_content={ok, modelSummary, artifactEnvelope} | structured_content 给程序; content 给模型 | MCP 返回 | 无 | 模型通道只收 modelSummary | S | S |
| 工作副本 | MCP mutate/query/read | SQLite (METRICCANVAS_WORK_DB) | work/state.py:51-108; adapters/storage/platform_state.py:13-34 | 无 | scope key (含 turnId) | SQLite 记录 | SQLite | 读写工作记录 | 按 scope 键, 跨 Java revision 保留 | S | S |

---

## 6. 关键源码定位

### 6.1 Skill 加载链
| 项 | 位置 | 证据层 |
|---|---|---|
| SkillLoader | src/relay/domain/skill/service/skill_loader.py:712 | S |
| project skills dir 解析 | skill_loader.py:36-70 (优先 .skills/, 回退 .relay/skills/) | S |
| frontmatter 解析 (name/description/allowed-tools/metadata.mcp_servers) | skill_loader.py:680-779 | S |
| _load_skill_tools (scripts/tools.py 自动注册) | skill_loader.py:781-841 | S |
| tool_ 前缀或 __relay_tool__ 标记或 docstring 含 Args: | skill_loader.py:824-828 | S |
| Skill model (allowed_tools, mcp_servers) | src/relay/domain/skill/model/skill.py:37,50,84-86 | S |
| allowed_tools 注入 system prompt | skill_play_tool.py:491-501 | S |
| 权限执行 (filter_tools 白名单) | agent_factory.py:653-681 (agent-build 时过滤, 非每次调用拦截) | S |
| MCP 服务独立加载 | MCPLoader mcp_loader.py:288 扫描 .relay/mcp_configs/ | S |

### 6.2 MCP 服务入口与工具注册
| 项 | 位置 | 证据层 |
|---|---|---|
| MCP config | workspace/agents/agent_workspace/.relay/mcp_configs/metriccanvas-platform-content.json | C |
| command | `python -X utf8 -c "...from metriccanvas_authoring.platform_server import main; main()" stdio` | C |
| cwd (部署) | /opt/cloud/CDIRelayAgentService/... (非本仓本地路径) | C |
| timeout | 300s | C |
| active | true, scope=project | C |
| 生成模式 | **temp_subprocess** (每次调用生成临时子进程) | mcp_manager.py:105,415 | S |
| tool/server.py | tool/server.py:3 (委托 compat.server — 但该文件物理不存在, find 无结果) | S |
| platform_server.py | platform_server.py:6-12 (委托 entrypoints.mcp.platform_server) | S |
| create_production_platform_server | bootstrap/platform.py:29 -> assemble(load_adapters()) | S |
| @mcp.tool 注册 (15 个) | entrypoints/mcp/platform_mcp.py:214-489 | S |
| call() 统一包装 | platform_mcp.py:157-207 | S |
| current_context_ref.set (per-call) | platform_mcp.py:166 | S |

### 6.3 Application 实现
| 项 | 位置 | 证据层 |
|---|---|---|
| PlatformAuthoring 类 | pages/platform_authoring.py | S |
| discover | platform_authoring.py:202-214 | S |
| query | platform_authoring.py:218-223 (execute XOR read) | S |
| read | platform_authoring.py:226-246 | S |
| mutate (compose/edit) | platform_authoring.py:318-371 | S |
| publish | platform_authoring.py:250-297 | S |
| _apply_edit_stage | platform_authoring.py:392-405 | S |
| _resolve_sources (compose) | platform_authoring.py:407-415 | S |

### 6.4 保存链
| 项 | 位置 | 证据层 |
|---|---|---|
| DraftSaver.save | assets/drafts.py:51-99 | S |
| is_draft 默认 True (compose/edit) | drafts.py:51 签名; platform_authoring.py:350-351 未覆写 | S |
| is_draft=False (publish) | platform_authoring.py:275 | S |
| verify_current (Java 基线核对) | drafts.py:20-49 (sha256 对比 java_hash vs local_hash) | S |
| CURRENT_PAGE_STALE 触发 | drafts.py:49 | S |
| SAVE_RECONCILIATION_REQUIRED 触发 | platform_authoring.py:230 (saveStatus in {unknown,pending,rejected}) | S |
| 冻结提交 (compare_and_swap submission) | drafts.py:75-78 | S |
| SUBMISSION_IMMUTABLE | drafts.py:78 | S |

### 6.5 查询链
| 项 | 位置 | 证据层 |
|---|---|---|
| QueryResults.execute | data/results.py:192 | S |
| QueryResults.read (result_ref 复用) | data/results.py:285 | S |
| QUERY_SCHEMA | data/results.py:28-30 | S |
| DqeHttpExecutionPort.execute | adapters/firstparty/dqe_http.py:68 (POST {base_url}/dsl/execute) | S |
| 查询授权 (authorize) | data/results.py:38-45 (ANALYSIS_PLAN_NOT_CONFIRMED / MODEL_EVIDENCE_UNAVAILABLE) | S |
| RESULT_SCOPE_MISMATCH (result_ref 跨轮次阻止) | data/results.py:135-139 (turnId 是 SCOPE_KEY) | S |

### 6.6 Relay 端插件 (集成桥)
| 项 | 位置 | 证据层 |
|---|---|---|
| authoring_turn_provider | workspace/agents/agent_workspace/.relay/plugins/authoring_turn_provider/plugin.py | S |
| authoring_preview_bridge | workspace/agents/agent_workspace/.relay/plugins/authoring_preview_bridge/plugin.py | S |
| on_tool_execute_before (注入 context_ref) | turn_provider/plugin.py:485-614 | S |
| turn_id 派生 (sha256(session_id)[:12]) | turn_provider/plugin.py:57 | S |
| actor_id 来源 (agent_context.user_id 回退 env) | turn_provider/plugin.py:495-496 | S |
| 已有页面加载 (_load_existing_page) | turn_provider/plugin.py:201-281 | S |
| _depublish_document (发布→草稿) | turn_provider/plugin.py:302-423 | S |
| on_tool_execute_after (缓存 previewJson) | preview_bridge/plugin.py:144-191 | S |
| on_response_transform ({{PAGE_METADATA_PREVIEW_JSON}} 替换) | preview_bridge/plugin.py:194-225 | S |
| on_response_final (兜底注入) | preview_bridge/plugin.py:332-413 | S |
| {{RESPONSE_START}} 标记 | preview_bridge/plugin.py:290 | S |
| 状态文件路径 | turn_provider/plugin.py:88 (relay_authoring_state_{turn_id}.json) | S |
| 预览文件路径 | preview_bridge/plugin.py:90-100 (relay_authoring_preview_{turn_id}.json) | S |
| IAM token (CCMS→IAM, TitanScc 解密) | turn_provider/plugin.py:104-198 | S (脱敏: 仅逻辑, 无凭据) |

### 6.7 Schema 常量
| 项 | 位置 | 证据层 |
|---|---|---|
| QUERY_SCHEMA | data/results.py:28-30 (obj: question, dataContextVersion, requests[1..6], reason) | S |
| COMPOSE_SCHEMA | pages/referenced.py:23-24 (title, description, layout, sources, sections[1..12]) | S |
| EDIT_RESULT_SCHEMA | pages/referenced.py:28-29 (EDIT_SCHEMA + SECTION_OPERATIONS + RESULT_OPERATION) | S |
| DATA_REQUEST | data/results.py:20 (从 contracts/authored/page-structure-plan.schema.json 加载) | S |
| ParameterTextChoice | platform_mcp.py:142-148 (Pydantic model) | S |

### 6.8 可用操作类型闭集
| 类别 | 操作 | 证据 |
|---|---|---|
| section | add_section, move_section, remove_section | section_editing.py:8-12 |
| component | set_title, set_component_layout, set_properties, set_series_label, set_metric_row, set_table_column, move_component, set_page_layout, change_component_type | component_editing.py:179-189 OPERATION_HANDLERS |
| container | add_composite_card, add_tab_container, remove_component | container_building.py:71 CONTAINER_HANDLERS |
| result | add_result_component | referenced.py:25-27 RESULT_OPERATION |
| aiSummary | add_ai_summary (特殊路径, 排批末) | page_editing.py:19-20; container_building.py:57 |
| text | (TEXT_MAP_HANDLERS — add_text 等) | page_editing.py:13 |
| interaction | (INTERACTION_HANDLERS) | page_editing.py:13 |

---

## 7. 实际工具契约清单 (tool-contracts)

> 完整 JSON Schema 未截断。取得方式: 源码静态分析 entrypoints/mcp/platform_mcp.py (FastMCP @mcp.tool 装饰器) + schema 常量定义。本仓未运行 MCP 服务进程, 故 R 层=not_run; Schema 来自源码内联的 WithJsonSchema 注解 + data/results.py / pages/referenced.py 的 schema 常量。

### 工具总表

| # | 名称 | kind | 注册点 | dispatch | 副作用 | mutation | 参数 |
|---|---|---|---|---|---|---|---|
| 1 | read_page_context | public-MC | platform_mcp.py:215 | application.read | 无 (verify_current) | false | context_ref, target_component_id?, use_selection?, offset, limit, cursor? |
| 2 | discover_data_context | public-MC | platform_mcp.py:221 | application.discover | 无 | false | context_ref, query, limit, detail_refs? |
| 3 | query_data | public-MC | platform_mcp.py:227 | application.query | **EXECUTES REAL DQE** (POST /dsl/execute) | false | context_ref, request?(QUERY_SCHEMA), result_ref? (XOR) |
| 4 | compose_page | public-MC | platform_mcp.py:232 | application.mutate('compose') | **SAVES DRAFT** (is_draft=true) | true | context_ref, request(COMPOSE_SCHEMA), expected_version |
| 5 | edit_page | public-MC | platform_mcp.py:237 | application.mutate('edit') | **SAVES DRAFT** (is_draft=true) | true | context_ref, page_id, request(EDIT_RESULT_SCHEMA), expected_version |
| 6 | publish_page | public-MC | platform_mcp.py:242 | application.publish | **PUBLISHES** (is_draft=false) | true | context_ref, keep_dimension_values, page_id?, page_url? |
| 7 | list_existing_page_urls | public-MC | platform_mcp.py:258 | application.list_page_urls | 无 | false | context_ref |
| 8 | submit_ai_summary_body | public-MC | platform_mcp.py:267 | application.submit_ai_summary_body | 写 aiSummary body 文件 | false | context_ref, component_id, body |
| 9 | page_metadata_emit_preview | **Relay-extension** | platform_mcp.py:281 | application.preview | 写 preview 文件 | false | context_ref, artifact_ref, report_title?, subscribe_question? |
| 10 | extract_page_parameters | public-MC | platform_mcp.py:301 | application.parameters.extract | 无 | false | context_ref, artifact_ref? |
| 11 | apply_page_parameter_selection | public-MC | platform_mcp.py:306 | application.parameters.apply | 无 (准备 template artifact) | false | context_ref, extraction_ref, selected_ids, text_choices? |
| 12 | resolve_page_parameters | public-MC | platform_mcp.py:315 | application.parameters.resolve | 无 | false | context_ref, values, artifact_ref? |
| 13 | tool_mc_query | public-MC (mc-content bridge) | platform_mcp.py:371 | mc_resources.query_content | 无 | false | topic, key, options? |
| 14 | tool_mc_compile | public-MC (mc-content bridge) | platform_mcp.py:404 | mc_layout_compiler.compile_layout | 无 | false | envelope |
| 15 | tool_mc_inspect | public-MC (mc-content bridge) | platform_mcp.py:431 | mc_inspection.inspect_assembly | 无 (读 preview 文件) | false | reference, inspection_spec |

### 完整输入 Schema (JSON)

```json
{
  "auditIdentity": {
    "repo": "D:/Code/0TMG/AI辅助研发/CDIRelayAgentService",
    "branch": "feature_2026090792115_build_metadata",
    "commit": "663da7ea7f4a662f0e4bec678b7feea02951dc97",
    "dirtyWorkspace": true,
    "dirtyFiles": 9,
    "checkedAt": "2026-11-02",
    "checkLayer": "S=源码 + C=配置; R=not_run; T=not_run; P=not_run"
  },
  "bundleFacts": {
    "bundleVersion": "0.3.1",
    "productContractVersion": "1.0.0-rc.4",
    "authoringContractVersion": "0.3.1",
    "pageSchemaVersion": {
      "runtimeValue": "6.54",
      "source": "contract-lock.json:8 (load_bundle_info() reads bundle.json contracts.productLock -> contract-lock.json)",
      "evidence": "bundle_info.py:21; contract-lock.json:8"
    },
    "staleLocks": [
      {"file": "bundle.lock.json:3", "value": "6.11", "note": "stale lock file; not read by load_bundle_info()"},
      {"file": "contract-snapshot/manifest.json:3", "value": "6.11", "note": "snapshot copy; not the runtime source"},
      {"file": "mc-content.version.json:7978", "value": "6.77", "note": "mc-content subtree; reported by tool_mc_query, contradicts runtime 6.54"}
    ],
    "toolRuntime": "python >=3.12, stdio transport",
    "toolEntrypoint": "tool/server.py -> entrypoints/compat/server.py -> entrypoints/mcp/platform_server.py -> create_production_platform_server -> bootstrap.platform.assemble(load_adapters())",
    "mcpConfig": {
      "file": "workspace/agents/agent_workspace/.relay/mcp_configs/metriccanvas-platform-content.json",
      "command": "python -X utf8 -c '...from metriccanvas_authoring.platform_server import main; main()' stdio",
      "cwd": "/opt/cloud/CDIRelayAgentService/workspace/agents/agent_workspace/local_mcp_servers/metriccanvas_platform_content",
      "timeout": 300,
      "active": true,
      "scope": "project",
      "spawnMode": "temp_subprocess (每次工具调用生成临时子进程)",
      "envKeys": ["METRICCANVAS_AUTHORING_STATE_FILE", "METRICCANVAS_AUTHORING_PREVIEW_FILE", "METRICCANVAS_AUTHORING_AI_SUMMARY_BODY_FILE", "METRICCANVAS_WORK_DB", "METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG", "METRICCANVAS_LAYOUT_CONTENT_ROOT"],
      "note": "env paths use /opt/cloud/CDIRelayAgentService/... (deployment path, not local repo path)"
    }
  },
  "tools": [
    {
      "name": "read_page_context",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:215 (@mcp.tool)",
      "dispatch": "application.read(context_ref, ...)",
      "implementation": "platform_authoring.py:226 PlatformAuthoring.read",
      "sideEffect": "none (read-only; verifies Java current baseline via verify_current)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "target_component_id": {"type": "string", "nullable": true},
          "use_selection": {"type": "boolean", "default": false},
          "offset": {"type": "integer", "minimum": 0, "default": 0},
          "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 20},
          "cursor": {"type": "string", "nullable": true}
        },
        "required": ["context_ref"]
      },
      "programInjectedContext": "context_ref (== turn_id, force-injected by authoring_turn_provider plugin on_tool_execute_before)",
      "modelOutput": "modelSummary (pageId, workVersion, ref, saveStatus, busy, documentSha256, parameters, projected component configs)",
      "programOutput": "{ok, modelSummary, artifactEnvelope: null}"
    },
    {
      "name": "discover_data_context",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:221 (@mcp.tool)",
      "dispatch": "application.discover(context_ref, query, limit, detail_refs)",
      "implementation": "platform_authoring.py:202 PlatformAuthoring.discover",
      "sideEffect": "none (read-only discovery)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "query": {"type": "string", "default": ""},
          "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 10},
          "detail_refs": {"type": "array", "items": {"type": "string"}, "nullable": true}
        },
        "required": ["context_ref"]
      },
      "modelOutput": "modelSummary (ok, dataContextVersion, businessDomains, matches, issues)"
    },
    {
      "name": "query_data",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:227 (@mcp.tool)",
      "dispatch": "application.query(context_ref, request, result_ref)",
      "implementation": "platform_authoring.py:218 PlatformAuthoring.query -> QueryResults.execute XOR QueryResults.read",
      "sideEffect": "EXECUTES REAL DQE QUERY via DqeHttpExecutionPort (POST {base_url}/dsl/execute) when request given; reads cached evidence when result_ref given",
      "inputSchema": {
        "$comment": "Two-input XOR: exactly one of request/result_ref.",
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "request": {"$ref": "#/$defs/QUERY_SCHEMA", "nullable": true},
          "result_ref": {"type": "string", "nullable": true}
        },
        "required": ["context_ref"]
      },
      "$defs": {
        "QUERY_SCHEMA": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "question": {"type": "string"},
            "dataContextVersion": {"type": "string"},
            "requests": {"type": "array", "minItems": 1, "maxItems": 6, "items": {"$ref": "#/$defs/DATA_REQUEST"}},
            "reason": {"type": "string"}
          },
          "required": ["question", "dataContextVersion", "requests"]
        },
        "DATA_REQUEST": {"$comment": "Loaded from contracts/authored/page-structure-plan.schema.json oneOf[0].properties.dataRequests.items at import time (results.py:20). Source of truth is the authored contract file."}
      },
      "modelOutput": "modelSummary (bounded evidence: query result rows within authorized limit; resultRef for reuse)",
      "evidence": "platform_mcp.py:227-229; platform_authoring.py:218-223; data/results.py:28-30,192; adapters/firstparty/dqe_http.py:68-143 (POST /dsl/execute)"
    },
    {
      "name": "compose_page",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:232 (@mcp.tool)",
      "dispatch": "application.mutate('compose', context_ref, request, expected_version)",
      "implementation": "platform_authoring.py:318 PlatformAuthoring.mutate -> compose() in pages/referenced.py:54",
      "sideEffect": "SAVES DRAFT INTERNALLY (is_draft=true, default); calls saver.save -> Lifecycle.save -> Java HTTP",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "request": {"$ref": "#/$defs/COMPOSE_SCHEMA"},
          "expected_version": {"type": "integer", "minimum": 0, "default": 0}
        },
        "required": ["context_ref", "request"]
      },
      "$defs": {
        "COMPOSE_SCHEMA": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "title": {"type": "string"},
            "description": {"type": "string"},
            "layout": {"type": "string", "enum": ["report", "dashboard"]},
            "sources": {"type": "object", "propertyNames": {"type": "string"}, "maxProperties": 6, "additionalProperties": {"type": "string"}, "$comment": "source_id -> resultRef string"},
            "sections": {"type": "array", "minItems": 1, "maxItems": 12, "items": {"$ref": "#/$defs/RESULT_SECTION"}}
          },
          "required": ["title", "sources", "sections"]
        },
        "RESULT_SECTION": {"$comment": "deepcopy of SECTION from page_structure; required=[id,pattern,blocks]. Full sub-schema in pages/composition/page_structure.py SECTION constant."}
      },
      "modelOutput": "modelSummary (status, operations[applied/failed/skipped], saveStatus, workVersion, operationId, artifactRef)",
      "evidence": "platform_mcp.py:232-234; platform_authoring.py:318-371, 350-351; pages/referenced.py:23-24, 54-117; assets/drafts.py:51"
    },
    {
      "name": "edit_page",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:237 (@mcp.tool)",
      "dispatch": "application.mutate('edit', context_ref, request, expected_version, page_id=page_id)",
      "implementation": "platform_authoring.py:318 PlatformAuthoring.mutate -> edit() in pages/referenced.py:120",
      "sideEffect": "SAVES DRAFT INTERNALLY (is_draft=true, default); calls saver.save -> Java HTTP",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "page_id": {"type": "string", "minLength": 1},
          "request": {"$ref": "#/$defs/EDIT_RESULT_SCHEMA"},
          "expected_version": {"type": "integer", "minimum": 0}
        },
        "required": ["context_ref", "page_id", "request", "expected_version"]
      },
      "$defs": {
        "EDIT_RESULT_SCHEMA": {
          "$comment": "EDIT_SCHEMA + SECTION_OPERATIONS + RESULT_OPERATION. operations.items.oneOf is the union.",
          "type": "object",
          "properties": {
            "operations": {
              "type": "array",
              "items": {
                "oneOf": [
                  {"$ref": "#/$defs/SECTION_OPERATIONS"},
                  {"$ref": "#/$defs/RESULT_OPERATION"},
                  {"$ref": "#/$defs/COMPONENT_OPERATIONS"},
                  {"$ref": "#/$defs/TEXT_OPERATIONS"},
                  {"$ref": "#/$defs/INTERACTION_OPERATIONS"},
                  {"$ref": "#/$defs/CONTAINER_OPERATIONS"}
                ]
              }
            }
          },
          "required": ["operations"]
        },
        "RESULT_OPERATION": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "type": {"const": "add_result_component"},
            "sectionId": {"type": "string"},
            "resultRef": {"type": "string"},
            "block": {"$ref": "#/$defs/DATA_BLOCK"},
            "dependsOn": {"type": "array", "items": {"type": "string"}}
          },
          "required": ["id", "type", "sectionId", "resultRef", "block"]
        }
      },
      "availableOperations": {
        "section": ["add_section", "move_section", "remove_section"],
        "component": ["set_title", "set_component_layout", "set_properties", "set_series_label", "set_metric_row", "set_table_column", "move_component", "set_page_layout", "change_component_type"],
        "container": ["add_composite_card", "add_tab_container", "remove_component"],
        "result": ["add_result_component"],
        "aiSummary": ["add_ai_summary"],
        "text": ["(TEXT_MAP_HANDLERS — add_text etc.)"],
        "interaction": ["(INTERACTION_HANDLERS)"]
      },
      "modelOutput": "modelSummary (status, operations[applied/failed/skipped], saveStatus, workVersion, operationId, artifactRef)",
      "evidence": "platform_mcp.py:237-239; platform_authoring.py:318-371, 392-405; pages/referenced.py:120-130"
    },
    {
      "name": "publish_page",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:242 (@mcp.tool)",
      "dispatch": "application.publish(context_ref, page_id=?, keep_dimension_values=?, page_url=?)",
      "implementation": "platform_authoring.py:250 PlatformAuthoring.publish -> saver.save(is_draft=false)",
      "sideEffect": "PUBLISHES PAGE (is_draft=false); calls saver.save -> Java HTTP; trims dim_value_list when keep_dimension_values=False",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "keep_dimension_values": {"type": "boolean", "default": true},
          "page_id": {"type": "string", "nullable": true},
          "page_url": {"type": "string", "nullable": true, "maxLength": 512}
        },
        "required": ["context_ref"]
      },
      "modelOutput": "modelSummary (status, saveStatus, operationId, workVersion, draftId, ref, revisionNumber)"
    },
    {
      "name": "list_existing_page_urls",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:258 (@mcp.tool)",
      "dispatch": "application.list_page_urls(context_ref)",
      "sideEffect": "none (read-only uniqueness check)",
      "inputSchema": {
        "type": "object",
        "properties": {"context_ref": {"type": "string"}},
        "required": ["context_ref"]
      },
      "modelOutput": "modelSummary (list of occupied page_url values)"
    },
    {
      "name": "submit_ai_summary_body",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:267 (@mcp.tool)",
      "dispatch": "application.submit_ai_summary_body(context_ref, component_id, body)",
      "sideEffect": "writes per-turn aiSummary body file (preview runtime artifact; stripped from persisted definition on save/publish)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "component_id": {"type": "string", "minLength": 1, "maxLength": 128},
          "body": {"type": "string", "maxLength": 200000}
        },
        "required": ["context_ref", "component_id", "body"]
      }
    },
    {
      "name": "page_metadata_emit_preview",
      "kind": "Relay-extension (dual-path: pangu-entrance card OR data-agent report card)",
      "registrationPoint": "platform_mcp.py:281 (@mcp.tool)",
      "dispatch": "application.preview(context_ref, artifact_ref, report_title=?, subscribe_question=?, preview=True)",
      "implementation": "platform_authoring.py (preview method); call() wrapper branches on _binding_env()",
      "sideEffect": "writes per-turn preview file (relay_authoring_preview_{turn_id}.json) via FilePreviewAdapter; reads it back for data-agent card",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "artifact_ref": {"type": "string"},
          "report_title": {"type": "string", "nullable": true, "maxLength": 128},
          "subscribe_question": {"type": "string", "nullable": true, "maxLength": 256}
        },
        "required": ["context_ref", "artifact_ref"]
      },
      "modelOutput": "modelSummary — pangu style: {status:ready, artifactRef, ref}; data-agent style: full report card {data_type:template, content:{watermark_no, task_summary, template_id, query_params, subscribe_params, card_detail_config, metaData(gzip+base64), metaDataEncoding, show_subscribe}}",
      "note": "Frontend marker handling {{RESPONSE_START}}/{{PAGE_METADATA_PREVIEW_JSON}} is in Relay plugin authoring_preview_bridge/plugin.py, NOT in MCP server"
    },
    {
      "name": "extract_page_parameters",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:301 (@mcp.tool)",
      "dispatch": "application.parameters.extract(context_ref, artifact_ref, parameter=True)",
      "sideEffect": "none (extracts verified parameter choices from work or scoped artifact)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "artifact_ref": {"type": "string", "nullable": true}
        },
        "required": ["context_ref"]
      }
    },
    {
      "name": "apply_page_parameter_selection",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:306 (@mcp.tool)",
      "dispatch": "application.parameters.apply(context_ref, extraction_ref, selected_ids, text_choices, parameter=True)",
      "sideEffect": "prepares immutable template artifact; does NOT save or publish",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "extraction_ref": {"type": "string"},
          "selected_ids": {"type": "array", "items": {"type": "string"}, "maxItems": 100},
          "text_choices": {"type": "array", "items": {"$ref": "#/$defs/ParameterTextChoice"}, "maxItems": 200, "nullable": true}
        },
        "required": ["context_ref", "extraction_ref", "selected_ids"]
      },
      "$defs": {
        "ParameterTextChoice": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "slot_id": {"type": "string", "minLength": 1, "maxLength": 128},
            "kind": {"type": "string", "enum": ["parameter", "literal"]},
            "candidate_id": {"type": "string", "minLength": 1, "maxLength": 128, "nullable": true},
            "text": {"type": "string", "maxLength": 4096, "nullable": true}
          },
          "required": ["slot_id", "kind"]
        }
      }
    },
    {
      "name": "resolve_page_parameters",
      "kind": "public-MC-product",
      "registrationPoint": "platform_mcp.py:315 (@mcp.tool)",
      "dispatch": "application.parameters.resolve(context_ref, values, artifact_ref, parameter=True)",
      "sideEffect": "fills temporary instance from work or template artifact; no query or save",
      "inputSchema": {
        "type": "object",
        "properties": {
          "context_ref": {"type": "string"},
          "values": {"type": "object", "additionalProperties": {}},
          "artifact_ref": {"type": "string", "nullable": true}
        },
        "required": ["context_ref", "values"]
      }
    },
    {
      "name": "tool_mc_query",
      "kind": "public-MC-product (mc-content bridge via MCP channel)",
      "registrationPoint": "platform_mcp.py:371 (@mcp.tool)",
      "dispatch": "mc_resources.query_content(topic, key, options, root)",
      "sideEffect": "none (read-only MC content atom query)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "topic": {"type": "string", "description": "Content topic: layout / tool / protocol / runtime / scenario / knowledge / error"},
          "key": {"type": "string", "default": "", "description": "Atom key, e.g. catalog / template.schema / standards/business-report-standard / compose_page"},
          "options": {"type": "object", "nullable": true, "description": "Bounded options: maxBytes / includeSchema / offset / limit / pointer"}
        },
        "required": ["topic"]
      },
      "nameCollision": "DUPLICATE NAME — also defined in scripts/tools.py:110 (skill-side auto-registered via _load_skill_tools)."
    },
    {
      "name": "tool_mc_compile",
      "kind": "public-MC-product (mc-content bridge via MCP channel)",
      "registrationPoint": "platform_mcp.py:404 (@mcp.tool)",
      "dispatch": "mc_layout_compiler.compile_layout(envelope, root)",
      "sideEffect": "none (compiles plan against layout template; validates against contract snapshot)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "envelope": {"type": "object", "description": "Compile envelope: templateRef(scene/variant/templateVersion) + plan(title/layout/sources/sections) + userRequirements(pin list) + optional requestId and targetVersions. plan must NOT carry description/dateFilters/pagedJoins (compat window constraint)."}
        },
        "required": ["envelope"]
      },
      "nameCollision": "DUPLICATE NAME — also defined in scripts/tools.py:139"
    },
    {
      "name": "tool_mc_inspect",
      "kind": "public-MC-product (mc-content bridge via MCP channel)",
      "registrationPoint": "platform_mcp.py:431 (@mcp.tool)",
      "dispatch": "mc_inspection.inspect_assembly(document, inspection_spec, root, correlation)",
      "sideEffect": "none (reads saved preview artifact from per-turn file, runs inspect_assembly)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "reference": {"type": "string", "description": "Preview file artifactRef or turn identifier (relay_authoring_preview_{turn}.json)."},
          "inspection_spec": {"type": "object", "description": "inspectionSpec returned by tool_mc_compile (carries correlation proof)."}
        },
        "required": ["reference", "inspection_spec"]
      },
      "nameCollision": "DUPLICATE NAME — also defined in scripts/tools.py:174",
      "crossTurnReuse": "Scans all relay_authoring_preview_turn-*.json files for matching artifactRef — cross-turn reuse POSSIBLE but no TTL/cleanup observed (not_run for cleanup verification)"
    }
  ],
  "allowedToolsVsRegistered": {
    "skillAllowedTools": ["read_page_context", "discover_data_context", "query_data", "compose_page", "edit_page", "publish_page", "submit_ai_summary_body", "page_metadata_emit_preview", "extract_page_parameters", "apply_page_parameter_selection", "resolve_page_parameters", "list_existing_page_urls", "tool_mc_query", "tool_mc_compile", "tool_mc_inspect"],
    "registeredMcpTools": ["read_page_context", "discover_data_context", "query_data", "compose_page", "edit_page", "publish_page", "list_existing_page_urls", "submit_ai_summary_body", "page_metadata_emit_preview", "extract_page_parameters", "apply_page_parameter_selection", "resolve_page_parameters", "tool_mc_query", "tool_mc_compile", "tool_mc_inspect"],
    "diff": "EXACT MATCH (15 tools). NOTE: tool_mc_query/compile/inspect ALSO registered via scripts/tools.py skill-side auto-registration — potential name collision depending on Relay tool resolution order (not_run for runtime resolution verification)."
  },
  "compatShims": [
    {"file": "tool/server.py:3", "shim": "from metriccanvas_authoring.entrypoints.compat.server import main", "note": "source-checkout entry; installed distributions use package CLI"},
    {"file": "tool/metriccanvas_authoring/platform_server.py:6-12", "shim": "delegates to entrypoints.mcp.platform_server", "note": "bundle.json names this module; preserved as delegation shim"},
    {"file": "entrypoints/mcp/platform_mcp.py:348-364", "shim": "CRLF patch hack on mc_resources.digest", "note": "runtime monkey-patch; file integrity preserved; LOADED_CODE recomputed"},
    {"file": "bootstrap/compatibility.py:10-12", "shim": "imports entrypoints/compat/* but those dirs DO NOT EXIST on disk (find 无结果)", "note": "legacy save surface retired; raises RuntimeError; never executed for relay surface"}
  ]
}
```

---

## 8. 脱敏检查命令与结果

| 命令 | 目的 | 结果摘要 |
|---|---|---|
| `git rev-parse HEAD` | 身份 | 663da7ea |
| `git status --short \| wc -l` | 脏工作区 | 9 |
| `node --version` | Node 版本 | v26.8.1 |
| `python --version` | Python 版本 | not_run (PATH 无 python) |
| `find ... -name SKILL.md` | Skill 盘点 | 21 个 SKILL.md (含 metriccanvas-platform-authoring) |
| `grep -rn pageSchemaVersion ...` | 版本漂移 | contract-lock=6.54, bundle.lock=6.11, manifest=6.11, mc-content=6.77 |
| `grep -n "OPERATION_HANDLERS" component_editing.py` | 操作清单 | 9 个 component 操作 |
| `grep -n "CONTAINER_HANDLERS" container_building.py` | 容器操作 | 3 个 (add_composite_card, add_tab_container, remove_component) |
| `ls .../temp/` | 运行时产物 | 空 (源码检出, 无运行进程) |
| `grep -rn "metriccanvas-platform-content\|metriccanvas_platform_content" src/relay/` | Relay 端引用 | 无直接引用 (通过 mcp_configs 间接加载) |
| `find ... -name "compat" -type d` (subagent-B) | compat 目录 | 无结果 (compatibility.py 导入悬空) |
| `grep -rn "temp_subprocess\|mode.*subprocess" mcp_manager.py` (subagent-C) | 生成模式 | mcp_manager.py:105,415 mode:temp_subprocess |

**未运行 (not_run) 的检查**:
- MCP 服务进程 list_tools (本仓无运行进程, 部署在 /opt/cloud)
- 真实 DQE 查询 (禁止调用真实业务查询)
- 真实 Java 保存/发布 (禁止调用真实业务保存)
- 隔离探针 (本仓未构造运行时探针; 所有结论基于源码静态分析)
- IAM/CCMS 连通性 (脱敏, 不验证)

---

## 9. 不一致、失败与未知事项

### 9.1 不一致
1. **pageSchemaVersion 三向漂移** (subagent-A 交叉确认):
   - **contract-lock.json=6.54** (运行时 load_bundle_info() 读取 → referenced.py:69 写入 document.schemaVersion) — **运行时实际值**
   - **mc-content subtree=6.77** (mc-content.version.json:7978, product-contracts/manifest.json:3, runtime/contract-alignment.json:8, runtime/tool-behavior.md:3) — tool_mc_query 查询时向模型报告 6.77, **与运行时输出 6.54 矛盾**
   - **bundle.lock.json=6.11 + contract-snapshot/manifest.json=6.11** (stale/snapshot, 不被运行时读取)
   - **SKILL.md=6.54 + references/tools.md=6.54** (与运行时一致)
   - **结论**: 运行时输出 6.54, 但 tool_mc_query 会报告 6.77 — 模型可能被误导。**mc-content 内容版本领先于 bundle lock 版本**, 需 MC 仓同步或标注。
2. **tool_mc_query/compile/inspect 名称冲突**: 同时注册于 (a) MCP 服务 (platform_mcp.py:371/404/431) 和 (b) Skill scripts/tools.py:110/139/174 (via _load_skill_tools 自动注册)。SKILL.md allowed-tools 列出这三个名字但未消歧。**Relay 工具名解析顺序未在源码中明确** (not_run: 运行时解析优先级未验证)。
3. **MCP config cwd 与本地仓库路径不一致**: config 指向 /opt/cloud/CDIRelayAgentService/... (部署路径), 本仓在 D:/Code/0TMG/... (开发路径)。本地无法用此 config 启动服务 (路径不存在)。
4. **bundle.json 声明的 metriccanvas-page-builder skill 不存在** (subagent-A 确认): bundle.json:18 声明 entrypoint skill/metriccanvas-page-builder/SKILL.md, 但该路径在 .skills/ 和 local_mcp_servers/ 下均不存在 (glob 无结果)。**bundle.json 的 skill/skills[] 块不是实际加载源**; metriccanvas-platform-authoring 仅通过 project .skills/ 扫描加载 (skill_loader.py:462), 非 bundle entrypoint。
5. **contract-snapshot/page/conformance/*.json 固定 schemaVersion 6.11** (subagent-A 确认): 若运行时输出 6.54, 这些 conformance 测试 fixture 可能未覆盖实际输出版本。
6. **compatibility.py 悬空导入** (subagent-B 确认): bootstrap/compatibility.py:10-12 导入 entrypoints/compat/* 但这些目录**物理不存在** (find 无结果) — 旧 save surface 已退役 (raises RuntimeError 'legacy save surface retired')。

### 9.2 失败 (无法验证)
1. **R 层 (运行注册)**: 本仓无运行进程, 无法 list_tools 确认实际注册。
2. **T 层 (隔离探针)**: 未构造运行时探针; 所有 Schema 来自源码内联 WithJsonSchema + schema 常量。
3. **P 层 (服务回执)**: 禁止调用真实业务接口。
4. **跨轮次 artifactRef 复用的 TTL/清理**: tool_mc_inspect 扫描 relay_authoring_preview_turn-*.json (platform_mcp.py:461), 无清理逻辑可见 (not_run: 未验证是否有外部清理)。

### 9.3 未知事项
1. **bundle.json 声明的第二个 skill `metriccanvas-page-builder`** — 该路径在 .skills/ 下不存在。可能是 bundle.json 声明了一个不存在于本仓的 skill, 或该 skill 在 MC 仓维护。**无法确认是否实际加载** (not_run)。
2. **mc-content 是否手工副本还是动态生成**: mc-content/version.json 存在, HANDOFF.md 说明 "整包替换"; scripts/ 下有 mc_resources.py 提供 verify_package 校验。**判断: 手工副本 + 启动时完整性校验**, 非 MC 仓动态拉取。
3. **历史基线**: 本仓无 MC 仓的 reference skill 副本; git log 显示 BUG2026101900970 系列 "召回Skill修改" 但无 diff 基线。**无法确认历史差异**。

---

## 10. 交叉核验

### 10.1 Skill 宣称能力 vs 实际注册
- SKILL.md allowed-tools (15 项) vs MCP @mcp.tool (15 项): **EXACT MATCH**。
- SKILL.md 宣称 "程序持有单份工作稿": platform_authoring.py:325-348 state.reserve/consume/compare_and_swap 确认 **进程内 state store + 冻结提交**, 非跨消息持久 (无状态设计符合)。但 subagent-C 补充: 工作副本在 **SQLite** (METRICCANVAS_WORK_DB), 按 scope 键, 非纯进程内存。
- SKILL.md 宣称 "只将 modelSummary 送入模型": platform_mcp.py:170 `ToolResult(content=result['modelSummary'], structured_content=result)` 确认 **content=modelSummary**, structured_content 含完整结果但模型通道只看 content。subagent-C 进一步确认: Relay Core **只消费 content, 丢弃 structured_content**。**一致**。
- SKILL.md 宣称 "compose_page 内部保存草稿 is_draft=true": platform_authoring.py:350 `saver.save(... is_draft 默认 True, 未覆写)` **一致**。
- SKILL.md 宣称 "aiSummary 不在 compose_page 加入, 单独 edit_page add_ai_summary": pages/referenced.py:23-24 COMPOSE_SCHEMA 无 aiSummary; container_building.py:57 add_ai_summary 单独处理; page_editing.py:19-20 特殊路径 **一致**。

### 10.2 工具包装输入输出 vs 底层契约
- query_data request 用 WithJsonSchema(QUERY_SCHEMA): platform_mcp.py:18,227。QUERY_SCHEMA 在 data/results.py:28 定义, 完整 obj(question, dataContextVersion, requests[1..6], reason)。**一致**。
- compose_page request 用 WithJsonSchema(COMPOSE_SCHEMA): platform_mcp.py:19,232。COMPOSE_SCHEMA 在 pages/referenced.py:23。**一致**。
- edit_page request 用 WithJsonSchema(EDIT_RESULT_SCHEMA): platform_mcp.py:20,237。EDIT_RESULT_SCHEMA 在 pages/referenced.py:28。**一致**。

### 10.3 状态说明 vs 真实写入/保存/预览调用点
- "saveStatus=saved 后含 ref/draftId/artifactRef": platform_authoring.py:282-283 publish 路径确认; mutate 路径 _complete_save (line 355) 同理。**一致**。
- "预览透出 previewJson": preview_bridge/plugin.py:157-162 读 previewJson 并缓存到 session metadata; on_response_final 兜底注入。**一致**。
- "保存未知锁死 SAVE_RECONCILIATION_REQUIRED": platform_authoring.py:230 确认 saveStatus in {unknown,pending,rejected} 时 require 失败。**一致**。

### 10.4 反例检查
- **反例假设**: "名称命中/材料匹配/静态合法 = 执行成功"。**驳回**: verify_current (drafts.py:44-49) 对比 java_hash vs local_hash (sha256 of definition), 不匹配报 CURRENT_PAGE_STALE; query_data 走真实 DqeHttpExecutionPort POST。subagent-B 补充: source_mapping.py 校验契约/身份/类型但**不认证执行成功**, 成功仅由 DQE 返回行后 `claimed.update(status='ready'|'empty')` (results.py:173) 设置。**名称匹配不等同执行成功**。
- **反例假设**: "纯标题/布局修改会重新查数"。**驳回**: SKILL.md workflows/edit.md:13 "样式、标题、列宽或重排: 直接生成受控 operations, 不调用发现或业务查询"。代码层 edit() (referenced.py:120) 不强制 query; operation_batch 处理 set_title/set_component_layout 等不触发 query。**不会无谓重新查数**。
- **反例假设**: "数据先行生成页后不能换源"。**驳回**: edit.md:9 emptyQueryConditions 列表 + add_result_component 引用新 resultRef 重建源组件 + remove_component 移除旧组件 (dependsOn 新增成功)。**支持换源, 保留布局** (同 section 内替换组件)。

---

## 11. 相比可信旧基线的差异

**无上游基线**: 本仓无 MC 仓的 reference skill 副本; git log 显示 BUG2026101900970 系列 "召回Skill修改" 但无 diff 基线。**无法确认历史差异**。

可观察的本地修改痕迹:
- git log: 10 次提交围绕 BUG2026101900970 (召回 Skill) + US2026101000314 (自定义报告)
- 工作区未跟踪文件: 3 份设计文档 (layout-standards-frozen-design, mc-side-requirements, skill-side-implementation-plan) + 2 份审计/复盘 (relay-metriccanvas-integration-audit, relay-metriccanvas-retro-2026-10-26)

---

## 12. 已验证、推断与 not_run

### 12.1 已验证 (S+C 层)
1. ✅ 15 个 MCP 工具注册 (platform_mcp.py:214-489)
2. ✅ SKILL.md allowed-tools[15] 与 MCP 注册 EXACT MATCH
3. ✅ compose/edit 内部保存 is_draft=true (drafts.py:51, platform_authoring.py:350)
4. ✅ query_data 真实 DQE POST /dsl/execute (dqe_http.py:91)
5. ✅ verify_current sha256 对比 Java 基线 (drafts.py:44-49)
6. ✅ modelSummary 只入模型 (platform_mcp.py:170; subagent-C 确认 Relay 丢弃 structured_content)
7. ✅ turn_id 稳定 per-session (turn_provider/plugin.py:57)
8. ✅ 状态文件 per-turn (不共享) (turn_provider/plugin.py:88)
9. ✅ context_ref 程序注入 (turn_provider/plugin.py:608-610)
10. ✅ aiSummary 不在 compose, 单独 edit (referenced.py:23 无 aiSummary; container_building.py:57)
11. ✅ 换源保留布局 (edit.md:9 add_result_component + remove_component)
12. ✅ pageSchemaVersion 运行时=6.54 (contract-lock.json:8 → bundle_info.py:21)
13. ✅ MCP 服务 temp_subprocess 模式 (mcp_manager.py:105,415; subagent-C 确认)
14. ✅ 工作副本在 SQLite (METRICCANVAS_WORK_DB; subagent-C 确认)
15. ✅ result_ref 跨轮次被 RESULT_SCOPE_MISMATCH 阻止 (data/results.py:135-139; subagent-C 确认)

### 12.2 推断 (基于源码)
1. 📌 tool_mc_query/compile/inspect 名称冲突: Relay 工具解析优先级**未在源码明确**, 可能 MCP 优先或 Skill 优先或报冲突 — **需 R 层验证**
2. 📌 bundle.json 声明的 metriccanvas-page-builder skill 入口 (skill/metriccanvas-page-builder/SKILL.md) **不在本仓** — 可能 MC 仓维护或已废弃
3. 📌 mc-content 是手工副本 + 启动校验 (非动态拉取), 基于 mc-content/version.json + HANDOFF.md + verify_package 逻辑推断

### 12.3 not_run
1. ❌ R 层: MCP 服务 list_tools (本仓无运行进程)
2. ❌ T 层: 隔离探针 (未构造)
3. ❌ P 层: 真实业务查询/保存/发布 (禁止)
4. ❌ 跨轮次 artifactRef 复用的 TTL/清理 (无清理逻辑可见, 未验证外部清理)
5. ❌ IAM/CCMS 连通性 (脱敏)
6. ❌ Python 运行时 (本机 python 不在 PATH; 部署用 /opt/cloud 路径)
7. ❌ tool_mc_* 名称冲突的实际运行时解析 (需运行进程)

---

## 13. 对接 MC 共享能力所需的最小改动及兼容风险

### 13.1 可直接消费的共享能力 (无需改动)
- **15 个 MCP 工具的输入 Schema** (QUERY_SCHEMA, COMPOSE_SCHEMA, EDIT_RESULT_SCHEMA): 标准 JSON Schema, MC 仓可直接消费
- **页面 Schema 6.54** (contract-lock.json): 运行时一致
- **mc-content 原子查询/布局编译/装配检查** (mc_resources, mc_layout_compiler, mc_inspection): MC 仓维护, 本仓手工副本 + 启动校验
- **操作类型闭集** (section/component/container/result/aiSummary/text/interaction): 编辑能力对称

### 13.2 只需增加 Adapter 的能力
- **无**: 当前 Relay 扩展已通过 2 个 plugin (turn_provider, preview_bridge) + adapters/relay/ 完成 Adapter 层, 无需新增

### 13.3 必须修改公共契约或产品实现的
1. **tool_mc_query/compile/inspect 名称冲突**: 需 MC 仓或 Relay 侧消歧 (MCP 工具名加前缀, 或 Skill scripts/tools.py 移除重复定义, 或 Relay 工具解析层明确优先级 + 文档化)
2. **turn_id 派生 / _depublish_document / env 风格判读 重复实现**: 需统一为单一实现 (建议 MC 仓导出, Relay 引用), 否则双实现漂移风险
3. **pageSchemaVersion 三向漂移**: contract-lock=6.54 (运行时) / mc-content=6.77 (tool_mc_query 报告) / bundle.lock=6.11 (stale) — 需 MC 仓同步 mc-content 版本或明确其用途; **tool_mc_query 向模型报告 6.77 与运行时输出 6.54 矛盾** 是最需修复项

### 13.4 Relay 本地扩展必须保留的
1. **authoring_turn_provider plugin**: Relay 身份/轮次/状态文件注入 — MC 仓无法替代 (依赖 Relay agent_context + session_id)
2. **authoring_preview_bridge plugin**: {{RESPONSE_START}}/{{PAGE_METADATA_PREVIEW_JSON}} 标记处理 + 兜底注入 — Relay 响应管道特有
3. **adapters/relay/** (context_identity, content_baselines, iam_token, lifecycle_spool, env_identity, file_based_turns): Relay 状态/身份/预览文件桥
4. **mcp_configs/metriccanvas-platform-content.json**: Relay MCP 服务启动配置 (env, cwd, timeout)
5. **scripts/tools.py**: Skill 侧薄 Adapter (若名称冲突解决后, 可保留或移除)

### 13.5 目前仍不能确认的
1. tool_mc_* 名称冲突的实际运行时解析顺序 (需 R 层)
2. metriccanvas-page-builder skill 是否实际加载 (不在本仓)
3. mc-content 是否在部署环境动态拉取 (本仓为手工副本)
4. 跨轮次 artifactRef 复用是否有 TTL/清理 (无清理逻辑可见)
5. MCP 服务实际进程的工具注册 (本仓无运行进程)

---

## 14. 转交 MC 侧的简短结论

### 可直接消费
- 15 个 MCP 工具的完整输入 Schema (见 §7) 可直接消费
- 页面 Schema 6.54 运行时一致
- mc-content 原子查询/布局编译/装配检查能力已接通

### 只需增加 Adapter
- 无 (当前 Adapter 层已完备)

### 必须修改公共契约或产品实现
1. **tool_mc_query/compile/inspect 名称冲突** — 需 MC 仓或 Relay 侧消歧 (MCP 工具名 vs Skill scripts/tools.py 同名)
2. **turn_id 派生 / _depublish_document / env 风格判读 重复实现** — 需统一单一实现避免漂移
3. **pageSchemaVersion 三向漂移** (contract-lock=6.54 运行时 / mc-content=6.77 tool_mc_query 报告 / bundle.lock=6.11 stale) — 需 MC 仓同步 mc-content 版本或标注; **tool_mc_query 报告 6.77 与运行时输出 6.54 矛盾** 是最需修复项

### Relay 本地扩展必须保留
- 2 个 Relay 插件 (turn_provider, preview_bridge) + adapters/relay/ + mcp_configs — Relay 身份/状态/响应管道特有, MC 仓无法替代

### 仍不能确认
- tool_mc_* 运行时解析顺序 / metriccanvas-page-builder skill 加载 / mc-content 动态拉取 / artifactRef TTL / MCP 进程注册 — 需运行环境验证 (not_run)

---

## 15. 完成前复核

| "已实现/已接通/已保存/已展示" 声明 | 证据 | 复核结果 |
|---|---|---|
| 15 个 MCP 工具已注册 | platform_mcp.py:214-489 @mcp.tool 装饰器 | ✅ S 层源码确认 (R 层 not_run) |
| compose/edit 内部保存草稿 | drafts.py:51 is_draft=true 默认; platform_authoring.py:350 未覆写 | ✅ S 层确认 |
| query_data 接通真实 DQE | dqe_http.py:91 POST /dsl/execute | ✅ S 层确认 (P 层 not_run) |
| 预览透出 previewJson | preview_bridge/plugin.py:157-162 读 preview 文件 + 缓存; on_response_final 注入 | ✅ S 层确认 |
| 换源保留布局 | edit.md:9,15 + container_building.py:65 remove_component + referenced.py:25-27 RESULT_OPERATION | ✅ S 层确认 |
| modelSummary 只入模型 | platform_mcp.py:170 ToolResult(content=modelSummary, structured_content=output); subagent-C 确认 Relay 丢弃 structured_content | ✅ S 层确认 |
| 状态 per-turn 隔离 | turn_provider/plugin.py:88 relay_authoring_state_{turn_id}.json | ✅ S 层确认 |
| context_ref 程序注入 | turn_provider/plugin.py:608-610 args["context_ref"]=turn_id | ✅ S 层确认 |
| pageSchemaVersion=6.54 运行时 | contract-lock.json:8 → bundle_info.py:21 → referenced.py:69 | ✅ S 层确认 (R 层 not_run) |
| MCP 服务 temp_subprocess 模式 | mcp_manager.py:105,415 mode:temp_subprocess (subagent-C 确认) | ✅ S 层确认 |
| 工作副本在 SQLite | METRICCANVAS_WORK_DB; work/state.py:51-108 (subagent-C 确认) | ✅ S 层确认 |

**所有 "已实现" 声明均有 S 层源码证据; R/T/P 层因本仓无运行进程为 not_run, 已明确标注。无规划/文档/测试替身被写成真实部署事实。**

---

## 16. 三 subagent 交叉核验汇总

三个并行只读 subagent (A=Skill 加载, B=工具能力, C=状态集成) 完成后, 其发现与本主 Agent 结论**一致**, 并补充以下关键项:

### subagent-A 补充 (Skill 加载与版本)
1. **pageSchemaVersion 三向漂移**: contract-lock.json=6.54 (运行时), mc-content subtree=6.77 (tool_mc_query 报告), bundle.lock/snapshot=6.11 (stale)。**tool_mc_query 会向模型报告 6.77, 与运行时输出 6.54 矛盾**。
2. **bundle.json 声明的 metriccanvas-page-builder skill 不存在** (glob 无结果): bundle.json 的 skill/skills[] 块不是实际加载源; metriccanvas-platform-authoring 仅通过 project `.skills/` 扫描加载 (skill_loader.py:462)。
3. **contract-snapshot/page/conformance/*.json 固定 6.11**: 运行时输出 6.54, conformance fixture 未覆盖实际版本。
4. **mc-content 是手工副本 + 启动校验** (mc-content.version.json + verify_package), 非动态拉取。
5. **SkillLoader 无进程级缓存**: relay_application.py:3237 每次 restore 构造新 SkillLoader, 重读 SKILL.md; 无热重载需求。
6. **MCP server 内 lru_cache** (lifecycle_publish.py:198, capabilities.py:56, component_selection.py:222) — 但**每次工具调用生成临时子进程** (见下), lru_cache 跨调用不保留。
7. **权限执行点**: `sub_agent_loader.py:93` 传入 `skill.allowed_tools`; 执行在 `agent_factory.py:653-681` `filter_tools` — **agent-build 时白名单过滤**, 非每次调用拦截器。**空 allowed_tools → 全工具集访问 (不过滤)**。
8. **MCP 服务独立加载**: MCP 服务通过 `MCPLoader` (mcp_loader.py:288) 扫描 `.relay/mcp_configs/` 加载, 与 Skill allowed-tools 是两个独立注册路径。

### subagent-B 补充 (工具与产品能力)
1. **15 个工具 vs SKILL.md allowed-tools EXACT MATCH** — 与主 Agent 结论一致。
2. **compatibility.py 悬空导入**: bootstrap/compatibility.py:10-12 导入 entrypoints/compat/* 但这些目录**物理不存在** (find 无结果) — 旧 save surface 已退役 (raises RuntimeError 'legacy save surface retired')。
3. **page_metadata_emit_preview 是唯一 Relay-extension 工具**: env≠metric-canvas-platform 时调用 _emit_report_card/_load_js_config/_binding_user_no/_task_summary (platform_mcp.py:89-139, 37-61, 103, 26-34)。
4. **数据绑定校验 (source_mapping.py) 不认证执行成功**: 成功仅由 DQE 返回行后 `claimed.update(status='ready'|'empty')` (results.py:173) 设置 — **名称/材料/静态匹配不等同执行成功**。

### subagent-C 补充 (状态与集成)
1. **MCP 服务生成模式 = temp_subprocess** (mcp_manager.py:105,415): **每次工具调用生成临时子进程**, 非持久 stdio。影响: 进程内 state/lru_cache 跨调用不保留; 状态必须通过 per-turn 文件中转。
2. **Relay 消费 ToolResult.content, 丢弃 structured_content**: modelSummary 是模型通道唯一信息源。
3. **工作副本在 SQLite** (METRICCANVAS_WORK_DB), 按 scope (含 turnId) 键, 非进程内存。
4. **result_ref 跨轮次被 RESULT_SCOPE_MISMATCH 阻止** (scope-bound, turnId 是 SCOPE_KEY); **artifact_ref 跨轮次可通过文件扫描复用, 无 TTL/清理**。
5. **context_ref 是唯一注入向量** (turn_provider/plugin.py:608-610); operator_id/user_no/env/workspace_id/page_metadata_id 全部通过 per-turn 状态文件传递, 非 tool args。
6. **无 cancel/session-end 清理 hook**: 取消/会话结束时 per-turn 文件无清理 (not_run for cleanup verification)。

### 交叉核验结论
- 主 Agent 与三 subagent **无矛盾**; subagent 补充了 6.77 漂移、bundle.json 悬空 skill、temp_subprocess 模式、SQLite 工作副本、RESULT_SCOPE_MISMATCH 等关键细节。
- 所有关键结论 (15 工具、is_draft=true、DQE POST、verify_current sha256、modelSummary 只入模型、per-turn 隔离、context_ref 注入、名称冲突) **均被独立确认**。

---

> **报告结束**。本文件合并了 report.md / evidence.md / tool-contracts.json 三份交付物。原始分文件仍保留在 `.cac-probes/metriccanvas-audit-2026-11-02/` 目录下, 三 subagent 的详细发现分别在 `subagent-A-findings.md` / `subagent-B-findings.md` / `subagent-C-findings.md`。
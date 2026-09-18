# 如何与 Relay Agent 对接

更新：2026-09-18；代码基线 `ad96e28`。主路径是平台统一创作 Skill，旧普通问数单独说明。架构、模块及旧版变化见 [架构说明](ARCHITECTURE.md)。本文是基于本仓实际接口的接入指南，不宣称外部 Relay 已实现相应适配。

## 1. 先选正确入口

| 业务入口 | Skill / MCP 服务 | 工具与交接 |
| --- | --- | --- |
| 平台新建、修改、配置问答 | `metriccanvas-platform-authoring` / `metriccanvas-platform-content` | 五工具，`context_ref`，创作候选，由可信程序提交最终草稿 |
| 普通问数/探索 | `metriccanvas-page-builder` / `metriccanvas-authoring`，`METRICCANVAS_TOOL_SURFACE=relay` | discover + compose，页面构建产物进入分析会话，用户显式沉淀才保存 |
| 旧平台内容调用方 | `metriccanvas-content` | 兼容 page_id / baseline_token / source_token；不是统一入口的回退 |

现有 [MCP 配置样例](relay/mcp_configs/metriccanvas-authoring.json)属于第二行，不能只改 Skill 名就接成第一行。`bundle.json` 的旧默认 `skill.entrypoint` 也仍指向普通问数；统一入口看 `skills[]` 和 `toolServices`。`define-report` 是可信部署可选注册名，引用同一作者目录，不维护第二套 Skill。

## 2. 部署前交付清单

锁定完整 Bundle、代码提交和摘要；`0.2.0` 不足以区分新旧实现。至少包含：

- 完整 `skill/metriccanvas-platform-authoring/`，含 workflows 和 references。
- Python 包、运行时依赖、`contracts/`、`contract-snapshot/`、`bundle.json` 与两个 lock 文件。
- 部署方实现的可信轮次、候选存储、数据源描述、身份、产物分流，以及需要保存时的提交/恢复接线。

部署验收需读取 `metriccanvas://bundle-info`，本基线为 Bundle/Authoring `0.2.0`、Page `6.4`；再核对提交和锁文件。资源读取若不被 Relay 支持，可先由独立 MCP 管理客户端验收，不能假设模型工具能读 Resource。

Python 3.12+；依赖安装和包构建按 [tool/pyproject.toml](tool/pyproject.toml) 与 `tool/requirements.lock`。在 Bundle 目录可执行：

```bash
python3 scripts/check_bundle.py
uv build --sdist --out-dir dist tool
```

构建成功不等于离开源码树能启动。当前 v3 的契约打包限制见文末：现阶段完整 Bundle 部署应显式设置 `METRICCANVAS_BUNDLE_ROOT` 到同版本目录，独立包发布须另验契约闭合。

## 3. 服务组合：不是只挂一个 MCP 命令

实际工厂：[create_unified_content_mcp_server](tool/metriccanvas_authoring/adapters/inbound/unified_content_mcp.py)。以下是可信 Python 集成程序的组合形状，不是 Relay 已有 SDK，也不是可直接粘贴的完整启动器：

```python
from metriccanvas_authoring.application.compose_page import ComposePageDependencies
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server

# 右侧对象均由部署方在已鉴权的程序边界构造。
dependencies = ComposePageDependencies(
    data_context=trusted_data_context,
    dqe=user_scoped_dqe,
    source_description=trusted_source_description,
    metric_relations=trusted_metric_relations,  # 可缺省；此时关系为 unknown
)
server = create_unified_content_mcp_server(
    dependencies,
    trusted_current_turns,
    candidate_store=durable_candidates,
    summary_config=trusted_ai_summary_config,  # 不需要 aiSummary 时可为 None
)
server.run()
```

将部署方包装此组合的启动命令注册为 `metriccanvas-platform-content`。纯 CLI `metriccanvas-platform-content` 目前只装配基本 DataContext/DQE，没有接好轮次、候选和源描述；能列工具不表示能生成页面。配置 env 不能凭空实现程序端口，也不能启用旧兼容服务绕开门禁。

| 接入项 | 实际约定 / 完成条件 |
| --- | --- |
| 当前创作轮次 | `CurrentAuthoringTurnPort.current_scope()` / `current_turn()`；作用域来自服务端已鉴权请求，返回 `PreparedAuthoringTurn` |
| 完整基线 | existing 提供 `ContentBaseline` 和原始 `document_json`；new 明确空基线，由程序分配 pageId |
| 候选存储 | `CandidateStorePort.put/get`；同引用不可变，隔离副本，跨调用可读，按身份/轮次绑定校验 |
| 数据上下文和 DQE | `DataContextPort.current()` / `DqeExecutionPort.execute()`；支持同一快照版本，DQE 使用真实用户身份 |
| 源描述 | `SourceDescriptionPort.describe()`；绑定快照、查询 hash、可信字段身份、输出列、类型与刻度 |
| 指标关系 | `MetricRelationsPort.resolve(scope, version, domain)`；返回经治理的主辅关系及 evidenceRef；缺失不伪造 |
| 最终提交 | `AuthoringSubmissionCoordinator` + 候选/执行记录/Lifecycle/身份；模型无保存工具 |
| 恢复 | `AuthoringRecoveryCoordinator` + 持久 CAS 记录 + `RecoveryAuthorityPort.authorize()`；重新鉴权，不复活旧编辑轮次 |

端口定义与模块链接见 [架构说明](ARCHITECTURE.md)。默认 SQLite 实现只证明本地持久端口可用，不自动满足生产多实例存储、ACL、保留期和运维要求。oneshot 部署必须让每次调用找到同一可信状态，不能每次启动都重置候选和执行记录；常驻部署必须隔离各请求身份，不能共享用户 token 的进程 env。

## 4. 模型上下文和工具白名单

统一服务 `list_tools` 应恰好包含：

```text
read_page_context
discover_data_context
compose_page
create_content_page
edit_page
```

全部要求 `context_ref`。出现 `build_page` 或要求模型提供 baseline_token，说明路由到了错误工具面。工具名称可能与问数相同，Relay 应按“服务 + 工具”绑定白名单。

每轮向模型提供本次用户需求、可信程序给出的 contextRef、必要安全摘要、实际五工具 Schema，以及：

| 场景 | 必需参考 |
| --- | --- |
| 所有路径 | `SKILL.md`、`references/tools.md` |
| 完整创建 | `workflows/create.md`、对应布局、`scenarios.md`、`reading-design.md`、适用场景参考 |
| 局部修改 | `workflows/edit.md`；仅切换布局时加载布局参考，整体重组时再加载阅读设计 |
| 配置问答 | 入口中的只读规则及 `read_page_context` 投影 |
| 输入疑问 / 失败 | `examples.md` / `errors.md` 按需 |

有真实文件读取能力时可按链接加载；没有时由 Relay 注入正文，不能只注入链接。`discover_data_context` 不搜索 Skill 文档。完整产品 Schema 主要由工具与校验器消费，不把整套产品文档常驻塞进模型上下文。

Relay 自身控制模型调用预算、超时和取消。测试 runner 的轮数/token 上限是某次评测配置，不是生产 SLA，也不能把普通问数旧 Workflow 的预算直接套到统一创作。

## 5. 一轮创建与修改的时序

1. **准备。** 工作台锁新人工写入、flush 既有输入并同步。可信服务取得当前页面及修订，固定本轮基线并核验身份；new 分配页面身份且基线为空。返回 `authoring-turn/1.0` binding，只有引用/必要摘要进入模型。接口中 `latest` 的命名不表示 Java 提供全局强一致 latest 或历史精确读取保证。
2. **发现或读取。** 新增取数先 `discover_data_context(context_ref, query)`，再按 `business_domain` 有界枚举；分页携带首轮 `data_context_version`。已有页只改标题/布局或问配置，使用 `read_page_context`，无需重新发现数据。
3. **创建。** 若能力摘要支持 v3，模型提交 `create_content_page(context_ref, title, layout, request={plan: ...})`。自动页头 ID 为 `header` / `page-header`，plan 只含业务章节。`dataRequests` 数量和所有枚举依实际 Schema，不凭提示词扩大上限。`title` 在 Python 参数层可省，但业务门禁仍拒绝空标题。
4. **检查。** 读取 `status/operations/issues/appliedAdjustments/overlapFindings/queryCounts` 及 `candidateRef/candidateVersion`；partial 不是全成功。重叠提示不自动授权删组件。
5. **修订。** 同轮 v2/v3 候选调用 `edit_page(context_ref, candidate_ref, request={structureRevision: ...})`，使用原 planVersion 和准确 parentVersion。普通既有页使用 operations，首次无 candidate_ref，后续带候选引用。结构计划不是所有存量页面都有的隐藏属性。
6. **交接。** 可信程序按实际结果选定最终候选；按第 7 节提交。无变化、全失败或回到根基线不新增修订；新一轮重新 prepare，不复用旧 contextRef。

完整 v3 测试输入见 [structure-v3-business.json](test-harness/fixtures/structure-v3-business.json)，仅搭配其可信测试数据使用；实际业务域、字段和版本必须来自本轮发现。最终页面示例见 [final-deepseek-page.json](../docs/plan/scenario-guided-authoring/refinement/evidence/final-deepseek-page.json)，它是输出，不是模型工具输入。

## 6. 双通道适配：先分流，再日志/广播/模型

内容生成的 `structuredContent` 形状是：

```text
ok
modelSummary: status / operations / issues / candidateRef / candidateVersion / …
artifactEnvelope:
  kind: metriccanvas.authoring-candidate
  formatVersion: 1.0
  artifact: 完整候选记录（含 document / rootBinding / operations）
```

这是形状说明，字段随结果可省略，不能作固定成功示例。`read_page_context` 和 discovery 则直接返回有界配置/元数据，不套候选封套。

Relay 拦截点必须在结果进入模型消息、通用 `result_summary`、请求日志和广播之前：

1. 按可信调用的服务名与工具名分流；读取原生 structuredContent，不从自然语言重新提取页面。
2. 对生成结果验证外层状态、候选契约、页面合法性、完整性及 rootBinding；保持程序存储中的不可变候选身份。
3. 完整候选只留可信程序通道；模型只接收允许的 modelSummary。只读/发现结果使用各自安全字段白名单，不透传任意扩展。
4. 校验失败、作用域切换、取消、持久化失败时返回安全失败；绝不降级为原始输出透传。

输入契约：[authoring-turn.schema.json](contracts/authored/authoring-turn.schema.json)、[authoring-candidate.schema.json](contracts/authored/authoring-candidate.schema.json)、[page-structure-plan.schema.json](contracts/authored/page-structure-plan.schema.json)、[structure-revision.schema.json](contracts/authored/structure-revision.schema.json)。分页 cursor 绑定根/候选及目标，不可混用。

基线 hash 使用可信程序提供的 `documentJson` 精确 UTF-8 字节；候选 hash 使用 Python canonical JSON，参见 [turn 协议](contracts/authored/authoring-turn-protocol.md)。Relay 不应自行用 JavaScript 重序列化后假定两者相等，也不把 hash 当作来源或权限证明。

## 7. 保存、恢复和前端交付

当前目标按 [ADR-0080](../docs/adr/0080-java-assets-single-attempt-save-and-status-publication.md)：由可信协调器冻结最终候选与唯一操作载荷，先持久记录再单次发送 Java 保存。完整成功回执包含页面文档，验证页、资源、修订、内容与草稿状态后才报告 saved；程序结果的 `programToken` 定位已接收回执。

相同 finalize 不换候选/操作/载荷；保存未知时停止。当前 Java 的 lookup/exactRead 未获能力保证，不能用 GET 当前详情推断原操作已成功，不能按旧强生命周期协议自动重发。强保存兼容分支只在真实提供方明确支持时使用；历史 candidate/recovery 协议中的精确回读前置须结合 ADR-0080 与当前实现解读。

平台入口在 [authoring-language.ts](../apps/platform/src/lib/workbench/authoring-language.ts) 和 [对话接入契约](../apps/platform/src/lib/dialogue/README.md)：

- 部署方在挂载前注入 `globalThis.__METRICCANVAS_AUTHORING__ = {language, connect}`。
- `language` 实现可信 `prepare/run/lookup/read`；`connect` 将真实盘古输入回调接到工作台 `start(prompt, {mode})`，卸载时清理订阅。
- `run` 的 saved 可返回 `delivery: {binding, draft}`，或经 `read` 读取程序回执。模型不能构造 delivery；前端核验轮归属和修订后更新页面，不再次保存同一回执。
- `metriccanvas:draft-saved` 只携带 `{draftId}`，不是完整候选通道。`metriccanvas:apply-page` 支持 `{previewJson}` 的即时页面预览或 `{pageId}` 的当前读取，但预览成功不代表 Java 已保存，也不能替代可信轮次/回执。
- `lookup` 对单次保存只核对程序已有记录；unknown 保留工作。取消不等于已撤回远端写入；预览失败只重试读取/呈现，不重新生成写入。

以上为本仓程序接口，不是宣称盘古存在同名 SDK 方法或 Relay 存在对应 HTTP API。浏览器凭据及 Python 调用身份都必须由真实已鉴权集成提供，不能由模型参数或普通前端声明替代服务端验证。

## 8. 数据连接与身份

底层连接配置可参考普通问数的 [env 样例](relay/mcp_configs/metriccanvas-authoring.json)，仅复用数据连接字段，不复用其工具面注册：

| 配置组 | 说明 |
| --- | --- |
| `METRICCANVAS_DQE_BASE_URL` / `METRICCANVAS_DQE_WORKSPACE_ID` | DQE v1 基址与工作区；Adapter 调 `/dsl/execute`，不直连 Lab 执行查询 |
| `METRICCANVAS_DATA_CONTEXT_*` | Lab 列表/详情 URL 模板、主题、工作区、app code 及受管投影配置 |
| `METRICCANVAS_OPERATOR_ID` / `METRICCANVAS_AUTH_TOKEN` | 默认 env Adapter 是服务态；不证明按用户身份完成接入 |
| `METRICCANVAS_BUNDLE_ROOT` | 已核验完整 Bundle 的绝对目录；代码与契约锁步 |
| `METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG` | 可选运行时流式摘要配置；只有明确需要 aiSummary 时使用，不进入页面或模型 |

真实部署须区分元数据服务身份与 DQE 当前用户身份。SourceDescription 和 MetricRelations 是新增程序接缝，不是填几个环境变量即可获得的能力；未实现的端口诚实返回不可用/unknown。超时、401/403、源描述不符及版本变化分别处理；内容查询的可重试提示不能扩展成保存自动重试权限。

Relay 取消需传播到实际工具执行/子进程，并拒收迟到候选；仅停止聊天生成不等于已取消 DQE 或写入。持续连接的元数据缓存刷新策略亦须验证，不能沿用一次性进程的假设。

## 9. 从旧版升级与普通问数保留

相对 `9d4f444`：撤销平台 create/edit 双 Skill 注册，安装完整统一作者目录；将平台路由从 `metriccanvas-content` 切到五工具服务；以带外可信 context_ref 替代模型侧旧 token 参数；增加候选存储、最终选择、程序提交/恢复和双通道验收。不能把旧 token 改名为 context_ref 就宣布迁移完成。更详细变化表见 [架构说明第 7 节](ARCHITECTURE.md#7-相对上一个大版本的变化)。

普通问数不强行切换：继续使用 `metriccanvas-page-builder` + relay 两工具面。其产物 kind 是 `metriccanvas.page-build-artifact`，不是统一创作候选；完整页面交分析会话检查点，模型只拿摘要/引用，普通问数期间不自动保存 Java 修订。

旧 Agent Core 的三类决策、reducer、等待/取消和步骤事件仍需 Relay 实际 Workflow 接线；Python 函数存在不等于已经有跨进程 transition 服务。`compose_page` 的事后结果不能冒充实时阶段事件。旧指南中的 Session API 名、90 天保留、性能目标及内部 transition 方案是当时的接入设计，本文不将其认定为 Relay 现成接口。需要复核原文时执行：

```bash
git show 9d4f444:metriccanvas-authoring/RELAY-HANDOFF.md
```

旧指南引用的 `调查报告/relay.md` 不在当前交付树中，不作为可用接入依赖。本仓不包含当前 Relay 源码；Skill 加载、MCP structuredContent 保留、拦截点和取消传播须在外部目标提交逐项复核，不能依赖历史文件行号。

<a id="integration-gaps"></a>

## 10. 当前已知接入限制

| 限制 | 源码证据与处理 |
| --- | --- |
| 统一 CLI 非完整生产组合 | `unified_content_server.py` 未注入 current_turns / candidate_store / source_description；部署方需实现可信组合，缺能力保持失败关闭 |
| 独立包缺新版结构契约 | `tool/pyproject.toml` 的 sdist force-include 尚未列出 `section-patterns.json`、`page-structure-plan.schema.json`、`structure-revision.schema.json`，而统一入口导入会读取它们；当前使用经核验完整 Bundle + `METRICCANVAS_BUNDLE_ROOT`，纯包发布前补齐并做离开源码树的启动测试 |
| 通用装配器仍要求旧强生命周期能力 | `authoring_deployment._port` 要求 stable_save/exact_read/operation_lookup；而提交协调器已支持 single_save。现成 assemble_deployment 不能被当作当前 Java 的无障碍接入路径；需对齐验证，不能伪报能力为 true |
| 指标关系无 registry 槽 | `ComposePageDependencies.metric_relations` 和消费路径已有，部署 manifest 的 data 槽尚不包含它；从可信基础依赖注入，不新增模型字段冒充证据 |
| 外部适配尚待验收 | 真实 Relay 模型循环、参考加载、结构化结果保留与分流、身份隔离、Java 保存及前端回执关联，均需真实提供方纵向验证 |

前两项的源码部署方案只解决契约定位和程序装配，不等于消除其他生产门禁。本次只更新文档，不修补打包清单或扩大服务能力。

## 11. 接入验收清单

先以替身/scripted model 做协议测试，再经授权运行真实模型和服务；两类证据分别记录。

| 门禁 | 必须观察到的结果 |
| --- | --- |
| 分发与启动 | 锁文件通过；离开开发仓后契约可读；五工具及 Resource 版本匹配，缺端口明确不可用 |
| 参考加载 | 创建确实读取/注入布局、场景和阅读设计；无文件工具时不假装读取链接 |
| 轮次与权限 | 旧引用、跨身份/页/轮次、只读写入、取消后的迟到结果均被拒绝 |
| 信息最小化 | 模型消息、通用日志/广播无完整 document、DQE body、rows/initial、凭据和程序审计 |
| 创建与修订 | v3 创建、同源复用、标题/宽度修改、父版本冲突、缺关系、partial、unchanged 均有正反例 |
| 保存与恢复 | 最终一次提交；未知不重发；重启保留冻结载荷；取消/预算不创建新写入；已有回执不被晚到失败覆盖 |
| 前端 | delivery 轮归属、页面和修订可核验；预览与 saved 区分；现有人工编辑不被静默覆盖 |
| 真实数据 | 用户身份与权限隔离，可信源描述/关系，实际数据版本与刷新路径可核验 |
| 普通问数隔离 | 若同时部署，问数仍走两工具及临时页面链路，Java 零自动保存 |

本地验证命令见 [架构说明第 8 节](ARCHITECTURE.md#8-契约真源与维护方法)。关键测试位于 `test-harness/tests/test_authoring_turns.py`、`test_authoring_candidates.py`、`test_authoring_submission.py`、`test_authoring_recovery.py`、`test_structure_v3.py` 和 `test_structure_revision.py`。本地通过及单个 DeepSeek 页面效果认可，都不能替代这里的真实接入门禁。

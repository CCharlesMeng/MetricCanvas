# Relay 接入：平台页面创作

Bundle 0.3.0 的目标入口是 `metriccanvas_authoring.platform_server.create_platform_server`，生产由 Relay 注册的 MCP stdio server 受控启动。这里的 CLI 只表示进程启动方式，不是模型可调用的通用 shell，也不是第二条创作流程。参数与各提供方 Interface 见[平台协议](contracts/authored/platform-v2-protocol.md)。生产不注册历史候选入口，也不在同一轮失败后切换旧流程。

## 接入顺序

1. 将用户问题、页面/选中目标随同一次请求交给 Agent。工具执行时从可信宿主取得 current_turns；真实身份、页、基线和 plan confirmation 不由模型自报，不要求工作台先独立调用 MCP。
2. 注入持久化工作存储、现有数据上下文/DQE/源描述、Java 当前资源读取、单次保存服务和身份提供方。已有 `KnownLifecycleHttp` 是本仓核验的消费 Adapter；真实 Java 行为仍须部署对账。当前工具协议不要求远端幂等 lookup 或历史 exact-read。Relay 必须把当前可信身份注入 MCP 调用；不能让工具回退到共享进程环境凭据。
3. 数据创作展示推荐分析计划。用户确认后，授权提供方核对当前 binding、取数请求和版本，并显式许可模型证据通道。计划补充或范围变化须遵守用户授权；配置编辑不强制计划审核。
4. query_data 返回 modelSummary 中的有界证据；只把摘要交模型。compose/edit 返回摘要与程序 artifactEnvelope，内部已经执行单次草稿保存，Relay/前端不可第二次保存。保存、发布、删除和预览产物注入都由可信程序编排，不暴露为模型可自由组合的低级写工具。
5. 保存成功后，page_metadata_emit_preview 使用精确 artifactRef，从工作存储拿到对应 document/previewJson/ref；`relay_preview.prepare` 映射到真实部署的 compose_page_result 注入和卡片格式。此 Adapter 同时处理 compose 与 edit 产物；缺失返回不可用。
6. 模型最终原样输出 `{{RESPONSE_START}}` 和 `{{PAGE_METADATA_PREVIEW_JSON}}`，Relay 按既有协议替换并交付工作台。

## 原始指标语义层发现

数据集服务契约来自根仓 `service/dataset-detail-java.yaml`，随包副本为 [数据集 YAML](contract-snapshot/data-context/rest-services-dataset-detail.yaml)。平台配置：

```text
METRICCANVAS_DATASET_DETAIL_BASE_URL=https://<java-host>/rest/cdi/cdinl2databuilderservice/v1
METRICCANVAS_DATASET_IDS=["<dataset-id>"]
```

配置来自可信部署方；datasetIds 可省略或为空数组，按服务契约表示当前空间全量，非空最多 100 个。工具请求 `POST .../dataset-detail/query-dataset-from-lab`，body 只含 workspaceId 和可选 datasetIds；query/limit 在本地语义卡片投影阶段处理，不伪造 HTTP 搜索参数。普通发现不调用 update-dataset-from-lab，也不将 GET dataset-detail/query 的维度值接口当作语义元数据接口。

Java 负责 DB 优先和懒回源 Lab，读取结果可能不是主动刷新后的实时 Lab 状态。适配器不保留跨用户进程级原始元数据缓存。身份由注入的 LifecycleIdentityPort 提供，actorId/workspaceId 必须匹配本轮 binding；发送 X-Auth-Token 与 x-operator-id，workspaceId 写入请求体。无需 Lab 专用 app-code 或直接 Lab URL。进程环境方式读取 METRICCANVAS_OPERATOR_ID、METRICCANVAS_WORKSPACE_ID、METRICCANVAS_AUTH_TOKEN，仍需 Relay 按用户隔离注入。

`create_platform_server` 自动为 Java 元数据提供方装配 SemanticCatalog。整体 retCode 与元素 ret_code 分别校验；部分数据集失败时返回 partial、issues 和 coverage，仍可展示成功数据集的语义卡片，不能将失败当作无指标。所有失败返回 failed。物理 SQL、完整模型与提供方错误原文不进入模型摘要。

同一 Java 提供方也实现查询使用的 DataContextPort，发现和执行共享基于完整元数据与治理配置计算的本地 dataContextVersion；它不是 Java 的 version 字段。元数据变化后旧引用失效。查询仍需 METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG 的显式治理值；缺配置仅阻止执行，不妨碍查看原始定义。部分数据集失败时不构造可执行快照；需恢复访问或由可信程序缩小到明确的数据集范围。单位和定义缺失保持 unknown，不能从名称或物理 SQL 推断。

## 编辑目标与 Java 当前基线

平台先依据用户打开的 pageId 解析授权资源，读取 Java 当前完整文档、resourceId 和 revisionId，再构建 current_turns。不能将上一轮会话文档作为本轮创作基线。现有 GET 按 resourceId 读取；pageId 到资源的解析由集成程序负责，不新增或猜测 Java URL。

`read_page_context` 和非重复修改调用都会通过 `lifecycle_service.current_match(identity, ref)` 核对当前资源。模型从读取结果取得 pageId/workVersion，调用 `edit_page(context_ref, page_id, request, expected_version)`；page_id 不匹配、当前修订不匹配、同修订定义变化或读取不可用时停止。由集成程序重读并开启新轮次，不能将旧 operations 自动重放到新基线。

同轮保存后以回执 ref 作为下一次编辑基线。Java 保存仍必须原子校验 base_revision_id，覆盖 GET 后发生的竞争。部署至少演练一次“读后他人修改 → 当前编辑拒绝”，以及一次“首次保存 → 下一次编辑读取新修订”。

## 三种结果分别报告

- 生成 changed/partial 不等于保存成功；saved 必须有核对通过的草稿回执。
- 保存成功但预览失败：保留该 artifactRef，仅重试匹配预览；不查数、不保存。
- saveStatus=unknown/pending/rejected：保留工作与冻结提交，不换 operationId 再发。程序可在当前可信轮次调用 `PlatformAuthoring.recover` 检查；取消后的核对使用 `DraftSaver.recover_authorized` 加现有 RecoveryAuthorityPort，不复活旧轮次写权限。

只读与运行态不写资产。筛选、排序、翻页使用运行时已有查询，不触发 Agent。明确发布意图继续部署现有的维度实例选择和发布工具流程；计划确认不触发发布。

## 保存与预览载荷

`document` 是落库定义，所有 query initial 已剥离；inline 内容仍在定义中。`previewJson` 可以包含本次执行 initial。artifactRef 绑定完整产物、操作与保存修订，禁止回退到缓存中的“最近一个结果”。draftId 映射资源 ID，pageId 与 revisionId 独立。

MCP 的结构化结果不是自动安全的模型通道：宿主必须投影 modelSummary。授权证据中的字段、值与 coverage 也属于业务数据，受部署策略保护；凭据、SQL、完整响应和完整页面不得透传。

## 尚需真实部署验收

本仓没有 Relay 注入、占位符解析和工作台卡片缓存实现，不能凭本仓 Python Interface 声称真实替换已完成。需提供方完成 prepare Adapter，并验证首次构建、数据修改、样式修改、partial、未知保存、交错请求、预览失败和两个标记。Java 原始指标元数据接口的真实身份、响应和 DQE 执行结果仍须提供实例证据；本地 HTTP 替身不证明服务已接通。

Relay 调查已确认 MCP stdio 是生产入口，但同时发现四项上线阻塞：`agent_context` 尚未注入 MCP 工具调用；当前凭据路径可能退回共享服务账号；子进程内 HTTP 缺少分层超时/取消；写操作缺少贯穿轮次的关联与结果未知处理。远端幂等键和操作结果查询仍未证实，按 ADR-0080 不强制新增；未知写入停止重发并人工核对。以上属于 Relay/Java/部署接线工作，本 Bundle 不把源码调查升级为已验收事实。

本地可运行 `test_platform_v2.py`、`test_semantic_catalog.py`、Skill 契约与 Bundle 检查；`platform_v2_browser.mjs` 使用正式运行时检查本地样例；`run_platform_v2.py` 在明确外部模型授权后执行真实模型/本地夹具评测。后三者均不替代真实 Relay/Java 工作台验收。

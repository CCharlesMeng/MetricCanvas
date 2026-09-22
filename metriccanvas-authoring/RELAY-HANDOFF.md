# Relay 接入：平台创作 protocol 2.0

Bundle 0.3.0 的目标入口是 `metriccanvas_authoring.platform_server.create_platform_server`。参数与各提供方 Interface 见[平台协议](contracts/authored/platform-v2-protocol.md)。旧部署保留[兼容接入文档](RELAY-HANDOFF-V1.md)和 `metriccanvas-platform-content-v1`，按整个部署版本选择，不能在同一轮失败后切换入口。

## 接入顺序

1. 将用户问题、页面/选中目标随同一次请求交给 Agent。工具执行时从可信宿主取得 current_turns；真实身份、页、基线和 plan confirmation 不由模型自报，不要求工作台先独立调用 MCP。
2. 注入持久化工作存储、现有数据上下文/DQE/源描述、单次保存服务和身份提供方。已有 `KnownLifecycleHttp` 是本仓核验的消费 Adapter；真实 Java 行为仍须部署对账。v2 不要求 candidate_store、远端幂等 lookup 或历史 exact-read。
3. 数据创作展示推荐分析计划。用户确认后，授权提供方核对当前 binding、取数请求和版本，并显式许可模型证据通道。计划补充或范围变化须遵守用户授权；配置编辑不强制计划审核。
4. query_data 返回 modelSummary 中的有界证据；只把摘要交模型。compose/edit 返回摘要与程序 artifactEnvelope，内部已经执行单次草稿保存，Relay/前端不可第二次保存。
5. 保存成功后，page_metadata_emit_preview 使用精确 artifactRef，从工作存储拿到对应 document/previewJson/ref；`relay_preview.prepare` 映射到真实部署的 compose_page_result 注入和卡片格式。此 Adapter 同时处理 compose 与 edit 产物；缺失返回不可用。
6. 模型最终原样输出 `{{RESPONSE_START}}` 和 `{{PAGE_METADATA_PREVIEW_JSON}}`，Relay 按既有协议替换并交付工作台。

## 三种结果分别报告

- 生成 changed/partial 不等于保存成功；saved 必须有核对通过的草稿回执。
- 保存成功但预览失败：保留该 artifactRef，仅重试匹配预览；不查数、不保存。
- saveStatus=unknown/pending/rejected：保留工作与冻结提交，不换 operationId 再发。程序可在当前可信轮次调用 `PlatformAuthoring.recover` 检查；取消后的核对使用 `DraftSaver.recover_authorized` 加现有 RecoveryAuthorityPort，不复活旧轮次写权限。

只读与运行态不写资产。筛选、排序、翻页使用运行时已有查询，不触发 Agent。明确发布意图继续部署现有的维度实例选择和发布工具流程；计划确认不触发发布。

## 保存与预览载荷

`document` 是落库定义，所有 query initial 已剥离；inline 内容仍在定义中。`previewJson` 可以包含本次执行 initial。artifactRef 绑定完整产物、操作与保存修订，禁止回退到缓存中的“最近一个结果”。draftId 映射资源 ID，pageId 与 revisionId 独立。

MCP 的结构化结果不是自动安全的模型通道：宿主必须投影 modelSummary。授权证据中的字段、值与 coverage 也属于业务数据，受部署策略保护；凭据、SQL、完整响应和完整页面不得透传。

## 尚需真实部署验收

本仓没有 Relay 注入、占位符解析和工作台卡片缓存实现，不能凭本仓 Python Interface 声称真实替换已完成。需提供方完成 prepare Adapter，并验证首次构建、数据修改、样式修改、partial、未知保存、交错请求、预览失败和两个标记。真实 Lab 语义摘要读取/指标详情映射与 Java 回执也须提供对应实例证据。

本地可运行 `test_platform_v2.py`、`test_semantic_catalog.py`、Skill 契约与 Bundle 检查；`platform_v2_browser.mjs` 使用正式运行时检查本地样例；`run_platform_v2.py` 在明确外部模型授权后执行真实模型/本地夹具评测。后三者均不替代真实 Relay/Java 工作台验收。

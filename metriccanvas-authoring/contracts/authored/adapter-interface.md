# 内部适配接口 authoring-adapters/1.0

公共类型入口：`tool/metriccanvas_authoring/bootstrap/adapter_contract.py`。实现入口固定为 `metriccanvas_authoring.adapters.factory:create_adapters()`，同步函数、无参数，返回 AuthoringAdapters。实例可以使用调用专属配置；不得在工厂中执行业务查询、保存或伪造确认。接口升级需要内部适配与公共版本共同校验。

## 必需能力

| 属性 | 方法 | 结果与约束 |
|---|---|---|
| current_turns | async current_scope(); async current_turn() | scope 为可信身份/轮次字段；turn 返回 PreparedAuthoringTurn(binding, baseline, document_json)；完整约束见 authoring-turn.schema.json |
| store | async read(namespace, key); async compare_and_swap(namespace, key, version, value) | read 返回 (版本, JSON值)，不存在为 (0,None)；CAS 原子比较版本，成功写入并递增版本，返回 bool；值要隔离复制，跨进程持久可读 |
| data_context | async current() | 返回 contract-snapshot/data-context/schema.json 规定的快照；不是原始 Java 响应 |
| dqe | async execute(effective_query) | 返回 data.execution.DqeExecutionResult(rows,total_count,captured_at)；effective_query 包含 language、body、fieldMappings；查询与字段映射不得随意重写 |
| analysis_authorization | async authorize(binding, request, data_context_version) | 返回精确 AnalysisGrant；见下文，拒绝必须阻止执行 |
| lifecycle_identities | current() | 返回 LifecycleIdentity(actor_id,workspace_id,auth_token)，同步读取调用专属可信身份 |
| lifecycle_service | async current_match(identity,ref); async save(identity,command) | capabilities.single_save/current_read 都为 True；当前读取返回 ref/document；保存回执见下文 |
| relay_preview | async prepare(artifact) | 接收后返回 {status:'ready',artifactRef,ref}，两个引用必须与输入完全匹配 |

方法签名真源分别在 work/authoring_turns.py、work/state.py、data/ports.py、data/authorization.py、assets/lifecycle_ports.py、delivery/ports.py。所有 async 方法必须返回可等待对象。装配检查只检查必要方法存在，不替代真实行为测试。

## 轮次与基线

完整机器契约见 [authoring-turn.schema.json](authoring-turn.schema.json)，流程见 [platform-v2-protocol.md](platform-v2-protocol.md)。binding 包括 actorId/workspaceId/requestId/runId/turnId/pageId/capabilityVersion、contextRef、mode、baseRef 等契约字段。创建使用明确空基线；编辑必须提供完整文档及精确 ref，不能只给页面摘要或永久指向 latest 的引用。

同一用户指令内的多次 MCP 子进程调用保持同一 binding 和持久状态。新的编辑指令开启新轮次，重新取得已保存页面的当前修订。page_id 是目标断言，不是授权依据。

## 查询授权

```json
{
  "binding": "与传入 binding 完全一致的对象",
  "dataContextVersion": "与传入版本一致",
  "requestSha256": "公共 work.state.digest(request) 的结果",
  "planConfirmed": true,
  "modelEvidenceAllowed": true
}
```

这是结构说明，不是默认可返回的固定授权。先根据真实确认事件和当前权限核对请求，再构造回执。任何不同请求、轮次、身份或版本都必须拒绝。数据上下文缺治理信息不得以空值或假授权绕过。

## Java 页面读写

ref 是精确三元组 `{pageId,revisionId,resourceId}`，三者不可混用。current_match 必须证明当前资源仍匹配 ref 并返回完整 document；过期时抛 LifecycleError('CURRENT_PAGE_STALE')。请求头、URL 与实际 Java 响应映射归内部，不由公共代码猜测。

save 接收 `{pageId,document,base,context,description,...}`，base 是创建的 null 或编辑的精确 ref；context.operationId 用于关联本次冻结提交。只执行一次提交，编辑需要服务端条件更新，不能以先读后写替代原子修订比较。

- 成功：`{status:'saved',operationId,ref,base,revisionNumber,isDraft:true,document,assurance:'provider-response'}`；document 必须与提交定义相符，编辑修订必须前进。
- 确定拒绝：`{status:'rejected',operationId,code}`，如 REVISION_CONFLICT、FORBIDDEN。
- 超时、连接中断或无法判断是否落库：`{status:'unknown',operationId}`，保留工作记录并停止自动重发。

初始 HTTP 参考在 examples/adapter_template/firstparty/lifecycle_http.py：集合 POST、资源 PUT（base_revision_id）、资源 GET；必须与内部提供方对账。LifecycleServicePort 的 lookup/read/history/verify_document 服务其他能力，主流程不要求实现强精确回读或历史；未提供时返回 CAPABILITY_UNAVAILABLE，不能伪造能力。

## 产物交接

prepare 输入为 `{binding,operationId,artifactRef,ref,document,previewJson}`。document 是保存定义，去掉 query initial；previewJson 保留匹配的预览数据。接收成功后返回精确引用。失败不得倒退已保存事实，不得因此重发 Java 保存。Relay 卡片和程序通道协议由内部实现，公共代码不定义虚构的公司接口。

## 可选能力

- semantic_catalog：data/catalog_ports.py 的 SemanticCatalogPort，显式传入 discover/query_issues。可使用公共 SemanticCatalog；底层 MetricMetadataPort 提供 search/detail，返回模型列表、数据上下文版本与精确 source 身份。行为与实例见公共 test_semantic_catalog.py 及 Java 数据集参考模板。
- source_description：data/source_description_ports.py 的 describe(scope,version,effective_query)。
- metric_relations：data/metric_relations.py 的接口，提供可信关系而非从标签猜测。
- parameter_dependencies：pages/parameters/page_parameters.py 的 ParameterDependencies。普通创建/编辑可不配置。

## 错误与测试

适配失败使用对应消费方异常：DataContextError、DqeExecutionError、LifecycleError、ContentBaselineError。不要向模型透传 token、SQL、内部原始响应。内部日志按关联 ID 调查，MCP stdout 只写协议。

公共 test-harness 测试模板和 mock；内部测试应覆盖真实协议映射、拒绝、超时、并发 CAS、跨进程共享与产物回执。完整内部验收顺序见 Bundle 根目录 INTERNAL-VALIDATION-0.3.1.md。

## 数据上下文治理诊断（兼容扩展）

DataContextError 新增可选 diagnostics 属性，默认 None，不改变既有构造调用和模型错误码。只供 scripts/check_data_context.py 等受信任程序读取，MCP 不自动透传。参考结构为 `{stage,issues,issueCount,truncated}`；issues 仅包含 datasetId、field、property、path、reason 等元数据定位，不含原值。字段清单最多 100 项。

当前参考实现中，projection 未注入为 projection_configuration 阶段，逐字段治理不足为 field_governance 阶段，均维持 DATA_CONTEXT_GOVERNANCE_REQUIRED。原始 additivity/timeAggregation 的空值允许治理补充；明确非法值拒绝，不隐式转成有效默认。

projection JSON 是参考适配方式，不是 DataContextPort 的必需实现方式。内部可查询治理服务，只要 current() 返回符合公共 Schema 的受治理快照。真实属性必须由数据治理负责人确认。

详见 Bundle 根目录 RELAY-HANDOFF.md 的治理诊断与人工采用步骤。公共升级保留内部 adapters；旧实现没有 diagnostics 时报告仍可输出错误码。

## 查询策略兼容扩展 query-context/1

新增可选 `data_context.current_for_query(policy)`，公共代码每批传入固定 QueryValidationPolicy；不存在时回退既有 current()。工厂接口 authoring-adapters/1.0 不增加必填项。current() 保持中立 Schema 1.1；新入口可返回 queryValidationView=1 的私有查询视图，缺少 additivity/timeAggregation/isRatio 保持未知，执行字段及安全事实仍必需。公共投影真源为 data/lab_projection.py，不能继续复制维护。

发现结果新增 kind=dimension 和相关维度/时间能力；授权接收规范化后的请求，模式和规则版本进入结果身份。默认关闭严格语义预检，可信配置按批次热切换。完整调用、兼容限制和内部升级步骤见 [QUERY-VALIDATION-MIGRATION.md](../../QUERY-VALIDATION-MIGRATION.md)。


## 可选增强发现 discovery/1.0

AuthoringAdapters 必需字段保持不变。在现有 semantic_catalog 中注入
`SemanticCatalog(metadata, store, discovery=DiscoveryDependencies(...))`。
端口定义位于 `data/discovery/contracts.py`，JSON 协议位于 `discovery.schema.json`。

| 可选依赖 | 方法 | 责任 |
|---|---|---|
| trusted_context（开启增强时必需） | async current(binding) | 可信原始用户消息、稳定会话、续接/确认事件；不是模型输入 |
| knowledge | async search(binding, query, business_domains, limit) | 授权范围内术语、片段、主题与来源/覆盖信息 |
| interpreter | async propose(context) | 有界候选解释，精确Schema与来源引用；不能授权或确认 |
| retrieval | async retrieve(binding, request, metadata_source, budget) | 当前受信任源版本上的 candidateRefs，供未来内部检索替换 |

新轮重新验证 context_ref；taskRef 只是定位已有需求。StateStore 的 discovery_task
命名空间保存结构化续接与事件回执，单记录 CAS 防重复/并发覆盖；过期清理由部署方负责。
增强模式的模型摘要与程序 interactionEnvelope 分离；Relay 必须实现程序通道路由。
详见 [增强发现接入](../../SEMANTIC-DISCOVERY-HANDOFF.md)。

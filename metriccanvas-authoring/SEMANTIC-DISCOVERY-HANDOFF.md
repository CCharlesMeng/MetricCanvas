# 增强语义发现接入

协议 `discovery/1.0`；仍使用 MCP `discover_data_context`。基础发现不要求模型或知识库；增强模式由内部 factory 显式启用。此文描述本批源码，不代表公司接口已验证。

## 装配

公共 Python 包提供 `SemanticCatalog` 和 `DiscoveryDependencies`；内部只实现外部端口。已有 `AuthoringAdapters` 的必需字段和 `authoring-adapters/1.0` 不变。

```python
from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
from metriccanvas_authoring.data.discovery import DiscoveryDependencies, DiscoveryLimits

catalog = SemanticCatalog(
    metadata, store,
    discovery=DiscoveryDependencies(
        trusted_context=relay_discovery_context,
        knowledge=business_knowledge,       # 可省略
        interpreter=discovery_interpreter, # 可省略
        retrieval=internal_retrieval,      # 可省略：使用公共文本检索
        limits=DiscoveryLimits(),
    ),
)
# 原工厂返回的 AuthoringAdapters 中：
# data_context=metadata, semantic_catalog=catalog；其余必需依赖照常装配。
```

上面变量是内部真实实例，不是自动创建的默认适配器。`SemanticCatalog(metadata, store)` 保持基础模式；增强模式缺少可信上下文接口会显式失败。MCP bundle-info 和 deployment report 的 discoveryProtocolVersion 标识是否已装配；它不证明连接或业务验收通过。

公共参考代码在 `examples/adapter_template/`：

- `firstparty/discovery_knowledge.py`：显式读取 mock 业务知识，仅用于本地验证。数据文件为 `examples/semantic-discovery/business-knowledge.mock.json`，含术语、业务说明、主题和 draft 反例。
- `firstparty/discovery_model_http.py`：显式传入 base_url/model/api_key 的 JSON 模型调用样例；无隐式环境读取。输入带公共提案 Schema，异常脱敏。
- `relay/discovery_context.py`：包装内部已认证消息回调；公司需要提供真正的回调与调用隔离。
- `storage/platform_state.py`：持久化/CAS；`purge_expired_discovery(now)` 是部署维护入口，只清理过期发现记录，不能用于删除查询或保存记录。

已有内部 `adapters/` 不会被公共同步覆盖。按需采用参考文件到对应内部子目录，保留内部认证和业务字段转换。新增依赖写内部 requirements，不改公共依赖。禁止通过 mock namespace 接生产数据。

## 公司知识库怎样转换

`BusinessKnowledgePort.search(binding, query, business_domains, limit)` 必须在内部执行身份/工作空间权限过滤。返回 `contracts/authored/discovery.schema.json` 的 knowledge 定义。可返回结构化 business_term，也可先返回 business_note 文档片段。

Java 已提供的 synonyms/definition 由公共代码使用，不重复人工维护。知识库补充业务语言和经确认的 analysis_topic。metricHints 只能帮助找真实指标，不能创建指标或把相关关系升级为同义。approved/draft 必须取自内部事实；来源/项级版本不应编造。知识查询失败时继续基础检索并返回 knowledgeStatus=unavailable；强制权限规则不能依赖这个可降级端口。

当前源 provider 需正确报告 coverage：complete 表示源读取成功且完整，scope='authorized' 表示覆盖本次配置的授权范围，truncated 表示截断。缺少可靠完整性声明时只返回候选，不自动宣称唯一。新版 Java 公共参考已声明其完整批量接口的范围，内部协议分页/部分返回时必须按实际行为修改。

## 原始消息和跨轮续接

`TrustedDiscoveryContextPort.current(binding)` 返回 invocation Schema。所有值来自可信程序上下文，模型 MCP 参数不能提供它。

首次事件至少包含：formatVersion=1.0、actorId/workspaceId、sessionRef、requestEventId、messageRef、messageText、带时区的 receivedAt、IANA timezone、invocationKind='new'；可有 businessDomains。

续接带 invocationKind='resume'、taskRef、expectedRevision，回答核对卡时另带 interactionId、answer。新轮仍使用新 context_ref；taskRef 恢复需求，不授权。answer 示例：

```json
{
  "kind": "choices",
  "choices": [{"requirementId": "need-1", "optionId": "从核对卡取得的选项ID"}],
  "skipped": []
}
```

也支持 `{"kind":"free_text","text":"用户真实补充"}`。自由文本按真实文本保留；仅在明确表达与一个现有选项名称精确对应时记录 user_text 选择，其余补充重新解析，不伪造成按钮确认。修改需求使用 modify，取消使用 cancel，均带 taskRef/expectedRevision；modify 的 messageText 是用户修改后的可信需求或由内部保留原句及修改意图的明确表达，不接受模型冒充原始用户消息。

同一事件重试必须保持 requestEventId、内容和 binding 一致；返回持久化回执。新的用户动作使用新事件 ID。不同答案争抢同 revision 时一个成功，其余返回 DISCOVERY_REVISION_CONFLICT；应刷新卡片，不重放修改。处理租约过期可恢复，只读重算不会自动执行查询或保存。

记录按 owner/session/page 校验。跨页面或跨租户继续必须重新建立需求，本版没有自动迁移接口。任务过期后不能用旧事件重新创建；部署方按保留策略调度清理。默认TTL 24小时只是示例部署默认，应按公司策略配置。

## Relay 如何呈现

MCP `content` 和 `structured_content.modelSummary` 仅含有界发现摘要；`structured_content.interactionEnvelope` 是程序交互数据。Relay 只把 modelSummary 放入模型上下文，将 interactionEnvelope 转成取数核对卡或等价文本。标准 MCP 客户端未必隔离 structured_content，因此生产 Relay 必须实现这项路由；外泄的交互 ID 本身仍不能授予确认权限。

一次需求修订最多主动展示一张卡，合并业务域、指标选项、时间、维度与未完成项。提交一次后，未解决项暂停；用户主动修改/继续才再处理，不循环追问。discovery.readyRequirementIds 和 pausedRelations 用于解释可继续/暂停部分，不能把 partial 画成全部完成。

用户选的是业务口径，不能通过“忽略”按钮覆盖 conflicted。选择回执不是查询授权；形成精确请求后仍需 AnalysisAuthorizationPort 确认 requestSha256/binding/dataContextVersion。与取数核对范围一致的情况下共用一次用户动作，不能将一个泛化选项用于批准任意新查询。

## 已实现范围和限制

- 基础：名称/别名的句内匹配、口径文本召回、按需求分组、主题展开；无向量/定时索引。
- 模型：有界候选解释、来源验证、预算与降级。只作为建议；不能自动确认。检索是有限文本规则，尚不等于完整自然语言理解。
- 冲突：来源中的显式冲突和退款/税等明确极性规则；不能自动证明任意两段口径语义等价。有疑点通过 unresolved/取数核对处理，真实公司语料效果仍需验收。
- 续接：持久化原始需求/选择/证据、单记录 CAS、租约、幂等、TTL 和新版 context_ref 校验。默认整个依赖版本变化保守失效，不做复杂的细粒度等价证明。
- 外部检索：本版 retrieve 返回 dataContextVersion 与 candidateRefs；引用须在当前已授权源资料中存在。当前外部候选补充到首个需求组；多需求精确分组仍由公共规则和可选解释模型处理。这是初期排序/召回桥接；直接远程全库分页索引仍须公司接口提供可验证源资料与完整性语义。
- 查询：query_issues 不再调用 discover。增强任务对应的未解决选择不能执行；基础旧请求继续遵循已有查询授权及严格/宽松策略。查询仍可能只读元数据核对版本，不调用解释模型。

没有修改 Page Schema，也没有给知识库自动写回或治理系统发通知。真实DS调用、本地mock流程、公司生产接通是三种独立证据。

## 必要验证

先用明确 mock 配置验证发现和续接，再替换内部知识/模型/Relay adapter。建议只跑本批 focused discovery tests 和创建/调整各一条；不要为了接入重复跑整个仓库。验收事实与运行路径见本批 [实施记录](docs/plan/semantic-discovery/IMPLEMENTATION.md)。

# 发现与查询字段契约

平台协议 2.0，页面写出 6.68。公开模型参数的精确类型、required、分支和默认值见 `tool/discover_data_context`、`tool/query_data` 的 inputSchema；数据上下文完整结构见 `product/data-context/schema`，发现信封各定义见 `authoring/authored/discovery.schema`。业务元数据不是本包固定数据。

| 字段 | 方向、形状与含义 | 前提、错误与例子 |
|---|---|---|
| context_ref | 模型工具输入 string，可信程序签发的本轮引用 | 不授予身份；跨轮/页/身份引用拒绝。例子 context-current 是占位，不能用于执行 |
| dataContextVersion | discover 模型摘要输出 string；query.request 必填输入 | 元数据快照版本，须精确匹配，变化报 DATA_CONTEXT_VERSION_CHANGED；不是 Schema 版本或计划确认值 |
| validationMode | query 模型摘要输出 strict / relaxed | 可信配置每批固定，默认 relaxed；不是模型参数。relaxed 不放松授权、结构或结果类型，warnings/normalizations 仍需消费。配置无效报 QUERY_VALIDATION_CONFIG_ERROR |
| discoveryProtocolVersion | 支持 v1 的 discover 模型摘要输出 1.0 | 普通回退没有此字段。实际 Adapter 声明能力；不可从平台版本推定 |
| readyRequirementIds | discovery 模型摘要输出需求 ID 数组 | 属于就绪集合，不是 query 输入。resolved 只证明语义选择；程序仍验证精确查询授权。pausedRelations 不执行 |
| interactionEnvelope | structured_content 程序通道输出 | 不进入模型参数；Relay 呈现可信确认交互。信封包含 kind=metriccanvas.discovery-review、formatVersion=1.0、taskRef、interactionId、items、constraints、actions；actions 为 confirm/modify/skip_independent/cancel。可信回传形状见 discovery.schema 的 invocation：requestEventId、taskRef、expectedRevision、interactionId、answer，非 MCP 参数。旧 revision、错误交互/事件及跨作用域会拒绝，不伪造确认 |
| businessDomain | discover 业务域，query.requests[] 必填 string | 使用实际规范域，非 business-report/usage-report 场景枚举；例子“合成业务域”只演示形状。未发现/歧义域不能猜名替代 |
| queryBinding | discover.dimensions[] 模型摘要输出对象 | groupBy 是分组编码；非时间维度的 filterDimension 是过滤编码；时间维度的 timeGranularities 是可信粒度集合。展示 label/source/modelId 不代替编码 |
| granularities | discover 时间维度输出数组 | 来自真实时间能力。月 YYYY-MM、日 YYYY-MM-DD；只支持实际声明粒度，不从 frequency 猜测。查询日期还受 request Schema 与产品预检约束 |
| metricCompatibility | discover 维度卡输出 unknown（普通目录投影）或已验证能力 | unknown 不等于 supported/unsupported；域级维度并集不证明单指标可组合。实际组合由发现证据、可信授权和 DQE 回执确定 |
| detailRef / detail_refs | discover 输出精确详情引用；工具输入 list[string] 或 null | 绑定工作区、模型、指标和元数据版本；详情过期/身份不符需重新发现，不借用近似指标 |
| resultRef / result_ref | query 输出结果引用；已有结果读取输入 | request 与 result_ref 二选一；引用绑定本轮、身份、页和元数据版本。不能用作永久资产 |
| coverage / status / issues | 模型摘要及程序输出的覆盖和诊断 | partial 保留成功来源，不代表本次数据行截断；unavailable/失败不等于无指标。unknown、unsupported、empty、零和失败分别表达 |
| complete / truncated | query 模型证据覆盖布尔值 | 与 coverage.resultComplete（程序完整结果）、sampleTruncated（模型样本）区分；totalCount 未知不证明全量。占比、排行不能由子集冒充整体 |

可信输入：身份、taskRef、计划授权、元数据提供方、validation policy 和 discovery trustedContext 由程序管理；查询体/原始响应/完整页面不进入模型。发现结构 Schema 是程序协议，不意味着 `$defs` 中全部对象都可作为 MCP 参数传入。

例子：先读取 discover 摘要的实际业务域、queryBinding 和 dataContextVersion，再构造 query.request；请求中的 requests 一批最多 6 个，完整约束由活动 inputSchema 给出。工具返回 readyRequirementIds 不授权数据访问，用户自然语言“确认”也不替代绑定 requestSha256 的可信授权。

来源：公共 semantic_catalog、validation_policy、results、discovery/service/contracts 与活动 platform_mcp 注册。对应源码变动参与内容身份和生成漂移检查；部署 Adapter 的真实能力与凭据由部署回执证明。

信封 items 包含 requirementId、expression、status、options；options 包含 optionId、requirementId、metricRef、label、businessDomain、definition。taskRef/revision 和 interactionId 由程序保存/关联；旧 revision 不自动合并，确认引用不匹配报 DISCOVERY_REVISION_CONFLICT / DISCOVERY_INTERACTION_STALE / DISCOVERY_EVENT_MISMATCH 等结构化诊断。

## 时间契约与可修复诊断

- `year`：`YYYY`；`month`：`YYYY-MM` 或 `YYYYMM`；`day`：`YYYY-MM-DD` 或 `YYYYMMDD`。`M` 等价于 `month`。日历必须有效，起点不晚于终点；不同精度不能转换。`month + 20260401/20260930` 必须修正输入，不能自动删掉日。
- 公共层将合法紧凑格式规范为 ISO 后再授权、计算结果身份和生成查询；返回 `normalizations`。strict/relaxed 均执行日期结构、日历和范围检查。结果校验策略身份为 `query-validation/2`；旧结果仍可读取，作为新装配依据时需当前策略下重查。
- 错误的 `pathScope=input` 路径从 `/requests/<index>` 定位，包含安全 `message/action/recoveryOwner`。`retrySafe` 沿执行失败分类，不自动重试确定性错误或换域。上游原始报错、SQL、凭据不回显。
- 域内找不到指标时，`domainCandidates.items` 仅含当前授权快照的精确同名/受治理别名，以及来源口径说明和单位。`snapshotComplete=false` 或 `truncated=true` 不能当成穷尽；`executionReadiness=not_checked` 与兼容性未知不代表可执行。选择候选会形成新请求并重新授权，派生指标不自动替代基础指标。
- 结果引用在新批次复用时按本次请求索引定位；直接读取结果引用的诊断路径相对于其 `scope`。来源未变不意味着无需授权、当前轮次或数据上下文核验。

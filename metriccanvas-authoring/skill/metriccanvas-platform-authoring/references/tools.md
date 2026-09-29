# 工具与部署契约

本 Skill 使用 `metriccanvas-platform-content`，部署接口标识 `platformProtocolVersion=2.0`；页面输出遵循 Schema 6.11。模型以实际 list_tools 返回的 JSON Schema 为参数真源。

| 工具 | 输入与行为 |
|---|---|
| read_page_context | context_ref，必要目标/选择与分页；向 Java 核对当前资源后返回 pageId、ref、配置投影及 workVersion，不执行业务查询 |
| discover_data_context | context_ref、query、limit，可选精确 detail_refs；返回相关定义与缺口 |
| query_data | context_ref，加 request 或 result_ref 二选一。request 含 question、dataContextVersion、requests，可选补查 reason；返回范围、有界证据与 resultRef |
| compose_page | context_ref、request、expected_version。request 含 title、layout、sources、sections；新建合法页面并内部保存 |
| edit_page | context_ref、page_id、request.operations、expected_version；page_id 必须等于 read_page_context.pageId，向 Java 核对工作稿基线后局部修改并内部保存 |
| page_metadata_emit_preview | context_ref、artifact_ref；准备该已保存产物的预览，不查数、不保存 |
| extract_page_parameters | context_ref，可选 artifact_ref；从当前工作稿或精确产物提取经验证的参数选项，返回 extraction_ref |
| apply_page_parameter_selection | context_ref、extraction_ref、selected_ids、text_choices；生成临时模板并返回 artifact_ref，需要人工确认，不自动保存或发布 |
| resolve_page_parameters | context_ref、values，可选 artifact_ref；填充参数并返回 instance_ref，不执行查询、不保存 |

所有写入基于程序注入的身份和基线。工作稿按版本竞争检查，提交 document/base/operationId 冻结。draftId 映射保存回执 ref.resourceId，ref.pageId/ref.revisionId 保持独立；不能互相替代。

只有 modelSummary 进入模型通道。query_data 的有界行证据需计划确认和模型数据策略授权；完整响应、SQL、查询体和页面产物不进入模型。document 保存查询定义而不带 query initial；previewJson 可带本次有效 initial。静态 inline 内容属于页面定义，照常保留。

工具列表、Schema、Skill、Bundle 版本一起切换。部署就绪检查区分提供方装配与当前轮次有效：启动时须有轮次提供方，但不需要已有用户轮次。缺轮次、工作存储、查询授权、数据上下文/DQE、保存服务或交接 Adapter 时按受影响操作报告不可用。一般结果字段契约从现有事实派生；额外字段描述仅在真实重命名或尺度语义有依据时选配。参数未配置不阻塞主流程。工具 ready 表示交接 Adapter 接收精确产物，不等于用户已看到页面。

## 页面身份与新鲜度

`page_id` 是模型声明的目标校验值，不授予权限；`context_ref` 绑定已认证身份、工作区、创作轮次和 pageId。`expected_version` 只约束本轮工作稿，不能代替 Java revisionId。

集成程序依据用户打开的 pageId 解析当前资源，读取 Java 的完整页面及精确 `resourceId/revisionId`，构造创作基线。工具在读配置和修改前用 `current_match(identity, ref)` 再读当前资源，并比较精确 ref 与页面定义。真实适配器调用现有 `GET .../user-page-metadata/{resourceId}`；没有提供方或读权限就失败，不使用会话摘要替代。

检测到其他人修改、内容不一致或资源切换时，返回 CURRENT_PAGE_STALE / CURRENT_PAGE_MISMATCH，交集成程序重新获取当前页面并新建创作轮次。保存仍提交 `base_revision_id`，由 Java 原子拒绝读取之后的竞争写入。同轮保存成功后，下一次修改用保存回执的新 ref 核对；查询初始样例行不参与页面定义比较。这样不会用重新读取来抹掉本轮已保存的工作。

## 语义元数据发现

Java 原始指标语义层使用批量 query-dataset-from-lab 查询，由部署方指定空间和数据集范围。query 与 limit 用于本地筛选语义卡片，不是后端搜索参数。模型只消费定义、单位、维度及已确认来源，完整模型和物理 SQL 留在程序侧。

检查 status/coverage/issues：部分数据集失败时保留成功结果并说明覆盖缺口；全部失败不解释为“没有这个指标”。查询接口 DB 优先、未命中回源，不能声称已主动刷新 Lab。detailRef 绑定工作区、模型、指标和元数据版本，来源改变后重新发现。缺失单位、frequency、definition 或空维度保持 unknown。

同轮已发布的元数据由已接入快照复用的 Adapter 缓存；查询与组装继续消费同一版本。部分 dataset 失败时，工具可先仅补取失败来源一次，再固定可用部分快照；不要反复发现试图刷掉缺口。已发现的可用业务域仍可查询，DATA_CONTEXT_PARTIAL warning 表示元数据覆盖不完整，不等同于本次结果行被截断。缺失域仍需补充来源，不能猜名替代。摘要未覆盖所需定义时可补发现，已有规范名与版本直接复用。dimensions[].queryBinding 明确 groupBy 与 filterDimension 的输入值，label/source 标识用于说明与来源定位。


## 组件与结果证据

先根据 query_data 的字段 ID、行形状和 coverage 选表达，再提交组件：

`coverage.resultComplete` 描述程序保存的查询结果是否完整；`coverage.sampleTruncated` 描述给模型的样本是否缩短。`complete`/`truncated` 仍描述模型证据覆盖。`resultComplete=true` 时，即使 shownCount=20、returnedCount=totalCount=41 且 complete=false，工具仍可用完整 41 行验证饼图；不能写成“查询只返回20行”。totalCount=null 或 returnedCount<totalCount 时，程序结果才缺少完整性证明。

| 目的 | 输入要求与选择 |
|---|---|
| 总量卡 | 单行总量直接绑定 measure，可包含多个指标；无需 dimension 或 match |
| 指定对象卡片 | 多行结果使用 dimension 的 match，工具必须验证恰好命中一行；字段和取值取自证据 |
| 完整占比 | pieChart 使用工具验证的完整结果；模型只看到 20 行样本并不表示程序只保存 20 行。totalCount 未知或实际分页缺行时无法证明完整占比 |
| 时间趋势 | lineChart 使用实际时间分组字段；仅有时间筛选的类别分布仍是类别分布 |
| 类别对比/明细 | barChart/table 可展示返回数据；结果不完整时说明覆盖范围，不能称作全量排名或完整占比 |

STRUCTURE_INCOMPLETE_PROPORTION / STRUCTURE_ROW_SELECTION_UNVERIFIED 时复用现有 resultRef 调整到可验证的表达，或在业务计划允许时重查受影响项。完整性由程序结果证明，模型不提交 rows 或 complete 标志。STRUCTURE_FIELD_NOT_FOUND 时使用返回的字段 ID 修正绑定；不为总量卡虚构账期字段或添加无意义分组。

查询使用发现返回的规范名与 queryBinding。DATA_CONTEXT_NAME_AMBIGUOUS 时从当前授权候选中选择明确指标；意图仍不清楚则澄清。相同别名可能属于多个指标，strict/relaxed 都不会自动选第一个。

独立取数在工具当前批次上限内合并；同轮修改按当前 workVersion 和操作依赖合批。依赖尚未返回的 resultRef 或后续 workVersion 时分步执行。失败按 issues.action/retrySafe 处理，成功结果复用；跨轮引用交集成程序核对，保存 unknown 核对原提交。

格式消费可信字段单位、币种、尺度及受支持的 defaultFormat；原始值保持不变。缺失货币信息时保留未知，“流水”名称不能证明人民币。工具返回 SCOPE_NOTE_REVIEW_REQUIRED 时核对变更后的口径说明；人工修改过或新轮基线中的历史说明需要显式受控编辑，不由工具猜测删除。

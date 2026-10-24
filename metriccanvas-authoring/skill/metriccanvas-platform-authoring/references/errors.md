# 错误处理

MC 内容与布局能力的诊断说明；下面的修复方向供调用方决策，不代表保存、发布或整包采用已经完成。

- DECLARED_REQUIREMENT_GAP / MANDATORY_COMPONENT_DEGRADED：声明的必须组件未满足或被替换；对照 expected/actual 与 origin 修正计划或报告能力缺口，由 Skill 决定后续流程。
- DATA_ROLE_BINDING_GAP：已声明的数据源、字段或容器关系未保留；依据受控字段证据核对绑定，不能用模板示例值补缺。
- SCENE_MISMATCH_GAP：计划与模板的 pattern 显著不匹配；这是建议，可调整模板引用或保留已经确认的自由布局。
- LAYOUT_DEFAULT_NOT_APPLICABLE：模板缺省不适用当前显式节点分支，已略过该缺省并保留显式选择；这是调整说明。
- LAYOUT_DEFAULT_FILLED / OPTIONAL_NULL_OMITTED：分别表示补入展示缺省或省略可选 null；核对 adjustments 即可，不代表数据口径发生变化。
- INPUT_SCHEMA_INVALID / COMPILER_INPUT_INVALID / QUERY_ARGUMENTS_INVALID / QUERY_OPTIONS_INVALID / TARGET_VERSIONS_INVALID：按 path 与 Interface 说明修正输入；参数类型和可选项固定，不接受任意表达式或路径。
- PLAN_SECTIONS_REQUIRED / PLAN_SECTIONS_EMPTY / PLAN_SECTION_BLOCKS_REQUIRED / PLAN_SECTION_ID_REQUIRED / PLAN_BLOCK_ID_REQUIRED / PLAN_BLOCK_TYPE_INVALID / PLAN_ID_CONFLICT：提交完整计划、稳定且唯一的节点 id 和明确块类型；缺省填充不自动补回节点。
- CATALOG_ENTRY_NOT_FOUND / TEMPLATE_REFERENCE_INVALID / TEMPLATE_VERSION_MISMATCH：查询当前 catalog 与模板标识，按 scene、variant、templateVersion 精确引用。
- TEMPLATE_NOT_EXECUTABLE：该场景只有计划或设计资源；当前不能编译，可选择已实现模板或报告目录中声明的能力缺口。
- TEMPLATE_INVALID / TEMPLATE_ID_CONFLICT / TEMPLATE_PIN_UNRESOLVED / TEMPLATE_DEFAULT_INVALID / TEMPLATE_PATTERN_INVALID：MC 模板自身不符合当前结构或契约，需要 MC 修正作者源并重新导出完整包。
- CONTENT_VERSION_MISMATCH / INSPECTION_CONTENT_MISMATCH / CONTENT_ALIGNMENT_MISMATCH：内容、工具版本或检查声明不匹配；核对完整清单和真实目标版本，由调用方选取一致的包与检查上下文。
- CONTENT_INTERFACE_UNSUPPORTED / CONTENT_MANIFEST_INVALID / CONTENT_RESOURCE_UNAVAILABLE / CONTENT_RESOURCE_MISMATCH / CONTENT_RESOURCE_SET_MISMATCH / CONTENT_SNAPSHOT_MISMATCH / RESOURCE_PATH_INVALID：安装资源不可用、不完整或不一致；整体替换并重新载入脚本，需要时由 MC 修正导出，不拼装零散文件。
- CONTENT_KEY_UNKNOWN / CONTENT_TOPIC_UNKNOWN：从本包 index 查询有效主题与 key；动态服务错误仍以真实结构化回执为准，不能猜测未知码的专门修复策略。
- PAGE_INSPECTION_UNAVAILABLE / PAGE_UPGRADE_UNAVAILABLE / INSPECTION_UNAVAILABLE：输入或执行环境不足以完成该项；核对 Node、依赖和具体 issues，保留未验证状态，不把未运行当作通过。
- ASSEMBLY_INPUT_INVALID / INSPECTION_SPEC_INVALID / UPGRADE_INPUT_REQUIRED：程序通道提供完整产物和同次编译的检查声明，文件升级明确指定输入；完整页面不经模型回传。

- ANALYSIS_PLAN_NOT_CONFIRMED：回到计划审核，由程序取得用户确认；不重复查询。
- MODEL_EVIDENCE_UNAVAILABLE：模型证据通道未授权，不退回读取完整产物。
- METRIC_DEFINITION_CONFLICT：说明具体口径矛盾，仅停止受影响项；不偷偷修公式。
- RESULT_SCOPE_MISMATCH：按 path 核对是否原样使用本轮 resultRef；格式本身无需程序额外注入。若引用正确，交集成程序检查稳定轮次与共享存储，保留已有成功项。
- RESULT_VERSION_STALE：只核对并更新受影响的取数项。
- QUERY_ITEM_INVALID / STRUCTURE_BLOCK_INVALID：按路径修正失败项，复用成功结果；页面已保存时用 edit_page 修复。
- PRESENTATION_DEFAULTED / COMPONENT_FALLBACK_TABLE：工具已采用默认展示或同字段表格，检查实际结果后继续交付。
- SOURCE_DESCRIPTION_UNAVAILABLE / 查询拒绝：保留错误范围；不自动删筛选或改指标。
- AUTHORING_BUDGET_EXHAUSTED / 相同无进展错误：终止对应分支，说明未完成部分。
- WORK_VERSION_CONFLICT / WORK_BUSY：读取工作稿状态；并发或迟到结果不能覆盖新工作。
- SAVE_RECONCILIATION_REQUIRED / unknown / pending：原写入可能已生效，停止提交；程序核对原冻结记录。
- 保存 rejected：保留工作并报告原因；不能换入口绕过。
- PREVIEW_ARTIFACT_MISMATCH / RELAY_PREVIEW_UNAVAILABLE：保存与预览分别报告，只修复匹配产物交付。

可依据具体反馈局部修正；相同无进展错误暂停该分支，其他合法成功部分继续保存。无变化不应报告生成了新修订。

- CURRENT_TURN_PAGE_MISMATCH：page_id 与可信轮次不符，停止；不得修改 context_ref 来扩大范围。
- CURRENT_PAGE_UNAVAILABLE：Java 当前读取未接通或不可达，停止编辑，不沿用缓存基线。
- CURRENT_PAGE_STALE / CURRENT_PAGE_MISMATCH：当前修订或定义已改变，由集成程序重新读取并建立新轮次；不自动重放旧 operations。

- DATA_CONTEXT_AUTH_REQUIRED / DATA_CONTEXT_FORBIDDEN / DATA_CONTEXT_SCOPE_MISMATCH：停止发现，交集成程序检查本轮身份与工作区，不切换服务账号。
- DATASET_METADATA_FAILED / DATASET_METADATA_MISSING：对应数据集未成功读取，说明 partial 覆盖缺口；不将其解释为零指标。
- DATA_CONTEXT_PARTIAL / DATA_CONTEXT_GOVERNANCE_REQUIRED：当前元数据不足以执行查询；补齐访问或治理配置，不猜单位与执行属性。
- METRIC_DETAIL_STALE：指标所属模型已变化，重新发现取得新引用，不给旧指标补上新模型的数据。

- DATA_CONTEXT_NAME_NOT_FOUND / DIMENSION_NOT_IN_DATA_CONTEXT / METRIC_NOT_IN_DATA_CONTEXT / TIME_GRANULARITY_NOT_IN_DATA_CONTEXT：读取 candidates 和失败阶段，按发现的规范名与粒度修正；同请求重复调用不解决问题。不得删除地域/时间条件换取成功。
- RESULT_VALIDATION_POLICY_CHANGED：结果来自不同校验策略，重新确认并取数后用于页面；旧引用仅作带原模式的历史证据。
- QUERY_VALIDATION_CONFIG_ERROR：交部署方修复可信配置；模型不能切换校验策略或伪造参数。

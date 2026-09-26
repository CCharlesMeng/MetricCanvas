# 错误处理

- ANALYSIS_PLAN_NOT_CONFIRMED：回到计划审核，由程序取得用户确认；不重复查询。
- MODEL_EVIDENCE_UNAVAILABLE：模型证据通道未授权，不退回读取完整产物。
- METRIC_DEFINITION_CONFLICT：说明具体口径矛盾，仅停止受影响项；不偷偷修公式。
- RESULT_SCOPE_MISMATCH / RESULT_VERSION_STALE：引用失效，重新核对当前身份、页、轮次和版本；不搜索“最近结果”。
- SOURCE_DESCRIPTION_UNAVAILABLE / 查询拒绝：保留错误范围；不自动删筛选或改指标。
- AUTHORING_BUDGET_EXHAUSTED / 相同无进展错误：终止对应分支，说明未完成部分。
- WORK_VERSION_CONFLICT / WORK_BUSY：读取工作稿状态；并发或迟到结果不能覆盖新工作。
- SAVE_RECONCILIATION_REQUIRED / unknown / pending：原写入可能已生效，停止提交；程序核对原冻结记录。
- 保存 rejected：保留工作并报告原因；不能换入口绕过。
- PREVIEW_ARTIFACT_MISMATCH / RELAY_PREVIEW_UNAVAILABLE：保存与预览分别报告，只修复匹配产物交付。

只作一次有依据的页面修复；依赖失败会 skipped，其他合法成功部分可保存。无变化不应报告生成了新修订。

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

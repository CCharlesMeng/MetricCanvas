# 错误处理

- ANALYSIS_PLAN_NOT_CONFIRMED：回到计划审核，由程序取得用户确认；不重复查询。
- MODEL_EVIDENCE_UNAVAILABLE：模型证据通道未授权，不退回读取完整产物。
- METRIC_DEFINITION_CONFLICT：说明具体口径矛盾，仅停止受影响项；不偷偷修公式。
- RESULT_SCOPE_MISMATCH / RESULT_VERSION_STALE：引用失效，重新核对当前身份、页、轮次和版本；不搜索“最近结果”。
- SOURCE_DESCRIPTION_UNAVAILABLE / 查询拒绝：保留错误范围；不自动删筛选或改指标。
- AUTHORING_BUDGET_EXHAUSTED / 相同无进展错误：终止对应分支，说明未完成部分。
- WORK_VERSION_CONFLICT / WORK_BUSY：读取工作稿状态；并发或迟到结果不能覆盖新工作。
- SAVE_RECONCILIATION_REQUIRED / unknown / pending：原写入可能已生效，停止提交；程序核对原冻结记录。
- 保存 rejected：保留工作并报告原因；不能转兼容入口绕过。
- PREVIEW_ARTIFACT_MISMATCH / RELAY_PREVIEW_UNAVAILABLE：保存与预览分别报告，只修复匹配产物交付。

只作一次有依据的页面修复；依赖失败会 skipped，其他合法成功部分可保存。无变化不应报告生成了新修订。

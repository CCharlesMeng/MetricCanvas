# 创建页面

1. 确认用户要新建或另建，以及可信程序分配、mode=new 的 contextRef。已有页追加转本 Skill 的[修改流程](edit.md)。
2. 按用户明确选择使用 report/dashboard；阅读分析报告采用 [report](../references/layouts/report.md)，持续监控采用 [dashboard](../references/layouts/dashboard.md)。用途不明确则澄清；说明选择并始终显式传 layout。
3. 数据页面：discover_data_context(context_ref, query) 核对业务域、指标/维度、口径、时间及 dataContextVersion。消歧完成后把取数单元交 compose_page(context_ref, spec, layout)。缺能力说明缺口，不造字段、查询或数据行。
4. 静态正文或已有可信源上的内容：create_content_page(context_ref, title, request, layout) 接收受控 add recipe。静态 text 不需发现；新建空基线没有可信数据源，因此依赖已有字段/地图的创建需求当前明确受阻，不能提交 source_token 或伪造数据。具体支持面见[工具约定](../references/tools.md)。
5. 普通摘要用 text；只有用户明确要求运行时流式摘要，且 prompt/relatedData 与部署 AiSummaryConfig 齐备时才用 aiSummary。标题含“AI”不决定组件类型。
6. 混合新数据图表和静态内容当前不能一次表达完整组合；需要后续候选链能力；当前统一入口明确阻塞这条组合路径，不能以旧工厂或重复新建绕过。模型不搬运完整页面或自行拼 token。
7. 以 modelSummary 和真实交接结果结束：生成、部分成功、失败分别说明，未完成项明确。生成产物不等于已保存。

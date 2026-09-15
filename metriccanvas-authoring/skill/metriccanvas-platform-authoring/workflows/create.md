# 创建页面

1. 确认用户要新建或另建，以及可信程序分配、mode=new 的 contextRef。已有页追加转本 Skill 的[修改流程](edit.md)。
2. 按用户明确选择使用 report/dashboard；阅读分析报告采用 [report](../references/layouts/report.md)，持续监控采用 [dashboard](../references/layouts/dashboard.md)。用途不明确则澄清；说明选择并始终显式传 layout。
3. 数据页面：discover_data_context(context_ref, query) 核对业务域、指标/维度、口径、时间及 dataContextVersion。消歧完成后把取数单元交 compose_page(context_ref, spec, layout)。缺能力说明缺口，不造字段、查询或数据行。
4. 完整组合或静态正文：create_content_page(context_ref, title, request, layout) 接收受控操作数组。用 add_data_component 添加单单元数据图表，用 add_text 等添加正文，用 set_component_layout/move_component 明确占位和顺序；目标为 main，自动 page-header 不可修改。静态 text 不需发现；字段型内容须引用该候选中真实存在的源/字段，不能提交 source_token 或伪造数据。具体支持面见[工具约定](../references/tools.md)。
5. 普通摘要用 text；只有用户明确要求运行时流式摘要，且 prompt/relatedData 与部署 AiSummaryConfig 齐备时才用 aiSummary。标题含“AI”不决定组件类型。
6. 混合内容可在一个 create_content_page 请求中完成，依赖前序操作用 dependsOn；数据失败时独立正文仍可成功，依赖项跳过。如需先核实生成的字段ID，先取得数据候选，再用 read_page_context/ edit_page 与 candidate_ref 补充内容。模型只传引用与受控操作，完整页面由程序保留。
7. 以 modelSummary 和真实交接结果结束：生成、部分成功、失败分别说明，未完成项明确。生成产物不等于已保存。

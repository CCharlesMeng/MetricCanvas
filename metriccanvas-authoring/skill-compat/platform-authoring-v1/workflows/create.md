# 创建页面

1. 确认用户要新建或另建，以及可信程序分配、mode=new 的 contextRef。已有页追加转本 Skill 的[修改流程](edit.md)。
2. 按用户明确选择使用 report/dashboard；阅读分析报告采用 [report](../references/layouts/report.md)，持续监控采用 [dashboard](../references/layouts/dashboard.md)。用途不明确则澄清；说明选择并始终显式传 layout。
3. 完整报告先读[场景与结构](../references/scenarios.md)，以业务主题组织章节。用 discover_data_context 核对业务域、指标/维度、口径、时间及 dataContextVersion；已知业务域可用 business_domain 分页枚举能力，避免猜词反复检索。提交 create_content_page 的 request.plan，让多个取数单元进入同章、一个源绑定多个组件；快速取数结果才用 compose_page 的默认口径分区。缺能力说明缺口，不造字段、查询或数据行。
4. 完整组合或静态正文：create_content_page(context_ref, title, request, layout) 接收受控操作数组。用 add_data_component 添加单单元数据图表，用 add_text 等添加正文，用 set_component_layout/move_component 明确占位和顺序；目标为 main，自动 page-header 不可修改。静态 text 不需发现；字段型内容须引用该候选中真实存在的源/字段，不能提交 source_token 或伪造数据。具体支持面见[工具约定](../references/tools.md)。
5. 普通摘要用 text；只有用户明确要求运行时流式摘要，且 prompt/relatedData 与部署 AiSummaryConfig 齐备时才用 aiSummary。标题含“AI”不决定组件类型。
6. 混合内容可在一个 create_content_page 请求中完成，依赖前序操作用 dependsOn；数据失败时独立正文仍可成功，依赖项跳过。如需先核实生成的字段ID，先取得数据候选，再用 read_page_context/ edit_page 与 candidate_ref 补充内容。模型只传引用与受控操作，完整页面由程序保留。
7. 核对 modelSummary 的逐项结果，部分失败只修受影响内容；复用已生成候选中的源时用 add_source_component，不重复取数。检查量纲、期间、实际/预测区分和说明是否在页面可见，生成产物不等于已保存。

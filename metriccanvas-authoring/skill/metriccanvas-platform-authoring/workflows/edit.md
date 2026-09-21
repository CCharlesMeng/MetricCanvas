# 修改页面

read_page_context 定位当前章节/组件、workVersion 和必要配置。使用同一修订的 nextCursor 补读；明确目标优先于选中目标。缺完整基线时停止，不能凭截图或摘要重建。

样式、标题、列宽：直接 edit_page(request={operations}, expected_version=workVersion)，保持未授权内容；不查业务数据。

数据修改：从当前页面和修改意见形成分析需求，回到[数据分析](data-analysis.md)共同计划审核与证据流程。query_data 返回后用 add_result_component(resultRef, sectionId, block) 局部添加。复用当前页面已有源只需 add_source_component。需要替换旧内容时使用显式依赖操作，先确保新内容成功，失败依赖会跳过。

普通操作按工具 Schema 执行；新增章节用 add_section，重排用 move_section/remove_section。删除章节须列出已观察到的全部 componentIds；页头受保护。批次中独立成功部分保留并保存，失败部分回滚；不要用重建整页绕过失败。

区分 changed/partial/unchanged 与 saveStatus。保存成功后走主 Skill 的 Relay 预览交付。未知保存不重发，预览失败不保存；需要恢复时由可信程序核对冻结的原提交。

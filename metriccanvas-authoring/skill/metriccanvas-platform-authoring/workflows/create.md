# 新建页面

1. 读取本轮可信 context_ref，调用 read_page_context 获取 pageId/workVersion；只有 mode=new 的空基线可创建。工具负责校验 mode，已有页的“增加图表”进入[修改流程](edit.md)。
2. 纯文本页面直接形成 sources={} 的结构；数据页面先完成[数据分析](data-analysis.md)的计划审核和证据读取。sources 将页面数据源 ID 映射到本轮 resultRef，同一来源可供多个内容块复用。
3. 按读者的问题组织 title、layout、sections，参考[场景](../references/scenarios.md)。字段来自工具证据；标题说明对象与期间；不能用无证据的数值、同比或因果结论填满版面。
4. 调 compose_page(context_ref, request, expected_version=当前workVersion)。检查 status、operations、issues 与 saveStatus。核心证据不足不生成核心结论；辅助缺口可用可见说明交付 partial。
5. 页面有效且定义变化才会内部保存。最多一次定向修复：重新读取 workVersion，用 edit_page 和已读 pageId 修复当前工作稿，不能重复 compose 或重新取数掩盖装配错误。
6. saveStatus=saved 且 ref/draftId/artifactRef 完整后，准备匹配 artifactRef 的预览。ready 后原样输出主 Skill 的两个标记；其他状态据实说明未完成项。

冲突、未知保存、被拒绝或预算耗尽立即停止对应分支。保存回执、预览回执、业务证据和最终结构共同构成完成依据，见[执行检查点](../references/execution.md)。

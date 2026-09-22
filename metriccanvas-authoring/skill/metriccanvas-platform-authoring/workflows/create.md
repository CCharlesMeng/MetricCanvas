# 新建页面

可信上下文 mode=new 才新建。纯文本页面直接 compose_page，sources={}，不发现、不取数。

数据页面先按[数据分析](data-analysis.md)审核计划并取得结果引用。随后 compose_page(request)：title、layout、sources（页面源 ID 到 resultRef）、sections。同一来源可支持多块内容，章节按阅读问题组织；参考[场景](../references/scenarios.md)。数据块的字段只引用工具证据，不能猜字段或造数据。

检查生成 status、operations 与 saveStatus。合法 partial 会内部保存，明确未完成项；核心结论仍须有证据。最多一次定向修复，受程序共享预算约束；先读取 workVersion，使用 edit_page 修复当前工作稿，不重新创建整页。

已保存则按主 Skill 调用匹配 artifactRef 的预览工具并原样输出两个标记。保存未知、冲突或被拒绝时停止；完整产物由程序保留，模型不调用独立保存工具。

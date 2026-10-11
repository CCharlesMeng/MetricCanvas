# 页面参数流程

页面文档遵循当前产品 Schema 与读取兼容边界。页面 JSON 只在程序通道流转，baseline、dimensionIdentities、timeIdentities 和 timePointFields 由可信提供方管理，不向用户索取这些过程字段。

## 提取模板

1. 用本轮 context_ref 调 extract_page_parameters；同轮生成/编辑结果显式传 artifact_ref。成功取得 extraction_ref 后，按候选标签、类型、覆盖范围和跳过项说明可替换内容。candidate_id 是选择键，param_id 才是以后赋值使用的页面参数 ID。
2. 请用户确认候选选择及涉及实例值的文本处理。用返回的 slot_id 定位文本，kind=parameter 时提供候选 candidate_id，kind=literal 时提供通用 text；原值省略时由工作台显示可信原文供审阅，不猜测旧值。模型选择不等于发布确认。
3. 调 apply_page_parameter_selection，selected_ids 使用候选 ID，text_choices 只含已返回的文本位置。成功返回 artifact_ref 表示无值模板已准备；来源改变或引用失效则重新提取，不重放旧选择。
4. 需要预览时，以模板 artifact_ref 调 resolve_page_parameters，values 使用参数 ID 和规范值。可信程序将 instance_ref 交工作台临时运行；取得执行结果后才能报告运行成功。用户在工作台确认后保存原无值模板，不保存预览值。

## 召回后赋值

1. 由外部模板检索/选择提供方打开精确模板，并建立本轮 context_ref；不能用上一轮 artifact_ref 当永久模板 ID。
2. read_page_context 返回参数类型、精度、必需性与 hasValue，不返回已保存值。明确本次全部输入；旧值被省略而无法确认时，请用户提供，不猜测或悄悄沿用。
3. 维度使用真实业务值。timeRange 输入为 start/end/granularity 对象；月份 YYYY-MM，日期 YYYY-MM-DD。年份或区域有歧义先澄清。
4. resolve_page_parameters 失败时按缺值/非法值修正；成功只意味着解析完成。交程序渲染临时实例，不请求保存，不把 instance_ref 传给 edit_page 或普通草稿保存接口。

只有可信保存/发布回执才能报告已保存/已发布。参数工具不提供模板搜索，也不替代缺失的部署提供方。

## 日期候选与报告页头

初次创作按已验证查询生成页面；查询没有日期参数时，页头保持纯展示。`extract_page_parameters` 只识别日期候选，确认选择后由 `apply_page_parameter_selection` 原子增加 `params.query.times`、日期筛选器、查询绑定及报告页头 `filterIds`。按返回的 `dateForm` 说明单个月份、月份范围、单个日期或日期范围；运行时不向读者提供形态切换。

同值文字不能证明多个查询拥有同一期间。按可信日期身份合并候选；已有日期筛选器和参数复用原身份。单点驱动期间、年初至当前或最近 N 期时，窗口必须由创作规格明确声明。返回跳过项时说明缺口，保持原查询。

页面参数只提供实例初值；读者修改日期筛选器后，查询与报告期间文字读取已应用筛选值。无值模板保留参数声明，不保留查询初始数据。新增能力要求 Schema 6.13；修改其他内容时保持已有能力，不降级文档。

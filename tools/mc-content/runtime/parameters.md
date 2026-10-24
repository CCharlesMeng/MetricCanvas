# 参数工具与临时实例

extract_page_parameters 从本轮工作稿或精确 artifact_ref 提取；extraction_ref 与来源绑定。candidate_id 是选择键，param_id 是页面赋值 ID；slot_id 是返回的文本位置。apply_page_parameter_selection 的 selected_ids 使用候选 ID，text_choices 只引用已返回的 slot_id；kind=parameter 使用 candidate_id，kind=literal 使用 text，精确分支约束见活动工具 inputSchema。来源改变后旧选择失效。

apply 返回 artifact_ref 表示无值模板准备完成，不表示保存/发布。resolve_page_parameters 的 values 按参数 ID 赋值，返回 instance_ref 表示解析完成；程序用临时实例执行，不把 instance_ref 交 edit_page 或普通草稿保存。模板检索不是参数工具能力；read_page_context 只投影类型、精度、必需性和 hasValue，不提供已保存值。

维度值来自真实业务值。timeRange 为 start/end/granularity 对象；月份 YYYY-MM、日期 YYYY-MM-DD。完整参数形状与工具前置见 authoring/authored/page-parameters-protocol、产品 params 主题和实际参数 Schema。

日期提取与选用分离：提取只识别候选，apply 原子加入 params.query.times、日期筛选器、查询绑定和 reportHeader.filterIds（能力下限由产品 version-policy 给出）。dateForm 固定单月/月范围/单日/日范围，不让读者切换形态。同值文字不证明查询有相同期间；候选由可信日期身份合并，已有身份复用。期间窗口须显式声明，不猜公式。无值模板清除查询初始数据；页面参数只提供实例初值，应用后的筛选值驱动查询与期间文字。

需求选择、文本确认、模板采用及最终交付归 Skill；仅可信保存/发布回执证明对应状态。

# 全表文本搜索定位与修复

`props.toolbar.search.fields` 与 `props.toolbar.search.options` 均按包含匹配搜索。前者匹配所列的任一字段，后者只匹配当前选择的字段，可引用允许搜索的补充数据槽。单选项固定字段并隐藏选择器。已有页面声明可直接沿用。

1. 核对实际页面修订、引擎版本和数据网关。检查每个相关表格、组合源成员和未激活 Tab，确认页面结果字段通过 `queryField` 映射到正确的查询字段。
2. 单字段指标查询默认在 `filter.dims` 追加 `{dim_name,dim_value_list:[关键词],operator:"contains"}`。对象查询在 `filter.fields` 追加 `{field_name,value_list:[关键词],operator:"contains"}`。检查实际请求保留筛选、授权范围、排序和分页。旧引擎可能仍报告“数据网关未配置全表文本搜索能力”。
3. 查询分页的多字段 OR 由部署的 `createDqeGateway({ ...原配置, encodeSearch })` 提供。适配器接收编码了原有条件的 `item`、已映射的 `search.queryFields` 和 `search.query`，按经过真实服务验证的格式添加一个 OR 搜索条件。多条默认 AND 的维度条件无法表达该 OR。
4. 用当前页之外的命中记录验证搜索、匹配总数、分页、清空和 Excel。检查前导零、`%`、`_` 的字面输入及服务端大小写行为。“暂无数据”可来自零匹配或查询失败，用请求回执、`data-error` 和网关诊断区分。

本地和 DQE Sim 可验证组件及请求格式。真实服务还须验证对象查询、同字段条件叠加、匹配总数与跨页结果。完整场景与声明见包内 `table.slot-search` 和[表格元数据](page-metadata/components/table.md)。

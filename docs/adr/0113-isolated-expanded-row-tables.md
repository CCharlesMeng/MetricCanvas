---
status: accepted
revised-by: 0126
date: 2026-10-21
note: 用户确认单层白底、默认干净、独立查询分页及实时offset语义；导出范围仍待确认
---

# 行内子表格复用Table，以父行拥有独立查询作用域

父行展开需展示不同列结构的明细，多个父行可同时展开并独立翻页。只增加展开插槽会让按sourceId持有的查询窗口互相覆盖；把openDetail的surface扩为inline又会混淆单浮层和多个父行实例的生命周期。

6.44在table.props.rowExpansion就地声明recordList或query来源、multiple/single策略和受限Table配置。不新增页面身份、组件类型、任意插槽或递归组件协议。复用原Table的列、字段格式、搜索、排序与现有分页控件；默认白底、仅内容与分页，标题、搜索及列排序均按需显式配置。

recordList复用既有一层嵌套明细契约及本地分页。query引用专属普通查询定义，输入复用隐藏筛选声明与row/filter/param受控绑定，每个展开实例复制条件并拥有独立SourceProgram、TableSession、快照及取消代次。首屏不执行子表专属查询。缺失或非法输入失败关闭，不能退化为无父行谓词的查询。

查询分页沿用DQE offset/limit及totalCount，用户排序后追加显式映射的唯一子行键。接受实时offset分页的跨请求变化，不声称后端固定快照。折叠、离开父页、父行消失或条件改变销毁实例，重新展开从第一页重查；同页纯排序保留仍可见且内容未变的父行。子表不写全页筛选，不导航或再开详情。

不放宽原detailViews的完整结果限制，不复制一套分页执行器或表格皮肤。表格几何与变体样式只测量/作用于自身表格，防止父表探入子表DOM。

用户明确挂起导出范围，因此本次不默认为父表或子表选择导出范围；校验拒绝新能力上尚未定义的导出配置。详情语义及普通表格已有导出保持。真实DQE编码、性能与权限接入单独验收，原型/Sim不能代替。

依据：[设计与确认](../plan/2026-10-21-table-row-expansion/README.md)、[协议说明](../page-metadata/components/table.md#row-expansion)。

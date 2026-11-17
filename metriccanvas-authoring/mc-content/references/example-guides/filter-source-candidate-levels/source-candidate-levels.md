## 图表工具栏的层级维度筛选

入口 `/pages/filter-source-candidate-levels`，启动 `pnpm dev:playground` 即可操作。页面使用合成数据和内联候选，无需查询服务。

参考对象是 `organization` 筛选器、`organizations` 内联页面数据源、`layered-chart-data` 查询和 `organization-picker`。每行按 `levelField` 声明层级，`parentField` 指向上一层的稳定值，消费查询的 `levelQueryFields` 以层级 ID 为键。

默认选「北区」，图表使用区域字段并显示北区。展开「北区」选择「北京」，图表使用城市字段并显示北京。搜索「深圳」可定位南区下面的子节点，点选后显示深圳。刷新页面恢复所选层级。移植时按业务数据改写各层 DQE 字段和候选编码，验证实际查询模型接受该字段。

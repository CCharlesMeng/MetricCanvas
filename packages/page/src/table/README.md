# 表格领域规则

- `columns.ts`：声明列位置、main 字段身份与新能力扫描。只遍历协议位置。
- `validation.ts`：搜索声明与列关联、条件表格的远程查询所有权约束。
- `condition-scope.ts`：列条件的私有输入隔离与子表消费方识别。
- `edit.ts`：原始列声明的编辑定位；不使用投影后的数组位置。
- `query-view.ts`、`search.ts`：既有表格视图协议及搜索声明解释。
- `expansion.ts`、`validate-expansion.ts`：既有行内子表模板、作用域构造与校验。

列 Schema、递归类型的唯一真源仍是 `../schema/components/table.ts`；条件语义来自 `../condition.ts`。本目录不依赖运行时或 DOM。验证入口：page/tests 中 table-column-visibility、row-expansion、presentation-operation；场景 `/pages/table-column-visibility`。

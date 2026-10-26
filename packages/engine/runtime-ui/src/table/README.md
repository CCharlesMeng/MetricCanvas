# 表格呈现接入

`controller.ts` 持有草稿和搜索选项，将已提交操作交给原 TableSession；显隐与清理规则来自 runtime/table，不在这里另写算法。

- `views/`：展开表格与单个子表作用域的实际 Svelte 接入。
- `export/task.ts`：原导出控制器的冻结任务；`export/prepare.ts`：完整数据准备；`export/workbook.ts`：Excel 编码。
- `pagination.ts`、`search.ts`、`state.ts`：原有分页、搜索执行位置及视图适配。

正文和详情传入自己的筛选、事实及修订。有效列、字段集合均可推导，不保存第二份列状态；导出只编码已经冻结的投影。验证看 runtime-ui/tests/table-export、currency-presentation 及 playground/tests/table-column-visibility-browser.mjs。

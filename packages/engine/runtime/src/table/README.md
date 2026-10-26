# 表格运行时

- `column-presentation.ts`：原声明和作用域输入到有效列树及搜索范围的纯投影。
- `reconcile-view.ts`：从现有视图计算下一份视图；无请求和 UI 分支。
- `session.ts`：已提交状态的唯一写入者，保留默认排序来源和请求代次。
- `presentation-session.ts`：将同一规则接入原有源级会话，在捕获查询前完成调和。
- `column-candidates.ts`：候选生命周期；移除无效列会取消对应请求。
- `expansion.ts`：按父行业务身份隔离的子表生命周期及私有输入。

条件求值复用 page，查询执行复用原 SourceProgram；本目录不依赖 Svelte。场景 `/pages/table-column-visibility`，测试 runtime/tests/table-column-*.test.ts。

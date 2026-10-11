# 日期选择器 · 网格样式优化

2026-10-11，承接初次验收的 Q2-1 建议，已将月份、年份网格的17组相同规则合并，以 `:is(.tiny-year-table, .tiny-month-table)` 共用声明；末尾两组共用覆盖规则同步合并。组件源文件减少17行，编译后CSS减少2241字节（19008→16767）。

仅调整选择器组织：模板、交互逻辑、状态提交、定位和监听清理代码相同。`:is()` 内两项均为单个class，保留原权重；月份、年份表格在模板中互斥。日期网格与外部适配器沿用原实现。

## 本轮验证

- Svelte 5.56.6 编译前后对照：190个展开选择器的声明及各自覆盖顺序一致；固定CSS哈希后的JavaScript输出一致；0条编译警告。
- `pnpm --filter @metriccanvas/engine check`：0错误、0警告。
- `pnpm --filter @metriccanvas/embed build`：ES模块与全局嵌入包构建成功。
- 本轮不重新运行浏览器。初次52项样式契约与截图仍属于原代码快照，本轮使用编译等价对照证明这次重构保留输出，不把旧浏览器证据改签为新执行。

机器记录：[grid-css-refactor-equivalence.json](evidence/grid-css-refactor-equivalence.json)。可在仓库根执行 `node docs/plan/report-date-picker-tiny-os/evidence/artifacts/verify-grid-css-refactor.cjs` 重现对照；该脚本使用归档的修改前组件与当前组件，不启动浏览器。

初次独立检视的 Q2-1 已由本次重构解决；`acceptance.md` 和 `review-results.json` 保留初次验收记录。

# initial 首屏复用修复（2026-10-08）

本批按[方案](plan.md)完成非查询分页 initial 复用与部分数据提示。默认状态下，部分内嵌初始行不再触发补查；提示使用数据源快照而非本地分页后的表格行。没有 initial、条件变化和查询分页交互保留原有取数行为。

最终规则见 [页面数据源与初始行](../../page-metadata/data-sources.md)，实现见 `packages/engine/runtime/src/orchestrator.ts` 与 `packages/engine/runtime-ui/src/widget-host-state.ts`。旧方向“未分页且 rows.length 小于 totalCount 时首屏必须重新查询”已被用户明确否定：首屏快照复用与结果完整性分开处理。查询分页、bootstrap、参数失配、跨源计算批次与完整性检查保留。

验证：旧实现对新零请求断言失败（实际 1 次），修复后运行时及 runtime-ui 共 49 文件、298 测试通过；引擎 svelte-check 与测试 TypeScript 检查通过（0 errors / 0 warnings）。用户原始 JSON 临时回放测试验证 5 个源均 ready、数据网关调用为 0；临时测试已清理，长期保留同结构五数据源合成案例。真实本地 `/preview` 浏览器粘贴原始 JSON 后渲染成功，显示 20/30、20/41、20/714 三处提示。浏览器未进行网络抓包，零取数结论来自运行时网关断言。未运行 CI、未推送或部署。

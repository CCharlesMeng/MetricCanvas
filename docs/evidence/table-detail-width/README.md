# 表格详情浮层宽度验收（2026-10-22）

含 `table` 的详情视图统一采用 `min(90% × 宿主容器宽度, 1440px, 宿主容器宽度 − 32px)`；弹窗居中，抽屉贴右。运行时根提供定位边界，嵌入时使用宿主实际宽度。详情视图在参数解析前确定，加载、空结果、网关失败及参数错误维持同宽。普通字段与不含表格的详情视图保留原宽度。表格沿用内部滚动、列宽和字号。

- 页面：`pages/capabilities/table/table-detail-overlay.json`，`http://localhost:5173/pages/table-detail-overlay`。
- 操作：点击8、3、0、861,000与“订单详情 8”，分别观察宽版弹窗、抽屉、空结果、普通字段及其他入口；窄屏横向滚动表格，按Esc关闭。正常表格翻页显示后续订单。
- 元数据：`PAGE-METADATA.md` 与 `docs/page-metadata/components/table.md`；不增加Schema字段或版本。
- Skill：独立检出中从产品真源执行导出器；合并时仅更新本批文档及相应哈希条目，保留并行改动。local-authoring 的仓外复制安装、知识哈希、页面校验由测试覆盖。

已执行并通过：

1. 独立检出：`pnpm --filter @metriccanvas/embed build`；engine/embed 的Svelte与TypeScript检查均为0错误、0警告。
2. 独立检出：`MC_EMBED_EXAMPLE_PORT=4188 pnpm --filter @metriccanvas/embed exec playwright test table-detail-width.spec.ts detail-views.spec.ts`，6项通过。覆盖1920/1440/390/280px、1920px窗口内390px宿主、内部滚动、普通字段／非表格详情、查询加载／失败／参数错误、取消／迟到响应／排序／焦点恢复。
3. 独立检出：`pnpm validate`，30/30页面通过（含本批完整合成场景）。
4. 独立检出：`pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts packages/engine/runtime/tests/detail-view.test.ts packages/page/tests/detail-views.test.ts`，5文件56项通过。
5. 独立检出及当前工作区：`pnpm authoring:contracts:check`、`python3 metriccanvas-authoring/scripts/check_bundle.py`通过，Bundle校验2718条摘要。当前工作区engine/embed检查亦通过。
6. 当前工作区：`node apps/playground/tests/table-detail-width-browser.mjs docs/evidence/table-detail-width`，5173实际页面15项通过，零页面脚本异常。量测见`browser.json`，截图见本目录PNG；已目视核对桌面与窄屏截图。三种容器下宽度为1296/1440/351px，弹窗内无横向溢出，表格滚动有效。
7. `git diff --check`通过。

复杂度：`metriccanvas-ts-ast/1`、TypeScript 5.9.3；Svelte仅提取script，模板及CSS单独核对。修改函数`openDetailFor`自身CC为14→14，新计算回调CC=1；浏览器测试新增函数及闭包最大CC=2，Playground验证脚本最大CC=1，逐项数据见`complexity.json`。本批无新增超限；同文件未修改的`run`存量CC=44，未在本次扩大重构范围。

以上为首次实施记录；最新main基线的交付复验见[交付记录](delivery/README.md)。本批为合成数据与本地运行时呈现验收，不涉及真实DQE/Relay或真实DS模型。

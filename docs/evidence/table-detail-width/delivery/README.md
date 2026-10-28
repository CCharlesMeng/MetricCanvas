# 最新main基线交付复验

基线：`a1618d7e058a19d81e285ac288e9ec8b56d540e3`；检出：`/Users/moon/.codex/worktrees/table-detail-width-delivery/DataDashboard`。按本次文件清单承接运行时、演示、浏览器测试和文档；完整保留基线上已有的权限、字段选择、查询与表格能力。从此检出的产品真源重新生成契约、local-authoring知识与摘要清单。新增语义标题同时注册于`docs/page-metadata/reference-map.json`，安装后的精确知识可发现该主题。源码与锁文件摘要见[inputs.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/table-detail-width/delivery/inputs.json)。

在此基线执行：

- `pnpm --filter @metriccanvas/embed build`通过；engine/embed check均0错误、0警告。
- `MC_EMBED_EXAMPLE_PORT=4192 pnpm --filter @metriccanvas/embed exec playwright test table-detail-width.spec.ts detail-views.spec.ts`，6项通过。
- `PLAYGROUND_BASE_URL=http://127.0.0.1:5194 node apps/playground/tests/table-detail-width-browser.mjs docs/evidence/table-detail-width/delivery`，15项通过、零页面异常，见`browser.json`及截图。包含桌面、窄屏、弹窗、抽屉、空结果、普通详情与指标卡入口，窄屏截图已目视检查。
- `pnpm validate pages/capabilities/table`，11/11页面通过。
- `pnpm authoring:contracts:check`通过；`python3 metriccanvas-authoring/scripts/check_bundle.py`通过，3667条摘要校验。
- `pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts packages/engine/runtime/tests/detail-view.test.ts packages/page/tests/detail-views.test.ts`，5文件62项通过；包含local-authoring仓外独立安装、知识与导出一致性及详情运行时／协议检查，保留SvelteKit sync前置步骤。

复杂度使用`metriccanvas-ts-ast/1`、TypeScript5.9.3，单独提取Svelte实例script（模块script仅有import）。`openDetailFor`自身CC在最新基线为18→18；该函数已有权限与输入分支，本次仅在参数解析前保留视图声明。为避免扩大权限、查询和焦点行为风险，未在本次交付拆分；后续入口为既有复杂度清单及该函数。新增计算回调CC=1，浏览器测试及辅助函数／全部闭包最大CC=2，Playground验证脚本最大CC=1；逐函数测量见`complexity.json`。首次实施记录中的14→14属于旧基线，不能与当前指标混用。

用户明确要求`skip ci`，提交标题使用`[skip ci]`。CI记为跳过，不以本地通过代替CI成功。Git提交和远端ref验证以交付最终回执为准。

# Tab 多表格滚动修复验收（2026-10-27）

## 问题与修改

`TabContainer.svelte` 在多内容面板上声明 `overflow:auto`；compact 外框固定 524px，面板固定 464px。双表格页面在 1440px 宽时面板 `clientHeight=464`、`scrollHeight=1328`，形成额外滚动。

多内容面板改为自然高度、`overflow:visible`，compact 仅在活动面板为多内容时使用自然高度。单内容仍保持原高度，隐藏的已访问多内容面板不影响活动单内容布局。表格本身仍拥有横向滚动和分页。

## 场景与知识同步

- 页面：`pages/capabilities/layout/tab-multiple-tables.json`，`layout:dashboard`，24 条内联合成记录，无外部服务。
- 入口：`/pages/tab-multiple-tables`。本次服务为 `http://127.0.0.1:5194/pages/tab-multiple-tables`。
- 说明：`pages/capabilities/layout/README.md`、`PAGE-METADATA.md`、`docs/page-metadata/components/tabContainer.md`。
- 由产品真源生成 local-authoring 的 Tab 参考、按需知识、知识哈希与 MC 对应知识及分发清单；local-authoring 版本 1.3.2。不新增协议字段或版本边界。

## 验证

1. `node apps/playground/tests/tab-multiple-tables-browser.mjs`：修改前失败（面板 overflow 为 auto）；修改后 16 项面板几何断言通过，浏览器无 pageerror。1440/390px 覆盖默认、compact、analysisStack、grid，每组切换单/多表。面板无纵向溢出且完整位于外框内；compact 切回单表为 524px；双表独立翻页，切换页签后保留分页；窄屏表格自身可横向滚动。截图人工检查通过。
2. `pnpm validate pages/capabilities/layout`：15 页通过。
3. `pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts packages/engine/runtime/tests/tab-activation.test.ts packages/engine/runtime-ui/tests/initial-tabs.test.ts packages/engine/widgets/tests/responsive-contract.test.ts packages/engine/runtime-ui/tests/runtime-section-responsive.test.ts`：6 文件、62 测试通过。
4. `pnpm --filter @metriccanvas/engine check`：Svelte 0 错误、0 警告，TypeScript 通过。
5. `pnpm authoring:contracts`：使用已安装依赖的 `METRICCANVAS_PYTHON` 成功生成。Skill 最后升版后重新生成，并复跑 `tests/local-authoring-skill.test.ts`，33 项通过，包含仓外复制、链接/哈希闭合与页面契约校验。
6. `pnpm mc:content:check`：在已安装依赖的 Python 环境下通过；契约生成无漂移、MC 来源覆盖一致、32 项 MC 测试通过、诊断及可观察夹具一致。知识内容哈希变化引起的三个诊断 JSON 由 `pnpm mc:content:fixtures` 重新生成，差异仅为内容版本与哈希。
7. `node tools/scripts/measure-ts-complexity.mjs apps/playground/tests/tab-multiple-tables-browser.mjs`：`metriccanvas-ts-ast/1`、TypeScript 5.9.3；全部 10 个新函数/闭包自身 CC=1（新增，无旧值）。生产仅 CSS 修改，无可执行分支变化；无本次复杂度未关闭项。

浏览器结果及截图保留在本机 `/tmp/metriccanvas-tab-multiple-tables/`。本地验证不涉及真实 DQE/Relay、模型或远端 CI；远端交付和 CI 结论在交付阶段单独核对。

## 交付基线

已将源文件改动迁移到远端 main `15b76ae4c41559fde2ffc8cc5817e9e64ffb378e`，从新基线重新生成知识及诊断夹具，保留并行查询修复；本地创作 Skill 在已有 1.3.1 上递增为 1.3.2。

本次交付检出为 `/Users/moon/.codex/worktrees/tab-multiple-tables-scroll/DataDashboard`；新基线复跑上述浏览器 16 项、布局页面 15 页、定向测试 62 项及引擎 check 均通过。未修改 pnpm 锁文件，开发浏览器使用仓库 Vite 默认参数及端口 5194。源码与依赖摘要：

- `packages/engine/widgets/src/components/tab-container/TabContainer.svelte`：`72568c8216cceeca26775426be57837e03e27470568bc84ed762ae9121528fdf`
- `apps/playground/tests/tab-multiple-tables-browser.mjs`：`01feb071c7ac0c98b4f8235d7b27cdb6ca736fd20ad8641ba8b0aaa3e8fa1a9d`
- `pages/capabilities/layout/tab-multiple-tables.json`：`55daf0a7685dd1980391fd03b56345e22c3525485ec912abcf95789704c821ed`
- `pnpm-lock.yaml`：`1a33c68c0755b6d9bf6d05bbf45438b9b5e2b9bc574a6f41908944dfe5fc2f4f`

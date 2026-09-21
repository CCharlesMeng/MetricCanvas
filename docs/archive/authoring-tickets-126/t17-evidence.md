# T17 / #143 验收回执

S2任务 `01a09f69-a06b-7703-b87b-ccdfe05d765e`；工作树 `/private/tmp/metriccanvas-126-s2`，分支 `codex/s2-params-bindings-143`。M0基线 `e65b012c0a93d5c9a1ac9c0e51e320133e97a0f1`；实现提交 `25b8d737429fba7fbe385926d5d045de2bdc0fb0`，实现树 `5ef7e8232fbac3e47cfd9ce650535d3b6c899f2a`。后续本回执仅证据，不修改被测代码。

## 验收映射

| 验收 | 实现及公开证据 |
|---|---|
| 显式目标与唯一默认 | 6.2 dimension/multiple、query.paramBindings与filter.initialParam；同源目标/双默认/重复目标/错误引用/旧版本下限反例，13项参数golden双语言一致 |
| 代表模板与部分共享/缺值 | dimension-params-page：sales筛选接管、shared保持固定参数、unbound独立；公开parse/normalize、初始化、编排测试及经典/ESM Embed真实呈现 |
| 一次URL与独立筛选 | 页面初次EU+NA，URL后改APAC不重新初始化；点击APAC只影响sales，清空为ALL，shared仍EU+NA；模板原文不变，ready一次/filter-change两次 |
| 旧标量/文本与版本 | 旧参数/文本/导航回归继续通过；布局40项矩阵保持旧输入并扩6.2/未来6.3，new writer=current6.2、布局迁移最低6.1明确分开；四包rc.3公开面门禁 |

## 实际运行

- `pnpm test`：133文件，983通过、5既有skip；日志 `/private/tmp/s2-t17-test2.log`。
- `pnpm check`：全部通过，Svelte 0错误0警告；`pnpm build`：四包及Platform静态构建通过，日志s2-t17-check.log/build.log。
- Embed `pnpm exec playwright test`：最终完整44通过（13.6s），真实Chrome，经典脚本与ESM均覆盖；日志 `/private/tmp/s2-t17-browser-serial.log`。本票未重跑Edge/最低Svelte整套矩阵，不冒称#133先前矩阵是本票新产物证据。
- `node --import tsx tools/package-build/check.ts`：四个rc.3真实pnpm pack产物的导出/声明/编译通过；日志 `/private/tmp/s2-t17-packages.log`。
- 导出 `--check`：194 product/4 authoring/1 interface无漂移；Bundle482摘要通过。
- Python全量157通过（6.669s），日志 `/private/tmp/s2-t17-python-final.log`；无新增pending。HTTP边界替身要求本地监听，沙箱内权限失败后沙箱外完整复验通过，不解释为服务失败。
- Python sdist独立安装到 `/private/tmp/s2-t17-python-installed`，离开仓根以`python -I`执行。模块/运行契约路径断言在安装目录内，53项（布局40+参数13）完整文档/错误type+path比对通过，内置版本6.2/rc.3。测试向量复制到/tmp供离线输入；生产包不打包conformance测试数据。包路径 `/private/tmp/s2-t17-python-dist/metriccanvas_authoring-0.2.0.tar.gz`，SHA256 `9cb18978513bbcb9f207b8920b9119e01b22c99c6696461bab608c2b0b42ea78`。
- `git diff --check`通过。

首次浏览器运行的3失败为测试使用不存在的data-component-id定位，页面快照已显示预期值；改用实际table入口。旧版本浏览器期望同步6.2/未来6.3。另一次并行pack期间出现单例window.runtime未初始化，pack会触发预打包构建；最终在打包结束后串行完整44通过，未放宽断言或加重试掩盖。此前一次脚本在错误cwd下未完成测试编辑，该轮输出不计最终结果。

## 临时所有权与边界

S1授权document-edit.test.ts仅未来版本反例6.2→6.3一行；正式代码未改。S3/S0授权page_validation.py、test_page_validation.py的参数/版本对齐，以及test_build_page.py/test_stdio.py各一处新作者版本期望读取自身contract-lock。随本票验收后归还；#134作者/生成支援仍独立M0树，不混6.2。

无远端push、registry发布或外部服务调用。外部Java/Relay权限优先级、执行/历史记录未实现，不冒称真实联调。#143本仓验收集成后才解锁S2 #144；#145仍等#138/#140/#144。回退应成套回退参数能力/生成物/包候选，保留6.0/6.1布局兼容；已产生6.2文档不可交仅6.1读取方。M2完整手册仍后续，本票只补参数/初始化章节。

## 精确57文件实现清单

- `PAGE-METADATA.md`
- `apps/platform/tests/workbench/document-edit.test.ts`
- `contracts/metriccanvas/manifest.json`
- `contracts/metriccanvas/page/conformance/invalid/version-major-unsupported.json`
- `contracts/metriccanvas/page/conformance/invalid/version-minor-ahead.json`
- `contracts/metriccanvas/page/conformance/layout-compatibility.json`
- `contracts/metriccanvas/page/conformance/param-bindings.json`
- `contracts/metriccanvas/page/conformance/valid/dimension-params-page.json`
- `contracts/metriccanvas/page/schema.json`
- `docs/page-metadata/parameters.md`
- `docs/archive/authoring-tickets-126/t17-params-contract.md`
- `metriccanvas-authoring/bundle.lock.json`
- `metriccanvas-authoring/contract-lock.json`
- `metriccanvas-authoring/contract-snapshot/manifest.json`
- `metriccanvas-authoring/contract-snapshot/page/conformance/invalid/version-major-unsupported.json`
- `metriccanvas-authoring/contract-snapshot/page/conformance/invalid/version-minor-ahead.json`
- `metriccanvas-authoring/contract-snapshot/page/conformance/layout-compatibility.json`
- `metriccanvas-authoring/contract-snapshot/page/conformance/param-bindings.json`
- `metriccanvas-authoring/contract-snapshot/page/conformance/valid/dimension-params-page.json`
- `metriccanvas-authoring/contract-snapshot/page/schema.json`
- `metriccanvas-authoring/contracts/exported/build-page-conformance.json`
- `metriccanvas-authoring/contracts/manifest.json`
- `metriccanvas-authoring/test-harness/tests/test_build_page.py`
- `metriccanvas-authoring/test-harness/tests/test_page_validation.py`
- `metriccanvas-authoring/test-harness/tests/test_stdio.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_validation.py`
- `packages/embed/package.json`
- `packages/embed/tests/browser/params-initialization.spec.ts`
- `packages/embed/tests/browser/version-error.spec.ts`
- `packages/engine/package.json`
- `packages/engine/runtime-ui/src/RuntimeSurface.svelte`
- `packages/engine/runtime-ui/tests/version-error.test.ts`
- `packages/engine/runtime/src/index.ts`
- `packages/engine/runtime/src/page-params.ts`
- `packages/engine/runtime/tests/param-initialization.test.ts`
- `packages/metric-canvas/package.json`
- `packages/page/fixtures/contract-valid/dimension-params-page.json`
- `packages/page/package.json`
- `packages/page/src/filter.ts`
- `packages/page/src/layout-compatibility.ts`
- `packages/page/src/page-param.ts`
- `packages/page/src/param-bindings.ts`
- `packages/page/src/query.ts`
- `packages/page/src/schema/data-source.ts`
- `packages/page/src/schema/filter.ts`
- `packages/page/src/schema/primitives.ts`
- `packages/page/src/validate.ts`
- `packages/page/src/version.ts`
- `packages/page/tests/canonical-writers.test.ts`
- `packages/page/tests/layout-compatibility.test.ts`
- `packages/page/tests/layout-migration-cli.test.ts`
- `packages/page/tests/param-bindings.test.ts`
- `packages/page/tests/validate-cli.test.ts`
- `packages/page/tests/version.test.ts`
- `tests/public-api/engine.txt`
- `tests/public-api/page.txt`
- `tools/scripts/export-authoring-contracts.ts`

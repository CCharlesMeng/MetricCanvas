# 父行折叠后的子表会话缓存验收

开发基线：`4c2c4f0dd1eb00aa95f905ea3643bf57cf73c35d`；交付基线：`f8d448551cba70b899ce7d734b07a3ed34ff8b55`；工作树 `/Users/moon/.codex/worktrees/hierarchy-zero-total-compat/DataDashboard`。用户确认实现同一页面内缓存并授权提交到main。

## 行为与实现

`createRowExpansionController` 继续拥有每个父行独立的查询程序和视图。成功的 query 子表折叠后保留会话，重开直接恢复数据及已提交页码、搜索、排序、每页条数；成功空结果也可保留。不把缓存快照写入 initial，不复用错误、加载中或取消结果。recordList不增加查询缓存。

`folded-cache.ts` 只管理最多20个折叠成功会话的保存、恢复、失效和释放，超过上限释放最久未使用者；不复制查询执行器。缓存键包含父行身份、父行内容、筛选、参数、层级状态、显示输入及修订。不同父行独立。父表视图变化、父行离开或变化、条件/上下文变化、父表重新加载、页面销毁清理相关缓存；权限变化沿用现有页面会话硬失效。未完成请求折叠仍取消，迟到回执不回流。

## 验证

- 修复前：新增5个折叠缓存行为用例均失败，成功重开重复请求、页码丢失及空结果重查可确定复现。
- 最终：`pnpm test packages/engine/runtime/tests/row-expansion.test.ts packages/engine/runtime/tests/hierarchy-selection.test.ts tests/hierarchy-zero-total-rendering.test.ts packages/engine/runtime-ui/tests/hierarchy-export.test.ts tests/zero-total-rendering.test.ts`，5文件50项通过。覆盖父行隔离、父行内容/移除、条件/参数/上下文修订、显式清理与刷新失效、错误/空结果、20个折叠实例上限，以及原有取消和忽略abort的迟到响应。零总数但有数据的子表也可缓存，原始总数仍为0。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json` 通过；engine和Playground检查均0错误/0警告；`pnpm --filter @metriccanvas/engine build`通过。
- 150/150页面文档校验通过；ADR索引一致。
- local-authoring专项5文件197项通过，包含仓外独立复制、知识哈希及校验器；Skill修订号1.14.8 → 1.14.9（跟随最新main）。由本工作树产品真源重新生成，`authoring:contracts:check` 1317产品/4创作/1接口文件一致；MC诊断及页面夹具同步检查通过。

接入上述交付基线后重新执行50项运行时、197项local-authoring、150个页面、engine/Playground检查、engine构建、契约及ADR一致性和浏览器脚本，均通过。运行时代码与复杂度测量输入保持一致。

## Playground

[场景入口](http://127.0.0.1:5194/pages/table-row-expansion-cache)，页面文件 `pages/capabilities/table/table-row-expansion-cache.json`。使用专属内存仿真Gateway，无外部DQE依赖。

运行 `PLAYGROUND_BASE_URL=http://127.0.0.1:5194 node apps/playground/tests/row-expansion-cache-browser.mjs`：北辰科技首次展开1次请求，翻至第2页累计2次；折叠重开仍为C01-011起始，累计请求保持2次。展开远山制造新增独立请求，仍从C02-001开始。父表翻页后返回重开会重新查第一页；整页刷新清空会话。无pageerror。原始截图及browser.json留在本机本目录。

页面元数据文档同步 `PAGE-METADATA.md` 和 `docs/page-metadata/components/table.md`；页面目录说明提供操作及证据边界；生成的local-authoring和MC知识同步同一语义。ADR-0126局部修订0113/0123的旧折叠生命周期，不新增页面字段或Schema版本。

## 复杂度

固定口径 `metriccanvas-ts-ast/1`，TypeScript5.9.3，逐函数selfCC、排除嵌套函数体且嵌套单列。Svelte只提取script测量，模板没有新增分支；另由Svelte检查与浏览器验证。

| 修改函数 | 前 | 后 |
|---|---:|---:|
| createRowExpansionController | 1 | 1 |
| close | 2 | 4 |
| open | 6 | 7 |
| retain / updatePresentation / toggle | 12 / 3 / 6 | 12 / 3 / 6 |
| clear / dispose | 3 / 2 | 3 / 2 |
| ExpandableTable同步回调 | 6 | 7 |
| queryTableGateway / tablePreview | 4 / 4 | 5 / 5 |

新增foldContext和invalidateCache均为1；折叠缓存工厂及所有辅助函数最大8；仿真网关最大6；新增测试和浏览器回调最大3。修改和新增函数全部≤15，没有本批未关闭项。原始测量保留本机complexity.json。

证据边界：本地运行时、仿真网关、真实浏览器及独立Skill验证；未执行真实DQE/Relay、生产权限联调或部署。用户授权规范页面无需新增JSON缓存字段；需使用本批更新的运行时。


## CI 浏览器断言同步

首次提交 `7cdaf7640f624d857785ed06944f1874b0464d8b` 的 [CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/41040181346) 中，authoring、build、tests、types通过；独立安装兼容性518项中516项通过，Chrome/Edge各一条旧行内子表用例仍要求折叠重开回第一页而失败。本地运行 `pnpm --filter @metriccanvas/embed exec playwright test table-row-expansion.spec.ts --grep 'query child requests'` 在同一断言复现失败。

后续提交将既有用例同步为保留第2页且请求数维持3次，父行隔离仍检查；离开父页再返回须重新请求第1页，请求数从4增至5。运行时未再次变更。本地Chrome行内子表5项全部通过，embed构建和检查通过；本机未安装Edge，其验收交给CI的真实Edge矩阵。同一AST口径下修改测试回调自身CC为1 → 1，内部calls及其回调均1 → 1，无新增函数和未关闭项。最终远端结论以交付提交对应CI为准。

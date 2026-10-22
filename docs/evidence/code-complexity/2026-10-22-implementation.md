# 2026-10-22 复杂度治理 A–E 实施与验收

对应 [实施计划](../../plan/2026-10-22-code-complexity.md)。本轮完成计划中 A–E 列出的目标职责重构，保留公开接口与行为；同文件其他存量职责及全仓其余条目继续作为债务记录。没有提交、推送或外部 CodeCheck 复扫。

## 基线与范围

- 基线提交：`952b3a273f0f4f8be5820f5af1bb76c2f5afa513`。修改前保存了 14 个目标源码文件，逐一确认与该提交相同；原工作区的并行修改保留。
- 测量：`metriccanvas-ts-ast/1`，TypeScript `5.9.3`。14 个原文件从 506 个函数、40 个自身 CC>15，变为 16 个产品文件（新增候选识别/应用两个内部模块）、17 个自身 CC>15；另有一个新增测试文件。统计包含嵌套函数、回调及对象方法。
- 所有新增辅助函数自身 CC≤15。剩余 17 个超限函数与基线相比均未增长；同步器工厂自身仍为 21，其初始化流程未在本轮拆分，其内部目标方法已达标。
- 外层函数分数下降需要结合内部函数验收。原 `computeErrors` 中 CC=48 的回调已按算子分派与专项校验拆分；`componentErrors` 的每种组件校验具名化。新增提取模块中最高自身 CC 分别为 14 和 12。

## 目标函数前后测量

下表使用同一计数口径。应用入口委托给内部实现后，仍逐个检查内部实现及其辅助函数；入口低分不能单独作为完成依据。

| 当前代码位置 | 函数 | 自身 CC：前 → 后 |
|---|---|---:|
| [packages/page/src/report-date-filters.ts:16](../../../packages/page/src/report-date-filters.ts#L16) | `reportDateFilterErrors` | 64 → 8 |
| [packages/page/src/validate-paged-join.ts:15](../../../packages/page/src/validate-paged-join.ts#L15) | `pagedJoinErrors` | 78 → 3 |
| [packages/page/src/extract-page-params.ts:31](../../../packages/page/src/extract-page-params.ts#L31) | `extractPageParams` | 86 → 3 |
| [packages/page/src/extract-page-params.ts:39](../../../packages/page/src/extract-page-params.ts#L39) | `applyPageParamSelection` | 97 → 1 |
| [packages/page/src/param-bindings.ts:12](../../../packages/page/src/param-bindings.ts#L12) | `paramBindingErrors` | 51 → 6 |
| [packages/engine/runtime/src/execution.ts:48](../../../packages/engine/runtime/src/execution.ts#L48) | `prepareExecution` | 75 → 6 |
| [packages/page/src/validate.ts:1232](../../../packages/page/src/validate.ts#L1232) | `componentErrors` | 64 → 4 |
| [packages/page/src/validate-compute-dependencies.ts:15](../../../packages/page/src/validate-compute-dependencies.ts#L15) | `crossSourceComputeErrors` | 52 → 2 |
| [metriccanvas-authoring/contracts/authored/publication-contract.ts:153](../../../metriccanvas-authoring/contracts/authored/publication-contract.ts#L153) | `validateCandidateRelations` | 68 → 11 |
| [packages/data-execution/src/effective-query.ts:19](../../../packages/data-execution/src/effective-query.ts#L19) | `composeEffectiveQuery` | 43 → 8 |
| [packages/engine/runtime/src/filter-state.ts:121](../../../packages/engine/runtime/src/filter-state.ts#L121) | `normalize` | 46 → 5 |
| [apps/platform/src/lib/workbench/property-edit.ts:69](../../../apps/platform/src/lib/workbench/property-edit.ts#L69) | `editProperty` | 54 → 10 |
| [apps/platform/src/lib/workbench/authoring-coordinator.ts:319](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L319) | `createAuthoringCoordinator/load` | 62 → 15 |
| [apps/platform/src/lib/workbench/authoring-coordinator.ts:432](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L432) | `createAuthoringCoordinator/save` | 32 → 14 |
| [apps/platform/src/lib/workbench/authoring-sync.ts:143](../../../apps/platform/src/lib/workbench/authoring-sync.ts#L143) | `createAuthoringSync/accept` | 29 → 15 |
| [apps/platform/src/lib/workbench/authoring-sync.ts:166](../../../apps/platform/src/lib/workbench/authoring-sync.ts#L166) | `createAuthoringSync/pump` | 31 → 15 |
| [apps/platform/src/lib/workbench/authoring-sync.ts:271](../../../apps/platform/src/lib/workbench/authoring-sync.ts#L271) | `createAuthoringSync/retry` | 27 → 15 |
| [packages/data-execution/src/source-program/session.ts:114](../../../packages/data-execution/src/source-program/session.ts#L114) | `createSourceProgram/read/execute` | 61 → 15 |

## 状态与时序约束

状态仍由原协调器、同步器和单次取数读取持有。新增函数只提取同步判定、数据准备、结果投影；原有 await/yield 点数量保持，未通过额外异步层包装原操作。数量一致不能单独证明并发等价，须结合下面的行为测试。

| 入口/事件 | 保持的条件和行为 |
|---|---|
| 加载/刷新 | 未决工作、身份不匹配及错误页面刷新保留当前工作；每次读取后核对 epoch/取消；本地未决记录优先，确认修订不被较旧响应覆盖 |
| 保存/回执 | 本地保护先于发出；操作键和引用精确匹配；保存验证失败进入 unknown，回执只持久化声明字段，身份切换后停止确认 |
| 重试 | single delivery 的未决保存不重发；stable delivery 先查原键；仅 retrySafe 的 not-applied 可解除原回执，unknown 不作为未应用 |
| 取数/导出 | 依赖先完成、缓存命中与完整/窗口策略保持；校正分页和首次快照条件保持；取消、完整导出失败传播及生成器输出顺序保持 |

| 文件 | await 点前/后 | yield 点前/后 |
|---|---:|---:|
| `apps/platform/src/lib/workbench/authoring-coordinator.ts` | 25 / 25 | 0 / 0 |
| `apps/platform/src/lib/workbench/authoring-sync.ts` | 22 / 22 | 0 / 0 |
| `packages/data-execution/src/source-program/session.ts` | 7 / 7 | 2 / 2 |

## 验收结果

| 检查 | 结果与边界 |
|---|---|
| 同口径复杂度 | 本轮目标函数及所有新增辅助函数均≤15；范围内其余 17 项见末表，不宣称全仓清零 |
| 页面与参数前后差分 | 98 个页面；98 次候选提取、328 次参数应用；1,536 组日期/分页组合变体；共 3,596 次比较一致，包括完整有序错误列表、返回值及输入不变性 |
| 查询/筛选/回执前后差分 | 6,192 次有效查询组装、2,048 次筛选写入/URL及订阅状态、2,688 次执行回执消费比较一致；包含单边/空数值范围、缺映射、类型不匹配、拒绝和错误回执。不是任意输入的形式化等价证明 |
| 持久回归夹具 | 新增 complexity-validation-parity.test.ts 和复杂度重构前的黄金错误列表，固定同时触发多个日期/分页约束时的 10/22 条完整诊断及输入不变性 |
| 定向行为检查 | 139 个文件、1,327 项测试通过；覆盖本批页面、执行、工作台和公开接口 |
| pnpm test | 256 个文件、2,259 项测试通过 |
| pnpm check | 全仓 TypeScript/Svelte 检查通过；0 errors/0 warnings |
| 核心包与生产构建 | pnpm build:packages、Platform build、embed build 通过；Platform 仍有大块体积提示，本轮未改打包策略 |
| Chrome 实际工作台 | canvas-experience-browser.mjs 通过：拖动、排序、宽度、选择动作、删除/撤销、空分区、输入隔离、显式保存、页面设置；无 pageerror；本地页面/接口夹具，不是真实 Java/DQE |
| 分发与独立安装 | 独立镜像运行正式契约生成器后只回填预期 12 个派生文件，其余生成内容与原工作区一致；authoring:contracts:check 通过，Bundle 2718 项摘要验证通过；local-authoring、reference、导出隔离与发布契约共 120 项测试通过，含仓外复制安装 |
| 外部服务/CI | 未运行 CodeCheck、真实 DQE/Relay/Java/DS、远端 CI；未提交推送 |

实际采用仓内正式构建与校验命令。独立镜像使用冻结的必要输入路径（包括工作区已经存在的参考文档与分发基线），通过已安装的 tsx 运行正式导出器；生成后逐文件比较，只回填本轮差异，不把整份并行工作区纳入交付。

本轮属于行为保持的内部重构，没有新增页面协议字段、协议版本或界面能力，因此复用既有页面/文档场景，不新增虚构功能示例。校验器与来源摘要已通过正式生成链同步至 local-authoring。

```sh
node tools/scripts/measure-ts-complexity.mjs packages/page/src/report-date-filters.ts packages/page/src/validate-paged-join.ts packages/page/src/extract-page-params.ts packages/page/src/extract-param-candidates.ts packages/page/src/apply-param-candidates.ts packages/page/src/param-bindings.ts packages/engine/runtime/src/execution.ts packages/page/src/validate.ts packages/page/src/validate-compute-dependencies.ts metriccanvas-authoring/contracts/authored/publication-contract.ts packages/data-execution/src/effective-query.ts packages/engine/runtime/src/filter-state.ts apps/platform/src/lib/workbench/property-edit.ts apps/platform/src/lib/workbench/authoring-coordinator.ts apps/platform/src/lib/workbench/authoring-sync.ts packages/data-execution/src/source-program/session.ts
pnpm test
pnpm check
pnpm build:packages
pnpm --filter platform build
pnpm --filter @metriccanvas/embed build
node apps/platform/tests/workbench/canvas-experience-browser.mjs
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts tests/publication-contract.test.ts
```

前后差分使用修改前冻结的源码包和修改后包在同一输入集执行；临时脚本与原包留在本机 `/tmp/metriccanvas-complexity-implementation/`，持久行为约束由仓内测试和黄金夹具保存。

## 同范围尚未展开的 17 个超限职责

这些函数不是本轮 A–E 表中列出的目标方法，或属于未改的初始化流程。后续沿每次编码规则处理，不以它们已在同文件出现为由宣布清零。最初全清单中的其他文件也仍需后续治理。

| 当前代码位置 | 函数归属 | 自身 CC |
|---|---|---:|
| [packages/page/src/validate.ts:318](../../../packages/page/src/validate.ts#L318) | `invariantErrors/<anonymous@318:36>` | 18 |
| [packages/page/src/validate.ts:345](../../../packages/page/src/validate.ts#L345) | `invariantErrors/<anonymous@318:36>/<anonymous@345:59>` | 17 |
| [packages/page/src/validate.ts:489](../../../packages/page/src/validate.ts#L489) | `filterDeclarationErrors` | 30 |
| [packages/page/src/validate.ts:697](../../../packages/page/src/validate.ts#L697) | `queryContractErrors` | 41 |
| [packages/page/src/validate.ts:1878](../../../packages/page/src/validate.ts#L1878) | `queryPaginationErrors/<anonymous@1878:28>` | 32 |
| [packages/page/src/validate.ts:2150](../../../packages/page/src/validate.ts#L2150) | `mapHierarchyErrors` | 18 |
| [packages/page/src/validate.ts:2243](../../../packages/page/src/validate.ts#L2243) | `actionErrors/<anonymous@2243:19>` | 20 |
| [metriccanvas-authoring/contracts/authored/publication-contract.ts:264](../../../metriccanvas-authoring/contracts/authored/publication-contract.ts#L264) | `validateResultRelations` | 20 |
| [packages/engine/runtime/src/filter-state.ts:91](../../../packages/engine/runtime/src/filter-state.ts#L91) | `createFilterState/fromURL` | 18 |
| [packages/engine/runtime/src/filter-state.ts:173](../../../packages/engine/runtime/src/filter-state.ts#L173) | `sameValue` | 24 |
| [packages/engine/runtime/src/filter-state.ts:203](../../../packages/engine/runtime/src/filter-state.ts#L203) | `parseFilterSearch` | 34 |
| [apps/platform/src/lib/workbench/property-edit.ts:30](../../../apps/platform/src/lib/workbench/property-edit.ts#L30) | `propertyControls` | 22 |
| [apps/platform/src/lib/workbench/authoring-coordinator.ts:90](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L90) | `createAuthoringCoordinator/attachSync` | 26 |
| [apps/platform/src/lib/workbench/authoring-coordinator.ts:286](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L286) | `createAuthoringCoordinator/replaceDraft` | 21 |
| [apps/platform/src/lib/workbench/authoring-coordinator.ts:365](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L365) | `createAuthoringCoordinator/acceptSavedDraft` | 19 |
| [apps/platform/src/lib/workbench/authoring-coordinator.ts:409](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L409) | `createAuthoringCoordinator/restoreRevision` | 18 |
| [apps/platform/src/lib/workbench/authoring-sync.ts:56](../../../apps/platform/src/lib/workbench/authoring-sync.ts#L56) | `createAuthoringSync` | 21 |

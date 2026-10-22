# 圈复杂度治理：main 交付与完整验收

隔离交付检出：`/Users/moon/.codex/worktrees/complexity-delivery/DataDashboard`；main 基线：`670a81071fd27b4a1df581510091b2ddb018b1b1`。原混合工作区及其并行修改不参与整目录复制，不移动、撤销或暂存其中的其他任务。

## 实施范围

承接本会话的 A–E、第二轮及高优先级查询链路重构：21 个原源码文件、2 个参数内部模块、3 个测试文件及2个有序诊断夹具、固定口径测量器及其测试、编码规则和相关计划/证据；AGENTS.md 与计划索引只迁入本任务段落。派生物从本检出的最新真源正式生成，没有复制旧工作区的协议产物。

迁移过程解决 11 个文件的文本冲突，保留 main 的时间模式、金额/币种、静态与动态字段选择、IOC 页头、筛选候选和提交/阻断规则、查询条件交集、列候选、表格搜索选项、行展开、页面显隐与连接文字能力。没有引入新的协议能力或调整产品含义。所有新增辅助函数自身 CC≤15；工具自身及测试回调也已单独测量。

| 原源码文件 | main 超限数 → 交付超限数 | 交付文件最大自身 CC |
|---|---:|---:|
| [apps/platform/src/lib/workbench/authoring-coordinator.ts](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts) | 6 → 0 | 15 |
| [apps/platform/src/lib/workbench/authoring-language-recovery.ts](../../../apps/platform/src/lib/workbench/authoring-language-recovery.ts) | 1 → 0 | 13 |
| [apps/platform/src/lib/workbench/authoring-language.ts](../../../apps/platform/src/lib/workbench/authoring-language.ts) | 1 → 0 | 15 |
| [apps/platform/src/lib/workbench/authoring-recovery.ts](../../../apps/platform/src/lib/workbench/authoring-recovery.ts) | 1 → 0 | 14 |
| [apps/platform/src/lib/workbench/authoring-sync.ts](../../../apps/platform/src/lib/workbench/authoring-sync.ts) | 4 → 0 | 15 |
| [apps/platform/src/lib/workbench/property-edit.ts](../../../apps/platform/src/lib/workbench/property-edit.ts) | 2 → 0 | 15 |
| [metriccanvas-authoring/contracts/authored/publication-contract.ts](../../../metriccanvas-authoring/contracts/authored/publication-contract.ts) | 2 → 0 | 13 |
| [packages/data-execution/src/effective-query.ts](../../../packages/data-execution/src/effective-query.ts) | 1 → 0 | 12 |
| [packages/data-execution/src/paged-join/rows.ts](../../../packages/data-execution/src/paged-join/rows.ts) | 1 → 0 | 13 |
| [packages/data-execution/src/query-result-inputs.ts](../../../packages/data-execution/src/query-result-inputs.ts) | 1 → 0 | 11 |
| [packages/data-execution/src/source-program/range-policy.ts](../../../packages/data-execution/src/source-program/range-policy.ts) | 3 → 0 | 13 |
| [packages/data-execution/src/source-program/session.ts](../../../packages/data-execution/src/source-program/session.ts) | 3 → 0 | 15 |
| [packages/engine/runtime/src/execution.ts](../../../packages/engine/runtime/src/execution.ts) | 1 → 0 | 14 |
| [packages/engine/runtime/src/filter-state.ts](../../../packages/engine/runtime/src/filter-state.ts) | 9 → 5 | 42 |
| [packages/page/src/extract-page-params.ts](../../../packages/page/src/extract-page-params.ts) | 2 → 0 | 3 |
| [packages/page/src/param-bindings.ts](../../../packages/page/src/param-bindings.ts) | 2 → 0 | 11 |
| [packages/page/src/report-date-filters.ts](../../../packages/page/src/report-date-filters.ts) | 2 → 0 | 14 |
| [packages/page/src/validate-compute-dependencies.ts](../../../packages/page/src/validate-compute-dependencies.ts) | 1 → 0 | 12 |
| [packages/page/src/validate-paged-join.ts](../../../packages/page/src/validate-paged-join.ts) | 1 → 0 | 14 |
| [packages/page/src/validate-query-results.ts](../../../packages/page/src/validate-query-results.ts) | 1 → 0 | 12 |
| [packages/page/src/validate.ts](../../../packages/page/src/validate.ts) | 11 → 1 | 32 |

原清单167个现存文件的同口径总欠项为175→125。6个已存在于main的超限函数保持自身CC不增长，仍列欠项；当前完整259条对照及剩余125个函数见[原清单复测](2026-10-22-original-list-follow-up.md)。原工作区较旧的14文件40→17、续修20及优先续修6是历史证据，不替代本次交付复测。

## 最新基线行为差分

将 main 基线源码独立归档，并显式解析其自己的 Page/Data Execution 依赖，分别打包与交付代码比较。页面完整输出、有序错误、异常名称/代码/消息、输入不变性、查询/URL事件、导出请求与告警、取消及微任务顺序均按各入口核对。

| 范围 | 组数 |
|---|---:|
| 203个页面夹具的解析、参数候选与应用，及日期/组合查询非法变异 | 4040 |
| 查询、筛选/URL及执行回执 | 8664 + 6016 + 2688 |
| 结果绑定、输入、范围、快照、组合成员与完整导出 | 8810 |
| 合计 | 30218 |

上述差分全部通过；主要回归不变量包括多输入最后错误优先、空结果优先于等待、集合上限错误覆盖无效值、总数不一致只告警的现有范围规则、导出冻结请求/部分失败及取消、候选验证先于复用和发查询、受保护时间条件与捕获查询对齐、CAS/幂等与语言轮次状态。

## 本地完整验收

- 全仓 `pnpm check` 通过；Svelte无错误或警告。
- `pnpm test`：315个文件通过，2718项通过、5项因设计源/联机环境跳过，共2723项。补入原工作区两份被忽略的设计源，并启动本检出的本地DQE Sim后，对原跳过项所在的两个测试文件复验，46项全部通过；不将首次跳过算作通过。
- `pnpm build`、`pnpm packages:check` 通过；五个核心包、Embed、Platform产物入口及声明闭合。Platform仍有已有的大chunk提示。
- `pnpm validate`：82个页面文档全部通过。
- 正式契约导出及 `pnpm authoring:contracts:check` 通过（1064个产品、4个创作、1个接口文件）；13个派生文件更新。全量测试包含local-authoring独立安装、知识/校验器一致性和导出隔离。
- 固定口径测量器5项测试通过；自身及测试回调均无新增超限。
- Embed完整Chrome浏览器套件：226项全部通过，包含现有IOC、时间/金额、过滤、分页、详情、图表、显示条件、表格及PDF/PNG/Excel导出场景。
- 工作台Chrome回归通过：拖放、排序、宽度、选择操作、删除、撤销、输入隔离、显式保存和页面设置；截图保存在本任务临时证据目录。
- UI首次运行Chrome 35项通过；Edge 35项因本机没有系统安装而无法启动。使用Playwright既有可执行路径参数，在临时目录解包微软官方Stable包并核对官方SHA256后补验；不安装到系统目录。补验Edge 35项全部通过（Microsoft Edge 155.0.4283.62）；Chrome/Edge共70项通过。

## 提交与远端验收

Python门禁已通过：Radon 6.0.1扫描15个固定公共文件、368个函数，最大CC15，无超限。Node独立消费者及CLI安装检查通过，包括无渲染依赖、外部类型与已安装CLI入口。Python部署与同步契约13项全部通过（锁定依赖、Python3.12临时虚拟环境）。

提交前再次fetch确认main仍为本记录基线。提交后核对远端main并按该SHA等待完整CI；CI结果以GitHub运行记录为准。浏览器及联机使用本地夹具/DQE Sim，未宣称真实DQE、Relay、Java或生产环境验收。

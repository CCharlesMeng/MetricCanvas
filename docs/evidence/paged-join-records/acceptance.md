# 商务驳回审批记录关联整改

日期：2026-10-27。基线：`cc2ae9155528cf7387683bc3bbf7feee97085af5`，独立工作树 `paged-join-records`。用户约束：DQE及物理表结构保持，整改由页面协议与共享执行完成。交付时按最新 origin/main 合入并重新生成分发产物；远端与 CI 结果由交付记录单独报告。

## 实现与业务配置

Schema 6.66 显式增加 `pagedJoin.records`、成员 `notApplicableFilters`。业务页面 `pages/business-rejection-details.json` 保留两源及中文查询字段，加入审批期间，本地按主表审批完成时间过滤，基本信息不绑定期间；商务ID作为多对一关联键，`record-id` 是快照内独立记录标识。`records` 未声明时，旧校验和执行保持。

在共享 `data-execution` 中分批完整读取主表、先应用本地期间、按去重商务ID分批补列，再对最终记录统一查询视图。行数、累计原始/投影字节和超时有预算；要求准确总数与完整窗口，跨批总数变化、补列重复键、额外编码、截断、上游失败、超限均不发布部分成功。完整快照由 SourceProgram 所属读取器缓存，表格分页、搜索、筛选、候选、导出共用；期间与区域改变、上下文改变、刷新和销毁不沿用过期快照。候选会排除自身列筛选，保留其他条件；完整候选不误用10000行导出上限。

执行、状态所有权沿用 SourceProgram / QueryRunner / TableSession。新增公共信息只在页面协议；没有额外DQE服务、SQL拼装或表结构要求。表格及页头复用既有UI，无新样式。

## 验证

| 层级 | 命令/操作 | 结果 |
|---|---|---|
| 业务页及示例 | `parsePage`；独立 `validate-page.mjs --expected-layout dashboard` | 通过；业务及示例均Schema 6.66 |
| 全页面目录 | `pnpm validate pages` | 112/112通过；版本诊断夹具按生成链再生成并复核 |
| 页面/共享执行/运行时 | `pnpm exec vitest run packages/page/tests packages/data-execution/tests packages/engine/runtime/tests apps/playground/tests/data-directory.test.ts` | 171个文件、1487项通过 |
| local-authoring与参考 | `pnpm exec vitest run tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-upgrade.test.ts tests/page-reference.test.ts` | 4个文件、172项通过；包含仓外安装、哈希与升级 |
| 类型检查 | page、data-execution、engine、playground各自check；`tsc --noEmit -p tests/tsconfig.json` | 通过；Svelte检查0错误0警告 |
| 生成与分发 | `pnpm authoring:contracts`及`authoring:contracts:check` | 已生成；1249 product、4 authoring、1 interface产物自洽 |
| MC | `pnpm mc:content:check` | 通过：契约自洽、独立来源覆盖、30项MC测试及可见诊断夹具全部通过 |
| 真实DQE/Relay | 无已验真的真实传输执行 | NOT_RUN |

本地Python命令使用既有authoring虚拟环境；系统Python缺少fastmcp/jsonschema的失败属于工具环境，随后使用含锁定依赖的环境重跑。首轮完整authoring脚本额外包含历史Bundle隔离检查，已停止该冗余批次；其中暴露的升级示例版本滞后已修复，当前范围的172项local-authoring回归全部通过。不将被停止的全量脚本记为通过。

交付复验基线：`284b87a383038f31390a84b343d83e8924593caa`。保留该 main 的 local-authoring 优化，从合并后真源重新生成全部契约、锁和 MC 产物；上述页面、运行时、local-authoring 与 MC 检查在此基线上重跑。复杂度与浏览器证明所对应的业务实现未改变。

## 浏览器实测

入口 `http://localhost:5187/pages/record-join-demo`，来自独立工作树的Vite，原工作区5173服务未改动。数据由明确标注的合成Adapter提供，自动验收以同一业务JSON的执行配置为输入。

- 默认显示1205条，第二页序号11—20；搜索`BIZ-00001`得到同一商务初审、复审两条，同一当前责任人。
- 生命状态候选同时有“已关闭”“进行中”，虽然当前页全部显示“已关闭”。选“进行中”后全局总数601，页码重置。
- 将期间起止都改成2026-08并按Enter提交，得到0条；按输入控件既有规则提交，不把未提交草稿视为筛选变化。
- 默认条件实际下载`审批记录关联验收.xlsx`，使用标准库读取工作表XML，确认1206行，其中表头1行、审批记录1205行。
- `?sourceFailure=true`产生稳定`DQE_TRANSPORT_ERROR`诊断，不显示成功总数或部分行。现有Table呈现沿用空态；本批没有新增错误面板样式。

截图：`two-approvals.png`、`status-filter.png`、`empty-period.png`、`member-error.png`。

## 复杂度

工具口径`metriccanvas-ts-ast/1`，TypeScript 5.9.3；函数自身selfCC，嵌套回调逐项计量。Svelte只测script，不包含模板；同一工具测基线和完成版本，原始数据见`complexity-before.json`、`complexity-after.json`。新增核心37个函数/回调均≤15。

| 函数 | 前 | 后 |
|---|---:|---:|
| compilePagedJoin | 18 | 9 |
| selectPageMember（新增抽取） | — | 11 |
| executePagedJoin | 16 | 13 |
| executeCompleteJoin（新增抽取） | — | 5 |
| exportPagedJoin | 21 | 12 |
| appendExportChunk（新增抽取） | — | 12 |
| reusableInitialSnapshot | 15 | 12 |
| incompleteInitialWindow（新增抽取） | — | 6 |
| memberInputs | 3 | 4 |
| projectionErrors | 11 | 15 |

未关闭的存量：orchestrate/start 26、refetch 17、筛选订阅回调22；presentationPolicyErrors 29、checkComponent 34；parsePage 31。本批只替换筛选消费识别，相关存量自身CC不增长；其余未改函数不因位于同文件扩入重构。避免将协议实施扩大到生命周期/全部校验重构。新辅助函数全部实测，无新增超限。

## 真实接入仍需核实

真实字段路由、审批时间格式、区域语义、基本信息每个完整关联键至多一行、HCS固定排除条件和单表多字段稳定分页尚未执行验真。原页面中“不含HCS”的业务提示保留，不虚构未提供的枚举或固定条件。单表无事务快照令牌，跨批同总数内容变化无法由客户端完全证明；快照内生成的记录标识不作为跨刷新业务ID。

本地期间过滤需要在区域完整读取后执行，因此100000行、64MiB默认预算针对实际读取范围，不能仅按期间内的最终行数判断成本。旧`fallback.maxRows=1000`不被偷偷调大；新记录模式明确使用自己的预算。

## 交付复验

本次业务提交为 `e1a33e5d98d68b9e9a465f4e4381e6e7ee8db6ed`。首次 CI 的压缩知识摘要受 gzip 操作系统头影响；并行交付 `a7033134256ed1e13775c25b6a5f6804ba0e3259` 已统一为255，保持知识内容和旧包读取兼容。本任务采用该修复，并复验173项 local-authoring、30项 MC、工具类型、正常与模拟Linux gzip头的中立契约检查，均通过。

`a7033134` 的全量测试有357个文件通过、1个文件失败；3206项通过、1项失败、5项跳过。唯一失败为本次新增内部入口导出 `sourceFilterIds` 未同步公开面快照，已使用 `UPDATE_PUBLIC_API=1 pnpm test tests/public-api.test.ts` 正式更新，并以普通命令重跑8/8通过。快照差异仅新增该名称；未改可执行代码，无新增复杂度分支。完整远端 CI 结果以补齐快照后的提交为准，失败批次不计为绿色。

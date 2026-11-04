# 2026-11-04 圈复杂度清单审核与优化

## 最新交付验证

已整合最新 main 基线 `56e822b4d20aed73c56aa1344dd22dac8840733b` 并重新验证。当前 TS/JS、Python 全扫描平均分别为 **2.561691 / 4.288987**；维护代码平均 **2.227340 / 4.232664**，存量超限 **115 / 63**。类型、构建、1973项定向测试与266项embed浏览器检查通过。详见 [交付回执](delivery/README.md)。下文数字与“未推送”等状态是原基线审核快照，供追溯，不代表最新交付状态。

## 原基线结论与验收口径

用户确认按“**全项目平均 CC <5，单函数保留合理上限**”验收。两个语言的全扫描范围和维护代码平均值均通过 `<5`，而且实施前已通过；本批成果是复核错误归属、降低真实热点并建立防回退门禁，不能把原本已达标的平均值当作整改成果。新增及本批修改函数沿用 `CC≤15`。

- 隔离基线：`552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`；改动保存在本次工作树，未提交/推送。用户原工作区已有大量并行工作，本批未移入或覆盖它们，特别是 DQE 文件的未提交变更；报告不是原工作区全部脏文件的验收。
- TS/JS：`metriccanvas-ts-ast/1`，TypeScript 5.9.3；Svelte 用编译器定位 script 区块，保留行号，**不覆盖模板分支**。`selfCC` 排除嵌套函数，每个闭包另计。`subtreeCC` 只描述工厂覆盖的决策规模。
- Python：Radon 6.0.1，类聚合不当作函数，方法及闭包单列；与 TS 指标分别验收，不相加或跨工具比较。
- 全扫描范围含生成副本、内嵌第三方代码、历史原型；维护代码单独排除这些重复/非维护实现。两个范围都保留文件身份、SHA256、函数、决策数和热点，并分别验收平均值。

| 语言 | 全扫描范围平均 CC | 维护代码平均 CC | 维护函数 CC>15 |
|---|---:|---:|---:|
| typescript-javascript | 2.558237 → 2.552421 | 2.239991 → 2.234605 | 136 → 121 |
| python | 4.536257 → 4.535559 | 4.477191 → 4.476552 | 68 → 68 |

**平均值不是全仓单函数达标。** 仍有 121 个 TS/JS 和 68 个 Python 维护函数超过 15，完整列于 [剩余函数 CSV](remaining-functions.csv)。维护代码最大值分别为 61 和 93，其中 Python 最大值来自测试；生产代码最大值分别为 61 和 43。Python 生产代码单独平均 5.692891，工具单独平均 5.961783；它们不满足“各类别分别 <5”这一更严格口径，本次没有宣称满足该口径。测试代码不能替代这些热点的后续治理。

完整机器证据：[实施前](before.json.gz)、[实施后](after.json.gz)、[前摘要](before-summary.json)、[后摘要](after-summary.json)。压缩包为完整 JSON 测量结果；`gzip -dc` 可读取，快照摘要以其中 `inventorySha256` 为准。

## 用户给出的 20 条清单

原清单没有扫描器、版本、源码 SHA 或闭包计数定义，不能确认原数值的准确性，也不称为外部 CodeCheck 复扫。清单大数在多个工厂中更接近闭包累计规模。例如协调器自身原本就是 1，不能把它写成“311→1”的代码优化。

| 文件 | 函数 | 原清单数值 | 基线自身 CC | 基线 subtreeCC | 该函数及内部闭包最高 CC（前→后） | 当前自身 CC |
|---|---|---:|---:|---:|---:|---:|
| `apps/platform/src/lib/workbench/authoring-coordinator.ts` | `createAuthoringCoordinator` | 311 | 1 | 338 | 15 → 15 | 1 |
| `packages/data-execution/src/source-program/session.ts` | `createSourceProgram` | 156 | 10 | 182 | 14 → 14 | 10 |
| `apps/platform/src/lib/workbench/authoring-sync.ts` | `createAuthoringSync` | 155 | 7 | 188 | 15 → 15 | 7 |
| `packages/engine/runtime/src/filter-state.ts` | `createFilterState` | 140 | 17 | 135 | 42 → 13 | 2 |
| `packages/engine/runtime-ui/src/table/controller.ts` | `createTableController` | 122 | 1 | 119 | 11 → 11 | 1 |
| `packages/page/src/validate.ts` | `componentErrors` | 122 | 4 | 130 | 15 → 15 | 4 |
| `packages/engine/runtime/src/orchestrator.ts` | `orchestrate` | 112 | 5 | 116 | 26 → 14 | 5 |
| `apps/platform/src/lib/workbench/authoring-language.ts` | `createAuthoringLanguage` | 109 | 1 | 110 | 15 → 15 | 1 |
| `apps/platform/src/lib/workbench/authoring-language-recovery.ts` | `createAuthoringLanguageRecovery` | 94 | 1 | 103 | 13 → 13 | 1 |
| `metriccanvas-authoring/mc-content/authoring-contracts/authored/publication-contract.ts` | `validateCandidateRelations` | 85 | 11 | 78 | 13 → 13 | 11 |
| `metriccanvas-authoring/contracts/authored/publication-contract.ts` | `validateCandidateRelations` | 85 | 11 | 78 | 13 → 13 | 11 |
| `packages/page/src/table/validate-expansion.ts` | `rowExpansionErrors` | 82 | 4 | 70 | 65 → 15 | 4 |
| `packages/page/src/validate.ts` | `computeErrors` | 81 | 7 | 87 | 14 → 14 | 7 |
| `packages/data-execution/src/dqe/dqe.ts` | `createDqeGateway` | 78 | 1 | 66 | 12 → 12 | 1 |
| `apps/platform/src/lib/page-assets/java-adapter.ts` | `createPageAssetsClient` | 74 | 1 | 76 | 15 → 15 | 1 |
| `packages/page/src/validate.ts` | `invariantErrors` | 69 | 15 | 68 | 15 → 15 | 15 |
| `tools/scripts/page-reference.ts` | `buildPageReference` | 65 | 60 | 81 | 60 → 14 | 9 |
| `apps/platform/src/lib/workbench/authoring-publication.ts` | `createAuthoringPublication` | 65 | 1 | 92 | 19 → 12 | 1 |
| `packages/page/src/presentation-policy.ts` | `presentationPolicyErrors` | 64 | 28 | 67 | 34 → 15 | 1 |
| `packages/engine/runtime/src/table/expansion.ts` | `createRowExpansionController` | 59 | 1 | 56 | 12 → 12 | 1 |

20 条全部可定位；`mc-content/authoring-contracts/authored/publication-contract.ts` 是分发副本，与 `contracts/authored/publication-contract.ts` 不能算成两个独立整改对象。当前 20 个函数及各自内部闭包最高值均≤15。没有为已经达标的工厂重写其接口。

## 实际重构与函数上限

| 文件 | 全部函数数（前→后） | 文件内最高自身 CC | 超过15的函数数 |
|---|---:|---:|---:|
| `apps/platform/src/lib/workbench/authoring-publication.ts` | 36 → 37 | 19 → 12 | 1 → 0 |
| `packages/engine/runtime/src/filter-state.ts` | 65 → 77 | 42 → 14 | 5 → 0 |
| `packages/engine/runtime/src/orchestrator.ts` | 66 → 70 | 26 → 14 | 2 → 0 |
| `packages/page/src/presentation-policy.ts` | 47 → 54 | 34 → 15 | 2 → 0 |
| `packages/page/src/table/validate-expansion.ts` | 29 → 36 | 65 → 15 | 1 → 0 |
| `tools/scripts/page-reference.ts` | 84 → 94 | 60 → 14 | 4 → 0 |

六个源文件中实际关闭 15 个超限函数；全部新增辅助函数及修改后的函数均≤15。拆分按既有职责，公开接口保持不变：

- 筛选状态：初值校验、时间/维度门禁、候选回执、依赖传播分别处理；提交拆为变更解析、归一化、金额上下文校验与门禁调和。共享状态仍由原工厂持有，保留按项只读检查、原子提交、一次通知及顺序。
- 取数编排：初始回执选择与自动分页校正单列；单次 refetch 的目标执行单列，保留取消、token、generation、迟到回执和发布顺序。
- 发布回执：完整可信校验和过期回执保护之后，分离完成状态与未完成状态的消费，保留 unknown 不重发和租约释放行为。
- 子表格校验：父表约束、只读列、查询定义、私有输入、绑定和投影校验分组，保留错误类型、路径、消息、顺序和异常捕获范围。
- 展示策略校验：筛选写入、条件叶子和各组件约束分组，保持正文、表格、按钮及条件行键的既有判断。
- 页面参考生成：按示例、结构表、枚举、语义规则、模块文档和分支见证组织，保留产物输出顺序与内容语义；生成内容只因源文件字节身份更新。

新增字段 0、删除字段 0，Schema 版本不变；没有增加协议能力。仅内部职责重构，不新增演示页面或声明新的浏览器/真实服务验收。local-authoring 的独立脚本、源码身份与锁通过正式导出器再生，没有手改哈希。

## 自动检查

`pnpm complexity:check` 执行测量器测试、全范围/维护代码平均值检查及 [存量台账](../../../../tools/scripts/complexity-debt.json) 回归检查。新增函数超过15、存量上界增长、改名或跨文件迁移后的超限均失败；匿名函数行号变化可识别，新增重复回调不能复用一份存量额度。台账保留189条待治理事项，不是清零证明；不自动刷新它来消除失败。

原 Python 公共模块门禁继续执行，15文件/371函数，最大15，0超限，见 [回执](python-public-gate.json)。使用 `pnpm complexity:audit --check-functions` 检查所有维护函数≤15时，189项存量应导致命令失败。

## 行为与工程验收

- [差分回执](differential.json)：312个页面，完整展开校验、完整展示策略错误、遍历输出及输入不变性共1248组对比；100组确定性筛选序列、6000次操作，0差异。
- 新增7组永久回归：正常query/inline、层级展开、多错并存、重复私有作用域、重复行键/非法嵌套来源以及条件展示和动作问题；预期完整有序错误由重构前实现冻结，不以断言含有某个错误代替完整列表对比。
- 测量器回归覆盖严格平均阈值、闭包、真实Svelte脚本定位/行号、解析失败、Python方法及闭包去重、新增/增长/改名/移动/匿名重复超限。
- 全仓类型检查、包构建及正式分发再生/一致性检查已通过。完整 Vitest：436个文件、3926项通过、5项跳过；测量器11项通过。

未运行远端 CI、生产部署、真实 DQE/Relay/Java/模型；未交付 embed 构建产物。本地 CI 配置已接入门禁，不能据此声称远端绿灯。

### 最终工程回执

完整测试已结束且退出0，详见 [工程检查](engineering-checks.json)、[完整测试汇总](full-tests.log)、[类型检查](types.log)、[包构建](build.log)、[分发一致性](contracts.log)、[默认复杂度门禁](complexity-gate.log)及[严格全函数检查的预期失败](strict-gate.log)。最终1686个受测文件逐一比对SHA256，0不一致。3926项通过和5项跳过分开报告，不将跳过项计为通过。

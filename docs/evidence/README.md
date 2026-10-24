# 证据附件

## 提交范围

默认只提交简短结论和仍被决策引用的分析，写清源码版本、验证命令、结果及未验范围。截图、完整 diff、测试日志、构建输出和逐函数扫描等原始机器报告留在本地，优先输出到已忽略的 `.scratch/` 或 `test-results/`，不作为每次交付的必交附件。`.gitignore` 默认忽略本目录新增的非 Markdown 文件。

测试或工具实际读取的输入放在消费者旁的 `fixtures/`。确需保留的原始设计、外部来源或复现实验输入应说明消费者与用途，再按具体路径放行；已有主题样式来源、门户调查原文和评测输入保留。

2026-10-24 清理已提交的冗余运行附件，保留历史结论。指向被清理附件的文档链接改为清理前提交的 GitHub 历史版本；正文中的旧文件名仅描述当时运行，不表示当前工作区仍有该文件。删除当前版本中的附件不会缩小 Git 历史，也不需要为此重写历史。

## 保留依据

这里放**被 ADR 正文、代码或正式文档当作论据引用的报告与基线**。它们不是过程件：过程件跟批次走，批次收口就整批进 [`docs/archive/`](../archive/README.md)；证据附件**跟决策走**——只要引用它的那份决策还生效，它就还在被读。

判据只有一条：**移走它会不会切断某份决策的论证链。** 会，就放这里。

| 文件 | 谁把它当论据 |
|---|---|
| [`2026-08-chat-bi-competitive-research.md`](./2026-08-chat-bi-competitive-research.md) | [ADR-0039](../adr/0039-derived-measure-templates-as-company-definitions.md) 与 [ADR-0040](../adr/0040-scope-card-as-control-panel.md) **正文**，是两份决策的论证依据 |
| [`2026-08-packages-architecture-review.md`](./2026-08-packages-architecture-review.md) | `packages/page/tests/schema-boundaries.test.ts` 的注释，用来解释那条边界为什么存在 |
| [`2026-09-08-legacy-baseline.md`](./2026-09-08-legacy-baseline.md) | 根 [`README.md`](../../README.md)；且它是 git tag `legacy/pre-static-platform-2026-09-08` 的**唯一索引**，丢了就找不回旧链 |
| [`2026-08-frontend-calculation-reconciliation.md`](./2026-08-frontend-calculation-reconciliation.md) | [`ioc-operation-map.md`](../archive/ioc-operation-map/ioc-operation-map.md) 三处称其为空值语义的「替代真源」 |
| [`2026-08-ioc-harness-capability-review.md`](./2026-08-ioc-harness-capability-review.md) + [`-action-pack.md`](./2026-08-ioc-harness-action-pack.md) | 互为索引的 IOC 能力证据档案 |
| [`dataset-reconciliation.md`](./dataset-reconciliation.md) | ADR 基线的[未决事项](../adr/topics/open-questions.md)，作为 [ADR-0033](../adr/0033-suspend-dataset-runtime.md) 恢复条件的逐条对账 |
| [`中间层分析.md`](./中间层分析.md) | [ADR-0006](../adr/0006-metadomain-layering-and-naming.md) 正文（「表服务」改名「数据服务」的来源）；`packages/engine/data-gateway/fixtures/services-list.json` 按它 §4.3.1 的字段形状录制 |
| [`组件分析.md`](./组件分析.md) | [ADR-0006](../adr/0006-metadomain-layering-and-naming.md) 正文 |
| [`architecture-formal-model.md`](./architecture-formal-model.md) | [ADR-0074](../adr/0074-browser-component-building-and-isolated-legacy-baseline.md) 与 [ADR-0076](../adr/0076-formal-architecture-contract-scope-and-enforcement.md) 正文，是形式化架构的模型草案；**草案未收口，校验器未实现** |
| [`wayfinder-107-pangu-integration-baseline.md`](./wayfinder-107-pangu-integration-baseline.md) | [ADR-0077](../adr/0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) 正文与[问数编排主题页](../adr/topics/ask-orchestration-and-scope-governance.md)，是盘古接入的可验收行为清单 |

## 2026-10-12迁入证据

| 证据 | 引用及范围 |
|---|---|
| [显式数字颜色与图表标签](./2026-10-12-explicit-presentation/result.md) | ADR-0101的本仓实现和本地验收；原query导出及生产联调未通过或未执行 |
| [表格正常尺寸适配与数值间距修正](./2026-10-12-table-fit-chart-distance/result.md) | ADR-0101后续实现证据；正常桌面全列、窄屏内部滚动及贴近节点标签 |
| [创作最小流程决策基线](./2026-09-20-authoring-minimal-flow-and-skill-plan.md) | ADR-0083的历史决策依据；当前创作计划不继续按此旧分稿执行 |
| [IOC真数据缺口基线](./2026-09-21-ioc-live-data-gaps.md) | ADR-0085的依赖背景；inline等阶段描述不作为当前实现状态 |
| [执行整改M0–M7报告](./2026-09-29-authoring-mc-execution-report.md) | 当前接入待办的本仓完成证据；生产采用未执行 |
| [数据上下文讨论证据](./authoring-data-context-2026-09/README.md) | 结果字段来源对账；原JSON不是生产接口契约 |
| [参数正交化设计证据](./page-parameters/README.md) | 参数协议的设计背景和spike事实，现行规范另有入口 |
| [报告日期筛选与导出](./report-date-filters/README.md) | ADR-0097的本地实现、浏览器和PDF验收依据 |
| [微前端部署基线](./qiankun-platform/design-baseline/deployment-boundary.md)、[MC实施交接](./qiankun-platform/design-baseline/handoff-mc.md) | ADR-0093/0094的设计依据；目标门户仍待实证 |
| [门户调查与历史配置](./qiankun-platform/portal-handoff/README.md) | 用户提供的来源材料；保留原报告与备份，不参与运行构建 |

## 读它们时注意

**证据附件记的是当时看到的事实，不是当前结论。** 现行结论一律以 ADR 与[主题页](../adr/topics/)为准；这些文件只回答「那条结论的依据是什么」。历史正文不改写——发现某份证据已经过期，改的是引用它的 ADR，不是回头改证据。

## 什么时候往这里加东西

写新 ADR 时如果正文要引用一份报告，先问这份报告会不会随批次收口进归档。会，就把它挪到这里再引用，并在上表补一行。**不要让 ADR 正文的链接指进 `docs/archive/`。**

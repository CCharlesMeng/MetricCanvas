# 证据附件

## 提交范围

本目录的新增文件和过程性更新默认只留本地，包括 Markdown 结论、截图、完整 diff、测试日志、构建输出和扫描报告。`.gitignore` 忽略本目录新增文件；已跟踪文件仍须按 [提交内容与文件体积](../../AGENTS.md#提交内容与文件体积必选) 审查。验证照常执行，源码版本、命令、结果及未验范围写入最终答复或 PR，长期结论更新 ADR、协议等正式文档。

测试或工具实际读取的最小输入放在消费者旁的 `fixtures/`，同样遵守文件体积上限。确需提交来源材料或验证附件时，按仓库规则取得逐文件明确确认。已有来源和历史记录的清理另核对消费者与引用。

2026-10-24 清理已提交的冗余运行附件，保留历史结论。指向被清理附件的文档链接改为清理前提交的 GitHub 历史版本；正文中的旧文件名仅描述当时运行，不表示当前工作区仍有该文件。删除当前版本中的附件不会缩小 Git 历史，也不需要为此重写历史。

2026-10-28 按清单移出 322 个运行附件，其中 266 个停止版本管理、56 个原本已忽略；全部本地副本保存在 `.scratch/evidence-runtime-attachments-20261028/`。文档对已提交附件的引用使用清理前固定提交的 GitHub 历史链接；其他附件标明本地保存位置。分析、验收结论、设计来源和持续校验夹具保留，本轮未处理其他分类。

2026-11-05 清理：移出本目录除规则入口外的全部 906 个已跟踪文件，并清理 15 个 `artifacts/` 文件。实际消费者需要的 30 个输入迁至 `packages/ui/fixtures/os-theme/` 与 `tools/fixtures/mc-content-layout/`；其他文件保留在本地备份，文档引用改为清理前固定 Git 版本。以下索引用于查阅历史，不表示附件仍在当前源码树中。

## 保留依据

这里保留历史上**被 ADR 正文、代码或正式文档当作论据引用的报告与基线**。以下分类解释现存记录的用途，不构成新增附件的提交许可；过程件在本地收口，提交范围遵守上面的约束。

判据只有一条：**移走它会不会切断某份决策的论证链。** 会，就放这里。

| 文件 | 谁把它当论据 |
|---|---|
| [`2026-08-chat-bi-competitive-research.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-08-chat-bi-competitive-research.md) | [ADR-0039](../adr/0039-derived-measure-templates-as-company-definitions.md) 与 [ADR-0040](../adr/0040-scope-card-as-control-panel.md) **正文**，是两份决策的论证依据 |
| [`2026-08-packages-architecture-review.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-08-packages-architecture-review.md) | `packages/page/tests/schema-boundaries.test.ts` 的注释，用来解释那条边界为什么存在 |
| [`2026-09-08-legacy-baseline.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-09-08-legacy-baseline.md) | 根 [`README.md`](../../README.md)；且它是 git tag `legacy/pre-static-platform-2026-09-08` 的**唯一索引**，丢了就找不回旧链 |
| [`2026-08-frontend-calculation-reconciliation.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-08-frontend-calculation-reconciliation.md) | [`ioc-operation-map.md`](../archive/ioc-operation-map/ioc-operation-map.md) 三处称其为空值语义的「替代真源」 |
| [`2026-08-ioc-harness-capability-review.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-08-ioc-harness-capability-review.md) + [`-action-pack.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-08-ioc-harness-action-pack.md) | 互为索引的 IOC 能力证据档案 |
| [`dataset-reconciliation.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/dataset-reconciliation.md) | ADR 基线的[未决事项](../adr/topics/open-questions.md)，作为 [ADR-0033](../adr/0033-suspend-dataset-runtime.md) 恢复条件的逐条对账 |
| [`中间层分析.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/%E4%B8%AD%E9%97%B4%E5%B1%82%E5%88%86%E6%9E%90.md) | [ADR-0006](../adr/0006-metadomain-layering-and-naming.md) 正文（「表服务」改名「数据服务」的来源）；`packages/engine/data-gateway/fixtures/services-list.json` 按它 §4.3.1 的字段形状录制 |
| [`组件分析.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/%E7%BB%84%E4%BB%B6%E5%88%86%E6%9E%90.md) | [ADR-0006](../adr/0006-metadomain-layering-and-naming.md) 正文 |
| [`architecture-formal-model.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/architecture-formal-model.md) | [ADR-0074](../adr/0074-browser-component-building-and-isolated-legacy-baseline.md) 与 [ADR-0076](../adr/0076-formal-architecture-contract-scope-and-enforcement.md) 正文，是形式化架构的模型草案；**草案未收口，校验器未实现** |
| [`wayfinder-107-pangu-integration-baseline.md`](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/wayfinder-107-pangu-integration-baseline.md) | [ADR-0077](../adr/0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) 正文与[问数编排主题页](../adr/topics/ask-orchestration-and-scope-governance.md)，是盘古接入的可验收行为清单 |

## 2026-10-12迁入证据

| 证据 | 引用及范围 |
|---|---|
| [显式数字颜色与图表标签](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-10-12-explicit-presentation/result.md) | ADR-0101的本仓实现和本地验收；原query导出及生产联调未通过或未执行 |
| [表格正常尺寸适配与数值间距修正](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-10-12-table-fit-chart-distance/result.md) | ADR-0101后续实现证据；正常桌面全列、窄屏内部滚动及贴近节点标签 |
| [创作最小流程决策基线](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-09-20-authoring-minimal-flow-and-skill-plan.md) | ADR-0083的历史决策依据；当前创作计划不继续按此旧分稿执行 |
| [IOC真数据缺口基线](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-09-21-ioc-live-data-gaps.md) | ADR-0085的依赖背景；inline等阶段描述不作为当前实现状态 |
| [执行整改M0–M7报告](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-09-29-authoring-mc-execution-report.md) | 当前接入待办的本仓完成证据；生产采用未执行 |
| [数据上下文讨论证据](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/authoring-data-context-2026-09/README.md) | 结果字段来源对账；原JSON不是生产接口契约 |
| [参数正交化设计证据](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/page-parameters/README.md) | 参数协议的设计背景和spike事实，现行规范另有入口 |
| [报告日期筛选与导出](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/report-date-filters/README.md) | ADR-0097的本地实现、浏览器和PDF验收依据 |
| [微前端部署基线](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/qiankun-platform/design-baseline/deployment-boundary.md)、[MC实施交接](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/qiankun-platform/design-baseline/handoff-mc.md) | ADR-0093/0094的设计依据；目标门户仍待实证 |
| [门户调查与历史配置](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/qiankun-platform/portal-handoff/README.md) | 用户提供的来源材料；保留原报告与备份，不参与运行构建 |

## 读它们时注意

**证据附件记的是当时看到的事实，不是当前结论。** 现行结论一律以 ADR 与[主题页](../adr/topics/)为准；这些文件只回答「那条结论的依据是什么」。历史正文不改写——发现某份证据已经过期，改的是引用它的 ADR，不是回头改证据。

## 什么时候往这里加东西

新 ADR 优先直接记录必要的依据与结论；验证过程留在本地。只有取得逐文件明确确认后，才提交无法由正式文档承接的附件并补充引用；正式文档不链接未提交的本地文件。

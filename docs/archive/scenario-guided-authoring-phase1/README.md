# 场景参考驱动的页面创作 · 首期（2026-09-17）

首期范围是**结构与呈现**——让模型按显式的页面结构计划组织章节，而不是把取数需求和版面混在一次调用里；自动分析结论明确不在本期。S0–S4 全部完成并本地验收，2026-09-21 归档。

## 最终生效的结论落在哪

- **架构裁决**：[ADR-0082](../../adr/0082-explicit-business-sections-in-platform-authoring.md) 完整页面的业务章节由显式页面结构计划组织；它同时收窄了 [ADR-0055](../../adr/0055-scope-groups-as-section-boundaries-in-ask-answers.md) 的自动口径分区——后者退为普通问数与快速装配的缺省，不再是完整报告的分区依据。现行结论读 [问数编排与口径治理](../../adr/topics/ask-orchestration-and-scope-governance.md)。
- **工具面**：`create_content_page` 的 plan/operations 互斥（旧 `compose_page` 保持兼容）、四个分区编辑工具（`add_section`/`set_section`/`move_section`/`remove_section`）与 `add_source_component`、业务域有界枚举与快照分页，都在 `metriccanvas-authoring`。结构编辑不取数、不覆盖未触及内容；删除章节须明确列出当前全部组件；页头受保护。

## 首期确实证到了什么

Python authoring 446 项、Bundle 1483 个摘要检查、契约导出漂移 479 个文件全通过；真实模型（DeepSeek，3 次请求 / 4 次工具调用）**首次创建即全部 applied，没有人工修补 JSON**；3 个查询源、3 次执行支撑 9 个数据组件；1440 与 768 两档视口无 pageerror、无横向溢出。逐项见 [`verification.md`](./verification.md)。

## 被推翻的方向与尚未解决的

- **「技术通过」不等于「业务组织与视觉达标」。** 用户复核指出顶部指标过碎、缺少示例卡片层次、「结构分析」命名与表达重复。首期的技术结果仍成立，但不能用作质量证明。
- **更要紧的一条**：旧模型提示里预设了「概览 / 趋势 / 结构分析」这三段，因此**首期结果证明不了模型能自主设计章节**——提示给了答案，产出符合答案，这不是自主性证据。
- 修订方案在 [`docs/plan/scenario-guided-refinement/`](../../plan/scenario-guided-refinement/design.md)，**全部未开始**。它落地后，那批文件会随之进这里。
- 资源用量场景只走了公开工具回归，没做独立的真实模型专项评测。

## 里面有什么

首期整体方案、`tasks.md`（S0–S4 勾选）、`verification.md`（验收账本）、可移植的页面与校验产物四份 json。原始请求/响应、候选链、查询日志与浏览器截图在本地 `.scratch/flow-report-connected/`，该目录被 git 忽略，不在仓内。

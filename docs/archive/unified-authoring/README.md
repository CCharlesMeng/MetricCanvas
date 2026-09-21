# 统一 Platform 创作 Skill 批次（2026-09-14 ~ 16，已收口）

## 这批做了什么

把「新建页面」和「修改页面」两套独立工作流合成**一个 Platform 创作 Skill**：统一对话入口，模型负责完整方案，无实质歧义时直接生成初稿，工具按确定性职责拆分而不是按创建/修改拆分。普通问数 Skill 的独立入口与临时页面态语义保留不动。

同批还做完了三件配套：参考手册的作者语义与生成关系（`docs/page-metadata/` → `contracts/`）、npm 依赖盘点与安全审计、以及交付前的 F1–F17 迁移清单核查。

## 结论落在哪

- **目标架构**：[`2026-09-15-authoring-agent-architecture.md`](./2026-09-15-authoring-agent-architecture.md)，之后由 [`metriccanvas-authoring/ARCHITECTURE.md`](../../../metriccanvas-authoring/ARCHITECTURE.md) 接手维护。
- **正式规格**：[`2026-09-15-unified-authoring-skill.md`](./2026-09-15-unified-authoring-skill.md)（原 `docs/specs/`）。
- **ADR**：[ADR-0079](../../adr/0079-trusted-authoring-turns-gate-content-tools.md)（可信创作轮次约束内容工具）——其中强 latest 与精确回读的前置已被 [ADR-0080](../../adr/0080-java-assets-single-attempt-save-and-status-publication.md) 调整；平台不保存与候选选择被 [ADR-0083](../../adr/0083-platform-evidence-work-and-internal-draft-save.md) 部分替代。
- **仍在执行的后续**不在这里，在 [`docs/plan/`](../../plan/)：`2026-09-20-authoring-*` 五份与 `2026-09-18-authoring-mcp-*` 两份。

## 被推翻的方向

- **[`2026-09-15-unified-platform-authoring-skill.md`](./2026-09-15-unified-platform-authoring-skill.md) 自己声明是历史方案**：其中较早的接口提案已被候选准备/程序提交、可恢复执行与扩展契约替代。读它要连同这句一起读。
- **不再维护创建与修改两套工作流**——这是本批最主要的删除。
- **F1–F17 的内部迁移状态全部是 blocked**（待提供方事实与逐项验收）。[`2026-09-15-unified-authoring-release-readiness.md`](./2026-09-15-unified-authoring-release-readiness.md) 明确写了：**不得根据该表宣布内部功能已搬迁**，也不得据其 blocked 状态反推「本仓消费者未实现」或「提供方没有接口」。2026-09-16 的[提供方核查](./2026-09-16-provider-integration-audit.md)是更新后的事实。
- **本批不批准生产切换**；真实模型与生产切换状态未变。

## 还在被代码引用的一个文件

`2026-09-15-unified-authoring-s0-sources.json` 被 `tests/page-reference.test.ts` 直接读取。它是机器证据而非文档，原方案（S1）打算把它迁出文档树；**2026-09-21 决定不迁**——同批的 [`2026-09-15-unified-authoring-s0-s1-evidence.md`](./2026-09-15-unified-authoring-s0-s1-evidence.md) 正文按同级文件名链接它，迁走就得改已冻结的实证正文。理由与另一份夹具相同，详见 [`docs/plan/2026-09-21-docs-consolidation.md`](../../plan/2026-09-21-docs-consolidation.md) §4.6。**它是 CI 的真实输入，删改前先跑 `pnpm test`。**

## 里面有什么

方案与规格 4 份、切片与实施计划 3 份、S0–S7 逐阶段实证 7 份、grill 记录 2 份、依赖盘点与审计 4 份、机器证据 json 5 份、`2026-09-15-unified-authoring-retired-shared/` 是被退役的共享参考 3 份。

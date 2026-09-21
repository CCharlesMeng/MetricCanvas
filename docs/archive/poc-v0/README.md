# POC V0 端到端验收（2026-08，#69，已收口）

## 这批做了什么

一次端到端验收，证明**「一句业务问题 → 域路由 → 检索消歧 → 口径卡 → 真实取数 → 临时页面文档 → 沉淀为修订」这条链路成立**。基线是 `main @ 11ee804`（三期实施切片 #60–#68、#32 已合入），验收在分支 `issue-69-golden-questions` 完成。

方法分两层：确定性部分（黄金问题集守卫、端到端、会话回放、追问增量）进 CI；真实模型评测按需运行、不进主 CI。另以 scripted 模式加 DQE 仿真做了一轮联机手验。

## 结论落在哪

链路本身的现行结论在[问数编排与口径治理](../../adr/topics/ask-orchestration-and-scope-governance.md)与[产品形态谱系与两速生命周期](../../adr/topics/product-forms-and-lifecycle.md)，主要是 [ADR-0037](../../adr/0037-ask-orchestration-and-interaction-contract.md)（编排与交互契约）、[ADR-0030](../../adr/0030-transient-page-state-for-ask-and-explore.md)（临时页面态）、[ADR-0036](../../adr/0036-metric-gap-non-blocking-exit.md)（指标缺口不阻塞）。

**注意这份报告的性质**：它自己第一句就写明是 **POC 验收，不是生产就绪评估**。结论只在受控环境（DQE 仿真 + mock 身份 + scripted/确定性模型）下成立。

## 上生产的四项 blocker

报告第 7 节列的四项**至今未解决**，对应登记在[未决事项](../../adr/topics/open-questions.md)：真实身份接入、查询成本与配额、黄金问题集的业务输入、分析会话的持久化存储。不要把这份验收当作「问数已经可用」的依据。

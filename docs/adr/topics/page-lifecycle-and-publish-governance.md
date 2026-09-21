# 页面生命周期与发布治理

> 资产态的保存与发布：当前 Java 接入按单次保存与回执确认，哪些治理能力明确不作为本期前置。

**现行结论：** 本节描述资产态，普通问数与探索的临时页面态不因此自动保存。[ADR-0080](../0080-java-assets-single-attempt-save-and-status-publication.md) 是当前 Java 接入依据：资源 ID 定位记录，修订 ID 作为更新基线；人工保存与 AI 提交各自只有一个发送者，成功以经验证的服务回执确认。冲突或未知结果保留工作并停止，程序只核对已有记录，不以新操作重发，也不要求远端幂等查询或历史精确读取。

发布经工作台人工确认，将当前资源改为发布态；普通保存改为草稿态，**不承诺编辑与独立发布副本的隔离**。草稿历史只展示服务摘要，回退显式指定版本，不承诺回退一定追加修订或提供跨窗口基线检查。幂等操作查询、强 latest、历史精确读取、模板候选与参数提取、发布租约都不作为本期接入前置。

历史设计：[ADR-0008](../0008-immutable-page-revisions-and-publish-leases.md)、[ADR-0010](../0010-page-templates-reference-published-revisions.md)、[ADR-0078](../0078-dimension-values-templates-and-page-instances.md)。0008/0078 的本期保存与发布前置、[ADR-0079](../0079-trusted-authoring-turns-gate-content-tools.md) 的强 latest 与精确回读前置按 0080 的范围替代；原文保留设计背景，不作当前服务保证。0079 自身的可信创作轮次与分通道结论仍然生效，见[产品形态谱系与两速生命周期](./product-forms-and-lifecycle.md)。

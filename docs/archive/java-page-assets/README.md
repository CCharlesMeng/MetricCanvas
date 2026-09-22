# Java 页面资产批次（2026-09-02 ~ 16，已收口）

## 这批做了什么

页面资产（保存、修订、发布治理）的归属，从「本仓自建第一方 Java module」一路改到「消费外部宿主提供的接口」。两段：

1. **2026-09-02 ~ 03**：按 [ADR-0062](../../adr/0062-first-party-java-page-assets-module.md) 建 `metriccanvas-page-assets/` 的 `model`/`service`/`bootstrap` 三个 Maven module，形状按「可被 `CDINL2DataBuilderService` 整体吸收」设计。J1–J4 全部完成：校验器、四个 Interface、内存与 MySQL 仓储、Python / platform Java Adapter、一键纵切 `pnpm slice:page-assets`。
2. **2026-09-16**：按 [ADR-0080](../../adr/0080-java-assets-single-attempt-save-and-status-publication.md) 重做接入，A–E 五段全部打勾（独立内部资产契约、平台单次自动保存、Python 生命周期单次保存、列表/新建/编辑/发布/回退/删除接线、ADR 与测试更新）。

## 结论落在哪

现行结论见[页面生命周期与发布治理](../../adr/topics/page-lifecycle-and-publish-governance.md)。

- **当前接入依据是 [ADR-0080](../../adr/0080-java-assets-single-attempt-save-and-status-publication.md)**：资源 ID 定位、单次保存、以经验证的服务回执确认成功；冲突或未知结果**保留工作并停止**，程序只核对已有记录，不以新操作重发。
- **服务归属是 [ADR-0070](../../adr/0070-consume-host-java-page-assets-api.md)**：Java 服务由外部宿主提供，本仓只负责接口消费与前端验证。
- 创作期边界的事实修正在 [ADR-0063](../../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)，持久化拆分在 [ADR-0064](../../adr/0064-agent-returns-page-artifact-relay-and-java-own-persistence.md)。

## 被推翻的方向

- **第一方 Java module 的建设前提被 ADR-0070 部分取代。** ADR-0062 的工程设计（包根、MyBatis、Flyway、spec-first、幂等指纹、固定锁序）现在是**历史背景**；现有 Java 代码与旧 Swagger **不再自动充当宿主接口真源**。ADR-0062 本身没有被废，它记的边界与有意分歧仍可查。
- **不再要求远端幂等查询或历史精确读取**作为接入前置（ADR-0080 收窄）。
- **本轮未确认的四项后端方案作废**（ADR-0070）；接口资料缺口作为待确认事实登记，不猜能力，也不删除现有 Java 代码。
- **发布租约、模板候选与参数提取不作为本期前置**——ADR-0008 / ADR-0078 的相关设计保留为背景，不作当前服务保证。

## 里面有什么

三份 grill 交接（Java 页面资产、Relay 架构、Authoring 接线）、`metriccanvas-page-assets.md` 的逐切片落地记录，以及 2026-09-16 的架构与实施计划两份——后两份至今被 ADR-0080 正文引用。

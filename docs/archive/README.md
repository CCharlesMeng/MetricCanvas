# 归档：已收口批次

这里放**已经收口的批次过程件**——计划、交接、grill 记录、票据实证。它们不再更新，**探索代码或架构时默认不要读**：结论已经抽进 ADR、协议文档或代码，过程件只在你要追「当时为什么这么定」时才有用。

每个批次目录有一页 `README.md` 结论页，写清三件事：这批做了什么、**最终生效的结论落在哪**、过程中被推翻的方向。**先读结论页，再决定要不要翻里面的过程件。**

归档不是删除。文件都在，git 历史也在，只是从探索路径上挪开了。

| 批次 | 时间 | 内容 | 件数 |
|---|---|---|---|
| [`poc-v0/`](./poc-v0/README.md) | 2026-08 | POC V0 端到端验收（#69）：问数全链路在受控环境成立 | 1 |
| [`research-2026-08/`](./research-2026-08/README.md) | 2026-08 | 三份未被任何决策引用的早期调研 | 3 |
| [`superpowers-specs/`](./superpowers-specs/README.md) | 2026-07 ~ 08 | 外部 skill 留下的四份设计稿，结论已进 ADR | 4 |
| [`dataset-runtime/`](./dataset-runtime/README.md) | 2026-08 | 服务端计算数据集的规划与交接，ADR-0033 已挂起该方向 | 2 |
| [`ioc-operation-map/`](./ioc-operation-map/README.md) | 2026-08 ~ 09 | IOC 作战地图：首个多页数据应用，产出 ADR-0045 ~ 0053 | 27 |
| [`wayfinder-95/`](./wayfinder-95/README.md) | 2026-09 | #95 静态平台、四交付物发包、旧链退出，产出 ADR-0066 ~ 0077 | 23 |
| [`java-page-assets/`](./java-page-assets/README.md) | 2026-09 | Java 页面资产从第一方自建转为消费宿主接口 | 6 |
| [`metriccanvas-agent-migration/`](./metriccanvas-agent-migration/README.md) | 2026-09 | 创作链从 TypeScript 迁往 Relay + Python Tool | 3 |
| [`unified-authoring/`](./unified-authoring/README.md) | 2026-09-14 ~ 16 | 统一 Platform 创作 Skill：一个入口取代创建/修改两套流程 | 30 |
| [`authoring-tickets-126/`](./authoring-tickets-126/README.md) | 2026-09-14 起 | #126 的 20 张实施票与逐票实证 | 75 |
| [`page-time-range-proposal/`](./page-time-range-proposal/README.md) | 2026-09-16 | 显式时间区间参数提案，已被 6.6 分组参数取代 | 1 |
| [`page-params-inline-spec/`](./page-params-inline-spec/README.md) | 2026-09-17 | 参数原位引用与模板化 Spec，形状被 6.6 分组参数取代，计划从未开工 | 3 |
| [`scenario-guided-authoring-phase1/`](./scenario-guided-authoring-phase1/README.md) | 2026-09-17 | 场景参考驱动创作首期：结构与呈现已实现并验收，产出 ADR-0082 | 7 |
| [`docs-consolidation/`](./docs-consolidation/README.md) | 2026-09-21 | 过程性文档聚合瘦身：本目录、`docs/evidence/` 与 ADR 主题页都是它的产物 | 1 |

## 什么时候往这里加东西

一个批次收口时做三件事，缺一件就不算收口：

1. **抽结论**——把仍然生效的裁决写进 ADR 或正式协议文档，过程件里不留唯一副本；
2. **写结论页**——照上面三段式写一页 `README.md`；
3. **整批移进来**——连同它的实证、证据 json 一起，并扫一遍全仓把指向它的链接改掉。

被 ADR 正文或代码当**论据**引用的报告不进这里，进 [`docs/evidence/`](../evidence/README.md)——那层跟决策走，不跟批次走。

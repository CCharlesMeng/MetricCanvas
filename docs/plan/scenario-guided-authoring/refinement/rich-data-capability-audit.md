# 丰富数据评测：源码能力与边界审计

日期：2026-09-17。方法：仅核查本仓第一方源码、页面文档和 DQE 仿真 fixture；未调用外部模型、未修改实现。此文是评测前的能力审计，不是模型结果或视觉验收。领域用语以 [CONTEXT.md](../../../../CONTEXT.md) 为准。

## 结论

从基础 3 源扩大为 7 源，足以测试页面结构计划能否从规模／走势扩展到客户观察、风险跟踪、赛道及产业目标对照；但**仍不能测试受证实的因果归因或跨源贡献对账**。丰富数据不等于完整、可互算的经营数据，字段标签和金额单位相同也不证明口径相同。[原始 9 源页面](../../../../pages/flow-analysis-report.json)、[独立查询 fixture](../../../../tools/dqe-sim/fixtures/flow-analysis-report.json)、[结构装配边界](../../../../metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_structure.py)。

当前页面结构计划每页至多 6 个取数单元、每单元至多 6 个指标；因此“7 源可发现”应评价合理取舍，不得要求一页用完全部来源。赛道／产业各有 9 个度量字段，同样必须选取或另建取数单元，不能误判为数据缺失。[v2 Schema 的 dataRequests/metrics](../../../../metriccanvas-authoring/contracts/authored/page-structure-plan.schema.json)。

## 可支持的问题与限制

| 页面数据源 | 能支持的业务问题 | 不应外推的结论 |
| --- | --- | --- |
| `flow-kpis` | 整体、Core、云通信及其他范围的年累计、本月、同比、环比、年度推演、推演目标支撑率 | 年目标绝对值未给出，不能用支撑率倒推目标或目标差額；不同 scope 不能任意相加 |
| `overall-monthly-trend` | Core／云通信的历史实际与后续预测展示 | 预测不能写成已实现；不能与概况金额强行对账 |
| `region-monthly-trend` | 稳定／一次性流水的实际与预测走势 | 源 id 不能替代字段语义；不能宣称它精确解释整体增长或构成其贡献 |
| `customer-growth-top` | 名单内客户本月流水和环比的并列观察、重点跟踪 | 不是全量客户贡献；本月流水不是增长金额，环比排序不是增长贡献排序 |
| `customer-risk-top` | 名单内客户的三个已有金额口径对照 | 没有统一风险等级、概率、因果关系；不能把三个列任意展开为可靠连续时间序列 |
| `track-analysis` | 赛道内年目标与年推演的同列对照、当前流水／环比／近 6 月复合增长率展示 | `projection-growth` 不是目标差额；不可与产业或整体跨源求和／归因 |
| `industry-analysis` | 产业内年目标与年推演对照、产业经营观察 | 同上；产业与赛道不是已有可连接的互斥层级 |

字段名称、类型、角色和标签直接来自 [页面 dataSources](../../../../pages/flow-analysis-report.json)；行数、查询期间与数值形状直接来自 [fixture queries](../../../../tools/dqe-sim/fixtures/flow-analysis-report.json)。其中客户增长和风险各 10 行、赛道和产业各 5 行，只能描述已提供集合，不代表业务总体。

## 必须保留的语义边界

1. **目标差额不能偷换。** 赛道／产业 `projection-growth` 的正式标签是“较年初推演增长量”，不是“年推演减年目标”。fixture 恰好有数值相等的情形，也不能覆盖标签口径。可并列展示 `annual-target` 和 `annual-projection`；本轮无新增受控计算授权与实现，不可把二者差值伪装为既有指标。[赛道／产业结果字段契约](../../../../pages/flow-analysis-report.json)、[取数单元仅接受 metric 条目](../../../../metriccanvas-authoring/contracts/authored/page-structure-plan.schema.json)。
2. **金额同单位不保证可对账。** 概况、业务走势、结构走势的样例金额存在显著量级差异；客户名单也没有与总量的完整性映射。当前源码没有为这些来源建立贡献关系，不应产出“某客户／赛道解释整体增长 X%”。[fixture](../../../../tools/dqe-sim/fixtures/flow-analysis-report.json)、[元数据关系与可信关系边界](../../../../metriccanvas-authoring/tool/metriccanvas_authoring/application/metric_relations.py)。
3. **时间不是任意可选。** 概况、客户、赛道、产业固定为 2026-02；两类趋势的查询窗口为 2026-01 至 2026-12，1—2 月为实际值、3—12 月为预测值，另一组列为 null。采集时间是 2026-02-28，不是经营发生时间。`six-month-cagr` 是已有指标，不表示 fixture 提供了六个月明细。[fixture time/rowMonths/rows](../../../../tools/dqe-sim/fixtures/flow-analysis-report.json)。
4. **风险数据的时间列存在歧义。** 2 月快照中 `january-amount` 与 `previous-month-amount` 数值不同，不能未经解释就把“1 月”和“上月”当成同一期间，或把三列包装为按月时间序列。允许保留原标签并列展示，验收应将歧义作为数据限制，而不是让模型补全。[customer-risk-top](../../../../tools/dqe-sim/fixtures/flow-analysis-report.json)。
5. **富文本明细不是维度。** `growth-description`、`risk-type` 在原查询的 `output_dims` 中，但页面结果字段契约明确是 `type: semanticHtml, role: detail`。不能据原始输出槽位把它们投影为可分组、可筛选的字符串维度，更不能解析 HTML 编造风险分类或数值字段。本轮通用标量发现路径应排除它们，或在独立受支持的明细契约中原样处理。[页面字段契约](../../../../pages/flow-analysis-report.json)、[组件选择显式排除 detail](../../../../metriccanvas-authoring/tool/metriccanvas_authoring/domain/component_selection.py)、[受控语义 HTML 决策](../../../adr/0028-controlled-semantic-html-detail-fields.md)。
6. **主辅关系不能靠字段相似性猜。** 主辅组合卡需要可信 `evidenceRef`、匹配的主指标／变化字段／对象，变化字段必须是百分比数值；取数期间须由可信适配器确认。新增源即便含有金额及“环比”，也不能自动宣称已有可用关系。可以使用普通表格或无变化绑定的展示。[组合卡校验](../../../../metriccanvas-authoring/tool/metriccanvas_authoring/domain/section_presentation.py)、[可信关系入口](../../../../metriccanvas-authoring/tool/metriccanvas_authoring/application/metric_relations.py)。

## 外发与判分建议

- 模型只收到 Skill、工具 Schema、合成的 Schema 元数据、需求和安全结果摘要；原始业务行、HTML 明细及完整页面留在本地。现有 `model_view` 只允许指定摘要形状，此边界应纳入每次外发审计。[模型可见结果白名单](../../../../metriccanvas-authoring/test-harness/model-evals/run_trusted_local.py)。
- 客户名即使现有 fixture 已多为“客户A”等，也应经统一匿名化入口处理；不得假设未来样例永远没有真实名称。可对名称使用稳定匿名编号、删除原名枚举、过滤或替换明细中的名称，不以“这是 fixture”为外发真实名称的理由。[客户样例](../../../../tools/dqe-sim/fixtures/flow-analysis-report.json)。此项是本轮安全设计要求，不宣称旧适配器已实现。
- 丰富度应按不同业务问题、对象、可用证据的覆盖评价，而不是章节／组件越多越好。重复图表不加分；未使用全部 7 源不扣分；无证据却写因果贡献、目标差额、客户排名结论应判为语义失败。该判分方式依据上述数据能力边界，不是已观测的模型表现。
- 当前模型没有业务数据行可供分析，允许生成“用于观察什么”的结构与说明，不应验收为已经完成数值洞察或风险成因分析。实际 DeepSeek 对照只能证明在该受限发现面上能否合理组织页面，不能外推至真实经营分析正确率。

## 审计范围之外

未检验视觉效果；未运行本轮模型；未确认新增评测适配器最终投影及匿名化实现。主流程应在调用前对最终外发记录执行无原始行／无原客户名／无 detail 伪装维度检查，并在报告中分别列出模型缺陷、fixture 限制和执行失败。

# 丰富数据对照：两轮候选的独立语义审阅

日期：2026-09-17。只读审阅 `richness-basic/2` 与 `richness-rich/1` 的原始工具输入、工具摘要和最后接纳候选；未更改产物、代码或 Skill，未调用模型。结论只适用于这两轮，不代替全批统计或视觉验收。

## 先区分运行状态与候选质量

- **basic/2**：一次创建接纳候选，随后存在模型最终答复；原始结果仍是 `status: inconclusive`、`deterministicStatus: not-evaluated`，不是正式全链路通过。result（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/result.json`）、candidate（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/candidate-1-2-6.json`）、最后答复（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/response-1-3.json`）。
- **rich/1**：两次创建失败、第三次接纳候选；之后以 `TOKEN_BUDGET_EXHAUSTED` 终止，原始状态 `blocked`、`deterministicStatus: fail`。只能评价其“已接纳候选”，不能计作正常完成、一次成功或交付成功。result（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/result.json`）、candidate（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/candidate-1-4-12.json`）。

## 四类业务问题覆盖

| 问题 | basic/2 | rich/1 已接纳候选 |
| --- | --- | --- |
| 当前规模与变化 | 6 个 scope 的年累计＋同比、本月＋环比组合卡；对象绑定明确 | 4 个 scope 的同类组合卡；没有为新增来源强造主辅关系 |
| 增长来自哪些对象 | Core／云通信以及稳定／一次性走势；是对象观察，不是增长贡献量化 | 增长客户清单，列本月流水与环比；明确只代表入选清单、不代表全量或因果贡献 |
| 目标与当前／推演对照 | 只有整体年度推演与推演目标支撑率，缺少目标绝对值；属于受限覆盖 | 赛道年目标、年推演、流水及 2 月金额并列；未把 `projection-growth` 当目标差额，未计算达成率 |
| 风险复核 | 明确说明没有客户／风险能力，不编造名单 | 匿名客户清单及 1 月、上月、2 月金额并列；明确不能拼成连续序列或推断原因 |

依据为各轮工具原始 `request.plan.sections/dataRequests` 及页面候选正文与字段绑定：basic 输入与摘要（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/result.json`）、rich 输入与摘要（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/result.json`）。这说明丰富数据增加了实质问题覆盖，而不是单纯增加章节数量；basic 有 6 个业务章节、rich 只有 4 个，后者仍覆盖更多可用对象证据。

## 结构与语义判断

**没有发现按来源机械扩写的明显证据。** basic 将来源复用到概况及目标章节，图表负责走势、表格额外包含预测；两个走势章节形态相似，但对象和来源不同，并非同一数据重复换标题。rich 发现 7 个业务域后仅取 4 源，采用规模卡片、客户增长表、目标对照表、风险表；三张表形态相同，但回答的问题不同，因此不应仅按组件重复扣分。basic 原始计划（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/response-1-2.json`）、rich 最后计划（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/response-1-4.json`）。

**没有发现生成具体原因、贡献率或目标差额。** 两份候选的文字主要描述阅读目的和限制；rich 明确否认全量客户贡献和风险原因推断。basic “增长来自哪些对象”、rich “本月流水增长集中在哪些客户对象上”这些标题／问题仍偏强：数据只能支持走势或入选名单观察，不能证明贡献集中程度。候选正文已加限制，故记录为措辞风险，不判作已编造数值因果结论。basic candidate（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/candidate-1-2-6.json`）、rich candidate（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/candidate-1-4-12.json`）。

**目标与风险期间边界处理合理。** rich 只选 `annual-target/annual-projection/flow-amount/current-month-amount` 对照，没有请求 `projection-growth` 再误改其语义；风险只做表格，并明确 1 月与上月为独立样例列。basic 未补造不存在的客户维度或目标绝对值。对应候选同上（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/candidate-1-4-12.json`）。

**匿名化与字段角色在这两份产物中未见越界。** rich 的两个客户页面数据源均使用 `样例客户-01` 至 `样例客户-10`，未包含原客户名；字段契约中未出现 `growth-description/risk-type`，也没有将 semanticHtml 明细降格为维度。对两轮全部已保存 `request-*.json` 进行补充字符串检查，未出现 `客户A/客户B`、`growth-description/risk-type`、`initial`；rich 请求包含匿名枚举 `样例客户-01`。这只是针对已知标记的有限检查，不等同完整 DLP 认证，也不能以候选本地包含数据行推断它们已外发。rich 请求示例（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/request-1-2.json`）、rich candidate（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/candidate-1-4-12.json`）。

## rich/1 两次 STRUCTURE_PLAN_INVALID 的准确原因

用当前 authored v2 Schema 对保存下来的三次 `request.plan` 离线重新验证，确认：

1. 首次创建中 `/sections/1/blocks/1/purpose`（`growth-table`）和 `/sections/3/blocks/1/purpose`（`risk-table`）均为 `detail`。`purpose` 只允许 `primary-value/change/trend/distribution/reconciliation/explanation`；`detail` 不是合法枚举。两个块的 `intent: detail` 本身合法。首次输入（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/response-1-2.json`）、[Schema](../../../../metriccanvas-authoring/contracts/authored/page-structure-plan.schema.json)。
2. 第二次创建删除了这两个块的 `intent`，但保留 `purpose: detail`，所以仍在同样路径失败。失败不是字段数量、多个分组维度、客户字段名称或缺少 `intent`。第二次输入与模型解释（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/response-1-3.json`）。
3. 第三次将两者改为 `purpose: reconciliation`，恢复 `intent: detail`，Schema 无错误并接纳候选，查询执行 4 次。第三次输入（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/response-1-4.json`）、接纳摘要（原始记录已清理：`./evidence/richness-eval-run1/richness-rich/1/program-tool-1-4-12.json`）。

因此真实暴露的不足是**purpose/intent 枚举混淆，以及错误摘要只给块路径、未给违规属性／允许枚举导致试错**。模型最终自行修正成功，但额外两次完整创建消耗预算；不能将第三次的成功抹平为首轮工具可靠性通过。该诊断是本次审阅结果，不包含任何修复。

## 附带沟通偏差

basic 最后答复称“13 个操作全部 applied”，实际创建摘要有 14 个 operation；答复还说“未用完所有来源”，但实际已取全部 3 个来源，只是没有单独展示 `projection` scope。候选本身不受此影响，但最终文字不能作为精确计数证据，应以原始工具摘要为准。最后答复（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/response-1-3.json`）、result（原始记录已清理：`./evidence/richness-eval-run1/richness-basic/2/result.json`）。

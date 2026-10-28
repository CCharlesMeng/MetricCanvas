# 逐元素指标匹配与查询条件

输入页面为 Dashboard，原有 inline 合成数据保留。指标说明已全文阅读；未运行查询、未生成可执行查询、未修改页面。`matched` 仅表示指标语义对应，不代表计算口径完整或服务可用。

| 页面元素 / 位置 | 源 / 字段 | 匹配结果 | 指标与查询身份 | 可核对依据、条件与缺口 |
|---|---|---|---|---|
| 签约概况 → 签约金额；`/sections/0/components/0/props/rows/0/valueField` | business-summary / amount | ambiguous | 当期 `contract_amount` 或累计 `contract_amount_ytd` | MD 5–10、14–17；均为 CNY 元。当期按签约月份、组织/月可加；累计为年初至所选月，跨月不可重复求和。须先确认当期/累计、时间与区域范围。 |
| 目标进度 → 达成率；`/sections/0/components/1/props/rows/0/valueField` | business-summary / rate | matched，查询待补 | 达成率；DQE 标识缺失 | MD 21–24；物理字段 `ads_contract.achievement_percent` 不能当 DQE 指标。刻度 0..100，42 配合 percent-1 为 42.0%，不用乘100。缺目标金额/分子口径、零分母规则和查询身份，不可平均已有比率。 |
| 口径核对明细 → 区域列；`/sections/0/components/2/props/columns/0/field` | business-summary / region | matched，过滤值待补 | 区域；维度候选 `region_name` | MD 28–29；将来须显式映射 region → region_name；区域代码/显示名映射未知，不能把合成行“华东示范区”写成过滤条件。 |
| 口径核对明细 → 签约金额列；`/sections/0/components/2/props/columns/1/field` | business-summary / amount | ambiguous | 同签约金额卡片 | 共用同一字段，故口径选择统一影响两处；不是两个独立指标。金额格式 compact-wan-1 仅缩放展示，不把元指标改成万元指标。 |
| 口径核对明细 → 达成率列；`/sections/0/components/2/props/columns/2/field` | business-summary / rate | matched，查询待补 | 同达成率卡片 | 共用同一字段；同样禁止平均已有比率。未提供达成率可用区域维度及跨区域汇总依据。 |

三处数据槽 `/sections/0/components/0/data/main`、`/sections/0/components/1/data/main`、`/sections/0/components/2/data/main` 均引用 business-summary；这三处是共享源关系，不是额外指标，结构化报告保留了全部位置。

## 已知查询条件与尚未确定的条件

- **页面事实**：原源为 inline；无筛选器、参数或查询绑定；未显式配置排序；表格 pagination.mode=none。合成一行不证明真实数据的行数、范围或完整性。
- **指标说明事实**：当期签约金额口径为统计期内已签约且未撤销合同、按合同编号去重；时间维度为签约月份，查询维度 region_name。累计签约金额为当年年初至所选月，按组织可加、跨月不可再次求和。这些是指标定义，不能推断请求必须另写哪些物理谓词。
- **建议、待确认**：明细可按 region_name 分组；卡片是否展示全域汇总或指定区域需确认。当前共享源一行仅为演示，不能推断未来逐区域多行可直接供卡片消费；也不能无连接键/基数证据自行拼接金额和比率。
- **未知**：期间、截止月、时间粒度、组织/区域范围、区域编码、达成率计算口径与 DQE 身份、其可用维度、真实返回字段及完整性要求。

## 按优先顺序补充的信息

1. **G-time / G-scope**：全页统计期间、截止月、粒度和组织/区域范围；提供区域代码与显示名映射。不要默认今天、当前月或示范区域。
2. **G-grain**：卡片和明细各自的行粒度；卡片是汇总还是指定行，达成率能否按区域查询，是否可与金额同粒度共享源。
3. **G-amount-mode**：当期还是年累计；这同时影响金额卡片和表格金额列。
4. **G-rate-contract**：目标金额/分子口径、零分母规则、DQE 查询标识、时间与维度约束。
5. **G-query-context**：可信查询数据上下文及未来执行入口。当前没有环境，因此不补 initial、不伪造请求/响应或真实取数成功证据。

## 交付和验证边界

`page-data-analysis.json` 保留输入哈希、5 个字段用数位置、3 个数据槽、原文行号证据和按共同原因合并的缺口。[query-candidates.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/local-authoring-context/forward/query-candidates.json) 仅记录条件清单，runnableCandidates 为空，execution=not-run。条件缺失时不运行 prepare，也不生成 proposals。

实际结构与引用检查结果见 `check-receipt.json`。本任务未生成或修改页面，不需要对新页面进行快照或完整页面校验；未执行浏览器预览或服务查询。原输入字节保持情况见 `input-integrity.json`。

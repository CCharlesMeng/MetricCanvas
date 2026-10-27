# 业务临时页面

| 页面 | 入口 | 数据与验收边界 |
|---|---|---|
| 成熟度得分 | /pages/contract-maturity-score | 四种期间同步切换KPI与列组；inline合成得分，日期重查待接入 |
| 伙伴健康度 | /pages/partner-health | 保留动态主行集和新增辅助查询；真实新增指标及失败影响仍待服务验真，见partner-health-data-analysis.md |
| 治理合规 | /pages/governance-compliance | 多图区域筛选保持独立filterId；输入查询与真实DQE映射仍待验 |

启动 `pnpm dev:playground`；各子目录README与数据分析说明保留操作和数据性质。页面通过结构校验不等于真实取数。报表实验和未完视觉原型另见本批保留清单，不复制进正式能力目录。

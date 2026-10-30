# 业务临时页面

| 页面 | 入口 | 数据与验收边界 |
|---|---|---|
| 成熟度得分 | /pages/contract-maturity-score | 四种期间同步切换KPI与列组；inline合成得分，日期重查待接入 |
| 伙伴健康度 | /pages/partner-health | 6.77页面；组织与顶部中国区/海外分别取键并集、关联单项并计算分类与总分；全部inline行为空；指标与对象查询均使用共享DQE网关，按运行配置发送execute请求，不再使用页面专属模拟网关。真实业务返回待验，见partner-health-data-analysis.md |
| 治理合规 | /pages/governance-compliance | 多图区域筛选保持独立filterId；输入查询与真实DQE映射仍待验 |

启动 `pnpm dev:playground`；各子目录README与数据分析说明保留操作和数据性质。页面通过结构校验不等于真实取数。报表实验和未完视觉原型另见本批保留清单，不复制进正式能力目录。

## 伙伴健康度DQE查询

主项目运行 `pnpm --filter playground dev --port 5193 --strictPort` 后访问 `/pages/partner-health`。独立页面和场景预览均使用共享DQE网关，按运行配置向 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute` 发送请求；不再接管为前端合成响应。连接真实业务服务需要对应端点、网络和有效凭据，Windows gray配置见[页面试验场说明](../../apps/playground/README.md#windows-本地连接-gray-cloudioc)。本机默认开发代理仍指向DQE Sim，不能作为真实业务验收。

合作意愿、客户评价、经营贡献、扣分使用object查询，其余得分使用指标查询，统一经DQE网关归一化并按region行键对齐。返回行数和值由服务决定；空结果保持空态，服务拒绝或传输失败不回填模拟行。两表总分仍引用空的pending槽，显示“—”。此前4个地区部、8个代表处及相应分数均为历史模拟验收结果，不作为当前预期。

2026-10-29已清空所有13个inline源的数据行，共删除18行静态示例，保留字段声明、组件及引用，概览、对比图和未接数明细显示空态。已有24个query源未变。中国区/海外各查询case当前相同且未下推站点条件，不能据此声称得分查询已区分站点。默认level=地区部在明细查询中绑定组织名称字段，其实际业务语义尚待确认。历史81.3/70.8计算验收对应被替换版本，不能作为当前页面结论。

合成数据夹具已移至 `tests/fixtures/partner-health/`，只供自动化测试，页面入口不再引用。历史替换及故障证据见[修复记录](../../docs/evidence/partner-health-pasted-repair-20261028/README.md)；[历史预览验收](../../docs/evidence/partner-health-preview-20261028/README.md)对应旧页面。

同步main后的复验见[HTTP查询与.length异常验收](../../docs/evidence/partner-health-real-dqe-20261029/README.md)：已复现旧模拟器读取对象查询output_metrics.length的异常并移除其生产入口；全部28个查询分支、完整页面执行、空结果和传输失败均有回归。当前本机服务仍为DQE Sim，拒答不代表真实业务DQE验真。

正式伙伴健康度已移植 probe 的顶部11项整体查询与计算声明，5张卡片缺项显示 `--`，总分对缺项按0相加。保留正式 id `partner-health`，不会命中 probe 专属网关。顶部查询使用 `国内或海外` 同时取国内、海外两组记录，每范围应为唯一整体记录；该数据契约尚待内网验真，页面不会把组织明细相加或注入合成行来替代。

下方地区部/代表处查询不消费顶部中国区/海外。全球显示范围按钮及图表两个页签；选择区域树中的具体地区部或代表处后隐藏范围按钮，卡片复用对应组织计算结果，图表只保留代表处；表格两个页签一直展示。组织条件通过levelQueryFields按地区部/代表处下推，空选择恢复全球。分类缺项保留null、真实0保留，总分按0处理缺项。顶部11项整体查询同时获取国内/海外，按钮切换复用结果，不触发下方重查。真实组织候选、字段、整体粒度仍待内网验证。

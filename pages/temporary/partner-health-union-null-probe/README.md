# 伙伴健康度并集与缺项 Mock

独立验收页，数据为合成查询响应，通过实际 DQE 归一化和统一运行时计算，不是预先算好的15行快照。正式 `/pages/partner-health` 使用真实 DQE，没有重新接入模拟网关。

运行 `pnpm dev:playground --host 127.0.0.1 --port 5173`，访问 [Mock 页](http://localhost:5173/pages/partner-health-union-null-probe)。

页面与正式页复用11项查询及组织并集/分类/总分声明。图表与表格均取同一计算结果；区域、代表处分别展示15个组织。ORG-01的声音闭环得分是真实0；ORG-03单项缺失显示 `--`、总分0；ORG-04的客户评价空字符串显示 `--`，总分7；ORG-06为8+(-2)=6；ORG-15只在第三组返回，总分10。固定合成响应不证明真实数据库的期间/权限/筛选结果。

顶部保留正式页“中国区 / 海外”控件与5张卡片的布局，新增11条独立整体查询候选。整体分数是人为构造的每范围唯一记录，与下方ORG组织行没有汇总关系。默认中国区显示总分35、感知20、满意度`--`、能力与贡献17、风险-2；点击海外显示30、4、15、14、-3。缺失分类保留`--`，总分对缺失按0处理。`?state=overviewMissing`验证全部单项缺失时4张分类卡`--`、总分0；`?state=overviewZero`验证5张卡均为真实0。两种状态只改变顶部，表格仍为15行。

顶部的`data_site_type`输出/筛选及对象源每范围唯一整体记录是待真实DQE确认的契约。没有通过删除地区部字段来假设对象查询会自动聚合；正式页`health-overview`仍未替换成未验真的查询。完整候选、可执行请求JSON及截图见[顶部整体Mock验收](../../../docs/evidence/partner-health-union-null-20261029/overview/README.md)。

通过 URL 参数 `state` 验收：默认 `ready`；`?state=emptyMain` 声音闭环查询空但仍显示14行；`?state=empty` 全部为空，图表/表格为空；`?state=error` 合成失败、`?state=truncated` 已知计数不完整、`?state=duplicate` 来源组织重复，均不产出部分总分；内部快照与诊断保留错误分类，当前统一呈现策略将错误显示为空数据。非法声明、键类型、字段省略及迟到响应等由行为测试补充。切换图表与表格的区域/代表处页签验证两种粒度；表格本地分页/导出复用计算结果。

原始 Mock、可运行诊断脚本、日志和截图见 [诊断报告](../../../docs/evidence/partner-health-union-null-20261029/README.md)，后续修改见 [整改方案](../../../docs/plan/2026-10-29-partner-health-union-and-missing-scores.md)。

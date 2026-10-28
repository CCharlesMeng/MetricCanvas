# 用户原始商务驳回明细：模拟完整运行

2026-10-28。复用修复工作树 `/Users/moon/.codex/worktrees/object-record-sort-fix/DataDashboard`；Playground5186，专用DQE Sim18230，未修改共享18228服务。

## 元数据与数据环境

`pages/business-rejection-details.json` 与用户附件逐字节一致，SHA256为 `fc58498e482c54f31f5787bf3981d2ab7c8010956dce95f9b9a630ba588b4d2c`。未改查询、字段映射、绑定、表格列或写入initial。入口 `/pages/business-rejection-details`；原始元数据经正式SourceProgram、DQE编码器、HTTP服务、响应归一化、记录关联与统一运行时渲染。

新增仿真分支仅识别该object类型和商务基本信息的精确输出字段组合。模拟行均带SIM编码及“模拟”文字；候选值使用既有区域闭集。审批表为2026年9月1205条、10月8条，同一商务通常有初审与复审两条；补表按商务ID提供当前责任人和生命状态。SIM-00000无补表匹配。物理字段、HCS排除、权限、真实计数及跨批稳定性均不由模拟证明。

## 浏览器观察与导出

| 操作 | 结果 |
| --- | --- |
| 默认九月 | 总1205条，每页10条；审批时间降序；责任人和生命状态成功补入 |
| 下一页 | 序号11—20，商务编码变化，无前页记录身份重叠 |
| 搜索SIM-BIZ-00001 | 两条审批，初审与复审均保留，责任人模拟李四，状态已关闭 |
| 搜索SIM-BIZ-00000 | 两条审批仍保留，责任人和状态显示“—” |
| 生命状态筛选已关闭 | 全局402条 |
| 已关闭再叠加复审 | 全局201条 |
| 地区部选择华北 | 302条，显示模拟北京代表处 |
| 清空区域，审批期间十月 | 8条，补列仍匹配 |
| 第二页点击导出 | 实际下载business-rejection-all.xlsx，1205数据行、11列，末尾序号1205 |
| 已关闭状态下点击导出 | 实际下载business-rejection-closed.xlsx，402数据行、11列，全部状态已关闭，末尾序号402 |

截图 `full-page.png` 与 `joined-two-approvals.png`；后者完整展示11列和同一商务的两条审批。表格列为原配置的序号、地区部、代表处、商务编码、商务责任人、商务审批通过时间、生命状态、审批结果、审批意见、评审组织人、审批阶段。两份xlsx均为浏览器点击产品导出按钮下载，再用只读Excel解析检查，非另行拼装。

`receipt.json` 保存原文摘要与Excel行列/状态/缺值统计；`http-summary.json` 保存真实本地HTTP请求摘要。默认主表按商务ID单字段升序分3批读取，offset0/500/1000；随后按去重商务ID分批补列。页面的降序排序在完整关联之后执行。

十一月空态另由实际HTTP集成测试验证：SourceProgram返回empty/totalCount0。浏览器手工输入未来月份未提交到URL，保留原十月条件，因此未将该次手工操作记为十一月浏览器验收成功。

## 自动检查

- 新增Sim签名/错误边界3项，以及从原页面经HTTP到Excel的完整集成4项；与审批期间回归一起17项通过。
- 区域层级补验使用实际HTTP：全球层级中国905条、华北地区部302条、上海代表处302条，原始三项levelQueryFields均生效，见region-levels-tests.log。
- 执行与运行时UI相关回归：67文件431项通过，见regression.log。
- engine Svelte与TypeScript检查0错误0警告；DQE Sim源码与测试类型检查通过。
- 120页面全部通过校验。
- local-authoring及参考文档5文件188项通过；MC导出、来源覆盖、32项测试、诊断夹具检查均通过。
- 扩展运行全部DQE Sim测试时，既有query-result-where窗口测试失败。临时移除本批处理器并恢复旧分发顺序后同样失败（见baseline-unrelated-failure.log）；本批未修复该独立问题。与本页面相关的检查均已通过。

## 复杂度

metriccanvas-ts-ast/1、TypeScript5.9.3，逐函数含回调测量：executeLocalDemo自身CC3→3；新增executeRejectionDetails12、matches14、windowResult10、outputFields5、isBasicQuery6，其余新增函数及测试回调均≤15。扩展的审批期间测试保持metric/object两种独立变体，回调CC8→9。

同文件未改动的存量超限函数：executeExactScenarios19、executeFlowAnalysisReport39、executeIocOpportunityList18、executeInspectionDetail17、executeCustomerActivityRisk16、executeSalesAnalytics22。数值与基线一致，本批未扩大重构范围。原文见complexity-before.json与complexity-after.json。

所有数据为合成数据，真实DQE/Relay未验收。以上为原始基线验收；最新main交付复验与元数据合并差异见[交付记录](../delivery.md)。

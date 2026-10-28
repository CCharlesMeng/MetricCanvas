# main交付复验

2026-10-28。从原始实现基线9ee7e6ac611e5651046dde16f9b5fc44dc0974b1同步到origin/main 750d0aa365ead78bc29de0e53b99f03c3ac7762e。

交付范围为object记录关联排序修复、对应回归、原商务页面的object查询、独立模拟处理器及页面场景、产品文档和生成的协议/MC/local-authoring产物。保留main的区域selection.mode=single声明；除这一项外，当前页面与用户原文按JSON结构完全一致。原文逐字节验收属于此前基线记录，不能套用于本次合并后文件。

Skill版本由最新main的1.5.1顺延为1.5.2。哈希、知识包及诊断夹具均由合并后真源重新生成。仅暂存本任务路径，主工作区的并行改动保持原样。

复验：执行器、运行时UI及全部DQE Sim共86文件538项通过；engine检查0错误0警告，Sim类型检查通过，127页面全部校验通过；local-authoring与产品参考5文件189项通过，MC导出、来源覆盖、33项测试及诊断夹具检查通过。main已修复原基线query-result-where月份格式失败，该项在本次538项中通过。

空态用2026年8月验证。原11月预期在最新基线被当前期间合法性校验拒绝，因此修正测试输入，不放宽运行时约束；测试显式冻结当前日期2026-10-28。浏览器复验默认1205条与树内选择华北地区部302条，责任人、生命状态及审批记录保持，见simulation/main-region-tree.png。完整关联、全局排序、分页、1205/402条Excel导出继续由真实本地HTTP集成覆盖。

复杂度使用metriccanvas-ts-ast/1、TypeScript5.9.3，记录于delivery-complexity.json：recordReadOrder4→3、executeLocalDemo3→3，全部新增函数及回调自身CC≤15。execute.ts未修改的6个存量超限函数与基线一致，详见模拟验收记录。本次无新增未关闭超限。

所有业务数据为模拟数据，真实DQE/Relay未验证。此记录在push前写入，远端提交及精确SHA的CI结论以最终交付回执为准。工作树保留用于已展示给用户的5186预览，专用Sim18230继续运行；无临时远端分支。

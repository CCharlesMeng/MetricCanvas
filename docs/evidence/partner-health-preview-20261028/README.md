> 原始运行附件留在主项目 `.scratch/partner-health-delivery-20261028/evidence/` 对应目录，未纳入版本管理。

> 本文保留本地主项目的开发期记录（Schema6.70、基线9ee7e6ac6）；最终 main 交付基于更新基线、Schema6.71，结果以 [交付复验](../partner-health-delivery-20261028/README.md) 为准。

# 伙伴健康度完整页面模拟验收

主项目main工作区，入口http://localhost:5193/pages/partner-health。黄色提示标明模拟性质。仅稳定页面ID partner-health在页面试验场注入专属模拟网关，其他页面、平台与页面JSON查询声明不变。JSON SHA256仍为21eac322244dd63f09bd56549db205e36904fd42aa447108ca3f126f901a7166，无source.initial。

模拟网关返回原始DQE字段，经真实DQE归一化、页面compute与统一运行时渲染；顶部中国区/海外、地区部与代表处切分、共享具体组织筛选、日期、部分缺项与全部缺项均可直接验收。预设各组织粒度分数仅用于演示，不代表真实后端跨组织聚合规则。声音与服务能力动态明细也提供模拟行，其他inline明细沿用原示例。

18项计算及预览测试通过；Playground svelte-check为0错误0警告，测试类型检查通过。浏览器5项自动断言与1项原生IAB日期交互通过，见browser.json和截图。初次自动日期脚本因月份按钮显示“9 月”而非“9月”停止，日期行为已在IAB点选2026-09核实，并恢复默认2026-10；没有把脚本定位失败当成产品失败。

复杂度工具metriccanvas-ts-ast/1、TypeScript5.9.3、逐函数selfCC含回调。pageExternalInputs 11→12，scenarioEnvironment 8→9，页面loadPage 13→13（抽出Svelte的TypeScript script同口径测量），新适配器/数据/测试函数及回调最大CC8。未关闭超限项0。仅加预览数据夹具，不新增产品协议或运行时能力；本轮无Schema/Skill语义变更。

生成内容仅同步页面README造成的MC构建来源摘要；真实DQE、Relay、生产发布和CI未执行。所有改动未提交。

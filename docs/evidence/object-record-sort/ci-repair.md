# 首轮CI回归修复

首轮提交c995f2ce1269cbad9910b2079b795006e4f6669f的[CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40627508309)中，types/build/authoring均通过；tests为3346通过、5跳过、4失败。

三个确定失败均来自metric-field-time.test.ts读取业务页面后默认其为指标查询。业务页面恢复用户object查询后，该测试实际进入object校验路径，缺字段诊断文本不同，且object允许datetime精度。修复测试load显式构造指标查询，继续保留8项原指标语义断言，不改变产品校验器或object支持范围。

另一个失败为local-authoring-tools.test.ts的仓外多组件CLI扫描测试超过5秒；未修改该测试或放宽超时。与修复后的指标测试独立复跑40项全通过；页面契约及审批HTTP回归的扩大复验见ci-repair-regression.log。

复杂度metriccanvas-ts-ast/1、TypeScript5.9.3，load自身CC1→1，其余函数及回调未改；测试保持原文件8项断言及输入不变性覆盖。

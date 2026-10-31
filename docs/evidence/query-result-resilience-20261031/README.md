# 查询结果容错与数据源诊断验收（2026-10-31）

交付基线：`cb35a7beea86d6602bc80f1618a460009bde966b`（当时最新 origin/main），保留其协议6.77、周期对比、表格子会话及其他已交付能力。独立工作树从真源重新生成分发，local-authoring 从1.14.9升级为1.14.10；未复制旧工作区的生成物。

## 结果与边界

- 查询顶层 number/money 度量的响应属性未返回：字段保留，值为null，单元格按missingText显示，默认—；整列漏返也保留列，不补零，不删除查询指标。
- 原有null、异常值容错保持；属性未返回另以MISSING_NUMERIC_QUERY_FIELD按字段计数，不输出业务值。缺少维度/行键、明细映射属性、非对象行与inline仍严格。
- 页面结构接受规则不变。数据源结构错误按source.type从产品Schema派生分支诊断；单逻辑查询dsl_list必须一项，错误给出实际条数与拆分建议；未知类型定位source.type。没有增加第二份手写协议表。

## 场景与浏览器

| 能力 | Playground入口 | 元数据文档 | Skill同步 |
| --- | --- | --- | --- |
| 漏返指标保留列 | /pages/query-missing-measures | fields.md 查询数值度量的容错 | 同源例子、语义、独立校验器与清单 |
| 精确分支诊断 | /pages/data-source-diagnostics | validation.md 页面数据源分支诊断 | 同源语义及独立校验器 |

交付工作树实际启动于http://127.0.0.1:5185：缺失指标页三行分别为—/0.0/-4.0，金额整列—；截图missing-measures.png。诊断页在/preview复制唯一查询项后只有一条dsl_list条数错误（当前2条），见diagnostic.png。恢复合法输入后正常渲染。

原用户JSON与捕获的Java响应仅在本机回放，完整29行、174个投影数值保留；浏览器原表首屏20行、120个数值，总数29。两个年度基础指标各漏返29行，告警保留；原查询、字段与表格列不删。原始请求、响应、真实数据截图不随代码提交。

## 工程验证

- pnpm test packages/page/tests packages/data-execution/tests：139文件、1430项通过；新增缺属性、整列缺失、输入不变、初始/动态一致、保存重开、计算及维度/结构边界。
- pnpm validate：152页面全部通过。
- page及tests TypeScript检查通过。
- pnpm authoring:check、authoring:contracts:check 与mc:content:check 按交付工作树运行；最终结果由交付记录与远端该提交CI核实。
- 分发从交付工作树生成，独立安装检查由local-authoring回归覆盖。用户未要求真实DS模型专项验收。

本地合成场景、捕获响应回放、远端CI和真实服务分别成立；此次没有再次请求真实Java/Relay，没有执行部署。

## 复杂度

口径metriccanvas-ts-ast/1、TypeScript5.9.3，逐函数selfCC，闭包单独测量，完整数据见complexity-before.json和complexity-after.json。

| 函数 | 前 | 后 |
| --- | --- | --- |
| normalizeQueryRows | 4 | 4 |
| 逐行映射回调 | 8 | 9 |
| parsePage | 31 | 31 |
| toTypedError | 7 | 12 |
| buildProductOutputs | 15 | 15 |

新增分支诊断各辅助函数selfCC为1至8，所有新增测试回调均不超15。存量parsePage超限保持31：本次只接入独立诊断模块，避免扩大解析生命周期重构；后续入口packages/page/src/validate.ts。扫描另见未改buildSkillProjections保持52，仍属存量项，不计为本次关闭。


## CI 回归补齐

首次提交的全仓CI发现六处历史断言仍把数值属性省略视为整批失败。补充测试覆盖对象查询、伙伴健康度、零总数回执及执行回执：数值漏返保留null与告警，维度漏返仍报映射错误。错误分类和敏感哨兵断言改为明确的维度漏返输入，不降低原有诊断隐私检查。

六个受影响测试文件79项通过。完整local-authoring回归首轮227项通过，唯一失败是scripts/analyze-data.mjs漂移检查在并发构建时达到90秒；相同用例独立重跑33.95秒通过，没有修改超时或降低断言。分轮结果分别保留，不能声称首次完整运行全绿。

本轮只调整测试及此记录，不改变产品源码、Schema、已生成Skill或MC内容。逐函数selfCC重新测量，六个测试文件的全部函数均不超过15，修改回调无分支增长；新增零总数漏返用例回调selfCC=1。


补充测量仍使用metriccanvas-ts-ast/1、TypeScript5.9.3；下表为各文件逐函数selfCC最大值（前/后），所有闭包均在扫描范围：

| 文件 | 前 | 后 |
| --- | --- | --- |
| partner-health-object-preview.test.ts | 1 | 1 |
| partner-health-union.test.ts | 5 | 5 |
| zero-total-rendering.test.ts | 2 | 2 |
| data-gateway/diagnostics.test.ts | 2 | 2 |
| data-gateway/query-error-classification.test.ts | 2 | 2 |
| runtime/execution.test.ts | 7 | 7 |

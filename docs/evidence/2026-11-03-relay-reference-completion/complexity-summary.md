# 本批复杂度口径与结果

TypeScript/JavaScript 使用 metriccanvas-ts-ast/1 与 TypeScript 5.9.3，逐函数自身 CC，包含新增闭包/回调；Python 使用固定 Radon 6.0.1 门禁及各线逐函数扫描。不能以总分或命令退出码替代逐函数结果。

- A：370 函数/回调，全部 ≤15；checkAnalysis 旧匿名19→6，职责 helper8/7；visitSchema13→14，分析/换源入口各6。源清单53项与 SHA 见 A v2；正式渲染隔离测试沿用。
- B：原25源、共享字段解析器6→6；修改/新增函数全部≤15。另4文件运行时列身份修复含Svelte脚本及回调已实测≤15。未改 validate_plan 24 属原存量，不在本批代码修改范围。
- C：233 Python 函数/lambda，最大12；CI测试回调最大3。配置与README/测试delta不改变产品算法。
- 主控：buildAuthoringOutputs7→7，buildInputSources6→6；新浏览器函数/回调均≤15。buildSkillProjections52→52 为未关闭存量：此次仅扩展固定生成入口列表、跳过生成文件的同类名单，未增加执行分支；为保留当前Skill注册/投影顺序，本批未扩大为整套注册器重构。后续入口为 tools/scripts/export-authoring-contracts.ts:buildSkillProjections，原值与最终值均附JSON。

固定Python清单门禁仍使用原限制，未放宽。所有行为证据须按最终checkout另列，迁移源码不算复杂度降低。

全仓验收中仅一项旧语言租约测试的固定等待替换为真实callback/调用状态等待，原前后断言保留；两新增vi.waitFor闭包自身CC1。A历史Schema输入测试补充currentSchema身份及完整语义对照，55测试函数最大CC13，旧预期值未改变。公开面快照登记如无执行分支，不虚构函数测量。

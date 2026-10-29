# main 交付复验

2026-10-29，按用户要求提交并推送 main，提交带 [skip ci]；CI 按要求跳过，不记为通过。

先重放到 15672c4e321f85da4a376fe57d2c62ba9efa82fd；推送遇到并行更新后，再重放到 origin/main 96e7166b7，保留其组织并集、记录批次超时和表格修复。Schema 6.75；local-authoring 从 main 的 1.11.4 更新为 1.12.0。Playground 网关分派合并双方能力，恢复 main 的超时参数和目录模式行为。

新增 main 页面 table-data-recovery 仍使用旧式 IOC Region，现补迁到 Header 的单个结构树，并在其合成网关提供完整候选。未修改表格恢复算法或预期行数。

复验：全包 pnpm check 通过；Playground 修改后再次 check 通过；141/141 页面通过。195 文件首次回归中，193 文件/1753 测试通过，两个存量页面遍历用例因新到达的旧式 Region 失败；迁移后相关 5 文件/54 测试通过。嵌入构建与 11/11 浏览器场景通过。官方产物1307 product/4 authoring/1 interface，MC 内容33测试通过；仓外安装的两页合法声明通过，三种非法 Region 声明拒绝。table-data-recovery 的实际浏览器全流程（异常结果、分页、Excel、恢复与窄屏）也通过。

复杂度复测见 delivery-complexity.json，口径 metriccanvas-ts-ast/1、TypeScript 5.9.3：合并后的 pageExternalInputs=8、scenarioEnvironment=15、previewDataGateway=15、loadPage=7；新候选方法不超过15。原实施快照保留原基线，不将新基线测量覆盖旧证据。

主工作区的并行修改保持，任务工作树在远端 SHA 确认后归档；CI、真实服务与部署均不作通过声明。

最终基线复验：102文件/1082测试、142页面、全包类型检查、嵌入11浏览器场景通过；保留并验证新 main 的 full-query-candidates 目录与网关分派。CI 按用户要求跳过。

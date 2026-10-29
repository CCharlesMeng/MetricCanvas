# 分页合并源行契约错误定位（2026-10-29）

本批后续已将首段改成人能读懂的原因和处理建议，最终文案与验证见 [可读错误说明](readable-message.md)。下文保留首次定位信息增强的过程证据。

目标：来源内重复行键不再仅提示刷新；直接指出合并源、成员、来源页面数据源、行键字段及 queryField、配置 JSON Pointer、首次与当前来源行号、当前 offset。批内重复与跨批重复（可能分页重叠）分别报告；空行键与来源排序错误同样定位来源；原始/最终结果字段契约失败也报告具体来源行、字段和违规原因。行号从1开始，offset从0开始，不写出实际行键值或业务行。

## 实现与知识映射

- `packages/data-execution/src/paged-union/execute.ts`：Map保留首次来源行号，检查点复制该Map；错误码仍为DQE_ROW_CONTRACT_ERROR，归并、分页与取消语义不变。
- `packages/data-execution/src/paged-union/plan.ts`：统一生成包含元数据定位信息的错误消息；缺失/类型错误行键定位到来源行。
- 产品知识：`PAGE-METADATA.md`、`docs/page-metadata/data-sources.md`。
- 观察场景：复用`pages/capabilities/table/multi-source-table.json`，README记录参数与预期；合成响应通过试验场专用网关注入故障。
- local-authoring 1.7.3：经官方导出器同步知识、哈希与分发锁；未改变页面Schema。

## 回归与证据边界

- 修改前最初新增的4项测试均因缺少具体来源/行号而失败；另补类型错误预投影路径回归后，3个相关测试文件31项通过，覆盖正常归并、跨批读取、检查点、取消与DQE排序编码。
- 用户附件：四段响应拼接，仅按声明queryField映射后回放正式SourceProgram，准确定位commercial-app-norm的来源第7、18行。原文及业务数据不入仓；脱值结果见attachment-replay.log。此回放没有访问真实DQE。
- 浏览器：独立工作树，`pnpm --filter playground dev --host 127.0.0.1 --port 5197 --strictPort`。
  - `/pages/multi-source-table?rowFailure=duplicate`：页面整表失败，控制台出现opinions/commercial、行键及queryField、配置路径、来源第1/2行、offset=0。
  - `?rowFailure=missing-key`：控制台定位来源第2行空行键。
  - `?rowFailure=order`：控制台定位来源第1/2行及decisionCount desc规则。
  - 清除参数：256行、首三行130/120/100、13页恢复。
- 页面错误文案仍按页面声明展示；具体定位信息进入查询错误消息和控制台。
- 数据执行包、Playground及工具/测试TypeScript检查通过。`authoring:contracts:check`通过；`mc:content:check`通过（33项Python测试、完整来源覆盖和诊断夹具一致）；local-authoring及参考文档42项通过。另将完整Skill复制到仓外，以独立Node脚本验证合法页退出0、非法行键引用退出1；完整回执在同目录。全量`authoring:check`曾启动，后按仓库默认只验收local-authoring的范围停止，未宣称整套历史Bundle/其他Skill隔离用例通过。
- 真实DQE/Relay稳定分页及部署验收未运行；本次仅增强诊断，不修正附件的行键配置或上游数据。

## 复杂度

使用metriccanvas-ts-ast/1、TypeScript5.9.3、selfCC，完整函数及回调见complexity.json。

|相关函数|修改前|修改后|
|---|---:|---:|
|validateRowOrder|5|6|
|refill|10|10|
|cloneProgress|1|1|
|open及其成员回调|2/1|2/1|
|projectedRows及3个回调|3/1/1/1|3/1/1/1|
|unionRow及投影回调|8/2|8/2|
|unionMemberError及路径回调|新增|2/1|
|createUnionPreview.fetchData|3|3|
|injectRowFailure|新增|6|
|contractIssueMessage|新增|3|
|新增测试辅助函数/全部回调|新增|1至4|

Svelte仅修改既有函数调用的参数；提取script按同一工具测得前后7个函数selfCC均为2/4/1/3/1/3/13。扫描的存量及新增函数均无超过15的项，无未关闭复杂度项。

本地日志与JSON的归档位置、基线和交付范围见 [交付记录](delivery.md)。

# #139 / T13 S1 有序自动保存回执

基线：M0 READY `e65b012c0a93d5c9a1ac9c0e51e320133e97a0f1`，已合入S1独立分支。前置#128/#130已验收；未消费尚未验收的#143协议。

## 范围及公开边界

`authoring-sync.ts` 为同一创作协调器内部唯一有序队列，内部 `DurableSaveCommand` 对齐T04的context/base/pageId/document/description/retainDimensionValues。所有完整手工编辑经既有document-edit公开操作，合法页面变化加入一个操作；onchange/拖拽完成才提交，无变化不产生修订。输入中间态没有额外自动提交监听。工作台同步期间可以继续编辑，迟到回执只推进已确认base，不覆盖最新工作副本。

`authoring-storage.ts` 使用IndexedDB `metriccanvas-authoring/work`，key为actor/workspace/page三元组。队列/工作副本原子快照带format=1和单调存储version，读改写事务检查expectedVersion；不能覆盖其他窗口或已有记录。先保护操作，再保护固定command（此时绑定前一确认base），再发请求；回执推进base/移除队头也原子持久化。凭据不是类型字段，operation只记录身份标识与来源；回执按声明白名单投影，未保留任意transport附加字段。

`StableSavePort` 为拟新增外部强保存边界：stableSave/save/lookup/verifySaved。saved校验operationId、base、page/resource/revision、revisionNumber及非空hash/canonicalization，适配器验证文档完整性。无效结果归unknown、不推进base、不无限发送。未确认结果先查询原操作；仅服务明确not-applied且retrySafe===true时重试原键/原command。已确认冲突/校验/身份拒绝保留队列并暂停。

真实Java适配仍stableSave=false，不把T02 provider-response当作强保存：工作台完整编辑先本地保护，显示能力未确认，不调用旧PUT，也不显示服务端已保存。开发替身只在/dialogue显式注入，`/__fixtures/authoring/*`由浏览器测试拦截提供；不是生产路由/后端。fixture-json/1哈希只为本仓边界验收，不替提供方确定生产算法。

## 原显式保存与状态变化

实际工作台按本票替换为“完整手工操作自动入队”；待同步时按钮用于核实并重试同一队列，不另起旧手工保存请求。#128独立协调器未启用autoSync的显式save仍有原测试；产品入口已启用autoSync，浏览器回归已按新行为验证。精确预览和历史不可用提示仍保留。

UI区分：正在保护到浏览器、已在浏览器保护、浏览器保护失败、服务端已保存修订。保护失败明确勿关闭页面，不能显示已保护；冲突/unknown时可以继续编辑，但后续操作等待队头解决。保存时保留维度取值为可见复选框，默认保留现有内容，每个操作冻结当时布尔选择，不隐式删除DQE条件。

本票持久化但不声称重开已恢复：从IndexedDB读取/校验/重建协调器、重连有界退避归#140。已有记录的version冲突不会被新实例覆盖。未实现语言编辑/发布工具，也不创建第二套保存机制。

## 逐项验收

| AC | 本次实际证据 |
|---|---|
| 一个完整合法操作一次保存，无中间态/无变化修订 | 单元连续one/two/no-change仅2次；浏览器连续改标题2次、重复相同值不新增 |
| 先持久化、稳定幂等、有序基线、迟到不覆盖 | 浏览器在每次fixture save时读取真实IndexedDB，断言command已落盘；延迟首回执时继续编辑，第二command.base等于首回执ref；画布保持最新标题 |
| 状态真实、失败保留、无无限重试 | 单测存储失败零请求，重试先保护；lost-ack查询原key；unknown/去重窗口未保证不重发；冲突/hash/畸形回执保留队列；stableSave=false零请求 |
| 浏览器延迟/重复/未知/冲突 | 去重服务替身以operationId固定receipt；提交后丢回执只lookup、不第二次save；冲突后继续编辑显示2项待同步；IndexedDB被拒绝显示保护失败 |

## 实际命令与结果

- `pnpm test`：132文件979通过/5既有skip（含9项authoring-sync公开行为用例）。
- `tsc --noEmit -p apps/platform/tsconfig.test.json`：通过。
- Platform `svelte-check --tsconfig tsconfig.json`：0 errors / 0 warnings。
- Platform `vite build`：adapter-static成功；`git diff --check`通过。
- `node apps/platform/tests/workbench/authoring-storage-browser.mjs`：T13 PASS。
- `node apps/platform/tests/workbench/authoring-browser.mjs`：T01及T02读取/固定预览/历史限制回归通过，T13真实入口已保护且旧PUT为0。
- 已检查截图 `/private/tmp/metriccanvas-s1-evidence/t13-protected-conflict.png`、`t13-storage-failed.png`；脚本可重建；`t13-unavailable.png`记录真实能力未确认入口。

## 文件、外部状态与下游

新增S1文件：`apps/platform/src/lib/workbench/authoring-sync.ts`、`authoring-storage.ts`、`authoring-sync-fixture.ts`；`apps/platform/tests/workbench/authoring-sync.test.ts`、`authoring-storage-browser.mjs`；本证据文件。
既有S1变更：PageAuthoringWorkbench.svelte、workbench/authoring-coordinator.ts、routes/dialogue/+page.svelte、tests/workbench/authoring-browser.mjs。未改S2/S3/S4作者源；document-edit.test.ts单行#143版本反例已临时交S2，不在本票改动。

本仓强端口/替身通过；真实Java幂等/结果查询/完整性及跨端并发尚未确认，跟踪#105/T04。此票不宣布M1或真实联调通过。S0验收集成后解锁#140；#146仍等#134/#138/#140。

回退：revert本票恢复#128工作台；保留IndexedDB已有记录，不执行删除/迁移。没有真实外部写入；真实服务仍走能力关闭路径。

S5待移交清单：dialogue/runtime.ts真实资源/实例适配，dialogue/PanguDialogue.svelte挂载生命周期；port.ts通知契约/接收与全部创作协调仍S1。S5未登记前不转所有权。

## S0 复核补正：身份异步边界

完整性验证挂起期间切换身份，旧回执不得推进base或移除原已发command；切换后的编辑不得进入旧actor/workspace记录。队列在enqueue入口、串行事务实际执行、verifySaved返回及存储返回后检查身份；检测到变化后本实例永久停写停发，要求重新打开页面，即使切回原身份也不自动恢复。工作台同步订阅与replaceDraft同时拦截身份不匹配，旧结果不推进当前可见引用。

原已发command保留在原身份IndexedDB记录，未重发、未丢弃；重新打开后的读取与核实仍由#140实现，本票不声称已有自动恢复。IndexedDB的可用性检查延迟到实际保护操作，缺失或抛错均进入保护失败状态。

新增单测覆盖verifySaved挂起→身份变化→返回成功仍保留原base/队头，以及切换身份后enqueue/retry零新增写入和请求。补正后定向20项、全量979项通过，tsc/svelte-check/build通过。浏览器与build并行运行的一次开发页重载导致断言失败；构建结束后两套浏览器脚本独立重跑全部通过，没有放宽断言。

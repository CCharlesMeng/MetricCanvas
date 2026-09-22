# #108 本地页面接收状态切片

2026-09-10，用户要求暂挂 #105/#106 的接口事实追问，继续 #95。已同步两个 issue 的现行状态并保持 OPEN；#105 从 grilling 改为 task。#108 已认领并改为 task，先兑现不依赖盘古 wire 契约的本地逻辑。

## 已完成

`apps/platform/src/lib/workbench/analysis-page-state.ts` 提供隔离的本地状态控制器。新轮保留旧页面并标记 previousPage；等待确认、文本答复、失败和取消不清空页面。每轮使用控制器本地 symbol，旧轮、重复交付、其他控制器及 reset 前的结果不能覆盖当前页面。确认回应使用新轮，等待轮无权再接收页面。

页面输入复用产品 validate 校验，失败保留旧页；保存和读取状态时克隆页面，避免调用方修改引用污染当前状态。取消仅失效本地接收资格，不声称停止服务端生成。reset 用于显式清空/删除及切换分析会话。

## 验证

- `pnpm exec vitest run apps/platform/tests/workbench/analysis-page-state.test.ts`：11 项通过。覆盖全部保留场景、异步返回乱序、确认前后隔离、重置、重复交付、非法页面和引用隔离。
- `pnpm --filter platform check`：通过，svelte-check 0 errors / 0 warnings，测试 TypeScript 检查通过。
- `git diff --check`：通过。

## 未完成与后续接入

这是本地模块及测试，尚无生产 UI/盘古适配器消费者；页面工作台行为尚未因此改变。本次未修改 UI，未执行浏览器验收。提交与远端交付记录见 #108，其他会话的未提交文件不纳入本切片。

后续 #107/#108 按已验证事件契约接入：本轮开始调用 begin；确认问题结束本轮调用 waitForConfirmation；明确无页面的答复或失败调用 finishWithoutPage；取消调用 cancel；显式清空/切换会话调用 reset。消息流 finish 不能未经核实映射为 text，避免拒绝尚在独立通道读取的合法页面。

acceptVerifiedPage 只在上游完成身份、产物来源、hash/version 验证后调用，本模块仅复验页面协议。真实产物读取与并发版本、待确认业务校验、盘古消息映射、画布标识呈现、手工编辑交接及刷新恢复仍需后续联调。此处 symbol 不进入请求、不持久化，也不是分析会话检查点。

#108/#104/#125 均不能据本地测试关闭。#103 继续按其内网 handoff 推进，不重复执行。

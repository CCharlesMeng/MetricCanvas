# #116 契约同版与 rc.1 定版（2026-09-08）

## 实现

- page、engine、metric-canvas、embed 四个交付物移除 private，锁步为 `1.0.0-rc.1`。其他应用/服务包继续私有；页面协议版本独立保持 `6.0`，创作契约与 Bundle 版本仍为 `0.2.0`。
- 产品契约 `productContractVersion` 从 page 的 package.json 读取，产品 manifest、Bundle 只读快照与契约锁均来自同一个版本源。导出检查发现分叉时明确打印 `productContractVersion=<实际值>; @metriccanvas/page version=<npm 版本>`。
- 回归在隔离目录逐一篡改三处版本、只推进 npm 版本、再重新生成，分别验证失败诊断与单向生成成功。版本检查先在 0.1.0 上红→绿，之后才推进 rc.1。公开面门禁增加四包同版与可发布检查。
- 只重生成产品/快照 manifest、契约锁与 Bundle 摘要锁；Python 运行时继续消费只读快照，不加载 Node。同步 Python 的 Bundle 信息预期与构建文档。
- 现有公开面快照未改变；URL 导航仍为 6.0 的 href/query，旧 5.x 主版本被版本测试拒绝。ready 事件中的页面身份不属于旧 pageId 导航协议。

## 验证

源码树 `316d73f7ed0609702343e7d71db5ed156df4624c`，完整矩阵结果目录 `/private/tmp/116-matrix`。本报告在验证树之后追加。

| 检查 | 结果 |
|---|---|
| 版本分叉与生成回归、公开面快照 | 7 项通过；故障注入的检查在旧实现上先失败 |
| 冻结锁文件安装 | 通过，pnpm-lock.yaml 无需变化 |
| 页面文档校验 | 11 / 11 通过 |
| 产品中立契约 | 183 product / 4 authoring / 1 interface 一致 |
| Bundle 摘要检查 | 460 项通过 |
| Python 回归 | 153 项通过 |
| 四包真实 tarball | 均为 1.0.0-rc.1；11 个入口、38 个组件及发布文件范围检查通过 |
| 当前与最低 Svelte 完整矩阵 | 两版本各 132 文件通过 / 1 跳过、956 用例通过 / 16 跳过；全仓 check/build 与仓外安装/check/build 均通过 |
| 真实浏览器 | 两版本各 86 通过，无失败/跳过/重试；Chrome 152.0.7977.76、Edge 152.0.4191.66；ESM 与 script/IIFE 均渲染成功 |

源码与生成物验证使用仅包含本次变更的 Git 树及独立副本，避免把并发任务尚未完成的 RELAY-HANDOFF 文档改动锁入本次交付。原工作区该文档保持原样。

## 边界

本次完成发布准备，没有执行 registry publish。#103 仍需在明确的内网 registry 发布、由真实异构集成应用安装并完成终点验收。仓外测试消费者不能替代该终点；#104/#105 的静态化与外部页面资产接口前置也未改变。

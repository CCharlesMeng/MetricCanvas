# S1 下一阶段准备与盘古移交

2026-09-15。准备基线 `a6e923187e124c7fd6c7f7c2e78bafd101e3dda6`，已核对 GitHub main 与 S0。任务 `01a09f69-8346-7e91-9c66-9e091d3f6e77`；工作树 `/private/tmp/metriccanvas-126-s1`；分支 `codex/authoring-126-s1-next`。旧分支保留历史。本文件仅准备，不代表 #138/#145/#146 实施或验收。

## 盘古两文件交接

S1 已向 S0 给出无并行修改回执：以下两文件本阶段未修改，冻结等待 S5 真实登记及 S0 台账正式转移。

| 文件（仓库相对路径） | 当前最后修改提交 | 当前 Git blob |
| --- | --- | --- |
| apps/platform/src/lib/dialogue/runtime.ts | 075c602952ef9c0b095fcf93cd701020f47835c8 | 0dff47badb4a3148108a559ffd41e4ee387f544c |
| apps/platform/src/lib/dialogue/PanguDialogue.svelte | bdfbd983841234a8a54ea2d9db4b3816d9d986ca | 8f370b1bada9c741b695164d8efa11803cbc2bf9 |

`port.ts`、`fixture-adapter.ts`、开发路由、工作台协调、客户端与保存规则仍归 S1；混合测试文件不随两文件默认移交。S5 可增加其专属测试，修改现有混合测试须登记具体文件。

- 稳定挂载接口为 `DialogueAdapter.mount(element): Promise<() => void>`，组件接受可选 `adapter`；异步加载后卸载仍调用清理，实例 destroy 幂等。
- 部署只注入 `window.__METRICCANVAS_PANGU__={resourceUrl,version}`；HTTP(S) 无 URL 凭据；同 document 固定完整资源 URL/version，同版本失败可重试，换版本整页刷新。
- SDK 适配目前使用指南 `window.pangu.instance(id).renderChat(selector,{instanceId,config:{mode:'side',autoRecover:false}})` 和 `destroy()`。指南方法存在不代表真实部署、身份、路由及事件已接通。
- T01 `draft-notification/1`：window `metriccanvas:draft-saved` 的 detail **只有** `{draftId}`。不加文档、序号或令牌。读取适配器鉴权、定位不可变版本并验证完整性后返回 `SavedDraft`；draftId 不等于 pageId/revisionId，不解析 ID 排序。真实能力未确认时 `CAPABILITY_UNAVAILABLE`。
- `/dialogue` 是开发入口，可独立运行并勾选“嵌入工作台”；实际 SDK 部署注入后的工作台入口验证与受控替身入口分别使用。生产不依赖开发入口。

复现命令（从工作树根目录启动；本轮未重跑已有验收）：

```sh
cd apps/platform
./node_modules/.bin/vite --host 127.0.0.1 --port 5181
```

另一个终端从工作树根目录执行：

```sh
./node_modules/.bin/vitest run apps/platform/tests/workbench/dialogue-boundary.test.ts apps/platform/tests/workbench/analysis-page-state.test.ts
S1_BASE_URL=http://127.0.0.1:5181 node apps/platform/tests/workbench/authoring-browser.mjs
```

已有证据见 `../t01-evidence.md`：独立/嵌入、失败保留、乱序、重试、身份隔离、卸载，以及兼容 SDK 替身 v1/v2 更新。真实上游升级、真实事件来源与精确读取仍属于 #106/#107/#108，不能用这些替身证据代替。

## #146 验收场景与覆盖映射

只在 S0 验收 #138 并公布正式共同 SHA 后实现。先核对其可信身份注入、强保存、操作查询、精确读取接口和 #134 内容编辑接口，再登记实际新增代码/测试文件。下表“复用”是已有局部证据，不等于本票闭环已通过。

| 场景 | 既有复用 | 本票必须补的公开证据 |
| --- | --- | --- |
| 空画布首次合法产页 | 内容创建/校验、协调器空页入口 | Relay 替身实际调用内容工具→生命周期工具；非法页零资产，合法页仅建一次 |
| 语言改版 | authoring-coordinator 同步门禁 | 等待本地保护和同步完成，冻结准确 base；运行中手工控件不可修改 |
| 保存引用交付 | dialogue-boundary 单 ID 通知 | 可信程序通道完整文档保存，事件仅 draftId，鉴权精确读取并验证原文/引用后更新画布；模型只见摘要和引用 |
| 失败/文本/等待确认 | analysis-page-state 保留旧页 | 从真实受控轮生命周期触发，既有页与手工属性保持；无虚构保存成功 |
| 断网/未知结果 | authoring-sync lost-ack/lookup | 已发送用原 operationId 查询；pending/unknown 不换键，不直接重发；saved 后精确读，not-applied 仅按允许语义重试 |
| 取消后服务已保存 | #108 本地取消、T04 操作查询 | 取消立即失效接收资格；查原操作发现 saved 也不自动替换；明确显示真实保存状态与可恢复引用 |
| 迟到/重复/卸载 | dialogue-boundary 乱序、A→B→A | 过期轮事件与异步读均不更新；同轮成功去重，失败允许重读；不能以 ID 大小猜顺序 |
| 身份/工作区变化 | sync 与 coordinator 作用域保护 | 发送、查询、读回前后验证；旧身份结果不显示到新身份，不复用旧用户草稿 |
| 其他窗口冲突 | sync conflict 保留队列 | 服务拒绝基线后保持本地副本；无自动合并、无新语言/发布越过未解决状态 |
| 读取失败/无权限/完整性失败 | coordinator、dialogue 原文校验 | 错 draftId/pageId/resourceId/revisionId/hash 均拒绝，任意旧修订不可回退 latest；恢复权限后显式重试 |
| 部分成功 | #134 确定性编辑结果 | 合法子集只保存一次；操作结果如实区分成功/拒绝；保存失败不得把子集标成已保存修订 |
| 发布后继续修改 | 固定 RevisionPreview、#144 执行匹配 | 联合 #145 验证当前草稿变化不改变不可变模板/预览目标 |

测试分层：内容和生命周期走各自公开入口；Relay 替身仅编排它们，不复制算法。协调器针对性测试验证状态资格和发送次数；浏览器验证禁用/保留/恢复提示及精确页面呈现。M1 需代表性页面端到端含失败/断网，并分别报告本仓、外部确认、真实联调。

## #145 已有裁决与恢复呈现调查

已读 #126/#138/#145/#146 完整正文及最新评论、#108、ADR-0078 和 T04。以下已有决定不再作为用户偏好题：

- 发布分准备与人工确认两阶段；Java 提取/校验，前端和工具不复制算法。展示来源修订、差异、影响数据源、参数摘要、保留取值选择与候选预览。
- 仅等值/多值及部分共享；不同取值共享、时间/金额范围不提取。候选修正产生新版本，旧确认失效；内容变化须返回草稿保存后重新准备。
- 确认绑定 actor、候选版本/source、摘要/hash、保留取值与有效期；自然语言发起不产生人工确认。Java 最终校验当前 head、权限、有效确认和页面级 15 分钟租约；客户端不能用本机时钟宣称有效。
- 取消仅停止本地接收，已经发送的保存必须查询。取消/拒绝/超时释放发布租约，但不能据此宣称已发出的服务事务被回滚。

恢复呈现的实现建议（尚非新增产品裁决）：保留当前画布，查询已发操作后展示“已保存修订，可查看”；通过鉴权精确预览和既有历史恢复入口，由用户显式选择恢复成新修订。若当前 head 或本地队列已变化，不直接接纳被取消轮的结果。pending/unknown 保持“结果待确认”且阻断下一次依赖操作；不提供会新建重复修订的盲重试。身份变化后旧操作的细节不在新身份显示。将此建议交 S0 汇总确认是否完全沿用既有恢复交互；在形成不同产品行为前不自行改判。

外部事实缺口：可信轮资格/身份映射、取消后操作查询、draftId 精确定位、真实完整性算法、候选修正字段及人工确认证明/租约 wire 接口。交 S0/S4/S5 查提供方事实，不把它们问成产品偏好，不发明 HTTP 端点。

当前未依据外部设计源还原 UI；后续若采用设计稿或外部结构规格还原，按仓库约定进入 SDD。

## 本轮证据与后续

本仓：仅文档准备，核对在线 main、票据、现有代码/测试及已验收证据；无新实现，不重复运行既有矩阵。外部确认：本轮没有新增。真实联调：本轮未执行。恢复方式：删除/修订本准备文档；未改变运行时或存储。

S0 登记 S5 并正式移交两文件后，S1 向真实 S5 任务送出相同回执。S0 集成 #138 后优先 #146，然后 #145；工作台客户端/UI 归 S1、生命周期工具归 S4、公共契约与生成物归 S2。

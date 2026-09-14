# S5 盘古适配核验记录

状态：只读事实核验完成，实现文件尚未正式移交。本文不是 #106/#107/#108 的整票验收，也不证明真实服务接通。

## 基线与文件所有权

- S5 任务：`01a0a034-c4c3-7033-af2b-2539d6d9e0ae`。
- 独立工作树：`/Users/moon/.codex/worktrees/8291/DataDashboard`；分支：`codex/s5-pangu-integration`。
- 本轮核验代码基线：`a6e923187e124c7fd6c7f7c2e78bafd101e3dda6`，开工时已 fetch 并与 S0 核对，工作树干净。不沿旧 #127 或九票交付分支。
- S0 登记提交：`a1b9de59f734fb24a7c0cc4dfb85f9f6dc666c62`。S5 可新增本文及 `apps/platform/tests/workbench/pangu-runtime.test.ts`；本轮只新增本文。
- S1 的无并行修改回执见 `handoff/s1-next-stage-preparation.md`，作者提交 `2d61ec1a78427631417d9adeea7ca7ea0e3443f6`。`apps/platform/src/lib/dialogue/runtime.ts`、`PanguDialogue.svelte` 仍等待 S0 核清 CI 接缝任务后的正式移交；不以 S1 单方回执替代 S0 放行。
- `port.ts`、开发替身与路由、工作台协调、客户端及保存规则仍归 S1。本文不修改这些边界。

## 本仓核验

已读取 next-stage、common、S5 角色交接、development-plan、coordination、执行仓 AGENTS、领域词汇表、ADR 索引及 0070/0073/0077/0078；核对 GitHub #106/#107/#108 完整正文与评论、#126 规格与最新评论，以及 T01、#108 既有证据。

| 已观察到的行为 | 代码或已有证据 | 本轮结论 |
| --- | --- | --- |
| 部署注入只有 resourceUrl/version，资源 URL 加 v 参数 | dialogue/runtime.ts | HTTP(S) 且拒绝 URL 用户名/密码；同文档固定完整 URL，同版本加载失败可重试 |
| 独立实例挂载与销毁 | runtime.ts、PanguDialogue.svelte | 使用 instance/renderChat/destroy；唯一容器与实例 ID；组件处理加载完成前卸载；尚未以真实 SDK 复验 |
| 草稿通知仅一个不透明 ID | dialogue/port.ts | window 事件 metriccanvas:draft-saved，detail 仅 `{draftId}`，拒绝额外字段；不能把 ID 当 pageId/revisionId 或按字面排序 |
| 重复、失败重试与异步旧读取隔离 | dialogue-boundary.test.ts、analysis-page-state.test.ts | 已有覆盖可复用；本轮只审阅，未重跑 |
| 真实精确读取未开放 | unavailableDraftReader、authoring-coordinator.ts | 未确认能力时拒绝接收，不用 latest 或当前详情冒充不可变精确修订 |
| 兼容 SDK 替身升级 | authoring-browser.mjs、t01-evidence.md | 已有 v1/v2 与卸载演练；属于本地替身证据，不是上游真实升级证据 |

### 旧轮通知首次迟到的接收资格

必须区分两种时序：

1. 通知已经到达并开始读取，随后工作范围变化，旧读取才返回。现有 captureScope 检查可拒绝这份响应。
2. 旧轮取消，新轮开始，旧 draftId 的通知此时才首次到达。监听器在通知到达时捕获的是新范围；单字段事件自身无法证明该草稿属于哪一轮。

第二种不能用第一种的测试结果替代。T01 已记载“未见过的迟到通知不能仅凭 ID 排序”的限制；本轮将取消后新轮的具体场景交给 S1，S1 已在上述准备文档确认纳入 #146。可信程序通道中的操作、来源基线和当前接收资格必须先能关联并验证；真实能力未经证实，精确读取继续保持 CAPABILITY_UNAVAILABLE。不扩展事件 JSON，不从模型文本提取关联，不推测 ID 映射。

## 外部资料核验

可读原始资料：用户提供的《微前端子服务集成盘古助手第二实例 — 完整指南》，本机路径 `/Users/moon/Downloads/粘贴的 markdown (1)。md(5)`。该资料不能替代某一实际部署版本的运行验收。

- 明确 `window.pangu.instance(id)`、`renderChat(selector, options)` 与 `destroy()`；已加载 loader 的同文档实例应复用；`closePangu` 仅隐藏。
- 明确 ask 返回 void；不能 await 它取得页面，也不能推导该轮没有答复。
- config 表列出 side 模式、autoRecover，以及 draggable/resizable/adsorbable 默认 true。当前适配仅显式配置 side 与 autoRecover:false，容器约束须在正式移交后结合最终代码核验。
- skillInfo/referrer/holdingSkill 只有字段及宽泛描述，没有可验证的受控技能标识、字段组合和路由成功/失败样例。
- adapter 表以宽泛 Function 类型列出 getCurrentUser、消息回调、发送及历史方法，没有真实身份或回调 payload、确认关联与执行约束证明。
- stopPanguMsg、streamEventStop、pingCheck 的方法/配置描述不能证明服务端执行已停止；聊天历史不等于分析会话检查点或创作草稿历史。

本轮尝试读取指南中的 CodeHub `PanguInstanceAPI.ts` 源码链接，工具返回无法打开（non-retryable），未取得源码。此为访问失败，不能解释为 API 不存在或不支持。没有联系提供方，没有新增提供方答复。

## 具体缺口与受阻验收

| 需要的资料或环境 | 受阻验收 |
| --- | --- |
| 目标环境可用的 SDK resourceUrl、固定版本、最小部署配置与可访问入口 | 真实加载/挂载/卸载、多实例隔离、容器行为、升级后重集成 |
| 同文档预加载 loader 的实际版本来源与就绪条件 | 安全复用已加载 SDK，避免重复加载或未知版本混用 |
| 受控创建/修改 Skill 的真实调用配置及路由成功/失败证据 | 正确技能路由、拒绝静默回退通用问答 |
| getCurrentUser 的真实结构、门户身份/HIS关系与失效更新方式 | 同一用户身份、身份切换后隔离；凭据只在运行内存 |
| 真实轮次/消息回调与待确认项关联、执行等待证明 | 每轮答复、确认后继续、过期/重复回应拒绝 |
| 取消接口的实际回执和服务端语义、取消后回调样例 | 停止本地接收与停止服务端分别验收 |
| draftId 精确解析、鉴权、完整性、操作/来源基线与轮次关联 | 旧轮取消→新轮→旧通知首次迟到不得覆盖；联合 #138/#146 完整交接 |
| 历史/检查点读取内容、权限、期限及版本契约 | 分别验收聊天历史、分析会话与创作草稿恢复 |
| 候选版本与人工确认承接的真实契约 | 联合 #145 发布确认，不将任意肯定答复当授权 |

上述是尚缺事实，不是能力否定；不向用户重复提出已裁决的产品选择。没有真实 SDK/内网输入时，仍可在正式移交后验证本仓加载、失败重试、卸载及固定版本行为，替身结果单独标注。

## 本轮验证与续跑

本仓：仅文档新增及只读核验；提交前执行 `git diff --check`。未安装依赖、未运行测试或浏览器、未修改运行时代码。已有 T01/#108 的测试数字不计为本轮结果。

外部确认：无新增答复，仅核对已有指南。真实联调：未执行。未关闭 #106/#107/#108，未推送、发布或修改外部服务。

S0 正式移交时提供包含 CI 接缝的可消费 SHA 与最终文件清单；S5 先核对差异，再实施尚缺的独立生命周期测试和适配，避免重复或覆盖 CI 工作。混合测试仍归 S1，专属测试文件本轮未创建。完整创作联调等待 #138/#146，发布确认联合 #145；基础适配不等待整票完成。当前有界交接结束，不自动轮询。

回退：撤销本文对应的单一文档提交即可，无运行时、协议或存储迁移。

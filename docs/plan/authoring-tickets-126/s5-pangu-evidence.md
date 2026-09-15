# S5 盘古适配核验记录

状态：S0 已正式移交，基础资源/实例适配及本仓验证完成，详见末节。前面的只读记录保留原阶段事实。本文不是 #106/#107/#108 的整票验收，也不证明真实服务接通。

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

## 正式移交后的基础适配切片

S0 在 `fef8d20ce11f18d2af5815c0b531f87d45459663` 正式移交 runtime.ts/PanguDialogue.svelte；该基线包含 CI 接缝及 #146 增量。本分支合入后 HEAD 为 `9ea366d0351a955d4c75df8e1689b224a408d722`，合入前后均干净。`docs/pangu-development.md` 开头旧 #127 分支说明按 next-stage 优先规则只视为历史，不作为开发起点。

实现提交：`a98dc2363b58d74c1e31b1d306d16657997e7d65`。实际只修改 `apps/platform/src/lib/dialogue/runtime.ts`，新增 `apps/platform/tests/workbench/pangu-runtime.test.ts`；没有修改 PanguDialogue、attachDialogue、port、工作台、混合测试或 CI。组件现有 adapter 替换与异步卸载接缝完整保留。

### 变化与边界

- 按指南显式关闭 draggable/resizable/adsorbable，仍使用 side 与 autoRecover:false。测试验证传参；真实 SDK 是否严格留在目标容器内仍需实际版本验收。
- 同文档同 URL 只加载一次；同步加载异常也返回可重试 Promise。加载超时、error、DOM 插入失败或加载后缺 instance 接口均释放回调、定时器与脚本元素；同版本可重试，版本变化仍要求刷新。移除脚本不等于撤销已经运行的上游脚本副作用。
- 对已存在的 window.pangu，仅当 document.scripts 中存在与部署配置完全一致的 URL 且 instance 可调用时复用，不追加第二个 loader；来源无法核对时明确拒绝。URL 对应内容、v 参数确实固定不可变 SDK 的保证仍归部署服务；DOM 检查不是代码完整性或真实版本证明。不可见脚本、其他文档、仅有全局 API 的载体不推测版本。
- 实例创建/接口形状/渲染失败时尝试销毁并恢复自身占用的容器 ID；已由替换适配器改写的 ID 不覆盖。SDK 异常不原样显示，避免把运行时私有信息带到界面。
- 清理至多调用一次；即使 SDK destroy 自身抛错，也恢复仍属于自己的 ID，并避免打断替换或卸载。此种异常不能宣称 SDK 内部资源已释放；真实 SDK 清理失败需刷新并在目标环境核查，本仓不记录其原始异常。
- 不增加运行时配置字段、身份映射、技能路由或消息回调；事件仍只有 `{draftId}`。#146 的轮次关联由 S1 负责，本切片没有从 opaque ID 推测归属。真实 SDK/身份/精确读取仍未开放。

### 本次实际验证

1. `pnpm install --frozen-lockfile` 安装依赖，锁文件未变。首次 offline 安装因缓存缺包退出；正式安装成功。首次 Vitest 因工作树缺 SvelteKit 生成 tsconfig 未启动测试；执行平台 check 的 sync 后重跑，不计首次失败为通过。
2. `pnpm exec vitest run apps/platform/tests/workbench/pangu-runtime.test.ts apps/platform/tests/dialogue.test.ts apps/platform/tests/workbench/dialogue-boundary.test.ts apps/platform/tests/workbench/authoring-language.test.ts apps/platform/tests/workbench/analysis-page-state.test.ts`：**5 文件 73 项通过**，其中 S5 新增 **13 项**。包括预加载复用/拒绝、并行实例、失败重试、超时、无 SDK、插入失败、脱离容器、实例创建/渲染/销毁异常、文档版本锁及替身新版本装载；复用 #146 的取消/迟到关联与既有通知/旧页保护回归。
3. `pnpm --filter platform check`：通过，svelte-check **0 errors / 0 warnings**，测试 TypeScript 检查通过。
4. 在本工作树用 Vite `127.0.0.1:5195` 启动，执行原有 `S1_BASE_URL=http://127.0.0.1:5195 node apps/platform/tests/workbench/authoring-browser.mjs`：最终实现上 **T01 与 T02/T13 browser PASS**。覆盖独立/嵌入、失败/非法/迟到保留、外壳、卸载、SDK 替身 v1→同文档拒绝 v2→刷新加载 v2；页面 JS 错误数组为空。此脚本没有修改，结果是实际浏览器配合本地替身，不是实际盘古服务。
5. `pnpm --filter platform build`：通过，adapter-static 写出 build；未增加服务端部署要求。
6. `git diff --cached --check`：通过。

外部确认：本次仍没有新增提供方资料。真实联调：仍未执行；上表 SDK 资源/环境、受控路由、身份、确认、取消、精确产物、恢复及真实升级缺口保持。没有用替身结果关闭 #106/#107/#108 或宣告 M3。#145 的验收暂停不影响本切片，也未在此重新放行。

交付 S0 时仅消费实现提交及后续证据提交，不需取 S5 的基线合并提交。回退本实现提交即可恢复原基础适配，无数据迁移；新测试随同回退。后续按真实 SDK/内网输入续跑相应验收，不轮询外部状态、不联系提供方、不远端发布。

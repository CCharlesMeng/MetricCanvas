# #128 / T02 S1 验收回执与 #130 消费映射

前置：S0 已验收 #127。共同基线 `b90e5506805bc6604d4bedb595fcac09274a19e6`（合入 S1 后保留原提交身份）；工作树 `/private/tmp/metriccanvas-126-s1`，分支 `codex/authoring-126-s1-platform`。

## 实际接口与责任

内部版本 `authoring-coordinator/1` 作者源：`apps/platform/src/lib/workbench/authoring-coordinator.ts`。工作台只投影 snapshot、转发编辑意图；协调模块独占工作副本、已保存引用、读取竞争、手工保存四态和接收资格。`page-assets.ts` 组装实际客户端，`RevisionPreview.svelte` 接收可替换读取函数；预览入口捕获固定 DraftRef，不跟随后续保存变化。保存未改旧 Node 链，也未新增 HTTP 端点。

- `DraftRef = {pageId,revisionId,resourceId}`：不透明且独立。客户端保留已确认 page_metadata_id 为 resourceId，PUT 使用当前工作副本的精确资源 ID 和 base_revision_id，不重新猜最新目录资源。
- `OperationContext = {operationId,actorId,workspaceId,origin:{kind:'manual'}}`：操作前分配并在内存保存；actor 来自门户声明，真实性由 Java 验证。idempotencyKey 仍不发送，因为已知 wire 不支持该字段，不能冒称去重。
- `SaveOutcome = saved|pending|unknown|rejected`。本票 `saved` 明确 `assurance:'provider-response'`，仅证明已知 HTTP+业务成功、引用与规范化回执内容匹配；不是 #130 必须具备 hash/canonicalization/幂等保证的强 Saved DTO。缺 retCode、非法回执、网络/5xx、返回内容不匹配均不报成功。unknown 不给伪造 ref，不重发、不重载覆盖；冲突拒绝保留工作副本，不自动合并/重试。
- `load / replaceDraft / save / preview / readSavedDraft / acceptSavedDraft / subscribe / dispose`：原文仍由客户端返回；既有 createCanvasAuthoringDraft/normalizePageDocument 在协调边界规范化。已知服务无 hash，不编造 hash；未来强读取适配器必须在返回 raw document 前校验原文完整性，之后才能规范化。
- `AuthoringCapabilities`：currentRead=true；exactRead/exactDraftRead/history/stableSave/operationLookup/candidate/execute=false。getRevision 只实现 current-match，历史不可用仍在详情页显示。可信只含 draftId 的全局事件通过可替换精确读取端口消费；默认明确 CAPABILITY_UNAVAILABLE，不把 pageId/revisionId猜作draftId。开发替身显式注入，不代表生产能力。
- 作用域：读取按本地 epoch + actor/workspace 隔离。手工编辑或保存令旧读取作废；身份变化后的旧副本不得以新身份保存。未保存修改、未知保存结果和不同页面引用均不允许通知覆盖。通知处理继续复用 #127/#108。

## Acceptance criteria

| #128 AC | 本次证据 |
|---|---|
| 既有已确认 HTTP，无 Node 回退 | 原客户端 POST/PUT/GET 路径、两个身份头和 object写/string读保持；客户端测试及浏览器真实客户端+HTTP替身 |
| 工作副本、读取、保存、对话接口分离，手工保存浏览器回归 | coordinator公开行为测试；浏览器打开6.0原文→编辑标题→一次PUT写6.1/layout→r2精确预览→断网unknown保留与禁重发 |
| 最小内部契约，已知/未知/提案分开 | 上述类型/能力表及下方T04映射；未知保存结果不重试，current-match不伪装历史 |
| 文件独占、历史不可用 | S0登记的工作台/客户端/预览/协调与相关测试由S1；协议作者源S2未改；历史提示浏览器可见 |

## T04 全部21个正反场景消费映射

以下引用同目录 `t04-contract-examples.json` 的 case ID；未执行的业务能力如实标为未实现，样例 checker 仅证明提案自洽，不冒充 Java 或功能实现。

| case ID | #128 实际映射/证据与未实现部分 |
|---|---|
| save-exact-read | 现有保存与固定ref current-match预览浏览器通过；强hash保存、任意不可变精确读仍 unavailable |
| retry-identical | pending重复只发一次，unknown禁重发；真正同键服务去重因stableSave=false不执行 |
| retry-different-payload | unknown后本地仍可编辑，但不以新键发送；服务端指纹冲突待Java |
| lost-ack | 网络错误为unknown、保留原base/文档；operationLookup=false，不推断未提交 |
| exact-read-reject-latest | preview比较完整ref，错revision/resource拒绝；测试给r1响应请求old拒绝 |
| exact-read-reject-hash | 当前服务无可信hash，exactDraftRead=false拒绝该通路；未做伪hash校验，未来适配器原文验证先于规范化 |
| stale-save | 已确认错误保持rejected与原code，REVISION_CONFLICT暂停不再发；身份变化/错载荷回执不能推进base |
| candidate-publish-repeat | candidate=false；没有候选/发布端点或界面，不把重复发布样例实现为本地事务 |
| candidate-unconfirmed | 无确认写入口，未来沿T04绑定actor+CandidateRef+source+hash，不由事件/模型生成确认 |
| candidate-expired | 未实现；有效期与时钟由Java裁决，本地不推断可发布 |
| candidate-stale-version | 未实现；未来确认必须固定最新candidateVersion，DraftRef不替代CandidateRef |
| candidate-head-changed | 未实现；当前协调会保留精确草稿ref，未来交Java复验head，不本地合并 |
| candidate-lease-expired | 未实现；不新增前端租约权威，未来Java校验并返回对应错误 |
| execute-success | execute=false；未来消费完整精确target/operationId/conditionKey，沿S2公共执行入口，不复制运行时 |
| execute-partial | 未实现；按T04/S2数据快照error分支逐源归一，不把缺rows当失败表达 |
| execute-empty | 未实现；rows:[]是真空集，与missing-source区分，既有渲染取数流程不变 |
| execute-missing-source | 未实现；未来缺必需源为RESPONSE_MISMATCH，不渲染假空集 |
| execute-wrong-conditions | 未实现；未来必须校验target/operationId/conditionKey，不复用错条件initial |
| execute-no-access | 未实现；NO_ACCESS_SCOPE由Java裁决且零取数，不生成无条件查询 |
| historical-read-after-next-save | history/exactRead=false；getRevision current不匹配显式失败，详情不伪造历史 |
| candidate-correct-revalidate-confirm | 未实现；修正产生新候选版本，旧确认失效，人工再确认；没有引入第二份候选算法 |

这些是 #130 消费兼容回执：本仓最小类型与保护行为已经实现，候选/执行接缝与未来作者源一致但功能保持关闭。不是21个业务场景全部联调通过。#138/#144/#145/#146只能在各自前置及M0后实施。

## 检查与交付状态

- Platform 全部测试：145通过/1既有skip（后续新增客户端与协调保护用例后的最终计数见追加记录）。
- Platform svelte-check：0 errors / 0 warnings；tsconfig.test 类型检查通过。
- Platform Vite静态构建通过（adapter-static）。
- `node apps/platform/tests/workbench/authoring-browser.mjs`：T01/T02均PASS；浏览器无pageerror。T02实际检查对象为已确认HTTP协议替身，不是真Java。
- 截图 `/private/tmp/metriccanvas-s1-evidence/t02-preview.png`、`t02-unknown.png`，脚本可重建；已查看unknown截图确认工作副本/暂停保存与恢复未保护提示。

未实现：自动保存/队列持久化/刷新恢复/历史/候选/执行/语言创作算法；没有声称浏览器工作已持久化。外部 #105–#108 持续跟踪精确ID寻址、幂等、hash、身份与真实事件联调。

可解锁：S0验收#128与#130消费对齐后参与M0；未收到M0 READY前不启动功能票。回退：revert本票代码提交，保留#127模块；没有数据迁移，无外部写入，浏览器HTTP替身不写真实服务。

## 最终提交检查

- `pnpm test`（允许本地服务的环境）：131文件，968通过/5既有skip。包含新增页面文档ID与资源ID不匹配保护；之前沙箱内全套运行无法完成，已停止后完整重跑。
- `tsc --noEmit -p apps/platform/tsconfig.test.json` 通过；Platform svelte-check 0错0警告；最终Platform Vite build再次通过；git diff --check通过。
- T01/T02浏览器最终回归通过；已实际查看t02-preview与t02-unknown截图。
- `/dialogue` CSS类名从demo改为dialogue-lab，避免与正式页面ID冲突，全仓页面ID中立性门禁已通过；无产品行为变化。
- SavePageRevision新增可选resourceId：已有调用方省略时仍用既有目录寻址，工作台传入时直接PUT该已打开资源；不新增wire字段。PageRevision新增可选resourceId不破坏既有类型消费者；实际Java客户端始终从page_metadata_id填充。客户端增测固定resource单次PUT、不接受非字符串retCode；提供方资料明确retCode类型string。

准确变更文件：

1. apps/platform/src/lib/PageAuthoringWorkbench.svelte
2. apps/platform/src/lib/RevisionPreview.svelte
3. apps/platform/src/lib/page-assets-client.ts
4. apps/platform/src/lib/page-assets.ts
5. apps/platform/src/lib/workbench/authoring-coordinator.ts
6. apps/platform/src/routes/dialogue/+page.svelte（CSS门禁修正）
7. apps/platform/tests/page-assets-client.test.ts
8. apps/platform/tests/workbench/authoring-coordinator.test.ts
9. apps/platform/tests/workbench/authoring-browser.mjs
10. docs/plan/authoring-tickets-126/t02-evidence.md

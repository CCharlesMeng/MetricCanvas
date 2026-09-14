# 对话模块接缝与 CI

两侧以 `port.ts` 和 `runtime.ts` 的公开接口为契约：

- `DialogueAdapter.mount(element: HTMLElement): Promise<() => void>` 挂载并返回销毁函数。
- `PanguDialogue.svelte` 接收可选的 `adapter`，默认使用 `panguDialogueAdapter`；容器负责卸载、adapter 替换及异步挂载失败。
- 在 `window` 上分发 `CustomEvent('metriccanvas:draft-saved', { detail: { draftId } })`。`draftId` 是只读不可变修订的精确草稿引用，载荷只允许这一项；`draftIdOf` 和 `readDraftSavedDetail` 共用非空、无首尾空白、无控制字符、最多 512 字符的校验。
- `listenForSavedDrafts` 通过 `ReadSavedDraft` 读取精确草稿并隔离迟到结果、身份与作用域变化。`onpage` 返回 `false` 时允许重试同一通知；默认读取端口 `unavailableDraftReader` 明确报告尚未接通。
- 资源配置为 `window.__METRICCANVAS_PANGU__ = { resourceUrl, version }`。`runtime.ts` 保留 main 既有的资源版本固定及 `instance(id).renderChat(selector, options)` / `destroy()` 适配；真实 SDK 的更多接口事实仍由接入侧验证。

`stub-adapter.ts` 提供只挂载提示并销毁自身节点的 `stubDialogueAdapter`，可通过 `adapter` prop 显式注入，不加载资源、不伪造保存成功事件。`fixture-adapter.ts` 保留现有交互式事件替身。正常工作台仍使用既有 `panguDialogueAdapter`；本次不修改 `PageAuthoringWorkbench.svelte`。

双方各自维护工作台中的对话引用，不相互复制覆盖；接口新增或变更需同步接口清单，未列出的本地实现细节不视为冻结契约。`lifecycle.ts` 是容器内部实现，不要求本地侧复制。

CI 的 `pnpm test` 自动发现 `apps/platform/tests/dialogue.test.ts` 和 `apps/platform/tests/workbench/dialogue-boundary.test.ts`，覆盖 stub 生命周期、草稿事件及既有 SDK 资源加载边界。`pnpm check` 包含平台模块、Svelte 容器及测试类型检查。测试不需要真实盘古 SDK、内网或凭据；通过检查不代表真实接入已验收。

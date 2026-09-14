# 对话模块接缝

两侧以 `port.ts` 和 `runtime.ts` 的公开接口为契约：

- `DialogueAdapter.mount(element: HTMLElement): Promise<() => void>` 挂载并返回销毁函数。
- `PanguDialogue.svelte` 接收可选的 `adapter`，默认使用 `panguDialogueAdapter`；容器负责卸载、adapter 替换及异步挂载失败。
- 在 `window` 上分发 `CustomEvent('metriccanvas:draft-saved', { detail: { draftId } })`。`draftId` 是只读不可变修订的精确草稿引用；消费方可用 `readDraftSavedDetail` 校验边界，不将其转换为 latest 引用。stub 不伪造保存成功事件。
- 资源入口为 `window.__METRICCANVAS_PANGU__ = { resourceUrl, version }`，SDK 入口为 `window.pangu.instance(id).renderChat()`。本侧只声明最小类型，不加载资源、不实现真实 SDK，也不推定其他 SDK 方法或回调。

GitHub 侧默认实现仅挂载提示并提供销毁函数，可注入 mock adapter 扩展测试。真实适配由本地/codehub 侧独立维护；此处的辅助函数与生命周期实现不要求本地侧复制。接口新增或变更需同步接口清单；未列出的本地实现细节不视为冻结契约。

双方各自维护 `PageAuthoringWorkbench.svelte` 的对话引用，不相互复制覆盖。本次保留 GitHub 工作台的现有未接通状态；需要接线时可从 `./dialogue/PanguDialogue.svelte` 导入容器。

`apps/platform/tests/dialogue.test.ts` 由根目录 `pnpm test` 自动发现；平台 `check` 检查模块、Svelte 容器及测试类型，随根目录 `pnpm check` 执行。CI 无需真实盘古资源、内网或凭据。通过这些检查仅证明接缝可编译和 stub 行为正确，不代表盘古接入已验收。

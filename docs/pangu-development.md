# 盘古对话模块独立开发（#127）

交付分支：`codex/issue-127-pangu-handoff`。实现提交为 `ae02272`、`5341c31`、`b79a448`；该分支保留这些提交所依赖的已集成基线，不包含后续 #128 等功能增量。

## 启动

```sh
git fetch origin
git switch -c pangu-development origin/codex/issue-127-pangu-handoff
pnpm install --frozen-lockfile
pnpm dev:platform
```

访问 `http://localhost:5174/dialogue`。这是仅开发环境开放的受控事件替身入口；“嵌入工作台”复用同一个 `PanguDialogue`，可检查通知消费、旧页面保留和工作台外壳。此入口默认不加载真实盘古 SDK。

## 开发位置与接入

- `apps/platform/src/lib/dialogue/PanguDialogue.svelte`：公共挂载组件，负责挂载、错误展示与清理。
- `apps/platform/src/lib/dialogue/port.ts`：`DialogueAdapter`、`ReadSavedDraft` 和内部草稿通知契约；复用 #108 页面接收控制器。
- `apps/platform/src/lib/dialogue/runtime.ts`：盘古资源装载与 `instance/renderChat/destroy` 适配。
- `apps/platform/src/lib/dialogue/fixture-adapter.ts`：外部边界替身，不代表真实盘古已支持事件。
- `apps/platform/src/routes/dialogue/+page.svelte`：独立开发入口。独立调试真实 SDK 时，在这里将替身 adapter 替换为 `panguDialogueAdapter`；读取端口仍须明确接入。

真实 SDK 的部署配置须在组件挂载之前由集成门户或开发启动脚本注入：

```js
window.__METRICCANVAS_PANGU__ = {
  resourceUrl: 'https://your-static-server/pangu.js',
  version: 'your-release-version'
};
```

工作台默认使用 `panguDialogueAdapter`。资源地址附加 `v` 参数，一个 document 固定一个地址和版本；更换版本需整页刷新。资源配置不存浏览器本地存储，不修改上游源码。

内部通知契约（不是已确认的真实盘古事件）：

```js
window.dispatchEvent(new CustomEvent('metriccanvas:draft-saved', {
  detail: { draftId: 'opaque-immutable-draft-id' }
}));
```

只接受 `draftId`，不携带页面 JSON、对话消息或保存发布指令。`ReadSavedDraft` 必须鉴权、精确读取不可变草稿版本并校验原始 hash，然后返回 `draftId`、`ref: { pageId, revisionId, resourceId }` 和 `document`。默认读取端口明确返回 `CAPABILITY_UNAVAILABLE`。对话模块不直接修改工作副本，也不承担保存与发布。

## 验证与后续

```sh
pnpm --filter platform exec svelte-kit sync
pnpm exec vitest run apps/platform/tests/workbench/dialogue-boundary.test.ts apps/platform/tests/workbench/analysis-page-state.test.ts apps/platform/tests/workbench/platform-shell-and-composer.test.ts
pnpm --filter platform check
S1_BASE_URL=http://localhost:5174 node apps/platform/tests/workbench/authoring-browser.mjs
```

验收明细见 [T01 验收回执](plan/authoring-tickets-126/t01-evidence.md)。#127 交付独立开发边界与兼容替身演练；真实 SDK 事件、Java 精确草稿读取、身份、路由与真实上游升级由 #105–#108 继续跟踪。

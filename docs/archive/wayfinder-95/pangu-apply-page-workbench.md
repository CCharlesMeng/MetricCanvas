# 盘古卡片确认到页面搭建工作台

日期：2026-09-16

## 结论与实施边界

接受卡片通过 `metriccanvas:apply-page` 携带 `{ pageId }` 请求读取当前页面的接入方向。本次只实现 dialogue 目录之外的工作台接线与独立手动模拟入口，没有改盘古源码，也没有实现或验证真实 SDK 的 adaptive 卡片渲染。

当前 checkout 没有方案引用的 `dialogue/dev-inject.ts`、`dialogue/mock-card-fixture.ts`、`docs/plan/pangu-dialogue-integration-spec.md`。因此方案中的盘古源码行号、`window.panguMock` 及 ParsedMessage 约束只能作为对接输入，不能当成本次实测结论。

## 对原方案的修正

- 普通 `coordinator.load(pageId)` 优先恢复 IndexedDB，不能承担“每次确认重新拉取”。本次增加 `{ refreshCurrent: true }`，保留普通打开页面的恢复行为。刷新成功后更新无待同步操作的本地记录，使用已有版本检查防止无条件覆盖。
- `coordinator.scope()` 包含 epoch，加载、接受产物和手工修改均会改变它。不能在监听注册时冻结该 scope，否则首次加载后确认即失效。本次监听固定身份，读取期间的 scope 检查由 coordinator 承担。
- 现有 `load` 在 loading 时直接拒绝，并非方案声称的“每次新 load 自动取消旧 load”。本次在忙碌时明确报告拒绝，需操作完成后重试。
- 未保存修改、待同步队列、身份变化、其他 pageId、受控语言流程及发布操作期间不应用通知。无页面时允许首次载入；已有页面时只刷新该页面。
- `currentRead: true` 不等于强一致 `latestRead: true`。`getLatest` 当前实质上按 `page_id` 查询目录，选取修订号最大的记录，再以 `page_metadata_id` 读取定义。卡片应传业务 `page_id`，不是 `page_metadata_id` 或 `revision_id`。
- `{ pageId }` 没有轮次或精确修订信息，无法识别同页旧卡片，也不能保证读到卡片生成时的版本。它只表达“确认后读取服务端当前返回版本”。

## draft-saved 的来源与用途

`metriccanvas:draft-saved` 是本仓内部协议，至少可追溯到 2026-09-14 的提交 `ae02272`（#127：isolate dialogue mounting and draft notifications）。它不是本次新增，更没有证据证明盘古已经提供该事件或按 draftId 读取的接口。

设计目的：按精确标识取得不可变产物，避免确认 A 后误读后来生成的 B；同一标识可去重、失败可重试。`unavailableDraftReader` 和 `exactDraftRead: false` 是有意保留的能力缺口，不应通过改成 true 或返回 latest 来伪造接通。

本次保留该接口，未启用真实精确读取。鉴权和原始 hash 校验是未来可信读取适配器的责任，不必要求盘古 SDK 自己实现；应先确定产物由哪个服务持有、如何定位及返回何种可信回执。

## 已确认的实施约定

2026-09-16，用户确认本次实现与接入方案，并授权提交、推送。

1. 本次接受“点击时读取当前版本”，不声明精确对应卡片生成时的版本。
2. 盘古卡片传业务 `page_id`，点击前页面元数据须已保存并可被目录查询发现；真实 SDK 联调仍需验证该约定。
3. 本次保留已实现的保护行为：已有页面只刷新同一页面，异页通知拒绝。
4. `draft-saved` 保留为未接通的精确产物端口；将来需要精确确认时，再确认产物服务的读取契约。

## 手动验证

启动：`pnpm --filter platform dev --host 127.0.0.1 --port 5187`

打开 http://127.0.0.1:5187/apply-page 。入口仅在开发环境渲染模拟工作台。

1. 点“生成下一版卡片”。画布尚未更新。
2. 点“确认”，画布显示“模拟页面第 1 版”。
3. 再次生成、确认，显示第 2 版，验证不会读回第一版缓存。
4. 点“模拟读取失败”，看到错误且第二版仍保留；再点确认可重试。
5. 点“模拟其他页面通知”或“模拟非法通知”，看到拒绝且画布不变。
6. 在检查器修改标题后再确认，未同步修改受到保护。此入口不提供保存，刷新页面重置。

模拟使用内存页面资产端口和模拟对话适配器；无真实 SDK、SSE、业务查询或后端写入。每次打开使用独立模拟身份范围，不覆盖生产身份的工作副本，离开时恢复先前运行配置。测试记录会留在浏览器的 `metriccanvas-authoring` IndexedDB 中。

真实盘古侧只需在确认按钮派发同名事件。正常工作台已监听，不需要使用模拟路由：

```js
window.dispatchEvent(new CustomEvent('metriccanvas:apply-page', {
  detail: { pageId: '实际的 page_id' }
}));
```

工作台监听实现放在 `workbench/apply-page.ts`。dialogue 后续如果提供同类监听工厂，应收敛为一个消费者，避免重复注册。

## 验证

- platform 类型检查：0 errors、0 warnings。
- apply-page、authoring-coordinator、authoring-language、authoring-recovery：84 项测试通过。
- 浏览器脚本：`node apps/platform/tests/workbench/apply-page-browser.mjs`，覆盖重复确认、本地缓存更新、读取失败保留、异页及非法通知。
- 真实盘古 adaptive 卡片未验证，需在实际 SDK 部署环境联调。

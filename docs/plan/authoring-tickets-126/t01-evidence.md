# #127 / T01 S1 验收回执

基线 `29ca8a085027228199484ab19f044bae8d783cd6`；分支 `codex/authoring-126-s1-platform`；任务 `01a09f69-8346-7e91-9c66-9e091d3f6e77`。

## 范围与用户决定

用户经 S0 明确同意 lib/dialogue 与独立入口；盘古通过全局 Event 仅通知最新版本草稿 ID，部署配置仅不同环境的静态资源地址和版本号。实现是既有工作台的边界重构，不依据外部视觉稿还原；未进入 M0 后功能。

`apps/platform/src/lib/dialogue/port.ts` 为内部 `draft-notification/1` 作者源：事件 `metriccanvas:draft-saved`，`CustomEvent.detail = {draftId:string}`，不接受额外字段、页面 JSON 或对话消息。ID 不解析，必须由读取适配器鉴权并精确定位不可变版本，验证原始 hash 后返回文档与独立 pageId/revisionId/resourceId；不是把 pageId 当精确版本。现有 Java 未确认该能力，默认读取明确 CAPABILITY_UNAVAILABLE。未知事件不映射为成功。

`runtime.ts` 只读取 `window.__METRICCANVAS_PANGU__ = {resourceUrl,version}`，URL 的 v 查询参数固定版本，同版本共用装载 Promise；失败可重新挂载重试。门户管理静态资源配置，凭据与配置不写浏览器存储/源码。挂载使用指南 instance/renderChat/destroy，唯一实例与容器；没有推断 skill/身份/回调。S5 在 M0 后接真实 SDK 适配，本次尚未移交。

## 每项验收

| AC | 实际证据 |
|---|---|
| 独立运行、相同模块嵌入、保留外壳 | `/dialogue` 开发入口，勾选嵌入工作台使用同一 PanguDialogue；浏览器检查导航、工具栏、画布与检查器 |
| 专有配置/事件封装 | DialogueAdapter 仅 mount→cleanup，工作台通过读取端口消费通知；模块没有保存/发布调用 |
| 失败/迟到隔离复用 | port.ts 调用既有 createAnalysisPageState；测试重复事件、乱序读取、无效引用/页面、身份作用域变更、卸载与重新挂载；浏览器失败后仍显示 draft-b |
| 兼容更新与配置保留 | 浏览器同一适配/工作台加载 `/pangu-fixture.js?v=v1` 后 v2，各自成功挂载并卸载 destroy；只改部署版本，未改上游/工作台。此为兼容替身演练，非真实上游升级 |
| 实施 grill | 上述用户两项明确决定通过 S0 传达后才实施；#106 与本地原始 SDK 指南已核实，未知真实事件保持未知 |

## 实际检查

- `./node_modules/.bin/vitest run apps/platform/tests/workbench/dialogue-boundary.test.ts apps/platform/tests/workbench/analysis-page-state.test.ts apps/platform/tests/workbench/platform-shell-and-composer.test.ts`：3 文件 20 测试通过。
- `./node_modules/.bin/tsc --noEmit -p apps/platform/tsconfig.test.json`：通过。
- Platform `svelte-check --tsconfig tsconfig.json`：0 errors / 0 warnings。
- 开发服务：Platform Vite `--host 127.0.0.1 --port 5181`；`node apps/platform/tests/workbench/authoring-browser.mjs`：T01 browser PASS，无页面 JS 错误。
- 已实际查看截图 `/private/tmp/metriccanvas-s1-evidence/t01-standalone.png`、`t01-workbench.png`（后一张确认失败提示与保留 draft-b 同时可见）。脚本可重建截图。

## 限制、下游与回退

本仓边界/替身通过；Java 精确 draftId 读取、盘古真实 dispatch、身份/路由、真实上游更新均待 #105/#106/#107/#108，不能据此关闭外部票。无自动保存、历史、发布、语言编辑算法；完整 #146 闭环仍待 M0 与功能依赖。事件不含序号，未见过的迟到通知无法仅凭 opaque ID 排序；读端口必须判定本次目标资格，接收器只保证通知接收顺序、最近256 ID去重及异步旧读不覆盖。

解锁 #128 同角色协调边界；S0 验收集成后再用于 M0。回退可 revert 本票提交恢复旧对话不可用占位；没有数据迁移或外部写入。

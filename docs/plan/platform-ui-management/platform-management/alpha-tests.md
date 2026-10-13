# Platform · Alpha Tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 说明 |
| --- | --- | --- | --- | --- |
| AT-PLAT-1 | DEFERRED | contract | browser-result.json；compatibility/manifest.json；authoring-sync/authoring-language 单测 | 本地保护不写远端；明确保存最后输入仅 1 次；无变化禁用；第 2 次请求丢失回执后 unknown 禁用保存、导航和刷新不重发。真实 Java/Relay/身份路径未运行。 |
| AT-PLAT-2 | DEFERRED | contract | browser-result.json；logs/metriccanvas-platform-save-state-micro.txt | 同任务、阅读、刷新、20 行异步目录滚动/焦点恢复；生产微前端 fixture 的前缀、返回/前进、挂载/卸载通过。真实门户未运行。 |
| AT-PLAT-3 | DEFERRED | contract | browser-result.json；evidence/restore-report-green.json；../java-provider-requirements.md | 当前真实契约支持的列表、当前记录、历史摘要/rollback 与当前记录删除已接入。全量搜索排序、独立发布正文、历史正文/追加恢复、复制、整页永久删除需提供方保证，界面明确能力边界。 |
| AT-PLAT-4 | DEFERRED | contract | document-edit 单测；browser-result.json；evidence/restore-report-green.json | 页面标题保持查询绑定和其他组件；工具面接入 UI；阅读不触发保存；冻结的 8 个数值/状态规则通过。真实环境和完整视觉状态验收未完成。 |


| F3-1 | PROVEN | contract | browser-result.json | 未失焦输入返回管理，本地保护成功且零 PUT。 |
| F3-2 | PROVEN | contract | browser-result.json | 明确保存一次、无变化禁用、丢失回执后导航/刷新均不重发；仅 contract 范围。 |
| F3-3 | UNVERIFIED | contract | logs/metriccanvas-manual-language-final.txt | manualSave 专项测试证明脏稿 AI 前置拒绝/零发送及干净 AI 回执无第二次前端保存；完整 S3 与 live 链路尚缺。 |
| F3-4 | UNVERIFIED | contract | browser-result.json | 同任务与 unknown 导航已证实；另一资源和语言租约同时存在的组合尚缺。 |
| F3-5 | UNVERIFIED | contract | work-session 单测；生产微前端 fixture | 同范围恢复及身份失效已覆盖；完整 actor/workspace/service 切换 S3 组合尚缺。 |
| F3-6 | UNVERIFIED | contract | authoring-sync 单测与 coordinator 停发分支 | 预置 format 1/2 未决记录和未知服务来源的完整 S3 恢复尚缺。 |

证据路径 browser-result、compatibility、logs 相对于 `docs/evidence/platform-ui-management-2026-10-12/`。测试没有调用真实 Java 或 Relay。微前端 fixture 使用 bundled Chromium 151，与当前 Chrome 155 的工作台证据分别记录。

## Deferred

| AT | 外部依赖 | 解除条件 | 恢复入口 |
| --- | --- | --- | --- |
| AT-PLAT-1 | 可用真实 Java、Relay 和测试身份 | 提供已确认服务目标和可复验身份，记录本地保护、人工明确保存与 AI 单发送者的真实请求/回执 | tasks.md Task 1；dev-baseline.md F3；authoring-sync/authoring-language 测试 |
| AT-PLAT-2 | 实际 qiankun 门户与测试身份 | 验证实际路由前缀、导航、刷新、租约与挂载生命周期 | tasks.md Task 2；apps/platform/tests/microfrontend/production-browser.mjs |
| AT-PLAT-3 | Java 生命周期能力与成功/冲突/失败语义 | 按 java-provider-requirements.md 给出契约与行为保证，再接入并验证高级资产旅程 | ../java-provider-requirements.md；实施计划 W7 |
| AT-PLAT-4 | 可用真实平台及完整视觉验收环境 | 在真实工作台操作标题、日期配置、元数据，并复验内容区视觉和契约无漂移 | tasks.md Task 4；UI alpha-tests.md |

## 未完整验证的本地 S3 子路径

以下仍是 UNVERIFIED，不能借外部 Deferred 抹去：人工脏稿开始 AI 的端到端拒绝及回执单发送者；跨另一资源时语言租约与 unknown 操作同时保持；工作台 HTTP 场景中的 actor/workspace/service 切换；预置 format 1/2 未决记录和未知服务来源的端到端迁移停发。单测已有相应保护/隔离证据，生产微前端 fixture 已验证身份失效与 unknown 保留，但它们不等于上述完整 Story 或真实接缝。

代码实施完成与验收通过分开记录；本批未提交、推送、部署或运行远端 CI。

# UI · Alpha Tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 说明 |
| --- | --- | --- | --- | --- |
| AT-UI-1 | PROVEN | contract | packages/ui/tests/calendar.test.ts；packages/engine/runtime-ui/tests/date-picker.test.ts；compatibility/manifest.json | 共享日期向量 15 项；引擎协议和中立 CalendarPrecision 的映射；Chrome 日期场景与两版 Svelte 仓外消费通过。此项只证明迁移逻辑。 |
| AT-UI-2 | UNVERIFIED | contract | evidence/restore-report-green.json；evidence/artifacts/boundaries-raw.json | Button/Input 默认数值还原通过，长文案及焦点已观测；完整逐状态视觉对照尚未收口。 |
| AT-UI-3 | UNVERIFIED | contract | evidence/artifacts/boundaries-raw.json；compatibility/manifest.json | 下拉键盘/焦点/根内浮层及 selected/disabled 已验证；完整源站菜单外观对照尚缺。 |
| AT-UI-4 | UNVERIFIED | contract | evidence/restore-report-green.json；browser-result.json | Grid 默认数值、390 窄屏堆叠和按钮完整可见通过；Pagination 全状态像素对照尚缺。 |
| AT-UI-5 | UNVERIFIED | contract | evidence/artifacts/boundaries-raw.json；compatibility/manifest.json | Tabs 禁用/键盘焦点及 Tag 源站类、Empty 行为已覆盖；全状态源站视觉对照尚缺。 |
| AT-UI-6 | UNVERIFIED | contract | evidence/artifacts/boundaries-raw.json；compatibility/manifest.json | Dialog 原根挂载、短视口、关闭与焦点恢复通过；完整源站视觉对照尚缺。 |
| AT-UI-7 | UNVERIFIED | contract | compatibility/summary.json；compatibility/manifest.json | Chrome 155 的 UI 20 项在当前和最低 Svelte 分别通过；Edge 155 进程静态页面可启动，但动画帧/截图/点击稳定性挂起，完整双浏览器门禁未通过。 |

上述 compatibility、browser-result 路径相对于 `docs/evidence/platform-ui-management-2026-10-12/`。还原报告仅涵盖冻结的 7 个数值规则，不能扩张为所有控件 1:1 视觉验收。官方主题资源与摘要见 `docs/evidence/platform-ui-os-theme-2026-10-12/`；当前代码、依赖摘要与独立复核见本 Story 的 `evidence/review-evidence.json`。

## Deferred

无产品提供方依赖项。尚缺的全状态视觉对照保持 UNVERIFIED；Edge 是本机浏览器执行环境阻力，Chrome 成功不替代 Edge。CI 已配置所需双浏览器矩阵，但本批未运行远端 CI。

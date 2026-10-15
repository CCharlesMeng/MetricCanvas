# Dashboard 时间选择交互原型

这是供讨论的设计稿，尚未接入页面协议、筛选状态或查询执行。

运行：`pnpm --filter @metriccanvas/ui exec vite --host 127.0.0.1 --port 4183`

打开：<http://127.0.0.1:4183/prototypes/dashboard-time/index.html>

统一放在 Dashboard 顶部通用筛选栏内，不再提供页头或分析区布局变体。筛选栏按当前 `FilterBar.svelte` 的 12px 16px 内边距、20px 间距、边框及 10px 圆角呈现。

## 联动规则

- 年：选择完整自然年。
- 季：选择完整自然季度，可切换年份；日期框显示「2026 年 Q4」，面板使用 Q1／Q2／Q3／Q4。
- 月：选择完整自然月。
- 近一年：隐藏日期框，只展示只读范围。按页面打开时的当前月份向前取 12 个完整月份，不含当前月。当前为 2026 年 10 月时显示「25年10月~26年9月」，对应 2025-10-01 至 2026-09-30。此口径依用户于 2026-10-15 的补充说明修订。
- 年／季／月之间切换保留日期锚点；近一年独立按当前月份计算，不受已选日期影响。切回年／季／月时保留原有已选日期。下方同步展示实际起止日期，范围含首尾。
- 当前日期取浏览器本地时间，按打开页面时的月份计算。指标和图表为静态示例，不模拟查询成功。

## 复用与视觉来源

月直接使用当前 `@metriccanvas/ui` 的 `DatePicker`，并未另造月份面板。当前组件是 Svelte 实现，复用 OpenTiny OS 风格与 SVG 来源，并非直接挂载 Vue 组件。年／季面板是隔离的扩展草案，沿用现有 32px 输入框、6px 圆角、14px 字号、#1476ff 主色、#deecff 选中底色与 360px 浮层。OpenTiny 来源：[DatePicker](https://github.com/opentiny/tiny-vue/blob/dev/packages/vue/src/date-picker/src/pc.vue)、[主题说明](https://docs.opentiny.design/tiny-vue/guide/theme.html)。

本次只新增本目录文件，不改动已有 DatePicker 或其他并行工作。正式功能实施前再按 SDD 冻结本设计、明确页面筛选声明与查询绑定，并完成新功能场景及创作 Skill 同步。

## 验证

浏览器检查项及截图见 `evidence/`。原型不代表正式功能验收，也未提交、推送或部署。

类型检查：`pnpm --filter @metriccanvas/ui exec svelte-check --tsconfig ./prototypes/dashboard-time/tsconfig.json`

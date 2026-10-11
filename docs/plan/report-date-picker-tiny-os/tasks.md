# MetricCanvas / report-date-picker-tiny-os

**Goal:** 四种日期筛选形态还原官方 OS 主题输入与面板，保持已批准值协议。

**TaskPacket:** project=MetricCanvas | story=report-date-picker-tiny-os | verification_schema=v2 | test_framework=vitest | component_test_status=available | component_test_framework=vitest-pure-logic | browser_test_status=available | browser_test_framework=cua | search_paths=apps/playground | project_type=frontend | frontend_design_path=docs/plan/report-date-picker-tiny-os/story-delta-frontend-design.md | baseline_source=reference_page | reference_route=https://opentiny.design/tiny-vue/zh-CN/os-theme/components/date-picker | affected_routes=/preview?prototype=report-date&variant=C | required_states=hover,focus,disabled,selected,overflow | restore_tasks=Task-1,Task-2 | risk_triggers=visual,interaction,shared-boundary

## 模块与文件

| 文件 | 职责 | Task |
| --- | --- | --- |
| packages/engine/runtime-ui/src/filters/DatePicker.svelte | 共享 Svelte 选择器与面板生命周期 | 1 |
| packages/engine/runtime-ui/src/filters/date-picker.ts | 日历计算与输入校验 | 1 |
| packages/engine/runtime-ui/src/filters/DatePickerIcon.svelte | 官方 SVG 图标 | 1 |
| packages/engine/runtime-ui/tests/date-picker.test.ts | 闰年、跨年、合法提交边界 | 1 |
| packages/engine/runtime-ui/src/filters/TimePointFilter.svelte | 单值适配 | 2 |
| packages/engine/runtime-ui/src/filters/TimeRangeFilter.svelte | 范围适配；保留 datetime | 2 |
| packages/engine/runtime-ui/src/filters/FilterBar.svelte | 只读统一入口 | 2 |
| packages/engine/runtime-ui/tests/browser/DatePickerHarness.svelte | 直接消费同包正式控件与 FilterBar | 3 |
| packages/engine/runtime-ui/tests/browser/main.ts | 挂载夹具 | 3 |
| packages/engine/runtime-ui/tests/browser/date-picker.html | 浏览器入口 | 3 |
| packages/engine/runtime-ui/tests/browser/vite.config.ts | 复用仓库 Vite/Svelte 启动夹具 | 3 |
| packages/engine/runtime-ui/src/filters/tiny-vue-LICENSE.txt | 上游样式及图标归属 | 1 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-1 | 四形态外框、面板、网格、状态与官方一致 | S1_COMPONENT | restore_contract | 1,2 |
| AT-2 | 合法值才提交，半范围、非法日期、required 清除不提交 | S1_COMPONENT | test_case | 1,2 |
| AT-3 | 报告、普通筛选栏、ShadowRoot、窄屏和两实例定位销毁 | S2_PAGE | test_case | 2,3 |
| AT-4 | 面板打开时完整 PDF 不含控件 | S2_PAGE | test_case | 2,3 |

## Task List

### Task 1: 共享可控日历 [用例: AT-1,AT-2]
**形态:** 还原
**Files:** 上表 Task 1。
- [x] 实现四形态、官方样式与图标、输入校验、导航与清除。
- [x] 批量验证纯逻辑与类型。

### Task 2: 正式筛选入口接线 [用例: AT-1,AT-2,AT-3,AT-4]
**形态:** 还原
**Files:** 上表 Task 2。
- [x] 统一单值、范围与只读；保留 datetime 路径。
- [x] 集中验证报告、HTML 与实际 PDF。

### Task 3: 独立验收夹具 [用例: AT-1,AT-3]
**形态:** 逻辑
**Files:** 上表 Task 3。
- [x] 在引擎测试目录增加正式组件夹具。
- [x] 批量截图与机器事实，独立检视并收口。

## 范围与回滚
不调整 Schema、查询绑定、创作提取、导出引擎或其它筛选器；不提交、推送、部署。工作区已有修改以起点文件快照区分。回滚仅本 Story 文件及已有文件中的本轮差异。

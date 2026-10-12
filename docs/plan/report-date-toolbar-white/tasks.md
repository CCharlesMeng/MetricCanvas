# Report date toolbar white surface

**Goal:** 顶部日期工具带为通栏白底，与封面贴合；保留筛选器、期间文字和数据联动。

**TaskPacket:** project=MetricCanvas | story=report-date-toolbar-white | verification_schema=v2 | test_framework=vitest | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=cua | search_paths=apps/playground | project_type=frontend | frontend_design_path=docs/plan/report-date-toolbar-white/story-delta-frontend-design.md | baseline_source=text_spec | affected_routes=/pages/report-date-filter-example | required_states=overflow | restore_tasks= | risk_triggers=visual

## 模块与文件

| 文件 | 职责 | Task |
| --- | --- | --- |
| packages/engine/runtime-ui/src/RuntimeSurface.svelte | 报表外框顶部留白及跨模块几何 token 的所有者 | 1 |
| packages/engine/runtime-ui/src/ReportHeaderView.svelte | 日期工具带的白底、边缘及控件排布 | 1 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-1 | 顶部工具带白底、左右与报表画布对齐、无顶部及下方蓝色间隙，无边框及圆角 | S2_PAGE | test_case | 1 |
| AT-2 | 窄容器不横向溢出，控件保持右对齐或换行；筛选状态和页头期间同步更新 | S2_PAGE | test_case | 1 |

## Task List

### Task 1: 白色通栏工具带 [用例: AT-1,AT-2]
**形态:** 逻辑
**Files:** 上表两文件。
- [x] 记录当前蓝色边缘的几何事实。
- [x] 调整外框留白与工具带白色表面。
- [x] 复验桌面、窄容器和月份范围更新，回填证据。

## 范围与回滚
只改本次样式差异。不实现 asOf 显式绑定提案，不改 Schema/参数/查询/日期选择器，不提交或推送。ReportHeaderView 之前移除重复文字的未提交修改已包含在本轮起点快照中。

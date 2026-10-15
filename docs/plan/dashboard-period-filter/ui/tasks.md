# Dashboard period UI

**Goal:** 年／季／月／近一年在 Dashboard 顶部 FilterBar 中作为一个控件，季度显示 Q1–Q4，近一年无日期框。

**TaskPacket:** project=DataDashboard | story=period-ui | verification_schema=v2 | search_paths=packages/ui,packages/engine/runtime-ui | project_type=frontend | baseline_source=text_spec | required_states=selected,focus,disabled,overflow | risk_triggers=async-state,new-pattern

## 模块与文件

| 文件 | 新建/修改 | 职责 |
| --- | --- | --- |
| packages/ui/src/components/date-picker/DatePicker.svelte | 修改 | 年季选择提交 |
| packages/ui/src/components/date-picker/calendar.ts | 修改 | 日期值验证 |
| packages/engine/runtime-ui/src/filters/PeriodFilter.svelte | 新建 | 组合控件 |
| packages/engine/runtime-ui/src/filters/FilterBar.svelte | 修改 | 声明分发 |
| packages/engine/runtime-ui/src/RuntimeSurface.svelte | 修改 | 原子状态写入 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-UI-1 | 年季月选择与 Q 标签 | S1_COMPONENT | test_case | 1 |
| AT-UI-2 | 近一年只读范围与历史日期无关 | S2_PAGE | test_case | 2 |
| AT-UI-3 | 顶部筛选栏与窄容器 | S2_PAGE | test_case | 2 |

## Task List

### Task 1: DatePicker 年季扩展
- [x] 复用 OS 浮层与输入行为并扩展精度
- [x] 验证选择提交、键盘与旧模式

### Task 2: FilterBar 接入
- [x] 组合控件进入现有顶部筛选栏
- [x] 验证只读范围、切换和实际查询

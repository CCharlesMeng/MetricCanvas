# Dashboard chart filter button group

**Goal:** 将图表左上角的下拉筛选改为黑色选中态的圆角单选按钮组。

**TaskPacket:** project=DataDashboard | story=chart-filter-button-group | verification_schema=v2 | search_paths=packages/engine/runtime-ui/src/dashboard,packages/embed/tests/browser | project_type=frontend | baseline_source=reference_page | reference_route=https://opentiny.design/tiny-vue/zh-CN/os-theme/components/button-group | affected_routes=/pages/chart-local-filter-page | required_states=selected,focus,loading,empty,overflow,long-copy | restore_tasks=T1 | risk_triggers=visual,interaction | browser_test_status=available | browser_test_framework=Playwright | component_test_status=unknown

## 模块与文件

| 文件 | 新建/修改 | 职责 |
| --- | --- | --- |
| packages/engine/runtime-ui/src/dashboard/ChartFilter.svelte | 修改 | 直接显示选项按钮，选中黑底白字，保留既有value/onchange和静态导出 |
| packages/embed/tests/browser/chart-local-filter.spec.ts | 修改 | 按钮单选、原有独立查询/URL/导出与异常回归，宽窄屏结构和颜色证据 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-BG-1 | 圆角按钮组与黑色选中态 | S2_PAGE | restore_contract | T1 |
| AT-BG-2 | 按钮互斥选择仍只更新本图 | S2_PAGE | test_case | T2 |
| AT-BG-3 | 键盘、URL、加载错误和导出 | S2_PAGE | test_case | T2 |

## Task List

### Task T1: 按钮组呈现
- [x] 替换下拉元素为可访问的按钮组
- [x] 按参考Small档和用户黑色要求实现样式及自然换行

### Task T2: 验证交互与渲染
- [x] 调整现有验收操作，验证互斥选择、键盘与原有功能
- [x] 取得宽窄屏结构、颜色及截图证据，更新必要文档

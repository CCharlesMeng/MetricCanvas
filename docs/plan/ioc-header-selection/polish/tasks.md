# 选择控件点击与视觉细节修复

**TaskPacket:** project=MetricCanvas | story=ioc-selection-polish | verification_schema=v2 | baseline_source=text_spec | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=playwright | search_paths=packages/ui,packages/engine/runtime-ui,apps/playground/tests | project_type=frontend | frontend_design_path=docs/plan/ioc-header-selection/polish/story-delta-frontend-design.md | risk_triggers=visual,interaction,shared-boundary | required_states=overflow,hover,focus,disabled,selected | restore_tasks=

用户于2026-10-20要求仔细检查布局颜色，并修复多选标签点击不能打开。继续已批准的官方风格/搜索/固定单行标签，不改变查询或页面声明。

## Tasks

- [x] T1 鼠标点击最小复现、同一断言RED与根因定位。
- [x] T2 标签/空白/箭头统一点击，关闭/移除/禁用互不干扰。
- [x] T3 官方标签颜色、尺寸、图标、搜索及树布局精确核对与修复。
- [x] T4 组件、完整页面、ShadowRoot及打包后消费回归，独立检视与证据。

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-P1 | 多选鼠标打开和关闭 | S1_COMPONENT | test_case | 点击标签文字/空白/箭头后面板保持打开；再次触发关闭；删除只删除；禁用不打开 |
| AT-P2 | 官方默认颜色尺寸 | S1_COMPONENT | test_case | 输入32px、标签灰底深字、箭头灰色16px垂直居中、圆角6px；搜索和树行间距取冻结官方值 |
| AT-P3 | 完整页面及边界 | S2_PAGE | test_case | 实际IOC客户分类与行业均可点开；浮层不裁切，搜索、标签滚动、窄屏和只读保持正确 |

## 文件范围

packages/ui/src/components/select/{Selection,SelectionIcon}.svelte、shared/Theme.svelte、scripts/freeze-os-theme.mjs、tests/browser/{selection.spec.ts,SelectionHarness.svelte}；apps/playground/tests/ioc-header-selection-browser.mjs；由既有生成器更新的report-theme-properties.ts；本Story证据。起点采用.work/before快照，绝不将整个隔离检出的前序未提交实现归给本修复。

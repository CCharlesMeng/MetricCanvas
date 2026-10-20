# 树内容左间距修复

**TaskPacket:** project=MetricCanvas | story=ioc-left-inset | verification_schema=v2 | baseline_source=text_spec | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=playwright | search_paths=packages/ui | project_type=frontend | frontend_design_path=docs/plan/ioc-header-selection/left-inset/story-delta-frontend-design.md | risk_triggers=visual,shared-boundary | restore_tasks=

用户明确要求树内容距面板左边16px。仅修复已有留白被覆盖的CSS问题。

- [x] T1 测量并加入真实几何RED断言。
- [x] T2 修复优先级，普通根、ShadowRoot、实际页面复验。

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT1 | 树内容左边16px | S1_COMPONENT | test_case | 树首层加减号左边距面板16px，展开后不变，普通根和ShadowRoot一致 |

## 文件范围

packages/ui/src/components/select/Selection.svelte；packages/ui/tests/browser/selection.spec.ts；本Story证据。

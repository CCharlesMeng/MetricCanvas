# IOC 页头选择控件落地

**TaskPacket:** project=MetricCanvas | story=ioc-header-selection | verification_schema=v2 | baseline_source=text_spec | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=playwright | search_paths=packages/ui,packages/engine,packages/page,packages/data-execution,apps/playground,pages | project_type=frontend | frontend_design_path=docs/plan/ioc-header-selection/ui/story-delta-frontend-design.md | risk_triggers=visual,interaction,shared-boundary | restore_tasks=

## TaskPacket

```yaml
project: MetricCanvas
story: ioc-header-selection
frontend_root: packages/ui
baseline_source: text
verification_schema: v2
base_ref: 952b3a273f0f4f8be5820f5af1bb76c2f5afa513
search_paths: [packages/ui, packages/engine, packages/page, packages/data-execution, apps/playground, pages]
unit_test_status: available
browser_test_status: available
risk_flags: [visual, interaction, shared-boundary]
```

用户于 2026-10-20 以“ok，落地实施”批准已演示的选择原型及此前四项要求。本文把它们落实为正式组件和页面声明，实施范围不包含全部 88 项页头能力。原型仍为历史证据，不复制原型源代码。未确认的独立已选侧栏、汇总条和搜索后全选不实施。

## Tasks

- [x] T1 公开 API 审查、冻结兼容性与验收基线。
- [x] T2 中立 Selection 组件、可搜索 Select、固定高度多标签、树选择与官方样式/图标。
- [x] T3 页面选择/搜索声明、候选父子关系、维度与层级筛选接线、版本和状态边界。
- [x] T4 正式 Playground 完整页面和稳定自动验收。
- [x] T5 页面元数据文档、local-authoring 生成及仓外验证。
- [x] T6 最终独立检视、修复、验收记录。

## 用例追溯

| AT | AC | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT1 | 搜索默认开启，可关闭；按名称/代码/路径匹配，不提交筛选 | S1_COMPONENT | test_case | mock |
| AT2 | 多选标签固定单行、横向滚动，删除只移除对应值 | S1_COMPONENT | test_case | mock |
| AT3 | 树形单选替换值并关闭，展开/搜索不提交；父子策略明确 | S1_COMPONENT | test_case | mock |
| AT4 | 官方主题/图标和灰色连接线，键盘和窄容器不破 | S1_COMPONENT | test_case | mock |
| AT5 | 页面声明经真实 FilterBar 到 FilterState，拒绝单选多值写入及旧版本新字段 | S2_PAGE | test_case | contract |
| AT6 | 存量父选后代、候选加载/错误/已选不在候选中保持明确行为 | S2_PAGE | test_case | mock |
| AT7 | 元数据知识及仓外独立 Skill 校验闭合 | S1_COMPONENT | test_case | contract |

## 文件范围

packages/ui/src/components/select/、packages/ui/src/types.ts、packages/ui/src/index.ts、packages/ui/src/shared/Theme.svelte、packages/ui/scripts/freeze-os-theme.mjs、packages/ui/tests/；packages/data-execution/src/ports.ts；packages/engine/runtime-ui/src/filters/{DimensionFilter,HierarchyFilter,FilterBar}.svelte、tree.ts 和相关测试；packages/page/src/{filter,validate,version}.ts、packages/engine/runtime/src/{filter-state,detail-view}.ts、packages/data-execution/src/{filter-values,page-params}.ts、schema/filter.ts、相关测试和契约夹具；pages/ioc-header-selection.json、pages/README.md、apps/playground/page-catalog.json、演示候选网关/浏览器验收；PAGE-METADATA.md、docs/page-metadata/filters.md、tools/scripts/page-reference.ts、按真源生成的契约/local-authoring 产物；本目录证据。连带改动在基线登记。

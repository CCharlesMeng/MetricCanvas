# MetricCanvas / report-date-filters — 实现计划

**Goal:** 报告按需在页头工具带显示日期筛选，提取确认后自动生成，并向集成应用提供完整静态导出视图。

**关键结构决策:** 筛选状态与查询仍由统一运行时拥有；页头只引用筛选器。导出独立渲染，共用组件，集成应用拥有 PDF 编码。

**TaskPacket:** project=MetricCanvas | story=report-date-filters | verification_schema=v2 | test_framework=vitest | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=playwright | search_paths=packages/engine,packages/page,packages/embed,apps/playground,apps/platform,metriccanvas-authoring | project_type=frontend | frontend_design_path=docs/archive/report-date-ui-2026-10/2026-10-09-report-header-date-filters.md | baseline_source=text_spec | prototype_dir= | reference_route=/preview?prototype=report-date&variant=C | affected_routes=/preview,/pages | required_states=loading,empty,disabled,selected,overflow,long-copy,large-list | restore_tasks= | risk_triggers=async-state,new-pattern

## 项目边界

| 范围内 | 范围外 |
| --- | --- |
| 页面协议、提取程序、运行时控件、独立导出视图、embed/Svelte 公共方法、创作入口 | PDF 编码库、真实 Relay/Java/DS 部署、Git 发布 |

## 视觉基线来源

| 项 | 内容 |
| --- | --- |
| 基线档位 | text_spec |
| 视觉来源 | 已批准计划的 C 工具带及四种日期选择；原型截图作为位置参考，不承诺像素复刻 |
| 区块 | 封面上方工具带、当前期间、完整静态导出 |
| 必测交互状态 | 初次创作无筛选、提取确认、合法范围、非法草稿、完整导出与失败清理 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-1 | AC-1 日期工具带 | S3_STORY | test_case | 工具带在封面上方，宽容器右对齐，窄容器换行，标题不被日期挤压 |
| AT-2 | AC-2 日期语义 | S1_COMPONENT | test_case | 四种形态、公历校验、完整输入才提交；参数不随筛选改变 |
| AT-3 | AC-3 提取联动 | S3_STORY | test_case | 无参数创作；确认同时生成 times/filter/binding/header 引用，复用已有身份，原值查询等价 |
| AT-4 | AC-4 完整导出 | S3_STORY | test_case | 全分区、全部 Tabs、完整筛选行集、静态图表、无日期控件和详情浮层 |
| AT-5 | AC-5 实例 API | S3_STORY | test_case | Svelte/embed 共享实例方法，回调期间 target 有效，成功失败取消均清理，固定行数和准备超时 |
| AT-6 | AC-6 创作入口 | S3_STORY | test_case | AI/人工入口共用协议，绑定引用增删改原子化，生成契约与 Bundle 自洽 |

## Tasks

### Task 1: 页面协议与日期参数提取 [用例: AT-2, AT-3]

**形态:** 逻辑

**Files:** packages/page/src、packages/page/tests、packages/engine/runtime/src/page-params.ts、packages/engine/runtime/src/filter-state.ts、packages/engine/runtime/src/orchestrator.ts。

- [x] Step 1: 验证旧控件半范围草稿与提取缺口；已批准计划记录起点事实
- [x] Step 2: 实现版本门禁、四形态、可信身份和原子提取
- [x] Step 3: 完成测试并回填证据

### Task 2: 日期工具带与完整静态导出 [用例: AT-1, AT-4, AT-5]

**形态:** 逻辑

**Files:** packages/engine/runtime-ui/src、packages/engine/runtime/src/export-snapshots.ts、packages/engine/widgets/src/shared/EChart.svelte、packages/embed/src、apps/playground/src/lib/ReportDateExample.svelte。

- [x] Step 1: 从源码验证现有仅活动页签/当前分页和无公共导出能力
- [x] Step 2: 共享组件渲染与实例公共方法；固定 10000 行/60 秒准备边界
- [x] Step 3: 浏览器交互、截图和 API 生命周期验证

### Task 3: 创作工具与契约交付 [用例: AT-6]

**形态:** 逻辑

**Files:** apps/platform/src/lib/workbench、metriccanvas-authoring/tool、metriccanvas-authoring/contracts/authored、docs/page-metadata、tools/scripts/export-authoring-contracts.ts。

- [x] Step 1: 确认 compose/edit/属性编辑入口缺口
- [x] Step 2: 日期增删改、位置引用、可信提取摘要和人工配置
- [x] Step 3: Python/TS 一致性、生成契约、Bundle、类型与构建检查

## 风险与回滚

| 风险 | 缓解 | 回滚 |
| --- | --- | --- |
| 初始快照部分数据导致导出不完整 | 同一网关重取冻结筛选作用域，分页总数校验，拒绝超限/缺失/变化 | 撤回新公共方法及可选 6.13 能力；已有版本继续读取 |
| 混合工作区 | 保留起点无关修改；不提交或发布本轮内容 | 按本轮文件和增量撤销，不重置工作区 |
| 数据跨页版本变化 | 检查总数；不宣称数据库快照隔离 | 暴露显式准备错误，由集成应用决定重试 |

## 收口

2026-10-11 批准范围已实施并完成本地验证；见 [验收记录](acceptance.md)。集成应用编码、真实服务与生产部署按原定边界另行接入，未以本地替身证据宣称完成。

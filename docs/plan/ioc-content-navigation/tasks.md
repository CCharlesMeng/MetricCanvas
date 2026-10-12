# MetricCanvas / IOC 内容切换与锚点 — 单仓实现计划

**Goal:** 页面在同一页面实例内切换成组内容分区并定位章节，保留各表局部状态。

**关键结构决策:** 顶层可选 sectionGroups 引用既有 sections；sectionAnchors 只定位既有 sections；不嵌套页面、不改变查询协议，状态由 RuntimeSurface 的页面实例持有。

**TaskPacket:** project=DataDashboard | codespec_path=docs/plan/2026-09-23-ioc-full-page-capability-gap.md | story=ioc-content-navigation | verification_schema=v2 | test_framework=vitest | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=playwright | search_paths=packages/page,packages/engine/runtime-ui,apps/playground | project_type=frontend | frontend_design_path=docs/plan/ioc-content-navigation/story-delta-frontend-design.md | baseline_source=text_spec | prototype_dir= | reference_route= | affected_routes=/pages/ioc-content-navigation | required_states=selected,focus,overflow,large-list | restore_tasks= | risk_triggers=async-state,new-pattern

## 项目边界

| 范围内 | 范围外 |
|---|---|
| 文字规格中的组切换、锚点与状态保持，开发样例浏览器验收 | 旧站像素/图片还原、业务字段猜测、真实数据、创作侧 |

## 页面、路由与组件层级

| 路由 | 页面 / 入口 | 本 Story 的变化 |
|---|---|---|
| /pages/ioc-content-navigation | 页面试验场样例 | 使用同一 RuntimeSurface/RuntimeSection/ComponentRenderer |

## 模块与文件

| 文件 | 类型 | 新建/修改 | 职责与对外导出 | 复用的既有资产 | Task |
|---|---|---|---|---|---|
| packages/page/src/page.ts | 类型 | 修改 | 分区组和锚点声明 | PageSection | T1 |
| packages/page/src/schema/page.ts | 协议 | 修改 | 严格可选声明 | sectionZ | T1 |
| packages/page/src/validate.ts | 校验 | 修改 | 引用有效、无重复、默认组有效 | invariantErrors | T1 |
| packages/page/src/version.ts | 版本 | 修改 | 6.12能力下限 | pageCapabilities | T1 |
| packages/page/tests/section-navigation.test.ts | 测试 | 新建 | 协议正负用例 | validate | T1 |
| packages/engine/runtime-ui/src/section-navigation.ts | 逻辑 | 新建 | 可见分区与定位组 | PageSection | T2 |
| packages/engine/runtime-ui/src/RuntimeSurface.svelte | 渲染 | 修改 | 页实例状态、控制按钮、章节定位 | RuntimeSection | T2 |
| packages/engine/runtime-ui/tests/section-navigation.test.ts | 测试 | 新建 | 状态选择与分区引用 | vitest | T2 |
| pages/ioc-content-navigation.json | 样例 | 新建 | 匿名功能验收页，不冒充来源业务页 | 既有表格组件 | T3 |
| packages/embed/tests/browser/section-navigation.spec.ts | 浏览器测试 | 新建 | 切组、状态、定位及窄屏不破 | 现有浏览器测试设施 | T3 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
|---|---|---|---|---|
| AT-01 | 不存在/重复分区引用拒绝 | S1_COMPONENT | test_case | T1 |
| AT-02 | 切组只显示所选内容，回切保留页码和排序 | S2_PAGE | test_case | T2,T3 |
| AT-03 | 全页搜索变化重置隐藏组受影响表页码 | S2_PAGE | test_case | T2,T3 |
| AT-04 | 锚点定位分区且不增加查询 | S2_PAGE | test_case | T2,T3 |

## Task List

### Task 1: 分区导航协议 [用例: AT-01]
**形态:** 逻辑
- [x] 编写协议正负用例
- [x] 实现可选声明与引用校验
- [x] 记录确定性证据

### Task 2: 页面实例内切换 [用例: AT-02,AT-03,AT-04]
**形态:** 逻辑
- [x] 实现可见性与定位组的确定性逻辑
- [x] 接入既有渲染树与页实例状态
- [x] 记录状态测试证据

### Task 3: 样例与页面验收 [用例: AT-02,AT-03,AT-04]
**形态:** 逻辑
- [x] 创建匿名样例和浏览器场景
- [x] 检查状态、查询次数与窄屏不破
- [x] 回填证据账本

以上勾选表示实现及所列功能取证已执行，不表示整体IOC业务页面或完整SDD因果证据闭环已完成。历史RED/GREEN证据没有补造，正式状态以证据账本和审阅汇总为准。

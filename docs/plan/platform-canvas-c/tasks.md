# Platform 搭建画布 C 方案

**Goal:** 落实用户确认的 C：属性面板去除摘要卡，选中组件旁提供上下移动和删除，选框采用蓝色渐变细描边；保持拖拽、撤销、显式保存和正式渲染边界。

**TaskPacket:** project=DataDashboard | project_type=frontend | story=US20261019 | codespec_path=docs/plan/platform-canvas-c | verification_schema=v2 | search_paths=apps/platform/src/lib,packages/metric-canvas,apps/platform/tests/workbench,pages,docs/page-metadata,metriccanvas-authoring,contracts | test_framework=vitest | component_test_status=available | component_test_framework=vitest | browser_test_status=available | browser_test_framework=playwright | frontend_design_path=docs/plan/platform-canvas-c/story-delta-frontend-design.md | baseline_source=prototype | prototype_dir=docs/plan/platform-canvas-c/evidence/design-source | reference_route= | affected_routes=/dialogue,/ | required_states=selected,hover,focus,disabled,overflow,empty | restore_tasks=T1 | risk_triggers=visual,interaction,shared-boundary

## 审批与边界

用户依次确认 C 的结构、蓝色略带渐变的选框，并明确“可以，开始实施”。沿用这些已确认基线，不重复请求授权。原工作区混合改动不属于本次；本工作树第一阶段变更均来自本会话，起点为 7ec7bb855273d76e54034104a88585f2953a5420 加本会话已记录的第一阶段 diff。正式实现不导入原型。

## 模块与文件

| 文件 | 职责 | Task |
| --- | --- | --- |
| apps/platform/src/lib/workbench/Inspector.svelte | 无摘要卡的属性入口与返回组件清单 | T1 |
| apps/platform/src/lib/PageAuthoringWorkbench.svelte | 移除侧栏移动/删除接线，沿用意图与撤销保存 | T2 |
| packages/metric-canvas/src/MetricCanvas.svelte | 创作装饰样式独立于页面内容主题，蓝色渐变边框 | T1 |
| packages/metric-canvas/src/AuthoringSection.svelte | 选择目标登记和就地操作意图 | T2 |
| packages/metric-canvas/src/CanvasSelectionActions.svelte | 可访问的选中操作条，不持有文档 | T2 |
| packages/metric-canvas/src/selection-actions.ts | 跟随、滚动裁切和清理 | T2 |
| packages/metric-canvas/tests/browser/metric-canvas.spec.ts | 蓝框、操作、模式状态及定位回归 | T3 |
| apps/platform/tests/workbench/canvas-experience-browser.mjs | 实际页面、显式保存与撤销路径 | T3 |
| pages/platform-canvas-experience.json | 直接消费的完整静态场景 | T3 |
| pages/README.md, PAGE-METADATA.md, docs/page-metadata/sections-and-layout.md | 行为与入口说明 | T3 |
| contracts/metriccanvas/**, metriccanvas-authoring/** | 产品真源导出更新，独立校验 | T3 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-01 | C 侧栏无摘要卡/重复标题/移动删除按钮；仅类型与返回清单 | S2_PAGE | restore_contract | T1 |
| AT-02 | 选框蓝色渐变细线，圆角与原型一致，叠层不拦截点击 | S1_COMPONENT | restore_contract | T1 |
| AT-03 | 上下移边界、删除、撤销和显式保存仍生效，输入 Delete 不删除组件 | S2_PAGE | test_case | T2,T3 |
| AT-04 | 就地操作条跟随选择、尺寸与滚动，隐藏目标时隐藏；停止编辑无操作条 | S1_COMPONENT | test_case | T2,T3 |
| AT-05 | 正式渲染无创作装饰，选择/模式切换不重置查询与分页 | S1_COMPONENT | test_case | T3 |

## Task List

### Task T1: C 静态结构与选中样式 [用例: AT-01,AT-02]
**形态:** 还原；区块：组件属性入口、搭建画布选中边界；基线为用户确认的 C 渲染快照与确定性抽取结果。
- [x] 冻结结构与计算样式并留存起点失败
- [x] 实现去卡片属性入口及蓝色渐变选框
- [x] 回填同契约还原证据

### Task T2: 就地操作与生命周期 [用例: AT-03,AT-04]
**形态:** 逻辑；不新增页面协议、查询或持久化机制。
- [x] 实现选择目标、操作意图与定位边界
- [x] 移除侧栏重复操作，接入原有保存撤销
- [x] 验证滚动、禁用、卸载与输入隔离

### Task T3: 页面、分发与验收 [用例: AT-03,AT-04,AT-05]
**形态:** 逻辑/机械；复用现有页面场景和受控端口。
- [x] 扩展浏览器验收并完成构建/类型/相关测试
- [x] 同步页面说明、产品真源及创作 Skill
- [x] 独立检视、保存证据和收口

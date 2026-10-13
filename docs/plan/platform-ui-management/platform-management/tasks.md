# 平台管理 / 工具面 — 实施任务

来源：已确认页面管理设计、OS Theme 组件架构；工程状态逻辑由 W4/W5 计划约束。用户明确不需要逐阶段审批。

**TaskPacket:** project=DataDashboard | codespec_path=docs/plan/platform-ui-management | story=platform-management | verification_schema=v2 | test_framework=vitest | component_test_status=unavailable | component_test_framework=none | browser_test_status=available | browser_test_framework=playwright | search_paths=apps/platform | project_type=frontend | frontend_design_path=docs/plan/2026-10-12-platform-page-management-design.md | baseline_source=text_spec | prototype_dir= | reference_route= | affected_routes=/manage,/manage/pages/:pageId,/ | required_states=disabled,selected,empty,overflow | restore_tasks=3,4 | risk_triggers=visual,new-pattern,shared-boundary,interaction,async-state,write

| Task | 目标 | Files | 用例 |
| --- | --- | --- | --- |
| 1 | 实例工作会话、显式保存及 format 3 | integration/services.ts、workbench/work-session.ts、authoring-coordinator.ts、authoring-sync.ts、authoring-storage.ts、authoring-recovery.ts、测试 | AT-PLAT-1 |
| 2 | 恢复任务和目录导航、阅读模式 | PlatformRoot.svelte、PlatformFrame.svelte、integration/navigation.ts、PageAuthoringWorkbench.svelte | AT-PLAT-2 |
| 3 | 管理 Grid、详情控件、受限服务能力 | views/ManagementList.svelte、ManagementDetail.svelte、page-assets/management.ts、page-assets.ts | AT-PLAT-3 |
| 4 | 检查器、日期配置、元数据 Dialog、页面标题 | workbench/Inspector.svelte、ComponentProperties.svelte、ReportDateProperties.svelte、MetadataJsonDrawer.svelte、document-edit.ts | AT-PLAT-4 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-PLAT-1 | 本地保护与明确保存 | S3_STORY | test_case | 1 |
| AT-PLAT-2 | 内部导航与阅读恢复 | S3_STORY | test_case | 2 |
| AT-PLAT-3 | 管理控件与能力边界 | S3_STORY | test_case | 3 |
| AT-PLAT-4 | 工具面与页面标题 | S3_STORY | test_case | 4 |

回滚保留新格式记录；旧客户端不能解析 format 3，禁止覆盖未知记录。不得以 stash pop 覆盖本批实施文件。

## 实施状态

四个 Task 的代码与本地证据已完成。默认创作入口仅展示空工作台；明确新建才生成可恢复的临时任务。阅读不会创建修订，管理返回在异步目录加载后恢复滚动与焦点。清洁任务重新进入时刷新当前基线，脏稿及未知结果保持保护。

真实 Java/Relay/身份/门户及高级生命周期能力按 alpha-tests.md 的 Deferred 条件等待提供方，不将 HTTP fixture 当作真实接缝验收。

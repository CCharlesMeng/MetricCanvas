# IOC 页头 B0+B1 执行清单

唯一主计划：[§17](../../plan/2026-10-16-ioc-header-feature-plan.md#17-2026-10-19组件元数据与interface审查稿)。本文件仅是该批次的执行账本，不另行设计。

## TaskPacket

**TaskPacket:** project=MetricCanvas | project_type=frontend | story=US1 | verification_schema=v2 | search_paths=packages/page,packages/engine,packages/embed,apps/playground,pages,docs/page-metadata,metriccanvas-authoring,tools/scripts,tools/package-build,tests | baseline_source=text_spec | restore_tasks=T3 | risk_triggers=visual,interaction,shared-boundary,navigation,async-state | component_test_status=available | component_test_framework=Vitest | browser_test_status=available | browser_test_framework=Playwright

## Goal

按已批准§17先交付共用状态安全与最小 IOC 页头，普通看板、密集看板、详情报表直接消费同一协议。不迁移现有业务页，不启用可选动作。

## 用例追溯

| AT | 需求 | 验证范围 | 验证方法 |
| --- | --- | --- | --- |
| AT01 | 整组校验、递归清理、所有写入同入口 | S1_COMPONENT | test_case |
| AT02 | 候选隔离、迟到回执、受影响查询门禁 | S2_PAGE | test_case |
| AT03 | 根声明、身份引用、排重与版本拒绝 | S1_COMPONENT | test_case |
| AT04 | 自然回流、首行折叠、键盘隐藏、文字视觉规格 | S2_PAGE | restore_contract |
| AT05 | 年季月锚点、独立详情单月、无来源无返回 | S3_STORY | test_case |
| AT06 | 三种pages、静态呈现、authoring独立分发 | S3_STORY | test_case |

## Tasks

- [x] T1 共用协调与合法性门禁。位置：runtime/src/filter-state.ts、orchestrator.ts；Interface遵循§17.6；保留旧读写签名。断言全组拒绝与递归清理，接入所有入口后记账。
- [x] T2 候选请求身份。位置：runtime/src/dimension-values.ts、runtime-ui/src/filters/FilterBar.svelte、cascade.ts；按控件、层级、完整约束隔离，成功/失败检查代次。断言旧回执与并列控件隔离后记账。
- [x] T3 根级IOC身份与筛选呈现（还原）。位置：page/src/schema/ioc-header.ts、ioc-header.ts、runtime-ui/src/ioc-header/{IocHeader.svelte,model.ts}。新建模块免RED；实现主计划§6与§17.2后浏览器测量及记账。
- [x] T4 入口接线与时间行为。位置：RuntimeSurface.svelte、PeriodFilter.svelte、types.ts、EmbedRoot.svelte及Playground来源输入。年季月与详情单月保持独立、返回仅合法来源；完成断言后记账。
- [x] T5 页面与安装消费者。位置：pages/ioc-header-*-demo.json、page-catalog.json、authoring导出及compatibility夹具闭包。页面直接消费协议并验证声明绑定，生成安装包后记账。

必要扩散到版本、文本遍历、静态呈现、文档与生成物记入alpha-tests；不扩展B2–B6。

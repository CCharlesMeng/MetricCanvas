# IOC公共页头B3金额货币

唯一主计划：docs/plan/2026-10-16-ioc-header-feature-plan.md §17.5及§17.10。用户在确认剩余批次后明确继续实施，承接下一批B3。基线是同一隔离工作树的未提交6.33状态，见evidence/start-manifest.json；不覆盖原工作区并行修改，不提交推送。

**TaskPacket:** project=MetricCanvas | project_type=frontend | story=IOC-B3 | verification_schema=v2 | search_paths=packages/page,packages/data-execution,packages/engine,packages/ui,packages/embed,pages,metriccanvas-authoring | baseline_source=text_spec | restore_tasks=T3 | risk_triggers=visual,interaction,shared-boundary,async-state | component_test_status=available | component_test_framework=Vitest | browser_test_status=available | browser_test_framework=Playwright

## 用例追溯

| AT | 需求 | 验证范围 | 验证方法 |
| --- | --- | --- | --- |
| AT31 | USD静态money与字段选择穷尽/只限required单选枚举、所有叶子契约校验及版本能力 | S1_COMPONENT | test_case |
| AT32 | 范围约束/显示单位/预设/换算溢出、URL及共用状态入口整组拒绝 | S2_PAGE | test_case |
| AT33 | metricByFilter与对应单位/币种契约，换币清金额一次提交且显式确认后取数 | S2_PAGE | test_case |
| AT34 | 字段、格式、标题/单位投影、图表/表格/计算输入保持静态货币契约；冻结导出case | S2_PAGE | test_case |
| AT35 | 实际金额验收页，草稿/取消/全部/单边/严格双边及窄屏、XLSX/静态视图 | S3_STORY | test_case |
| AT36 | 文档/能力/受控authoring和Skill、Bundle、仓外安装闭合 | S3_STORY | test_case |

- [x] T1 协议、USD与静态字段选择、全部分支验证及统一投影。
- [x] T2 范围约束、受控比例、预设、metric选择与共用状态/执行门禁。
- [x] T3 金额草稿面板和旧筛选适配，单位与已应用值呈现。
- [x] T4 实际pages验收、浏览器/导出、文档与authoring分发。

B4–B6和待审Condition/displayInputs保持原规划。没有真实USD字段/汇率证据，不声称生产换币验收；本批本地合成双静态货币字段不做前端汇率换算。

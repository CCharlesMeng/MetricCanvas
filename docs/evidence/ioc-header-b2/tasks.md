# IOC公共页头B2业务筛选

唯一主计划：docs/plan/2026-10-16-ioc-header-feature-plan.md §17.4/17.6/17.7。用户认可B0+B1后要求继续推进，下一批按B2执行。B0+B1未提交状态按start-manifest.json冻结为前置，不覆盖并行原工作区。

**TaskPacket:** project=MetricCanvas | project_type=frontend | story=IOC-B2 | verification_schema=v2 | search_paths=packages/page,packages/data-execution,packages/engine,packages/ui,packages/embed,pages,metriccanvas-authoring | baseline_source=text_spec | restore_tasks=T3 | risk_triggers=visual,interaction,shared-boundary,async-state | component_test_status=available | component_test_framework=Vitest | browser_test_status=available | browser_test_framework=Playwright

## 用例追溯

| AT | 需求 | 验证范围 | 验证方法 |
| --- | --- | --- | --- |
| AT21 | 单多选/required/封闭枚举及全选不限的真实谓词语义；非法整组拒绝 | S1_COMPONENT | test_case |
| AT22 | 新旧依赖合图，clear及可信intersection，清空不自动全量执行 | S2_PAGE | test_case |
| AT23 | 显式结构树level/parent、切层清值、旧斜杠树保持 | S2_PAGE | test_case |
| AT24 | V2时间/维度请求身份，拒绝旧回执；denied/unconfigured和能力缺席 | S2_PAGE | test_case |
| AT25 | ordinary/detail实际声明页面、筛选hint、静态呈现及UI键盘/窄屏 | S3_STORY | test_case |
| AT26 | 协议/文档/受控创作编辑/Bundle和安装消费者闭合 | S3_STORY | test_case |

- [x] T1 Page元数据、领域语义、依赖图、版本与查询编译。
- [x] T2 共用V2候选/协调、整组selection校验及clear/intersection。
- [x] T3 中立MultiSelect/TreeSelect与旧筛选适配，hint与新状态。
- [x] T4 验收页面、浏览器、静态呈现、文档与authoring分发。

B2不实现仍待审的Condition/displayInputs；不增加独立IOC规则解释器。复杂时间、可信latest及calendarWindow留B4；币种金额留B3；不默认可选操作，不迁移业务页，不提交推送。

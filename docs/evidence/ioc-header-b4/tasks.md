# IOC公共页头B4复杂时间与候选

唯一主计划：docs/plan/2026-10-16-ioc-header-feature-plan.md §17.4–17.7、§17.10。用户本轮明确“B4继续推进”，承接同一隔离工作树未提交6.34产物；起点文件哈希与备份见evidence/start-manifest.json。原工作区并行内容保护，不提交推送；不迁移业务页，不启用B5/B6或待审Condition。

**TaskPacket:** project=MetricCanvas | project_type=frontend | story=IOC-B4 | verification_schema=v2 | search_paths=packages/page,packages/data-execution,packages/engine,packages/ui,packages/embed,pages,metriccanvas-authoring | baseline_source=text_spec | restore_tasks=T3 | risk_triggers=visual,interaction,shared-boundary,async-state | component_test_status=available | component_test_framework=Vitest | browser_test_status=available | browser_test_framework=Playwright

## 用例追溯

| AT | 需求 | 验证范围 | 验证方法 |
| --- | --- | --- | --- |
| AT41 | day/month/ISO周日历、模式默认与URL整组原子校验；保留详情单月、年季月和旧datetime | S1_COMPONENT | test_case |
| AT42 | query.timeModes互斥完整静态case、输出同契约、SourceProgram/Relay/initial/去重/导出选择一致 | S2_PAGE | test_case |
| AT43 | timeRange.presets与同次时钟，含锚点近N天、完整月，不用固定天数代月 | S2_PAGE | test_case |
| AT44 | 可信DataPeriodFact具名输入、latest/latestComplete、initial/max分开、合法URL优先、失败关闭与事实修订 | S2_PAGE | test_case |
| AT45 | candidateWindow/V2完整规范化请求、真实年月离散集合、模型时间交集和迟到/失败隔离 | S2_PAGE | test_case |
| AT46 | DatePicker max/blockedRanges、ISO周与模式控件、缺能力/只读/窄屏及已应用事实显示 | S3_STORY | test_case |
| AT47 | 实际日期/模式/月份/模型验收页与查询、XLSX/静态呈现及原期间回归 | S3_STORY | test_case |
| AT48 | 下一版本6.35能力、文档/正反契约、受控authoring重开、独立Skill/Bundle/仓外消费者 | S3_STORY | test_case |

- [x] T1 复杂时间/候选/可信期间事实的协议及纯日历Module，当前下一minor6.35。
- [x] T2 所有状态/查询/候选/初始化/去重/Relay与导出消费统一语义。
- [x] T3 中立日期/周控件与引擎模式/预设/可信事实适配。
- [x] T4 实际验收pages、文档、受控创作、分发与独立安装闭环。

预计源文件范围：page的filter/query/schema/validation/version/时间日历与纯投影；data-execution的filter-values/effective-query/candidate接口与SourceProgram/execute；engine的状态/候选/编排与RuntimeSurface/FilterBar/ExportView；ui DatePicker与周控件；embed挂载输入；实际pages及测试；文档/authoring/受控编辑/生成与安装闭包。具体连带路径按同一Story扩散登记，不扩展业务需求。

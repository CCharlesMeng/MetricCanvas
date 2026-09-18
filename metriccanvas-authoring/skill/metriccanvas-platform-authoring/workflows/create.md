# 创建页面

1. 采用可信 new 上下文及用户选择的 layout。读取该布局参考、[场景与结构](../references/scenarios.md)及[阅读层级与表达](../references/reading-design.md)，只加载相关场景参考。
2. 发现相关业务域，按 business_domain 有界枚举指标、维度、取值与 metricRelations。分页沿用 dataContextVersion；独立发现可同批调用。范围缺口须说明。
3. 按工具公布的能力选择版本，新建推荐 version="3"。一次提交完整 request.plan，并提供创建入口的 title。入口自动创建页头，`header` 分区与 `page-header` 组件 ID 由程序保留；plan.sections 只声明业务章节，不重复创建页头。提交前按实际 Schema 核对 dataRequests 数量上限。先确定问题与阅读层级，再选组件和呈现，最后安排宽度/容器。这是一次计划的内部顺序，不分成多个模型往返。
4. 按对象组成指标卡，以 presentation 的 metric-summary 选择主值行及可信 changes。辅助变化只引用发现返回的 evidenceRef；无关系证据就独立展示或说明缺口。工具选择既有样式、匹配行、格式并校验。
5. 阅读 modelSummary：issues 是需处理的问题；appliedAdjustments 是已执行的确定性呈现规则；overlapFindings 只表示同查询/字段/选择范围，不表示内容无用。图表与核对表有不同用途可共存，由你说明用途或决定删减。部分失败按稳定 ID 局部修订。
6. 成功候选直接交接，不例行回读整页。只有需要了解的特定配置才使用 read_page_context 的投影/分页。v2/v3 同轮修订用 edit_page 的 structureRevision，带 candidate_ref、原 planVersion、parentVersion；原 operations 与 compose_page 继续用于其兼容场景。

普通正文用 text，写用途、局限和已有可信事实。数字行不进入模型通道；不要从元数据编造数值分析。只有明确要求运行时流式摘要且部署能力齐备才用 aiSummary。产物成功不等于已保存或发布。

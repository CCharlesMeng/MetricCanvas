# 工具与部署约定

## 实际统一工具

服务名 metriccanvas-platform-content，CLI同名；部署用 list_tools 核实五工具。Bundle将统一Skill绑定到受门禁工厂；旧metriccanvas-content只服务兼容消费者，不能注册为统一入口或失败降级。

| 工具 | 输入 | 结果/职责 |
|---|---|---|
| read_page_context | context_ref, 可选candidate_ref/target_component_id/use_selection/offset/limit/cursor | 根基线或指定候选的有界结构/配置、明确view与补读cursor |
| discover_data_context | context_ref, 可选 query/business_domain/offset/limit/data_context_version | 按词发现，或按精确业务域枚举；翻页带首轮版本，range 声明覆盖范围 |
| compose_page | context_ref, spec, layout | new上下文的取数装配候选 |
| create_content_page | context_ref, title, request.plan 或 request.operations, layout | 显式业务章节计划或兼容操作数组；自动reportHeader，两种输入互斥 |
| edit_page | context_ref, request, 可选candidate_ref | 根基线或同轮候选上的受控operations及逐项结果 |

每个调用都核对可信current-turn端口的身份、请求/运行/轮次、页、ref/hash、能力版本和active状态；access=read只能读取/发现，不能生成内容。模型不传page_id、baseline_token或source_token。身份与完整文档不由模型提供，旧引用不能变成新轮次。

spec为Page Build Spec：question、可选description、dataContextVersion、units；单元为稳定dataSourceId及受治理businessDomain/metrics/groupBy/filters/time/intent，以实际输入Schema为准。歧义先消解；页面JSON、DQE和rows不属于输入。

完整报告的 request.plan 输入及两个首期场景见[场景与结构](scenarios.md)。数据需求与展示意图分开，一源可多次绑定，章节由显式计划保持。登记组合是默认占位，custom 仍经过相同硬校验。旧 spec 和 operations 保持兼容。

发现返回 structureVersions、structureCapabilities、coverage 与 metricRelations（known/unknown/unavailable）。能力摘要从当前计划契约与已实现呈现族派生，详细输入以工具 Schema 为准。支持时新报告选 v3，一次提交业务大纲、块用途和呈现选择；指标组合仍核对可信关系及对象/期间。成功摘要含 appliedAdjustments、overlapFindings、queryCounts；完整查询缓存和计划留在程序审计。v2/v3 结构修订绑定父候选版本，无需新增预检工具。

受控add recipe含text、fieldText、mapChart、tabContainer、compositeCard、aiSummary。create_content_page也接受add_data_component及set_component_layout/move_component，一次组合图表、正文和显式顺序/span；目标为main，自动page-header受保护。new为空基线，字段依赖必须是有效已知引用，不能猜字段ID；无法在同批确定时，先生成数据候选，再用edit_page续写。existing使用add_data_component新增单个取数单元与图表：提供id、sectionId、componentId及单单元spec，可选position/dependsOn。程序验证受治理源描述、真实输出列、稳定字段身份、类型与刻度，再原子合并查询源和组件；同ID源仅在查询和字段完全一致时复用，冲突拒绝。未涉及内容和布局保留。查询分页、排序和表头筛选未开放。

## 加载与通道

安装整个Skill目录。启动注入SKILL.md和本文件、五工具实际Schema及可信contextRef；工作流/布局/错误/例子按入口指示注入，或明确提供真实文件读取能力。完整页面创建还须注入 scenarios.md、reading-design.md 及相关场景；重组既有页时按需注入 reading-design.md。无文件读取的部署不能只给链接。完整协议由工具/校验器消费，不要求模型从源码仓加载。

程序先锁新人工输入、flush已有输入、同步，再通过明确支持latest的提供方读取并注册本轮完整快照。new由程序分配页面身份和空基线。当前真实提供方未接通时统一工厂返回CURRENT_TURN_UNAVAILABLE；兼容文件token不是补偿路径。

程序保留structuredContent.artifactEnvelope，只把modelSummary返回模型。read_page_context只回安全投影；省略不表示字段不存在，按nextCursor在同修订补读，未知扩展仅无损保留于程序基线。缺摘要分流Adapter时停止内容调用。

候选引用绑定最初身份/轮次/页/根基线；每次续写产生不可变子候选，同轮分支以candidateRef区分。read_page_context显式指定candidate_ref才读候选；root与candidate补读cursor不混用。完整候选留在artifactEnvelope程序通道。可信程序只提交选定的最终候选，先冻结操作及载荷，再由生命周期单次提交并验证成功回执；全失败、无变化或最终回到原内容不新建修订。可信恢复保留原操作与载荷；取消、预算耗尽或预览失败不新建写入。当前 Java 不提供幂等查询和历史精确读取；结果未知时停止，查询只能核对程序已有记录。部署侧须接入可信轮次与回执交接，不允许模型自行调用 HTTP 或重复提交。

统一数据装配必须取得与当前数据上下文版本及查询一致的可信源描述；缺失或不一致时停止，不猜字段ID或输出列。格式只消费已验证刻度：percent不能直接代替fraction转换，万元不能再次按元缩放。未支持的规则链或未解决差异拒绝整组；完整源证据只留在程序候选审计中。

新建字段 ID 由程序按数据源 ID 与查询列名生成可读名称，必要时以可信身份消歧；既有页面 ID 保持不变。模型继续使用工具实际返回的引用，不按命名形式自行推算字段 ID；字段 ID 与 queryField 的职责仍分开。

部署可通过可信装配器选择metriccanvas-platform-authoring或define-report作为单一注册名，均引用本目录与同一工具服务。可信装配器可选择已注册的数据、业务解释、组件选择策略和系统端口。业务解释只提出带来源且经治理校验的候选，歧义须消解；组件策略不能覆盖用户指定类型或开启未实现渲染器；系统端口继续使用同一提交/恢复状态机。部署manifest不能加载代码、覆盖核心字段或开启真实提供方能力。

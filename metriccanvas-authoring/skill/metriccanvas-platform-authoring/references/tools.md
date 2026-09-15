# 工具与部署约定

## 实际统一工具

服务名 metriccanvas-platform-content，CLI同名；部署用 list_tools 核实五工具。Bundle将统一Skill绑定到受门禁工厂；旧metriccanvas-content只服务兼容消费者，不能注册为统一入口或失败降级。

| 工具 | 输入 | 结果/职责 |
|---|---|---|
| read_page_context | context_ref, 可选candidate_ref/target_component_id/use_selection/offset/limit/cursor | 根基线或指定候选的有界结构/配置、明确view与补读cursor |
| discover_data_context | context_ref, query, limit | 新增/改变数据需求的受治理版本、业务域、匹配与歧义 |
| compose_page | context_ref, spec, layout | new上下文的取数装配候选 |
| create_content_page | context_ref, title, request, layout | new上下文的受控静态候选，自动reportHeader |
| edit_page | context_ref, request, 可选candidate_ref | 根基线或同轮候选上的受控operations及逐项结果 |

每个调用都核对可信current-turn端口的身份、请求/运行/轮次、页、ref/hash、能力版本和active状态；access=read只能读取/发现，不能生成内容。模型不传page_id、baseline_token或source_token。身份与完整文档不由模型提供，旧引用不能变成新轮次。

spec为Page Build Spec：question、可选description、dataContextVersion、units；单元为稳定dataSourceId及受治理businessDomain/metrics/groupBy/filters/time/intent，以实际输入Schema为准。歧义先消解；页面JSON、DQE和rows不属于输入。

受控add recipe含text、fieldText、mapChart、tabContainer、compositeCard、aiSummary；new为空基线；先compose_page得到数据候选，再用edit_page及candidate_ref添加依赖该候选现存数据源的内容。existing可按实际源和行证据新增受支持内容，但尚不能新增查询源或任意数据图表。查询分页、排序和表头筛选未开放。

## 加载与通道

安装整个Skill目录。启动注入SKILL.md和本文件、五工具实际Schema及可信contextRef；工作流/布局/错误/例子按入口指示注入，或明确提供真实文件读取能力。完整协议由工具/校验器消费，不要求模型从源码仓加载。

程序先锁新人工输入、flush已有输入、同步，再通过明确支持latest的提供方读取并注册本轮完整快照。new由程序分配页面身份和空基线。当前真实提供方未接通时统一工厂返回CURRENT_TURN_UNAVAILABLE；兼容文件token不是补偿路径。

程序保留structuredContent.artifactEnvelope，只把modelSummary返回模型。read_page_context只回安全投影；省略不表示字段不存在，按nextCursor在同修订补读，未知扩展仅无损保留于程序基线。缺摘要分流Adapter时停止内容调用。

候选引用绑定最初身份/轮次/页/根基线；每次续写产生不可变子候选，同轮分支以candidateRef区分。read_page_context显式指定candidate_ref才读候选；root与candidate补读cursor不混用。完整候选留在artifactEnvelope程序通道。可信程序只提交选定的最终候选，先冻结操作及载荷，再调用生命周期并精确回读；全失败、无变化或最终回到原内容不新建修订。可信恢复保留原操作与载荷；取消、预算耗尽或预览失败不新建写入。生产写路径仍关闭，真实持久/恢复提供方及工作台重启接线待验收。

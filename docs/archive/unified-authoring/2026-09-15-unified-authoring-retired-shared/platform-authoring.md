# Platform 内容编排共同约定

本文件由两个 Platform Skill 共用，安装时随各目录投影。普通问数 `metriccanvas-page-builder` 的临时页面态流程保持原边界；新 Skill 不接管问数入口。

## 可信上下文与路由

Relay 部署方注册两个 Skill 和 `metriccanvas-content`，按入口/新建意图路由；目录清单与 frontmatter 不是执行路由实现。完整文档、数据行、身份与保存命令由可信程序持有。模型只消费必要目标摘要、操作结果与引用；内容产物通过 structuredContent.artifactEnvelope 移交。缺少安全摘要过滤或可信基线通道时停在部署未就绪，不能通过模型文本转抄产物。

创建需要平台分配 page_id；修改需要绑定精确 ref/hash 的 baseline_token。token 不是页面ID或可自行拼接的路径。程序负责身份隔离、读取及不可变映射；读取失败先纠正上下文，保留原页。已有页追加内容仍使用修改路由；明确另建才创建。内容 MCP 不保存/发布，生命周期 MCP 独立，保存结果须经精确回执确认。

## 数据与操作

compose_page 接受 Page Build Spec：question、可选description、dataContextVersion、units；每个单元用稳定dataSourceId及受治理businessDomain/metrics/groupBy/filters/time/intent，具体字段以工具公布的输入 Schema 为准。复用 Agent Core 的稳定单元身份、候选消歧、意图与数据形状门禁；普通问数的单元多轮重装配不能代替已有页面局部编辑。发现结果缺能力时澄清/报告缺口，不能补造查询或数据。

create_content_page 仅六类 add recipe：text、fieldText、mapChart、tabContainer、compositeCard、aiSummary，自动生成 reportHeader。十类数据组件由 compose_page 构造或在编辑时受控类型转换；“17 类覆盖”不表示一个入口可直接新增全部类型或全部 Schema 分支。查询源缺 initial 行证据、未物化 compute、字段形状不符会拒绝内容装配。容器子类、地图地域、导航和筛选绑定均以工具输入与校验为准。

普通摘要用 text。aiSummary 仅显式要求运行时流式生成、prompt/relatedData 白名单齐备且部署方提供 AiSummaryConfig 时创建；配置检查不代表真实服务连通。标题含“AI”不会改变组件类型。查询分页、排序和表头筛选仍未开放。

独立操作允许部分成功；结构、绑定使用专用业务操作并保持依赖闭合。模型不可提交原始页面、rows、DQE 查询或任意JSON路径。无合法变更时不产生内容产物；工具返回 artifact 不等于已持久化。

## 布局查阅

创建或显式切换到报告时读 [report 基线](layouts/report.md)；创建或显式切换到看板时读 [dashboard 基线](layouts/dashboard.md)。普通编辑继承已有形态和未触及布局，不重套基线。两份基线描述默认策略，共同协议及校验仍为单一真源。

## 验证结论

公开工具测试证明确定性应用与产物，浏览器测试证明声明场景的呈现；两者不证明模型会选对 Skill 或命中目标。真实模型评测须记录模型版本/参数、Skill与Bundle版本、可信上下文、工具trace和结果差异。环境缺失明确记未运行，不能以 Markdown 关键词检查或固定模型回答计准确率。

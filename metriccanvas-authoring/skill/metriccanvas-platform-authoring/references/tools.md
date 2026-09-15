# 工具与部署约定

## 实际工具

内容服务名 metriccanvas-content。部署用 list_tools 核实以下四个工具；allowed-tools 和 Bundle registry 仅声明能力需求，不实现权限或对话路由。

| 工具 | 输入 | 结果/职责 |
|---|---|---|
| discover_data_context | query, limit（1–50，默认10） | 受治理的数据上下文版本、业务域、匹配、歧义和问题 |
| compose_page | page_id, spec, layout | 由取数单元执行 DQE、选择组件并创建页面产物 |
| create_content_page | page_id, title, request, layout, 可选 source_token | 在 main 分区从受控 add recipe 创建内容，自动 reportHeader |
| edit_page | baseline_token, request | 对可信完整基线应用 operations，返回合法变更产物及逐项结果 |

spec 为 Page Build Spec：question、可选 description、dataContextVersion、units；单元含稳定 dataSourceId 及受治理 businessDomain/metrics/groupBy/filters/time/intent，字段细节以工具输入 Schema 为准。候选歧义先消解；完整页面、DQE 和 rows 不属于模型输入。

create_content_page 的 add recipe 支持 text、fieldText、mapChart、tabContainer、compositeCard、aiSummary。十类数据组件由 compose_page 构造或在编辑中受控转换；“17 类组件”不意味着任意类型可直接新增。查询源缺 initial 行证据、compute 未物化或字段形状不符时会拒绝。查询分页、排序和表头筛选未开放。

baseline_token/source_token 由可信程序登记不可变页面、精确 ref/hash 及身份范围；不是 pageId 或模型可拼接的路径。当前 token 适配器不能证明 latest、跨轮同步或持久候选存储。

## 加载与通道

安装整个 Skill 目录。启动时注入 SKILL.md 和本文件，公布上述真实工具 Schema，以及本轮最小可信上下文；工作流/布局/错误/例子按入口指示注入，或明确提供真实文件读取能力。模型不能直接读取源码仓的契约快照；完整协议由工具和校验器消费。

程序保留 structuredContent.artifactEnvelope，只把 modelSummary 返回模型。回显摘要包括真实状态、影响和完整性信息；完整产物用于程序移交。缺少此 Adapter、可信基线或必要部署配置时停止相关操作，保留已有页。

无公开配置补读/latest 工具、候选链提交工具或本服务的保存/发布工具；集成程序提供这些能力前，不把文档约定当作已实现保证。

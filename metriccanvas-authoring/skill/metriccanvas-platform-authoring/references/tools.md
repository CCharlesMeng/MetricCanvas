# 工具与部署契约

本 Skill 只配 platformProtocolVersion=2.0 的 metriccanvas-platform-content。旧版本使用独立兼容 Skill/CLI，不能同轮失败后切换旧入口。

| 工具 | 输入与行为 |
|---|---|
| read_page_context | context_ref，必要目标/选择与分页；返回当前工作稿的配置投影及 workVersion，不刷新数据 |
| discover_data_context | context_ref、query、limit，可选精确 detail_refs；返回相关定义与缺口 |
| query_data | context_ref，加 request 或 result_ref 二选一。request 含 question、dataContextVersion、requests，可选补查 reason；返回范围、有界证据与 resultRef |
| compose_page | context_ref、request、expected_version。request 含 title、layout、sources、sections；新建合法页面并内部保存 |
| edit_page | context_ref、request.operations、expected_version；局部修改当前工作稿并内部保存 |
| page_metadata_emit_preview | context_ref、artifact_ref；准备该已保存产物的预览，不查数、不保存 |

所有写入基于程序注入的身份和基线。工作稿按版本竞争检查，提交 document/base/operationId 冻结。draftId 映射保存回执 ref.resourceId，ref.pageId/ref.revisionId 保持独立；不能互相替代。

只有 modelSummary 进入模型通道。query_data 的有界行证据需计划确认和模型数据策略授权；完整响应、SQL、查询体和页面产物不进入模型。document 保存查询定义而不带 query initial；previewJson 可带本次有效 initial。静态 inline 内容属于页面定义，照常保留。

工具列表、Schema、Skill、Bundle 版本一起切换。缺 current-turn、持久化工作存储、授权、源描述、保存服务或 Relay Adapter 时报告明确不可用。Relay 注入和卡片格式由部署适配器负责；工具 ready 不等于用户已看到页面。

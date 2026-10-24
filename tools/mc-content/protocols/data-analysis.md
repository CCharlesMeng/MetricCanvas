# 数据证据的技术约束

发现与查询字段见 [discovery-query](discovery-query.md)。规范业务域、指标和维度编码来自可信发现；身份和展示名称不互换。域级维度并集、检索未命中和 metricCompatibility=unknown 不能证明指标组合支持或不支持。

精确查询必须经可信程序授权，绑定身份、范围、requestSha256、dataContextVersion 和 modelEvidenceAllowed；模型不传 planConfirmed 自授权。calculate_conf 是已有派生定义，不由模型补公式；时间窗口不自动证明跨期可求和。实际查询保留原始范围、单位、粒度和查询/行关系。

完整性按结果与模型证据两层返回；缺失 totalCount 不证明全量；子集不能冒充整体排名/占比。未知单位保持原值，不凭标题猜尺度。精确 resultRef 只能在绑定作用域复用，不是永久数据资产。所有权限、业务结论、真实取数和覆盖仍以执行回执为准。

Skill 决定需求解释、计划展示/确认、补查、暂停依赖分支、章节组织及最终采用。本参考只提供 MC 事实与检查限制，不规定 Skill 流程或保存准入。

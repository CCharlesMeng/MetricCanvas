# Unified data mapping / 1.0

S5消费现有受控查询生成、页面装配与候选链，不修改普通问数/旧兼容默认行为。模型没有原始查询/rows/整页输入。source-description.schema.json与add-data-component.schema.json为新契约作者；原PageBuildSpec/旧编辑操作作者不复制。

## 可信来源描述

SourceDescriptionPort.describe(scope,data_context_version,effective_query)->dict在程序通道；scope为本轮完整trusted binding。querySha256是Python canonical_json({'language':effective_query['language'],'body':effective_query['body']})的SHA256，必须与实际执行body相同，不把展示字段映射当查询身份。dataContextVersion必须匹配已读取版本。descriptorRef/version与providerNamespace声明来源；不能从位置/标题构造业务真实ID。

每个field以semanticName匹配现有受控unit所选canonical queryField，必须一一对应；logicalId+projectionId由可信来源给出，投影身份区分时间粒度/聚合/计算语义。页面字段ID为'field-'+sha256(canonical_json([providerNamespace,logicalId,projectionId]))前20hex；标签、字段顺序与输出别名变化不改变它，重复身份拒绝。页面只写既有字段schema属性，来源描述留程序通道。真实queryField来自描述并经返回行的既有类型/nullable/mapping校验；空行依赖可信结构声明，不伪称行证明。

ComposePageDependencies追加可选source_description、authoring_scope、require_source_description=False；旧调用默认原行为。统一compose/add-data调用按本轮binding构造依赖并require_source_description=True；缺描述提供方在DQE前拒绝。先derive units，再逐unit describe和映射，随后原DQE/装配链。描述不得改变受控query body或偷偷增加字段；类型与原DataContext冲突拒绝（数值number可经明确CNY currency-base声明成为money）。

S5只接受无需数值转换、与既有运行时一致的映射。字段defaultFormat须为产品已支持preset；绑定format仍优先。percent-*直接加百分号，故仅scale=percent可默认使用；fraction→百分数需转换，明确UNSUPPORTED，不乘100一次后冒充刷新一致。compact-wan/yi、cny-adaptive只作用currency-base或明确普通未缩放数值，currency-wan不能再次套缩放格式。money要求CNY/currency-base。unknown刻度只保留未推断的普通显示；rules非空或unresolved非空一律明确阻塞，未验证规则/参数/顺序不声称exact。

## 公开新增数据纵切

统一edit的输入Schema由原编辑Schema加add-data-component操作Schema生成，旧内容工具Schema不变。add_data_component含单unit的受控spec（仍含question/dataContextVersion等原约束）、目标existing sectionId、稳定componentId、可选插入position与dependsOn。不接受原始query/rows/任意props。依赖先解析；该操作查询/字段/组件作为一个原子组，失败无部分数据源残留；独立成功和依赖跳过沿既有逐项结果。

共用已映射的compose链，取该unit生成的数据组件（排除reportHeader），要求恰好一个；保持当前页layout、所有既有组件和手工属性，不重新排版。数据源ID来自受控unit；与现有来源碰撞仅在原query和字段契约完全一致时复用，否则冲突拒绝，不覆盖旧源。新组件引用已闭合源。最终整页合法后产S3候选；字段ID由来源身份生成故相同来源复用保持绑定。缺来源身份的旧页不能凭中文标签宣称迁移等价。

共享调度器可消费混合普通操作和add_data_component，最多50项；先统一核对id/依赖，再正常操作调用既有领域编辑器，data操作await后复核当前turn。批次无变化/全失败不新建候选。compose_page和公开edit新增路径都必须覆盖，私有mapper测试不计纵切完成。内部协议解码器/真实刻度规则与S8生产验证仍blocked。

# Unified data mapping / 1.0

S5消费现有受控查询生成、页面装配与候选链，不修改普通问数/旧兼容默认行为。模型没有原始查询/rows/整页输入。source-description.schema.json与add-data-component.schema.json为新契约作者；原PageBuildSpec/旧编辑操作作者不复制。

## 可信来源描述

SourceDescriptionPort.describe(scope,data_context_version,effective_query)->dict在程序通道；scope为本轮完整trusted binding。querySha256是Python canonical_json({'language':effective_query['language'],'body':effective_query['body']})的SHA256，必须与实际执行body相同，不把展示字段映射当查询身份。dataContextVersion必须匹配已读取版本。descriptorRef/version与providerNamespace声明来源；不能从位置/标题构造业务真实ID。

每个field以semanticName匹配现有受控unit所选canonical queryField，必须一一对应；logicalId+projectionId由可信来源给出，投影身份区分时间粒度/聚合/计算语义，重复身份拒绝。

新建源的页面字段ID采用 `{dataSourceId}-field-{normalizedQueryField}`：ASCII 查询列名转小写、非字母数字段折叠为连字符。非 ASCII 列名不丢弃中文片段或猜译名，改用可信 logicalId；两者均无法提供可读 ASCII 标识时才用 `identity-` 加身份摘要。以数字开头的数据源 ID 额外加 `source-`，满足既有字段 ID 契约。规范化重名依次追加可信 logicalId、projectionId；仍冲突时才追加确定性 SHA-256 短摘要，并检查整个字段命名空间。不使用随机数。

这是新建命名策略，不是页面协议的硬格式。标签和字段顺序不影响分配；不同别名的新建源可能获得不同 ID。既有页面和结构候选编辑沿用原字段 ID，不因标签或别名变化自动迁移；当前接口不开放查询别名重写，也不新增迁移入口。计算产出字段没有 queryField，继续由既有计算契约显式命名，不从查询字段分配器生成。页面只写既有字段schema属性，来源描述留程序通道。真实queryField来自描述并经返回行的既有类型/nullable/mapping校验；空行依赖可信结构声明，不伪称行证明。

ComposePageDependencies追加可选source_description、authoring_scope、require_source_description=False；旧调用默认原行为。统一compose/add-data调用按本轮binding构造依赖并require_source_description=True；缺描述提供方在DQE前拒绝。先derive units，再逐unit describe和映射，随后原DQE/装配链。描述不得改变受控query body或偷偷增加字段；类型与原DataContext冲突拒绝（数值number可经明确CNY currency-base声明成为money）。

S5只接受无需数值转换、与既有运行时一致的映射。字段defaultFormat须为产品已支持preset；绑定format仍优先。percent-*直接加百分号，故仅scale=percent可默认使用；fraction→百分数需转换，明确UNSUPPORTED，不乘100一次后冒充刷新一致。compact-wan/yi、cny-adaptive只作用currency-base或明确普通未缩放数值，currency-wan不能再次套缩放格式。money要求CNY/currency-base。unknown刻度只保留未推断的普通显示；rules非空或unresolved非空一律明确阻塞，未验证规则/参数/顺序不声称exact。

## 公开新增数据纵切

统一edit的输入Schema由原编辑Schema加add-data-component操作Schema生成，旧内容工具Schema不变。add_data_component含单unit的受控spec（仍含question/dataContextVersion等原约束）、目标existing sectionId、稳定componentId、可选插入position与dependsOn。不接受原始query/rows/任意props。依赖先解析；该操作查询/字段/组件作为一个原子组，失败无部分数据源残留；独立成功和依赖跳过沿既有逐项结果。

共用已映射的compose链，取该unit生成的数据组件（排除reportHeader），要求恰好一个；保持当前页layout、所有既有组件和手工属性，不重新排版。数据源ID来自受控unit；与现有来源碰撞仅在原query和字段契约完全一致时复用，否则冲突拒绝，不覆盖旧源。新组件引用已闭合源。最终整页合法后产S3候选；同名来源只有查询与含字段 ID 的完整契约一致才复用。旧哈希 ID 与新可读 ID 不做隐式等价迁移，不能凭中文标签宣称迁移等价。

共享调度器可消费混合普通操作和add_data_component，最多50项；先统一核对id/依赖，再正常操作调用既有领域编辑器，data操作await后复核当前turn。批次无变化/全失败不新建候选。compose_page和公开edit新增路径都必须覆盖，私有mapper测试不计纵切完成。内部协议解码器/真实刻度规则与S8生产验证仍blocked。

已验证来源描述须保留程序审计：PageBuildArtifact可选sourceDescriptions含本次完整描述；无描述的旧默认产物不增加字段。统一候选记录的operations除原请求外追加type=source_description_evidence、descriptors数组的程序证据项；这是审计记录，不是可执行操作，绝不回灌编辑器或modelSummary。子候选通过不可变parentRef保留前序来源证据，后续新增数据另记本次描述，不改S3候选结构或版本。

描述中的真实queryField还须满足原DQE body已经声明的输出列/alias；单靠描述不能改变查询输出。现有普通单位未开放动态输出别名修改，额外alias若不在body里明确拒绝，不能以mapper通过代替公开查询能力。

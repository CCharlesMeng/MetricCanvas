# 查询结果与页面字段映射

平台现行 protocol 2.0 先通过 query_data 生成、执行并核对受控查询，再由 compose_page / edit_page 消费结果引用。完整页面、原始查询、凭据与未授权数据不能由模型提供；普通问数的 compose_page 继续只返回临时页面产物。

## 查询结果

query_data 对整个批次核对计划确认、模型证据许可、binding 与 dataContextVersion。查询来源由 source-description.schema.json 约束的可信提供方说明；缺失时拒绝，不能根据标签推断。结果记录按轮次持久化，重复请求复用已有结果，不因页面编辑重新执行 DQE。

字段 ID、查询字段及格式由受控查询派生。模型读取受限 fields/rows/coverage；完整数据源留在程序记录中。compose_page 的 sources 将页面数据源 ID 映射到精确 resultRef；edit_page 使用 add_result_component 原子新增数据源与组件。

## 指标关系

可选 MetricRelationsPort.resolve(binding, dataContextVersion, businessDomain) 提供可信元数据或明确记录的用户关系。结果必须匹配版本和业务域，引用唯一，字段与时间结构合法。QueryResults 进一步只保留本次执行中的度量字段、相同期间/粒度，以及返回对象范围内的匹配关系。

完整关系与查询结果一起冻结，记录 relations 与 relationStatus。模型通道将 primaryField/changeField/match.field 转换为同一查询证据的字段 ID；最多展示 20 项，并提供 relationCoverage；它们仍受整轮证据字节预算约束。关系不属于页面运行时协议，不写入页面文档。

模型用已展示的 evidenceRef 表达同比/环比。compose_page 与 add_result_component 仅消费该结果记录中的关系，不在装配时重读提供方，不合并其他结果、其他期间或其他轮次的关系。缺失关系、过期结果或伪造 evidenceRef 必须拒绝相应组件，不能从数值或名称推断。

## 迁移

旧 add_data_component（编辑时携带 spec 并执行查询）、unified_composition、structureRevision 编排及其专属契约已退役。当前使用 query_data → compose_page / add_result_component，以及工作稿 expected_version 控制的 set_section 等编辑操作。页面结构与字段规则仍为共享实现，保存属于平台单次草稿保存用例。

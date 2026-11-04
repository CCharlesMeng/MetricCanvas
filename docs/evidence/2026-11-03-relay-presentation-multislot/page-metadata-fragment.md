# 待主控合并的独立语义片段

PageDocument 字段净增减 0。既有表格 `data`、`rowKey`、按槽字段绑定和完整查询继续承担运行语义；多槽受控入口只是把显式结果证据装配成该声明，不生成第二份本地 join 行缓存。

新增 `results.normalize.v2` 明确选择新 authoring profile，`page.compose.v2` / `page.edit.v2` 支持原单源及受控 `tableSlots`。旧 13 个公开描述与 legacy profile 保持。`tableSlots` 是创作输入，不写 PageDocument；各槽只须共享同 ID/类型的稳定行键，度量字段按各列的槽归属独立选择。每槽实际期间须与明确输入的期间对应，不猜同比/环比；差异期间可显式声明。

辅助普通 query 必须声明 complete 且结果已证明完整，空结果 0/0 合法。缺匹配在运行时按原对齐语义留空，额外辅助行不生成主行；覆盖报告只计算本次返回主键范围。重复、空或错误类型键、失败槽、未知完整性和期间不匹配明确拒绝受影响块。主槽 partial 仅在实际可证明的 query 第一窗口和单维行键下启用查询分页；不能退成本地分页或把当前页当全集。

Tokens 已知基础刻度、完整结果及最小非零值缩放后大于既有安全阈值时，默认选择 `compact-million-1`；partial/unknown 不据样本猜数量级，已缩放值不再缩放，其他单位沿原 number/万/亿选择。字段原值、query、来源身份不变。显式相容覆盖保持；来源建议与确定语义冲突时仅新 authoring profile 可调整建议，未知出处/显式用户冲突保留并报告。

Node-only `page.presentation` 是局部适用检查，无需 Python/视口/DOM。它复用产品解析和引擎纯字段解析，检查实际绑定覆盖而非仅检查字段默认；轴/标签/Tooltip 由真实选项构造器与 formatter 的同向量测试证明。该 AI 创作政策不收紧合法金额 compact-million 的引擎能力。

页面入口：`/pages/relay-multislot-presentation`，数据为内联合成；对应 README 说明缺匹配与百万显示。主控还需将片段并入所属页面元数据文档、官方生成与 local Skill 知识/工具，并完成浏览器验收。

# Schema6.89 消费基线审查

用户已选择系列条件同步显隐，要求“提交并合入 main”，并限定“仅测试最小化必要内容”。本批以0.4.0/Schema6.89补齐发行消费基线，Interface保持2.0.0。此记录不涉及真实Relay采用、激活或current迁移豁免。

## 固定输入

- Schema6.85消费文件 `consumer-0.3.5-schema685.json` SHA256仍为 `a49bd16f44ca8ff322d63c3f2f864e2fc201a0aba49667ed3b7a3980d5aace76`；其41条请求原样保留。
- 6.82/6.83/6.84/6.85的冻结消费、机器审查及采用记录保持原字节；replay、compare、adoption算法未修改。
- 新46条期望从本批真实候选CLI在仓外采集，使用完整状态、数据、有序诊断、退出码；原content稳定投影保持。新加5条：当前分析报告换源正反例、图表系列条件合法页、6.87拒绝页、条件引用不存在筛选的拒绝页。新鲜报告同样由该候选的page.analyze取得。
- 采用记录绑定新消费文件与历史审查的实际SHA；sourceReviewReleaseId是采集候选的来源，不替代未来CI归档的实际releaseId。

## 15条结果差异

| 请求 | 操作 | 审查结论 |
|---|---|---|
| consumer-0.1.0-01 | page.validate | 仅data.schemaVersion从6.85到6.89，原状态、有序诊断及退出码保持 |
| consumer-0.1.0-03 | page.project | 可读版本增加6.86/6.87/6.89，目标版本和升级/拒绝消息更新；原状态及退出码保持 |
| consumer-0.1.0-05 | page.upgrade | 可读版本增加6.86/6.87/6.89，目标版本和升级/拒绝消息更新；原状态及退出码保持 |
| consumer-0.1.0-06 | page.validate | 仅data.schemaVersion从6.85到6.89，原状态、有序诊断及退出码保持 |
| consumer-0.1.0-07 | page.validate | 仅data.schemaVersion从6.85到6.89，原状态、有序诊断及退出码保持 |
| consumer-0.1.0-10 | page.validate | 仅data.schemaVersion从6.85到6.89，原状态、有序诊断及退出码保持 |
| consumer-0.1.0-12 | page.upgrade | 可读版本增加6.86/6.87/6.89，目标版本和升级/拒绝消息更新；原状态及退出码保持 |
| consumer-0.1.0-16 | page.compose | 写出document.schemaVersion从6.85到6.89 |
| consumer-0.2.0-new-0 | page.analyze | 仅baseline.schemaSha256随实际产品Schema改变 |
| consumer-0.2.0-new-9 | page.compose.v2 | 写出document.schemaVersion从6.85到6.89 |
| consumer-0.2.0-new-10 | page.edit.v2 | 写出document.schemaVersion从6.85到6.89 |
| consumer-0.3.5-rebind-0 | page.rebind | 旧6.85分析报告因Schema摘要变化拒绝ANALYSIS_BASELINE_STALE；保留原请求，新鲜报告另加正反例 |
| consumer-0.3.5-rebind-1 | page.rebind | 旧6.85分析报告因Schema摘要变化拒绝ANALYSIS_BASELINE_STALE；保留原请求，新鲜报告另加正反例 |
| consumer-0.3.5-header-0 | page.validate | 仅data.schemaVersion从6.85到6.89，原状态、有序诊断及退出码保持 |
| consumer-0.3.5-header-1 | page.validate | 仅data.schemaVersion从6.85到6.89，原状态、有序诊断及退出码保持 |

原请求中只有上述版本/Schema摘要变化；两个6.85换源请求继续保持旧报告过期拒绝，新的当前报告正反例分别成功和拒绝缺字段。全部旧/新完整值见 `schema689-previous-consumer-review-v1.json`。

## 门禁边界

6.85到6.89保留七项契约迁移理由：默认页面Schema变化，以及page.analyze、page.compose、page.compose.v2、page.edit、page.edit.v2、page.rebind内嵌Schema变化。旧0.1.0历史报告继续保留六项理由、八条变化及needs_migration，完整值由 `schema689-tools-adoption-review-v1.json` 固定。

正式46条必须全通过；历史报告必须精确匹配旧审查；实际current仍先独立检查，不可通过首次采用绕过。只修复本次CI打包阻断，不修改页面或查询语义、不放宽兼容规则。图表和Skill的既有验收不重复；真实Relay/DQE和部署另验。

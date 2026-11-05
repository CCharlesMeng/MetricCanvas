# Schema6.85 消费基线审查

用户已接受表头页面参数初值能力，并于2026-11-05要求“可以，skill也改了吧，提交并 push main”。产品已写出Schema6.85，本记录补齐同批发行消费基线；不授权真实Relay采用、激活或绕过current迁移。

## 固定输入与旧样本

- 0.3.3/6.84 的37条请求全部保留，文件原始SHA256仍为205207b7f51218ff6ed891940d0c0146556ee96bcdcca6dc98f107915de05019。
- 0.1.0/6.82及其历史审查、6.83/6.84全部冻结文件保持原字节。没有修改 replay、compare 或 adoption 的判定算法。
- 新0.3.5/6.85由实际产品候选CLI在仓外逐请求执行，保留完整状态、退出码、数据、有序诊断及原有content稳定投影；版本、公开路径和资源来自真实候选，Interface保持2.0.0。新增4条独立请求：新鲜分析报告换源成功/缺字段拒绝、表头initialParam合法/与defaultValues互斥拒绝。
- sourceReviewReleaseId只指向审查时的固定候选，不反向绑定未来发行。消费者、审查和采用记录的SHA均由实际原始字节生成；完整旧/新值见schema685-previous-consumer-review-v1.json。

## 13条实际结果变化

| 请求 | 操作 | 审查结论 |
|---|---|---|
| consumer-0.1.0-01 | page.validate | 仅data.schemaVersion从6.84变为6.85，原成功/失败及诊断保持 |
| consumer-0.1.0-03 | page.project | 可读版本追加6.85、目标版本及升级消息更新 |
| consumer-0.1.0-05 | page.upgrade | 默认写出/目标版本及非法版本错误消息更新，原退出码保持 |
| consumer-0.1.0-06 | page.validate | 仅data.schemaVersion从6.84变为6.85，原成功/失败及诊断保持 |
| consumer-0.1.0-07 | page.validate | 仅data.schemaVersion从6.84变为6.85，原成功/失败及诊断保持 |
| consumer-0.1.0-10 | page.validate | 仅data.schemaVersion从6.84变为6.85，原成功/失败及诊断保持 |
| consumer-0.1.0-12 | page.upgrade | 默认写出/目标版本及非法版本错误消息更新，原退出码保持 |
| consumer-0.1.0-16 | page.compose | 写出document.schemaVersion更新为6.85 |
| consumer-0.2.0-new-0 | page.analyze | baseline.schemaSha256更新，输入文档和用数含义保持 |
| consumer-0.2.0-new-9 | page.compose.v2 | 写出document.schemaVersion更新为6.85 |
| consumer-0.2.0-new-10 | page.edit.v2 | 写出document.schemaVersion更新为6.85 |
| consumer-0.3.3-rebind-0 | page.rebind | 6.84报告因Schema摘要变化拒绝ANALYSIS_BASELINE_STALE；正例由新增新鲜报告请求单独证明 |
| consumer-0.3.3-rebind-1 | page.rebind | 6.84报告因Schema摘要变化拒绝ANALYSIS_BASELINE_STALE；正例由新增新鲜报告请求单独证明 |

## 契约与门禁

当前6.84到6.85的结构比较保留五项迁移理由：defaultPageSchema变化，以及page.compose、page.compose.v2、page.edit、page.edit.v2内嵌页面Schema变化。旧0.1.0报告保留其六项原因、八条变化及needs_migration，写入最终归档的historicalReports。正式41条必须全通过，历史差异必须精确匹配；实际current仍先独立比较，6.82与6.84均拒绝自动升级。

这一补齐只更新发行基线与审查证据，不改变表头或查询语义、不新增页面Schema字段、不更改历史冻结请求、不放宽迁移门禁。浏览器能力与本地Skill验收见表头参数初始化记录；真实Relay/DQE和部署另验。

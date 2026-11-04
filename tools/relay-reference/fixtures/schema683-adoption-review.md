# Schema6.83 首次消费基线审查 v1

用户于2026-11-04在主控会话01a19c97-0922-7963-afd9-33fa2625f39a确认以6.83作为首次正式基线，要求给出可用性、Relay初步对接和本地测试报告。此记录批准消费基线；实际Relay采用、授权、DQE、状态与保存仍需Relay验收。

## 固定输入

- 旧0.1.0/6.82：consumer-0.1.0.json，SHA f7df720d08a8334a1d976cc7f1c28c7a9f4a3dec1612da204dd59b420ac886e1，不变。
- 新0.2.0/6.83：consumer-0.2.0-schema683.json，SHA 9e0f9dbbbb46f266836d4681569405fa91f2d78af59323c2625de32a6fd3846e。来源是固定review四项0866c5c1186591971c5e3a8da99344680cbe9d6d73b9feb9d20f8d1c3cb05534，不反向绑定未来归档。
- 新基线保留旧23条请求（信封与输入逐字相同），从固定review实际CLI取得完整退出码/状态/数据/有序诊断；Content仅沿用原稳定投影。再补新增6项操作的12条实际正负请求，共35条，新增6项均有成功样本。没有录制或force命令。
- 机器审查schema683-adoption-review.json含每条变化的旧/新完整expected、精确JSON路径和before/after，另含两个变化descriptor的字段差异。新基线与审查由schema683-first-adoption-v1.json绑定SHA，再由release-config.json绑定采用记录SHA。

## 八条调用的审查

| 固定请求ID尾号 | 操作 | 实际变化 | 判断 |
| --- | --- | --- | --- |
| 01 | page.validate | data.schemaVersion 6.82→6.83 | 返回当前引擎协议版本，输入不改 |
| 03 | page.project | targetVersion→6.83，status current→readable，新增6.83 readableVersions及升级说明/警告 | 旧6.82可读，但当前目标已升级 |
| 05 | page.upgrade | document.schemaVersion/toVersion→6.83，changed=true，新增changes与warnings | 默认写入版本升级，必须承认行为变化 |
| 06 | page.validate | data.schemaVersion 6.82→6.83 | 返回当前版本 |
| 07 | page.validate | data.schemaVersion 6.82→6.83 | 返回当前版本 |
| 10 | page.validate | data.schemaVersion 6.82→6.83 | 返回当前版本 |
| 12 | page.upgrade | 拒绝99.0的data.errors及有序diagnostics.message改为到6.83，toVersion→6.83 | 仍拒绝非法版本，错误说明反映当前目标 |
| 16 | page.compose | data.document.schemaVersion 6.82→6.83 | 默认生成版本升级 |

八条均保持退出码和状态。仅尾号12的有序诊断消息随目标变化，其余诊断保持；另外15条完整结果保持。输入文档原值不因捕获新expected而改写。

## 三项契约原因

1. defaultPageSchema：6.82→6.83，原比较器要求显式集成升级。
2. operation:page.compose：内嵌当前computeOperator join keys由minItems=1改为允许显式空数组，并增加仅unique的独立单行基准语义描述；schemaVersion可选值/说明追加6.83。
3. operation:page.edit：内嵌当前computeOperator join keys同样变化。旧描述不是逐字相同，不能谎称旧契约兼容。

## 发行边界

原compare_states与consumer.replay算法不变。直接旧f7回放继续needs_migration，全部23项结果和三项原因写入归档compatibilityEvidence.historicalReports；新正式基线必须通过，历史差异必须精确等于本审查，否则拒绝。首次聚合ok仅表示可进入Relay冒烟，不会把历史报告改为ok。

只要传入--current，真实current的比较就独立执行，旧6.82仍exit2；首次基线记录不能绕过它。缺采用记录、SHA变化、历史记录缺失/新增差异、正式基线失败均拒绝。未来兼容更新继续按新固定消费基线比较；需变化的基线必须另行审查，不能任意重录。

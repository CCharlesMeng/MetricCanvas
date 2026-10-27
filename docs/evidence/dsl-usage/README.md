# DSL 使用问题索引

按操作、场景及症状定位现行问题记录；原始观察和修复复验分开，真实服务未经调用时保留待验证状态。维护流程见[DSL 使用问题回灌](../../agents/local-authoring-skill-maintenance.md#dsl-使用问题回灌)。

| 问题 ID / 记录 | 操作 / 场景 | 症状 / 检索词 | 适用版本 / 环境 | 状态 | 现行规则 / 回灌位置 |
|---|---|---|---|---|---|
| [DSL-20261027-paged-union-order-contract](2026-10-27-paged-union-order-contract.md) | 排错 / 指标查询排序、分页合并、关联选页、查询子表格 | order.by、orderByField、priority、姓名补排序、DQE_ROW_CONTRACT_ERROR | 输入6.61；修复基线6.66；实际部署未知 | 排序编码已回灌；真实服务待验证 | 查询/数据源/表格正文、ADR-0086、派生local-authoring；真实DQE单字段排序与来源身份独立验收 |

# MetricCanvas 侧接入优化（2026-09-24）

起点：内部职责清单及 DATA_CONTEXT_GOVERNANCE_REQUIRED 反馈。公共接口版本保持 authoring-adapters/1.0，内部 adapters 整树不修改、不覆盖。

| 优化 | 交付位置 | 验收 | 状态 |
|---|---|---|---|
| 原始 additivity/timeAggregation 为 null 或空字符串时使用合法治理补充；明确非法值仍拒绝 | examples/adapter_template/firstparty/data_context_http.py | 快照级回归：空值回退、原始有效值优先、非法值不掩盖 | 已完成 |
| 区分 projection 未装配与字段治理缺失；一次报告多个缺失属性 | 公共 DataContextError、参考模板、scripts/check_data_context.py | 输出阶段、数据集/字段/属性及定位路径；不输出凭据、原始响应或业务行 | 已完成 |
| 工厂显式加载 projection 并复用同一元数据实例 | 参考模板辅助函数、RELAY-HANDOFF.md | 验证传入配置、限定数据集范围、发现/执行版本一致 | 已完成 |
| 完善内部上手说明 | RELAY-HANDOFF.md、接口文档 | 写明治理责任、覆盖范围、默认值限制、重新发现确认、插件源码/部署位置、真实认证待核验 | 已完成 |
| 分发自洽 | 生成的契约/Bundle 锁 | 生成检查、受影响测试通过；内部 adapters 哈希不变 | 已完成 |

不在本批代填真实治理属性，不猜测内部认证，不自动迁移 Relay 插件，不删除或弱化治理门禁。聚合函数推导仅保留参考兼容行为，不新增全局默认可加性/时间聚合。

内部采用方式：更新公共源码后，将需要的参考修复人工移植到内部 adapters。诊断脚本只调用内部数据上下文提供方，不能替代真实 DQE、Java 保存和 Relay 交接验收。

## 本地验证

- 修复前快照回归对 null、空字符串、空白字符串均复现失败；修复后通过。
- 适配层 51 项通过，包括多属性定位、100 项诊断上限、非法值拒绝、凭据/原始响应不输出、配置 helper 注入及版本变化。
- 创建/编辑主流程测试 6 项通过（stdio + HTTP 替身，零真实模型调用）。
- 未接线诊断 CLI 输出 ADAPTERS_NOT_CONFIGURED 并退出 2；未访问真实服务。
- 内部 adapters 全部非缓存文件哈希与修改前一致。
- 公共契约与锁文件按生成器更新并检查；真实 Relay、Java、DQE 与治理配置未验收。

诊断入口：`python scripts/check_data_context.py`。采用步骤见 [接入说明](RELAY-HANDOFF.md) 第 2.1–2.2 节；配置 helper 在 `examples/adapter_template/firstparty/configuration.py`。

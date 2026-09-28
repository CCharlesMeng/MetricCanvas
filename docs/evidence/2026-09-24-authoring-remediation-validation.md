# 公共查询对接整改：本地验收证据

日期：2026-09-24。范围为当前工作区源码；尚未提交、发布或部署。对应[整改计划](../plan/2026-09-24-authoring-ioc-remediation.md)及[Adapter 迁移说明](../../metriccanvas-authoring/QUERY-VALIDATION-MIGRATION.md)。

## 已执行

| 验证 | 结果 | 证据边界 |
|---|---|---|
| `metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py` | pass，442 项，44.286 秒 | 完整分类本地测试；包含脚本驱动创建/调整六场景，modelCalls=0 |
| `pnpm authoring:contracts` | pass | 从真源生成，不手改摘要锁 |
| `pnpm authoring:contracts:check` | pass，510 product / 4 authoring / 1 interface | 导出一致性 |
| `python3 metriccanvas-authoring/scripts/check_bundle.py` | pass，1638 digest checks | 源 Bundle 0.3.1 一致性，不表示已发布新版本 |
| `python3 tools/scripts/adr-index.py --check` | pass | ADR 速查表及主题索引 |
| `preflight.py --surface unified-content` | pass，9 个注册工具，0 模型请求 | stdio 工具名及输入 Schema 自检，不执行真实创作 |
| `git diff --check` | pass | 修改格式检查 |

定向用例位于 `metriccanvas-authoring/test-harness/tests/test_query_validation_policy.py`：实际 SemanticCatalog/MCP 分支发现维度与规范域、大小写时间类型及 M 规范化、默认宽松与严格对照、可信配置热更新、批次策略固定、缓存/结果引用隔离、规范请求授权、地域与半年窗口保留、缺失可选治理保持未知、可信测度字段兜底、非法治理和授权拒绝、Lab 版本与校验模式解耦。

原始本地日志：`/tmp/metriccanvas-remediation-final-tests.log`；预检 JSON：`/tmp/metriccanvas-remediation-final-preflight.json`。这些是临时复核文件，不是分发制品。测试使用本地替身 DQE/元数据及脚本模型；日志中的 `UNSUPPORTED_SKILL_PROTOCOL` 为预期负向场景，不代表真实模型验收。

## 未执行与剩余事项

- 真实 DS 模型、内部 DQE、Relay 身份/交接、Java 读写：not-run。预检中的 trustedCurrentTurn/writeReadiness/dataServices 仍为 blocked，不能将工具注册成功视为服务接通。
- 真实中国区字段和值、Tokens 两项指标的跨期总量口径：待内部实际查询核对。本地测试只证明明确输入的筛选/时间条件没有丢失，不替代业务结果验真。
- 真实页面产物及保存后浏览器验收：not-run；本轮未新增 IOC 页面。
- wheel/sdist 新制品发布、Git 提交/推送、远端 CI、内部部署：not-run。已有分发结构测试及源码摘要校验通过，不等于新包已发布。
- IOC 新算子、复杂 Tab/浮层：未实现。报告缺少完整 127 请求明细及全部活跃行为证据，需补证并设计；21 入口候选表已落入[差距文档](../plan/2026-09-23-ioc-full-page-capability-gap.md)。

内部复验应先采用迁移说明，重新发现并确认规范化查询，再记录实际 scope、策略、警告和 DQE 结果。不要复用旧失败引用或覆盖内部自定义身份接线。

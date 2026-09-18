# 本轮实现证据（2026-09-17）

> 本文件为较早阶段的历史记录，计数及交付路径已被 [最新验收状态](../verification.md) 更新。历史真实模型运行是 v1/inconclusive，不能证明后续 v2 主辅布局；当前最终 JSON 来自单独标注的确定性公开工具验收。

本文件只记录已实际运行的证据；不把离线回归、生成物检查或历史轨迹标成真实模型和浏览器验收。

| 项目 | 结果 | 证据 |
|---|---|---|
| A01 / A03 / A05 / A07 / A09 / A10 / A12 的结构回归 | 通过 | `test_structure*.py`：18 tests, OK；完整 Python suite：449 tests, OK（允许 localhost 的执行环境） |
| Bundle 与导出 | 通过 | `node --import tsx tools/scripts/export-authoring-contracts.ts --check`；`check_bundle.py`：1486 digest checks |
| 真实模型 A11 | 已运行，inconclusive | DeepSeek `deepseek-v4-flash` 真实调用：3 模型请求、4 工具调用、1 候选；runner 状态为 `inconclusive`，原始轨迹在 `real-flow-20260917-retry/`。 |
| 真实候选 JSON | 通过 | 对 `candidate-1-1-4.json` 内页面文档运行 `validate_page_document`：`valid: true`，`errorCount: 0`。 |
| 视觉 A04 / A08 / A11 | 由人工验收 | 用户明确选择自行完成视觉验收；本轮未生成截图。 |
| 前端全量 | 有已知失败 | 允许 localhost 的 targeted run 为 1390 passed / 4 failed / 4 skipped。失败是现有公开 API/页面参考快照（协议 6.3 vs 6.4、`LEGACY_READABLE_PAGE_SCHEMA_VERSIONS`）以及开发端口 443 vs 测试预期 5174；与本轮 Python 结构实现无直接栈迹关联，仍须在交付前裁决。 |

## 已实现行为

- `version: "2"` 要求每个内容分区声明业务问题、业务对象及与其它分区的区别；`version: "1"` 原样保留。
- 创建期在查询前运行纯静态预检，不取数、不调用模型；结构无效时批量返回可知问题。
- 受信关系仅存创作期私有通道，只有同源主值/变化值存在该关系时，才展开成既有 `metricCard` 的 `compactSummary`、`rows` 与 `changes`。最终页面元数据不携带该私有关系。
- 没有受信关系的相似字段会得到 `STRUCTURE_CHANGE_RELATION_UNVERIFIED`，不会按名称猜测同比或环比。

## 尚未满足的验收项

经营/用量中性需求各三次、逐章人工业务审查与成本中位数尚未产生。当前真实 runner 的 `inconclusive` 也不能作为 A11 通过证据；JSON 合法性只说明页面协议结构正确。

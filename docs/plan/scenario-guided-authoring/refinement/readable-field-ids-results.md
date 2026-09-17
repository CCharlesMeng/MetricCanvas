# 可读字段 ID 与真实模型重跑

## 变更

新建查询源采用 `{dataSourceId}-field-{normalizedQueryField}`；非 ASCII 查询列名回退到可信逻辑标识，重名依次用逻辑标识、投影标识、确定性摘要消歧，不用随机数。重复来源身份仍拒绝，查询体、原始行和 queryField 不改写。既有页面不迁移；不同别名的新建源不承诺得到相同名称。完整规则见[映射协议](../../../../metriccanvas-authoring/contracts/authored/authoring-data-mapping-protocol.md)。

指标面板此前已改用白色内容表面，组合卡内透明压平不变；此轮未修改生成页面布局。

## DeepSeek 运行

- 输入：原丰富经营样例的相同业务请求；真实 DeepSeek 调用，本地非生产数据提供方。注入当前 skill、创建流程、report 与经营场景参考、阅读设计及实际工具 Schema。
- 首次运行：3 次模型请求、109,705 tokens。4,096-token 输出上限截断创建计划，JSONDecodeError，无候选。保留 run1（原始记录已清理：`evidence/readable-field-ids-run1/readable-field-ids-business/1/result.json`）。
- 第二次运行：显式提高输出上限为 12,288，4 次模型请求、160,635 tokens，10 次工具调用，1 个合法候选，正常结束。使用 v3 计划，6 次本地查询执行、34 个可读字段 ID、25 个组件。
- 两次合计 7 次模型请求、270,340 tokens；不是只计算成功运行。
- 最终产物：完整页面 JSON（原始记录已清理：`evidence/readable-field-ids-run2/readable-field-ids-business/1/after.json`）。它是候选程序通道直接导出的 document，未手工改写；不是结构计划或工具响应封套。

## 验证边界

最终 JSON 经当前 parsePage 校验通过；34 个字段逐一符合来源前缀与 queryField 命名，未出现哈希消歧。字段映射定向测试 13 项通过，覆盖名称、排序、中文回退、规范化重名、投影消歧和确定性兜底；skill 校验与 bundle 摘要检查通过。全量测试中发现旧示例测试仍假定仅两段 JSON，已扩展为按实际请求/v3 块 Schema 分别验证四个例子。

runner 的 `inconclusive` 是未执行人工质量判定的状态，不表示候选创建失败。没有截图、视觉验收、生产 DQE 验证、保存或发布；视觉结果交用户判断。

最终全量回归：484 项测试通过（35.171 秒）；日志位于本机 `/private/tmp/metriccanvas-readable-field-tests-final.log`。

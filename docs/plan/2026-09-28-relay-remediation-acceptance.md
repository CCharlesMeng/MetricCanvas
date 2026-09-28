# Relay 反馈整改：接入对账与验收记录

对应[整改计划](2026-09-28-relay-feedback-remediation.md)。本文件是接入执行入口；本地参考 Adapter 和夹具不证明内部环境已经修复。

## P0-0：在实际部署进程环境采集指纹

使用启动 Relay 工具的同一 Python、虚拟环境和 PYTHONPATH 运行 Bundle 内脚本：

```sh
/path/to/relay/python /path/to/bundle/scripts/deployment_fingerprint.py \
  --bundle-root /path/to/deployed/bundle \
  --adapter-root /path/to/deployed/relay/plugin > deployment-fingerprint.json
```

脚本不会将待检查源码强行插入 Python 路径。核对 `modules[].path/sha256/matchesBundle`、公共 Git HEAD 与 dirty、Bundle lock 摘要、Skill 文件摘要、查询校验模式及插件源码摘要。退出码 2 表示公共文件漂移、实际导入不匹配或策略不可用；退出码 0 只说明这些检查通过。未提供插件路径显示 `not_provided`，不是部署通过。插件摘要只取 Python 源文件；其他语言实现、部署配置及实际 SkillLoader 加载位置仍须接入方补证。不要在报告中附凭据、work.db 内容或原始元数据。

`check_bundle.py` 继续验证产品/创作契约快照；`check_adapters.py` 验证装配；有真实 context_ref 时才使用后者的可信轮次检查。三者都不能替代真实 DQE/保存/预览。

## P0-1：现有可信轮次契约的接入核对

待接入方回答并留证：

| 决策 | 当前约束 | 实际部署证据 |
|---|---|---|
| 用户事件 | 新指令/澄清答复建立新轮；取消/状态查询指向原轮 | 未取得事件类型与处理位置 |
| 工具关联 | 调用携带不可变完整 binding；不能读取全局最后写入槽位 | 未取得插件源码 |
| 重启 | runId 保持才能恢复同轮引用；改变则重新取证 | 未确认执行恢复语义 |
| 存储 | 工作状态持久化并按完整作用域隔离；读取不重置工作稿 | 未取得实际配置和 work.db 证据 |

本地消费回归覆盖不同 requestId/runId/contextRef 拒绝旧 resultRef、两个轮次交错共用 SQLite、一个取消后另一个重启并完成 query→compose→saved→preview，以及读取工作稿不重复保存。该测试向公共工具提供正确可信上下文，不能证明实际 Relay 已按请求正确注入它。

## P0-2：单次保存的脱敏诊断

参考实现 `examples/adapter_template/firstparty/lifecycle_http.py` 新增可选同步回调：

```python
adapter = KnownLifecycleHttp(collection_url, diagnostics=record_event)
```

`record_event` 由接入方提供，应快速写入程序日志。事件只包含 operationId、固定 stage、HTTP status、受限格式业务码与固定响应字段路径，不包含 URL、headers、正文、SQL 或异常消息。回调失败不改变保存结果。事件顺序：

- `send_started`：开始一次发送尝试，不证明网络已发送或服务已接收。
- `response_received`：已收到 HTTP 状态。
- `saved`：回执通过校验；`rejected`：现有明确拒绝状态。
- `transport_unknown`：超时或传输错误；`receipt_invalid`：响应格式、业务码、版本、页面文档或一致性检查未通过。

`receipt_invalid.path` 指出响应校验字段；页面 Schema/内容不符归 `/page_metadata_definition`，不输出不可信的深层属性名。已收到响应后仍为 unknown 时，用 operationId 关联原冻结提交，由 Java 核对当前持久记录。operationId 不代表 Java 提供远端幂等能力。unknown 不改写成 rejected，不自动重发，不新建轮次绕过。

内部 `tool/metriccanvas_authoring/adapters/` 属于接入方；公共同步不会覆盖它。将参考实现诊断改动定向合并进实际 Adapter，绑定日志接收器后采集真实回执。当前没有该环境的日志，不能判断原事故是否落库。

## P1-1 / P1-2：原始月报能力核对

以下状态全部待真实授权元数据验证，报告中“只有账期和 visualization_level”的描述不是本轮直接证据。

| 原需求 | 必须核对 | 当前状态 |
|---|---|---|
| 整体 | 中国区范围、2026 上半年、指标口径与单位、跨期聚合声明 | unknown |
| 月度趋势 | 同一地域/时间、实际月份请求编码与返回列名 | unknown |
| 代表处 | 指标能与代表处维度组合，且地域范围成立 | unknown |
| 模型占比 | 模型维度兼容、分子/分母与覆盖完整性 | unknown |
| 区域 × 模型明细 | 同一指标能同时与两维组合，非域级维度并集 | unknown |

对每行附授权元数据版本和来源、明确的 supported/unknown/unsupported 依据，以及真实 DQE 请求/响应的脱敏样本。未命中检索不能独自证明 unsupported。核心范围缺失时只验收准确报告缺口和保留工作，等待用户选择可接受范围再重新授权；纯文本页不能替代完整月报。

本轮补齐 fallback 指标匹配项的 canonical businessDomain，两条发现路径均以实际 MCP discover→query 回归。维度请求编码、返回列与标签以及 month/yyyymm 仍按真实接口样本核对，不实施猜测映射。

## P1-3 / P2：待实际接入与决策

元数据短时重试、合并在途请求与缓存应落在实际 Relay Adapter。接入前需要确定权限变化信号、授权范围键、元数据版本及治理配置失效机制；当前缺少插件与部署配置，不引入永久快照缓存。已有 `check_data_context.py` 可用于实际配置/投影诊断。传输错误不能解释为没有指标。

A2 稳定标识迁移与 A3 统一发现/就绪协议均未实施，仍是提案；只有真实对账证明需要后，才核对标识来源、兼容与回滚、fallback 保留及跨源检索需求。Relay 核心不改。

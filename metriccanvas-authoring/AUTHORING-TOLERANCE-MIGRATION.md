# 创作容错与元数据复用接入

公共模块新增输入容错：无效可选 width/purpose、section container/pattern 和空可选展示值采用默认，返回 adjustments。未知组件可在没有 match 行选择时使用同字段表格；携带不能安全回落的业务表现仍只失败该块。非法内容块、查询项分别返回失败，独立合法项继续。最终页面、身份授权、业务筛选和保存规则保持有效。成功页面的 partial 仍需说明缺失，不声称完整。

sources 仍为 `{页面数据源ID: query_data返回的原始resultRef字符串}`，不需要新增注册或注入步骤。RESULT_SCOPE_MISMATCH 增加 path 和安全指引，不公开他人结果是否存在。若原引用正确，检查同轮的稳定 binding 与跨进程共享存储；不要通过删 runId/requestId/contextRef 比较绕过。保存前失败不再永久缓存，接入问题修复后可重试原请求；保存未知仍只核对原操作。

## 内部采用

公共更新不会覆盖 `tool/metriccanvas_authoring/adapters/`。参考改动位于 `examples/adapter_template/firstparty/dataset_metadata_http.py`；内部自行合并以下调用点：

1. 每次读取前按当前可信身份和范围检查。将 HTTP/解析封装为 loader，调用公共 `read_turn_metadata(source_identity, loader, retain_partial=True)`。
2. source_identity 包含端点、可信身份/工作区、数据集范围、凭据指纹和投影配置。不得使用模型输入确定范围或缓存 key，不存原始凭据。完整可信 binding 由公共 PlatformAuthoring 的 metadata_session 注入，作用域结束后清理 ContextVar。
3. loader 先取得初始批次，再对已报告失败或缺失的 dataset 做一次补取（最多 100 个、仅这些 ID），成功来源不重读。补取瞬断保留已有结果；身份、权限、范围、协议错误仍显式失败。发布前合并成功模型并计算内容版本，coverage.consistency=per-dataset，不承诺跨 dataset 原子一致。
4. loader 仅在实际覆盖完整时返回 `coverage.complete=true`，保留 issues。显式 retain_partial=True 允许将授权范围内至少有一个成功模型的 partial 快照按本轮固定复用；不会把 partial 标成完整。完全失败、无覆盖证明或大于 20 MiB 的快照不缓存。新轮才能刷新已发布快照，避免查询与组装混版。
5. 同轮 detail 从已取得的模型定位精确指标，不再次以单 dataset 子集请求。未进入公共 metadata_session 的旧调用继续按原方式访问，不全局复用。
6. 确保可信轮次取消、身份/访问范围变化和实时撤权能由上下文/授权端口检查出来。不能依赖重复 HTTP 发现撤权；不能提供此保证的集成暂不启用快照包装。

`metadata-snapshot-v1` 使用已有 StateStore/CAS，已发布记录按可信轮次复用，并发读取以短租约合并，加载异常释放认领。记录是私有状态；运行数据库放源码外，部署方按已结束轮次清理。这里不新增自动 TTL 换源和跨轮结果复用。新轮/新范围/新配置重新读取；上游变化需要重新建立可信轮次才能刷新。

查询成功记录继续不可变。新记录携带 attempt、expiresAt、retryCount 和脱敏 executionFailures：读超时/传输失败自动再试一次，业务拒绝不重试；已失败的可重试请求或过期执行最多再认领一次。仍在执行的相同请求短暂等待后返回 pending 指引。旧 pending 记录若无 expiresAt 不自动抢占，应由集成程序核对原执行。新认领使用 CAS；单次执行有界，迟到写入不能覆盖新 owner。只读远程调用在失联时仍可能重复，不承诺恰好执行一次。

回滚需排空在途写入；不要让不理解新 attempt/快照语义的旧进程同时使用活跃轮次。旧工具输入和最终页面协议不变。固定公共 Git 提交、内部 Adapter 提交与构建哈希，不能只看 Bundle 版本。

## 小范围验证

参见 `test-harness/model-evals/robustness-smoke.cases.json`。正常 create-report 与 `--tolerance-probe` 各执行一次真实 DS；后者在工具入口注入已声明的展示偏差并保留模型原始参数。报告分别记录模型请求、元数据 HTTP、DQE、保存、调整与最终页面验证。故障注入不证明模型自然会犯这些错误，小范围通过不替代公司 Relay/Java/DQE 联调。

partial 快照的 `current_for_query` 只投影成功 dataset；通过私有查询视图 metadataCoverage 返回 complete=false/failedDatasets，查询证据携带 DATA_CONTEXT_PARTIAL warning。未知业务域仍拒绝，不跨来源猜字段；旧 neutral current() 保持完整快照要求。`check_data_context.py` 会显示这些 warnings，它仅证明可用部分可查询，不证明覆盖完整。

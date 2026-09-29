# 9235/9236 执行分析核验与隔离稳定性改进计划

分析日期：2026-09-29。源码基线：`1641ca04`。状态：源码核验完成，改进方案待实施；本轮未修改业务代码或内部 Adapter。

执行范围已按用户补充限定为 MC 侧，实施以 [MC 详细执行计划](2026-09-29-authoring-mc-execution-plan.md) 为准；本文保留审计事实与跨系统问题归属，不再作为跨团队执行授权。

## 结论与证据范围

优先采用公共能力、内部 Adapter 只负责真实接口接线的方向成立。现有隔离方案应保留，不能为了消除失败而削弱名称消歧、完整行集、可信轮次或精确授权。

用户附件是两次真实会话的二次分析，本次没有直接取得 chat_history、原始 HTTP 分段耗时及部署源文件。附件中的调用次数、14 秒延迟、内部已修改状态属于待部署复核证据；当前源码与本地测试属于已核验证据。不能据此承诺 14 秒降至 1–2 秒。

角色与职责：用户给业务问题；模型选择指标与阅读结构；公共 Tool 派生查询、执行校验、维护工作稿与结果证据；内部 Adapter 提供真实身份、授权、Java/DQE 协议、存储和交付；Java/业务治理提供单位、币种及字段事实。长期资产是页面文档，创作轮次、结果引用和元数据快照是程序状态，不应通过 Skill 或模型传递内部身份。

## 对原分析的关键修正

| 原判断/建议 | 当前核验 | 应采用的改进 |
|---|---|---|
| 公共模板未接 metadata_session | 已过时。公共模板 `_read` 已调用 `read_turn_metadata`，内部目录仍保留旧实现 | 内部定向合并模板行为，不能整目录覆盖 |
| Adapter 注入 store 即可完成缓存 | 公共 helper 实际使用 metadata_session 从 PlatformAuthoring 注入的 store；额外 `self.store` 并不是其存储来源 | 验证实际工厂、稳定 binding、共享持久 StateStore，避免两套缓存 |
| 每个工具 14 秒都是元数据 POST | 尚不能证明。公共 `PlatformAuthoring.read` 不读元数据，仍会读取可信轮次、状态并核对页面 | 先分段计时，再按瓶颈优化 |
| QUERY_INTERRUPTED 完全不重试 | 公共 results 已允许原请求重新调用时对中断/可重试失败做一次受限认领 | 复用公共 attempt/CAS 恢复，区分自动 DQE 重试和请求重入；不再增加无界 Relay 重试 |
| metricCard 必须有维度 | 错误。单行总量可直接绑定 measure；match 才需要维度选行 | Skill 区分单行总量与多行选取，不虚构账期字段 |
| execution 把所有结果裁至 20 行 | `sample_rows` 裁剪嵌入 initial；QueryResults 仍存储 execution.rows | 公共装配改用程序结果证据验证完整性，保持模型和页面样本有界 |
| pie 校验改为 count >= len(rows) | 会让任意截断样本通过，占比失真 | 保留完整性要求；完整返回行、上游总数、是否分页/截断必须分别表达 |
| output_dims 必须与 queryField 相同 | 当前协议明确允许时间维度基名与返回粒度列名不同，TS validator 已处理 | 排查前端/契约版本漂移，不吸收机械加后缀补丁 |
| caption 总是执行名 | 本地模板未证明所有 Java/DQE 部署均如此；caption 还可能重名 | 核对请求维度名、响应列名、显示标签三个事实；部署差异由 Adapter 归一化 |
| alias 冲突 setdefault 即可 | 会依输入顺序静默选错指标，strict/relaxed 都不能证明该映射正确 | 公共层设计唯一规范名可用、歧义别名显式拒绝/返回候选；不能覆盖规范名 |
| 带时间筛选就是趋势 | 时间范围内的模型排行同样有时间筛选 | 趋势按实际时间分组字段排序；排行按明确业务指标排序；无充分意图时不猜 |
| 流水/AMOUNT 可临时推为 CNY | 名称和数量类别都不能证明币种及原始单位 | Java 或逐字段可信治理提供事实，公共层再派生展示格式 |
| scope 改 if sources 即可 | 容易给失败/未使用来源加看似有效的口径 | 成功组件口径与未完成需求说明分开表达，compose/edit 共用格式 |

详细装配证据见 [专项核验](2026-09-29-authoring-composition-audit.md)。

## 隔离方案必须保持的约束

### 文件所有权与升级

`ownership.json` 定义内部根为 `tool/metriccanvas_authoring/adapters/`，公共参考根为 `examples/adapter_template/`。内部目录不进入公共 Bundle 哈希，已有目录同步时不覆盖、不补齐；这正是隔离机制，不是遗漏。公共模板更新需要内部维护者定向采用。

`scripts/sync_upstream.py` 在写入前检查全部旧公共文件摘要、新文件冲突和符号链接。旧 lock 加本地公共补丁时应停止，不能只复制新 lock 或重新生成 lock 来掩盖漂移。公共 Skill 的部署副本也应按公共指纹管理，内部扩展要独立维护。

同步是逐文件替换、最后更新 lock，不是整目录原子事务。进程崩溃或磁盘失败仍可能留半更新状态；应在排空调用后的部署副本执行并验收，再按内部发布机制切换。回滚恢复配套的公共提交、内部提交和安装产物，保留状态库与未知保存记录，不让旧新语义同时写活跃轮次。

### 元数据快照

完整 key = 完整可信 binding + source_identity。source_identity 至少包含端点、当前 actor/workspace、凭据指纹、有效 dataset 范围和投影配置。附件 `(url, self.dataset_ids)` 不足：遗漏凭据、投影及实际 dataset_ids 参数，还可能让 detail 子集与全量碰撞。不要删 binding 中 runId/requestId/contextRef 来提高命中率。

缓存命中前仍检查当前身份，返回前复核；查询执行与结果消费仍执行精确请求授权。元数据版本固定不等于授权固定。按 ADR-0092，实时撤权无法通过可信上下文/授权端口传达的部署，暂不启用复用。

ready 快照不按 65 秒刷新：65 秒是等待预算，加载限时 60 秒、认领租约 62 秒。发布后本轮不可变，新轮刷新。partial 只能以授权范围、成功模型和明确缺口发布；完全失败不缓存，不能谎报 complete。

只读重试应区分传输瞬断、限流/可重试服务错误和永久拒绝。现有模板把许多非 200 合为 TRANSPORT_ERROR，直接按该码重试会连永久 4xx 一起重发。先保留可判定的错误分类，每次重试重新检查身份/取消；总预算包含 HTTP、退避、补取和等待，不允许重试叠乘越过租约。保存未知不能自动重发。

### 查询与页面语义

strict/relaxed 政策标识、完整 binding、数据上下文版本和规范化请求继续参与结果身份。成功 resultRef 内容不可变；迟到 owner 不能覆盖新 owner；跨轮 resultRef 不自动借用。业务域只是路由标签，不是租户或权限隔离键。

公共层负责字段语义、排序意图、占比/选行验证和口径文本；Adapter 负责已经确定语义的外部协议编码。不能用 Adapter 偷改查询语义来避免公共修复。公共语义变化仍须检查创作期查询与渲染期页面内查询是否一致。

## 建议实施顺序及验收

| 顺序 | 工作 | 归属 | 完成证据 |
|---|---|---|---|
| P0-1 | 记录实际导入路径、公共 lock/Skill/内部源码指纹；梳理公共补丁 | 内部部署，使用现有 deployment_fingerprint | 服务实际 Python/PYTHONPATH 的报告，无公共漂移或每项漂移有处理记录 |
| P0-2 | 分段计时：进程启动、装配、可信轮次/基线、缓存、Java 元数据、DQE、保存、预览 | 内部 Adapter/启动包装；必要时公共诊断接口 | 同轮冷/热调用 p50/p95、实际 HTTP 次数及错误类别，包含 read_page_context 对照 |
| P0-3 | 定向采用最新快照模板；补安全重试；建立独立进程隔离测试 | 内部 Adapter + 公共 helper 测试 | 同轮同配置并发只发布一个快照；重启复用；跨身份/轮次/凭据/配置不复用 |
| P1-1 | 修正 Skill 的总量卡、选行、完整占比及精确字段使用说明 | 公共 Skill | 单行总量卡无虚构维度；模型以返回字段 ID 组装；独立记录真实模型验收 |
| P1-2 | 解耦完整证据与 initial 样本，补未知总数语义 | 公共查询/装配 | 41 行完整结果可证明占比，20/41 截断拒绝，未知总数不得伪造完整；模型通道仍有界 |
| P1-3 | 规范名/歧义别名处理；三类维度名称事实对账 | 公共语义投影 + 内部协议 | 同名/别名冲突及输入顺序变更不改变指标选择；输出字段与真实 DQE 一致 |
| P1-4 | 统一口径格式并覆盖编辑路径 | 公共页面装配 | compose/edit 文案一致；来源替换/删除后无陈旧口径；失败需求明确未完成 |
| P2 | 显式排序语义与可信格式治理；revision 0 全链契约核对 | 公共语义/契约 + Java/内部 Adapter | 时间筛选排行不误排；创作与渲染一致；币种有来源；保存/回读/后续编辑版本一致 |

P1-2 的具体 Interface、歧义候选行为和排序意图如何进入取数单元，属于实施前应确定的设计问题；不通过宽松开关绕过。优先复用程序状态已有 rows/returnedCount/totalCount，避免新增完整行进入模型的通道。

必要的隔离验收矩阵：

- 真实两个独立 Python 子进程 + 同一 SQLite；同键并发、进程退出后恢复、过期 owner 迟到、读取期间取消。
- actor/workspace/turn/run/request/contextRef 分别变化；凭据更新、dataset 子集、投影配置变化分别触发隔离；缓存命中后撤权阻止查询/结果返回。
- 未缓存的完整/partial/超限情况；发布后不换版；新轮刷新；detail 与全量读取一致。
- strict/relaxed 不能复用错误政策的结果；永久查询错误不重试，瞬断有界重试；成功不可变；未知保存不重发。
- 同步前后内部目录逐文件字节一致；公共本地补丁导致零写入；安装包与源码实际导入一致；中断同步的恢复演练。

## 本轮验证与限制

运行：

```sh
PYTHONPATH=metriccanvas-authoring/tool:metriccanvas-authoring/test-harness:metriccanvas-authoring/test-harness/tests FASTMCP_CHECK_FOR_UPDATES=off metriccanvas-authoring/tool/.venv/bin/python -m unittest test_deployment_sync test_authoring_tolerance test_dataset_metadata_http test_authoring_turns test_query_validation_policy
python3 metriccanvas-authoring/scripts/check_bundle.py
```

结果：59 tests 通过；Bundle 0.3.1 的 1665 项摘要检查通过。测试中存在 TemporaryDirectory 清理 ResourceWarning，无失败。

这批测试证明现有公共同步保护、若干轮次/授权/政策检查、查询恢复和模板接线的本地行为。名称带 restart 的元数据测试重新创建应用对象，不能代替真实多进程验收。真实 Relay/Java/DQE、9235/9236 回放、真实模型、浏览器、部署升级/回滚均未运行。本轮不宣称整个隔离矩阵已验证，也不宣称生产稳定性已有保证。

主要源码依据：

- [模板元数据读取](../../metriccanvas-authoring/examples/adapter_template/firstparty/dataset_metadata_http.py)，`_read/_acquire/detail/current_for_query`。
- [快照状态机](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/metadata_session.py)，[迁移约束](../../metriccanvas-authoring/AUTHORING-TOLERANCE-MIGRATION.md)，[ADR-0092](../adr/0092-authoring-tolerance-and-turn-metadata-snapshots.md)。
- [查询恢复与授权](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/results.py)，[轮次校验](../../metriccanvas-authoring/tool/metriccanvas_authoring/work/authoring_turns.py)，[平台工具流程](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/platform_authoring.py)。
- [同步实现](../../metriccanvas-authoring/scripts/sync_upstream.py)，[同步验证](../../metriccanvas-authoring/test-harness/tests/test_deployment_sync.py)，[部署交接](../../metriccanvas-authoring/RELAY-HANDOFF.md)。

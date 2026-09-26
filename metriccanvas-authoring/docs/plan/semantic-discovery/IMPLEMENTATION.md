# 首期实现与验收记录

日期：2026-09-26。结论：公共首期实现落地，小范围确定性和 DS 真实调用验证通过；公司 Relay/Java/DQE/知识库生产接通未验证。执行依据为用户批准方案，并要求 gpt-5.6-sol 子代理进行 DS 真实调用、只做必要简单测试。

入口：[接入手册](../../../SEMANTIC-DISCOVERY-HANDOFF.md) / [Spec](SPEC.md) / [设计](DESIGN.md) / [计划](PLAN.md)。

## 交付与归属

- 公共 `data/discovery/`：可选知识/模型/检索/可信事件端口、文本召回、需求分组、候选来源验证、预算与降级。
- 公共 `work/discovery_tasks.py`：持久化原始需求和选择，revision/CAS/租约/幂等/TTL，修改及取消；新轮次使用新 context_ref，taskRef 只恢复需求。
- 公共 SemanticCatalog：基础模式兼容、增强模式显式装配；查询检查不再触发发现/模型/核对卡。保留已有公开投影与严格/宽松策略。
- MCP：9 个工具及输入参数不变；能力声明 discoveryProtocolVersion；模型摘要与程序 interactionEnvelope 分离。Relay 须实现真实路由。
- `contracts/authored/discovery.schema.json`：知识、模型提案、可信调用的正式输入 Schema。交互输出和内部记录由公共实现及针对性契约测试约束，目前没有独立 JSON Schema。
- `examples/adapter_template/`：mock 知识、HTTP 模型、可信 Relay 回调、SQLite 清理参考；内部 `tool/metriccanvas_authoring/adapters/` 未代替公司编写。工厂接线示例见接入手册。
- Skill：增强模式下不默认选择歧义指标，解释 ready/partial/paused、一次核对与可信续接。

基线 HEAD 为 `3260725df3b28d1082fee4f69f5564fe1296e353`。开始时已有大量 remediation 与无关暂存修改；本次在其基础上集成，不认领这些改动。基线文件摘要及 staged diff 保存在 `/tmp/mc-discovery-implementation-before.json`、`/tmp/mc-discovery-implementation-index.patch`。基线摘要复核：28 个新增/变化文件全部位于 metriccanvas-authoring/，目录外和内部 adapters 变化均为 0，原 staged diff 字节一致。本次不提交、合并或推送代码。

## 设计落地边界

1. 不依赖向量；元数据名称、最多 100 个别名、口径文本及 mock 业务知识参与检索。排序不是置信度或授权。完整授权范围中规则证据充足才自动选择。
2. 模型可选；明确需求跳过模型。有歧义时仅接受已授权候选和已知来源引用，提案不能授予查询权限。每需求修订共享最多 2 次模型预算；每次发现至多一次解释调用，最多一次有来源支撑的补充召回。
3. 冲突识别覆盖来源显式冲突及退款/税等极性规则，不承诺完整自然语言蕴含判断。公司真实问法召回和歧义识别效果仍需独立语料评估。
4. 证据版本变化保守失效，未实现细粒度语义等价证明。未知完整性不证明唯一；草稿知识不能充当事实依据。
5. 外部 retrieval 当前返回可验证的已授权源 candidateRefs，补充到首个需求组；完整多需求远程检索/分页索引未实现。预留接口不是外部向量服务已接通。
6. 原始需求/用户选择是任务状态，不是查询授权；增强任务检查选中指标、关系依赖、明确时间/分组约束，随后仍走既有精确请求授权。共享一次用户动作的生产接线需内部 Relay 实现。
7. 单张核对卡后未解决项暂停；精确自由文本选择记为 user_text，其他补充重新解释；选择不能消除真实冲突。

## 必要确定性验证

未跑全量测试、完整 adapter layer、浏览器或截图。

| 验证 | 结果 | 范围 |
|---|---|---|
| test_discovery.py | 11 通过 | 句内别名、多需求/主题、知识/模型故障、候选来源、核对与自由文本、修改/取消、SQLite 跨子进程读取、CAS/租约预算恢复、越权/过期、MCP 双通道、查询不重入发现 |
| test_semantic_catalog.py | 2 通过 | 原有目录基本行为 |
| test_query_validation_policy.py | 10 通过 | 发现维度到查询、M→month、严格/宽松切换与兼容性 |
| scripted edit-report | 通过创建+调整 2 条 | 0 模型调用，0 token；纯标题调整不重新查询 |

查询策略测试首次检出精确时间维度排在弱口径匹配指标后的回归，已统一指标/维度排序，10 项复验通过。真实进程 kill 故障注入、全部 AT01–AT20 组合及规模性能评测没有执行；租约恢复为确定性模拟，不等同真实进程崩溃验收。

命令（解释器使用目录内既有 venv）：

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=metriccanvas-authoring/tool metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_discovery.py
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=metriccanvas-authoring/tool metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_semantic_catalog.py
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=metriccanvas-authoring/tool metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_query_validation_policy.py
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=metriccanvas-authoring/tool metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py --scripted --output /tmp/mc-discovery-scripted-final-20260926 --cases edit-report
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
```

分发校验：authoring:contracts 已生成；authoring:contracts:check 通过（510 product、4 authoring、1 interface）；check_bundle.py 通过（bundle 0.3.1，1655 项摘要校验）。

## DS 真实调用

执行代理为 gpt-5.6-sol，实际被测模型为 deepseek-v4-flash。保留早期失败，不只挑选成功结果。

| 运行目录（均在 /tmp/） | 请求 / token | 结果 |
|---|---:|---|
| metriccanvas-discovery-real-20260926-01 | 2 / 2,433 | 失败：初始 runner 缺准确提案 Schema，输出字段不符 |
| metriccanvas-discovery-real-20260926-02 | 0 / 0 | 失败：time 局部变量遮蔽模块，已修复 |
| metriccanvas-discovery-real-20260926-03 | 2 / 3,320 | 失败：提案有候选但无证据，公共校验正确拒绝；已补 Schema 条件和提示 |
| metriccanvas-discovery-not-needed-20260926-01 | 0 / 0 | 通过：明确指标由规则解决，未调用模型 |
| metriccanvas-discovery-real-20260926-04 | 1 / 2,289 | 通过：歧义销售表达与知识词，保留候选/证据/比较关系，awaiting_choice，没有自动选择；耗时 1.524s |
| metriccanvas-mainflow-real-20260926-01 | 10 / 206,819 | 通过：create-report + edit-report，其他 4 场景未跑 |

总计实际 15 次请求、214,861 token。发现 runner 的预算为 30,000；现有主流程 runner 的预算为 600,000，实际 206,819，不能混写成全部不超过 30,000。

主流程创建执行 read→discover→query→compose→preview；纯标题调整 read→edit→preview，不重新发现/查询，并校验仅标题变化。Java/DQE/Relay 为本地 HTTP 替身，知识和身份为受控 fixture。主流程证明既有链路兼容，不证明增强歧义状态经生产 Relay 端到端接通。

真实调用后仍补充了关系去重、精确自由文本选择、源 workspace/version 校验、查询时间/分组范围检查、基础维度排序与 Skill 说明；这些最终收尾只做确定性复验，没有追加付费采样。因此真实模型证据适用于上述被测路径，不能宣称最终每一行变更都被真实模型复测。

## 内部接手与未运行项

内部按接入手册装配现有 factory，依次实现可信事件、真实语义资料及 coverage、知识库映射和可选模型；当前没有 company/local/integrations 新目录。mock 不进入生产默认配置。

待内部验收：真实知识库权限/分页/版本，真实 Relay 卡片或等价文本回传，真实 Java/DQE/身份/保存/预览，以及公司独立语料的召回率和澄清率。本次没有远端 CI、commit、merge、push 或生产效果声明。

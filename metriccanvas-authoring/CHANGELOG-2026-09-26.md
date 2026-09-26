# 2026-09-26 变更说明：语义发现与 Adapter 接入

本次提交包含增强语义发现，以及其依赖的公共语义投影、查询校验整改。修改范围为 `metriccanvas-authoring/`；不包含内部 `tool/metriccanvas_authoring/adapters/` 的本地修改，也不包含目录外文件。

## Adapter 改动重点

| 位置 / 接口 | 公共侧变化 | 内部接手动作 |
|---|---|---|
| `AuthoringAdapters` / `create_adapters()` | 保持 `authoring-adapters/1.0`，无新增必填字段 | 原工厂可继续运行；需要增强发现时显式装配下列可选依赖 |
| `SemanticCatalog(metadata, store, discovery=...)` | 新增 `DiscoveryDependencies`；未传时为基础模式 | 在现有 factory 中注入可信事件、知识库、可选模型和检索实例，不新增顶层集成目录 |
| `TrustedDiscoveryContextPort.current(binding)` | 接受经 Schema 验证的真实消息及续接事件 | 在内部 `adapters/relay/` 实现已认证消息回调，保证 actor/workspace/session 与当前调用一致；任务续接使用 taskRef/revision，新轮必须使用新 context_ref |
| `BusinessKnowledgePort.search(...)` | 新增业务术语、说明、分析主题协议 | 在内部 `adapters/firstparty/` 转换真实知识库字段、权限、来源版本、审核状态、完整性；Java 已有 aliases/definition 不需重复维护 |
| `DiscoveryInterpretationPort.propose(context)` | 新增有来源约束的模型提案；模型不能确认选择 | 可选接入公司模型，显式传入端点与认证；不配置时规则发现仍工作 |
| `CandidateRetrievalPort.retrieve(...)` | 预留无向量依赖的召回接口 | 可先不实现；将来接检索服务，引用必须能回到当前已授权源资料。当前补充到首个需求组，不是完整远程索引方案 |
| MCP 返回路由 | 模型摘要与 interactionEnvelope 分离，增加 discoveryProtocolVersion 能力声明 | Relay 将摘要交给模型，将交互数据渲染为一张核对卡或等价文本；真实用户选择经可信事件回传 |
| StateStore | 复用现有 read/CAS，持久化原始需求、选择、证据、revision/租约/TTL | 使用持久存储；参考模板增加 `purge_expired_discovery(now)`，仅清理过期发现记录，按公司策略调度 |
| Java 元数据 coverage | 公共模板在完整读取时增加 `scope='authorized'` | 内部按真实权限范围、分页和截断设置；不能把局部结果标为授权范围穷尽，否则唯一性判断失真 |
| `current_for_query(policy)` | 随本次纳入的前置整改新增可选方法；旧 `current()` 兼容 | 内部若需严格/宽松预检切换，按迁移文档采用；保留真实鉴权和 HTTP 协议映射 |
| `project_lab_snapshot` | 前置整改将中立 Lab 投影移入公共 `data/lab_projection.py`；公共 HTTP 模板调用它 | 内部 HTTP/认证/返回包解析继续保留在 adapter，按需复用公共投影，不再复制整套公共语义规则 |

参考模板新增：

- `examples/adapter_template/firstparty/discovery_knowledge.py`：明确 mock 数据源，仅用于验证。
- `examples/adapter_template/firstparty/discovery_model_http.py`：显式配置的 HTTP 模型参考实现。
- `examples/adapter_template/relay/discovery_context.py`：可信回调包装，不是生产 Relay 集成完成。

参考模板调整：`firstparty/data_context_http.py`、`firstparty/dataset_metadata_http.py`、`storage/platform_state.py`。这些都属于公共可更新文件。公司内部维护的 `tool/metriccanvas_authoring/adapters/` 不随本次提交覆盖；不要把整份参考模板直接替换内部认证与业务适配。

## 公共行为变化

- 支持句内名称/别名、口径文本及业务知识召回，区分多个备选指标和多个共同需求。
- 模型解释可选、有预算和来源验证；不依赖向量。只有确定性规则和范围证据充足才自动选择。
- 合并一次核对；真实冲突不能由选择覆盖。未解决部分暂停，独立部分可继续。
- 保存原始需求及任务选择，支持幂等、跨进程存储恢复、修改和取消。taskRef 不替代授权。
- 查询检查不再触发发现或解释模型；保留精确请求授权及前置整改的严格/宽松策略、时间粒度规范化、结果隔离。
- 9 个 MCP 工具输入和 Page Schema 不变。Skill 增加增强模式状态与续接说明。

## 内部升级顺序

1. 更新公共文件，保留内部 adapters、配置和运行数据；记录 Git 提交号，不能仅靠 Bundle 0.3.1 判断功能版本。
2. 对照 [查询校验迁移](QUERY-VALIDATION-MIGRATION.md) 核对公共投影、可选 current_for_query 和 coverage。
3. 对照 [增强语义发现接入](SEMANTIC-DISCOVERY-HANDOFF.md) 修改内部 factory，先接可信 Relay 事件与持久存储。
4. 接真实知识库；可选接模型；按公司原始问法验证歧义、一次核对、跨轮选择与查询授权。生产配置不得自动回退 mock。

## 验证与限制

本轮执行 23 项针对性测试、创建/调整两条无模型主流程，均通过；契约导出及 bundle 校验通过。gpt-5.6-sol 子代理执行 DS 真实调用，最终歧义发现及创建/纯标题调整通过；早期失败及调用量保留在 [实施记录](docs/plan/semantic-discovery/IMPLEMENTATION.md)。未跑全量测试。

真实模型后少量收尾修改仅做确定性复验。Java/DQE/Relay 为本地替身；真实内部知识库、Relay UI、生产身份与保存/预览联调未运行。外部检索、多领域冲突识别和召回效果的边界见接入手册，不能将本地通过当成生产效果保证。

提交前另从 Git 待提交树导出独立快照，排除未提交内部 adapter 的影响：22 项通过，1 项因本地调查 JSON 不属于仓库分发而按既有测试规则跳过；bundle 校验通过（1656 项摘要）。原工作区上一轮 23 项通过与独立快照结果分别记录。

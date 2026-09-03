# MetricCanvas Agent 创作链完整迁移方案

> 状态：Accepted for implementation；M0 已完成，M1 契约/基线已覆盖首批事件序列，M2 compose、
> 指标/维度/枚举值/相对时间/意图/结构操作解析与有序并发切片已完成
>
> 基线日期：2026-09-03
>
> 基线提交：`2a472ff feat(page-assets): J4 Python 与 platform 接线、真实本地纵切 (#94)`
>
> 依赖决策：[ADR-0030](../adr/0030-transient-page-state-for-ask-and-explore.md)、
> [ADR-0031](../adr/0031-metrics-as-data-context-discovery-anchor.md)、
> [ADR-0032](../adr/0032-authoring-time-query-verification.md)、
> [ADR-0037](../adr/0037-ask-orchestration-and-interaction-contract.md)、
> [ADR-0055](../adr/0055-scope-groups-as-section-boundaries-in-ask-answers.md)、
> [ADR-0058](../adr/0058-latest-session-checkpoint-restores-transient-page-state.md)、
> [ADR-0060](../adr/0060-static-svelte-java-page-governance-relay-python-authoring.md)、
> [ADR-0061](../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)、
> [ADR-0063](../adr/0063-relay-dqe-facts-revise-authoring-boundaries.md)、
> [ADR-0064](../adr/0064-agent-returns-page-artifact-relay-and-java-own-persistence.md)

## 1. 目标

把当前 `apps/platform` 中已经验证的问数、多轮创作、页面装配与会话恢复行为，迁移到
「静态 Svelte SPA + Relay/Skill + Python FastMCP Tool + Java 页面资产 Module」。迁移完成后：

- 生产创作链不再执行 TypeScript/Node 服务端代码；
- Relay 是唯一模型调用和 Agent 运行宿主；
- Python 是取数约束、DQE 验真、页面装配和创作期校验的真源；
- Java 是页面资产校验、不可变页面修订、幂等与并发冲突的真源；
- 问数/探索仍使用临时页面态，只有用户显式沉淀才进入资产态；
- 迁移前后的可观测行为有自动化证据支撑，所有差异都被解释或写入 ADR。

本计划迁移的是行为，不是逐文件翻译。「功能完整一致」指相同 Interface 上可观测的结果、
事件顺序、失败分类、权限、幂等和性能下限一致，不要求模型思考轨迹、日志文本或内部代码形状一致。

## 2. 范围与非目标

### 2.1 迁移范围

1. 业务域路由、数据能力发现、指标/维度/取值/时间解析和候选消歧。
2. 取数单元首轮形成和多轮 `add/modify/replace/remove` 定向修改。
3. 条件式取数核对、临时指标与指标需求条目。
4. 查询清单校验、DQE 真实执行、结果字段契约、formula 留痕和四段失败归因。
5. 分析意图、组件硬闸、用户钉住项、口径组、页头、布局和完整页面校验。
6. 步骤事件、交互等待、取消/超时、会话检查点恢复和精确修订预览。
7. 用户身份从 Relay 到 Python、DQE 和 Java 的不可伪造传递。
8. 差分验收、真实 Relay/模型/数据环境验收、影子流量、灰度、回滚和旧实现删除。

### 2.2 非目标

- 不在 Java 或 Python 内建第二套模型调用链。
- 不把通用中文分词器当成业务语义理解的真源。
- 不比较 token 级分词、模型思维链、日志文案或可变的工具调用次数。
- 不新增租户模型、发布工作流、定时发布、业务回滚或 Monitor。
- 不在此迁移中改变 Page Metadata 的长期版本策略。

## 3. 当前实现和已知缺口

### 3.1 已有基线

- TypeScript `Ask` 编排是确定性代码驱动的固定顺序状态机：
  业务域路由 → 指标与维度检索 → 候选消歧 → 口径成形 → 清单校验 → 真实执行
  → 意图判定与组件选择 → 呈现。
- 只有三类结构化模型决策：`routeDomains`、`formUnit`、`decideIntent`；检索、
  消歧、清单校验、DQE 执行、组件硬闸和页面装配是确定性行为。
- Python Bundle 的 compatibility 工具面保留 `discover_data_context` 和 `build_page`；Relay 目标工具面已改为
  `discover_data_context` 和 `compose_page`。目标 Skill 已写明注册前提、工具调用契约、九阶段状态机与多轮语义，
  但当前 Relay 仍未用固定工作流执行器强制这些步骤。
- Python `compose` 已能从 Page Build Spec 派生查询、对最多 6 个单元有序并发执行 DQE、
  装配并校验页面文档；当前 `build_page` 兼容包装在 compose 成功后继续调用 Java 保存页面修订。

### 3.2 已知缺口

| 缺口 | 当前事实 | 完成判据 |
|---|---|---|
| Agent 前半链 | Skill 已描述业务词拆分、三类模型决策、九阶段状态与多轮 patch；Relay 仍缺固定工作流强制和步骤事件持久化 | F01–F06 通过跨实现验收 |
| 业务词解析 | Python 已对齐指标规范名/别名/最长命中/稳定排序/歧义，以及维度、封闭取值域、相对时间、分析意图和结构操作首批语法；业务域仍由结构化模型路由 | 扩充黄金问题并覆盖全部业务词反例 |
| 临时态/资产态 | 旧 Ask 成功产出临时页面态；现 `build_page` 必然保存修订 | 按 ADR-0030 恢复两速生命周期 |
| DQE 执行 | Core 已完成最多 6 个单元有序并发与稳定失败归因；生产 Adapter、超时/取消闭环未完成 | 真实 Adapter + 超时/取消/迟到结果验收 |
| Data Context | 生产 Adapter 未完成 | 真实 Schema 1.1 快照并通过数据上下文契约 |
| 身份 | 当前 env Adapter 是共享服务态身份 | Relay 服务端注入每用户身份，模型不可见也不可改 |
| 页面校验 | Python 接受 10/10 合法向量中的 8 条，154 条反例仅 21 条 `code/path` 对齐 | 10/10 合法、154/154 反例全对齐，pending 清单为空 |
| Relay 集成 | 没有真实 Relay/LiteLLM/GLM 闭环证据 | 真实黄金问题、工具调用、事件、取消与结果透出验收 |
| 会话恢复 | Relay 只有 `session_id + version_id` 增量重放，无 Run 断点续跑 | 明确 Relay 会话与 MetricCanvas 会话检查点映射 |

## 4. 目标 Module、Interface 与 Seam

| Module | 对外 Interface | 隐藏的 Implementation | Seam / Adapter |
|---|---|---|---|
| Svelte SPA | Chat 输入、步骤事件、交互回复、临时页面、精确修订预览 | Relay 协议细节、页面组件渲染 | Relay WebSocket Adapter、Java HTTP Adapter |
| Relay Agent Workflow | `execute(command) -> ordered events + outcome` | 状态机、三类模型决策、重试、确认等待、取消与恢复 | M3A Skill-Play；M3B Relay 可执行扩展或等价强制层 |
| Data Discovery | `resolve(question, domains?, limit) -> governed matches + ambiguities` | 业务词识别、别名、候选排序、消歧、敏感取值隐去 | DataContextPort + 真实/Fake Adapter |
| Python Authoring Core | `compose(spec, context) -> PageBuildArtifact` | 清单、查询/字段派生、DQE、组件硬闸、装配和校验 | DqeExecutionPort + 真实/Fake Adapter；不含页面保存 Port |
| Relay Session | `appendEvent` / `loadCheckpoint` / `saveCheckpoint` | 90 天保留、可见性、乐观并发、artifact 双通道与过期清理 | Relay durable-state Adapter |
| Java Page Assets | `savePageRevision`、`getLatestPage`、`getPageRevision`、`listPages` | 完整复验、不可变修订、幂等、基线冲突、审计 | HTTP Adapter + 本地纵切 |

设计约束：外部 Interface 是验收面。复杂度应留在上述深 Module 内，不应把每个算法步骤拆成模型可见的
MCP tool。对真实 Data Context、DQE、Java 这些远程但自有的依赖，在 seam 定义 Port，生产使用 HTTP
Adapter，契约测试使用内存 Adapter。

## 5. 目标执行流程

```text
Relay Session Module 读取最新会话检查点
  → Svelte 提交问题/追问 + session + 结构化续跑状态 + target + 用户覆盖项
  → Relay 加载 Skill
  → 模型决策 1：业务域路由（用户已指定/追问沿用时跳过）
  → Python 确定性解析业务词，检索指标/维度/取值/相对时间词
  → 确定性消歧；并列最高分时停下等待用户
  → 模型决策 2：形成取数单元或定向操作集
  → Python 清单校验；可修复违规最多回给模型一次
  → 条件式取数核对；歧义/formula/临时指标/模型补时间/超阈值才阻塞
  → Python 派生 DQE 和预期结果字段契约
  → 最多 6 个取数单元有序并发真实执行，并校验实际结果
  → 模型决策 3：按每个取数单元判定分析意图
  → Python 组件硬闸、用户钉住项、口径组、页头、12 列布局与完整页面校验
  → Agent 输出结构化步骤事件与已校验临时页面文档
  → Relay Session Module 经 artifact 双通道保存步骤事件和最新会话检查点
  → 返回临时页面态给 Svelte 统一运行时渲染
  → 用户显式沉淀时，由平台能力调用 Java savePageRevision 创建资产态修订
```

### 5.1 「分词」的精确位置

- 模型 tokenizer 是 Relay/固定内网模型的 Implementation，不写进 Skill，也不作为功能等价的比较项。
- 业务语义分解是 MetricCanvas 的确定性行为：要识别业务域、指标条目、维度、维度取值、
  相对时间词、分析意图词和结构操作词。
- 真源不是通用分词结果，而是数据上下文快照的规范名、别名、取值域、相对时间词表和确定性排序。
- 任何通用 tokenizer 只能成为候选召回的可替换 Adapter，不能越过数据上下文闭集或自行消歧。

### 5.2 三类模型调用契约

| 决策 | 最小输入 | 结构化输出 | 纪律 |
|---|---|---|---|
| `route_business_domains` | 问题 + 业务域名/简介 | 最多 2 个规范业务域 | 用户覆盖优先；结果可见可改；失败重试 1 次 |
| `submit_data_request_units` | 问题 + 命中域语义面 + top-N 候选 + 上轮单元 + target | 首轮单元集或 `add/modify/replace/remove` | 只能用闭集名；未提及显式设置不变；最多 6 个单元 |
| `submit_analysis_intent` | 当前单元口径 + 上轮意图 | 六类意图之一 | 按单元调用；不注入其他单元的问句词；失败重试 1 次 |

模型只提交上述决策；DQE 查询体、结果字段契约、组件 JSON、布局和页面协议版本不允许由模型填写。

## 6. 功能等价矩阵

| ID | 可观测行为 | 当前基线 | 目标所有者 | 必要证据 |
|---|---|---|---|---|
| F01 | 业务域路由可见、可覆盖、追问沿用与零命中重路由 | TS Ask | Relay Workflow | 状态机向量 + 用户覆盖 E2E |
| F02 | 规范名/别名/最长命中/匹配分数/稳定排序 | TS retrieval | Python Discovery | 候选列表精确差分 |
| F03 | 并列候选阻塞，系统和模型不暗自选择 | TS Ask | Relay + Python | 歧义向量、交互事件和恢复 E2E |
| F04 | 只在封闭风险集上阻塞取数核对 | TS Ask | Relay Workflow | 每个阻塞原因正反例 |
| F05 | 首轮多视角和最多 6 个取数单元 | TS Ask | Relay + Python | 单元集、上限和不静默截断向量 |
| F06 | 多轮定向 patch，未提及的显式设置保持不变 | TS Ask | Relay Workflow | 未触及单元 canonical JSON 等价 |
| F07 | 查询清单、真实执行、结果字段契约和四段失败 | TS MCP | Python Core | DQE request、field contract、`code/path/stage` 差分 |
| F08 | formula、可加性、比率、时间聚合、临时指标和指标需求条目 | TS Ask/MCP | Python + Session | 公司口径/临时指标/缺口三类向量 |
| F09 | 每轮最多 6 单元、有序并发、超时、取消和尽力而为语义 | TS Ask | Relay + Python | 顺序、并发上限、取消后迟到产物不自动保存的向量 |
| F10 | 按单元分析意图、组件硬闸、用户钉住保持 | TS Ask/MCP | Relay + Python | 意图和组件推荐差分 |
| F11 | 口径组、三处差异可见、页头、比例装箱与页面校验 | TS assembly | Python Core | canonical Page JSON + 事件/回复向量 |
| F12 | 有序步骤事件、交互等待、重试、断线重放和检查点恢复 | TS Agent/Session | Relay + Session | 事件序列和恢复 E2E |
| F13 | 临时页面、显式沉淀、幂等重试、基线冲突与精确修订 | TS + Java | Platform + Java | 两速生命周期、同一保存命令一修订、冲突恢复 E2E |
| F14 | 本人/管理员会话可见性、用户身份执行 DQE 与 Java 审计 | TS mock + ADR | Relay/Java/DQE | 多用户负向权限测试 + 审计记录 |

## 7. 迁移切片

### M0：冻结语义和决策

交付：

- 完成本文 grill 决策树，每个叶子标为「已决」、「已有 ADR」或「不在范围」。
- 为编排所有权、临时/资产态 Interface、会话所有权和等价标准写新 ADR 或修订现有 ADR。
- 建立 [`metriccanvas-agent-approved-differences.md`](./metriccanvas-agent-approved-differences.md) 台账：
  每一笔差异必须有理由、所有者、到期日与 ADR 引用。

退出条件：本文不再存在会改变代码形状或验收口径的未决项。

### M1：Agent 中立契约与基线导出

交付：

- 业务词解析、域路由、取数单元操作、分析意图和步骤事件 JSON Schema。
- `agent-conformance` 向量：输入问题、注入的模型决策、数据上下文摘要、DQE fixture、期望事件、
  Port 调用、Page Build Spec、Page 文档和结果。
- TypeScript 基线导出器与只读漂移检查。

退出条件：选定的 30–50 条黄金问题和所有 F01–F14 反例可在不调真实模型的情况下重放。

状态：首批 4 份 Agent Schema、5 条 TypeScript 指标检索/消歧向量、10 条确定性业务词向量、5 条三类模型决策向量，
以及由生产 TypeScript 编排器执行导出的 3 条步骤事件/Port 调用向量已落地；完整 30–50 条黄金问题和 F01–F14
反例仍待补齐，M1 尚未退出。

### M2：Python 确定性核心补齐

交付：

- 迁移规范名/别名/最长命中/候选排序/歧义判定；指标、维度、封闭取值域、相对时间、分析意图和
  `add/remove/replace/split/merge` 结构操作的首批跨实现向量已完成，后续随黄金集补反例。
- 补齐指标条目的可加性、时间聚合、比率、可用维度、派生指标模板和 formula 轨迹。
- 从现在的 `build_page` 提取只返回已校验页面产物的 `compose` Interface；临时页面、会话检查点
  和资产修订的持久化不属于 Agent Core。现有 Python `PageAssetPort` 退出目标架构。
- DQE 有序并发，最多 6 个单元，失败返回稳定 `code/path/stage/retrySafe`。
- 补齐页面校验，删除 `page-conformance-pending.json` 中已对齐的白名单逻辑。

退出条件：10/10 合法向量被接受，154/154 反例 `code/path` 对齐，确定性输出无未解释差异。

### M3：Relay 工作流与 Skill

交付：

- M3A 先完成 Relay Page Artifact Adapter，再用纯 Skill ReAct 接通真实 Relay；完整页面构建产物
  写最新检查点并供 Svelte 读取，模型只接收摘要。该阶段是过渡实现，不算最终编排等价证据。
- M3B 在 M8 前于 Relay 可强制的执行层实现固定状态机或等价约束，不仅依赖 Markdown 提示。
- 固定三类结构化模型决策与最小上下文裁剪。
- 每个模型阶段失败重试 1 次，清单修复机会 1 次，不允许无界 Planner 循环。
- 补全 Skill frontmatter、状态、确认、多轮操作、失败和安全契约。
- 如 Relay 现有 Skill-Play 无法强制顺序、交互等待或进度，则修改 Relay Plugin/Mode/MCPToolProxy；
  不得用「Skill 写了」代替可执行证据。M3B 未完成时可以继续集成，但不能进入 M8。

退出条件：注入 scripted model 时，F01–F12 的事件、交互和结果可重放。

当前状态：Bundle 侧 Relay-ready Interface 已完成：目标 Skill 只允许
`discover_data_context + compose_page`，FastMCP 以 `METRICCANVAS_TOOL_SURFACE=relay` 显式启用同一
工具面，`compose_page` 成功结果使用 `metriccanvas.page-build-artifact` 判别信封，并以 Schema 锁定
完整 `artifact` 与无数据行 `modelSummary`。默认工具面仍是 compatibility，避免 Relay Adapter 缺失时
误把完整页面文档送入模型。M3 尚未退出；Relay 仓内的 Artifact Adapter、Session checkpoint、
WebSocket E2E 与可执行编排仍未实现。

Relay Page Artifact Adapter 的最小实现顺序固定为：

1. 只拦截 `metriccanvas-authoring.compose_page` 的成功响应，并验证 Artifact 信封 Schema。
2. 校验当前 `session_id`、预期 checkpoint version 和运行未取消；缺一项即不保存。
3. 将 `artifact` 写为该会话最新 MetricCanvas checkpoint，完整页面文档不进入追加事件正文。
4. 生成 `artifactId` 和递增 `checkpointVersion`，提交采用预期版本的乐观并发。
5. 向前端事件发送 `artifactId + checkpointVersion + documentSha256 + modelSummary`。
6. 用 `modelSummary + artifactId + checkpointVersion` 替换 MCP 工具结果后再交给模型；冲突、取消或
   保存失败返回结构化错误，不允许原始 Artifact 回退透传。

### M4：真实 Adapter、打包与身份

交付：

- `pyproject.toml`、sdist tar.gz、`uvx --from <tar.gz>` 和离线发布验证。
- Data Context HTTP Adapter 与 DQE HTTP Adapter；只经
  `POST /rest/cdi/cdinl2databuilderservice/v1/dsl/execute` 执行 DQE。
- Relay Plugin `on_tool_execute_before` 或 MCPToolProxy 改造，以服务端不可伪造方式注入用户身份。
- Relay 注入的用户身份到达 Python 与 DQE；平台自己的用户身份独立到达 Java，并被 Java 审计记录。

退出条件：真实数据上下文、真实 DQE、Java 保存和多用户权限测试全部通过。

### M5：Chat、事件、Relay 会话与恢复

交付：

- Svelte 通过 WebSocket `/ws/{client_id}` 与 `role_name` 唤起 Skill，业务参数使用
  `config.agent_context`。
- 把步骤进度映射到结构化事件，已校验 `PageBuildArtifact` 的受控摘要使用 `result_summary` 透出；
  正式修订标识只由平台调用 Java 保存后返回。
- 使用 `session_id + version_id` 增量重放，实现 `interrupt` 与取消后迟到结果处理。
- 按 ADR-0058 恢复最新已校验临时页面态、结构化续跑状态、钉住项与待确认交互。
- Relay Session 实施 90 天保留、本人/平台管理员可见性、检查点乐观并发和过期清理；Java 不复制会话。

退出条件：刷新、断线、重连、待确认恢复、取消、慢结果不覆盖新结果均有 E2E 证据。

### M6：差分与真实模型验收

计划新增以下命令（当前尚未实现）：

```bash
pnpm authoring:agent:export-baseline
pnpm authoring:agent:diff
pnpm authoring:e2e:relay
```

验收分两轨：

1. scripted model：三类模型决策固定，要求所有确定性结果、Port 调用和事件完全一致。
2. 真实 LiteLLM/GLM：30–50 条黄金问题，few-shot 与评测样本分开，每条至少重复 5 次；
   严格安全不变式必须 100% 通过，语义质量用「可接受替代答案」和统计不退化判定。

退出条件：无未解释 scripted diff；真实模型的安全门禁全过且质量指标达到 M0 冻结阈值。

### M7：影子流量、灰度与回滚

- 影子期不双写页面资产：Agent 只生成页面产物；平台保存链使用 no-op Adapter 或隔离的 shadow page id。
- 以会话为粘性单位，同一会话不在新旧链路之间切换。
- 建议节奏：内部用户 → 5% → 25% → 50% → 100%；每档至少观察一个业务周期，或达到 M0 冻结的最小样本量。
- 回滚只影响新会话；已在运行会话回放原链路，避免检查点形状不兼容。
- 监控指标：路由覆盖率、歧义率、清单修复率、DQE 失败分类、页面校验失败、
  临时指标率、p50/p95 时延、取消后保存、幂等重放和用户纠错。

退出条件：100% 新会话稳定运行，指标无超阈值退化，回滚演练成功。

### M8：切换真源与删除旧实现

- 宣布 Python 为页面创作确定性真源，停止 TypeScript 双实现演进。
- 删除已被新 Interface 验收覆盖的 TypeScript Ask/Agent/authoring Implementation 和浅层测试。
- 保留 Page Schema/registry 作者真源、中立契约导出、验收向量、差分历史、Java 完整复验和前端统一运行时。
- 使用依赖扫描和生产构建证明创作链无 Node 服务端运行时依赖。

退出条件：S5 完成；新 checkout 仍可从中立契约和向量复现最终验收。

## 8. 证据体系

### 8.1 证据层级

| 层级 | 证明什么 | 不能证明什么 |
|---|---|---|
| E0 完整性锁 | Bundle 和契约摘要无漂移 | 运行时行为正确 |
| E1 Interface 向量 | 给定输入的输出、事件、失败和 Port 调用正确 | 真实远程 Adapter 可用 |
| E2 跨实现差分 | TypeScript 与 Python/Relay 的确定性行为一致 | 真实模型稳定 |
| E3 Adapter 契约 | Data Context、DQE、Java 的传输映射正确 | 整条用户旅程正确 |
| E4 真实 Relay E2E | 真实 Skill-Play、模型、MCP、WebSocket 能闭环 | 长期质量无退化 |
| E5 非功能与安全 | p95、并发、取消、权限、幂等和冲突满足门禁 | 用户业务满意度 |
| E6 影子/灰度 | 在真实流量和分布下不退化 | 未来变更永远不回归 |

### 8.2 已有证据（2026-09-03）

| 证据 | 命令 | 结果 |
|---|---|---|
| Python Bundle 自洽 | `PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'` | 47/47 通过 |
| Bundle 完整性 | `python3 metriccanvas-authoring/scripts/check_bundle.py` | 394 项 digest 校验通过 |
| 中立契约 | `pnpm authoring:contracts:check` | 171 个产品文件、3 个 Authoring 文件、1 个 Interface 文件无漂移 |
| TS Ask/装配基线 | 定向 Vitest（Ask orchestrator、multi-unit、gap、model ports、retrieval、E2E、golden、MCP assembly） | 11 个文件、173/173 通过 |
| TS Agent/事件/UI 基线 | 定向 Vitest（agent、agent-events、authoring-mcp、workbench） | 18 个文件通过、1 个跳过；134 通过、3 跳过 |

### 8.3 目标架构首批切片证据（2026-09-03）

| 证据 | 命令/位置 | 结果 |
|---|---|---|
| 无保存 compose Interface | `test_compose_page.py` | 5/5 通过；依赖仅有 Data Context 与 DQE，成功产物通过 Artifact Schema，失败在远程调用前停止；多单元有序并发且失败按最低单元序号稳定归因 |
| 旧保存路径兼容 | `test_build_page.py` | 28/28 通过；`build_page` 已变为 compose 后保存的兼容包装 |
| Agent 中立契约 | `test_agent_contracts.py` | 5/5 通过；业务词、三类模型决策、步骤事件和 conformance Schema 合法，事件拒绝 DQE 结果行；5 条 TS 模型决策输出通过目标闭集 Schema |
| TS→Python 业务词解析差分 | `agent-conformance.json` + `test_business_terms.py` | 15 条向量逐字段一致：5 条指标规范名/别名/最长命中/排序/歧义，10 条维度/取值/相对时间/分析意图/结构操作（含跨域维度歧义） |
| TS 生产事件序列差分基线 | `agent-conformance.json` + `test_agent_contracts.py` | 3 条生产编排实跑向量通过：成功 6 事件，面外 discovery 降级，DQE 执行失败重试 1 次；事件顺序、终态、Port 顺序与执行次数均冻结 |
| TS 类型与旧行为回归 | `pnpm --filter platform check`；定向 Vitest | 0 error / 0 warning；检索、模型端口、编排 3 文件 25/25 通过 |
| Relay 双工具面与 Artifact 信封 | `test_stdio.py` | compatibility 面仍为 discover/build；Relay 面严格为 discover/compose；成功信封通过 Schema，摘要递归拒绝 document/rows/initial，失败不带 Artifact |
| Relay 目标 Skill | `quick_validate.py` + `test_skill_contract.py` | frontmatter 合法；Relay MCP 注册前提、两个工具的调用契约、三类模型决策与工具的区分、九阶段状态机、临时页完成条件和显式沉淀边界被测试锁定 |
| Bundle 当前完整回归 | `PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'` | 67/67 通过 |
| Bundle 完整性 | `python3 metriccanvas-authoring/scripts/check_bundle.py` | Bundle 0.2.0，415 项 digest 校验通过 |
| 契约生成 | `pnpm authoring:contracts` | 171 个产品文件、4 个生成 Authoring 文件、1 个 Interface 文件已生成；Authoring manifest 共 10 项 |

这组证据只证明 M1/M2 首批切片和 M3 的 Bundle 侧 Relay 接缝，不代表 M1、M2、M3 或整体迁移完成；
compatibility 工具面仍保留 `build_page`，Relay 工具面则只暴露 `discover_data_context` 与 `compose_page`。
真正切换前仍需 Relay Page Artifact Adapter 在 Relay 进程内隔离完整页面产物与模型摘要。

8.2 表是迁移前基线，8.3 表是第一个实现切片；两者都不是切换证明。尚未被证明的包括：真实 Relay、真实 LiteLLM/GLM、真实 Data Context、
真实 DQE、每用户身份、页面校验全对齐和 Agent 前半链跨实现差分。

## 9. 硬切换门禁

以下条件必须同时满足：

1. F01–F14 每项都有自动化证据，或差异已进入接受的 ADR 和 `approved-differences` 台账。
2. scripted model 差分为零未解释项。
3. Python 页面校验达到 10/10 合法向量、154/154 反例 `code/path` 对齐。
4. 真实 Relay 黄金问题通过，安全不变式成功率 100%。
5. `build_page` 或其替代 Interface 在真实 Relay 下 p95 ≤ 30s；否则从一次性 stdio 切换为常驻
   streamable HTTP Adapter，内部 Core 不改。
6. 多取数单元并发上限为 6，输出顺序稳定，超时/取消/部分失败可解释。
7. 真实用户身份到达 DQE 和 Java；跨用户读会话、越权查数和伪造操作人均被拒绝。
8. 同一平台保存命令的重试只产生一个页面修订；Agent 不得自行触发页面修订。
9. 刷新、断线、取消、超时、修订冲突和迟到结果都可恢复，不静默覆盖。
10. 生产创作链不需要 Node 服务端，回滚开关可按新会话生效。

任何一项不满足都不能删除 TypeScript 基线实现。

## 10. 回滚策略

- 在 M8 前保留旧 Ask 运行能力与基线向量，但冻结功能演进。
- 以会话粘性路由新旧实现；回滚时只将新会话切回旧链。
- 影子流量不得写正式 page id；已保存修订不删除，依靠精确修订标识审计。
- 新契约部署采用 expand/contract：读者先兼容新旧，写者后切换，最后删旧字段。
- 出现身份丢失、越权、错数、页面校验绕过或幂等破坏时立即停止灰度，不等待统计显著性。

## 11. 决策记录（grill 已收口）

以下记录会改变实现或验收口径的决策及其依赖 frontier；本轮 grill 已全部确认或采用后置默认值。

### 已确认

- D1（2026-09-03）：目标覆盖完整 Ask/Explore Agent，按 M0–M8 分阶段交付。
- D2（2026-09-03）：确定性结果、事件、失败、Port 调用、权限与幂等在 Interface 上严格等价；
  真实模型以可接受答案集合和统计不退化验收，不比较思考轨迹或回复文案。
- D4（2026-09-03）：Agent 只产出通过校验的临时页面文档；临时页面的步骤事件与会话检查点保存
  属于 Platform Session Module，用户显式沉淀才进入 Java 页面资产 Module。
- D5（2026-09-03）：冻结三类结构化模型决策及调用预算，不允许通用 Planner 自由循环：
  域路由按需调用，口径成形允许一次失败重试和一次清单修复，分析意图按被触及单元调用并允许一次重试。
- D3（2026-09-03）：纯 Skill ReAct 只用于 M3A 过渡接线；最终 M8 前必须补可执行状态机或等价强制约束，
  否则不能宣称固定编排行为等价。
- D7a（2026-09-03）：Agent/Python 只返回已校验 `PageBuildArtifact`，不保存临时页面、会话检查点或
  正式页面修订；平台显式保存时直接调用 Java 页面资产 Module。Python `PageAssetPort` 退出目标架构。
- D7（2026-09-03）：最终模型可见 MCP Tool Interface 保持两个深工具：
  `discover_data_context` 与 `compose_page`；后者经 Relay artifact 双通道返回页面构建产物。
- D8（2026-09-03）：Relay Session 是分析会话、步骤事件和最新检查点的持久化所有者；
  Java 与浏览器不复制第二份会话库。
- D9（2026-09-03）：页面校验欠账不阻塞早期 Relay 接线，但 M8 前必须达到 10/10 合法页面和
  154/154 反例 `code/path` 对齐。
- D10（2026-09-03）：真实模型使用 40 条黄金问题、每条 5 次；安全与闭集不变式 100%，
  整体可接受答案率不低于 90% 且不比旧链低超过 5 个百分点，任何问题不得 0/5。

### 后置默认值

- D11：影子流量只在真实用户身份门禁通过后执行真实 DQE；产物写隔离的 Relay shadow session，
  不创建正式页面修订，评测导出只保留脱敏摘要。
- D12：灰度采用内部用户 → 5% → 25% → 50% → 100%；身份、越权、错数、页面校验绕过或
  自动保存任一事件立即停止，不等待统计显著性。
- D13：100% 流量稳定一个业务周期并完成回滚演练后删除旧 Implementation；会话按 90 天保留，
  conformance 向量永久随仓版本化，线上差分报告至少保留 180 天。

### Frontier 1：根决策

- D1：已确认，见上。
- D2：已确认，见上。

### Frontier 2A：D1 选择完整 Agent 或分阶段完整目标

- D3：已确认，见上。
- D4：已确认，见上。
- D5：已确认，见上。

### Frontier 2B：D1 选择仅 Page Builder

- D6：不适用；D1 已选择完整 Agent。

### Frontier 3：依赖编排、生命周期与等价标准

- D7：已确认，见上。
- D8：已确认，见上。
- D9：已确认，见上。
- D10：已确认，见上。

### Frontier 4：依赖 Interface 和验收冻结

- D11：采用后置默认值；真实环境接入时可通过 ADR 调整。
- D12：采用后置默认值；业务签字人在进入 5% 灰度前指定。
- D13：采用后置默认值。

## 12. 完成定义

「迁移完成」同时意味着：M0–M8 全部退出条件成立，F01–F14 无缺口，硬切换门禁全部通过，
回滚演练成功，生产创作链不执行 Node 服务端代码，并且新实现的任何有意差异都有接受的 ADR 和可重放证据。

# 创作契约与执行链整体调整策略

日期：2026-10-27。状态：本仓公共层实施及本地验收已完成；内部 Adapter 采用和真实部署联调待验。原调查事实保留，实施范围与证据见文末。

## 1. 结论和证据范围

应优先修复公共契约与执行链的一致性：时间类型必须在所有查询入口成立；已知错误必须有准确、可操作的公共诊断；同一组件的不同表现必须使用一致的可信证据。已有能力应补齐采用与接线，不另造业务域推荐、指标汇总组件或跨轮缓存来绕过问题。

固定代码基线：`54021ab6776c37c8e7e5f669e6c76cc88a3d7a48`（2026-10-27 fetch 的 origin/main）。原工作区处于较旧提交且有大量并行改动，因此在 `/tmp/mc-authoring-audit-Btt485` 导出固定提交进行读取和验证。相关 data/pages/tools/mc-content 源码与前次对照的 `a7033134` 没有差异。

用户提供两份调查附件。本轮直接读取的是附件中的日志摘录和结论，未取得原始生产日志、实际部署源码或生产服务访问。区分：

- **本地复现**：实际公共函数、MCP 入口、MC 检查器，加合成数据和 Fake/Mock Adapter；不代表线上因果已闭合。
- **源码确认**：固定提交的调用路径和现行 ADR；不代表部署已经采用。
- **附件证据**：报告提供的请求/回执片段；需以原始关联调用补齐部署因果。
- **外部未验**：IAM、真实 DQE 编码、Relay 工具包装层、最终页面是否由九月转八月。

本轮证据入口：[离线复现说明](../evidence/authoring-session-audit-20261027/README.md)。现有相关回归 56 项通过；新增探针 15 个测试方法中，8 个缺陷探针失败（含 strict/relaxed 子场景，共 9 条断言失败），7 个对照通过。这是确认未修复缺陷的调查结果，不能称为功能验收通过。

## 2. 已有职责与不变量

现行依据：ADR-0091（语义预检策略）、ADR-0092（输入容错与同轮快照）、ADR-0083（工作稿与内部保存）、ADR-0105（共用数据执行）、ADR-0114（非 SUCCESS 带行的消费规则），以及 `docs/plan/2026-10-24-layout-standards/architecture.md` 的 MC 能力提供方边界。

1. MC 提供事实、确定性计算和检查；Skill 决定采用及流程。检查报告不新增保存/交付准入，也不暗示撤销已完成保存。
2. relaxed 只放宽缺少语义证明的情形；日期非法、粒度和值精度冲突、起止倒置属于确定性输入错误，不应放宽。
3. 用户的指标、地区、时间范围、明细/汇总意图不因工具失败而自动改变。
4. 页面工作版本、数据上下文版本、结果引用、产物引用是不同身份；同一个 context_ref 不代表内容未变化。
5. 诊断可解释且有界；原始上游错误、SQL、凭据、未授权来源不直接放进模型摘要。
6. 保存未知/待定/拒绝、并发冲突、撤权和取消保留现行处理；减少模型读取不移除服务端当前状态核验。

## 3. 逐项发现与调整方向

### T1 时间类型与范围：公共入口缺少一致校验（P0）

**复现**：`create_query_data` 接受 `month + 2026-04-01/2026-09-30`，strict/relaxed 均调用执行器；真实 FastMCP `query_data` 入口也返回 ready 并调用 Fake DQE。倒置月份 strict 下仍执行；relaxed 下 `day + 2026-02-30`、`year + 2026-04` 也执行。这里的 ready 是合成执行器返回成功，用来证明前置校验缺失，不证明真实 DQE 接受错误输入。

**原因定位**：

- `contracts/authored/page-structure-plan.schema.json` 与 `page-build-spec.schema.json` 中 granularity/start/end 仅为非空字符串。
- `data/results.py` 从结构计划派生 QUERY_SCHEMA；MCP 公布的约束因此同样不足。
- `data/validation_policy.py:55 normalize_request` 只兼容 `M → month`，未校验日期。
- `data/executable_units.py:295 _query_body` 校验粒度闭集/元数据能力，但 start/end 原样进入 DQE body。
- `data/business_interpretation.py:37 _time` 已有 year/month/day 格式、日历合法性和顺序校验，但只服务业务解释分支，不是所有查询的共同入口。
- 当前参考 `adapters/firstparty/dqe_http.py` 原样发送有效查询 body，没有附件所述 ISO 去分隔符转换。线上 `20260401` 的产生位置仍需部署代码证明。

**整体规则**：共用一个纯时间解析/规范化能力，由权威查询入口强制调用，语义能力检查随后执行；复用到业务解释分支，避免两套日期规则。

| 粒度 | 规范时间值 | 已知等价紧凑写法 | 必须拒绝 |
|---|---|---|---|
| year | `2026` | `2026` | 月/日精度值，非法年份，倒置范围 |
| month | `2026-04` | `202604` | 带日的值、13月、倒置范围 |
| day | `2026-04-01` | `20260401` | 不存在的日期、非闰年2月29日、缺月/日、倒置范围 |

紧凑写法与 `M` 别名已有消费，应在迁移评估后保留明确等价规范化并回显 adjustments；不能接受任意字符串再猜格式。先规范化再固定授权请求、摘要和结果身份，防止等价写法生成不同缓存身份或授权检查前后输入不同。不得默默把日范围扩大成月范围。年度查询能力不等于所有现有筛选 UI 已支持年度，本批不借机扩展 UI。

**编码职责**：公共层拥有时间语义；特定 DQE Adapter 拥有目标协议表示。`YYYY-MM → YYYYMM` 只能去分隔符，不能删日改变精度。相同执行环境下，创作首次执行、保存的查询定义及浏览器重查必须使用同一编码契约；不能只修 Python 首次查询。应先核对部署及 DQE 接口契约，再决定目标是否用紧凑格式，禁止把附件的一个 cube 例子推广为所有 DQE 端点规则。

**验收**：三粒度×规范/已支持紧凑表示×strict/relaxed；非法日期、闰年、倒置、混合精度；合法范围保持；非法输入调用执行器零次；规范化后的授权摘要/结果身份一致；首次执行与浏览器筛选重查一致。真实 DQE 年/月/日逐层另验。

### D1 业务域与发现：已有归属事实，应补错误定位而非靠换域（P1）

**源码确认**：`SemanticCatalog.discover` 已返回 businessDomain、指标身份、维度 queryBinding、时间 granularities、覆盖/截断信息及 `metricCompatibility=unknown`。`executionReadiness=not_checked` 明确不承诺可执行。旧 discover 分支也返回指标所属域；但 `PlatformAuthoring.discover` 的旧分支未投影内部 resolution/time 等结果，不能假设所有部署返回同一能力集合。

**实际限制**：`executable_units` 在选定域内匹配指标，失败候选是该域指标列表，并非“同一指标的其他可用业务域”。`SemanticCatalog._query_issues` 检查已有精确指标的定义冲突，不负责自动跨域重路由。不能从 CAGR 名字推断基础流水指标所在地，更不能把派生指标当替代指标。

**建议**：复用当前授权快照，为“域内无该指标”返回精确同名/已治理别名在其他域的候选及口径差异；字段/维度/粒度可组合性只能按真源声明，未知保持未知。已有候选采用问题与返回信息缺失分开。工具可建议重新选择，不能隐式改 businessDomain、放宽筛选或使用未经相同授权确认的请求。执行错误不建议盲目换域。

**验收**：同名跨域歧义、别名、不同币种口径、派生指标、partial 元数据、截断、无权限范围；错误域不执行 DQE；候选只来自当前可见快照；改变请求重新授权。

### E1 错误诊断：多层存在信息损失（P0，与 T1 同批）

**本地复现/源码**：

- `EditFailure` 只有 code/path，`change_component_type` 的部分拒绝没有具体路径；`apply_page_operation` 仅投影二者。
- `operation_batch._apply_operation` 用 `validator.is_valid` 把具体 schema 错误压成 OPERATION_INVALID；最终页面错误仅取 type/path。
- `pages/referenced.py` 的 add_result_component 异常分支将原路径改成空字符串。
- `QueryDataIssue` 有 message，但 `QueryResults._execute_one` 构造公共 issues 时主动不返回 message，只保留 code/path/stage/candidates/retrySafe 和笼统 action；公开错误仍使用内部 `/units/0` 路径，批次中不直接对应 `/requests/<index>`。
- `work/diagnostics.py public_issue` 已为少数 code 提供安全中文说明/action/recoveryOwner，可作为复用起点，不另建无主的提示词映射表。

**建议**：错误产生处提供结构化原因与合法上下文，公共投影负责稳定定位、有界安全说明和恢复方向。复用现有 code/path/stage/action/retrySafe，按需增补 expected/actual/candidates/recoveryOwner；不同时建立 suggestedAction 和 action 两套语义。路径明确属于调用输入或最终页面，并保留 operationId/blockId。未知外部异常提供诊断关联标识，不直接透传原始异常文本。

修复建议必须有前提：TYPE_CHANGE_UNSUPPORTED 区分占位文本、无 main 数据槽等；STRUCTURE_SOURCE_NOT_FOUND 提供当前可用来源引用；STRUCTURE_CHANGE_FIELD_INVALID 区分未声明、重复消费、非 measure；SCHEMA 错误给具体字段和支持操作。不要笼统建议 remove+add，现有 edit 是逐操作部分成功，先删成功后加失败可能留下缺口。

**验收**：从低层异常一路到 MCP modelSummary 对照，定位不丢失；批次索引正确；信息有界、不泄露私密数据；partial/rollback/dependsOn/保存未知的既有语义保持。

### R1 DQE 状态：分清外层成功、条目失败和空数据（核对项）

**本地对照通过**：`ERROR + []` 已抛 DQE_ITEM_ERROR；`SUCCESS + []` 可作为业务空结果。附件“吞掉 ERROR”并未被当前代码复现。报告中空结果/执行错误/全文缺失三种表述互相冲突，不能据此改现有成功判定。

非 SUCCESS 带非空数据的消费是现行测试及 ADR-0114 保留行为，包括 NO_PERMISSION；本批不得擅自改成仅 SUCCESS 放行。HTTP 401/403、失败信封和行字段校验继续独立执行。

**建议**：保留既有兼容矩阵，用安全诊断明确失败阶段和 retrySafe。上游 `desc` 等字段是否可用先核对契约；本地解析目前看 message/msg，附件示例 desc 为 null，无法凭该响应断言是日期错误。确定性时间错误应在本地发现。外部执行失败保留关联 ID，不能虚构具体根因。

### C1 指标卡/装配：先核对取值证据，不换组件掩盖缺口（P1）

**源码确认**：标准模板未默认指定 metricCard，编译器只补布局/用途；组件来自调用方计划。普通指标卡只应消费唯一行或可验证唯一匹配；变化值有字段、类型、单位及关系证据要求。多行不等于不能使用指标卡，关键是是否能证明目标行。

**新增局部复现**：同一完整可信 evidence（两行、totalCount=2），source.initial 只含一行时，普通 metricCard+match 成功，而 metric-summary 失败为 STRUCTURE_ROW_SELECTION_UNVERIFIED。`block_component` 使用传入 evidence；`present_metric_summary` 又从 initial 独立选行。说明两种表现对证据来源不一致。该合成场景证明接口差异，不证明两次线上 session 恰好经过该场景。

**建议**：在现有装配路径内部统一“字段解析→完整性判断→唯一选行→变化关系验证”，普通卡和 metric-summary 消费同一准备结果；保留无完整证据时拒绝选行的规则。初始呈现缓存不是自动的完整性证明。编译器只做其掌握的结构检查，真实结果相关检查在拥有可信结果的装配层完成；不新增一次模型必调的准备工具。

无效块可沿现有部分成功机制形成占位，但结果摘要应明确该 block 的实际组件类型、失败原因和可用修复方向。概览总量、当期值、趋势是不同表达，不自动从指标卡降为柱图冒充完成；不新增绕过 match 的 metricSummary 组件。

**验收**：唯一/零/多匹配；完整/不完整/未知总量；初始缓存与程序证据不同；变化字段复用、缺失、错误单位、关系不符；普通卡与 metric-summary 使用同一证据；失败块不破坏其他合法块。

### I1 inspect：核心能力已有，缺部署产物关联证据（P1 接线）

**离线对照通过**：compose 保存回执后、未调用 preview，就能取得 artifact.document 并调用 `inspect_assembly`，结构检查 ok。MCP `structured_content.artifactEnvelope` 已携带完整产物。该探针未提供可信 correlation，所以 correlation=not_run，不能称为完整关联验收。

`tool_mc_inspect` 和 PREVIEW_ARTIFACT_UNAVAILABLE 不在公共实现中；附件反映外围包装层从 preview 存储解析引用。附件只有 preview 成功，没有再次 inspect 的成功回执。

**目标**：程序侧按精确 artifactRef 解析 document，与原样 inspectionSpec 关联；模型只收到有界检查报告。不使用“最近一次产物”，不把完整页面或可信声明交给模型重建。核对调用包装层是否能保留 structuredContent，再判断是否需要框架改动。

部署短期若只能从 preview 读取，可以明确先 preview 再 inspect，但必须实际再次执行检查并报告结论；这属于接线过渡，不能声称检查核心依赖 preview。inspect 不隐式执行保存/emit_preview。

**验收**：同轮两个产物交换引用、旧 spec、内容包升级、跨上下文、迟到回执；结构状态、关联状态、保存状态、预览状态分别报告。检查不证明视觉质量或业务意图完整。

### K1 catalog/key：减少接口规则推导（P1 小项）

**对照**：catalog 返回 `templateFile=standards/business-report-standard.json`，规范查询 key 是去掉后缀的 `standards/business-report-standard`；短 key 确实失败。目录并非只返回短 key，旧报告这条归因不准确。公共 CONTENT_KEY_UNKNOWN 默认说明也不如部署包装层丰富。

**建议**：catalog 显式给 queryRef `{topic,key}`，调用方无需推导路径。可兼容 topic 内唯一短别名，完整 key 优先，歧义列候选；禁止模糊猜测和跨 topic 寻址。返回规范 key。资源目录、queryRef、别名从同一索引生成。

本地单次内容读取约 112–131ms，附件工具调用约14秒；环境不同，不能据此认定性能根因，但应测外围调用阶段，不能把全部14秒归给 JSON 文件读取或直接引入会话缓存。

### S1 工作稿读取：已有连续编辑能力，缺状态驱动使用方式（P1）

**对照通过**：成功 compose 后使用返回 workVersion 连续 edit 两次，不插入 read_page_context，均保存成功；每次服务端仍调用 verify_current，保留当前远端基线核验。read 本身也核对远端，可能包含真实远程耗时。

**建议**：明确何时直接续编、何时读取。已知组件、成功回执、准确 workVersion 时可直接续编；partial、占位变化、需要未知配置、版本冲突、外部编辑等按现有读取能力取受影响范围。已有 target_component_id/分页投影优先复用。响应补实际变更对象与失败块的有限状态，避免为猜测结果而全量重读。不得因相同 context_ref 就缓存整个工作稿。

`__context_ref__` 是部署注入策略，不构成 MC 公共有效引用；公共 gate 仍校验真实可信轮次。不要在 MC 通用说明中把占位符变成普遍要求。

### M1 数据上下文版本与 Adapter 采用差异（P0 对账，P1 适配）

**源码/对照**：数据上下文版本由 JavaDatasetMetadataProvider 根据 workspace、模型、issues、投影配置计算 hash，并由公共查询链校验；并非只能由 Relay 框架管理。相同数据跨轮可得相同 hash，但结果引用与缓存仍按可信 binding 隔离。

`examples/adapter_template/firstparty/dataset_metadata_http.py` 已调用 read_turn_metadata，包含范围/凭据指纹/投影身份和有界恢复；保留的 `tool/.../adapters/firstparty/dataset_metadata_http.py` 未接入。同一绑定两次 search，离线 Mock HTTP 调用分别是1次和2次。

这是可观测的能力差异，不应机械覆盖内部目录：adapters/README 明确该目录由内部接手、公共更新保留、公共 Bundle 哈希不包含它；factory 默认还未配置，实际生产工厂由内部提供。测试采用示例 Adapter 通过，不证明实际工厂加载的 Adapter 具备同轮缓存。

**建议**：公共复用机制继续由 metadata_session 拥有；内部 Adapter 做薄接入并通过相同契约测试。部署诊断记录实际类/模块、Adapter 接口版本、构建指纹与是否采用同轮快照；不记录凭据。manifest 只能覆盖其声明资源，不能替代内部 Adapter 身份证明。不得复制一套会话缓存到 mc-content。

**验收**：同轮重复/并发/进程重启复用，新轮次/身份/数据集/配置变化重新获取，partial 覆盖明确，取消与撤权仍检查；比较真实采用 Adapter 的 HTTP 与身份获取次数。

### P1 IAM 与性能：先建立调用归因，再按失败类别优化

固定代码中未找到附件提到的 iam_token/TitanScc 实现，无法本地复现其5秒链路。报告示例发生在 session 之前，91条总日志与两轮62次需要关联对账。并行 query 时不能把各耗时简单相加，也不能把所有空隙当模型思考。

**建议**：为公开工具调用、授权、身份获取、元数据读取、DQE、基线核对、保存、preview、inspect 记录关联 ID、父子关系、开始/结束、结果类别和缓存命中；沿现有 timed_stage 扩展，不记录原始业务行/凭据。汇总串行关键路径、并行区间并集、调用次数和分位数；模型生成耗时须有模型服务证据。

确认部署选用了哪条认证链；修正不应调用的 endpoint/缺失服务。token 的有效期内复用、刷新合并及短期可恢复退避由认证 Adapter 拥有，缓存身份按主体/工作区/配置区分。鉴权拒绝、配置错误、瞬时不可达不能同等重试；不采用“session首次失败后永远绕过”。同轮元数据缓存命中也可能仍调用 identity.current，因此应单独测量，不能把减少HTTP等同于消除IAM耗时。

### B1 最终业务范围与完成状态（验收条件）

附件后段出现九月转八月，不能由早先两条查询只差时间格式就证明最终需求未缩水。实施验收必须对照用户需求、最终查询范围、页面标题/参数、统计口径说明与检查/保存/预览回执。不能将标题更新、组件降级或 preview 成功单独视为整页完成。

## 4. 实施分批与依赖

| 批次 | 内容 | 完成标志 |
|---|---|---|
| A 固定事实 | 实际加载模块/包/Adapter指纹；保存两次调用的脱敏重放输入；时间编码契约对账 | 公共代码、内部Adapter、Relay包装层分别可定位；外部缺失明确 |
| B 查询契约与诊断 | T1共享时间规则；E1安全诊断贯通；R1现有响应矩阵回归；D1准确域候选 | MCP入口非法日期零执行；合法请求范围保持；诊断定位到原始请求 |
| C 装配与编辑 | C1统一证据准备；E1编辑路径及条件化恢复；S1续编回执 | 指标卡表现一致；部分成功可解释；不强制重复全量read |
| D 内容与检查接线 | K1 queryRef/唯一别名；I1精确产物检查；M1内部Adapter采用 | 目录可直接调用，inspect实际执行，选定Adapter通过复用验收 |
| E 真实联调与性能 | P1调用归因与认证配置；B1最终业务对照；年/月/日实际执行 | 真实Relay/DQE/保存/预览各自有证据；按关键路径报告实际收益 |

A 的外部取证可与 B/C 的本地改进并行；不能因为缺生产访问而停止本仓可确定的工作，也不能用本地探针关闭生产事项。先完成根因修复再统计减少的换域/编辑尝试，避免同一耗时重复计入收益。

## 5. 兼容、文档与验收策略

- 收紧时间格式属于行为变化：盘点已有 ISO/compact/M 输入及历史页面查询；明确新请求校验与旧页读取/迁移的边界。不要在加载时静默改范围，也不借此次调查自动升级全部页面。
- Query Schema、工具实际 FastMCP inputSchema、公共校验和知识必须同源；新增/变更错误同步 MC 内容。编辑操作结构保持既有形式，避免为诊断另造通用编辑语言。
- 功能实施按仓库要求同步 Playground 可观察场景、页面元数据文档与 local-authoring 知识/仓外安装验证。默认 Dashboard；仅验证 Report 专属行为时使用 Report。真实 DS 模型验收仅在用户明确要求时追加。
- 测试通过不代替真实服务或视觉验收。原15项探针在对应修复后转入正式恰当测试入口；不是长期在docs中维护第二套测试框架。
- 编码时按职责测量复杂度。当前探针全部16个函数/方法按 Radon 6.0.1 测量，CC=1–3，最大 CC=3；产品函数本轮未修改，前后不变。现有超限函数不在调查阶段重构，实施触及后依规则处理。

## 6. 剩余外部证据（不重复索取大包日志）

1. 部署 factory 实际装配类、关键 Adapter源码摘要、时间编码函数，以及一条失败 query 的原始公共返回；用于确认线上具体责任路径。
2. 外层 tool_mc_inspect 获取 document/spec 的代码及 preview 后真实 inspect 回执；确认是包装层限制还是程序通道丢失。
3. 关联到两次 session 的 IAM/CCMS/TitanScc 阶段时间与认证提供方配置类别；不需要token或连接密钥。
4. 最终页面标题、时间参数/查询范围，以及重复 read 前后的 workVersion/目标投影；确认是否真的冗余及是否保持九月需求。

本轮已能制定并开始后续本地实施；以上缺口只阻止对应线上结论，不能把它们写成已经根治。


## 7. 实施收口（2026-10-27）

已在基线 d227d538 的隔离工作树实施 B/C、D 的公共接口与检查接线能力，以及 A/M1/P1 的安全模块身份和调用归因；记录见 [本地实施验收](../evidence/authoring-session-audit-20261027/implementation.md)。T1 同时覆盖 Python 首次创作查询与 TypeScript 浏览器重查。此前8个缺陷探针的修复已转入正式测试，原 probe.log 保留为历史失败证据。

部署侧 A/D/E 仍待实际加载模块、内部 Adapter 接入、Relay 包装层、IAM 与 DQE 服务及最终需求范围的证据。当前没有提交/push/线上验收，不把公共实现通过写成整条生产链路已完成。浏览器还确认了现有错误源显示为“暂无数据”的呈现限制，详见实施验收记录。

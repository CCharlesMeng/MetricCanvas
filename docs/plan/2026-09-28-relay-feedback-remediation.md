# 09.24 / 09.28 Relay 反馈：根因核对与整改计划

日期：2026-09-28。状态：预算修改已保留，公共侧接续整改已实施并验证；实际 Relay/Java 接入待环境证据。接续范围见第 8 节及[接入验收记录](2026-09-28-relay-remediation-acceptance.md)。

## 1. 证据范围与主要结论

输入为用户提供的《metriccanvas 反馈问题完整清单》和《2026-09-28 09:13 执行失败分析报告》。报告标注公共提交 `3d20c6d21b2359008536b96ea41637660756f7b0`；本次检查工作区起点为 `b0bad83a811514ed29231fd37807b343c4a0b955`，初始工作区干净。

本次读取当前公共实现、仓内参考 Adapter、Skill 和定向回归。未取得报告对应的原始会话日志、work.db、部署插件代码、Java 保存响应或线上安装文件摘要，因此：

- **当前源码与本地行为已核实**：引用严格绑定、预算累计、发现召回、业务域/维度返回、治理投影、保存回执校验。
- **部署事故来自报告**：插件每调用新建 turnId、共享文件覆盖、线上元数据内容与调用次数。公共代码能够解释这些现象，但不等于已在真实 Relay 复现。
- **仍未知**：保存请求是否已经落库；元数据 HTTP 失败的具体状态和异常；线上实际加载的公共包、Adapter 与 Skill 是否同批。

这不是一个公共模块的单点故障。最直接的交付阻塞是创作轮次身份不稳定和保存回执不能确认；查询能力不足与错误重试放大了故障。C-1/C-2 和一部分 C-6 在当前主干已有实现，必须先做部署版本对账。

尤其不能把“整体与月度趋势能查”当作需求已经部分正确完成：“中国区”也需要明确维度筛选或有来源证明的指标固有口径；缺少地域维度时，未经确认不能用全域数据替代。

## 2. 职责与执行链

| 角色/系统 | 任务与资产 | 必须守住的边界 |
|---|---|---|
| 模型与 Skill | 拆解用户需求、选择已发现候选、提出取数单元和页面结构计划 | 不生成身份、版本、维度编码或保存成功事实 |
| MetricCanvas 公共工具 | 语义投影、查询校验、结果引用、工作稿、页面校验、保存调用与交付摘要 | 结果与可信创作轮次、数据上下文版本、查询授权一致 |
| Relay 接入 Adapter | 从可信请求取得轮次上下文、提供持久状态、接入模型/Java/DQE、呈现核对与预览 | 不能把每次工具调用当成新创作轮次；并发请求上下文不得互相覆盖 |
| Java / DQE 与数据责任方 | 授权元数据、真实查询、页面资产与保存回执、指标维度/单位/口径治理 | 服务返回与消费契约一致；实际缺失能力不能由模型补造 |

链路为：用户指令 → 可信创作轮次 → 语义发现 → 精确取数计划授权 → 查询与 resultRef → 工作稿装配 → 单次草稿保存 → 可核验回执 → 预览交接。发现成功不证明可执行；查询成功不证明口径完整；changed 不证明已保存；预览 ready 不证明已显示。

## 3. 逐项核对

| 编号 | 当前结论 / 根因 | 整改与责任 |
|---|---|---|
| C-1 | 报告中的整句子串实现已非当前代码。`SemanticCatalog.discover` 使用 `retrieval.rank/score`，支持名称/别名出现在整句中、短词匹配及定义文本召回。用报告三个原句和两指标夹具，分别得到 2/2/1 个指标。 | 公共方提供匹配版本和回归；Relay 检查实际 import 路径、安装文件摘要及 provider 是否在公共排序前漏召回。不是直接合并临时宽松分词补丁；候选数多不等于准确。 |
| C-2 | 接续消费回归修正原审计：SemanticCatalog 返回指标 businessDomain；fallback 原先只有顶层 businessDomains，指标匹配项缺少规范域名。本轮从所属 Schema.name 确定性补齐，保留已有嵌套 metric 结构。 | 已增加两条路径 MCP discover→query 消费回归，使用各自返回的规范 businessDomain。部署仍需版本对账；不要求原始结构逐字段相同。 |
| C-3 | 当前 `business_domain` 与执行快照 Schema 都按 caption → name → id 选名。这是实际命名策略；长 caption 不应让模型重新推导。当前 Skill 已要求使用返回的 businessDomain。 | 短期照抄精确返回值，唯一名称归一化继续确定性执行。稳定 domainId 与显示名称分离属于后续协议迁移，见架构项 A2。不能单边把 caption 改成 dataset_id。 |
| C-4 | 当前结果字段 queryField 与 DQE 维度都基于 declaration.name；时间结果列额外加 `(month)` 等后缀是有意区分。Lab 的 dimension_name 仍优先 name，因此若源 name 是内部前缀名而真实 DQE 接受 caption，适配契约仍需处理。 | 用真实请求/响应确认请求维度名、返回列名、显示标签三者，再在一个确定性映射点处理。不要直接用 queryField 替换全部 output_dims/dim_name，时间结果列不能自动当请求字段。Relay/Java 对账，公共方补映射回归。 |
| C-5 | 当前 SemanticCatalog 经 provider.search，不依赖执行 projection。无 semantic_catalog 的 fallback 经 current_for_query；Java provider 仍要求 projection，且 current() 显式 strict。默认 relaxed 只允许缺失部分治理字段，不会凭空提供执行环境与权限配置。 | 先确认线上走哪条分支和可信配置。生产语义发现接已存在的 SemanticCatalog 接口；若要求 fallback 在无执行投影时也能发现，应显式统一发现能力边界，见 A3。不能泛化为“0.3.1 discover 一律要求治理完备”。 |
| C-6 | 当前已返回按 businessDomain 标注的 dimensions，Skill 也已明确规范名/粒度及“中国区”约束。域级有维度不等于某指标可与该维度组合；metricCompatibility=unknown 不能提升为已支持。 | 对实际 Skill 同步做对账；形成逐需求的能力覆盖与缺口，错误后不轮流猜同义维度。必要时增强机器摘要/工具描述，但先复用已有维度字段，避免再造不一致清单。 |
| C-7 | 预算耗尽可独立于 Relay 文件竞态复现：prepare 每工具调用累计 calls；execute 每批 query_data 累计一次 query_rounds，不是每取数单元累计。4 个调用即 4 批，串行也会超过 3。CAS 正确计数不等于 CAS 有 bug。 | 本轮取消默认累计预算，保留计数和显式配置。Relay 文件状态竞态另修；仅加锁不能解除次数上限，取消预算也不能解决身份覆盖。 |
| C-8 | `QueryResults.require` 比较完整 binding，`AuthoringTurnGate` 校验可信 scope；同一创作轮次可 query→compose，跨轮引用明确拒绝。本地已有跨轮拒绝回归。 | Relay 维护同一用户指令对应的稳定 binding；不只修 turnId，也核对 requestId/runId/contextRef/baseRef 等。read_page_context 读取工作稿，不自行生成新轮。新用户指令、澄清答复或失效基线由可信程序建新轮。保留 turnId/runId 校验。 |
| J-1 | 当前 `_metric_additivity` / `_metric_time_aggregation` 只接受显式治理声明，并未从 aggregator 推断。报告描述的是不同实现状态。SQL 聚合函数也不充分证明跨维度/跨期可加性。 | 数据责任方确认指标治理；稳定 ID 关联 measures 仅能提供原始证据，不能把 SUM 自动转换为可加。relaxed 可保留未知，但模型不得折叠数据或补造单位。 |
| J-2 | 仓内认证由 Adapter 提供；不能依据报告认定所有服务都应使用同一 token/header。 | Relay 与 Java 明确每端点身份来源、token 类型、appid/workspace/operator 头要求；只记录脱敏状态/错误码/请求关联 ID，不复制凭据。 |
| J-3 | unknown 的直接机制是 Adapter/生命周期校验未取得可接受回执；可能已经落库。当前参考 Adapter 对 400/401/403/404/409 返回 rejected，对其他异常/响应不符返回 unknown；`DraftSaver` 也有异常归并。因此“Java 主责/落库失败”尚无证据。 | Relay 先增加脱敏分阶段诊断并保留 operationId，Java 核对请求及持久记录。已发送但结果未知时保留冻结提交并停止重发，不能用新轮次反复保存纯文本页。 |
| J-4 | 按报告，Tokens 源只提供账期与 visualization_level。这会让代表处/模型/区域需求无法满足；也可能无法证明中国区范围。公共代码不能补足数据能力。 | Java/数据方核实是否有其他授权模型、隐藏维度或元数据遗漏。实际不支持时明确列缺口，请用户选择可接受范围，不能静默做全域替代。对于原始完整月报验收，这是功能阻塞而非单纯 P2 体验问题。 |

其他事故条目：

- **R-1/R-2**：共享文件“最后写入覆盖”与每次生成 turnId 是报告中的部署缺陷。本地公共 SQLite 的 CAS 不会保护 Relay 另一个无锁 JSON 文件。仅为写文件加锁仍可能在 A 写入、B 覆盖、A 读取之间串错上下文；应使用调用携带的可信上下文或按请求隔离的持久记录。
- **R-3 / E**：当前 Java provider 的 current_for_query 每次 `_read()`，确有重复元数据 I/O；但 `DATA_CONTEXT_TRANSPORT_ERROR` 还包含非 200 HTTP，不能只推定网络抖动。当前 execute 先获取 snapshot 再建立单元记录，因此报告“首次元数据失败同时留下五条 QUERY_INTERRUPTED”不能直接映射到当前调用位置。需对齐源码版本与异常阶段。
- **R-4/R-5/R-7**：DQE 字段、月份编码、维度映射属于真实接口对账；当前公共 `month` 与内部 `yyyymm` 的转换应由明确的 Adapter 契约承担。先保存双方示例，再删除重复补丁。
- **R-6**：projection 不应为“通过检查”批量填默认业务治理值，尤其不能推断指标可加性。缺失与未知应透明传递。
- **F**：context_ref 是可信程序提供的引用，`current-context` 不是全局固定协议常量。接入层注入可以成立，但必须与本次可信请求一致；不能跨会话一律覆盖成同一个共享上下文。

## 4. 整改顺序与验收

| 阶段 | 具体动作 | 完成条件 | 责任 / 架构 |
|---|---|---|---|
| P0-0 部署对账 | 固定公共 commit、Bundle digest、Skill hash、Adapter/plugin commit、实际 Python import 路径与查询校验模式；对照 e90a9a2c 之后实现 | 两条发现路径行为可解释；旧临时补丁逐项确认保留或移除；不以相同 0.3.1 标签推定文件相同 | 公共 + Relay；不改架构 |
| P0-1 轮次与隔离 | 同一用户指令保持完整 binding 稳定；每调用读取一致快照；更换指令/页面/身份/基线由可信程序建新轮 | 同轮 query→compose→saved→preview 成功；新轮旧 ref 被拒；双会话交错、取消、进程重启无串线；读上下文不重置工作稿 | Relay 接入层；A1 |
| P0-2 保存对账 | 记录发送前/后、HTTP status、业务码、schema 错误路径、operationId；比对 Java 当前记录与原提交 | 一次提交一次发送，得到验证后的 saved/ref；响应丢失时保留 unknown，不自动重发；核对是否已落库；工作稿可找回 | Relay + Java，公共方提供消费断言；现有 ADR-0080/0083 |
| P0-3 暂停预算限制 | 取消 Skill 固定次数与默认累计程序预算，保留所有授权/引用/保存门禁 | 4 批并发查询不因默认 3 轮阻断；超过原时长/次数可继续；显式配置仍生效；单次证据不泄漏 | 本轮已实施；配置语义变化，无持久化迁移 |
| P1-1 业务覆盖 | 按原需求列整体、趋势、代表处、模型占比、区域×模型明细，并逐项核对中国区/2026 上半年；查能力前不猜字段 | 每项标记 supported/unknown/unsupported 及证据；核心范围缺失时不冒充完整成功；多指标维度组合不能用域级并集代替 | 公共 Skill/摘要 + Java/数据；通常无需新架构 |
| P1-2 语义/DQE 对账 | 校验 canonical businessDomain、维度请求编码/返回列、时间格式、metric/measures 关联及治理 | 使用真实元数据样本，生成 DQE、执行响应、字段映射一致；Schema 合法但业务不符仍判失败 | 公共 + Relay + Java；是否涉及 A2 由差异决定 |
| P1-3 元数据稳定性 | 分类传输错误；短时只读重试；同身份/授权范围/数据集集合合并在途请求，缓存版本明确 | 无跨权限泄漏；同版本 discover/query 可连续执行；权限/元数据/治理配置变化失效；传输失败不升级为“没有指标” | Relay Adapter；局部机制，不能只缓存 self._snapshot 永久复用 |
| P2 协议收口 | 评估稳定标识与显示名称分离、统一发现能力/就绪字段；补部署接入检查 | 先裁决下面 A2/A3，再编写迁移规格和兼容回归 | 公共方主导；需架构讨论 |

最终真实验收用原始月报请求：只有所有所需维度确实可用且地域/时间口径正确，才按完整成功验收；否则验收的是准确报告能力缺口、保留已完成工作且不反复试错。依次保留发现、授权、DQE、resultRef、页面文档、保存回执、预览接收和实际打开的证据。纯文本页成功不能替代数据报告验收。

## 5. 涉及架构调整的事项（提案，未实施）

### A1：Relay 可信上下文的生命周期与并发隔离——必须整改接入层

现行公共接口已经要求可信 CurrentAuthoringTurnPort。建议从“每工具调用覆写全局 JSON”改为“可信用户事件创建轮次，工具调用携带/读取该轮不可变绑定，状态按作用域保存”。可以在现有 Relay 插件/Adapter 中实现，无须改 Relay 核心。

采用数据库时必须明确两个层次：不可变授权绑定与可变 workVersion/保存回执。原子写文件或把同一槽位搬到 SQLite 并不足够；存储键和调用关联必须隔离。此项是修复接入层以满足现有架构，不需要放宽公共引用安全语义。

需对齐：Relay 哪个可信事件代表用户指令；控制消息/取消如何指向原轮次；澄清后如何重新授权；执行重启时 runId 是否延续。若 runId 改变就不能直接复用旧 resultRef，应重新取证。语义 discovery task 可按既有任务契约续接，不等于查询结果可跨轮复用。

### A2：稳定领域标识、DQE 名称、显示标签分离——可选后续协议调整

当前 caption 同时承担业务域查询名称，有名称变更和同名碰撞成本。若实际对账证明持续受此影响，可引入稳定 domainRef/dimensionRef，并由确定性映射生成 DQE 查询编码；显示标签只用于呈现。

这会影响发现结果、查询输入、查询签名/缓存、授权摘要、持久结果、Adapter 和迁移兼容，必须先确定唯一标识来源、版本变化策略、旧名称兼容期、同名处理与回滚方案。不能本轮顺手修改，也不能用“改成简短 businessDomain”替代设计。

### A3：发现能力与执行就绪统一表达——可选公共接口调整

现有 SemanticCatalog 已能在缺少执行治理时发现；fallback 仍消费执行快照。若两个入口都必须提供相同的原始语义发现能力，应建立统一发现输出投影，分别表达 source coverage、指标可组合性、executionReadiness。发现到了不等于可执行；unknown 不能变成 supported。

先确认生产是否必须保留 fallback，以及业务是否需要跨源分页/检索；不要重复建设已经存在的 SemanticCatalog、DiscoveryDependencies 与任务状态。此项不要求向量服务，也不要求模型负责确定性字段映射。

### 不建议的“修复”

- 去掉 turnId/runId 校验以让旧 resultRef 到处可用。
- 每次 read_page_context 重建轮次或用 sessionId 永久替代创作轮次。
- 保存 unknown 后换请求/轮次重发，或者把 unknown 当成功。
- 从 aggregator 自动补业务可加性，或忽略缺失地域筛选。
- 把 queryField 的时间返回列名机械复制进请求维度。

以上都会掩盖错误或改变现有 ADR 的授权/保存边界。

## 6. 本轮实际修改与验证

已修改两份 Skill 及关联流程：去掉固定模型决策/工具调用/补查/修复次数，继续要求明确修正依据和无进展时停止。公共 `Limits` 的 calls、query_rounds、mutations、seconds、total_evidence_bytes 默认改为 None；`DiscoveryLimits.model_calls` 默认改为 None。持久计数与显式配置上限保留，不迁移旧状态；显式传入旧上限的部署仍须调整注入配置。

单次结果证据 20 行、响应字节边界、查询结果大小、发现请求超时、任务 TTL/租约/容量、身份授权、基线/版本、取消、工作稿 CAS 和未知保存门禁继续生效。取消累计时长并不取消外部 HTTP 超时。模型服务配额、上下文/token 上限与评测 runner 资源上限不属于本次 Skill 限制，未修改。

验证结果：

| 检查 | 结果 |
|---|---|
| 修改前新增复现 | 超过原累计预算、4 批并发查询、两次中断后的模型再调用，3 项均捕获旧限制 |
| 定向回归 | 第一轮 70 项通过；随后补充显式模型预算兼容回归 |
| 全量 Authoring harness | 最终串行运行 457 项通过（47.350 秒），包含规则、Adapter、交付与确定性评测层 |
| Skill quick_validate | 两份 Skill 均通过 |
| 契约 / Bundle | authoring:contracts:check 通过；Bundle 0.3.1 的 1656 项 digest 检查通过；lock 由生成器更新 |
| diff | git diff --check 通过 |
| 真实 DS / 内部 Relay、Java、DQE / 浏览器 | 未运行，不据本地替身声明生产修复 |

首次全量运行与契约生成器并发，3 个 Schema 子用例因生成期间文件暂缺报错；生成结束后串行全量重跑通过。这是本次验证调度错误，没有按产品缺陷修改代码。最终测试日志：`/tmp/metriccanvas-20260928-budget-tests.log`（本机临时留痕）。本轮未提交、推送或部署。

## 7. 源码定位

- 发现与规范名称：[semantic_catalog.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/semantic_catalog.py)、[retrieval.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/discovery/retrieval.py)、[lab_projection.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/lab_projection.py)。
- 可信轮次、结果与预算：[authoring_turns.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/work/authoring_turns.py)、[results.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/results.py)、[state.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/work/state.py)。
- 发现 fallback 与 DQE：[discover_data_context.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/discover_data_context.py)、[executable_units.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/executable_units.py)、[validation_policy.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/data/validation_policy.py)。
- 仓内参考接入与保存：[dataset_metadata_http.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/adapters/firstparty/dataset_metadata_http.py)、[lifecycle_http.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/adapters/firstparty/lifecycle_http.py)、[drafts.py](../../metriccanvas-authoring/tool/metriccanvas_authoring/assets/drafts.py)。这些文件不证明内部部署使用了相同实现。
- Skill：[数据分析](../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/workflows/data-analysis.md)、[执行检查点](../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/references/execution.md)。
- 现行裁决：[领域词汇表](../../CONTEXT.md)、[生命周期主题](../adr/topics/product-forms-and-lifecycle.md)、[保存与发布治理](../adr/topics/page-lifecycle-and-publish-governance.md)、[数据获取与查询模型](../adr/topics/data-fetching-and-query-model.md)。


## 8. 接续执行（2026-09-28）

保留第 6 节所有预算修改及显式配置语义，没有改动内部 Adapter 或 qiankun 工作。未提交、推送或部署。

- **P0-0 公共准备已完成**：新增 `scripts/deployment_fingerprint.py`，记录实际 Python 导入位置与摘要、Bundle/Skill 摘要、Git HEAD/dirty、查询模式及可选插件源码摘要。错误导入与文件漂移有回归。实际部署采集尚缺插件路径与运行环境。
- **P0-1 公共消费断言已完成，实际接入待定**：增加 runId/requestId/contextRef 变化后的旧引用拒绝，以及双轮次交错、取消隔离、同 binding 重启、query→compose→saved→preview 和读取不重复保存回归。实际 Relay 的新指令事件、取消关联及重启 runId 语义尚未确认；测试正确注入的可信上下文不等于修复部署插件。
- **P0-2 参考诊断已完成，线上保存对账未运行**：`examples/adapter_template/firstparty/lifecycle_http.py` 新增可选程序侧诊断，记录 operationId、发送尝试/收到响应阶段、HTTP 状态、受限业务码及回执失败字段；日志接收失败不影响保存。unknown、单次发送与冻结提交语义不变。需接入方定向合并进内部 Adapter，公共更新不覆盖内部源码。
- **P1-1 Skill 已补齐能力核对规则**：逐需求标记 supported/unknown/unsupported 与来源，核对地域/时间及指标维度组合。未命中和域级并集均不证明组合能力；缩小核心范围须用户选择并重新授权。原需求逐项清单见接入验收记录，实际能力仍全部 unknown。
- **P1-2 公共可复现缺口已修**：两条发现路径消费测试捕获 fallback 指标匹配项缺少 businessDomain，现按所属 Schema.name 补齐；没有用短名/id 替代规范查询名。真实维度、时间编码及 Java/DQE 对账仍待样本。
- **P1-3 尚未实施部署重试/缓存**：缺少实际 Adapter、权限变化信号与版本失效机制，不能安全假定缓存键；未引入永久缓存或猜测重试策略。
- **P2 / A2 / A3 仍为提案**：没有实施领域标识迁移、统一发现就绪协议或改动 Relay 核心。A1 按既有契约提供回归，实际接线等待关键事件语义。

完整接入命令、保存诊断事件含义、原始月报能力表和所缺证据见[接入验收记录](2026-09-28-relay-remediation-acceptance.md)。

接续验证结果：

| 检查 | 结果 |
|---|---|
| 全量 Authoring harness | 463 项通过，45.278 秒；日志 `/tmp/metriccanvas-20260928-remediation-tests.log` |
| 保存诊断最终定向复验 | 11 项通过；字段长度校验与原 valid_ref 保持一致，不额外收紧响应契约 |
| Skill quick_validate | 两份入口均通过；这是静态校验，不是模型行为验收 |
| 契约 / Bundle / diff | 串行生成后契约检查通过；1657 项 digest 通过；git diff --check 通过 |
| 指纹脚本 | 默认测试 Python 无公共包导入路径时返回 2；显式本仓 PYTHONPATH 后 5 个模块匹配、relaxed、无漂移，返回 0；插件 not_provided |
| 真实 DS / 内部 Relay、Java、DQE / 浏览器 | 全部未运行；能力覆盖规则尚无真实模型行为验收，实际接入故障未宣称修复 |

源码依据纠正：C-2 的 fallback 指标域名缺口由本轮新增 MCP 消费测试捕获并修复，不能继续沿用原审计“旧分支不一致全部已修”的判断。现存内部 Adapter 与公共参考模板可能不同；本轮只更新参考模板。

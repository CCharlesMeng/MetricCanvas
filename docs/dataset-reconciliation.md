# Dataset Runtime 提案与 MetricCanvas 现状对账

本文是对 `docs/dataset-handoff.md`(存量 IOC 大屏栈的 handoff)与 `docs/dataset规划.md`(据此提出的 Dataset Runtime v0.1 方案)的正式回应。两份文档均在 MetricCanvas 之外形成,不掌握本仓 43 份 ADR 的演进结论,其中 `dataset规划.md` 提出的架构本仓已在 [ADR-0033](./adr/0033-suspend-dataset-runtime.md) 中评估并**挂起**。

本文不做新决策,只做三件事:把两份文档的诉求逐条落到本仓已有结论上;量化真实缺口;给出在当前框架内的推进路径。新决策仍需新增编号 ADR(当前应为 `0044-*.md`)。

## 1. 结论

- 两份文档描述的目标态,与本仓已经裁决的架构**方向一致**,并在若干处构成有价值的外部印证。
- handoff 文档的"现状"是存量 Angular IOC 栈,不是 MetricCanvas。它列举的大部分待建能力,本仓已有决策或已建成。
- 按存量扫描的 149 个计算场景分类估算,**约 87% 落在本仓已有决策的覆盖面内**,其中约 47% 依赖一份已 accepted 但尚未实现的 ADR([ADR-0039](./adr/0039-derived-measure-templates-as-company-definitions.md));真正无归属的约 11%,集中在多数据源关联。
- 三个验证案例中,案例一、案例二在当前框架内可以完成,**只有案例三(管道支撑率)需要 Dataset Runtime**。
- `dataset规划.md` 的核心建议(可持久化版本化的 Plan、JOIN 算子、底层四则表达式层)分别触发了 ADR-0033 三条挂起理由中的前两条,且未处理第三条 —— 而第三条恰好是本仓当前唯一可以立即偿还的一条。
- 因此推荐路径不是启动 Dataset Runtime,而是**先偿还指标语义元数据欠账,再实现 ADR-0039,用案例三作为是否重开 ADR-0033 的唯一判据**。

## 2. 两份文档与本仓的关系

`dataset-handoff.md` 的技术链路(指标 → 数据资产 → ADS/DWS/DWD/ODS → 表服务/GraphQL/API/DQE → Angular 大屏)、149 个前端计算场景扫描、`*.datasource.ts` 与 `IndicatorCalculate` 等事实,全部来自 `CDIOperationMapWebsite/website-src`。它记录的是**问题域**,不是 MetricCanvas 的实现现状。读它时须注意:文中多处"当前尚未决定""建议未来形成"的事项,在本仓已经有生效结论。

`dataset规划.md` 是一份外部方案提案。它的论证质量很高,但建立在 handoff 的现状描述之上,因此不知道计算数据集已被评估并挂起,也不知道汇合点已从计算数据集回落到页面文档。

## 3. 已有结论对账

下表逐条对应两份文档提出的能力诉求与本仓现状。**已建成**指代码中存在并有测试覆盖;**已决未建**指 ADR 状态为 accepted 但无实现。

| 文档诉求 | 本仓对应物 | 状态 |
|---|---|---|
| 形态谱系:Ask / Explore / Report / App / Monitor | 分析形态与沉淀(`CONTEXT.md`),共用同一份页面文档表达 | 已决,Ask/Explore 已建成([ADR-0030](./adr/0030-transient-page-state-for-ask-and-explore.md)) |
| "不是所有问题都值得做成 Data App",分析中长出应用 | 临时页面态 + 沉淀,沉淀只由用户显式发起 | 已建成(ADR-0030) |
| App Spec + UI Runtime,而非 AI 生成页面源码 | 页面元数据 + 统一运行时,页面 Schema 5.0 | 已建成([ADR-0001](./adr/0001-domain-dsl-over-a2ui.md)、[ADR-0002](./adr/0002-svelte-runtime.md)) |
| 统一数据访问协议,不再新设计查询语言 | DQE 内嵌查询定义 + 数据网关分发 | 已建成([ADR-0016](./adr/0016-send-embedded-query-definitions.md)、[ADR-0017](./adr/0017-page-schema-v3-hard-cutover.md)) |
| Capability Discovery:有什么指标、维度、能怎么组合 | 数据上下文快照 / Schema 元数据 / 语义面投影 | 已建成([ADR-0031](./adr/0031-metrics-as-data-context-discovery-anchor.md)) |
| Capability 必须包含 Relationship 与基数 | `DataRelationship.cardinality`,闭集为 `one-to-one` / `one-to-many` / `many-to-one` | 已建成;**N:N 已天然禁止**,规划文档第 ④ 条建议无需新增 |
| Calculation 与 Presentation 物理分离,消除 `_copy` | 展示格式归属组件字段绑定,数据源只给 `defaultFormat` | 已建成([ADR-0013](./adr/0013-format-belongs-to-component-field-binding.md)) |
| `currency: CNY` 属数据语义,`万元` 属呈现 | 货币金额字段 `money/CNY` 与 `cny-adaptive` 展示策略分离 | 已建成([ADR-0042](./adr/0042-money-fields-and-semantic-embedded-values.md));构成对规划文档第十四节的独立印证 |
| Parameter 一等公民,Explore 升级为 App 时提升为页面筛选 | 筛选绑定 `filterBindings` + 结构化相对时间表达 + 沉淀 | 已建成([ADR-0035](./adr/0035-structured-relative-time-expressions.md)、ADR-0030) |
| Plan 必须可序列化、可版本化、可重放审计 | 页面文档 + 不可变页面修订 + 发布租约 | 已建成([ADR-0008](./adr/0008-immutable-page-revisions-and-publish-leases.md));**本仓已有等价物,不需要第二个持久化对象** |
| Human-in-the-loop → Human-on-exception | 创作期清单校验 + 真实执行验真;口径卡只在歧义、临时口径、模型补全时间、成本超阈值时阻塞 | 已决([ADR-0032](./adr/0032-authoring-time-query-verification.md)、[ADR-0037](./adr/0037-ask-orchestration-and-interaction-contract.md));成本阈值分支未建 |
| Grain 由编译器推导,Agent 不得自行声明事实 | 取数单元经派生与真实执行产出契约,字段名来自执行输出而非模型声明 | 部分建成;**粒度本身尚未被推导与校验**,见第 6 节 |
| 派生度量 RATIO / PCT_CHANGE / 同比环比占比 | 派生度量模板,公式与基期推导规则声明在数据上下文层,视同公司口径 | **已决未建**(ADR-0039) |
| Measure 需携带聚合语义 | 可加性(可加/半可加/不可加)+ 时间聚合方式(求和/均值/期末值) | **已决未建**(ADR-0031);当前仍是散文,见第 6 节 |
| Custom Code 作为最后 Escape Hatch | 严格声明式页面规格,禁表达式与脚本;DQE 表达不了的走网关适配器 | 已决([ADR-0003](./adr/0003-strict-declarative-spec.md)、[ADR-0034](./adr/0034-graphql-rest-as-data-gateway-adapters.md));GraphQL/REST 适配器未建 |
| 多数据源 Join / Lookup / 跨粒度对齐 | —— | **无归属**,见第 6 节 |
| 统一 Null / Zero 语义 | —— | **无归属**,见第 6 节 |

## 4. 149 个存量场景在本仓的归属

按 `dataset-handoff.md` 第 9 节的分类估算(原始分类合计 151,与文中 149 略有出入,应为重复归类;下表按原始分类计算占比)。

| 归属 | 场景分类 | 计数 | 占比 |
|---|---|---|---|
| 呈现层,已建成 | 单位换算/格式化 22、图表格式化 8、代码值映射 5 | 35 | 23% |
| 派生度量模板,已决未建 | 比率/占比/完成率 42、环比 22、同比 7 | 71 | 47% |
| DQE 查询层可覆盖 | 差值/增长 10、排序分组 8、SQL 层预计算 4、CAGR 3 | 25 | 17% |
| 真实缺口 | 多数据源合并 10、时间序列/月份补全 6 | 16 | 11% |
| 横切,无归属 | 空值判断 4 | 4 | 3% |

**这个分布是本文最重要的量化结论。** 存量前端之所以有 149 处计算,主因不是业务计算本身复杂,而是当时缺少呈现层与派生口径层这两处归属,导致格式化与通用比率被反复手写。本仓已经把前者收敛(ADR-0013、ADR-0042),后者已裁决但未实现(ADR-0039)。只要 ADR-0039 落地,约 87% 的存量场景就有确定归属,不需要 Dataset Runtime。

需要说明的是,这 149 个场景衡量的是**存量栈的迁移成本**,不是 MetricCanvas 的需求清单。用它论证新架构规模时会系统性高估。

## 5. 三个验证案例的当前覆盖度

`dataset-handoff.md` 第 18 节提出用三个案例验证 Dataset Runtime v0.1。把它们放回当前框架:

**案例一,NA 客户突破率。** 单查询内两个度量之比。当前有两条路径:DQE `output_metrics` 内嵌 `formula`(ADR-0032 有意保留的开放面,已建成但走临时口径治理),或 ADR-0039 的占比模板(视同公司口径,未建)。案例要验证的动态筛选已由 `filterBindings` 覆盖。**唯一未覆盖的是空值语义**(分母为零返回什么)。此案例不构成 Dataset Runtime 的立项理由。

**案例二,12 个月趋势。** 环比由 ADR-0039 模板承担,排序由 DQE `order` 承担。剩下的月份补全值得单独裁决:如果补全是为了图表 x 轴完整,它属于呈现层,由组件按声明的时间范围补空点即可;如果是为了环比基期存在,正确答案是基期缺失即为 null,而不是补 0(补 0 会让环比产出无穷增长,ADR-0033 已记录这一点)。**按这个拆分,`TIME_ALIGN` 不需要成为算子**,缺口消解为一次呈现层裁决加一条空值策略。

**案例三,管道支撑率。** 三份数据分别过滤聚合后按 region / repOffice 对齐,再做多阶段派生。这在当前框架内**没有任何归属**:页面协议不表达跨数据源关联,级联页面数据源输入语义仍挂起([ADR-0015](./adr/0015-defer-cascading-data-source-input-semantics.md)),数据网关只做行归一化不做计算。**这是三个案例中唯一真正需要 Dataset Runtime 的一个,也应当成为是否重开 ADR-0033 的唯一判据。**

案例三存在一个必须先查证的前提:存量实现中的"三个数据源"是业务事实,还是当时 GraphQL 分层的产物。若三份数据在同一数仓内,它在 MetricCanvas 侧可能是一个 DQE 查询。**在查清之前,不应以案例三为由立项。**

## 6. 真实缺口

对账后剩下四条,按依赖顺序排列。

**缺口一(契约侧已偿还,数据侧未补齐):指标条目一等化。** 原状况是 `formatVersion` 停在 `1.0`,指标只是 `roleHints: ['measure']` 的普通 `DataField`,可加性与时间聚合方式被 `tools/dqe-sim` 拼成一句受控中文散文塞进 `description`,而全仓没有任何消费者解析那句话。这一条同时阻塞 ADR-0039 的派生模板、ADR-0035 的相对时间词表、[ADR-0043](./adr/0043-attribution-diagnosis-as-a-sibling-analysis-form.md) 的指标归因定义,并且是 ADR-0033 三条恢复条件中的第一条。

[ADR-0044](./adr/0044-first-class-metric-entries.md) 已落地:指标条目成为业务域级一等结构,`roleHints` 收窄为 `dimension | time`,可加性与时间聚合方式成为结构化闭集,`formatVersion` 切到 `1.1`。**但这只解决了"可表达",没有解决"可用"** —— 真实业务域里每个指标取什么可加性仍须由数据侧逐个声明,那是业务输入。因此 ADR-0033 的恢复条件一仍未满足。承载 ADR-0039 / ADR-0035 / ADR-0043 三项能力的结构已就位,但它们各自的字段形状尚未设计,仍属后续批次。

**缺口二:空值与零值语义未统一。** 存量扫描发现至少四套判断。本仓目前没有对应治理面,但 ADR-0039 的模板一旦实现就必须回答:分母为零、基期缺失、缺失周期各返回什么。规划文档第十三节的建议(`missing ≠ null ≠ 0`;`X/0 → null`;需要 0 时显式 `COALESCE` 留痕)方向正确,**但落到本仓应表述为模板的确定性行为,而不是引入 `COALESCE` 算子** —— 后者会打开表达式层。

**缺口三:粒度未被推导与校验。** 规划文档第九节"Dataset Contract 是 Compiler 推导出来的事实,而不是 Agent 声明的愿望"是本次提案中最有价值的一条,且**不依赖 Dataset Runtime 即可采纳**:取数单元的粒度可以在 ADR-0032 的清单校验环节由维度与时间粒度确定性推导,再据此校验指标的可加性是否允许该请求。这是一次对现有验真链路的增强,不是新架构。

**缺口四:多数据源关联无归属。** 见第 5 节案例三。它落在 ADR-0015 与 ADR-0033 共同面对的那批未解语义上:关联键缺失、1:N 放大度量、null 键、笛卡尔积上限、未命中丢行还是补 null、空集与失败传播、循环依赖校验、缓存键与取消语义。规划文档以 Relationship 加基数限制回答了其中的关联安全性,**但其余各条均未回答**。

## 7. 与 ADR-0033 的关系

ADR-0033 挂起计算数据集的三条理由,与规划文档的对应关系:

**挂起理由一,要求领域层出现第二个聚合根。** 规划文档第十七节明确建议把 handoff 的"Plan 可以不持久化"改为"必须可序列化、可版本化",并要求 Data App 侧 Persist / Version / Replay / Debug / Audit。这正是挂起理由一。但本仓**已经有一个持久化、可版本、可重放、带发布治理的对象:页面文档与页面修订**。ADR-0033 的结论"汇合点从计算数据集回落到页面文档"已经满足了规划文档提出的全部生命周期诉求,不需要新建第二个。

**挂起理由二,Transform 的边界语义正是 ADR-0015 挂起的那一批。** 规划文档提出 8 个算子,其中 `JOIN` 直接落在这一面。它以关系基数作答的部分是真实推进(且本仓 `DataRelationship` 已禁 N:N),但 ADR-0015 列出的五项语义一条未答。ADR-0033 原文对此的判断"换名字不构成推进"仍然成立。

**挂起理由三,正确性依赖尚不存在的指标语义元数据。** 规划文档未处理这一条 —— 它假定 Capability Catalog 已能提供 Grain、Rollup、Relationship。而这恰是本仓的缺口一,也是**唯一一条当前可以立即偿还的**。

**ADR-0033 明确保留的结论:不提供通用 `arithmetic`,恢复设计时应从具名算子起步,而不是从表达式语言起步。** 规划文档第七节的分层(底层 `ADD`/`SUBTRACT`/`MULTIPLY`/`SAFE_DIVIDE`/`POWER`/`COALESCE`,上层 `RATIO`/`PCT_CHANGE`/`CAGR` 作为宏展开到底层)恰好把这个结论倒过来了:本仓的立场是具名算子即原语,其下不存在通用运算层。任意嵌套的算术就是一棵表达式 AST,与 [ADR-0014](./adr/0014-query-artifacts-replace-metrics.md)、ADR-0003 直接冲突。

此处须诚实记录本仓自身的一处不自洽:DQE `output_metrics` 的内嵌 `formula` 已经是一个自由表达式开放面(ADR-0032 有意保留),模型可以自由生成。二者的差别在于**责任归属而非表达力** —— formula 由留痕、可加性校验与沉淀设闸承担代价,且不进入平台的计算职责;而引入平台自己的表达式层意味着平台开始为任意算术的正确性负责。这个区别应当被明确,不应被用作放开表达式层的理由。

## 8. 建议路径

**阶段一(已完成):偿还指标语义元数据欠账。** [ADR-0044](./adr/0044-first-class-metric-entries.md) 把指标条目提升为数据上下文快照的一等结构,承载业务名、别名、口径说明、单位、是否为比率、可加性、时间聚合方式与可用维度,`formatVersion` 升到 `1.1`。同批改动 `packages/mcp/src/data-context.ts`、`packages/mcp/src/authoring/unit-verification.ts`、`docs/schema-metadata.schema.json`、`docs/schema-metadata.md`、示例快照与 `tools/dqe-sim` 投影(同面守卫测试强制两边一致)。此阶段未引入任何计算能力,语义面投影形状未变,问数链路未受影响。遗留输入:各业务域指标的可加性取值需由数据侧复核。

**阶段二:实现 ADR-0039 派生度量模板。** 这是已 accepted 的决策,不需要新裁决,且它是覆盖存量 47% 场景的那一笔。实现过程中一并确定性裁定缺口二(分母为零、基期缺失、缺失周期的返回值)与案例二的月份补全归属。同时按缺口三,在 ADR-0032 的清单校验中加入粒度推导与可加性校验 —— 这是把规划文档最有价值的一条落地,且无需新架构。

**阶段三:收集证据,不做实现。** 两件事并行:查证案例三在 MetricCanvas 侧是否真是三个数据源;按 ADR-0033 恢复条件三,统计 formula 的口径复制与漂移是否已经实际发生(ADR-0032 的 formula 留痕与 ADR-0036 的缺口计数已提供数据来源)。

**阶段四:仅在阶段三给出肯定证据时,重开 ADR-0033。** 届时三条恢复条件中的第一条已由阶段一满足,范围应收窄为**多数据源关联**这一件事,承载位置是服务端组合执行适配器(ADR-0014 允许),不引入表达式层,不新建聚合根,并须先回答 ADR-0015 的五项语义。

**建议现在明确不做的:** 通用表达式层与 `arithmetic`;第二个可持久化版本化的 Plan 对象;完整 8 算子代数;`TIME_ALIGN` 作为算子;SQL Window 全能力;N:N 关联(已天然禁止);可视化 Dataset Designer。

## 9. 待裁决项

以下问题应在阶段一起草 ADR-0044 时一并回答,本文不预设结论。

- ~~**可加性是否扩为四档以吸收 `REQUERY`。**~~ 已由 ADR-0044 裁决:保留三档,不采纳四档动词模型,`不可加` 的措辞改为"不得折叠已返回的数据行,可在目标粒度重新查询"。理由是本仓的粒度变化在架构上永远是一次重新查询,`REQUERY` 是默认路径而非分支。
- **比率指标的分子分母声明放在指标条目上还是派生模板上。** 影响 ADR-0039 占比模板的分母推导。ADR-0044 只落了 `isRatio` 布尔,分子分母有意未做。
- **维度层级关系是否随本次一并引入。** ADR-0043 已因缺少层级而被迫限制下钻候选集,规划文档的关联证明也依赖它;但当前每个业务域只有 2 个非时间维度、零层级,数据侧输入尚未到位。
- **月份补全归呈现层还是取数层。** 见第 5 节案例二。

## 10. 引用

- 本文回应的两份文档:`docs/dataset-handoff.md`、`docs/dataset规划.md`
- ADR 基线:[docs/adr/README.md](./adr/README.md)
- 直接相关:[ADR-0033](./adr/0033-suspend-dataset-runtime.md)、[ADR-0031](./adr/0031-metrics-as-data-context-discovery-anchor.md)、[ADR-0032](./adr/0032-authoring-time-query-verification.md)、[ADR-0039](./adr/0039-derived-measure-templates-as-company-definitions.md)、[ADR-0015](./adr/0015-defer-cascading-data-source-input-semantics.md)、[ADR-0014](./adr/0014-query-artifacts-replace-metrics.md)

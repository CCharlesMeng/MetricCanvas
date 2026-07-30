# 从“前端页面 + 数据”演进到“指标 + 维度驱动看板页面生成”

> 调研时间：2026-07-30  
> 范围：仅采用产品所有者的官方文档、官方规范、官方源代码仓库与原始研究论文。未采用媒体、咨询报告、第三方博客或社区二手解读。  
> 术语：MetricCanvas 领域概念遵循 [`CONTEXT.md`](../../CONTEXT.md)。文中“语义模型”“semantic layer”只用于描述业界产品；落到本项目时，指标与维度仍由**数据服务**定义和治理。

## 1. 结论先行

### 1.1 可行，但目标不应写成“只有数据 + 维度就能生成正确页面”

**一手事实：**

- Looker 的查询可以归结为 `model + explore + dimensions/measures + filters + sorts`，表连接由 LookML 模型补全，而不是由页面作者每次重写；这证明“治理后的指标/维度选择可以成为消费入口”。[Looker：How Looker generates SQL](https://docs.cloud.google.com/looker/docs/how-looker-generates-sql)
- Tableau Show Me 会根据已选字段及其角色，筛出适用视图并推荐图形；“日期维度 + 度量”会建议折线图。其原始论文说明，Show Me 借助 VizQL 同时描述视图结构和取数查询。[Tableau：Use Show Me to Start a View](https://help.tableau.com/current/pro/desktop/en-gb/buildauto_showme.htm)、[Mackinlay、Hanrahan、Stolte：Show Me 原始论文](https://www.tableau.com/sites/default/files/whitepapers/081027-infovis-showme-vfinal-fix.pdf)
- Power BI Copilot 已能依据自然语言请求，从语义模型中选择表、字段、度量和图表来生成报表页；ThoughtSpot SpotterViz 已能根据提示选择数据源、生成分析、组织 KPI/图表并布局成完整 Liveboard。[Power BI：Copilot reports overview](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-reports-overview)、[ThoughtSpot：SpotterViz](https://docs.thoughtspot.com/cloud/26.7.0.cl/spotter-viz)

**对 MetricCanvas 的推断：**

可行的目标形态不是：

```text
数据行 + 维度列表 ──> 唯一正确的看板页面
```

而是：

```text
页面目标/受众/分析问题
        +
数据服务治理的指标、维度、聚合、关系与安全语义
        +
可解释的图形推荐规则
        +
受治理的纯渲染组件目录与领域 DSL
        ↓
未保存页面文档 → 校验 → 用户确认保存为页面修订 → 真实查询与精确修订预览 → 人工确认发布
```

原因是同一组指标和维度可以回答不同问题：当前经营状态、时间趋势、分类对比、异常定位或逐行核对需要不同组件和页面结构。Tableau 官方教程也明确要求“每个视图从一个问题开始”；Show Me 论文则把“从模糊任务推断用户真正意图”称为困难的开放问题。[Tableau：Build a Basic View](https://help.tableau.com/current/pro/desktop/en-us/getstarted_buildmanual_ex1basic.htm)、[Show Me 原始论文](https://www.tableau.com/sites/default/files/whitepapers/081027-infovis-showme-vfinal-fix.pdf)

因此，下阶段更准确的定位是：

> **由页面目标约束、由指标与维度供给驱动、由规则与 AI 共同规划、由领域 DSL 承载的看板页面生成。**

这里还需明确“数据”的含义：

- 如果指原始数据行、列名和自动推断的字段类型，只足以做探索原型。Tableau 允许自动判断字段角色，但官方也允许用户纠正被误判的维度/度量；ThoughtSpot 则指出收入定义、财务日历、退款处理等业务决定并不存在于数据库 schema 中。[Tableau：Dimensions and Measures](https://help.tableau.com/current/pro/desktop/en-us/datafields_typesandroles.htm)、[ThoughtSpot：Semantic layer](https://docs.thoughtspot.com/cloud/26.7.0.cl/semantic-layer)
- 如果指数据服务治理的指标、维度、聚合与目录语义，则具备生产级生成的基础。生成决策主要消费元数据快照；少量真实数据只用于发布前验真和基数/空集/性能检查，不应让模型从大批业务数据行反推口径。

### 1.2 MetricCanvas 的页面侧骨架已经成立，真正短板在供给语义与生成决策

**仓库事实：**

- 看板页面已经把指标、维度、聚合、筛选放进**结构化查询**，由**统一运行时**经**数据网关**访问**数据服务**；组件只绑定命名**页面数据源**。[整体解决方案](../solution.md)、[ADR-0008：页面数据源](../adr/0008-page-data-sources.md)
- [`packages/page/src/validate.ts`](../../packages/page/src/validate.ts) 已校验指标是否存在、维度是否可用于指标、聚合是否合法。
- [`packages/page/src/component-catalog.ts`](../../packages/page/src/component-catalog.ts) 已描述每类纯渲染组件的用途、适用情形、数据形状和默认跨度。
- [`packages/mcp/src/index.ts`](../../packages/mcp/src/index.ts) 已把“查目录 → 生成 → 校验 → 保存 → 精确页面修订预览 → 用户确认 → 申请发布”写入页面搭建 Agent 的受治理流程。

**关键缺口：**

[`packages/data-gateway/src/sync-catalog.ts`](../../packages/data-gateway/src/sync-catalog.ts) 明确记录：数据服务尚未真实提供 `availableDimensions`、`availableAggregations`、维度值类型等信息；同步器当前把“全部维度可用”和 `sum/avg/count` 作为宽松默认。也就是说，页面校验机制已经存在，但它依赖的兼容性事实目前仍有占位成分。

**推断：**

这使“更丰富的真实元数据供给”成为进入指标/维度驱动生成前的硬门槛。若不先补齐，生成器会在一个错误地近似为“任意指标 × 任意维度 × 任意聚合都合法”的空间里工作；页面文档可能通过形式校验，却在口径、粒度、连接或实际查询阶段失败。

### 1.3 应采用“两级自动化”，不要把单图规则和整页生成混成一个黑盒

1. **确定性单图推荐**：根据分析任务、字段角色、维度类型/基数、指标单位、结果形状，生成并排序候选纯渲染组件。Tableau Show Me 是直接先例。
2. **AI 整页规划**：把页面目标拆成若干分析任务，选择指标/维度、组织分区、挑选候选组件和筛选联动；AI 只生成领域 DSL，不生成生产代码，也不能绕过校验与发布治理。Power BI Copilot、ThoughtSpot SpotterViz 和 Superset MCP 的做法证明整页/多图生成可用，但它们都保留编辑、预览、权限或保存边界。

这与 ADR-0001、ADR-0003、ADR-0008 的方向一致，不需要更换看板页面资产格式，也不需要把 A2UI 变成资产真源。[ADR-0001](../adr/0001-domain-dsl-over-a2ui.md)、[ADR-0003](../adr/0003-strict-declarative-spec.md)、[ADR-0008：不可变页面修订与发布租约](../adr/0008-immutable-page-revisions-and-publish-leases.md)

### 1.4 生成应发生在创作期，并“编译”为看板页面；统一运行时不应每次打开都重新猜页面

**一手事实：**

- LookML 看板页面以 `.dashboard.lookml` 文件存在，预览后随其他 LookML 变更一起发布到生产。[Looker：Building LookML dashboards](https://docs.cloud.google.com/looker/docs/building-lookml-dashboards)
- ThoughtSpot 的 TML 把 Models、Answers、Liveboards 等表示为可版本管理、批量编辑和迁移的人类可读文件；SpotterViz 生成的 Liveboard 是可保存、分享、导出和嵌入的标准 Liveboard。[ThoughtSpot：TML](https://docs.thoughtspot.com/cloud/26.7.0.cl/tml)、[ThoughtSpot：SpotterViz](https://docs.thoughtspot.com/cloud/26.7.0.cl/spotter-viz)
- Power BI Copilot 生成报表页后，仍由作者按普通报表保存；Superset 的 AI 流程先预览、明确保存后才形成图表资产。[Power BI：Create and edit reports with Copilot](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-reports)、[Superset：Using AI with Superset](https://superset.apache.org/user-docs/using-superset/using-ai-with-superset/)

**对 MetricCanvas 的推断：**

推荐把本方向实现为 **authoring-time compilation**：

```text
页面目标 + 指标/维度语义 + 生成规则/AI
                  ↓ 创作期编译
        可校验的看板页面文档
                  ↓ 保存
              页面修订
                  ↓ 打开
       统一运行时确定性取数和渲染
```

不建议统一运行时在每次访问时根据当前数据重新选择组件或重排页面。动态猜测会让同一个已发布页面在没有页面修订的情况下改变结构，破坏 diff、评审、精确预览、回滚和发布租约的意义。运行时可以让**数据快照**和筛选状态动态变化，但页面结构变化必须形成新的页面修订。

### 1.5 区分“固定 Explore 自动页”与“需要分析意图的业务看板页面”

**固定 Explore 自动页**可以主要由目录规则生成：例如选择一个指标后，自动给出当前值、默认时间趋势、若干低基数维度对比和明细入口。Tableau 已支持在很少或没有字段放入工作表时选择图形并让系统 “Choose for me”；Power BI 也支持从已发布语义模型 Auto-create report。[Tableau：Use Show Me to Start a View](https://help.tableau.com/current/pro/desktop/en-gb/buildauto_showme.htm)、[Power BI：Create reports from semantic models in Teams](https://learn.microsoft.com/en-us/power-bi/collaborate-share/office-integration/business-user-teams-create-reports)

**业务看板页面**则不能只按目录穷举。它必须知道受众、经营目标、时间范围、要回答的问题、主次关系和允许的降级策略；ThoughtSpot SpotterViz 的流程也会先推断 Liveboard 需要回答的业务问题，再生成 Answers、分组和布局。[ThoughtSpot：SpotterViz](https://docs.thoughtspot.com/cloud/26.7.0.cl/spotter-viz)

对 MetricCanvas 的产品边界建议：

- “快速探索某个指标”可以接近一键自动生成，先形成未保存页面文档；用户明确保存后才形成页面修订，仍须人工确认发布；
- “生成经营分析/专题汇报页面”必须先取得页面目标，歧义时提问，再进入整页规划；
- 两者共享同一领域 DSL、校验器、页面修订和统一运行时，不应发展成两套页面协议。

## 2. 业界一手实践给出的共同架构

| 实践 | 已被一手资料证明的能力 | 对 MetricCanvas 的直接启示 |
|---|---|---|
| Looker / LookML | 模型定义 Explore、连接、维度和度量；用户选字段后由 Looker 生成 SQL。LookML 看板页面可存为文件、进入 Git、校验后部署。[模型与字段](https://docs.cloud.google.com/looker/docs/lookml-terms-and-concepts)、[生成 SQL](https://docs.cloud.google.com/looker/docs/how-looker-generates-sql)、[LookML dashboards](https://docs.cloud.google.com/looker/docs/building-lookml-dashboards)、[Git 工作流](https://docs.cloud.google.com/looker/docs/version-control-and-deploying-changes) | “指标/维度驱动查询”与“页面即代码”可以同时成立；语义定义、查询、页面文档应分层，不能把计算口径复制进页面。 |
| Tableau VizQL / Show Me | VizQL 把查询与视图结构放在同一代数描述中；Show Me 按字段角色自动选择标记和视图候选，并生成小多图。[Show Me 论文](https://www.tableau.com/sites/default/files/whitepapers/081027-infovis-showme-vfinal-fix.pdf)、[Show Me 帮助](https://help.tableau.com/current/pro/desktop/en-gb/buildauto_showme.htm) | 第一阶段不必依赖 LLM：从字段语义到图表候选可以由规则稳定完成；LLM 更适合做任务拆解与候选组合。 |
| Power BI / Fabric | Power BI 语义模型是“可供报表和可视化使用的数据源”，包含关系和计算；Fabric 将其定义为带指标、业务友好术语的分析域逻辑描述。Copilot 可创建/编辑报表页。[语义模型](https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand)、[Fabric 语义模型](https://learn.microsoft.com/en-us/fabric/data-warehouse/semantic-models)、[Copilot 创建报表](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-reports) | 整页生成的质量上限取决于模型质量，不是模型参数量；AI 之前要先准备目录、关系、命名和业务语义。 |
| ThoughtSpot | 语义层编码指标定义、连接逻辑、财务日历、行列权限与 AI 上下文；SpotterViz 可从提示自动构建、布局和修改 Liveboard，但当前是 Early Access，且参数化 Answer 等场景仍建议人工先建。[Semantic layer](https://docs.thoughtspot.com/cloud/26.7.0.cl/semantic-layer)、[SpotterViz](https://docs.thoughtspot.com/cloud/26.7.0.cl/spotter-viz) | 完整看板页面生成已具产品可行性；但“自动选择数据源 + 生成分析 + 布局”仍需要业务消歧、编辑权限、可回退检查点和手工兜底。 |
| Apache Superset | Superset 提供轻量语义层、按数据集列和指标搭图；资产可导出为 YAML。其 MCP 流程默认先生成 Explore 预览链接，用户要求保存后才持久化。[产品能力](https://superset.apache.org/user-docs/)、[创建看板](https://superset.apache.org/user-docs/using-superset/creating-your-first-dashboard/)、[导入导出](https://superset.apache.org/admin-docs/configuration/importing-exporting-datasources/)、[AI/MCP](https://superset.apache.org/user-docs/using-superset/using-ai-with-superset/) | 开源 BI 同样收敛到“语义目录 + 结构化图表资产 + preview-first”；预览与保存分离是生成式页面治理的实用边界。 |
| Vega-Lite | 用简洁 JSON 声明 mark、字段到视觉通道的编码及多视图组合；编译器自动生成比例尺、坐标轴、图例与交互数据流；JSON Schema 可验证规格。[官方概览](https://vega.github.io/vega-lite/docs/)、[规格](https://vega.github.io/vega-lite/docs/spec.html)、[原始论文](https://vis.mit.edu/pubs/vega-lite.pdf) | “高层声明 + 编译默认值”能大幅缩小生成空间。MetricCanvas 可借鉴其编译思想，但无需采用其包含计算变换的完整图形语法。 |
| A2UI | Agent 只请求客户端受信 catalog 中的组件，以声明式 JSON 传递 UI；客户端校验后映射到本地组件，不执行 Agent 生成的任意代码。[A2UI 介绍](https://a2ui.org/introduction/what-is-a2ui/)、[v0.9 协议](https://a2ui.org/specification/v0.9-a2ui/)、[官方仓库](https://github.com/google/A2UI) | 其“封闭组件目录 + 数据而非代码 + 协议校验”支持 MetricCanvas 现有治理路线；A2UI 缺少指标、维度、聚合等 BI 语义，适合作为未来渲染通道，不适合替换领域 DSL。 |

## 3. 真正需要“驱动页面”的元数据

### 3.1 指标与维度 code 不够，至少需要以下机器可读语义

**指标：**

- 稳定 code、业务名称、业务定义、值类型、单位和默认展示建议；
- 聚合语义：允许的聚合、可加/半可加/不可加、默认聚合；
- 时间语义：默认时间维度、允许粒度、是否是存量/流量/期末值；
- 可用维度与合法连接路径，而不只是一个全局维度集合；
- 安全/权限标签、数据新鲜度与质量状态；
- 空值、零值、分母为零等业务语义；
- 可选的已验证问题/答案或典型分析任务，供 AI 消歧。

**维度：**

- 稳定 code、业务名称、值类型；
- 语义角色：时间、地域、普通类别、层级、实体标识、自由文本；
- 基数、排序、层级和地理角色；
- 是否可筛选、是否适合分组、是否允许暴露样例值；
- 与哪些指标及聚合组合合法。

**一手依据：**

- Power BI 的关系负责在表间传播筛选，并建议用维度表/事实表的星型模型；没有关系路径时字段组合无法正确工作。[Power BI：Model relationships](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand)
- Looker 在模型中编码连接；连接产生 fanout 时，需要主键与 symmetric aggregates 才能确保聚合正确。[Looker：symmetric_aggregates](https://docs.cloud.google.com/looker/docs/reference/param-explore-symmetric-aggregates)、[Looker：join 后 measure 缺失的原因](https://docs.cloud.google.com/looker/docs/best-practices/how-to-troubleshoot-when-measures-dont-come-through-a-join)
- ThoughtSpot 明确把指标定义、连接逻辑、财务日历、行级安全和 AI 上下文作为语义层内容，并强调这些定义由人验证。[ThoughtSpot：Semantic layer](https://docs.thoughtspot.com/cloud/26.7.0.cl/semantic-layer)
- Power BI 的 AI data schema 通过缩小字段集合降低歧义；Fabric data agent 还提供用户批准的 verified answers 来稳定常见或复杂问题。[Power BI：AI data schemas](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-data-schema)、[Fabric data agent best practices](https://learn.microsoft.com/en-us/fabric/data-science/semantic-model-best-practices)

需要注意一个直接相关的当前限制：Power BI 官方文档明确说明，AI data schema 目前不用于 Copilot 创建报表页、搜索数据或生成 DAX 查询；这些能力仍要求整个语义模型。[Power BI：AI data schemas — considerations and limitations](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-data-schema)。这意味着 MetricCanvas 不能只靠提示词告诉 AI “优先看哪些字段”，而应把当前页面允许使用的指标/维度候选作为结构化输入，并在输出端强制校验。

### 3.2 对当前元数据快照的具体判断

现有 [`CatalogMetric`](../../packages/page/src/catalog.ts) 已包含 `availableDimensions` 和 `availableAggregations`，方向正确；但还缺少或尚未由数据服务真实供给：

- 指标/维度的业务说明与同义词；
- 默认时间维度、时间粒度和可加性；
- 地域、层级、实体标识等语义角色；
- 指标单位及多指标是否可共轴/可比较；
- 真实基数、排序和安全可用的样例值；
- 数据新鲜度/质量；
- 真实而非宽松默认的指标—维度—聚合兼容矩阵。

其中最后一项是阻断项；其余项决定自动推荐的质量上限。

## 4. 建议的生成架构

### 4.1 保持三层职责

1. **数据服务决定数据语义**：指标怎么算、哪些维度/聚合可用、权限如何施加。
2. **看板页面决定消费意图**：页面目标被落实为结构化查询、分区、纯渲染组件、筛选状态和跨页下钻。
3. **统一运行时决定执行与呈现**：生成生效查询、取数、管理数据快照与筛选状态、实例化纯渲染组件。

生成器只编排第 2 层，不应把计算表达式带回页面文档。这与当前 ADR-0003 一致。

### 4.2 生成流水线

```text
① 明确页面目标、受众、时间范围和需要回答的问题
  ↓
② 从元数据快照发现候选指标/维度，检查权限与兼容矩阵
  ↓
③ 把目标拆为分析任务：当前值 / 趋势 / 对比 / 构成 / 排名 / 明细
  ↓
④ 规则引擎按字段角色、基数、单位和结果形状生成并排序组件候选
  ↓
⑤ AI 或模板将候选组合成分区、结构化查询、筛选状态和下钻
  ↓
⑥ JSON Schema + 引用/能力不变式 + 元数据语义校验
  ↓
⑦ 对结构化查询做 dry-run/限量真实查询，检查空集、行数、基数与耗时
  ↓
⑧ 保存为新的页面修订并预览；用户确认后再申请发布
```

步骤 ④ 应尽量确定性；步骤 ③、⑤ 才是 AI 最有价值的部分。这样既能解释“为什么用了这个图”，也能在模型升级后保持同一输入的基本稳定性。

### 4.3 最小可落地的组件推荐规则

以下为**对 MetricCanvas 的设计推断**，规则来源是 Tableau Show Me 的字段约束思路、Vega-Lite 的字段编码语法，以及仓库现有组件能力目录：

| 分析任务与字段形状 | 首选纯渲染组件 | 必要护栏 |
|---|---|---|
| 1 个或少量指标，无分组维度 | `metricCard` | 查询必须收敛为单行/少量行；指标格式来自组件字段绑定 |
| 指标 + 时间维度 | `lineChart` | 时间维度必须有合法粒度与顺序；点数设上限 |
| 指标 + 普通类别维度 | `barChart` | 高基数先 Top N/Other 或改表格；默认按指标排序 |
| 指标 + 地域维度 | `mapChart` | 必须有明确地域角色和可映射层级，不能仅凭字段名猜测 |
| 指标 + 少量类别，且任务明确是部分—整体 | `pieChart` | 需确认可加性；类别过多或不是部分—整体时禁用 |
| 名称维度 + 指标 + Top N 意图 | `rankingCard` | 结构化查询必须带排序和 limit |
| 多维明细、精确核对、字段多 | `table` | 分页/行数限制；避免一次拉取无限明细 |
| 多个单位不兼容的指标 | 多个 `metricCard` 或拆图 | 不自动共轴；必须有单位/可比较性元数据 |

Tableau 官方资料说明，维度会改变视图粒度，加入多个维度会乘法式增加 marks；这正是基数和结果行数必须进入推荐规则的理由。[Tableau：Dimensions and Measures](https://help.tableau.com/current/pro/desktop/en-us/datafields_typesandroles.htm)

## 5. AI 生成结构化页面的治理方式

### 5.1 业界事实

- Superset 的 AI 图表创建默认 `save_chart=False`，先给 Explore 预览链接，用户要求保存后才持久化。[Superset：Using AI with Superset](https://superset.apache.org/user-docs/using-superset/using-ai-with-superset/)
- ThoughtSpot SpotterViz 要求 Liveboard 编辑权限和 TML 编辑权限，遵守行列安全；用户保存前可继续修改，并可回退最近检查点。[ThoughtSpot：SpotterViz](https://docs.thoughtspot.com/cloud/26.7.0.cl/spotter-viz)
- Looker 把 LookML 放进 Git；LookML Validator 会发现缺失连接等全模型错误，官方要求发布生产前校验；Content Validator 还会检查模型变化是否破坏既有 Looks 和看板页面。[Looker：Version control](https://docs.cloud.google.com/looker/docs/version-control-and-deploying-changes)、[LookML validation](https://docs.cloud.google.com/looker/docs/lookml-validation)、[Content validation](https://docs.cloud.google.com/looker/docs/content-validation)
- A2UI 使用受信 catalog，Agent 不能下发任意可执行代码；违反 catalog/schema 的消息由客户端拒绝。[A2UI：What is A2UI](https://a2ui.org/introduction/what-is-a2ui/)、[A2UI Actions 与校验](https://a2ui.org/concepts/actions/)

### 5.2 对 MetricCanvas 的治理结论

现有“严格领域 DSL + 封闭纯渲染组件集 + 校验 + 不可变页面修订 + 精确修订预览 + 发布租约”不是过渡设施，而是整页 AI 生成能够上线的核心护栏。建议坚持：

- AI 只能引用元数据快照中存在且兼容的指标/维度/聚合；
- AI 只能选组件目录中的纯渲染组件，不能生成脚本、HTML、CSS 或远程请求；
- 每个组件选择都输出机器可读理由：分析任务、字段角色、基数、候选与淘汰原因；
- 所有结构化查询在保存前做静态语义校验，在发布前用当前数据服务目录复验；
- 生成先形成未保存页面文档；用户明确保存后才形成页面修订，不能后台改写已发布看板页面；
- 预览不等于发布同意，发布仍需用户明确动作；
- 自动修复只能修结构/引用错误，不能擅自改指标口径、聚合或时间范围。

## 6. 失败边界：哪些事情“指标 + 维度”解决不了

### 6.1 不能唯一推断业务意图

**事实：** Show Me 原始论文明确回避了从模糊任务推断用户意图这一开放问题；Tableau 官方教程要求先给出问题。  
**推断：** 生成输入至少要有页面目标或一组分析问题。“给我销售额和区域维度”只能生成合理候选，不能证明用户要的是区域排名、结构占比、异常区域还是明细核对。

### 6.2 不能假设任意指标与维度都可组合

**事实：** Power BI 依赖关系路径传播筛选；Looker 必须处理 join fanout、主键与对称聚合；Superset 的官方语义层设计提案也提出需要 metric/dimension compatibility matrix。[Power BI relationships](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand)、[Looker symmetric aggregates](https://docs.cloud.google.com/looker/docs/reference/param-explore-symmetric-aggregates)、[Superset SIP-182](https://github.com/apache/superset/issues/35003)  
**推断：** “维度存在于目录”不等于“维度可用于该指标”。真实兼容矩阵缺失时，应阻止生成或降级为需要数据开发确认，而不是让 AI 猜。

### 6.3 结构合法不等于数据结果适合展示

**事实：** Tableau 展示了增加维度会快速增加 marks；Power BI Copilot 官方限制包括不支持自定义 visual、样式/格式修改，复杂 visual 修改还可能丢失细节。[Tableau 字段角色](https://help.tableau.com/current/pro/desktop/en-us/datafields_typesandroles.htm)、[Power BI Copilot limitations](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-reports)  
**推断：** JSON Schema 和目录校验之后，还要用少量真实结果检查空集、单值、异常高基数、截断、单位冲突和耗时。否则会产生“正确但不可读”的页面。

### 6.4 图形正确不等于页面叙事正确

**事实：** Show Me 解决的是字段到视图的默认与推荐；ThoughtSpot SpotterViz 在生成完整 Liveboard 时还要额外分析“需要回答的业务问题”并进行分组和布局。  
**推断：** 单图推荐不能直接升级为整页生成。整页还需要模块顺序、主次关系、筛选范围、跨页下钻和受众语境。

### 6.5 AI 不能成为指标口径与权限的第二事实源

**事实：** ThoughtSpot 把指标、连接、安全规则编码在人工验证的语义层中，并由确定性查询生成施加；Power BI 语义模型可执行 RLS。[ThoughtSpot semantic layer](https://docs.thoughtspot.com/cloud/26.7.0.cl/semantic-layer)、[Power BI semantic models](https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand)  
**推断：** AI 可以解释和组合，不能定义指标计算、扩张数据权限或用页面层衍生表达式绕过数据服务。

### 6.6 声明式语言仍需控制边界

**事实：** Vega-Lite 的高层语法也包含聚合、bin、calculate、过滤等数据变换；A2UI 明确不是健壮的样式系统，样式由客户端控制。[Vega-Lite encoding](https://vega.github.io/vega-lite/docs/encoding.html)、[A2UI 介绍](https://a2ui.org/introduction/what-is-a2ui/)  
**推断：** MetricCanvas 不应因为追求自动图形而把 Vega-Lite 的计算表达力或任意样式搬进页面文档。新的表达需求优先沉到数据服务或受治理组件源码，避免领域 DSL 变成 JSON 编程语言。

## 7. 建议的阶段路线

### 阶段 0：把元数据快照从“可跑”升级为“可信”

完成标准：

- 数据服务真实提供每个指标的可用维度、可用聚合与值类型；
- 补充默认时间维度/粒度、单位、可加性、维度角色/层级/基数；
- 删除同步器的“全部维度可用”宽松默认，未知能力必须显式为未知并阻止自动生成；
- 当前目录版本进入生成记录，发布前按最新目录复验。

这一步不完成，不建议开放整页自动生成。

### 阶段 1：先做确定性“指标/维度 → 单组件”

- 把当前 `componentCatalog.chooseWhen` 从自然语言提示扩展为机器可判定约束：字段角色、数量、基数范围、单位兼容性、是否要求排序/limit；
- 输入一组指标、维度与分析任务，输出排序后的 1～3 个候选组件及原因；
- 用固定样例集验证选择稳定性，先覆盖指标卡、趋势、类别对比、排行、表格和地图；
- AI 可以解释推荐，但不能替代规则决定兼容性。

### 阶段 2：基于页面目标与分析任务生成未保存页面文档

- 从页面目标和模块结构拆出多项分析任务；
- 复用现有 12 列自动网格和组件默认跨度；
- 先限定少量页面原型：经营总览、趋势分析、分类对比、排行与明细；
- 自动生成筛选状态和结构化查询，但跨页下钻仅在目标看板页面和目标筛选器明确存在时生成；
- 每次生成只更新未保存工作副本；用户明确保存后才形成新的页面修订，再走精确修订预览与发布流程。

### 阶段 3：引入 AI 整页规划和迭代

- AI 在规则引擎产出的合法候选上组合，不在开放组件/查询空间里自由创作；
- 对业务歧义必须提问；对 `METRIC_GAP` 继续走指标需求队列和页面搭建蓝图；
- 保存生成解释：用了哪些指标/维度、每个组件回答什么问题、为何不用其他候选；
- 建立回归集，覆盖错误维度、错误聚合、空结果、高基数、单位不兼容、权限差异与目录漂移。

## 8. 建议的决策

1. **通过方向评审：** 下阶段转向指标/维度驱动生成是可行且与现有架构一致的，不需要推翻领域 DSL 或统一运行时。
2. **修正产品表述：** 使用“页面目标 + 指标 + 维度驱动”，不要承诺“只给数据和维度即可生成正确页面”。
3. **把数据服务元数据共建设为前置里程碑：** 当前兼容能力的宽松默认是最大风险。
4. **先规则、后整页 AI：** 用确定性规则拿下单组件，再让 AI 做分析任务拆解与页面组合。
5. **坚持未保存工作副本起步，不自动发布：** 所有生成结果必须经过校验；用户明确保存为页面修订后，再经过真实查询验真、精确修订预览和人工确认。
6. **保持 A2UI 为未来渲染通道：** 借鉴其受信 catalog 与校验思想，但不把其通用 UI 协议升级为看板页面资产格式。

最终判断：

> MetricCanvas 已经跨过“页面能否声明式生成”的技术门槛；下一阶段的成败，不取决于再造一个更强的前端生成器，而取决于能否把数据服务目录升级为可信的指标—维度语义供给，并把“业务问题 → 分析任务 → 组件候选 → 看板页面”做成可解释、可校验、可回退的生成链。

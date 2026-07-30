# 调研:多查询结果服务端组合计算的业界模式

> 背景:MetricCanvas 需要支持"多条 SQL/DQE 分别执行,从各结果提取标量/小结果集,再加减乘除组合出最终指标值"。硬约束:敏感中间数据不进浏览器、不在页面 DSL 里发明 JSON 计算 AST、不大改平台后端、方案要优雅/简洁/AI 友好。候选方案:统一执行端扩展为"组合执行"——多个执行引用 → 服务端执行 → 结果注册为临时命名表 → 运行版本化最终 SQL → 只返回最终标量。
>
> 本文全部依据一手资料(官方文档、源码、官方发布说明),每条结论附来源链接。调研时间:2026-07。

---

## 1. 语义层 / Headless BI 的派生指标(derived metrics)

### 1.1 dbt MetricFlow:derived metrics

- **声明形态**:derived metric 通过一个 `expr` 表达式引用其他已定义 metric 来创建,"enable you to perform calculations with existing metrics",典型用途是利润 = 收入 − 成本这类"指标之上的指标"。表达式就是普通算术/SQL 标量表达式,引用对象是 metric 名(可加 alias、filter、offset)。来源:[dbt 官方文档 Derived metrics](https://docs.getdbt.com/docs/build/derived)。
- **表达式多小**:只有一个 `expr` 字段 + 被引用 metric 列表,没有自定义控制流;这是"微型表达式 + 名字引用"的极简形态。
- **空值处理**:官方提供 `fill_nulls_with` 和 `join_to_timespine` 参数,把空指标值补为 0,"ensuring numeric values for every data row"。来源:[同上](https://docs.getdbt.com/docs/build/derived)。
- **粒度对齐**:offset 派生指标的官方算例展示了编译策略——先在基础粒度(日)聚合出各成员指标,做 offset join,再 `date_trunc` 到请求粒度后聚合,最后计算派生表达式返回最终结果集。即**成员指标各自物化为中间结果,最后一步做算术**。来源:[Derived metric offset 一节](https://docs.getdbt.com/docs/build/derived)。
- **如何编译成 SQL**:MetricFlow 官方 README:"metric requests are compiled into a dataflow-based query plan, which is then optimized and translated into engine-specific SQL"——指标请求 → 数据流查询计划 → 优化 → 引擎特定 SQL(实际产物是多层子查询/CTE 的单条 SQL)。来源:[MetricFlow README](https://github.com/dbt-labs/metricflow)。
- **出身**:MetricFlow 由 Transform 公司创建、dbt Labs 收购后维护(README 资源栏仍链接 transform.co/metricflow),并加入了 Snowflake 发起的 Open Semantic Interchange(OSI)倡议,目标是"defining and exchanging semantic information, enabling AI/BI interoperability"。来源:[MetricFlow README](https://github.com/dbt-labs/metricflow)。

### 1.2 Cube(Cube.dev):calculated measures + views

- **声明形态**:calculated measure 是 `type: number` 的 measure,`sql` 里用 `{measure_name}` 引用其他 measure 做算术,例如 `1.0 * {completed_count} / NULLIF({count}, 0)`(官方示例自带 NULLIF 防除零)。可跨 cube 引用,Cube 自动生成所需 join。来源:[Cube 文档 Calculated measures](https://docs.cube.dev/docs/data-modeling/measures#calculated-measures)、[measures 参考](https://docs.cube.dev/reference/data-modeling/measures)。
- **编译成 SQL**:官方文档直接展示编译结果——引用会内联展开成单条 SELECT,如 `SELECT 1.0 * COUNT(CASE WHEN ... END) / COUNT(users.id) AS paying_percentage FROM users`。来源:[Cube 数据建模 Overview §Using Calculated Measures](https://docs.cube.dev/docs/data-modeling/overview)。
- **AI 集成(官方)**:每个 Cube 部署自带 AI agent(Analytics Chat),配置项 `accessible_views` 限定 agent 可见的 views——即 **AI 的查询面被显式限制在语义层 view 上,而非裸仓库**;另有 AI API(`POST /chat/stream-chat-state`)。来源:[Cube 文档 Agent 配置](https://docs.cube.dev/admin/ai)、[API Reference](https://docs.cube.dev/api-reference/introduction)。Cube 文档站还提供 `llms.txt` 索引供 LLM 消费,来源:[docs.cube.dev/llms.txt](https://docs.cube.dev/llms.txt)。

### 1.3 Looker:measure type 三分类

Looker 官方把 measure 类型分为三类,清晰界定"指标之上的指标"的规则:

- **Aggregate**(sum/average/count…):只能引用维度,不能引用其他 measure;
- **Non-aggregate**(`number`/`yesno`…):不做聚合,**只能引用聚合 measure 或已聚合维度**;官方明确"If you are defining a measure that is based on another measure, the new measure must be of `type: number` to avoid nested-aggregation errors"——即用类型系统防止嵌套聚合;
- **Post-SQL**(`percent_of_total`/`running_total`…):在 Looker 生成查询 SQL **之后**再计算(相当于服务端结果后处理)。

来源:[Looker 官方文档 Measure types](https://docs.cloud.google.com/looker/docs/reference/param-measure-types)。

### 1.4 小结(方向 1)

三家收敛在同一形态:**"指标之上的指标"= 微型标量表达式 + 按名字引用已定义指标**,不引入通用编程结构;空值/粒度问题不靠表达式语言解决,而靠专门参数(`fill_nulls_with`)或类型规则(Looker 禁止嵌套聚合)或编译器(MetricFlow 粒度对齐 join)。这种"名字引用 + 小表达式"的声明对 LLM 生成很友好——但前提是先有完整语义层模型;dbt/Cube 都已把它作为官方 AI 集成的查询面(见第 4 节)。AtScale 未做一手核实,本文不下结论。

---

## 2. 服务端结果组合引擎:把上游结果注册为表再跑 SQL

### 2.1 DuckDB:官方支持"注册外部数据为虚表"

DuckDB 官方文档明确支持两条路:① replacement scan——SQL 里直接按变量名引用 DataFrame/Arrow 对象;② 显式 `duckdb.register("view_name", obj)` 把对象注册为虚表("comparable to a SQL VIEW"),再对其跑任意 SQL,或 `CREATE TABLE ... AS SELECT` 物化。同名解析优先级:显式注册 > 原生表/视图 > replacement scan。来源:[DuckDB 官方文档 Python Data Ingestion](https://duckdb.org/docs/current/clients/python/data_ingestion.html)。即"结果集注册为临时命名表 → 跑最终 SQL"是 DuckDB 的一等公民用法,不是 hack。

### 2.2 Grafana:同一模式的生产级先例(但引擎不是 DuckDB)

见第 3.1 节详述。Grafana SQL Expressions 就是"多个上游查询结果 → 服务端注册为表(RefID 即表名)→ 跑一段 SQL → 返回结果"的成熟实现,2026-07-15 随 v13.1.0 GA。引擎选择上 Grafana 没用 DuckDB,而是嵌入 Go 生态的 `dolthub/go-mysql-server`(Grafana fork),源码证据:[grafana/grafana go.mod](https://github.com/grafana/grafana/blob/main/go.mod) 中 `github.com/dolthub/go-mysql-server => github.com/grafana/go-mysql-server`。

### 2.3 Rill Data:内嵌 DuckDB,但是 ingest 模式而非结果组合

Rill 默认"includes DuckDB as an embedded OLAP engine that ingests data from data sources and powers your dashboards",官方建议数据量 ≤50GB;也支持外接 ClickHouse/Druid/Pinot/MotherDuck。来源:[Rill 官方文档 DuckDB connector](https://docs.rilldata.com/developers/build/connectors/olap/duckdb)、[Connectors 总览](https://docs.rilldata.com/developers/build/connectors)。注意区别:Rill 是**先把源数据整体导入 DuckDB 再服务查询**(数据副本常驻),不是"按需执行上游查询、临时注册结果"。

### 2.4 Seafowl(Splitgraph):基于 DataFusion 的"分析结果分发"数据库

Seafowl 是面向数据驱动 Web 应用的分析数据库,构建在 **Apache DataFusion**(非 DuckDB)+ Parquet/Delta 之上,主打 HTTP 缓存友好的查询 API(可放 CDN 后面);支持外部表指向远程文件/远程数据库。来源:[Seafowl README](https://github.com/splitgraph/seafowl)。它证明"轻量嵌入式 SQL 引擎做服务端组合/分发"有多种引擎选型,但其定位是缓存友好分发,不是多上游结果组合。

### 2.5 Steampipe:API → 表 的联邦 SQL

Steampipe 把云 API 映射为 Postgres 外部表(FDW)或 SQLite 虚表,"write SQL-based queries to explore dynamic data",可以跨 API join。来源:[Steampipe 官方文档](https://steampipe.io/docs)。模式是"**虚表按需拉取远端数据**",与候选方案同构(表是接口、数据惰性到达),但绑定 Postgres/SQLite 生态。

### 2.6 Trino:分布式联邦查询

Trino 官方定位是分布式查询引擎:connector 把各数据源适配为表,catalog.schema.table 全限定名可在**同一条 SQL 里跨源 join**。来源:[Trino Concepts](https://trino.io/docs/current/overview/concepts.html)。但 Trino 官方同时强调它"designed to efficiently query vast amounts of data using distributed queries",架构为 coordinator + workers 集群(来源:[Use cases](https://trino.io/docs/current/overview/use-cases.html)),对"取几个标量做加减乘除"是重型基础设施。

### 2.7 Apache Calcite:嵌入式联邦框架

Calcite 官方描述:动态数据管理框架,"omits … storage of data",通过 adapter 把任意数据集合(内存对象、JDBC 源等)注册为表,再对其执行 SQL,并用优化器规则把算子下推到源。官方首页示例即"把一个 Java 对象注册为 schema,连接空数据库跑 SQL"。来源:[Calcite Background](https://calcite.apache.org/docs/index.html)。适合 JVM 系自建组合层,代价是自己组装 planner/adapter。

### 2.8 小结(方向 2)

"服务端把多个上游结果当表、再跑一段 SQL"在业界有明确谱系:**Grafana SQL Expressions(结果注册,最接近)、DuckDB register(引擎级原生支持)、Steampipe/Trino/Calcite(虚表联邦,惰性拉取)**。取舍:Grafana 路线最贴近"不大改后端"(引擎内嵌进现有服务、按请求生命周期存活);Rill 路线要求数据先入库;Trino 路线是独立集群;Calcite 适合 JVM 深度定制。引擎选型上,进程内嵌入有 go-mysql-server(Go)、DuckDB(C++,各语言 binding)、DataFusion(Rust)三个被生产验证的选项。

---

## 3. BI 产品对"跨查询计算字段"的处理

### 3.1 Grafana SQL Expressions(与候选方案最同构)★

- **是什么**:"server-side expressions that manipulate and transform the results of data source queries using MySQL-like syntax";在服务端、浏览器之外求值:"Grafana evaluates these expressions on the server, not in the browser or at the data source"。来源:[Grafana 官方文档 SQL expressions](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/sql-expressions/)。
- **机制**:每个上游查询的结果被当作一张表,表名就是查询的 RefID(`SELECT * FROM A`);"An embedded SQL engine powers SQL expressions, treating each query result as a table",schema 从数据源返回的列推导。支持跨查询、跨数据源 JOIN、GROUP BY、CTE。来源:[同上文档](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/sql-expressions/)、[GA 发布说明(v13.1.0,2026-07-15)](https://grafana.com/whats-new/2026-07-15-transform-your-data-with-sql-expressions--now-generally-available/)。
- **引擎实现**:嵌入 `dolthub/go-mysql-server`(Grafana fork,MySQL 方言;正则用 Go RE2 而非 MySQL 完整正则)。源码证据:[grafana/grafana go.mod](https://github.com/grafana/grafana/blob/main/go.mod);文档也说明 RE2 限制。
- **工程护栏(官方文档明列,值得直接抄)**:
  - 输入 cell(行×列,跨全部被引用查询)上限 `sql_expression_cell_limit` 默认 100,000;输出 cell 上限默认 100,000;SQL 文本长度上限默认 10,000 字符;均可配置;
  - 每个 panel/alert **只允许一条 SQL expression**;
  - 用于告警时结果必须**恰好一个数值列**(可选若干字符串列作标签)——即"最终收敛为标量(组)"是显式契约;
  - 已知坑:上游查询返回 0 行时无法推断 schema。
  来源:[SQL expressions 文档 Known limitations / Query limits / Alerting 各节](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/sql-expressions/)。
- **AI**:官方 Grafana Assistant "knows SQL expressions",可解释/修错/改进这类查询。来源:[同上文档](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/sql-expressions/)。
- 前身:较早的 server-side expressions(math/reduce,`$A + $B` 语法)同样服务端执行,面向时序/单值。来源:[Expression queries 文档](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/expression-queries/)。

### 3.2 Metabase:`{{#123}}` 引用已保存问题 ★

- **机制是 SQL 文本内联,不是结果物化**:运行时 `{{#5-gizmo-orders-in-2019}}` 标签"will be substituted with the SQL query of the referenced question, surrounded by parentheses",典型用法是放进 CTE(`WITH gizmo_orders AS {{#5...}}`)。
- **官方明确的限制**:只支持 SQL 数据库;被引用问题必须**基于当前查询所选的同一个数据库**;拿到的是"结果"语义但实现是其 SQL,不能引用其中变量(带 field filter 的问题无法被引用)。
- 来源:[Metabase 官方文档 Referencing models and saved questions](https://www.metabase.com/docs/latest/questions/native-editor/referencing-saved-questions-in-queries)。
- 启示:文本内联换来了零数据搬运,但被"同库"硬约束锁死;跨引擎(多条 DQE、不同数据源)场景必须走"结果物化注册"路线(Grafana 路线)。

### 3.3 Superset:虚拟数据集

虚拟数据集 = 存在 Superset 元数据库里的一段 SQL,作为数据集实体供图表使用;"A virtual dataset is one that has SQL associated with it, pretty much like a native DB view. The main difference is that the SQL defining a virtual dataset lives in the Superset main database"(Superset 维护者 betodealmeida 在官方仓库讨论中的说明)。图表查询时它作为子查询包装重跑,仍在**单一数据库连接内**,没有跨查询结果组合能力。来源:[apache/superset Discussion #22484(维护者答复)](https://github.com/apache/superset/discussions/22484)、[Preset(Superset 商业公司)Semantic Layer 文档性博客](https://preset.io/blog/understanding-superset-semantic-layer/)。

### 3.4 Power BI:DAX measures

measure 用 DAX 表达式定义,"DAX includes a library of over 200 functions, operators, and constructs";在模型/报表层随筛选上下文动态求值(model measures + report-level measures)。来源:[Microsoft Learn: Measures in Power BI Desktop](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-measures)。这是"完整自研表达式语言"路线的代表——能力最强,但正是题目中被否决的"自定义计算 AST"的重量级形态:200+ 函数的语言需要自己的解析器、求值器、文档和学习成本。

### 3.5 Tableau:LOD 表达式

LOD(`{FIXED|INCLUDE|EXCLUDE [维度] : 聚合}`)让计算粒度独立于视图粒度,是对"**粒度对齐**"问题的产品化方案(如 FIXED 忽略视图维度、INCLUDE 补充维度后再在视图层重聚合)。来源:[Tableau 官方帮助 Create Level of Detail Expressions](https://help.tableau.com/current/pro/desktop/en-us/calculations_calculatedfields_lod.htm)。对本题的参考价值:如果各成员查询粒度不一致,粒度语义需要显式声明(Tableau 用关键字,MetricFlow 用编译器对齐),纯 SQL 组合层则由最终 SQL 作者自己负责。

### 3.6 小结(方向 3)

与"组合已有查询结果"最接近的两家:**Grafana(结果物化 + 服务端嵌入 SQL 引擎,跨数据源,GA)与 Metabase(SQL 文本内联,零搬运但限同库)**。Superset 属 Metabase 同路线的弱化版;Power BI/Tableau 则代表"自研表达式语言"路线,能力与复杂度同步膨胀。

---

## 4. AI 友好性:LLM 生成 SQL vs 受限 DSL vs 语义层 API

### 4.1 Snowflake Cortex Analyst(官方立场最明确)

- 官方文档直接论述为什么不做裸 text-to-SQL:"Generic AI solutions often struggle with text-to-SQL conversions"(复杂 schema、空值处理等),Cortex Analyst"overcomes this limitation by using a semantic model"——语义模型"similar to those of database schemas, but allow for a richer description"。
- 现推荐 Semantic Views(schema 级对象,定义业务概念、指标、关系),官方列举其提升准确率的手段:业务同义词、指标/维度描述、**verified queries(问题→SQL 的已验证示例)**、custom instructions。
- 架构是"agentic AI system"组合多个 LLM,并声明生成的 SQL 在用户的 warehouse 内、遵守 RBAC 执行;明确"limited to answering questions that can be resolved with SQL",且**不访问上一次查询的结果**。
- 来源:[Snowflake 官方文档 Cortex Analyst](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)。

### 4.2 dbt:MCP server + Semantic Layer

dbt 官方 MCP server 把 Semantic Layer 查询、metadata/lineage、text-to-SQL 等作为工具暴露给任意 MCP 客户端,定位是"consistent, governed access to models, metrics, lineage… across your AI tools"——即官方推荐 LLM 通过**语义层 API/受治理工具**消费指标,而非直连仓库写 SQL。来源:[dbt 官方文档 dbt MCP server](https://docs.getdbt.com/docs/dbt-ai/about-mcp)。MetricFlow 参与 OSI 开放语义标准,目标即 AI/BI 互操作(来源:[MetricFlow README](https://github.com/dbt-labs/metricflow))。

### 4.3 Cube:agent 只看语义层 views

Cube 每个部署内置 agent,`accessible_views` 把 agent 的上下文限定到指定 views;文档明示该字段是"context guidance",真正的安全靠 access policies。即官方设计是 **LLM 查询面 = 语义层 view 列表,权限 = 平台策略**,两者分离。来源:[Cube Agent 配置文档](https://docs.cube.dev/admin/ai)。

### 4.4 Grafana:AI 辅助写受限 SQL

Grafana 的做法是另一极:不建语义层,而是**把 LLM 生成目标缩小为"对若干已知 schema 的结果表写一段 MySQL 方言 SQL"**,并配 Grafana Assistant 辅助生成/修复。来源:[SQL expressions 文档 Grafana Assistant 节](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/sql-expressions/)。

### 4.5 小结(方向 4)

官方立场收敛为两条互补经验:① **裸 NL2SQL 对复杂 schema 不可靠,给 LLM 一个更小、语义更丰富的目标面(语义模型/语义层 API/verified queries)能显著提升准确率**(Snowflake、dbt、Cube 三家官方文档一致);② 当目标语言必须是 SQL 时,**缩小输入宇宙**(Grafana:N 张已命名结果表 + 单一方言 + cell/长度限额)同样是官方认可的 AI 友好做法。没有任何一家主流厂商选择"发明 JSON 表达式树给 LLM 生成"。

---

## 5. 业界模式 vs "组合执行"候选方案:客观对比

候选方案回顾:统一执行端新增"组合执行"——多个 SQL ID/DQE ID 引用 → 服务端执行 → 结果注册为临时命名表 → 运行版本化最终 SQL → 只返回最终标量。

### 5.1 同构关系

| 业界模式 | 与候选方案的关系 |
|---|---|
| Grafana SQL Expressions | **几乎完全同构**:上游查询(RefID)→ 服务端嵌入引擎把结果当表 → 一段 SQL → 输出(告警场景强制单数值列 ≈ "只返回最终标量")。已 GA,证明模式成立 |
| Metabase `{{#123}}` | 同构于"按名字引用已有查询",但实现是 SQL 文本内联,被同库约束锁死;候选方案的"结果物化"正是解除该约束的代价与收益 |
| DuckDB `register()` | 候选方案"注册临时命名表"这一步的引擎级原生支持(若选 DuckDB 作组合引擎) |
| dbt/Cube/Looker 派生指标 | 声明层的"上位参考":名字引用 + 微型表达式;但它们要求先建完整语义模型,且编译产物仍是发往**单一**引擎的一条 SQL,不覆盖"多执行端结果组合" |
| Trino/Calcite/Steampipe | 联邦虚表路线:表是接口、数据惰性拉取;能力超出需求(大数据量分布式/优化器下推),基础设施或定制成本高 |
| Power BI DAX | 反面参照:自研完整表达式语言 = 题目已否决的 JSON AST 路线的成熟终点,复杂度可见(200+ 函数) |

### 5.2 差异与需自行决策的点(业界经验对应)

1. **组合引擎选型**:Grafana 选 go-mysql-server(Go 进程内、MySQL 方言),DuckDB/DataFusion 为另两个生产验证选项(Rill/MotherDuck 系、Seafowl)。差异主要在宿主语言、SQL 方言、类型系统。
2. **护栏必须显式**:Grafana 的输入/输出 cell 限额、SQL 长度限额、"每次只允许一条组合 SQL"、"最终结果形状契约(单数值列)"都是文档化配置项——候选方案的"只返回最终标量"与之一致,建议同样把中间结果行数上限、最终结果形状写成硬契约。
3. **schema 推断的坑**:Grafana 文档明确"上游返回 0 行则无法推断 schema"。候选方案若从 DQE 元数据(而非结果)取列类型,可规避此坑;这是比 Grafana 更有利的先天条件。
4. **空值/除零**:声明式语义层用 `fill_nulls_with`(dbt)或惯用 `NULLIF`(Cube 官方示例);纯 SQL 组合层里这由最终 SQL 作者(或生成它的 LLM + 校验器)负责。
5. **粒度对齐**:MetricFlow 用编译器对齐、Tableau 用 LOD 关键字;标量组合场景基本不触发,但若未来允许"小结果集 join 小结果集",需要预先想清楚由谁保证对齐。
6. **版本化最终 SQL**:业界无直接对应物(Grafana 的 SQL 存在 panel JSON 里,Metabase 存在 question 里),但把"计算定义"作为受治理、可版本化的服务端资产,与语义层把 metric 定义放进代码仓库的哲学一致(MetricFlow "Build and maintain all of your metric logic in code")。

### 5.3 三个维度上最有参考价值的模式

- **优雅**:Grafana SQL Expressions——同一模式在通用可观测平台上走到 GA,且没有为此发明新语言;其全部增量概念只有"RefID 即表名"。
- **简洁**:Metabase `{{#id}}` 的"名字引用"心智 + Grafana 的"一段 SQL 收口"组合起来就是候选方案,概念数最少;对照组 Power BI DAX 展示了自研表达式语言的复杂度终点。
- **AI 友好**:两条官方验证路径可叠加——(a)Snowflake/dbt/Cube 一致的"给 LLM 受限且语义化的目标面";(b)Grafana 的"LLM 写小 SQL,输入是已知 schema 的命名表"。候选方案天然处在 (b),且执行引用(SQL ID/DQE ID)自带 (a) 的治理属性;SQL 是 LLM 训练分布内最强的形式语言,而校验可用现成 SQL parser 完成,无需为自定义 DSL 自建校验器。

---

## 附:来源清单

1. dbt Derived metrics:https://docs.getdbt.com/docs/build/derived
2. MetricFlow README(编译原理、OSI、Transform 出身):https://github.com/dbt-labs/metricflow
3. Cube Calculated measures:https://docs.cube.dev/docs/data-modeling/measures#calculated-measures
4. Cube 数据建模 Overview(生成 SQL 示例):https://docs.cube.dev/docs/data-modeling/overview
5. Cube measures 参考:https://docs.cube.dev/reference/data-modeling/measures
6. Cube Agent/AI 配置:https://docs.cube.dev/admin/ai ;API Reference:https://docs.cube.dev/api-reference/introduction
7. Looker Measure types:https://docs.cloud.google.com/looker/docs/reference/param-measure-types
8. Grafana SQL expressions 文档:https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/sql-expressions/
9. Grafana SQL expressions GA 公告(v13.1.0):https://grafana.com/whats-new/2026-07-15-transform-your-data-with-sql-expressions--now-generally-available/
10. Grafana expression queries(math/reduce):https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/expression-queries/
11. Grafana go.mod(go-mysql-server fork 证据):https://github.com/grafana/grafana/blob/main/go.mod
12. Metabase Referencing saved questions:https://www.metabase.com/docs/latest/questions/native-editor/referencing-saved-questions-in-queries
13. Superset 虚拟数据集(维护者说明):https://github.com/apache/superset/discussions/22484 ;Preset 博客:https://preset.io/blog/understanding-superset-semantic-layer/
14. Power BI Measures:https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-measures
15. Tableau LOD:https://help.tableau.com/current/pro/desktop/en-us/calculations_calculatedfields_lod.htm
16. DuckDB Python data ingestion(register/replacement scan):https://duckdb.org/docs/current/clients/python/data_ingestion.html
17. Rill DuckDB connector:https://docs.rilldata.com/developers/build/connectors/olap/duckdb ;Connectors:https://docs.rilldata.com/developers/build/connectors
18. Seafowl README(DataFusion):https://github.com/splitgraph/seafowl
19. Steampipe 文档:https://steampipe.io/docs
20. Trino Concepts:https://trino.io/docs/current/overview/concepts.html ;Use cases:https://trino.io/docs/current/overview/use-cases.html
21. Apache Calcite Background:https://calcite.apache.org/docs/index.html
22. Snowflake Cortex Analyst:https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst
23. dbt MCP server:https://docs.getdbt.com/docs/dbt-ai/about-mcp

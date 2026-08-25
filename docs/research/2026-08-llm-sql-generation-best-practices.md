# 让大模型写对 SQL：业界最佳实践与「规则堆叠失效」的一手证据

> 状态：业界调研，不含本仓架构决策
> 日期：2026-08-24
> 范围：Text-to-SQL 与 ETL SQL 生成的正确性（语法 / 语义 / 性能）保障手段；LLM 指令遵守能力的实测边界
> 方法：仅采用一手来源（论文原文、官方 benchmark leaderboard、厂商官方文档与第一方工程博客、开源项目官方文档）。leaderboard 数字为 2026-08-24 抓取值。证据强度较弱的来源已就地标注。

---

## 0. 三句话结论

1. **业界不靠 prompt 保证 SQL 正确。** 主流产品把错误逐类下沉到「不可能出错的层」：能用关系基数与类型系统表达的（join 扇出、指标口径）做成语义层结构由编译器生成；能被程序判定真假的（语法、字段存在性、分区裁剪、扫描量）做成解析器、`EXPLAIN` 预检和引擎级开关；只有无法形式化的部分（业务口径解释、何时反问、输出格式）才留给文字。Databricks 官方把这个优先级写成了明文：*"Use text instructions only as a last resort when SQL expressions and examples cannot address the need."*（[来源](https://docs.databricks.com/aws/en/genie/best-practices)）

2. **你的规则条数早已越过实测可靠区间，而且失败形态是静默漏做。** FollowBench 实测 GPT-4 的「可连续满足约束数」上限约 3 条；IFScale 把指令从 10 条加到 500 条，gpt-4.1 的遵守率从 98% 掉到 48.9%，且高密度下「漏做:做错」比例可达 34:1。一条被忽略的策略不报错、不留痕，只产出一段看起来正常的 SQL。

3. **更关键的是：加规则本身可能是负收益。** Spider 2.0 作者为 o1-preview 人工注入每道题实际需要的方言函数文档（等于完美的规则供给），准确率从 12.60% **降到** 9.51%。同一篇论文测出 prompt 超过窗口约 70% 后性能开始下滑。规则不是免费的，它花的是注意力预算。

---

## 1. 先校准现实：当前技术水平到哪

### 1.1 三代 benchmark 的断崖

| Benchmark | 任务特征 | 最高分 | 人类基线 |
|---|---|---|---|
| Spider 1.0 (test) | 小 schema，单条 SELECT | 91.2%（MiniSeek，未公开代码）；有论文的最高为 DAIL-SQL + GPT-4 **86.6%** | 官方未发布 |
| BIRD (hidden test) | 95 库 33.4 GB，含外部知识 | **81.95%**（AskData + GPT-4o） | **92.96%** |
| Spider 2.0-Lite | 真实企业仓库，多方言 | 榜首 76.23%（厂商自评）；**学术可复现最高 55.21%**（ReFoRCE + o3） | 未发布 |
| Spider 2.0-DBT | repo 级 dbt 工程 | 65.6% | 未发布 |
| BIRD-CRITIC 1.0-Open | SQL 报错修复，4 方言，非 SELECT 为主 | **35.5%**（o1-preview） | 78.87%（禁用 AI 工具） |
| LiveSQLBench-Base-Lite | PostgreSQL，含 CRUD/DDL | 48.00%（DIA agent） | 未发布 |

来源：[Spider leaderboard](https://yale-lily.github.io/spider)、[BIRD leaderboard](https://bird-bench.github.io/)、[Spider 2.0 官方站](https://spider2-sql.github.io/)、[BIRD-CRITIC](https://bird-critic.github.io/)、[LiveSQLBench](https://livesqlbench.ai/)

> **重要 caveat**：Spider 2.0 榜单上 80%+ 的条目绝大多数是厂商自评提交，官方明确说明只有走 submission guidance 的条目经过验证。做工程判断应参照有论文有代码的那一档（55–63%），不是榜首。

### 1.2 同一个方法跨 benchmark 的表现，说明难度来自哪

| 方法 | Spider 1.0 test | BIRD test | Spider 2.0-Lite | Spider 2.0-Snow |
|---|---|---|---|---|
| DAIL-SQL + GPT-4o | 86.6% | 57.4% | **5.68%** | **2.20%** |
| CHESS + GPT-4o | — | — | 3.84% | 1.28% |
| DIN-SQL + GPT-4o | — | — | **1.46%** | **0.00%** |
| SFT CodeS-15B（微调） | — | 60.37% | 0.73% | 0.00% |

[来源：Spider 2.0 论文 §C.4](https://arxiv.org/abs/2411.07763)

差距是可量化的，不是「更难一点」：Spider 2.0 平均 **812 列**/库（BIRD 约 54 列，差 14 倍）；gold SQL 平均 **144 token**（BIRD 30.9）；**85.98%** 的样例需要方言专有函数，平均每条用到 **7.1 个**特殊函数。

**这 30 多个点的落差几乎全部由 schema 规模、方言、多步 CTE 编排、外部文档 grounding 四件事贡献——恰好就是 ETL 场景的全部内容。** 所以对企业 ETL 生成而言，真实上限接近 55–63%，而不是 Spider 1.0 的 91%。

### 1.3 「性能优秀」目前基本没被解决

BIRD 用 VES（Valid Efficiency Score）测效率，2024-08 起改用离散化的 R-VES。定义上以正确性为前提——**结果错的 SQL 无论多快，贡献为 0**（[BIRD 论文 §5](https://arxiv.org/abs/2305.03111)）。

R-VES 榜单：人类基线 **83.26**，Agentar-Scale-SQL 77.00，AskData + GPT-4o 76.31，CHASE-SQL + Gemini 69.94（[来源](https://bird-bench.github.io/)）。

但排序几乎与 EX 榜单一致，**说明 VES 目前主要还在测正确性，而不是在测优化质量**。真正测优化的一手数据点来自 BIRD 论文 §6.4：取 10 条 ChatGPT 生成的**结果正确**的 SQL，由专家按常规优化规则重写，**平均节省 77.75% 执行时间**，结果不变；配上索引可达 87.3%。

> **模型生成的"正确" SQL，离专家优化后的版本还差 3–4 倍执行时间。语义正确和性能优秀在当前技术水平下是两件基本没被同时解决的事。**

---

## 2. 错误在哪：98.7% 是静默错误

这是全篇最重要的单个数字。NL2SQL-BUGs（KDD '25）检查了模型的全部错误输出：

| 数据集 | 总错误数 | 语义错误（语法正确、能执行、结果错） | 占比 |
|---|---|---|---|
| Spider | 170 | 168 | **98.8%** |
| BIRD | 667 | 658 | **98.7%** |

[来源](https://doi.org/10.1145/3711896.3737427)

**含义：SQL 编译器 / `EXPLAIN` / dry-run 能拦住的错误只占 1–2%。剩下 98% 必须靠数据层面的校验（结果对比、行数、聚合值对账、分区边界）才能发现。**

作为校准，PICARD 论文测得 T5-3B 时代有 12% 的生成 SQL 执行报错（[来源](https://arxiv.org/abs/2109.05093)）；现代 LLM 已降到 1–2%。**语法正确性基本已被解决，剩下的全是语义问题。**

### 2.1 错误分布

BIRD（ChatGPT，抽 500 条错误）：Wrong Schema Linking **41.6%**、Misunderstanding Database Content **40.8%**（含幻觉表/列、大量值预测错误）、Misunderstanding Knowledge Evidence 17.6%（[来源](https://arxiv.org/abs/2305.03111)）。

Spider 2.0（抽 300 例）：Erroneous data analysis **35.5%**（其中复杂查询编排 17.7%、方言函数误用 10.3%）、Wrong schema linking 27.6%、JOIN errors 8.3%（[来源](https://arxiv.org/abs/2411.07763)）。

**对比很说明问题**：查询一变长变复杂，第一大错误类别就从「找错列」转移到「逻辑编排错」。企业 ETL 属于后者。

### 2.2 方言不兼容：两个受控 A/B

**Spider 2.0**：随机取 **180 道相同题目**同时部署在两个引擎上——BigQuery **12.78%** vs Snowflake **6.6%**。仅换方言，成功率腰斩（[来源](https://arxiv.org/abs/2411.07763)）。

**BIRD Mini-Dev**：**同一批 500 道题**翻译成三种方言：

| 模型 | SQLite | MySQL | PostgreSQL | SQLite→PG |
|---|---|---|---|---|
| GPT-4 | 47.80 | 40.80 | 35.80 | **−12.0** |
| GPT-4-turbo | 45.80 | 41.00 | 36.00 | −9.8 |
| Llama3-70b | 40.80 | 37.00 | 29.40 | −11.4 |
| GPT-3.5-turbo | 38.00 | 36.00 | 27.40 | −10.6 |

[来源](https://github.com/bird-bench/mini_dev)

**SQLite→PostgreSQL 这种「都是标准 SQL」的迁移就要付 10–12 个点。** Hive / Huawei DLI 与训练语料中占绝对多数的 MySQL/PG/SQLite 的距离只会更远，而且 `INSERT OVERWRITE TABLE ... PARTITION(...)` 这类语法在通用语料中极罕见。

> **未找到一手证据**：现有 benchmark 覆盖 SQLite、MySQL、PostgreSQL、SQL Server、Oracle、BigQuery、Snowflake、DuckDB、ClickHouse，**均不含 Hive 或 DLI**。跨方言代价只能从上面两组 A/B 外推。

### 2.3 长 schema / 嵌套 / 外部文档的具体代价

同一个 agent 在 Spider 2.0 不同子集上的成功率：含嵌套列 **10.34%** vs 不含 27.38%；需要外部文档 **11.54%** vs 不需要 26.64%；dbt 工程级任务 **12.82%** vs 非 dbt 23.22%（[来源](https://arxiv.org/abs/2411.07763)）。

论文对外部文档失败的归因值得逐字看：模型**不是**无法 grounding 复杂文档，它们通常有正确的解题策略、也能有效探索数据库，但**在最关键的一步失败：把文档里的复杂需求落地成 SQL**。

---

## 3. 业界最佳实践：分层正确性架构

综合厂商官方做法，可整理成七层。标注每层消灭的错误类别与是否可跳过。

```
业务需求
 │
 ├─ L1 语义层（口径、实体、关系基数）        ← 不可跳过
 ├─ L2 受控 IR（模型只写受限结构，不写原始 SQL） ← 不可跳过
 ├─ L3 确定性编译器（IR → 方言 SQL）         ← 不可跳过
 ├─ L4 静态校验（AST 断言 / lint / 策略规则）   ← 冗余防线
 ├─ L5 干跑预检（EXPLAIN / dry run / 分区裁剪） ← 不可跳过
 ├─ L6 执行反馈回路（编译器判错 → LLM 修）      ← 冗余防线
 └─ L7 数据断言 + 人工背书（写后对账 / 已验证库） ← 不可跳过
```

**「不可跳过」的判据是：该层消灭的错误类别，没有任何其它层能兜住。**

- 跳过 L1 → join 扇出重复计数无人能发现（语法正确、`EXPLAIN` 通过、行数看着合理）
- 跳过 L3 → 必选过滤条件变成概率事件
- 跳过 L5 → 全表扫描只能在生产账单上发现
- 跳过 L7 → 分区误覆盖只能在下游投诉时发现

而 L4、L6 抓的错误在 L3 到位时本就不该产生，属于冗余防线。

### 3.1 L1 语义层：把「语法对但语义错」消灭在结构里

**join 扇出导致的重复计数是最好的教学案例**——它 100% 语法合法，下游任何 parser 或 `EXPLAIN` 都看不出来。业界**没有一家**试图用 prompt 规则解决它：

| 方案 | 机制 |
|---|---|
| **Looker symmetric aggregates** | 编译器把 `SUM(x)` 改写为基于主键哈希的 `SUM(DISTINCT hash + value) - SUM(DISTINCT hash)` |
| **MetricFlow entity 类型矩阵** | `Foreign × Foreign`、`Primary × Foreign`、`Unique × Foreign` 一律标为 **❌ Fan-out (Not allowed)**，编译期直接拒绝；多跳上限 2 跳、3 张表 |
| **Databricks metric views `cardinality`** | 显式声明 `many_to_one` / `one_to_many`；后者会让引擎把被 join 表当独立事实源、在 source 粒度单独聚合。`fields` 不允许引用 one-to-many join（必须解析为单值），`measures` 允许 |
| **Snowflake semantic view** | 聚合方式绑定在 metric 定义上，单点声明 |

Looker 官方文档给了具体数字：同一份 `orders` × `order_items` 数据，join 后 `SUM(total)` 得 **223.44**，正确答案是 **124.84**。原文：*"It is surprisingly easy to perform these calculations incorrectly... This is the problem symmetric aggregates solve."* 而且官方承认这种 SQL *"you certainly wouldn't want to write the SQL by hand"*——这正是「必须由编译器生成、不可能靠模型写对」的直接证据（[来源](https://cloud.google.com/looker/docs/best-practices/understanding-symmetric-aggregates)）。

MetricFlow 的表述同样明确：*"MetricFlow chooses the appropriate join type and avoids fan-out or chasm joins with other tables based on the entity types."*（[来源](https://docs.getdbt.com/docs/build/join-logic)）

Databricks 文档里有一条**关于信任边界的诚实警告**值得单独记下：`rely.at_most_one_match: true` 是一个不被运行时校验的断言——*"This property is not validated at runtime. If the asserted side produces a fan-out, measures return incorrect results."*（[来源](https://docs.databricks.com/aws/en/business-semantics/metric-views/yaml-reference)）连 Databricks 自己都严格区分「编译器保证」和「人的断言」。

### 3.2 L2 受控 IR：不让模型碰物理 schema

Snowflake 的做法最激进——**不但不塞全库 schema，连真实物理 schema 都不给模型看**。SQL 生成 agent 先构造 logical schema 来 *"hide schema complexity from the LLMs"*，模型对逻辑 schema 生成 SQL，再由系统后处理映射到物理 schema。理由是 *"LLMs struggle with complex schemas"*（[来源](https://www.snowflake.com/en/blog/engineering/snowflake-cortex-analyst-behind-the-scenes/)）。

公开的效果数字：Cortex Analyst 在其内部评测集上 **90%+**，同一评测集上 GPT-4o 单轮为 **51%**（[来源](https://www.snowflake.com/en/blog/engineering/cortex-analyst-text-to-sql-accuracy-bi/)）。

产品文档对「为什么不能直接给 schema」的表述：*"Generic AI solutions often struggle with text-to-SQL conversions when given only a database schema, as schemas lack critical knowledge like business process definitions and metrics handling."*（[来源](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)）

Databricks 的 UC function 是另一种形态的受控 IR——**把逻辑从模型的可写范围里物理移除**：*"Genie cannot view or modify the SQL used in the function, making this approach well-suited for logic that should not be surfaced or changed."*（[来源](https://docs.databricks.com/aws/en/genie/trusted-assets)）

### 3.3 L5 干跑预检：性能是被强制的，不是被叮嘱的

这是本节最值得模式识别的一条：BigQuery 和 Hive 都不在文档里劝你"请加分区过滤"，而是提供**表级/会话级开关，让不满足条件的查询根本无法运行**。

| 机制 | 表述 | 拦住什么 |
|---|---|---|
| BigQuery `require_partition_filter`（**表属性**） | 每个查询必须含至少一个分区列谓词，否则报 `Cannot query over table without a filter that can be used for partition elimination`；**通过视图也绕不过去** | 全表扫描 |
| BigQuery dry run | 官方三项产出：费用估算、查询校验、预估扫描字节数；*"Dry runs don't use query slots, and you are not charged"* | 语法 + 字段存在性 + **执行前扫描量** |
| Hive `hive.mapred.mode=strict` | *"full table scans are prevented and ORDER BY requires a LIMIT clause"* | 全表扫描、无界排序 |
| Hive `hive.exec.dynamic.partition.mode=strict`（默认） | 必须至少一个静态分区，*"in case the user accidentally overwrites all partitions"* | **动态分区误覆盖全表** |
| Snowflake `EXPLAIN` | 编译但不执行，不需要运行中的 warehouse；输出含 `partitionsTotal` / `partitionsAssigned` / `bytesAssigned` | 编译错误 + **编译期分区裁剪效果** |

来源：[BigQuery dry run](https://cloud.google.com/bigquery/docs/running-queries#dry-run)、[require_partition_filter](https://cloud.google.com/bigquery/docs/managing-partitioned-tables#require-partition-filter)、[Hive Configuration Properties](https://cwiki.apache.org/confluence/display/Hive/Configuration+Properties)、[Snowflake EXPLAIN](https://docs.snowflake.com/en/sql-reference/sql/explain)

MetricFlow 把这一层做成了 fail-closed 的门：交出查询前先在数据平台上跑 `explain`，校验三件事——引用的表和列是否存在、平台是否支持所用 SQL 函数、多跳 join 是否有歧义路径。*"If validation fails, MetricFlow surfaces errors for users to address before executing the query."*（[来源](https://docs.getdbt.com/docs/build/join-logic)）

> **这条对双引擎场景直接可迁移：方言差异不要靠 prompt 描述，靠在两个引擎上各跑一次 `EXPLAIN`。**

### 3.4 L6 执行反馈：判错者必须是编译器，不是另一个 LLM

Snowflake Cortex Analyst 是目前公开得最完整的生产 agent 架构（[来源](https://www.snowflake.com/en/blog/engineering/snowflake-cortex-analyst-behind-the-scenes/)）：

| 阶段 | 职责 | 消灭什么 |
|---|---|---|
| Classification agent | 分类为 ambiguous / non-data / non-SQL；*"It only answers questions that are unambiguous and can be answered using SQL. Other classes of questions are rejected"* | 入口就 fail-closed |
| Feature extraction agent | 判断是否时间序列 / 同环比 / 排名，据此**动态裁剪 prompt** | 官方原话：*"These prompts contain a smaller and more specific set of instructions, thus reducing the chances of the LLM forgetting some of the instructions"* |
| Context enrichment agent | 检索相似的 verified query + **语义匹配字面量**（"USA" → "United States of America"） | 官方点名 *"incorrect literal generation is a common failure mode"* |
| SQL generation agents | 多模型并行，两步生成（逻辑 schema → 物理 schema） | 复杂 schema 导致的质量下降 |
| **Error correction agent** | *"checks for both syntactic and semantic errors by utilizing core Snowflake services, such as the SQL compiler. If any errors are found, the agent runs an error correction loop to have the LLM fix them."* | 语法错、实体/函数幻觉 |

**最值得学的点：纠错回路的判定者是 SQL 编译器，LLM 只负责改，不负责判对错。**

这个设计不是偏好问题，有硬证据支撑。Self-Debugging（ICLR 2024）在同一篇论文内做了直接对照：

| 场景 | 反馈形式 | Codex | GPT-3.5 | GPT-4 |
|---|---|---|---|---|
| **Spider**（无 unit test，模型自判） | Simple（只说"错了，请修"） | 81.3（**+0.0**） | 72.2 | 73.4 |
| **Spider** | + 逐行解释自己的 SQL | 84.1（+2.8） | 72.2 | 73.6 |
| **TransCoder**（有 unit test，可真执行） | UT + Expl | **92.5（+12.1）** | 92.7 | **90.4（+13.1）** |
| **TransCoder**（**去掉执行**，逼模型自判） | + Expl | 83.9（**+3.5**） | **89.1（+0.0）** | 78.0（+0.7） |

[来源](https://arxiv.org/abs/2304.05128)

**同一个 benchmark、同一批模型：带真实执行 +12.1 点，去掉执行只剩 +3.5 点，GPT-3.5 完全为 0——约 3.5 倍差距。** 论文对 Spider 的解释是：模型在没有解释的情况下*"通常难以区分正确与错误的 SQL"*。

更强的证伪来自 Huang et al.（ICLR 2024，Google DeepMind）对「intrinsic self-correction」的系统测量：

| 模型 / 任务 | Standard | 自修正 r1 | 自修正 r2 |
|---|---|---|---|
| GPT-3.5 / GSM8K | 75.9 | 75.1 | **74.7** |
| GPT-3.5 / CommonSenseQA | 75.8 | 38.1 | **41.8** |
| GPT-4-Turbo / GSM8K | 91.5 | 88.0 | **90.0** |
| Llama-2-70b-chat / GSM8K | 62.0 | 43.5 | **36.5** |

**所有模型在所有 benchmark 上，自我修正后准确率都下降，同时花掉 5 倍推理成本。** 对照组用 oracle 标签（用 ground truth 决定何时停止修正）则 GPT-3.5 GSM8K 75.9→84.3。论文结论：此前 RCI / Reflexion 报告的收益**全部来自 oracle 标签**，去掉 oracle 后收益消失。机理是「把对的改错」多于「把错的改对」（[来源](https://arxiv.org/abs/2310.01798)）。

BIRD 团队独立观察到同样问题，归因为 self-enhancement bias，并指出在 SQL 上尤其严重，因为*"声明式语法和简略的错误日志能提供的指导非常有限"*（[来源](https://bird-bench.github.io/)）。

**连纠错 prompt 的措辞都会反转结论。** DIN-SQL 消融（Spider dev）：

| 配置 | CodeX Davinci | GPT-4 |
|---|---|---|
| 不做 self-correction | 67.3 | **73.3** |
| generic prompt（"BUGGY SQL: …"） | **69.9** | **70.0（−3.3）** |
| gentle prompt（不预设有 bug，只提示检查哪些子句） | 68.7 | **74.2（+0.9）** |

作者解释：GPT-4 本来 bug 少，断言"这是 buggy SQL"会诱导它改坏正确的查询（[来源](https://arxiv.org/abs/2304.11015)）。

### 3.5 L7 数据断言：唯一能抓住 98% 静默错误的层

| 手段 | 能力 | 来源 |
|---|---|---|
| dbt data tests | 内置 `unique / not_null / accepted_values / relationships`；`--store-failures` 落表 | [dbt](https://docs.getdbt.com/docs/build/data-tests) |
| dbt unit tests | *"validate your SQL modeling logic on a small set of static inputs before you materialize your full model"*；可 override `is_incremental` 分别测全量/增量分支 | [dbt](https://docs.getdbt.com/docs/build/unit-tests) |
| dbt model contracts | 建表前 preflight 校验列名与类型，再把约束下推到 DDL | [dbt](https://docs.getdbt.com/docs/collaborate/govern/model-contracts) |
| Great Expectations | Checkpoint 为生产部署主入口，可挂告警 Action | [GX](https://docs.greatexpectations.io/docs/core/introduction/gx_overview) |

**dbt 官方明说了一处边界，这块必须自建**：

> *"There is currently no way to unit test whether the dbt framework inserted/merged the records into your existing model correctly."*（[来源](https://docs.getdbt.com/docs/build/unit-tests)）

即**单测能覆盖 SELECT 逻辑，覆盖不了写入动作本身**。分区边界、覆盖范围、幂等性只能靠引擎级 strict 开关 + 写后对账（staging 表与目标分区的行数/关键聚合值 diff）。

dbt 对 `insert_overwrite` 的官方警告也值得引：*"dbt will run an atomic insert overwrite statement that dynamically replaces all partitions included in your query. **Be sure to re-select all of the relevant data for a partition** when using this incremental strategy."*（[来源](https://docs.getdbt.com/reference/resource-configs/spark-configs)）

### 3.6 上下文供给：官方一致反对整库 schema

| 上下文类型 | 官方表述 |
|---|---|
| 列描述 | *"Column descriptions are considered when you generate SQL queries. To improve accuracy, add column descriptions to your schema."*（[BigQuery](https://docs.cloud.google.com/bigquery/docs/write-sql-gemini)）；*"Quality table and column descriptions in Unity Catalog are critical for Genie accuracy."*（[Databricks](https://docs.databricks.com/aws/en/genie/best-practices)） |
| 同义词 / 枚举值样例 | semantic model 支持 `synonyms` 与 `sample_values`；高基数列改用 Cortex Search 做语义检索取字面量（[Snowflake](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository)） |
| 已验证查询 | *"Cortex Analyst then leverages relevant SQL queries from the repository when answering similar questions"*，并警告 *"Invalid or inaccurate queries can negatively impact Cortex Analyst's performance and accuracy."*（同上） |
| 命名过滤器 | `filters: - name: North America / expr: region in ("United States","Canada","Mexico")`，并把"是否精确应用了这个定义"作为评测判分点（[Snowflake](https://www.snowflake.com/en/blog/engineering/cortex-analyst-text-to-sql-accuracy-bi/)） |

**Databricks 的裁剪要求最直白**：*"Include only the tables necessary... **Aim for five or fewer tables.** The more focused your selection, the better."* 硬上限每个 agent 30 张表，超过就要求预 join 成视图。还提供列级隐藏：*"Hiding a column removes it from the Genie Agent's context, so Genie won't reference it when generating SQL."*（[来源](https://docs.databricks.com/aws/en/genie/best-practices)、[来源](https://docs.databricks.com/aws/en/genie-agents/tune-quality)）

一个易被忽略的实现细节：Snowflake 要求 verified query **必须写逻辑表名而非物理表名**（`__sales_data` 而不是 `sd_data`，`profit` 而不是 `amt - cst`）。**示例查询本身也是受控 IR 的一部分，不是原始 SQL。**

---

## 4. 为什么加 guideline 没用：失效机制

### 4.1 硬满足率随约束数连乘衰减，3 条左右就开始咬人

FollowBench（ACL 2024）从一条指令起逐级累加约束，5 级，820 条指令。HSR = 全部约束都满足的比例；CSL = 从 L1 起能连续满足的级数：

| 模型 | L1 | L2 | L3 | L4 | L5 | CSL |
|---|---|---|---|---|---|---|
| GPT-4-Preview-1106 | 84.7 | 75.6 | 70.8 | 73.9 | **61.9** | **3.3** |
| GPT-3.5-Turbo-1106 | 80.3 | 68.0 | 68.6 | 61.1 | 53.2 | 2.9 |
| Qwen-Chat-72B | 73.8 | 63.3 | 54.3 | 45.2 | 39.9 | 2.4 |
| LLaMA2-Chat-70B | 59.9 | 53.3 | 46.0 | 40.2 | 37.9 | 2.1 |

论文结论句：*"the instruction-following upper bound for GPT-4 and GPT-3.5 is approximately **3 constraints**... open-source models typically have an upper limit of about **2 constraints**."*（[来源](https://arxiv.org/html/2310.20410v3)）

**Mixed Constraints（混合类型约束）最接近「DDL 规范 + ETL 规范 + 领域模式同时生效」的现实**：GPT-4 在这一类 L1 只有 60.0%，L5 掉到 40.0%；GPT-3.5 从 70.6% 崩到 23.5%。约束类型一旦异质，起点就已经很低。

### 4.2 大规模验证：10 → 500 条指令

IFScale 让模型写一份同时满足 N 条「必须包含某确切词」的报告，N 从 10 递增到 500，20 个模型、7 家厂商、每个密度 5 个随机种子（[来源](https://arxiv.org/abs/2507.11538)）：

| 模型 | 10 条 | 50 条 | 100 条 | 250 条 | 500 条 |
|---|---|---|---|---|---|
| o3 (high) | 100.0 | 99.6 | 98.2 | 97.8 | **62.8** |
| claude-opus-4 | 100.0 | 100.0 | 94.6 | 67.9 | 44.6 |
| gpt-4.1 | 98.0 | 98.8 | 95.4 | 74.0 | **48.9** |
| qwen3-235b-a22b | 100.0 | 92.8 | 77.6 | 36.4 | 20.9 |
| claude-3.5-haiku | 98.0 | 78.0 | 43.4 | 16.6 | 8.5 |
| llama-4-scout | 100.0 | 54.4 | 27.2 | 9.3 | 6.7 |

摘要原话：*"even the best frontier models only achieve **68% accuracy** at the max density of 500 instructions."*

三条推论：

**衰减分三种形态。** threshold decay（推理模型，到临界密度前近乎完美，之后陡降）、linear decay、exponential decay（弱模型早期就急剧下滑，地板收敛在 **7–15%**）。弱模型没有缓冲区。

**失败方式是「整条丢弃」而不是「做错」。** *"Models overwhelmingly err toward omission errors as instruction density increases"*——500 条时 llama-4-scout 的漏做:做错比达 **34.88**。**这解释了为什么你看不见规则被违反：它不报错、不留痕。**

**越前面的规则越占便宜。** 几乎所有模型在 150–200 条附近 primacy 比值达峰（gpt-4.1-mini 在 100 条时达 3.37，即靠后 1/3 的指令错误率是靠前 1/3 的三倍多），作者称这是**架构层面的局限而非模型特异行为**。

### 4.3 上下文长度稀释注意力，中段规则命中率最低

**Lost in the Middle（TACL 2024）**：多文档 QA，只改变含答案文档的位置。GPT-3.5-Turbo 性能*"drop by more than 20%—in the worst case, performance in 20- and 30-document settings is **lower than performance without any input documents** (i.e., closed-book performance; 56.1%)"*（[来源](https://aclanthology.org/2024.tacl-1.9.pdf)）。

| 模型 | Closed-Book（不给文档） | Oracle（只给那 1 篇相关文档） |
|---|---|---|
| GPT-3.5-Turbo | 56.1% | 88.3% |
| Claude-1.3 | 48.3% | 76.1% |
| LongChat-13B (16K) | 35.0% | 83.4% |

**只给 1 篇正确文档是 88.3%，塞进 20 篇（正确的那篇在中间）反而低于 56.1% 的完全不给文档基线。多余的上下文不是中性的，是负收益的。** 论文另外证实两点：扩展上下文版本没有优势；base model（未做指令微调）同样呈 U 形曲线。

**NoLiMa（ICML 2025）**：把 needle 与 question 的字面重叠去掉，只留语义关联——这更接近真实 schema linking（列名 `cust_dt_reg` 与「注册日期」没有字面重叠）：

| 模型 | 声称长度 | **有效长度** | Base | 8K | 16K | 32K |
|---|---|---|---|---|---|---|
| GPT-4.1 | 1M | **16K** | 97.0 | 91.7 | 87.5 | 84.9 |
| GPT-4o | 128K | **8K** | 99.3 | 89.2 | 81.6 | 69.7 |
| Llama 3.3 70B | 128K | **2K** | 97.3 | 72.1 | 59.5 | 42.7 |
| Gemini 1.5 Pro | 2M | **2K** | 92.6 | 63.9 | 55.5 | 48.2 |
| Claude 3.5 Sonnet | 200K | **4K** | 87.5 | 61.7 | 45.7 | 29.8 |

（有效长度 = 分数仍保持在短上下文基线 85% 以上的最大长度）

**13 个模型中 11 个在 32K 时只剩基线一半或更低。GPT-4.1 标称 1M，实测 16K。** 推理模型也救不了：NoLiMa-Hard 上*"所有模型在 32K 时都跌破 base score 的 50%"*（[来源](https://arxiv.org/abs/2502.05167)、[官方仓库](https://github.com/adobe-research/nolima)）。

Anthropic 官方把这个现象命名为 **context rot**，并明确说它普遍存在：

> *"as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases. While some models exhibit more gentle degradation than others, **this characteristic emerges across all models**. Context, therefore, must be treated as a **finite resource with diminishing marginal returns**... LLMs have an 'attention budget'... **Every new token introduced depletes this budget by some amount**."*

架构层面的成因：注意力需要每个 token 关注全部其它 token，n 个 token 就有 **n² 组关系**，上下文越长这些关系*"gets stretched thin"*（[来源](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)）。

### 4.4 SQL 场景的专属证据：prompt 长度有倒 U 型甜点

Chang & Fosler-Lussier (2023) 在 Spider 上系统扫描「M 个演示库 × K 个示例/库」的组合：

- **Codex（8K 窗口）**：EX 随 prompt 长度呈**倒 U 形**，超过约 **5,500 token** 后显著下降
- **ChatGPT-16K**：同样倒 U 形，超过约 **11K token** 后开始下降
- 归纳规律：**演示内容超过最大 prompt 长度约 70% 时，两者性能都倾向于下滑**
- 结论：*"即使 LLM 有能力处理长上下文，它们在过长 prompt 下未必表现更好"*

[来源](https://arxiv.org/abs/2305.11853)

DAIL-SQL 的实测佐证：Full-Information Organization 的 token 数是精简版的数倍，但精简的 DAIL-O + GPT-4 反而达到最高的 83.5% EX（[来源](https://arxiv.org/abs/2308.15363)）。

**而且大 schema prompt 会直接吞掉 few-shot 的效果**——Spider 2.0-Lite 上 DAIL-SQL + GPT-4o 的 0/1/3-shot 分别是 5.68% / 6.40% / 6.76%，人工精选同方言、结构相近的示例收益近乎消失。作者归因：*"庞大的 schema prompt 可能妨碍模型吸收 few-shot 示例中的信息"*（[来源](https://arxiv.org/abs/2411.07763)）。

### 4.5 规则冲突的裁决权在「位置」而非「重要性」

OpenAI 官方给出了明确的冲突消解行为：

> *"Check for **conflicting, underspecified, or wrong instructions and examples**. If there are conflicting instructions, GPT-4.1 tends to follow **the one closer to the end of the prompt**."*（[来源](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide)）

**几十条编号策略中若有任何两条隐含冲突，胜出的不是编号更小的、也不是更重要的，而是物理位置更靠后的那条。** 这条与 IFScale 的 primacy effect（靠前的注意力更多）方向相反，两者叠加的结果是：**中间段的规则处在双重劣势**——与 lost-in-the-middle 完全同构。

### 4.6 措辞绝对的强制规则会逼模型编造

OpenAI 官方在 "Common Failure Modes" 一节给出的例子机制清晰：

> *"Instructing a model to always follow a specific behavior can occasionally induce adverse effects. For instance, if told **'you must call a tool before responding to the user,'** models may **hallucinate tool inputs or call the tool with null values** if they do not have enough information. Adding 'if you don't have enough information to call the tool, ask the user for the information you need' should mitigate this."*（[来源](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide)）

**映射到 SQL 生成：一条「必须带分区裁剪条件」的策略，在模型不知道分区键时，产出的不是拒绝，而是一个编造的分区键。**「违反常识」的 SQL 里有一部分可能正是被规则逼出来的。官方给的解药也很明确——为每条硬性规则配一条降级出口。

### 4.7 否定式指令的证据（分三档强度）

**厂商官方表态（最高可信度）**。Anthropic 官方 prompt engineering 文档，"Control the format of responses" 第 1 条标题即为：

> **"Tell Claude what to do instead of what not to do"**
> Instead of: "Do not use markdown in your response"
> Try: "Your response should be composed of smoothly flowing prose paragraphs."

（[来源](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering)）

**同行评审论文**。Jang et al. 在常识推理、句子补全、QA 三类任务上对比原始与否定 prompt：*"an **inverse scaling law** is shown: larger LMs tend to **perform worse** on negated prompts"*，正负 prompt 平均被拉平在 **~50%**；微调只是把原 prompt 的性能换掉，是**零和**，与人类仍差 31.3%（[来源](https://ar5iv.labs.arxiv.org/html/2209.12711)）。

**机制层面（证据强度弱，谨慎引用）**。有预印本报告违反概率与「语义压力」P₀（模型无约束时产出该词的固有概率）呈 logistic 关系：P₀=0.1 时 9% 违反，P₀=0.9 时超过 46%；并把 **87.5%** 的失败归为 priming failure——*"the instruction's explicit mention of X activates rather than suppresses the target"*（[来源](https://arxiv.org/abs/2601.08070)）。

> ⚠️ 该来源为单作者预印本，只在一个开源模型（Qwen2.5-7B-Instruct）上做机制分析，作者自己声明不主张跨模型普适性。行为学规律可参考，不要当定论。

**但即便只采信前两档，推论也成立**：`POL-SQL-QRY-005` 写成「禁止 SELECT *」不如写成「查询必须逐列显式列出投影字段」。前者把被禁 token 序列写进了上下文。

### 4.8 最有力的单条反面证据：给对了规则，分数反而掉

Spider 2.0 论文为每道题**人工挑选该题实际需要的方言函数文档**放进 prompt——消除了检索误差，等于「完美的规则注入」：

| 方法 | 有 Oracle 函数文档 | 无 Oracle 函数文档 |
|---|---|---|
| DAIL-SQL + GPT-4o | 5.85% | 5.68% |
| **DAIL-SQL + o1-preview** | **9.51%** | **12.60%** |

**给 o1-preview 提供正确的方言函数文档，EX 从 12.60% 掉到 9.51%（−3.09 点）。**

作者的归因直击要害：*"这表明模型在一定程度上**本来就能选对函数、理解其基本用法和语法**。真正的挑战在于**准确地运用这些函数来反映用户意图**。"*（[来源](https://arxiv.org/abs/2411.07763)）

> **如果瓶颈是「意图 → 逻辑」的映射，那么往 prompt 里塞语法手册和规则清单不但不解决问题，还会挤占注意力预算。**

### 4.9 遵守是概率，不是保证

IFScale 报告了方差随指令密度的变化（5 个种子）：

| 模型 | 10 条 | 100 条 | 250 条 | 500 条 |
|---|---|---|---|---|
| llama-4-maverick | 0.0% | **27.3%** | **36.6%** | **40.4%** |
| claude-opus-4 | 0.0% | 4.7% | 3.9% | 14.0% |
| o3 (high) | 0.0% | 1.5% | 1.5% | 10.6% |

论文对形态的解读有一处黑色幽默：中档模型在 150–300 条区间出现方差峰值，是*"a critical capacity zone where performance is unstable before the model collapses"*，而*"variance decreases as models collapse"*——**方差回落不是变稳定了，是彻底放弃了。**

Laban et al.（"LLMs Get Lost In Multi-Turn Conversation"）把退化做了分解：多轮相比单轮*"average drop of 39%"*，其中**能力（aptitude）只降 16%，不可靠性（unreliability）暴涨 112%**；*"performance degrading **50 percent points on average between the best and worst simulated run for a fixed instruction**"*（[来源](https://arxiv.org/abs/2505.06120)）。

> **同一条指令，最好的一次和最差的一次相差 50 个百分点。所以"加了规则之后手测通过"不构成任何证据——你在观察一个分布，不是一个函数。**

### 4.10 同一约束：文字表述 vs 程序强制的数量级差距

这是区分「该留在 prompt」和「该移出 prompt」的核心判据。

**OpenAI 官方公布的对照**：复杂 JSON schema 遵守，`gpt-4o-2024-08-06` + Structured Outputs 得 **100%**，`gpt-4-0613`（靠提示描述 schema）**低于 40%**（[来源](https://openai.com/index/introducing-structured-outputs-in-the-api/)）。API 文档把这说成机制差异而非质量差异：

| | Structured Outputs | JSON Mode（仅靠提示） |
|---|---|---|
| 输出合法 JSON | 是 | 是 |
| **符合 schema** | **是** | **否** |

（[来源](https://developers.openai.com/api/docs/guides/structured-outputs)）

**SQL 上的同类证据**：PICARD（EMNLP 2021）在每个解码步拒绝不合法 token，同一个模型、同一份权重：

| 系统 | Spider dev EM | dev EX | test EM | test EX |
|---|---|---|---|---|
| T5-3B | 71.5 | 74.4 | 68.0 | 70.1 |
| **T5-3B + PICARD** | **75.5** | **79.3** | **71.9** | **75.1** |

**无效 SQL 从 12% 降到 2%**，延迟只从 2.5 s/样本升到 3.1 s/样本（+24%）。它能拦住的具体错误例如：模型预测 `cell_phone` 而正确列名是 `cell_number`——lexing 模式直接拒掉不存在的列名（[来源](https://arxiv.org/abs/2109.05093)）。

**但必须诚实说明这条证据的射程。** PICARD 需要访问 decoder logits，无法用于 API 模型；而且从 §2 的数据看（98.7% 的错误是语义错误），**约束解码所能覆盖的错误面在现代模型上已经很小**——2023 年后的所有 SOTA text-to-SQL 方法（DIN-SQL、CHASE-SQL、CHESS、XiYan-SQL）都不使用约束解码。

所以正确的读法是：**PICARD 证明的是「可形式化的约束交给程序会赢几十个百分点」这个原理**，但今天该原理的兑现方式不是 token 级解码约束，而是语义层 + 受控 IR + 执行校验。

### 4.11 三家厂商官方立场高度一致

**Anthropic** 对「硬编码复杂规则」有一段几乎逐字描述这个困境的表述：

> *"The right altitude is the **Goldilocks zone** between two common failure modes. At one extreme, we see engineers **hardcoding complex, brittle logic in their prompts** to elicit exact agentic behavior. **This approach creates fragility and increases maintenance complexity over time.** At the other extreme, engineers sometimes provide vague, high-level guidance..."*

并给出与「先加规则」完全相反的流程：

> *"It's best to **start by testing a minimal prompt** with the best model available... and then **add clear instructions and examples to improve performance based on failure modes found during initial testing**."*

（[来源](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)）

**Google** 主张拆分而非堆叠：*"Instead of having many instructions in one prompt, **create one prompt per instruction**. You can choose which prompt to process based on the user's input."* 对示例的态度更极端：*"**you can remove instructions from your prompt if your examples are clear enough** in showing the task at hand."*（[来源](https://ai.google.dev/gemini-api/docs/prompting-strategies)）

**Databricks** 用配额设计强制迁移：每个 agent 最多 **100 条 instruction**（每条 example SQL、每个 SQL function、整个 General instructions 文本块各计 1 条），理由是*"Too many instructions can reduce effectiveness, especially in longer conversations, because Genie might struggle to prioritize the most important guidance."*（[来源](https://docs.databricks.com/aws/en/genie-agents/tune-quality)）

**三家还都建议随模型换代主动做减法。** Anthropic 对 Claude Opus 5 的迁移指引：*"verification instructions carried over from prompts tuned for earlier models can cause over-verification... **remove these instructions rather than rewriting them**."*（[来源](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering)）Google 对 Gemini 3.x：*"**Verbose or complex prompt engineering techniques designed for older models may cause the model to over-analyze.**"*（[来源](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5)）

---

## 5. 被实测证明有效的技术（按性价比排序）

### 5.1 值检索 / 字面量与知识 grounding：+13 到 +20 点

**这是全部技术里投入产出比最高的一类。**

| 证据 | 效果 |
|---|---|
| BIRD：提供 vs 不提供外部知识（ChatGPT，dev/test EX） | 24.05→37.22 / 26.77→39.30，**+13.2 / +12.5** |
| BIRD：同上（GPT-4，VES） | dev 34.60→49.77（**+15.17**），test 40.20→60.77（**+20.57**） |
| BIRD：**人类基线本身** | EX 72.37→**92.96**（+20.59）——**连人类都要靠外部知识才能从 72% 到 93%** |
| CHESS：移除实体与上下文检索（改为随机示例 + 全部列描述） | **−4.76 EX**，论文称这证明"选择性检索胜过朴素上下文堆砌" |
| DAIL-SQL：prompt 中加外键 | +0.6% ~ +2.9% EX |

来源：[BIRD](https://arxiv.org/abs/2305.03111)、[CHESS](https://arxiv.org/abs/2405.16755)、[DAIL-SQL](https://arxiv.org/abs/2308.15363)

**而 BIRD 有 40.8% 的错误恰恰是「误解数据库内容 / 幻觉列 / 值写错」——直接对症。** 业界实现路径统一是：LSH 索引做语法近似匹配（应对脏值、大小写、拼写差异）+ 向量库做语义匹配，两路取并集（[CHESS](https://arxiv.org/abs/2405.16755)、[XiYan-SQL](https://arxiv.org/abs/2411.08599)）。

### 5.2 多候选 + 选择器：天花板高达 +19.78 点，但选择器不能是未微调的 LLM

CHASE-SQL 的天花板分析（Gemini 1.5 Pro, BIRD dev）：

| 方法 | EX |
|---|---|
| 单次生成 | 63.00 |
| Self-consistency（多数投票） | 68.84（**+5.84**） |
| **Oracle 选择器（21 个候选中总选对的）** | **82.79（+19.78）** |
| CHASE-SQL 实际达到 | 73.01 |

**模型的参数化知识里已经包含了解出 82.79% 题目所需的信息，实际只交付 63%。近 20 个点纯粹是「选择」问题，不是「生成」问题。**

但选择器必须微调：

| 选择模型 | 二元选择准确率 |
|---|---|
| Gemini-1.5-pro（未微调，pairwise） | **58.01%**（≈ 抛硬币） |
| Claude-3.5-sonnet（未微调） | 60.21% |
| **微调 Gemini-1.5-flash** | **71.01%** |

[来源](https://arxiv.org/abs/2410.01943)

CHESS 的 unit-test 选择器给了一条实用参数：**性能随 unit test 数量上升，在 10 个时达峰，之后进入 plateau**；且「1 个 test 评所有候选」（68.31）优于「所有 test 评 1 个候选」（66.78）——**允许横向比较候选很重要**（[来源](https://arxiv.org/abs/2405.16755)）。

边际收益递减也有数字：CHASE-SQL 观察到候选数超过 20 后天花板不再提升；DAIL-SQL 在 Spider 上用 self-consistency 只换来 +0.4%（86.2→86.6），代价是数倍成本。

### 5.3 任务分解 / CoT：收益集中在最难的一档，但不迁移到企业场景

DIN-SQL（Spider dev，GPT-4）按难度拆分，few-shot → DIN-SQL：Easy 86.7→91.1，Medium 73.1→79.8，Hard 59.2→64.9，**Extra 31.9→43.4（+11.5）**。消融显示「按难度分流 prompt」本身值 1.7 个点，**一刀切用最复杂的 prompt 会伤到简单题**（69.9→68.2）（[来源](https://arxiv.org/abs/2304.11015)）。

CHASE-SQL 的三种生成器相对基线（Gemini 1.5 Pro, BIRD dev）：Query-Plan CoT +5.87、Divide-and-Conquer CoT +6.17、**Online Synthetic Example +9.34**（[来源](https://arxiv.org/abs/2410.01943)）。

**但 DIN-SQL 在 Spider 2.0 上是 1.46%（lite）/ 0.00%（snow），所有被测方法里最差**，甚至不如朴素的 DAIL-SQL。分解式 prompt 是为「一条 SELECT」设计的，迁到 100+ 行多 CTE 的企业 SQL 上完全失效。

### 5.4 Schema 裁剪：方向取决于 schema 规模，且应优先保召回

**大 schema 场景，裁剪是净收益。** CHESS 在 4,337 列的合成工业级 schema 上加 Schema Selector：Pass@1 59%→61%、Pass@5 →63%，**token 用量降至 1/5**；「给 oracle schema」与「给全 schema」之间存在 **11% 的性能鸿沟**（[来源](https://arxiv.org/abs/2405.16755)）。XiYan-SQL 加 schema linking 使精确率从 10.14% 升到 74.74%，EX +2.15（[来源](https://arxiv.org/abs/2411.08599)）。

**但小 schema + 强模型时，裁剪反而有害。** Distillery（BIRD 榜曾第一）的端到端消融：

| 配置 | ft:GPT-4o | Gemini 1.5 Pro |
|---|---|---|
| 完整 pipeline（**不做** schema linking） | **67.35** | **60.54** |
| 加 TCSL（表→列，最激进） | 62.58（−4.77） | 55.78（−4.76） |
| 加 SCSL（单列判定） | 55.78（**−11.57**） | 55.10（−5.44） |

原因是召回代价：TCSL 的 FPR 降到 9.79%，但 schema linking recall 只剩 **77.44%**——**直接把 22.56% 的题判了死刑**（[来源](https://arxiv.org/abs/2408.07702)）。CHESS 作者独立复现并承认：*"当 schema 较小、可用 LLM 能力较强时，加入 Schema Selector agent 引入的精确率-召回率权衡可能损害准确率。"*

> **注意这与 §3.6 的 Databricks「≤5 张表」不矛盾**：Databricks 说的是**人工把 agent 的作用域收窄**（每个 agent 只服务一个业务主题），Distillery 说的是**让模型自动裁剪单次查询的 schema**。前者是设计决策，后者是运行时环节；前者稳定有益，后者需要按 schema 规模实测。

### 5.5 Schema 表示方式：低成本、被忽视

XiYan-SQL 的 M-Schema（半结构化，含数据类型、主键标记、列描述、示例值）vs 裸 DDL，BIRD dev 平均 **+2.03%**（GPT-4o 55.67→57.95）（[来源](https://arxiv.org/abs/2411.08599)）。

DAIL-SQL 另测得一条极便宜的规则：prompt 里加「with no explanation」，**EM 最高 +6%、EX 最高 +3%**（[来源](https://arxiv.org/abs/2308.15363)）。

### 5.6 微调：简单奖励胜过复杂奖励，但不迁移到分布外

Arctic-Text2SQL-R1（Snowflake）用 GRPO + **仅执行正确性奖励**，7B 模型打平 70B 级模型和 GPT-4o（BIRD test 68.5）。同一 14B base、同一训练集的受控对比：

| 方法 | 奖励设计 | BIRD-dev | SPIDER-test |
|---|---|---|---|
| Reasoning-SQL | 复杂（EX + syntax + n-gram + LLM + schema + format） | 64.21 | 81.43 |
| **Arctic-Text2SQL-R1** | **简单（EX + syntax）** | **66.49** | **87.20** |

**复杂奖励塑形输给简单执行奖励 2.28 / 5.77 个点。** 数据过滤也比数据量重要：未过滤的合成数据直接降分（64.9→64.6）（[来源](https://arxiv.org/abs/2505.20315)）。

两个工程上的重要副作用：

- **SFT 会破坏 in-context learning。** DAIL-SQL：*"出乎意料，微调后的 LLM 无法从示例中学习。在测试 prompt 里加入上下文示例会导致 EM 和 EX 双双骤降，而且加更多示例也没用。"*（[来源](https://arxiv.org/abs/2308.15363)）
- **微调不迁移到分布外。** SFT CodeS-15B 在 BIRD test 60.37%，在 Spider 2.0-Lite 只有 0.73%、Snow 0.00%。

---

## 6. 判据：哪些约束该留在 prompt，哪些必须移出

**核心判据只有一句：能写成一个返回 true/false 的函数吗？能，就不该靠文字。**

### 6.1 必须移出 prompt

| 约束类型 | 移到哪 | 依据 |
|---|---|---|
| 语法与结构合法性（可解析、方言正确、字段存在） | 编译器生成 / AST 断言 / `EXPLAIN` | PICARD 12%→2%；Structured Outputs <40%→100% |
| 枚举与白名单（只能用这批表、指标、函数） | 受控 IR 的取值域、工具签名的 enum 字段 | Anthropic 官方推荐 *"tools with an enum field containing your valid labels"* |
| 关系基数与聚合安全性（join 扇出） | 语义层声明 + 编译器改写 | Looker / MetricFlow / Databricks 三家一致 |
| 分层消费约束（如 ADS 禁止读 SDI/ODS） | IR 中 `source` 字段的取值域按目标层动态收窄，跨层引用在类型层面无法表达 | Databricks 把表上限做成硬约束、列隐藏做成"移出 context"，而非写进 instruction |
| 必选过滤条件（领域模式、有效标识、生效日期） | 语义层 named filter + 编译器无条件注入 | Snowflake 做成 semantic model 的 `filters:`，并把"是否精确应用"作为评测判分点 |
| 性能约束（分区裁剪、扫描量、全表扫描） | 引擎级开关 + 干跑阈值 | BigQuery `require_partition_filter`、Hive strict mode |
| 写入安全（分区覆盖范围、幂等） | `hive.exec.dynamic.partition.mode=strict` + 写后对账 | Hive 官方理由即"in case the user accidentally overwrites all partitions"；dbt 官方明说单测覆盖不了写入动作 |
| 执行期正确性（跑得通、行数合理、耗时可接受） | 试执行 + dry-run + 数据断言 | 98.7% 的错误是语义错误，只有这层能抓 |

### 6.2 适合留在 prompt

判据：**无法被程序判定真伪、需要模型运用判断力、且数量可控。**

- **任务目标与角色定位**——给强启发式而非硬逻辑，即 Anthropic 说的 "right altitude"
- **领域语义与业务口径**（这个指标为什么这样定、什么算有效订单）——程序无法判定语义正确性，这是 prompt 不可替代的部分
- **取舍偏好**（"宁可多一层 CTE 也不要三层嵌套子查询"）——本质是风格，没有硬对错
- **降级路径**——每条硬性规则都要配一条出口，如"若无法确定分区键，停下来询问，不要猜测"。这是 §4.6 那个失效机制的直接解药，也是 OpenAI 官方给的修法
- **少量、正向表述、高频命中的规范**，总数控制在个位数到十几条

### 6.3 表达方式的三条硬性要求

1. **正向而非否定**：「查询必须逐列显式列出投影字段」而不是「禁止 SELECT *」
2. **具体示例优于抽象原则**：Google 官方甚至说示例足够清晰时可以把指令删掉
3. **数据在前、指令在后**：三家官方一致；Anthropic 给的数字是把查询放末尾可提升最多 30%（内部测试，未公开细节）

---

## 7. 映射到 IOC 数据开发流程

参照 `参考/项目地图/ioc-workflow.md` 描述的体系（Hive + DLI 双引擎、Kimball 分层 SDI/ODS→DWD→DWS→ADS、分区 `INSERT OVERWRITE`、`sql-generate` → `sql-validation` → `platform-test` 链路、几十条 `POL-SQL-*` / `PAT-DOM-*` 策略 + `validate_*.py` 校验器）。

### 7.1 现状诊断

你已经具备的层：**L4 静态校验**（`validate_sql_ddl.py`、`validate_sql_etl_patterns.py`、`validate_sql_column_refs.py`、`validate_domain_patterns.py`）、**L7 的一部分**（`sql-validation` 阶段的 `mock-data-plan.md` + `validation-report.md`、`platform-test` 试算）、以及 fail-closed 的门禁机制（CORE-AX9）。这套骨架是对的。

缺失或错位的：

- **L1/L2/L3 基本不存在**——模型直接写原始 HQL，`sql-source-bindings.yaml` + `table-schema.json` 是**上下文供给**（相当于 §3.6 的 schema 上下文），不是受控 IR。没有编译器，所以每一条 `POL-SQL-*` 都只能靠模型自觉。
- **L5 干跑预检缺位**——`platform-test` 在 `job-create` 之后，属于事后试算而非事前预检。方言差异（Hive vs DLI）目前靠 `POL-REV-PLATFORM-003` 的文字描述 + `engine` 字段分支，而 §2.2 的证据说明方言是要付 10–12 个点的一等风险。
- **策略以文字形式与校验器双重存在**——同一条约束既写进 skill 的 prompt 又写进 `validate_*.py`。prompt 里的那份没有可测量收益，却在消耗注意力预算，其中禁止式的几条按 §4.7 可能是负收益。

### 7.2 三分法：现有策略该去哪

| 策略 | 现状 | 应该在哪 |
|---|---|---|
| `KW-AX8` / `POL-DESIGN-001`（ADS 禁止消费 SDI/ODS） | 公理 + 文字策略 + `validate_layer_consumption.py` | **L2**：IR 的来源表取值域按目标层收窄，跨层引用无法表达 |
| `PAT-DOM-SRC-002/003/004/005`（必选过滤：有效标识、生效日期、汇率类型） | 文字领域模式 + `validate_domain_patterns.py` | **L1 named filter + L3 编译器注入**，模型无权省略 |
| `PAT-DOM-SITE-001/002/003/008`（站点路由：global 表用 `data_site_type`，intl 表直查） | 文字模式 | **L1/L3**：站点路由是表级属性，应声明在表元数据上由编译器展开，不是让模型每次判断 |
| `POL-SQL-ETL-003`（`INSERT OVERWRITE` 分区表须显式 `PARTITION`） | 文字策略 | **L3 模板锁死 + L5 引擎开关** `hive.exec.dynamic.partition.mode=strict` |
| `POL-SQL-ETL-007`（先过滤→再 JOIN→再聚合） | 文字策略 | **L3**：这是编译器的执行计划职责，不是模型的书写纪律 |
| `POL-SQL-ETL-005/006/009`（`COALESCE`、除零为 NULL、聚合内先 `COALESCE`） | 文字策略 | **L1 指标定义 + L3 展开**：口径细节应绑在指标定义上单点声明 |
| `POL-SQL-QRY-001/002/005`（有意义别名、字段带别名、禁 `SELECT *`、嵌套≤3 层） | 文字策略 | **纯 L4**：从 prompt 删除，只留在 lint。且 `SELECT *` 那条改为正向表述 |
| `POL-SQL-DDL-001/005/006/007/009`（ORC SerDe、`DROP IF EXISTS`、字段顺序、`CASCADE`、测试态表名） | 文字策略 + `validate_sql_ddl.py` | **L3 模板**：DDL 是完全确定性的，应由模板生成而非模型书写 |
| 引擎差异（Hive vs DLI 的 SET 配置、CDM 节点、ORC SerDe、测试库） | `POL-REV-PLATFORM-003` 文字表 + `engine` 字段 | **L3 编译器分支 + L5 双引擎 `EXPLAIN` 双跑** |
| 澄清触发条件（`CORE-AX8` 澄清须人工） | 文字公理 + hook | **保留在 prompt**，但按 Databricks 四要素模板写死：触发条件 / 缺失信息 / 必须动作 / 示例话术 |
| 指标口径与业务语义（`feature-delta-indicator.md` 的含义、口径列） | 文档产物 | **保留在 prompt**，这是不可替代的部分 |

### 7.3 落地优先级

如果只做三件事：

**第一，把写入外壳从模型手里拿走。** `INSERT OVERWRITE TABLE ... PARTITION(...)` 这类语法在通用训练语料中极罕见（§2.2 的方言证据），而它又是完全确定性的。用模板生成写入外壳与分区声明，**只让模型生成中间的 `SELECT` 主体**。这一步同时消掉 `POL-SQL-ETL-002/003`、`POL-SQL-DDL-*` 一整批策略，并把「分区误覆盖」这类不可逆事故的概率降到零。

**第二，加一道 L5 双引擎干跑门，放在 `sql-generate` 之后、`job-create` 之前。** 同一段 SQL 在 Hive 与 DLI 各跑一次 `EXPLAIN`，任一失败即 fail-closed（这是 MetricFlow 的做法）；同时从执行计划里读分区裁剪是否生效、预估扫描量是否超阈值。这一步同时买到三样东西：方言一致性检验（不必再在 prompt 里描述"DLI 不支持某函数"）、性能不变量（把"性能优秀"从叮嘱变成硬门禁）、以及**给模型的真实执行反馈**——§3.4 的数据说明这值 +12 点，而模型自查只值 0–3.5 点。

**第三，给每张宽表的每条 join 打基数标记，并建枚举值字典。** 前者消灭 join 扇出这类最难发现的静默错误（`grain-join-analysis` skill 已有雏形，需要把结论固化成机器可读的表元数据而非分析报告）；后者是 §5.1 里性价比最高的一项（+13~+20 点），做法是为低基数列建取值字典（`SHOW PARTITIONS` + `DISTINCT` 抽样）配 LSH 模糊匹配，生成时注入候选实际取值。**永远不要让模型自己猜枚举值。**

### 7.4 同时要做的减法

按 §4 的证据，以下动作是净收益：

- 把 §7.2 表中标为「纯 L4」和「L3 模板」的策略**从 skill prompt 里删除**，只保留在校验器和模板里。它们在 prompt 中没有可测量收益。
- 剩下的策略改为正向表述，并按**实测失败频次**排序，只保留 top N。参考区间：FollowBench 的 CSL≈3、IFScale 在 100 条以内仍有 95%——安全区间大概在**十条以内的高频规则**。
- 检查隐性冲突。按 OpenAI 官方，冲突时胜出的是**位置更靠后**的那条，所以「编号小 = 优先」这个直觉在 prompt 里不成立。
- 为每条绝对措辞的强制规则配降级出口（§4.6）。

### 7.5 验收标准要按静默错误设计

98.7% 的错误是语法正确、能执行、结果错。所以 `sql-validation` 阶段的最小可行断言集应该是：

1. 输出行数 vs 上游行数的比值区间（抓 join 扇出与过滤条件缺失）
2. 主键/业务键唯一性（抓扇出的事后表征）
3. 分区键取值范围与目标分区一致（抓写入范围错误）
4. 关键度量与既有报表对账（抓口径错误）
5. NULL 率变化（抓隐式条件缺失、`COALESCE` 遗漏）
6. 去重前后行数差（抓 `DISTINCT` 类错误）

这六项恰好覆盖 NL2SQL-BUGs 分类法里占比最高的几类。CHESS 的数据显示这类断言在 **10 条左右达峰**，之后进入 plateau——不需要更多。

---

## 8. 明确的证据缺口

调研中未找到一手证据的问题，列出以免被当作已知：

- **Hive / Huawei DLI 方言的 text-to-SQL benchmark**：不存在。现有一手 benchmark 覆盖 SQLite、MySQL、PostgreSQL、SQL Server、Oracle、BigQuery、Snowflake、DuckDB、ClickHouse，均不含 Hive 或 DLI。跨方言代价只能从 §2.2 的两组 A/B 外推。
- **`INSERT OVERWRITE` / 分区写入型 SQL 的准确率**：无公开分项数据。最接近的是 LiveSQLBench-Base-Lite 的 270 题中有 90 条 Management SQL（CRUD/DDL），以及 BIRD-CRITIC 覆盖非 SELECT 场景，但官方均未公布 SELECT 与 Management SQL 的分项成功率。
- **Spider 2.0 与 Spider 1.0 的人类基线**：均未发布。所以"Spider 2.0 上 55% 距人类多远"目前无法回答。
- **NULL 语义错误、去重错误在错误总量中的占比**：NL2SQL-BUGs 有对应子类（Implicit Condition Missing、DISTINCT），但占比只在饼图中呈现，正文未给数值。
- **grammar-constrained decoding 对当前前沿 API 模型的收益**：未找到。PICARD 需要 logits 访问权限，2023 年后的 SOTA 方法均不使用。
- **temperature 与规则遵守率的量化关系曲线**：各论文均在固定或默认参数下评测，厂商文档亦未给出。只能确认方差存在，不能给出函数关系。
- **同一约束「抽象原则」vs「具体示例」的 A/B 遵守率对照**：只有厂商定性建议，无受控实验。
- **同一约束放 system prompt vs user prompt 的遵守率差值**：SysBench 只评测 system message 遵守能力，未做位置 A/B。仅有 Anthropic 关于"查询置于末尾可提升最多 30%"的内部测试数字（未公开细节）。
- **Effi-SQL leaderboard**（BIRD 2026-06 发布的专测效率 benchmark）：截至抓取时为空，无模型提交。
- **Soda 与 Apache Calcite**：前者官方文档站已重组（旧路径 404），后者抓取超时，本报告不对二者机制做断言。

---

## 附：一手来源清单

**Benchmark 与 leaderboard**
- Spider — https://yale-lily.github.io/spider
- Spider 2.0 官方站 — https://spider2-sql.github.io/ ｜论文 https://arxiv.org/abs/2411.07763
- BIRD — https://bird-bench.github.io/ ｜论文 https://arxiv.org/abs/2305.03111 ｜mini_dev（多方言） https://github.com/bird-bench/mini_dev
- BIRD-CRITIC / Effi-SQL — https://bird-critic.github.io/
- LiveSQLBench — https://livesqlbench.ai/
- NL2SQL-BUGs（KDD '25）— https://doi.org/10.1145/3711896.3737427 ｜https://nl2sql-bugs.github.io/
- NoLiMa — https://arxiv.org/abs/2502.05167 ｜https://github.com/adobe-research/nolima

**Text-to-SQL 方法论文**
- PICARD（EMNLP 2021）— https://arxiv.org/abs/2109.05093
- DIN-SQL — https://arxiv.org/abs/2304.11015
- DAIL-SQL（VLDB '24）— https://arxiv.org/abs/2308.15363
- CHESS — https://arxiv.org/abs/2405.16755
- CHASE-SQL — https://arxiv.org/abs/2410.01943
- XiYan-SQL — https://arxiv.org/abs/2411.08599
- Distillery — https://arxiv.org/abs/2408.07702
- Arctic-Text2SQL-R1 — https://arxiv.org/abs/2505.20315
- Prompt 长度与演示组织（Chang & Fosler-Lussier）— https://arxiv.org/abs/2305.11853

**指令遵守与长上下文**
- Self-Debugging（ICLR 2024）— https://arxiv.org/abs/2304.05128
- LLMs Cannot Self-Correct Reasoning Yet（ICLR 2024）— https://arxiv.org/abs/2310.01798
- IFScale（10→500 条指令）— https://arxiv.org/abs/2507.11538
- FollowBench（ACL 2024）— https://arxiv.org/html/2310.20410v3
- ComplexBench（NeurIPS 2024）— https://openreview.net/forum?id=U2aVNDrZGx
- SysBench — https://arxiv.org/html/2408.10943v2
- Multi-IF — https://arxiv.org/abs/2410.15553
- Lost in the Middle（TACL 2024）— https://aclanthology.org/2024.tacl-1.9/
- LLMs Get Lost In Multi-Turn Conversation — https://arxiv.org/abs/2505.06120
- 否定 prompt 的逆缩放（Jang et al.）— https://ar5iv.labs.arxiv.org/html/2209.12711
- ⚠️ 否定约束的机制分析（单作者预印本，单模型）— https://arxiv.org/abs/2601.08070

**厂商官方文档与工程博客**
- Anthropic｜Effective context engineering for AI agents — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic｜Prompt engineering — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering
- OpenAI｜Introducing Structured Outputs — https://openai.com/index/introducing-structured-outputs-in-the-api/
- OpenAI｜Structured Outputs 指南 — https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI｜GPT-4.1 Prompting Guide — https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
- Google｜Gemini prompt design strategies — https://ai.google.dev/gemini-api/docs/prompting-strategies
- Snowflake｜Cortex Analyst: Behind the Scenes — https://www.snowflake.com/en/blog/engineering/snowflake-cortex-analyst-behind-the-scenes/
- Snowflake｜Evaluating Text-to-SQL Accuracy for Real-World BI — https://www.snowflake.com/en/blog/engineering/cortex-analyst-text-to-sql-accuracy-bi/
- Snowflake｜Cortex Analyst 文档 — https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst
- Snowflake｜Semantic Views — https://docs.snowflake.com/en/user-guide/views-semantic/overview
- Snowflake｜Verified Query Repository — https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository
- Snowflake｜EXPLAIN — https://docs.snowflake.com/en/sql-reference/sql/explain
- Databricks｜Curate an effective Genie Agent — https://docs.databricks.com/aws/en/genie/best-practices
- Databricks｜Tune Genie Agent quality — https://docs.databricks.com/aws/en/genie-agents/tune-quality
- Databricks｜Trusted assets — https://docs.databricks.com/aws/en/genie/trusted-assets
- Databricks｜Joins in metric views — https://docs.databricks.com/aws/en/uc-semantics/metric-views/joins
- Databricks｜Metric view YAML reference — https://docs.databricks.com/aws/en/business-semantics/metric-views/yaml-reference
- Looker｜Understanding symmetric aggregates — https://cloud.google.com/looker/docs/best-practices/understanding-symmetric-aggregates
- dbt｜MetricFlow Joins — https://docs.getdbt.com/docs/build/join-logic
- dbt｜data tests — https://docs.getdbt.com/docs/build/data-tests
- dbt｜unit tests — https://docs.getdbt.com/docs/build/unit-tests
- dbt｜model contracts — https://docs.getdbt.com/docs/collaborate/govern/model-contracts
- dbt-spark｜insert_overwrite — https://docs.getdbt.com/reference/resource-configs/spark-configs
- Cube｜Introduction — https://cube.dev/docs/product/introduction
- BigQuery｜Write queries with Gemini — https://docs.cloud.google.com/bigquery/docs/write-sql-gemini
- BigQuery｜dry run — https://cloud.google.com/bigquery/docs/running-queries#dry-run
- BigQuery｜require_partition_filter — https://cloud.google.com/bigquery/docs/managing-partitioned-tables#require-partition-filter
- Apache Hive｜Configuration Properties — https://cwiki.apache.org/confluence/display/Hive/Configuration+Properties
- SQLGlot — https://github.com/tobymao/sqlglot
- SQLFluff｜Rules Reference — https://docs.sqlfluff.com/en/stable/reference/rules.html
- Great Expectations｜Overview — https://docs.greatexpectations.io/docs/core/introduction/gx_overview
- LangChain｜SQL agent — https://docs.langchain.com/oss/python/langchain/sql-agent
- AWS Bedrock｜Knowledge Bases structured data — https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-structured.html

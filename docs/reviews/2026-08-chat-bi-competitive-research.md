# Chat-BI / 语义层竞品研究(2026-08)

> **性质**:只读研究报告。调研 Databricks(2026-06 DAIS 后新版)、腾讯音乐 SuperSonic、Snowflake 三家 Chat-BI / 语义层产品的设计理念、核心概念、交互流程与一次问答的状态流转,并横向对照 dbt MetricFlow 与 ThoughtSpot Spotter,最后落到对 MetricCanvas(问数增强批次 [PRD #85](https://github.com/CCharlesMeng/MetricCanvas/issues/85) 与整体概念模型)的设计启示。
>
> **方法与来源优先级**:一手来源(官方文档、官方博客、开源仓库源码)优先;二手文章只作线索不作断言依据;拿不准的在文末「未证实与资料不足」标注。每个事实性断言附来源 URL。SuperSonic 是唯一可读源码的对象,其状态流转均落到源码文件级证据(master 分支,2026-08-13 取证)。
>
> **术语约定**:本文谈及竞品概念时使用竞品原文命名(如 verified query、trusted asset),谈及 MetricCanvas 时严格使用 `CONTEXT.md` 词汇表术语(数据上下文快照、指标条目、取数单元、口径卡、临时口径、指标需求条目、已验证查询等),两套词汇不混用。

## 0. 执行摘要

三家产品在 2025–2026 收敛到同一个骨架:**声明式语义层(YAML/SQL 对象)+ 受控的 LLM 生成 + 「验证答案」信任分层 + 评测集回归 + 「候选→人工背书→资产」的成长回路**。差异在三个维度:

1. **知识来源的自动化程度**:Databricks 走「自动抽取知识图谱(Genie Ontology)+ 人工建模层(UC Semantics)」双轨,自动化最激进;Snowflake 走「一切进语义视图,系统只做建议」;SuperSonic 走「人工建模 + 记忆双评审」,自动化最保守。
2. **人工确认点的位置**:SuperSonic 把确认点放在**执行前**(parse/execute 两段式 API,多候选阻塞让用户选);Snowflake 放在**生成前后两端**(question categorization 反问/拒答 + 响应回显 confidence);Databricks 放在**执行后**(反馈三态 + 编辑 SQL 回存),执行前不阻塞。
3. **拒答与澄清是否为一等公民**:三家都有显式失败出口,没有一家「硬答」。SuperSonic 在状态机里写死两个失败出口;Snowflake 允许在语义模型里用自然语言声明拒答与澄清规则;Databricks 靠 trusted assets 的「verified/非 verified」标注区分置信。

对 MetricCanvas 最有含金量的三条结论(详见 §5.5):派生度量声明进语义层已是行业共识(Databricks window measures 与 dbt derived/ratio metrics 是 PRD #85 S2 的直接先例);「反馈不自动改变系统行为」被 Databricks 明文写进文档,与 MetricCanvas 的人工背书红线互证;评测集的判分规则(结果集比对而非 SQL 文本比对、同数据不同排序算对、多列算错)有可直接借用的成熟先例。

---

## 1. Databricks(2026-06 DAIS 之后)

### 1.1 设计理念

Databricks 对 Chat-BI 的问题定义是**上下文问题而非模型问题**:业务上下文散落在 dashboard、查询、pipeline、wiki、工单与聊天记录里,AI 找不到就靠推断补齐,产出「最好是泛泛、最坏是错误」的答案([官方博客](https://www.databricks.com/blog/introducing-genie-one-genie-ontology-and-genie-agents))。解法是三件套:

- **Genie One**:面向业务用户的「数据型 AI 同事」,嵌入 Slack/Teams/移动端,答案全部落在 Unity Catalog 治理之下([docs](https://docs.databricks.com/aws/en/genie/));
- **Genie Agents**:由 Genie Spaces 演化而来(官方已改名,存量文档标注 "Genie Agents were formerly known as Genie Spaces"),是限定主题、配置了受信数据与业务规则的领域问答环境([docs](https://docs.databricks.com/aws/en/genie/trusted-assets));
- **Genie Ontology**:自动上下文层,从表、查询、dashboard、pipeline 与外部应用中抽取知识片段组织成「活的知识图谱」([官方博客](https://www.databricks.com/blog/introducing-genie-one-genie-ontology-and-genie-agents))。

关键的架构表述来自 UC Semantics 文档:**Unity Catalog semantics(metric views、domains、pages、certification)构成 Genie Ontology 的「人工建模层」(human-modeled layer),Genie One 把这层显式治理的上下文与自动推断的上下文合并使用**([docs](https://docs.databricks.com/aws/en/uc-semantics/))。即:人工定义与自动抽取不是二选一,而是同一个上下文层的两个来源,人工层带治理权威。

### 1.2 核心概念与关系

**Genie Agent 的知识分层**(全部 Agent 内局部生效,不写回 Unity Catalog;[docs](https://docs.databricks.com/aws/en/genie/knowledge-store)):

| 层 | 内容 | 限额 |
|---|---|---|
| Instructions | 全局文本指令(财年定义、格式约定)、示例 SQL 查询、UC SQL 函数 | 100 条/Agent(整块文本算 1 条) |
| Knowledge store | 表/列局部描述与同义词、join 关系(带基数声明)、SQL expressions(measure/filter/field 三类,带同义词与使用说明) | 200 条/Agent |
| Prompt matching | Format assistance(采样代表值)+ Entity matching(最多 120 列、每列 1024 个去重维度值,用于把「Florida」映射到 `FL`) | 不计入上述限额 |

- **Trusted assets(受信资产)= 参数化示例查询 + UC SQL 函数**。当回答**逐字使用**参数化查询模板时,Genie 给出 **verified answer(验证答案)**标记,用户可改参数重跑;SQL 函数注册在 Unity Catalog,Genie 只能调用不能查看内部 SQL,适合「不应暴露、不应被改写」的口径([docs](https://docs.databricks.com/aws/en/genie/knowledge-store))。
- **SQL expressions vs 文本指令**:文档明确「把业务逻辑定义为 SQL expression 比文本指令产出更一致,因为 Genie 按原文应用逻辑而非从自然语言解释」——结构化声明优于提示词,是 Databricks 自己的工程结论([docs](https://docs.databricks.com/aws/en/genie/knowledge-store))。
- **UC Metric Views(YAML 语义模型)**:顶层字段为 `version / comment / source / parameters / filter / joins / fields(dimensions) / measures / materialization`([YAML 参考](https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference))。要点:
  - **一次定义、任意切分**:measure 定义一次(如 `SUM(revenue)/COUNT(DISTINCT customer)`),查询期按任意 field 分组,由引擎生成正确计算([概述](https://docs.databricks.com/aws/en/uc-semantics/metric-views/));
  - **window measures** 声明滚动/累计/期比:`window: {order, range(trailing 7 day/cumulative/all), semiadditive(first/last), offset(-12 month)}`,`offset: -12 month` 即声明式同比;窗口大小与 offset 可以是查询期传入的参数([YAML 参考](https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference));
  - **agent metadata**:field 与 measure 可声明 `display_name / format / synonyms`(每个最多 10 个同义词、255 字符),文档直言其用途是「帮助 Genie 等自然语言工具通过用户输入发现字段与度量」([docs](https://docs.databricks.com/aws/en/metric-views/data-modeling/semantic-metadata));
  - **与 Genie 双向打通**:certified 的 metric view 引导 Genie 优先采用([UC semantics](https://docs.databricks.com/aws/en/uc-semantics/));反向可把一个 Genie Agent 的语义上下文**导出为 metric view**([docs](https://docs.databricks.com/aws/en/genie/trusted-assets))——Agent 内沉淀的局部知识有一条升格为治理资产的通道。
- **Domains(域)**:UC Semantics 的业务组织层,按业务目的分组数据资产供发现浏览([docs](https://docs.databricks.com/aws/en/uc-semantics/))。与 MetricCanvas 业务域同为「发现面收窄」用途。
- **Genie Ontology 与 OntoRank**:Ontology 自动从表、查询、dashboard、pipeline、外部应用抽取指标定义、业务术语、特殊计算及「概念—指标—表—团队」关系;**OntoRank** 用类 PageRank 方式为知识片段计算权威度,官方博客列出的信号是:定义出处、出处作者的相对权威、被依赖频率、与 certified 及广泛使用资产的关联紧密度、新鲜度,回答时采信权重最高的来源,并按来源各自的权限体系过滤可见性([官方博客](https://www.databricks.com/blog/introducing-genie-one-genie-ontology-and-genie-agents))。官方内部基准(28 题真实企业数据分析)称 Genie 首答正确率 84.5%,最强通用编码 Agent 为 52.4%(同上,内部基准,口径不可外部复核)。

### 1.3 交互流程与一次问答的状态流转

Genie Agent 聊天一轮的文字状态机(依据 [Test and monitor 文档](https://docs.databricks.com/aws/en/genie/benchmarks) 与 [Tune quality 文档](https://docs.databricks.com/aws/en/genie/knowledge-store) 整理):

```
提问(自由输入 / 点击 common questions)
  → 上下文组装(instructions + 示例查询 + knowledge store + entity matching 值匹配 + 错误信号)
  → 判定是否命中 trusted asset
      ├─ 命中参数化查询模板(逐字使用)→ 执行 → 呈现,标注 verified answer,参数可编辑重跑
      └─ 未命中 → LLM 生成 SQL → 执行 → 呈现:自然语言答案 + 结果表格,
                   Genie 判定可视化有增益时附图表;生成过 SQL 则附 SQL
  → 反馈环节「Is this correct?」三态:
      ├─ Yes(确认)
      ├─ Fix it(选常见问题类型或自述)→ Submit and try again 带反馈重新生成 / 仅提交
      └─ Request review(转人工审阅,可附评论;结果回显到提问者的 Monitor 页)
  → 编辑者动作出口:Show code 查看 SQL → 手工修 SQL → run → Add as instruction(存为示例查询)
                    / Add as benchmark(存为评测题) / Regenerate / Refresh data
```

特征:**执行前没有任何阻塞式确认**;文档明确 Genie 行为非确定,「同一 prompt 可能得到不同输出」,对策是提供示例查询提升一致性([docs](https://docs.databricks.com/aws/en/genie/benchmarks))。权限模型是「作者的计算凭据 + 用户各自的数据凭据」,行级安全在 UC 层按用户强制执行;值得注意的治理边界:**Genie 能查询未显式加入 Agent 的表**(受 UC 权限约束,用户可通过追问 join 或直接编辑 SQL 触达),Agent 边界不是数据边界([docs](https://docs.databricks.com/aws/en/genie/trusted-assets))。

### 1.4 信任分层与成长回路

**信任分层**(从强到弱):certified 治理标签(UC governed tag `system.certification_status`,可标注 Agent 本身与数据资产)→ trusted assets 命中产生的 verified answer 标记 → 普通生成答案。certification 同时是 OntoRank 的权威度信号([docs](https://docs.databricks.com/aws/en/genie/trusted-assets)、[官方博客](https://www.databricks.com/blog/introducing-genie-one-genie-ontology-and-genie-agents))。

**成长回路**有四条,全部收敛到「建议 → 人工接受」:

1. **用户反馈回路**:文档明文「**你的 Genie Agent 的行为不会仅因用户反馈而改变**。应使用反馈识别改进机会」——反馈是给编辑者看的信号,不是自动训练数据([docs](https://docs.databricks.com/aws/en/genie/benchmarks));编辑者把好的交互 Add as instruction / Add as benchmark。
2. **Knowledge mining**:自动分析 UC 元数据(主外键自动存为 join 关系);作者点赞或下载结果时分析该查询,建议新的 SQL expressions 与 join 关系,由人工接受([docs](https://docs.databricks.com/aws/en/genie/knowledge-store))。
3. **Query suggestions**:建 Agent 时自动搜索工作区内针对所选表的高频历史查询,逐条 Accept/Reject 进示例查询([docs](https://docs.databricks.com/aws/en/genie/trusted-assets))。
4. **Benchmarks(评测集)**:每 Agent 最多 500 题;每题=问题原文+可选「SQL Answer」金标准+可选评审备注;官方建议同一问题写 2–4 种措辞;评测以新会话运行(不带对话上下文)。Chat 模式判分规则:生成 SQL 与金标准逐字相同=Good;**结果集完全一致=Good;同数据不同排序=Good;数值 4 位有效数字内一致=Good;空结果或报错=Bad;多出列=Bad**;无金标准的题必须人工判分;比对上限 5000 行。Agent 模式由 LLM judge 按评审备注判分。评测历史按时间戳留存以追踪准确率变化;跑完可让 Genie Code 全量分析失败题并生成上下文改进建议;个别题还可「Update ground truth」把更好的响应升格为新金标准([docs](https://docs.databricks.com/aws/en/genie/benchmarks))。

监控侧:Monitor 页可按时间/评分/用户/状态过滤全部问答,周摘要统计消息量、活跃用户与好评差评;「Analyze Space Usage」让 Genie Code 分析近 7 天的用户消息与反馈,输出常见主题、反复出现的问题与上下文改进建议,带回链引用([docs](https://docs.databricks.com/aws/en/genie/benchmarks))。

---

## 2. 腾讯音乐 SuperSonic(开源,github.com/tencentmusic/supersonic)

### 2.1 设计理念

SuperSonic 的立场写在 [README](https://github.com/tencentmusic/supersonic) 里:单靠 Text2SQL 的可靠性「不足以支撑大规模真实应用」,解法是**把 Chat BI(LLM)与 Headless BI(语义层)合一**,两个范式互相成就:

1. 把数据语义(业务术语、列值等)注入 prompt,让 LLM 少幻觉;
2. **把高级 SQL 语法(join、公式)的生成从 LLM 卸载给语义层**,降低生成复杂度。

这就是它的「headless」解耦方式:问答层生成的不是物理 SQL,而是**面向逻辑语义模型的 S2SQL(semantic SQL)**;物理 join、公式展开由 Semantic Translator 在语义层内确定性完成(Calcite/JSqlParser;[CLAUDE.md](https://github.com/tencentmusic/supersonic/blob/master/CLAUDE.md))。语义层同时以开放 API 对外(`/openapi/chat/query` 与独立的 headless 启动器),Chat 只是消费方之一([ChatQueryController.java](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/rest/ChatQueryController.java)、[launchers 目录](https://github.com/tencentmusic/supersonic/tree/master/launchers))。全链路组件均可用 Java SPI 替换(README)。

### 2.2 语义建模概念与层级

从 headless 模块的 REST 面与 POJO 可确证的建模概念层级([controllers 目录](https://github.com/tencentmusic/supersonic/tree/master/headless/server/src/main/java/com/tencent/supersonic/headless/server/rest)):

```
主题域 Domain(树形业务组织,DomainController)
  └─ 数据模型 Model(物理表/SQL 映射为逻辑模型,ModelController;
       模型间关系 ModelRelaController 声明 join)
       ├─ 维度 Dimension(DimensionController)
       ├─ 指标 Metric(MetricController)
       └─ 标签 Tag / 标签对象 TagObject(TagController、TagObjectController,
            面向实体圈选/画像场景的元数据标记)
  └─ 数据集 DataSet(DataSetController;问答的授权与检索边界,
       Agent 按 dataSetIds 圈定可答范围)
横切:术语 Term(TermController,业务黑话及其描述)
      词典/知识库 Knowledge(KnowledgeController + HanLP 自定义词典)
```

- **词典机制**:Knowledge Base 周期性从语义模型抽取 schema 信息,把指标名、维度名、**维度取值**写入 HanLP 自定义词典并建索引(README「Knowledge Base」;仓库内可见生成的 `DimValue_*.txt` 词典文件与 [HanlpDictMatchStrategy.java](https://github.com/tencentmusic/supersonic/blob/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/mapper/HanlpDictMatchStrategy.java)),这是 schema mapping 能把「Florida」这类口语值精确锚定到列值的基础,与 Databricks entity matching 同构。
- **术语机制**:[TermDescMapper.java](https://github.com/tencentmusic/supersonic/blob/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/mapper/TermDescMapper.java) 在映射阶段识别问题中的业务术语,把术语描述作为旁路信息(SideInfo)注入后续 LLM prompt。
- **指标模式 vs 明细/标签模式**:当前代码把一次查询的形态收敛为 [QueryType](https://github.com/tencentmusic/supersonic/blob/master/common/src/main/java/com/tencent/supersonic/common/pojo/enums/QueryType.java) 二值:`AGGREGATE`(指标聚合,可切维)与 `DETAIL`(明细字段圈选);数据集可分别配置两种模式的默认行为(如 [AggregateTypeDefaultConfig.java](https://github.com/tencentmusic/supersonic/blob/master/headless/api/src/main/java/com/tencent/supersonic/headless/api/pojo/AggregateTypeDefaultConfig.java))。早期文档语境中的「标签模式」对应现在的 DETAIL+Tag 元数据组合(历史文档不可达,见 §6)。
- **Agent 与插件**:chat 层的 [Agent](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/agent/Agent.java) 是问答入口配置单元:圈定数据集工具(DatasetTool)、插件工具(PluginTool)、示例问题、是否开启检索联想(enableSearch)、**是否开启多候选反馈(enableFeedback)**、各环节 LLM 应用配置(chatAppConfig,每个环节的 prompt 模板可改可关)。插件机制(ChatPlugin/PluginRecognizer/PluginExecutor)用 LLM 按插件描述与示例问题路由到第三方工具,兜住语义层答不了的问题(README「Chat Plugin」、[plugin 包](https://github.com/tencentmusic/supersonic/tree/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/plugin))。

### 2.3 解析管线与状态流转(代码级)

**核心状态机**在 [ChatWorkflowState.java](https://github.com/tencentmusic/supersonic/blob/master/headless/api/src/main/java/com/tencent/supersonic/headless/api/pojo/enums/ChatWorkflowState.java) 与 [ChatWorkflowEngine.java](https://github.com/tencentmusic/supersonic/blob/master/headless/server/src/main/java/com/tencent/supersonic/headless/server/utils/ChatWorkflowEngine.java):

```
MAPPING ──映射为空──▶ FAILED("No semantic entities can be mapped") ▶ FINISHED
   │
PARSING ──候选为空──▶ FAILED("No semantic queries can be parsed out") ▶ FINISHED
   │(候选非空,写入 selectedParses)
S2SQL_CORRECTING(语义 SQL 修正链)
   │
TRANSLATING(S2SQL→物理 SQL,语义层确定性翻译;翻译失败置 FAILED 并携带错误)
   │
PHYSICAL_SQL_CORRECTING(可选 LLM 物理 SQL 修正)
   │
FINISHED
```

各阶段机制:

- **MAPPING(schema 映射)**:多路 Mapper 顺序执行——`KeywordMapper`(HanLP 词典精确/前缀匹配 + 数据库匹配)、`EmbeddingMapper`(向量相似)、`TermDescMapper`(术语)、`PartitionTimeMapper`、`QueryFilterMapper` 等([mapper 包](https://github.com/tencentmusic/supersonic/tree/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/mapper)),产出问题文本到 schema 元素(指标/维度/实体/值)的匹配集合,每个匹配带相似度。
- **PARSING(语义解析)**:规则解析器与 LLM 解析器并存([parser 包](https://github.com/tencentmusic/supersonic/tree/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/parser))。chat 层的 [NL2SQLParser.java](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/parser/NL2SQLParser.java) 的编排策略:
  1. **规则先行**:对每个候选数据集,先以 `STRICT`→`MODERATE` 两档映射模式跑规则解析,全空才降级 `LOOSE`;每个数据集取排序后的 top1 进候选池;
  2. **候选仲裁**:[SemanticParseInfo.SemanticParseComparator](https://github.com/tencentmusic/supersonic/blob/master/headless/api/src/main/java/com/tencent/supersonic/headless/api/pojo/SemanticParseInfo.java) 依次比较:数据集相似度 → 完全匹配(similarity==1)元素个数 → 指标相似度 → 总相似度 → **指标历史使用次数(maxMetricUseCnt)**,截取 `PARSER_SHOW_COUNT` 个呈现;
  3. **澄清闸门**:[ParseContext.needFeedback()](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/ParseContext.java) = Agent 开了 enableFeedback **且**候选多于 1 **且**用户尚未选择 → 停在候选呈现,等用户点选;否则系统取 top1 继续;
  4. **LLM 解析**:以选中候选圈定的 schema 子集为上下文,先做**多轮改写**(把当前问题+历史问题/映射/SQL 重写为自包含问题,prompt 模板 `REWRITE_MULTI_TURN`),再召回动态 few-shot 样例,交给 [OnePassSCSqlGenStrategy](https://github.com/tencentmusic/supersonic/blob/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/parser/llm/OnePassSCSqlGenStrategy.java):**不同 exemplar 组合并行生成多份 S2SQL,自一致性投票(selfConsistencyVote)选多数答案**——这是它的置信度机制;失败再以 `MapModeEnum.ALL`(全量语义字段)重试一次。
- **CORRECTING(修正链)**:规则修正器逐个过——Grammar/Schema/Time/Where/GroupBy/Having/Select/Agg 修正器,再加可选的 LLMSqlCorrector 与 LLMPhysicalSqlCorrector([corrector 包](https://github.com/tencentmusic/supersonic/tree/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/corrector)):修正幻觉字段、补 GROUP BY、补时间约束等。
- **两段式 API 与人工确认点**:[ChatQueryController](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/rest/ChatQueryController.java) 暴露 `search`(输入联想)、`parse`(返回候选解析,含每个候选的结构化口径:指标/维度/筛选/时间/agg)、`execute`(按 queryId+parseId 执行)。**parse 与 execute 的分离就是人工确认点**:UI 可在两步之间呈现候选让用户选/改;一步到位的 `/query` 端点则自动取 top1 串联两步。执行后还有 processor 链做结果增强(文本解读 DataInterpretProcessor、指标/维度推荐、[MetricRatioCalcProcessor](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/processor/execute/MetricRatioCalcProcessor.java) 等)。

### 2.4 信任与成长

- **记忆双评审**:问答轨迹落为 ChatMemory(问题、schema、S2SQL、旁路信息)。[MemoryReviewTask](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/memory/MemoryReviewTask.java) 定时用 LLM 评审(输出 POSITIVE/NEGATIVE+评语),另有人工评审字段(humanReviewRet);**只有评审通过的记忆才进入 few-shot 样例库**(ExemplarService,pgvector 检索)。即:反馈→候选记忆→双评审→才成为影响后续生成的资产,与 MetricCanvas「候选已验证查询经人工背书进快照」同构,但多了一道 LLM 预筛。
- **使用信号进排序**:指标使用次数直接参与候选仲裁(§2.3),越用越准的最小实现。
- **评测**:仓库有独立 `benchmark/` 与 `evaluation/` 顶级模块([仓库根](https://github.com/tencentmusic/supersonic)),支持对解析链路做回归,但文档化程度低。
- **信任呈现**:UI 呈现结构化口径(SemanticParseInfo 的 textInfo)供用户核对;没有 Databricks/Snowflake 那种「verified」显式标记,信任靠「规则解析优先于 LLM + 执行前候选确认」结构性达成。

---

## 3. Snowflake

### 3.1 设计理念

Cortex Analyst 的立场是 **API-first 的托管 Text2SQL 服务**:只做「自然语言→SQL + 解释」这一段,不做端到端 UI,由集成方(Streamlit/Slack/自建应用)决定交互与执行;官方理由是让企业「把数据洞察带到业务已经在用的工具里」([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst))。准确性的来源是**语义模型**:「通用 AI 方案只拿数据库 schema 做 text-to-SQL 会失败,因为 schema 缺业务过程定义与指标处理知识」(同上)。

2025–2026 的关键演化是**语义层 SQL 原生化**:语义模型从「stage 上的 YAML 文件」升格为 **Semantic View——schema 级数据库对象**,可用 SQL DDL 创建、可被 `SELECT ... FROM SEMANTIC_VIEW(...)` 直接查询、可走 RBAC/共享/Marketplace;YAML 文件模式保留仅作向后兼容,官方明确推荐 Semantic Views([overview](https://docs.snowflake.com/en/user-guide/views-semantic/overview)、[Cortex Analyst docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst))。即:**同一个语义对象,人查(BI/SQL)与 AI 查(Cortex Analyst)共用**——这是三家中最彻底的 headless 形态。

### 3.2 核心概念结构

Semantic View 的 YAML 规范([spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec)):

```
tables(逻辑表,对应业务实体;可 role-playing 复用同一物理表)
  ├─ primary_key
  ├─ dimensions(类别属性;可带 synonyms / sample_values / is_enum /
  │    cortex_search_service —— 挂接 Cortex Search 服务做维度值语义检索)
  ├─ time_dimensions(时间维度单列一类)
  ├─ facts(行级数值,"helper"概念,供构造 metric;可 private_access 隐藏)
  ├─ metrics(表级聚合指标;可声明半可加:non-additive dimension + first/last 排序)
  └─ filters(具名布尔筛选;推荐用 labels:[filter] 的实体级写法)
relationships(逻辑表间 join:多对一/一对一推断/ASOF 时点/range 区间/桥表多对多)
metrics(视图级派生指标,跨表组合)
verified_queries(VQR:name/question/sql/verified_by/verified_at/use_as_onboarding_question)
module_custom_instructions
  ├─ sql_generation(SQL 生成规则:格式、默认筛选、联动筛选)
  └─ question_categorization(问题分类规则:澄清与拒答)
variables(查询期参数,可参与维度/指标表达式)
```

要点:

- **facts / metrics / dimensions 三分**:facts 是行级「原料」,metrics 是聚合后的 KPI,dimensions 是切分视角;facts 明确定位为帮助构造 metrics 的中间概念([overview](https://docs.snowflake.com/en/user-guide/views-semantic/overview))。
- **VQR(Verified Query Repository)**:已验证「问题→SQL」对,SQL 必须用**逻辑表/逻辑列名**写(物理列名不可用);相似问题命中时用作生成参照,响应的 **confidence 字段回显命中的是哪条 verified query**;`use_as_onboarding_question` 把验证查询兼作新手引导问题([VQR docs](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository))。
- **澄清与拒答声明化**:`question_categorization` 用自然语言声明「问 users 没给 product_type 就视为 UNCLEAR 并追问」「拒绝一切 salary 问题并告知联系管理员」;直连 API 时用 UNCLEAR 等状态关键词,经 Cortex Agent 调用时可写纯自然语言([custom instructions docs](https://docs.snowflake.com/en/user-guide/views-semantic/custom-instructions))。**澄清条件与拒答面是语义模型的一部分,随模型治理**,这是 Snowflake 独有的设计。
- **维度值检索**:dimension 可挂 `cortex_search_service`,高基数维度值不塞进模型而是查询期语义检索([spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec)),与 Databricks entity matching(≤1024 值静态存储)是同一问题的两种解法。
- **多语义模型路由**:配置多个数据源时「Cortex Analyst 能自动判断该用哪一个,无需每次指定」([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst))——对应 MetricCanvas 的域路由,但为静默路由。

### 3.3 交互流程与一次问答的状态流转

Cortex Analyst 单轮(依据 [docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)、[custom instructions](https://docs.snowflake.com/en/user-guide/views-semantic/custom-instructions)、[VQR](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository) 整理):

```
REST 请求(messages 多轮历史 + 语义视图/模型引用)
  → 多轮改写(follow-up 补全为自包含问题,如"What about North America?"
     → "What is the month-over-month revenue growth for 2021 in North America?")
  → question categorization(按 question_categorization 指令分类)
      ├─ 拒答类 → 返回拒绝消息(如"联系管理员")
      ├─ UNCLEAR → 返回追问(如"请指定 product_type")
      └─ 可答 → 继续
  → 语义模型选择(多模型时自动路由)
  → VQR 相似检索(命中则作为生成参照)
  → SQL 生成(托管模型组合,当前优先序 Claude Sonnet 4.6 → 4.5 → GPT 4.1 →
     Arctic Text2SQL R1.5 → Mistral Large 2 + Llama 3.1 70b,不可指定单模型)
  → 响应:interpretation 文本("We interpreted your question as ...")
     + SQL + confidence(含命中的 verified query)
  → 执行与呈现由调用方完成(SQL 在客户 warehouse 执行,RBAC 生效)
```

明确的能力边界写进文档:不能引用上一轮 SQL 的**结果**(只有 SQL 文本在上下文里)、不回答「有什么趋势」这类非 SQL 问题、长对话/频繁换意图时建议重开会话([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst))。

**Snowflake Intelligence** 是其上的成品应用:用户问题进 Cortex Agent API,**orchestrator LLM 解释意图、选择工具、规划动作序列**(可判定超范围),工具含 Cortex Analyst(结构化)、Cortex Search(非结构化)、自定义工具(UDF/存储过程),执行后 **reflection 复查精炼**再生成答案(摘要/表/图,Vega-Lite 图表类型,趋势比较出图、明细查找出表);附加形态有 Deep Research(拆解子调查并行执行、合成带溯源引用的报告)、Verified Answers(数据团队添加受信回答)、Artifacts(持久化图表)、Automations(定时重跑问题并邮件结果)([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-intelligence))。

### 3.4 信任与成长

- **信任分层**:verified query 命中(confidence 回显,带 verified_by/verified_at 人名与时间)→ 普通生成;Intelligence 层再叠 Verified Answers 与全链路溯源(每个论断可回溯到源数据与查询)([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-intelligence))。
- **成长回路**:① **Verified Query Suggestions**——Snowsight 界面基于用户行为建议新的 verified query 候选,人工确认后入库([VQR docs](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository));② 开源 semantic-model-generator 应用支持「提问→生成 SQL→人工验证→Save as verified query」的沉淀流(同上);③ **Evaluations**——把 VQR 当金标准回归测试语义视图,「识别改进点、追踪退化、迭代语义视图」([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst))。验证集与评测集在 Snowflake 是**同一份资产的两种用途**——与 MetricCanvas ADR-0037「评测集与黄金问题集是同一批资产的两种用途」完全同构。

---

## 4. 横向对照:dbt MetricFlow 与 ThoughtSpot Spotter

### 4.1 dbt MetricFlow(指标定义图与编译)

MetricFlow 是 dbt Semantic Layer 的编译引擎:YAML 声明 **semantic models**(语义模型,三要素:**entities**——join 键即图的边、**dimensions**、**measures**)与 **metrics**,二者构成 **semantic graph(语义图)**;查询指标时引擎在图上找最优 join 路径生成 SQL,「捕获的不是任意 join 逻辑而是键的类型」,从结构上避免 fan-out/chasm join([about-metricflow](https://docs.getdbt.com/docs/build/about-metricflow))。指标是**封闭类型系统**:simple / ratio(分子分母)/ derived(指标表达式运算)/ cumulative(窗口累计)/ conversion(转化),各带专属参数(如 simple 的 `non_additive_dimension`、cumulative 的 `window`)([metrics-overview](https://docs.getdbt.com/docs/build/metrics-overview))。

**对照差异点**:MetricFlow 没有问答层、没有验证答案、没有成长回路——它证明的是另一件事:**指标语义(含派生、半可加、窗口)可以完全声明化并由编译器确定性展开**。三家 Chat-BI 的语义层(UC metric views、Semantic Views)实质是把 MetricFlow 开创的这套抽象搬进各自平台再喂给 LLM。对 MetricCanvas 的镜鉴:派生度量模板做成封闭类型集(PRD #85 S2 的环比/同比/占比)在行业里有成熟同款。

### 4.2 ThoughtSpot Spotter(搜索式 BI 的 token 理念)

Spotter 的立场与三家相反:「**LLM 擅长翻译,不擅长 SQL 生成**」。LLM 只负责把自然语言**翻译**为 ThoughtSpot 关系搜索引擎的 **search tokens**(从数据推导的封闭词表);token 到 SQL 由确定性引擎完成——官方表述「**只要 token 正确,SQL 100% 准确**」([官方博客](https://www.thoughtspot.com/blog/introducing-spotter-ai-analyst))。每个答案都展示其 query tokens,**token 可悬停看计算方式、可点击改**(sum→average、换列、rolling→fixed 日期),追问时高亮 token 变更;`@` 快捷键可在提问时直接引用真实列名与列值,混合自然语言与确定性输入;每次「自然语言→token」的翻译映射存档供管理员审核([docs](https://docs.thoughtspot.com/cloud/26.6.0.cl/spotter-getting-started))。

**对照差异点**:三家的信任机制放在「答案级」(verified 标记、confidence),Spotter 把信任下沉到「**表达式级**」——中间表示本身可视、可核对、可编辑,错误可以在 token 粒度纠正而不必整轮重问。这与 MetricCanvas 口径卡「首先是一次消歧,其次才是一次确认」的取向一致,且提示了口径卡的进化方向:口径卡上的每个要素(指标、时间、筛选)都应当是可单独点改的「token」,而非整卡接受/拒绝。

---

## 5. 跨产品综合分析

### 5.1 概念对照表

各家对同一件事的命名与切分,末列为 MetricCanvas 现有词汇(`CONTEXT.md`)。**注意区分**:MetricCanvas 的「数据上下文快照」是创作期发现面(含 Schema 元数据+指标条目+已验证查询),不等于任何一家的「语义模型」——最接近的对应物是「语义模型 + VQR + 词典」的打包快照。

| 概念 | Databricks | SuperSonic | Snowflake | dbt MetricFlow | ThoughtSpot | MetricCanvas |
|---|---|---|---|---|---|---|
| 语义模型容器 | UC Metric View(YAML/SQL 对象)+ Genie Agent 局部知识库 | 主题域→数据模型→数据集 | Semantic View(schema 对象)| semantic model + semantic graph | Model/Worksheet | 数据上下文快照(语义面) |
| 指标 | measure(+window measure)| 指标 Metric | metric(表级/派生)+ fact(行级原料)| metric(5 封闭类型)| formula/measure | 指标条目 |
| 维度 | field/dimension | 维度 Dimension | dimension + time_dimension | dimension + entity | attribute | 指标条目的可用维度;结果字段契约的维度字段 |
| 同义词 | synonyms(agent metadata,≤10/字段)+ 列同义词 | 别名 + HanLP 词典 | synonyms(模型内唯一)| — | token 别名/训练 | 指标条目别名 |
| 维度值匹配 | entity matching(≤120 列×1024 值)| 词典 DimValue + 向量 | cortex_search_service 挂接检索 | — | token 词表 | 筛选候选值端口(用途不同:呈现而非解析) |
| 业务组织 | UC Domains | 主题域 Domain | —(多语义模型自动路由)| — | — | 业务域 |
| 验证答案 | trusted assets → verified answer 标记 | 双评审通过的 ChatMemory(exemplar)| VQR verified query + confidence 回显;Intelligence Verified Answers | — | 存档的 token 映射(管理员核验)| 已验证查询 |
| 评测集 | benchmarks(≤500 题,SQL Answer 金标准)| benchmark/evaluation 模块 | Evaluations(以 VQR 为金标准)| — | — | 黄金问题集(ADR-0037) |
| 知识抽取 | Genie Ontology + knowledge mining + query suggestions | Knowledge Base 周期抽取词典/索引 | verified query suggestions | — | 使用行为训练 | 缺口→别名治理出口(PRD #85 S4,人工采纳) |
| 澄清 | —(事后 Fix it)| needFeedback 多候选阻塞选择 | question_categorization 声明 UNCLEAR 追问 | — | token 点击编辑 | 口径卡条件阻塞消歧 |
| 拒答 | —(未见文档化)| MAPPING/PARSING 双失败出口 | question_categorization 声明拒答面 | — | 语义模型外不可表达 | 缺口条目登记(指标需求条目) |
| 临时口径 | SQL expressions 之外的自由生成(无标记)| LLM 自由生成 S2SQL(修正链兜底)| 语义模型外拒答或生成(无显式标记)| 不存在(全声明)| 不存在(token 封闭)| 临时口径(琥珀标注+显式接受) |
| 信任标记 | UC certified 治理标签 | 上线状态/权限 | verified_by/verified_at | — | verified 数据构造 | 人工背书、发布修订 |

两点评注:

- **MetricCanvas 的「临时口径」在竞品中没有直接等价物**。Databricks/Snowflake 对「语义层外的生成」不做视觉区分(要么答要么拒),SuperSonic 靠修正链兜底也不标注。「模型现场发明的口径必须视觉可区分、沉淀须显式接受无人负责」是 MetricCanvas 独有且更严格的设计,值得保持。
- **「fact(行级原料)与 metric(聚合结果)分离」**(Snowflake)与「measure 语义元数据挂在语义层」(Databricks)都印证了 MetricCanvas 把「指标条目(发现)」与「结果字段契约的度量字段(执行产物)」分为两层的正确性——竞品也没有让发现层概念直接进执行协议。

### 5.2 一次问答的状态流转对比

以 MetricCanvas ADR-0037 的编排(域路由→检索→消歧→口径成形→清单校验→执行→意图与组件→呈现)为基线对齐:

| 阶段 | Databricks Genie | SuperSonic | Snowflake Cortex Analyst | MetricCanvas(ADR-0037) |
|---|---|---|---|---|
| 域/范围路由 | Agent 即范围(人先选 Agent);Genie One 跨 Agent 自动 | Agent 圈数据集;逐数据集解析后仲裁 | 多语义模型静默自动路由 | 模型分类,**回显可改** |
| 检索/映射 | entity matching + 知识库检索 | MAPPING(词典+向量+术语),**失败出口①** | VQR 相似检索 + cortex search 维度值 | 混合检索返回排序候选 |
| 消歧/澄清 | 无执行前消歧 | needFeedback:多候选**阻塞用户选择**(可配置) | UNCLEAR→追问(声明在语义模型) | 口径卡并列 top-k,**条件阻塞** |
| 口径成形 | LLM 生成 SQL(trusted asset 命中则模板填参) | PARSING(规则先行→LLM 自一致投票),**失败出口②**;修正链 | SQL 生成(模型组合)+ sql_generation 指令 | 口径成形(闭集+formula 留痕) |
| 校验 | —(执行即校验) | S2SQL/物理 SQL 修正链 + 语义层翻译校验 | —(执行由调用方) | 清单校验 |
| 执行 | 平台执行(作者计算凭据+用户数据凭据) | execute 段(与 parse 分离,**天然人工确认点**) | 调用方执行(RBAC) | 真实执行 |
| 呈现 | NL 答案+表格+条件出图;verified 标记 | 结果+processor 增强(解读/推荐/比率) | interpretation+SQL+confidence;图表在 Intelligence 层 | 意图判定→组件选择(意图回显可钉住) |
| 事后纠错 | Yes/Fix it(带反馈重生成)/Request review;编辑 SQL 回存 | 用户改选候选重执行;记忆沉淀待评审 | 多轮追问(改写);无内置反馈环 | 探索定向增量 patch |

结构性观察:

1. **「解析与执行分离」是仅有 SuperSonic 与 MetricCanvas 做成 API/编排结构的设计**。Databricks 选择流畅优先(从不阻塞,信任放到 verified 标记与事后反馈),Snowflake 把这个决定外包给集成方。ADR-0037 的「条件阻塞」介于 SuperSonic(可配置全阻塞)与 Databricks(从不阻塞)之间,且触发条件(歧义/自由 formula/临时口径/模型补全时间/成本)比两者都精细——这是差异化优势,不是负担。
2. **失败出口的粒度**:SuperSonic 两个失败出口只区分「映射不到」与「解析不出」;MetricCanvas 的缺口条目(含最接近候选与口径差异、期望维度粒度、出现次数)比三家任何一家的失败记录都更结构化。三家中只有 Databricks 的 Monitor 有类似「失败问题→改进建议」的闭环,但靠 Genie Code 的 LLM 分析而非结构化落库。
3. **多轮修改**:Snowflake 与 SuperSonic 都用「历史改写为自包含问题」策略,且 Snowflake 文档如实声明其缺陷(拿不到上轮结果数据、长对话漂移)。ADR-0037 的「定向增量 patch,未提及的显式设置不变」比问题改写更强——改写策略在意图漂移时整轮重建,patch 策略结构性防漂移。
4. **意图与组件**:只有 MetricCanvas 把「分析意图判定」独立成显式可回显可钉住的阶段;Databricks 是黑盒(「Genie 判定可视化有增益时出图」),Snowflake Intelligence 靠 agent instructions 定制图表偏好。

### 5.3 信任分层对比

各家如何区分「认证的答案」与「生成的答案」,以及人工确认点位置:

| | 认证层 | 生成层标注 | 人工确认点 |
|---|---|---|---|
| Databricks | UC certified 标签(资产/Agent 级)→ trusted assets(参数化查询+SQL 函数)命中出 **verified answer** 标记 | 非 verified 即普通生成,无置信度暴露 | 执行后:Request review 转编辑者;编辑者修 SQL 回存 |
| SuperSonic | 双评审通过的记忆才影响生成;规则解析器结果优先于 LLM | 自一致性投票是内部置信,不呈现给最终用户 | 执行前:多候选阻塞选择(可配置) |
| Snowflake | VQR(verified_by 人名+verified_at 时间戳)命中→confidence 回显;Intelligence Verified Answers | interpretation 文本呈现系统理解 | 生成前:UNCLEAR 追问/拒答;生成后:调用方决定是否呈现 SQL |
| ThoughtSpot | verified token 映射存档 | token 全量可视,无「生成/认证」二分 | 全程:token 随时可点改 |
| MetricCanvas | 已验证查询(人工背书)+指标条目(公司口径) | **临时口径琥珀标注**,沉淀须显式接受 | 执行前:口径卡条件阻塞;发布:人工确认发布 |

观点:**「verified 标记 + 命中回显」是当前行业信任呈现的最大公约数**(Databricks、Snowflake 均有,形式不同)。MetricCanvas 口径卡已呈现完整生效范围,但尚无「本答案参照了哪条已验证查询」的回显——Snowflake 的 confidence 字段证明这个信息对信任感有独立价值,实现成本低(检索阶段本就知道命中了什么)。

### 5.4 成长回路对比

| 回路 | Databricks | SuperSonic | Snowflake | 自动化程度与治理边界 |
|---|---|---|---|---|
| 用户反馈→资产 | 反馈**明文不自动改行为**;编辑者手动 Add as instruction/benchmark | 记忆→LLM 评审+人工评审→exemplar | 无内置端到端反馈环(API 产品) | 三家均为「建议→人工接受」,无静默写回 |
| 系统主动挖掘 | knowledge mining(建议 SQL expressions/joins)、query suggestions(工作区历史查询)、Genie Code 分析使用与评测 | Knowledge Base 周期重建词典/索引 | Verified Query Suggestions(基于用户行为) | Databricks 挖掘面最广,但落点仍是人工 Accept/Reject |
| 评测回归 | benchmarks:多措辞、结果集比对判分、评测历史留存、Update ground truth | benchmark/evaluation 模块(文档薄弱) | Evaluations 以 VQR 为金标准 | Snowflake 验证集=评测集;Databricks 分开但可互转 |
| 全自动学习 | Genie Ontology 自动抽取+OntoRank 权威度(preview,见 §6) | 指标使用次数进排序仲裁 | — | 仅 Databricks 押注全自动;其权威度信号里 certified(人工)权重仍在 |

观点:**行业共识是「自动化在建议侧,人工在采纳侧」**。Databricks 把「反馈不改行为」写成文档,SuperSonic 给记忆上双评审,Snowflake 的 suggestions 都要人点确认——这与 MetricCanvas PRD #85「采纳后人工修改数据上下文声明,不做自动写回」的决策完全一致,可以放心不追 Genie Ontology 式的全自动知识图谱(它的前提是 Databricks 掌握全企业的查询/dashboard/pipeline 行为流,MetricCanvas 没有这个数据面)。

### 5.5 对 MetricCanvas 的设计启示清单

对问数增强批次(PRD #85:S1 结构化相对时间 / S2 派生度量模板 / S3 消歧预选 / S4 缺口别名出口)与整体概念模型的具体启示,每条注明来源机制:

**支持既有决策的证据(可直接引用增强论证):**

1. **S2 派生度量声明进语义层是行业共识**——Databricks window measures 用 `offset: -12 month` 声明同比、`range: trailing/cumulative` 声明滚动累计、窗口参数可查询期传入([YAML 参考](https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference));dbt 把 ratio/derived/cumulative 做成封闭指标类型([metrics-overview](https://docs.getdbt.com/docs/build/metrics-overview))。「模板×闭集指标=派生指标,声明在数据上下文层」与两者同构,且都印证了「公式是业务通则不该由模型现场发明」。
2. **S2 的可加性联动校验有先例**——dbt simple metric 的 `non_additive_dimension` 与 Snowflake metric 的半可加声明(non-additive dimension + first/last)([spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec))都把「哪些维度上不可加」放在指标声明里;MetricCanvas 指标条目的可加性字段已具备,派生模板校验时消费它即可,不需要新概念。
3. **S3「预选但永远阻塞确认」比行业更严格,应保持**——SuperSonic 的 needFeedback 是同款交互(多候选阻塞用户选),但它的排序仲裁用的是**全局**指标使用次数([SemanticParseInfo 比较器](https://github.com/tencentmusic/supersonic/blob/master/headless/api/src/main/java/com/tencent/supersonic/headless/api/pojo/SemanticParseInfo.java));PRD #85 按 actor 记忆是更细的粒度,且「预选不替选」守住了 SuperSonic 靠配置开关才能保证的红线。
4. **S4「人工采纳别名」与三家一致**——Databricks knowledge mining、Snowflake verified query suggestions 全部是「系统建议→人工 Accept」;没有一家自动写回语义层(§5.4)。
5. **「反馈不自动改变行为」可作为对外表述的行业背书**——Databricks 文档原文「Your Genie Agent's behavior does not change based on user feedback alone」([docs](https://docs.databricks.com/aws/en/genie/benchmarks))。

**可吸收的具体机制(建议评估):**

6. **黄金问题集的判分规则**(来源:Databricks benchmarks):结果集比对而非 SQL 文本比对;同数据不同排序=对;数值 4 位有效数字内=对;**多出列=错**;空结果/报错=错;无金标准的题强制人工判分([docs](https://docs.databricks.com/aws/en/genie/benchmarks))。ADR-0037 已定「可接受的替代答案」,这套具体判分规则可直接充实其实现;「Update ground truth」(把更好的响应升格为新金标准)可作为评测集版本化的运营动作。
7. **同一问题多措辞入评测集**(来源:Databricks):官方建议每个问题写 2–4 种措辞、共享同一 SQL 金标准([docs](https://docs.databricks.com/aws/en/genie/benchmarks))——ADR-0037 的 30–50 条样本配额可按此展开,同时测检索鲁棒性与别名覆盖。
8. **口径卡回显命中的已验证查询**(来源:Snowflake confidence 字段):答案参照了哪条 verified query 应呈现给用户([VQR docs](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository))。MetricCanvas 检索阶段已知命中信息,口径卡加一行「口径参照:已验证查询 X(背书人/时间)」成本低、信任增益明确。
9. **拒答面与澄清条件声明化**(来源:Snowflake question_categorization):把「哪些问题该追问、哪些该拒答」写进数据上下文层而非代码([custom instructions](https://docs.snowflake.com/en/user-guide/views-semantic/custom-instructions))。S1 的「词表外表述如实拒答」已是同思路;可推广为:业务域声明其拒答面(如「不回答个人薪酬」),与口径卡触发条件同层治理。
10. **别名治理约束**(来源:Databricks agent metadata):每字段同义词≤10 个、每个≤255 字符、模型内唯一([docs](https://docs.databricks.com/aws/en/metric-views/data-modeling/semantic-metadata);Snowflake 要求同义词全模型唯一,[spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec))。S4 采纳别名时应设同款硬上限与唯一性校验,防止别名膨胀反噬检索精度。
11. **验证集与评测集合一运营**(来源:Snowflake Evaluations):已验证查询天然是回归金标准([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst));ADR-0037 已声明「同一批资产两种用途」,Snowflake 证明这条路运营得通,应在已验证查询数量成规模后把评测直接建在其上,避免两套资产。
12. **口径卡要素 token 化**(来源:ThoughtSpot):口径卡上的指标、时间、筛选各要素做成可单独点改的对象(sum→avg、rolling→fixed 一类微调),错误在要素粒度纠正,不必整轮重问([docs](https://docs.thoughtspot.com/cloud/26.6.0.cl/spotter-getting-started))。这是探索(定向增量 patch)的 UI 对应物,方向一致、可渐进。
13. **失败题→改进建议的运营闭环**(来源:Databricks Monitor/Analyze Usage):按周聚合失败与差评问答,生成「常见主题+建议补充的上下文」([docs](https://docs.databricks.com/aws/en/genie/benchmarks))。MetricCanvas 的分析会话已结构化落库每步失败分类——S4 的缺口台账之上,可再加一层按周聚合的运营视图,这比 Databricks 的 LLM 分析更确定。

**明确不追的方向(附理由):**

14. **不追 Genie Ontology 式全自动知识图谱**:其有效性依赖全企业查询/dashboard/pipeline 行为流做 OntoRank 信号([官方博客](https://www.databricks.com/blog/introducing-genie-one-genie-ontology-and-genie-agents)),MetricCanvas 无此数据面;PRD #85 的对标结论(「不追知识图谱与多源权威度」)成立。
15. **不做静默域路由**:Snowflake 多语义模型自动路由是静默的([docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)),但 ADR-0037 已论证静默路由错域产出「看起来完全正常的错数」;跨域指标重名场景下回显可改仍是更优解。
16. **不把信任仅寄托在执行后反馈**:Databricks 的「从不阻塞+事后反馈」依赖其用户基数与编辑者运营投入;MetricCanvas 的条件阻塞口径卡在冷启动期(无反馈数据)是更稳的信任来源。

---

## 6. 未证实与资料不足

| 事项 | 状态 |
|---|---|
| Genie Ontology 的发布状态(preview)与 DAIS 具体日期(2026-06-16) | 来自二手来源(Atlan、ITdaily);官方博客未标注日期与发布阶段。**未证实** |
| OntoRank 的算法细节(信号权重、图结构) | 官方博客仅列信号类别;Ken Wong 的补充说明出自 ITdaily 采访,二手。**仅线索** |
| Genie「84.5% vs 52.4%」基准 | 官方内部基准(28 题),口径不可外部复核,引用时应标注为厂商自测 |
| Databricks Genie 是否有执行前澄清/反问机制 | 文档未见;不能断言「没有」,只能说未文档化 |
| SuperSonic 官方文档站 supersonicbi.github.io | 调研时 404,不可达;建模概念的层级关系由源码 REST 面与 POJO 重建,「主题域/标签模式」的历史术语沿革无法从官方文档核对。**资料不足** |
| SuperSonic benchmark/evaluation 模块的具体评测方法 | 仓库有目录但无文档,未深入源码。**资料不足** |
| Snowflake Semantic Views 的 GA 状态 | 文档无 preview 标记、已进 Marketplace 共享,推断 GA;未找到明确 GA 公告页。**推断,未证实** |
| Snowflake「Horizon Context / Cortex Sense」(ITdaily 提及,先于 Databricks 两周发布) | 未在 docs.snowflake.com 找到对应文档。**未证实,仅线索** |
| Snowflake Intelligence 的发布阶段 | 文档完整、含 iOS 应用,未见 preview 标记;具体 GA 时点未证实 |
| ThoughtSpot BARQ 推理层内部机制 | 仅培训课程简介提及组件名(RAG/BARQ/PromptIQ/AI Trust Layer),无技术细节。**资料不足** |

## 附:主要来源清单

**Databricks**:[Genie 总览](https://docs.databricks.com/aws/en/genie/) · [创建与管理 Genie Agent(原 Spaces)](https://docs.databricks.com/aws/en/genie/trusted-assets) · [调优质量(instructions/trusted assets/knowledge store)](https://docs.databricks.com/aws/en/genie/knowledge-store) · [测试监控与 Benchmarks](https://docs.databricks.com/aws/en/genie/benchmarks) · [UC Semantics](https://docs.databricks.com/aws/en/uc-semantics/) · [Metric Views 概述](https://docs.databricks.com/aws/en/uc-semantics/metric-views/) · [建模](https://docs.databricks.com/aws/en/uc-semantics/metric-views/basic-modeling) · [YAML 参考](https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference) · [Agent metadata](https://docs.databricks.com/aws/en/metric-views/data-modeling/semantic-metadata) · [Genie One/Ontology/Agents 发布博客](https://www.databricks.com/blog/introducing-genie-one-genie-ontology-and-genie-agents) · [Unified context 博客](https://www.databricks.com/blog/unified-context-missing-layer-enterprise-ai-coworkers)

**SuperSonic**:[README](https://github.com/tencentmusic/supersonic) · [CLAUDE.md](https://github.com/tencentmusic/supersonic/blob/master/CLAUDE.md) · 源码:[ChatWorkflowState](https://github.com/tencentmusic/supersonic/blob/master/headless/api/src/main/java/com/tencent/supersonic/headless/api/pojo/enums/ChatWorkflowState.java) / [ChatWorkflowEngine](https://github.com/tencentmusic/supersonic/blob/master/headless/server/src/main/java/com/tencent/supersonic/headless/server/utils/ChatWorkflowEngine.java) / [NL2SQLParser](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/parser/NL2SQLParser.java) / [ParseContext](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/ParseContext.java) / [SemanticParseInfo](https://github.com/tencentmusic/supersonic/blob/master/headless/api/src/main/java/com/tencent/supersonic/headless/api/pojo/SemanticParseInfo.java) / [OnePassSCSqlGenStrategy](https://github.com/tencentmusic/supersonic/blob/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/parser/llm/OnePassSCSqlGenStrategy.java) / [MemoryReviewTask](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/memory/MemoryReviewTask.java) / [Agent](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/agent/Agent.java) / [ChatQueryController](https://github.com/tencentmusic/supersonic/blob/master/chat/server/src/main/java/com/tencent/supersonic/chat/server/rest/ChatQueryController.java) / [mapper 包](https://github.com/tencentmusic/supersonic/tree/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/mapper) / [corrector 包](https://github.com/tencentmusic/supersonic/tree/master/headless/chat/src/main/java/com/tencent/supersonic/headless/chat/corrector) / [headless REST 面](https://github.com/tencentmusic/supersonic/tree/master/headless/server/src/main/java/com/tencent/supersonic/headless/server/rest)

**Snowflake**:[Cortex Analyst](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst) · [Semantic Views 概述](https://docs.snowflake.com/en/user-guide/views-semantic/overview) · [YAML 规范](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec) · [VQR](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository) · [Custom instructions](https://docs.snowflake.com/en/user-guide/views-semantic/custom-instructions) · [Snowflake Intelligence](https://docs.snowflake.com/en/user-guide/snowflake-cortex/snowflake-intelligence)

**横向**:[dbt About MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow) · [dbt Metrics overview](https://docs.getdbt.com/docs/build/metrics-overview) · [ThoughtSpot Spotter 发布博客](https://www.thoughtspot.com/blog/introducing-spotter-ai-analyst) · [Spotter Getting started](https://docs.thoughtspot.com/cloud/26.6.0.cl/spotter-getting-started)

**MetricCanvas 内部对照**:`CONTEXT.md`(词汇表)· `docs/adr/0037-ask-orchestration-and-interaction-contract.md`(问数编排)· [PRD #85](https://github.com/CCharlesMeng/MetricCanvas/issues/85)(问数增强批次)

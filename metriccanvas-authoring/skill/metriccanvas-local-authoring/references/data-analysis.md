# 页面用数与查询数据源

新增口径、指标匹配或查询修改时使用本页。输入为页面 JSON、相关指标说明或数据契约；已有可信字段绑定的局部修改直接编辑，不要求完整分析报告。指标表不等于页面数据源，物理字段名不等于 DQE 标识。

## 先定范围与执行条件

沿用用户已明确的真实数据或演示意图。编写查询前核对项目已提供的可信数据上下文、已验证查询及执行入口；无入口时交未执行候选和缺口，原目标页保持不变，不自动改为 inline 或扩大环境排障。补字段保留布局，修改共享页面数据源时核对其全部消费者及依赖。

## 中文业务标识

生成 DQE 查询时，指标名、维度名、筛选目标和结果字段映射默认使用数据上下文确认的中文业务标识。不得直接用物理表英文字段名替代 DQE 标识；中文名称本身也不证明它是合法标识，仍须核对可信数据契约与执行结果。

queryField 必须对应真实输出字段，中文映射须有可信输出契约或真实响应证据。数据源仅提供英文标识或返回英文键时，报告缺口并请用户确认例外；已有有效确认可沿用。不自行翻译标识、改名实际返回键或伪造映射。普通指标的 output_metrics 保持真实 DQE 支持的名称字符串形状，不编造 alias 语法。

本节是查询创作默认规范，不是页面 Schema 的英文禁令；合法的已有英文查询不因此被拒绝或擅自改写。页面稳定字段 id、协议属性名，以及 china、oversea、europe 等真实编码值不受中文规则影响。

## 精确读取

命令只读输入、输出 JSON。局部任务可重复指定组件 id：

```sh
node "<skill-dir>/scripts/analyze-data.mjs" scan --page page.json --component table-a --component table-b
```

局部 scan 返回所选组件摘要、相关用数位置与页面数据源，不打印 inline/initial 行；按返回的 path 从原页提取待改对象。范围包含子组件及父级用数、共享源消费者和页面数据源依赖闭包；全局 filters、params 与诊断仍保留。省略 --component 扫描全页。该选项仅属于 scan，draft/check/prepare 仍按完整页面覆盖。

短 MD 可直接读原文；长文先按字段标签、id、queryField 和组件上下文检索，未命中再查别名或相关章节。需要章节定位时用 index：

```sh
node "<skill-dir>/scripts/analyze-data.mjs" find --md metrics.md --search 闭环率 --search close_rate --limit 5
node "<skill-dir>/scripts/analyze-data.mjs" index --md metrics.md
```

find 返回字面命中的原文块、行号和未展示命中数。名称检索不是语义匹配；只查过部分不能宣称全文没有指标。需要全页匹配时直接运行 draft，它已包含页面扫描与 MD 分块，无需先重复 scan/index。

核对本次所需的口径、单位、比率刻度、行粒度、时间聚合、维度、查询标识及筛选/参数绑定。事实标来源，建议与未知分开；比率核对分子分母和零分母规则，连接核对键与基数。缺口按共同原因合并，仅追问阻碍本次修改的信息。

## 需要完整报告时

全页接数、批量指标匹配或需机器检查证据覆盖时，使用完整报告：

```sh
node "<skill-dir>/scripts/analyze-data.mjs" draft --page page.json --md metrics.md
node "<skill-dir>/scripts/analyze-data.mjs" check --page page.json --md metrics.md --report page-data-analysis.json
```

以 draft 输出编辑分析 JSON，保留 use 与输入身份。matching 为 unresolved/matched/ambiguous/not-found/conflict；execution 保持 not-run。matched 提供 metricName、reason 与 evidence：`{from:起始行,to:结束行,quote:"原文片段"}`。未解决条目引用 gaps 中的问题 id，问题 paths 覆盖所有影响位置。Markdown 摘要仅在用户审阅或解释缺口时另写。

check 核对输入哈希、全页位置覆盖、状态、原文证据和问题引用，不判定业务解释正确。材料改变后重新分析，不能删掉未解决位置制造覆盖率。退出码 0/1/2 为通过/报告或候选错误/调用或文件错误。

## 多源与增量修改

合并页面增量时，对照查询定义、结果字段和全部组件消费者，保留已验证的动态主行集、初值及快照修复。多槽表格先核对 main 行粒度、rowKey 与关联键，用乱序、缺行、零值和空键验证对齐；辅助查询失败时检查整表真实表现。queryModes 的 case 名称不证明业务范围不同，须比较查询体、绑定与实际请求。

多图独立切换时，列出“控件 → filterId → 查询数据源”对应关系；独立状态使用独立 filterId，每个 filterGroup 的查询消费方显式绑定。沿用可信 queryField 与真实编码值，以逐图请求和 URL 恢复确认隔离，不把展示标签当成查询值。

输入与校验器版本不匹配时，先查 --version，再用最小合法页核对实际运行时及随包 Schema 的能力；相同版本号也可能来自不同开发分发。联合 Schema 的 data、all、any 等级联报错应先定位最上游不支持的声明，不按每条候选分支错误删除合法配置或降低版本放行。

## 查询候选与验真

可信 DQE 映射与取数条件充分时，按所涉协议主题形成候选。已有完整报告且需替换原有页面数据源时，可用 prepare：

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic data.query --topic query.core --topic fields.core
node "<skill-dir>/scripts/analyze-data.mjs" prepare --page page.json --md metrics.md --report page-data-analysis.json --proposals proposals.json
```

proposals 的键为原有页面数据源 id，值为完整声明；该源所有用数条目须 matched 且 missing 为空。prepare 只接受 query 候选，每个 queryField 须出现在该字段引用的 MD 证据内。它在内存替换拟改源并运行产品页面校验，不写页面，execution 仍为 not-run；新增源/组件走普通页面创作流程。

通过已有执行入口验证候选，保留真实请求/响应，核对条件、字段、粒度与完整性后写回 source、fields、queryField 和绑定。initial 只采用匹配查询及初始条件的真实结果。共享查询仍须满足指标、维度、时间、条件及消费者限制，分页独占、pagedJoin/pagedUnion 约束继续适用。

最后按[本地验收](local-workflow.md)快照、完整校验并预览所涉交互。缺环境时说明哪些证据未取得，保留必要候选即可；报告和候选是创作期工作产物，不进入页面协议或 Skill 安装包。语义分析较复杂且可独立拆分时，按需读[分析委派](data-delegation.md)。

## 记录关联预算与期间筛选

遇到“记录关联超过行数预算”时，若已声明records.maxRows，先比较实际响应total_count与该值；6.69起可省略maxRows以取消行数限制，既有显式值仍生效；limit仅限制单批大小。核对实际运行文档，而非仅看本地同名文件。records.timeFilters在完整读取后本地筛选，缩短它的期间不能降低读取预算。

已确认时间字段可用于DQE维度范围时，6.68起在主表query.filterBindings声明target:time、queryField与valueFormat，移除同一筛选的本地timeFilters；补列表若不适用该期间，使用成员notApplicableFilters。检查实际请求出现指定时间字段的>=和<=，响应总数已按期间缩小。需要本地筛选的场景保持原声明；用户明确要求取消行数上限时，在6.69及以上页面移除records.maxRows，同步运行时和校验器，不填写Infinity或巨大占位数。保留maxBytes和timeoutMs；省略行数限制仍需完整读取、补列和全局处理，字节或超时失败不等于行数限制仍存在。不能截断行或删除记录模式来伪造成功。字段可输出、Sim和静态校验均不能替代真实服务谓词及总数验真。


共享网关会将合法紧凑年月规范为YYYY-MM；若DQE Sim返回DQE_SIM_UNSUPPORTED_QUERY，先比较网关实际请求与仿真夹具接受的等价时间格式，再判断业务字段或引擎错误。原始JSON中的紧凑值与实际请求不同不等于期间口径改变；不为迎合过期夹具修改业务查询。仿真通过仍不能代替真实服务验真。

# 具名算子

compute按声明顺序处理归一化行集。ratio逐行相除，零/缺分母按null或zero处理，缺分子取空；scale缺省原比率，100将其变成百分刻度。delta做减法，任一输入空则空。

groupSubtotal在每组明细后插小计；grandTotal只累计明细、不重复累计小计；两者只使用collapsible:true度量。rowKind字段是可空string维度，subtotal/total标记汇总行。pivot按有序类别列表匹配首个类别，把行转列。

所有产出字段必须就地声明，不能伪装成原始输入或queryField。这是封闭算子系统，显示格式、任意公式及通用脚本均不是算子。

<a id="conditional-compute-demand"></a>

## 条件显隐与按需关联计算

表格列和柱图／折线图系列的 `visibleWhen` 共同决定本轮需要的字段。引擎先合并执行范围内所有消费者的需求，再反向追踪 `joinAggregate` 的输出、关联键与上游字段。仅当某个关联值没有任何消费者时才裁剪该值；关联的所有值均无消费者时，不执行该关联及其独占依赖。页面保存的查询、完整结果字段契约、具名算子和筛选声明保持不变，不新增 `allowPartial` 或其他配置，也不要求升级旧页面版本。

查询业务条件、查询结果绑定、排序、筛选、动作、快照详情及其他计算使用的字段必须保留。非 `joinAggregate` 算子先保守保留其执行与输入，不能因隐藏度量改变 `unionKeys` 等算子决定的业务行域。无法确定字段消费范围的组件保留完整来源；共享消费者仍需要某个隐藏字段时，该关联继续执行。`keys:[]` 的全局均值等可见基线照常取数。

`periodPolicy.kind:"selection"` 继续严格拒绝不支持的期间。以月、季、年分别提供变化值的三个关联为例，月份只展示月变化且无其他消费者时，季、年关联不进入本轮依赖图，因此不发请求，也不影响主源；若另一个消费者仍需要季变化，则其期间拒绝仍传播为主源错误。网络、权限、结果契约、完整性及真实计算失败均保持诊断；`DQE_QUERY_REJECTED` 不作为空结果处理。

活动 Tab、当前查询视图和已应用条件共同确定屏幕需求；切换后取消失去全部消费者的请求，迟到响应不能覆盖当前结果。单次页面执行采用默认活动 Tab；完整报告导出沿用其既有全部 Tab 范围，单表 Excel 仅消费该表的冻结声明。屏幕、查询捕获、初始快照、计算及导出使用同一投影规则，不能持久化裁剪后的不完整 initial；初始查询预检拒绝产生数据源错误态，不直接中断页面初始化。

合成验收入口 `/pages/conditional-compute-demand`：IOC 页头切换月／季／年后，柱线图和共享表格保留当前值、全局均值及对应变化字段，每组只请求一个变化源；Excel 冻结当前期间并保留相同字段。共享需求、后续计算、查询视图、取消及错误传播由运行时回归补充。数据由浏览器测试注入，不代表真实 DQE 验真。

<a id="独立单行指标关联683"></a>

## 独立单行指标关联（6.83）

`joinAggregate.keys: []` 显式把完整依赖源的单行度量用于全部现有主行。只允许 `aggregate: "unique"`：整体均值、目标值等指标由查询提供，不在前端求和或平均。主行身份、顺序与 totalCount 保持，空主行集不制造类别。

```json
{"op":"joinAggregate","source":"global-average","keys":[],"values":[{"field":"average","output":"average","aggregate":"unique"}],"onMissing":"null"}
```

依赖只能返回零行或一行；多行（即使值相同）失败。空行集按既有逐度量 onMissing 规则取空，已返回 null 保持空，真实零值保留；失败、截断及 totalCount 与返回行数不一致不能作为单值使用，显示兼容的零总数也不适用于无键关联依赖。字段类型、单位、币种、依赖环和完整结果约束沿用键关联。6.82及以下不得使用空键关联，省略 keys 仍非法，既有非空键语义保持。

均值查询的范围由自身 filterBindings 明确决定。全局均值不绑定区域筛选；期间和站点可与代表处查询绑定同一筛选。依赖更新沿统一 SourceProgram 批次隔离、取消、完整读取和导出路径，不向页面行写固定常量、不添加假关联键。

完整合成场景 `/pages/chart-global-benchmark` 展示代表处实际值柱、同高全局均值柱及同环比折线；切地区部保留全局均值，切月份或站点同步更新。错误、空值、零值及重复行步骤见图表示例目录 README。

## 组织键并集（6.74）

完整声明见 `/pages/union-keys-demo`。以下 `scores` 是 `dataSources` 中的一项，`a`、`b` 是页面已声明的完整来源，各含相同类型、单位的 `org` 标量维度：

```json
{
  "fields": {"org":{"type":"string","role":"dimension"}},
  "source": {"type":"inline","rows":[]},
  "compute": [{"op":"unionKeys","sources":["a","b"],"keys":["org"]}]
}
```

`sources` 是非空、无重复的数据源 ID 数组，`keys` 是非空、无重复的同名页面维度字段数组，可组成组合键；均为显式引用，不猜测字段或组织名称。unionKeys 只能是空 inline 数据源的首个算子，产出只含键，键须在本源 fields 声明且不得带 queryField。其余字段可由后续 joinAggregate、sumFields 等产出。6.73 及以下不得使用。

按 sources 顺序及各来源行首次出现顺序生成唯一键并集；跨来源相同键合并，单来源重复键报错。键保持原始类型，数值0和布尔false有效；null、空/空白文本按下述空组织键兼容处理；非有限值、复杂值和已降级的异常维度仍报错。多个来源都空则无行，不制造组织。所有来源均无某组织时，并集不会产生该组织，需要完整组织目录时另行声明该目录来源。

查询依赖须 resultScope: complete，无分页窗口，不能使用 pagedJoin/pagedUnion 的窗口结果；使用同轮筛选条件。依赖未完成时等待，失败时传播错误。页面显示时，普通完整查询的 totalCount 为0且有返回行，可基于这些行继续执行 unionKeys、joinAggregate 与后续求和；原查询总数0保留，TOTAL_COUNT_MISMATCH 诊断仍标记 completeness: unverified。该兼容不证明服务已返回全部组织；非零总数矛盾、非法总数、查询窗口、重复或类型异常键及查询失败仍拒绝并集。严格完整读取不启用此显示兼容；对象完整导出和查询结果绑定仍检查完整性。依赖图不得成环，筛选改变及迟到回执沿统一运行时的批次隔离与取消规则处理。产出 totalCount 是本轮实际并集行数，不改写上游查询的业务总数。

随后用 joinAggregate 的 unique 关联补单项，缺行输出 null，再用 sumFields.onMissing: zero 算分类与总分。**单项保留 null 以显示 `--`，不能先把单项覆盖成0**；全缺项总分0，真实0及负分保留。查询数值空/空白字符串经归一化成为 null，不保留空文本展示回退。非空非法文本仍有告警和原文证据；字段属性省略是映射错误，不等于业务缺项。

页面试验场 `/pages/union-keys-demo` 用 inline 合成结果显示3个组织，单项缺失 `--`、真实0、全缺总分0及负数；`/pages/partner-health-union-null-probe` 为明确标注的查询响应 Mock，复用正式 partner-health 的11项查询及计算声明，验证1/10/13行形成15个组织。正式 `/pages/partner-health` 保持真实 DQE 网关。数据源计算产物可统一供表格、图表和导出消费，不改变表格默认主集合左对齐规则。

`/pages/partner-health-union-null-probe?state=zeroTotal` 将合成响应的 total_count 均设为0，地区部、代表处仍显示15个组织，顶部卡片按独立整体行计算。`empty`、`truncated`、`duplicate`、`error` 分别核对真实空结果、非零总数矛盾、重复键和查询失败。页面 JSON 无需新增开关或升级 Schema；只升级运行时即可应用兼容。

## 空组织键兼容

引擎统一处理 `unionKeys` 与 `joinAggregate` 的空组织键，无需新增页面字段、开关或升级 Schema。键中含 null、缺失属性或空/空白文本时，排除整行；组合键任一项为空即排除整行。`joinAggregate` 同时处理主集合与被关联来源。查询响应缺少映射的维度属性仍是字段契约错误，不会被计算阶段绕过。

只处理没有组织归属的记录，不把它们归入未知组织或有效组织，不补零。数值0、布尔false键及有效组织的零分、负分均保留。非空类型异常、带降级展示证据的异常键、并集单来源重复键、unique关联重复键、查询失败及非零总数矛盾仍失败；sum关联继续按原规则聚合重复键。

计算快照带 `COMPUTE_MISSING_KEY_ROWS` 告警，包含来源 ID、键字段 ID 与跳过数量，不包含业务值或原始行。同一来源同一键组在并集和关联中不重复累计；告警沿后续计算依赖传播，表格显示可用结果及异常说明，导出沿用异常说明工作表。全部行被排除时产生带告警的空态。上游查询行及 totalCount 不变，计算结果 totalCount 按剩余实际行数更新。

验收入口 `/pages/missing-organization-key` 使用已有6.74声明与 inline 合成数据：上表显示甲0、乙缺项、丙-2及跳过数量，下表验证全部组织键为空的空态与告警。正式伙伴健康度页保持原有完整真实查询与6.77声明，升级引擎即可兼容；不查询声音闭环率的版本仅用于排查，不作为正式完整得分。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 汇总的全空结果（6.12）

`groupSubtotal`和`grandTotal`可声明`allMissing: "null" | "zero"`。省略或null保持原行为：某项度量整组没有数值时输出null；zero仅将全部为null/缺失的汇总输出0，不改明细。无效非空输入不因此变成0；溢出仍为null。空行集不生成汇总，总计继续排除小计行。策略属于该次计算，不属于字段的全局缺失规则。6.11不能使用该声明。

## 多度量透视与有限主集合左关联 6.14

pivot.columns可指定valueField覆盖算子默认字段。同类别可用于不同度量，重复的有效valueField与类别组合拒绝；新多度量透视的分组键与类别必须唯一。缺阶段产出null，0保持0。有限主结果仅在被结果绑定引用且声明正整数limit、无offset/查询分页时允许左关联；辅助源仍须complete，无分页窗口。导出保持此选择范围并使用本轮原始结果重建明细输入。

## 字段求和与缺项归零（6.71）

`sumFields` 的 `fields` 是有序、不重复的数值字段列表；6.71 起允许单个输入，`onMissing:"zero"` 将 null 或缺失按 0 相加，全部缺失也输出数值 0。负分直接相加，不重新计算权重、不折叠不同行。非法非空值和溢出仍取 null；空行集不生成行，查询失败不等于缺项。旧 `null`（任一缺项为空）与 `ignore`（部分缺项忽略、全部缺项为空）保持原行为。新策略和单字段列表在 6.70 及以下拒绝。

最小声明：`{"op":"sumFields","fields":["a","b"],"output":"category","onMissing":"zero"}`。输出字段须声明为数值度量，不能带 queryField 或嵌入输入行。多个算子顺序执行，可先算分类、再算总分。单字段分类可用同一策略将缺项归零。

Playground `/pages/sum-fields-missing-values` 使用 inline 合成数据验证部分缺项得分 8、风险 -2、总分 6，以及全部缺项和真实零值总分 0；`/pages/partner-health` 的地区部、代表处使用现有各项查询的组织键并集逐行计算；顶部11项查询同时获取 `国内或海外` 为国内、海外的整体记录，对象查询只输出得分和范围字段，不输出地区部；普通指标沿用原指标查询形式，按同名范围维度分组。先按范围键取并集、unique关联单项，逐范围计算分类与总分，再通过已有 `pivot` 与 `selectField` 选择顶部按钮对应的分数；两组记录共用查询缓存，切换顶部不重发整体查询，不把组织得分纵向相加冒充整体分。单项/全缺分类保留 null，真实0保留，总分对缺项按0相加。成功无记录保持空态，查询失败不输出部分总分。全球时中国区/海外按钮仅控制顶部，不影响下方取数或页签。区域树选择具体地区部或代表处后隐藏按钮，5张卡复用相应组织计算结果；图表只保留代表处页签，表格两套页签始终展示。清空区域恢复全球，判断以values为空为准；已有visibleWhen读取组织values/level，levelQueryFields下推具体组织条件，无新增算子。正式页面使用集成应用注入的 DQE 网关，未配置 Mock 接口或合成业务行；真实 DQE 的整体粒度、字段与权限仍需单独验真。

## 比较期缺记录策略（6.77）

查询分页下的比较参见下节“查询分页组合结果逐行计算（6.78）”；本节的 unionKeys 路径仍按完整集合执行。

`joinAggregate.values[]` 可逐度量声明 `onMissing: "null" | "zero"`，省略为 `null`。它只处理成功查询中没有匹配记录的情况，覆盖该度量的默认缺行输出；已返回的 null 单元格、异常值和失败查询绝不被替换成零。算子顶层 `onMissing: "null"` 保持兼容。

```json
{"op":"joinAggregate","source":"previous","keys":[{"local":"customer","foreign":"customer"}],"values":[{"field":"sales","output":"previous-sales","aggregate":"unique","onMissing":"zero"},{"field":"rate","output":"previous-rate","aggregate":"unique"}],"onMissing":"null"}
```

先用 `unionKeys` 对本期/上期/去年同期的完整行集取键并集，再关联各期值。增长率为 delta(本期,基期) 后 ratio(差额,基期,scale=100,onZeroDenominator=null)，基期为零包括0/0均产出null；该相对变化声明的负基期同样产出null；普通ratio保留负分母相除。百分点差值只用delta，数值使用0–100刻度，用 `points-1-signed` 显示。表格绑定计算结果，允许全表排序和筛选；空值始终排在有效值之后。见 `/pages/period-comparison-demo` 和查询模块的“自动同比环比查询”。

<a id="paged-join-row-compute"></a>

## 查询分页组合结果逐行计算（6.78）

显式 `pagedJoin.source.pagination.mode:query`、无 records 的组合数据源，可在与 fields/source 同层声明 compute；仅允许 delta、ratio。算子按声明顺序消费已投影字段及前序计算产出，output 就地声明为允许空的数值度量且不得声明 queryField；不能覆盖投影、行键、序号和前序产出。零分母、负基期、刻度和百分点继续使用原算子规则，不新增表达式或公式语言。

```json
{"compute":[{"op":"delta","minuend":"current-sales","subtrahend":"previous-sales","output":"previous-sales-delta"},{"op":"ratio","numerator":"previous-sales-delta","denominator":"previous-sales","output":"previous-growth","scale":100,"onZeroDenominator":"null"}]}
```

组合先完成当前页的选页、按键补列和投影，再由共享计算阶段执行一次逐行计算，保留主查询 totalCount、行序和当前页长度；完整导出逐页读取相同范围并执行同一计算。计算字段不能用于后端全局排序、表头筛选、候选或搜索，不能把本页计算结果作为完整跨源输入。unionKeys、joinAggregate、timeFill、小计、总计等算子在该位置拒绝，原有完整跨源计算契约保持。

缺记录策略声明在 `source.projection` 的具体字段：`{"member":"previous","field":"sales","onMissing":"zero"}`；省略或null取空，仅数值度量允许zero。仅成功查询没有该键记录时补零；存在记录中的null/降级标量不补零，查询失败、截断或重复键整轮失败。比较组合的initial不在缺少可信事实证明时复用或采集。完整声明、合成操作和边界见 `/pages/period-comparison-query-page`。

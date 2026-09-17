# 页面参数原位引用与模板化 Spec

日期：2026-09-17。
状态：产品边界已确认，6.5 本仓实现已交付；验收结果及外部未验证边界见 verification.md。
本文替代本文件此前的独立 PageTemplate / inputs / targets 方案。没有新增模板包装、第二份页面 Schema 或资产附属映射。

执行拆分见 [实施计划](page-parameter-inlining/tasks.md)，验收追溯见 [验收用例](page-parameter-inlining/acceptance.md) 与 [实施证据](page-parameter-inlining/verification.md)。

## 1. 目标与职责

基于现有 Page Schema 优化：模板与真实页面使用相同的 params、dataSources、sections 结构。模板中的查询和文本保留参数引用；召回时只填 params 的实际值，查询与布局不需重新编写。执行前在副本中确定性解析引用，生成可发送给 DQE 的普通请求。

创作期：Relay/平台编排构建与发布前确认，程序从最终已验证查询提取候选；用户确认后保存无实际参数值的模板。提取算法不由模型手写 JSON 完成。

召回期：用户自有外部服务检索模板、分析问题、补齐参数，调用独立确定性解析模块。Relay 不参与此阶段。本仓不新增召回应用、实例保存、实例列表或数据快照存储。

现有 relay page-builder 只有发现与页面构建；platform-authoring 明确不宣称自动提取模板。发布候选与绑定校验已有部分代码，但不等于提取、召回或实例化已接通。

## 2. 核心 Schema 决策

继续使用 params 数组和现有 {param:id} 引用形式。新增参数实际值 value、时间区间类型 timeRange，以及 DQE 指定取值位置的参数引用。查询消费关系直接写在取值位置，新的模板不生成 paramBindings。

三个状态同属一份 Page 协议：

| 状态 | params | 查询 / 文本 |
|---|---|---|
| 构建中的具体页面 | 可以尚无 params | 具体查询条件和文字 |
| 保存的模板 | 声明参数，无 value/default | 在可替换位置引用 params |
| 填值后的页面 | 相同声明，增加 value | 与模板保持相同引用及结构 |
| 执行副本（内部产物） | 使用同一组已校验值 | 引用解析为具体查询值与文本 |

模板与填值页面不是两个根类型，不新增 kind、templateVersion、inputs 或 targets。无参数普通页面仍合法。参数不全的文档可保存与校验，但不能开始查数。

协议按新增能力登记下一可用 minor 版本，实施时从版本真源分配；旧 schemaVersion 不接受新 value、timeRange 或查询内引用。旧版本语义保持，不通过改解释器让旧页面悄悄变义。

### 2.1 命名规则与概念一致性（规范性约束）

不能将 JSON 属性名、参数标识符和外部协议字段混为一类。三类规则分别固定，所有声明、引用、调用和生成示例须遵守：

| 类别 | 唯一规则 | 示例 |
|---|---|---|
| 本仓页面协议字段名 | lowerCamelCase；单词字段使用小写；沿用既有名称，不为相同概念另造别名 | schemaVersion、dataSources、params、id、value、param、granularity |
| 参数 ID 及其他沿用现有 Id 类型的标识符值 | 小写字母/数字与中划线，复用现有正则 `^[a-z0-9][a-z0-9-]*$`；新生成名称按小写词组用单个中划线连接 | region、report-period；禁止自动生成 report_period 或 reportPeriod |
| DQE / Java 外部协议字段 | 保留提供方字段原文，只在协议适配位置消费；不为了视觉统一擅自改名 | dim_name、dim_value_list、is_aggregate、page_metadata_definition、global_params |

因此 `dim_value_list` 是 DQE 的属性名，而 `report-period` 是参数 ID 的值；两者不是同一概念的两种命名。调用方的参数值映射以 ID 为键时，键也必须原样使用 `report-period`，不能变成 report_period。源码变量可按语言惯例命名，但序列化契约不得随实现语言变化。

以下概念只保留一套公开名称：参数清单为 params，声明标识为 id，消费引用为 param，实际值为 value，输入精度为 granularity，区间端点为 start/end。文本与查询统一引用 `{param:id}`，不新增 input、variable、parameterId 等同义引用写法。原有发布摘要等外部/兼容 DTO 若已有 parameterId，须在适配处显式对应 id，不把兼容名称带入新的页面引用结构。

granularity 与 DQE period 并非可互换的同义键：前者描述参数输入精度，后者是查询执行协议字段。month→month、date→day 的对应关系在查询解析模块明确维护，不通过改名或字符串替换猜测。

同一候选经用户确认后生成一个稳定 ID，所有消费者复用该 ID，修改 label 不改变 ID。重新提取优先复用已确认语义与来源匹配的 ID；同名但语义不同或固定原值不同的候选不得被合并，命名冲突由程序稳定追加数字后缀并展示区别。不同页面不承诺共享同一个业务参数 ID；跨页复用身份需独立的业务依据，不能凭字符串相同推断。

验收须加入：声明与所有引用 ID 精确相等；传入 report_period 不能命中 report-period，应报未知输入/缺值；序列化往返不改名；DQE 字段原样保留；文档示例与生成契约使用相同命名规则。

## 3. 参数声明字段

在现有 pageParam 联合上调整，以下为新版本的字段设计：

```ts
type DimensionParam = {
  id: Id;
  type: 'dimension';
  label?: string;
  required?: boolean; // 新版本缺省 true；提取产生的参数均必填
  multiple?: boolean; // 缺省 false
  value?: string | string[];
};

type TimeRangeParam = {
  id: Id;
  type: 'timeRange';
  label?: string;
  required?: boolean; // 缺省 true；查询引用必须为必填
  granularity: 'month' | 'date';
  value?: {
    start: string;
    end: string;
    granularity: 'month' | 'date';
  };
};
```

沿用 id 的现有格式。label 可省，缺省展示 id；不会按 label 猜字段。multiple 决定 value 为非空字符串或非空、无重复、非空字符串数组。timeRange.value 的 granularity 必须与声明相同，日期真实有效且 start ≤ end，区间包含两端。值中保留 granularity 以接收已确认的外部规范时间结构，校验其一致性，不形成第二种解释。

既有 string/number/boolean/time 类型继续存在，新增与各自类型相符的可选 value；time 保留单月/单日值。旧 default 保留为兼容字段，和 value 互斥。新提取流程不输出 default；真实值用 value 表示，不再借默认值保存本次输入。

声明层结构校验允许无 value；执行就绪校验要求所有必需参数已解析。提取生成的参数省略 required，按 true 解释；既有显式 required:false 仍合法，但不允许用于新查询内引用。本次不扩展可选查询条件删除规则。

## 4. 引用在消费位置表达

### 4.1 维度

现行 DQE：
```json
{"dim_name":"区域","dim_value_list":["中国区"]}
```

提取后：
```json
{"dim_name":"区域","dim_value_list":{"param":"region"}}
```

引用替换整个 dim_value_list。单值参数确定性转成单元素数组，多值复制数组。dim_name 本身已经明确字段，无需再写 queryField 或独立映射。参数不能用来替换字段名、指标、分组、公式、排序或任意 DQE 节点。

### 4.2 时间

查询保留原本 period、is_aggregate，将起止原位引用同一个区间：
```json
{
  "period":"month",
  "is_aggregate":true,
  "start":{"param":"report-period","part":"start"},
  "end":{"param":"report-period","part":"end"}
}
```

part 是封闭的 start/end 选择，不支持任意属性路径或表达式。两端必须引用同一个 timeRange 参数，精度必须兼容 period：month 对 month，date 对 day。不能一端引用参数、另一端偷偷保留原日期。

对已有 time 参数和 period/lastN/yearToDate 等窗口，使用同一引用结构的兼容分支：
```ts
type QueryTimeReference =
  | { param: Id; part: 'start' | 'end' } // 引用 timeRange
  | { param: Id; part: 'start' | 'end'; window: ExistingTimeWindow }; // 引用 time
```

同一查询两端引用 time 时，param 与 window 必须一致，复用现有时间窗口求值算法。timeRange 分支禁止 window。算法不从一份固定日期猜测同比、上期或累计关系。简单新模板通常只需要区间引用；复杂旧时间能力有明确承接位置。

### 4.3 文本

继续使用现有文本引用，不新增 input 语法：
```json
{
  "title":"Tokens 运营报告",
  "badge":{"param":"region"},
  "asOf":{"label":"报告期间","value":{"param":"report-period"}}
}
```

timeRange 文本默认输出 start 至 end，相同起止只显示一次；dimension 多值用顿号连接。展示使用规范值，不自动将编码翻译成名称。现有 format 规则对已有标量保持；timeRange 首版只支持缺省格式，不新增自由表达式或字符串插值。

复合标题里的业务值不能全文搜索替换；改为固定通用标题与独立参数展示，或在确认阶段明确处理未能安全参数化的内容。

## 5. 真实示例：模板与实际页面只差 value

以下 params 与 filter 均为局部示例，省略页面其他必需字段。假设已验证查询的实际维度字段为“区域”。

模板：
```json
{
  "params":[
    {"id":"region","type":"dimension","label":"区域"},
    {"id":"report-period","type":"timeRange","label":"报告期间","granularity":"month"}
  ]
}
```

外部服务填值后的同一页面：
```json
{
  "params":[
    {"id":"region","type":"dimension","label":"区域","value":"中国区"},
    {
      "id":"report-period","type":"timeRange","label":"报告期间","granularity":"month",
      "value":{"start":"2026-01","end":"2026-06","granularity":"month"}
    }
  ]
}
```

两者 dataSources 中的查询条件完全相同：
```json
{
  "dims":[{"dim_name":"区域","dim_value_list":{"param":"region"}}],
  "time":{
    "period":"month","is_aggregate":true,
    "start":{"param":"report-period","part":"start"},
    "end":{"param":"report-period","part":"end"}
  }
}
```

执行副本：
```json
{
  "dims":[{"dim_name":"区域","dim_value_list":["中国区"]}],
  "time":{"period":"month","is_aggregate":true,"start":"2026-01","end":"2026-06"}
}
```

各查询保留自己的 is_aggregate 和分组；示例中的 true 不统一覆盖全页。整体消耗量/流水、月趋势、代表处对比、模型占比和区域模型明细的布局与指标均不变。月、代表处、模型和区域这些分组不会被抽为待填参数。

## 6. 提取算法与确认

1. 固定最终已验证页面的精确基线，只扫描简单维度谓词与明确时间范围，不以原始问题或输出 fields 决定绑定。
2. 维度按有依据的语义身份和相同规范值分组，时间按相同区间和精度分组。不仅凭同名跨域合并，也不合并“中国区”和“全球”。
3. 建立一次性候选摘要，含原值、影响位置、覆盖查询清单。此摘要用于确认和审计，不是模板新增 targets 字段。
4. 允许部分覆盖；单查询候选默认不选，全部或多数查询覆盖默认勾选，其余默认不选，最终以用户确认为准。
5. 对选中候选生成 params 声明，原位把字面量改成引用；不再从查询删除整个条件再另存绑定。未选条件保留固定值。
6. 发布模板去除所选参数 value/default，清除 query 数据源旧 initial，并处理关联文本。静态 inline 数据不因本次提取被无差别清除。
7. 来源或候选改变后，旧确认失效。用原值临时回填校验，确认生成查询与原已验证查询语义等价后才交付模板。

参数 ID 由程序稳定生成并去重。身份、覆盖和原值证据属于创作过程；模板的实际消费关系完全从原位引用读取。

## 7. 解析模块与执行门禁

独立模块的接口语义：
```ts
resolvePageParams(page, suppliedValues?) -> resolvedPage | issues
```

suppliedValues 是外部服务可选提供的 id→值映射；它先经过声明校验，再在本次副本的 params.value 中落定。对明确提供的键，以本次值替换旧 value；非法值拒绝，绝不回退。未提供的键可使用页面已有 value。新模板禁止 default，因此缺值必然失败；旧页面的 default 行为仍走其版本兼容规则。

外部服务也可直接填写全部 params.value 再调用。调用结果携带本次有效输入供运行时初始化和导航使用，不要求持久化，也不在后续阶段再次用 URL 或历史覆盖。

结构校验与执行就绪校验分开：无值模板是合法页面文档，但不是可执行输入。运行时、服务端执行和首屏 initial 路径都须在查数/显示前执行同一门禁；缺值时不会把省略条件解释成全量查询。

只遍历明确的查询值位置及现有文本位置，禁止按对象恰好含 param 键就在任意数据行中替换。执行前生成新的请求副本，不修改保存的引用结构；DQE HTTP 请求中不得出现任何参数引用对象。

错误至少区分未声明引用、缺少输入、非法值、目标冲突、时间规则不合法和物化页面不合法，携带参数 ID 与文档路径。

参数化仍固定本次输入；页内筛选是另一种可变状态。与现有 filterBindings/initialParam 重合的目标，沿用“参数初始化筛选、随后由筛选状态接管”的行为：引用确立同一初值来源，查询不能再注入第二份固定谓词。清空筛选后参数不复活。时间与页内时间筛选同目标仍拒绝，保持现行约束。

## 8. 精确校验约束

- 新参数对象沿用封闭分支，不允许任意字段；value 必须满足声明类型，value/default 互斥。
- 所有参数必须有消费者；查询内引用加入消费统计，不只统计文本和 paramBindings。
- 每个查询维度字段最多一个参数源，禁止同字段重复静态条件或多个来源。多处跨查询引用同一参数合法。
- 新查询内引用和旧 paramBindings 不得共同控制同一查询；转换按查询原子完成。
- 时间两端引用须同源同规则，保持原 period 和聚合语义；无合法时间值不查数。
- 模板发布校验额外要求本次提取的参数无 value/default、无旧 query initial；此为发布规则，不需要另一个根 Schema。
- 页内初值绑定必须指向同一 dimension 参数，禁止参数值与筛选默认双来源。
- 参数值不能改变指标、查询字段、布局或权限。权限继续由数据服务判定。
- 无数据就是空结果；禁止查询期间和 filter-history 回退。

## 9. 旧字段迁移与实现位置

| 现有位置 | 调整 |
|---|---|
| pageParamZ / PageParamDeclaration | 新增 value 与 timeRange 分支；新版本 required 缺省 true |
| 文本引用与物化 | 保留 param 语法；新增区间和维度多值展示；适配带 value 的输入解析 |
| query.paramBindings | 旧版本继续消费；新提取流程不生成；迁移到 body 中精确值位置 |
| DQE body 校验 | 指定 dim_value_list、time.start/end 的引用闭集及语义校验；原始 body 的宽泛 object 不能充当新规则验证 |
| initializeQueryParams 等执行逻辑 | 收敛到共享解析规则；新旧分支不能重复注入 |
| filter initialParam | 保留，校验初值来源与原位引用一致 |
| source.initial | 无值模板不消费；填值页面只能用有有效输入证明的数据，不能将旧行冒充新结果 |
| publication 候选 | document 仍是 Page；摘要增加 timeRange，映射证据从原位引用派生，不改成 template 包装 |
| 中立 Schema / Python 快照 | 沿现有导出链更新 Page 契约、版本门禁、正反例，不维护第二份页面 Schema |

维度迁移：旧 paramBindings 的 queryField 转成明确 dim_name 谓词及引用；旧 default 若表示当前实例输入则转 value，发布为模板时去值。已有 value/default 冲突拒绝自动选择。

时间迁移：旧 time 声明与 window 保留语义，将绑定迁到 start/end 的同源 window 引用；真正固定区间提取使用 timeRange。不把年初累计、上月和全年一律替换成同一个输入区间。

旧 params 用于纯展示和跨页导航的能力保持；新值解析完成后仍供导航读取。timeRange 的 URL 编码不在本期外部服务结构化调用范围内，不从旧单值 URL 解析规则猜区间。

涉及 schema/primitives.ts、schema/data-source.ts、page-param.ts、query.ts、param-bindings.ts、运行时初始化、文本物化及对应 Python 校验。实现可重命名内部文件，但唯一契约仍在 packages/page 的作者与生成链。

## 10. 外部 Java 与项目边界

service/platform-java.yaml 继续传 page_metadata_definition；不要求新增 PageTemplate 包装、模板专用资源或实例存储。因为 params 已在页面内，description 与 supported_fields 仍从原页面位置读取；支持的槽位从 params 获取，不能从输出字段猜测。

但“根结构一致”不代表现有 Java 已理解查询中的引用。提供方须确认新版 Page 的保存/回读，以及执行前解析参数。原 execute 的 global_params 注入与历史回退不能叠加在新链路上；只能接入共享规则，或消费外部服务已解析的普通请求。具体外部接线不在本仓伪造实现。

ADR-0078、PAGE-PARAMETERS 与 Skill 能力说明在实现时同步更新。当前只改 spec，不声称新版 Schema 或模块已交付。

## 11. 验收

1. 模板与填值页面除 params.value 外结构相同，同一 Page Schema 均通过结构验证。
2. 无值模板执行就绪验证失败；原值回填产生与原查询等价的 DQE。
3. 区域和区间换值后只有声明的消费位置变化；分组、指标、聚合设置及布局保持。
4. 相同维度同值提取共享，不同值/无共同身份依据的候选分开；局部覆盖明确展示。
5. 月/日区间、单值/多值、未知引用、非法日期与时间双端冲突具有共同正反例。
6. DQE 边界没有引用对象；文本与查询消费同一组有效值。
7. 新旧 paramBindings 不重复执行；旧时间窗口回归等价。
8. 筛选初始化、修改、清空均不复活固定条件；URL/历史不覆盖本次外部服务输入。
9. 无值模板不消费旧 initial；无数据不回退。
10. 发布仍使用既有确认和真实保存回执规则；本仓不新增召回及实例持久化。

# 明细表 table

columns/children 定义字段列与递归列组；交互、查询与呈现约束见下列专题。

## 查询默认排序的首屏方向

查询分页使用服务总条数；排序和表头筛选遵守查询分页限制。

普通 query 数据源在 `source.query.body.dsl_list[0].order` 声明 `order_by_field` 和 `type: "asc" | "desc"` 时，表格首次显示对应列的排序方向。运行时将查询字段名通过 `queryField` 映射为页面字段 id；模式查询先选择当前已应用分支及其字段映射。未知、歧义或非法排序不生成虚假的列头方向，查询错误仍由原执行入口报告。

该回显只影响初始表头呈现，不把服务端默认排序写成用户排序，不改变初始快照复用、查询、分页或取数次数。用户点击排序或清除后，以该表实例已提交的操作为准；普通数据刷新不补回初始方向，完整视图重置重新回显声明。pagedJoin/pagedUnion 继续使用既有 ordering.default。

可观察入口 `/pages/query-sort-baseline` 使用合成初始快照：表格首次显示决策时长降序，两个柱线混合图分别保持时长 6/3/1、人数 8/4/2 的行序，并显示固定 2 天、5 人基线。它验证配置与呈现，不证明真实 DQE 服务排序。

## 列头筛选默认值（6.82）

select 叶子列可声明 `filterable: {"mode":"select","defaultValues":["pending"]}`，初次有效读取直接应用原始值，控件勾选、筛选标记、数据和导出保持一致。默认值为字符串或有限数值数组，保持原始类型，重复值非法；字段须是静态 main 维度绑定，普通远程查询还须有 queryField 映射，不能静默跳过条件。静态默认值不接受参数对象；参数初值使用下节 6.85 的 initialParam。不支持 byFilter、其他数据槽、日期范围、数值范围或行内子表。省略或空数组初始无该列条件；显式空数组仍要求本能力版本。

有 enumValues 时默认项须属于字典，显示字典 label；无字典时沿用动态候选，不要求当前候选中存在默认项。候选尚未加载、无匹配或请求失败均保留已选值并允许取消，不自动扩大查询。多个默认值按集合 OR，多个列及页面业务条件继续 AND 收窄；空交集显示正常空态。默认值不改写原查询中的固定条件。

首次初始化一次性提交全部默认项。用户清空后保持清空，翻页、排序、刷新数据、候选更新、Tab 切换及普通业务条件变化不补回默认值。列隐藏清除其条件，重显不恢复；展示字段切换仍遵循原有状态清理。组织父子表的地区选择属于完整重置，恢复当前可见列的声明默认值。显式恢复视图整体优先，包括已清空的空视图；重新打开页面运行实例按声明初始化。

inline 与明确完整且无查询窗口的 query 按表格实例本地筛选，可共享源。远程默认筛选要求表格独占页面数据源，包括其他组件、AI 总结和查询依赖引用；不得让默认值影响共享消费者。按需 pagedJoin 的有效默认条件与默认排序须来自同一允许选页的查询成员，冲突拒绝，不逐列覆盖或退回当前页过滤。缺少视图证明的远程初始快照和执行回执不复用；独立取数与运行时遵循同一初始化规则。导出冻结当前已提交条件，用户已清空时不重新消费声明默认值。

可观察入口 `/pages/table-header-filter-defaults` 使用内联合成数据，展示多列默认、数值类型、同源独立状态、候选缺项和列显隐；`/pages/table-header-filter-defaults-query` 使用默认网关通过 HTTP 代理访问 DQE Sim，验证首请求已带东区条件、查询分页、清空和 Excel。真实 DQE、Relay 和部署另验。

<a id="table-header-params"></a>

## 表头参数初值与全选语义（6.85）

本节为旧配置兼容规则；新全选入口使用下节的 showSelectAll。

select 叶子列声明 `filterable: {"mode":"select","initialParam":"is-valid","allBehavior":"unrestricted"}`。`initialParam` 引用现有 `params.query.dimensions` 字符串维度参数，与 `defaultValues` 互斥。可选参数无输入及保存值时不限；保存的 `dim_value_list` 提供缺省初值；必需参数缺失沿用参数诊断。多值 URL 使用重复键 `?is-valid=是&is-valid=否`。空值、重复、错误类型和字典外输入拒绝，不回退保存值；不得把 JSON 数组字符串当多值编码。

参数只供页面实例首次初始化，TableSession 唯一持有之后的已提交选择。初始请求直接包含条件，用户改选“否”或清空后，刷新数据、翻页、Tab、候选更新及导出都保持当前选择。显式恢复视图整体优先，包括空 predicates；恢复仍校验新声明的类型、字典和全选规则。列隐藏后重显不恢复初值；组织父子表的完整重置按当前有效列恢复本实例基线。普通详情浮层仍按现行只读表格约束禁止表头筛选，本能力不开放该位置；也不会重新读取外层 URL 或借用来源表会话。

`allBehavior` 缺省 `values`，全选仍发送原始值集合；`unrestricted` 必须有显式 `enumValues`，选择完整枚举集时省略该列条件并回显不限。集合比较保持类型、忽略次序；初始化、手动提交和恢复视图使用同一规则。枚举字典本身仅提供展示名称，不自动意味着不限。不限可能返回字典外原始值和 null；需要排除它们时使用 `values`。保留数值静态 defaultValues，首期不接受数值参数初值。

字段必须为静态 main 字符串维度；远程字段沿显式 projection 定位成员及 queryField，并核对参数 dim_name。同一输入不得通过固定 paramBindings、DQE 原位引用或隐藏页级 filterBindings 永久约束同一目标；独立业务、权限和时间条件仍按交集生效。远程所有权、待定门控、单成员分页和 records 限制沿用上节，不逐列覆盖初值。声明了 initialParam 即使当前无值也保留快照保护；无视图证明的普通 initial/执行回执不复用，Node 单次取数不写回无视图信息的已筛选普通 initial。共享层不读取 window.location。

入口 `/pages/table-header-filter-param-source` 提供有效意见数（是）、决策总次数（是、否）、直接打开与西区查询分页。内联页 `/pages/table-header-filter-defaults?is-valid=是` 用四条合成记录比较两种全选行为；HTTP 仿真页 `/pages/table-header-filter-defaults-query?region-input=西区` 观察初始请求与查询分页。完整操作和证据边界见 pages/capabilities/table/README.md。两个真实业务原件缺失，本示例不是业务页迁移或真实 DQE 证明。

<a id="table-header-select-all"></a>

## 列头全选入口（6.98）

在 select 列声明 `filterable: {"mode":"select","showSelectAll":true}` 才展示“全选”。省略或 false 不展示；该属性不用于日期/数值范围。固定 `enumValues` 和从表格完整匹配结果取得的动态候选均支持。新页面只需配置 `showSelectAll`，不需要配置 `allBehavior`，动态候选也不需要补写枚举。

```json
{"field":"status","title":"是否有效","filterable":{"mode":"select","showSelectAll":true}}
```

列头弹层不提供“清除筛选”按钮。选项通过取消勾选清空；日期和数值范围通过清空端点恢复。

点击全选后该列不限，控件保持全选勾选；在完整候选已知时逐项选满也采用同一行为。取消单项后按剩余原始值筛选；取消全选或逐项取消勾选可清空选择并恢复该列不限。操作一次提交并回到第一页，翻页、排序、刷新及 Tab 切换保留用户选择。运行时用独立的全选意图保留显示状态，不把当前值集合写成 IN 条件；查询、筛选候选与导出都消费已提交视图。相同数据与其他条件下，全选和该列未过滤返回相同记录，包括 null 和枚举外值；页面业务条件、权限、搜索和其他列条件继续生效。显示名不进入查询，初值仍沿既有 defaultValues/initialParam 规则。

动态候选 ready/empty、无搜索词且已加载数等于准确 totalCount 时可首次全选；尚有分页时先“加载更多”，不把当前页或搜索结果当全部。候选为空也可全选恢复含空值的记录。搜索时隐藏全选；已全选时可直接取消全选，取消单项则须先取得完整、无搜索的候选，未完整时单项暂不可改，以免漏掉未加载值。加载/失败/不可用不提供可用全选。失配值可在部分选择时逐项取消；取消全选显式清空本列所有选择。

旧 `allBehavior` 从 6.85 起已存在，保留读取、校验和执行规则，已有页面无需改写；它不控制入口是否显示。新 `showSelectAll:true` 的用户全选操作固定为不限，不受旧 allBehavior 值影响。省略新开关的旧页面继续按原筛选声明运行。

完整内联合成示例 `/pages/table-header-select-all` 对照静态/动态候选、true/false/省略、空值、其他列、Tab 与 Excel；无需外部数据服务。该例不代表真实 DQE 或 Relay 验收。

## 前端列枚举（6.80）

字段列可声明 `enumValues:[{"value":"0","label":"项目商务框架"},{"value":"1","label":"项目非框架"}]`。它是创作期已确认的有限字典，不从当前页推断全集。数组1—1000项，value为字符串或数值，同类型原始值不得重复；数字0与字符串"0"分别匹配，label为非空纯文本。

仅主字段的单元格及 Excel/PDF/PNG 展示使用枚举名称，不改写数据快照、查询、排序、行键、导航和筛选编码。次字段、徽标独立展示。缺失继续遵循 missingText，未知值及失配原文证据保留原文，不替换成任一已知枚举。Excel 的已知枚举导出文字标签，其余值保持原导出行为。

同时声明 `filterable:{mode:"select"}` 时，表头直接按字典顺序显示完整静态选项，提交原始 value；不预热、查询或搜索动态候选。此字典不证明记录存在或用户具有数据权限，也不改变后端筛选能力。省略 enumValues 的列沿用动态候选。组合源的跨成员筛选限制仍生效。

可观察入口 `/pages/table-column-enums`：合成编码0、1、未知9、空值分别显示两种中文标签、9、—；选择项目商务框架仅保留 B-1，导出使用中文标签。业务页 `/pages/business-decision-all-details` 使用同一映射，DQE Sim 继续返回原始编码。

## 决策意见明细合成预览

`decision-opinion-details` 使用现有 `query` 数据源和查询分页，首轮查询通过 `order_by_field/type` 声明决策总次数降序。Playground 专用适配器分别读取合同、商务两个分页模拟源，归并后返回当前页及匹配总数；类型列通过现有表头多选筛选限定参与来源，候选来自完整匹配范围，支持候选搜索和清除，三个数值列可以切换全局排序。256 条记录中相同姓名与两边重复的局部行键分别保留，来源 ID 与局部键共同确定行身份。

后端占比原值按约定刻度展示，不根据其他列重算；该模拟源从 0—1 转成既有 percent 格式所需的 0—100。页面未声明新的默认排序或合并源协议；JSON 单独加载不提供两个来源的执行能力，初始列头方向也沿现有行为。此场景用于交互与有序归并预览，不证明真实 DQE 已支持相同排序、空值位置或计数能力。


<a id="table-column-visibility"></a>

## 列条件显隐（6.62）

字段列及递归 `kind: "group"` 列组可就地声明 `visibleWhen`，复用[展示条件](../conditions.md)，读取本作用域筛选状态、已有权限结果或业务事实，不允许引用当前行。未声明列条件的表格保留原有搜索及状态规则；普通列上的 `selection.visibleWhen` 等仅控制入口，不会启用本能力。

```json
{"field":"amount","title":"合同金额","visibleWhen":{"filter":"business-type","part":"values","op":"containsAny","values":["contract"]}}
```

示意中的筛选器必须已声明。父组隐藏覆盖后代，无可见叶子的列组不生成空表头；其他业务容器仍遵守子项不反推父级。零业务列保留表格标题，显示“当前条件下无可见列”，不生成序号、展开入口或表体，不开放表格操作和该表 Excel 导出；页面静态导出保留此状态。条件等待或错误同样不展示列。

隐藏列清除其用户排序、表头条件、草稿与候选交互；重新显示不恢复这些操作。其他列的状态与查询定义中的业务条件、默认排序保留。单纯列显隐不重置分页；有效操作或搜索范围变化时回第一页。隐藏不删结果字段、不自动停查，也不代替数据权限。

启用列条件的表格，工具栏搜索字段必须属于声明列的 main 槽主/次/徽标字段。搜索实际范围为声明字段与当前可见字段的交集；同字段仍属于其他可见列时继续可搜。多字段搜索保留有效关键词，字段隐藏或重显导致范围变化时重算；已清空关键词不恢复。静态搜索选项随列裁剪，当前项失效则清空关键词/草稿并选择首个可用项，不自动将旧词提交到新字段；没有可搜字段则清除搜索并隐藏搜索框。

本能力覆盖各表格变体、Tab/组合卡内表格、详情及行内子表，使用各自作用域输入。父表零列时释放全部展开实例并取消/隔离在途请求，恢复后默认收起。已有子表导出限制不因此解除。涉及远程排序、表头筛选或搜索的新能力表格必须独占查询页面数据源；inline 和无分页窗口的 complete 结果仍可共享、分别持有表格状态。

Excel、PDF、PNG共用列规则，导出开始冻结筛选、事实、有效列和已提交状态；不导出隐藏字段，复合列只展开可见列的次字段/徽标。权限修订变化仍按已有规则停止旧实例及导出。

可观察入口：`/pages/table-column-visibility`（四种表格外观、搜索与 Excel）、`/pages/table-column-visibility-scopes`（Tab、详情、展开子表）、`/pages/table-column-visibility-report`（PDF/PNG）。均为内联合成数据；远程状态调和由集成测试覆盖，不作为真实 DQE/Relay 验收。

<a id="table-row-action-identity"></a>

## 当前行定位与补充数据关联

多数据源表格仍按 `props.rowKey` 将补充数据槽对齐到主数据槽。主数据中同一商务编号可以有多条阶段明细，基础信息与人数可继续按商务编号关联；无需为了点击跳转改变查询粒度、删除 `rowKey` 或增加页面字段。

点击导航、单元格筛选联动和详情入口时，运行时优先使用仍在当前可见主数据中的实际行，避免同一个关联键的其他阶段替换被点击行。声明了 `rowKey` 时，其值仍须为有效字符串或有限数字。旧行回调不再属于当前数据时，仅在行键唯一匹配当前行的情况下重新定位并检查最新动作条件；行已移除、行键缺失或存在歧义时拒绝执行。当前行的 `visibleWhen`、`enabledWhen` 及权限限制继续生效。

完整合成示例 `/pages/table-multi-source-navigation` 有四条阶段明细和两条基础信息、人数记录。点击三条人数为 12 的明细均进入 `/pages/table-multi-source-navigation-detail`，目标页显示被点击行的项目、代表处与阶段；补充数据顺序不同也按商务编号正确对齐。此场景不访问真实 DQE 或 Operation Map。

<a id="table-cell-selection"></a>

## 单元格点击与筛选联动

`selection` 优先于 `link`；主、次、徽标字段独立声明，不拼接字符串。

交互态的 `selection` 选择列和 `link: true` 链接列均以下划线提示可点击，覆盖普通、`forecastMatrix`、`embedded` 和 `reportCompact` 变体；普通数据列不加下划线。选择列不额外添加蓝色背景，选中后保持普通文字颜色，不加蓝色边框；显式业务颜色照常生效，键盘焦点框跟随文字颜色。静态导出不呈现点击控件。

当主字段原始值为 `null`、`undefined` 或非有限数字时，单元格呈现默认 `—` 或绑定的 `missingText`，不生成选择按钮、导航链接或详情入口，也不显示下划线或进入键盘焦点顺序。按原始值判定，不比较展示文案；真实的 `0`、`false`、空字符串或恰好等于缺省文案的文本不因此禁用。次字段或徽标有值不能使缺失的主字段恢复可点击。该规则覆盖全部表格变体，保留现有动作资格与启用条件。可观察示例：`table-missing-cell-actions`，使用内联合成数据，无需 DQE。

选择列的 `selection.writes` 以**页面筛选器 id** 为键，以当前行的**页面字段 id** 或固定值为输入。例如：

```json
{
  "field": "region-dept-name",
  "title": "区域",
  "width": 150,
  "fixed": "left",
  "selection": {
    "writes": { "region": { "field": "region-dept-name" } }
  }
}
```

目标须是页面声明的 `dimension` 筛选器，或 IOC 页头 `regionFilter` 自动提供的公共筛选 `region`；后者无需再声明 `filters.region`。点击将当前行原始取值转为字符串写入其单选状态，不使用格式化文案。空值不写入，多目标写入一次完成。再次点击同一取值保持选中，不自动清空；`fixed` 和 `width` 只影响呈现，不影响写入。

6.95 起，每个写入目标可增加可选 `level`，引用该筛选器 `hierarchy` 的层级 ID；字段或固定值两种输入均支持。代表处列的完整声明示例：

```json
{
  "field": "office-name",
  "title": "代表处",
  "selection": {
    "writes": { "region": { "field": "office-value", "level": "office" } }
  }
}
```

`office-value` 须与目标层级候选的原始 `value` 一致；名称仅展示，不能据此猜测编码或层级。普通维度不允许声明 `level`，未知层级在写入目标的 `/level` 位置报错。省略时保持原行为：层级筛选使用 `defaultLevel`，未声明默认层级则取首层；不继承上一次用户所选层级。选中态同时比较有效层级和取值，不同层级同码不会互相选中。

表格和页头写入同一份筛选状态；页头回显、候选确认、URL 同步及依赖查询刷新沿用现有链路。新 Header 的子控件 ID 不参与写入配置。查询仍显式使用 `filterBindings.region.levelQueryFields` 映射各层业务字段；时间及其他筛选、布尔覆盖 Region 的既有规则保持。

选择动作沿用组件动作资格；当前协议允许 `inline` 入口写入会产生可观察结果的筛选，例如联动下游查询。维度筛选值还须通过显式 `options` 或可信动态候选确认，候选未就绪时相关查询等待。选择列写入筛选状态，不直接筛选其他表格；下游查询必须显式声明 `source.query.filterBindings.region: { "target": "dimension", "queryField": "region_dept_name" }`。这里 `region_dept_name` 是真实 DQE 字段，不能从页面字段 id 猜测。不订阅该筛选的查询不重跑，`inline` 行也不会因此自动过滤。

可观察示例：`table-cell-selection` 使用 DQE Sim 合成数据，点击“华南地区部”后，下表仅显示“深圳代表处”；上表不订阅该筛选，保留全部入口。浏览器回归同时覆盖四种变体下划线、键盘选择、重复点击、未绑定下游及内联入口联动查询的行为，不代表真实 DQE 验收。

层级选择示例：`ioc-header-controls` 使用应用级合成候选与查询网关，点击地区部或代表处后，页头、查询结果和 URL 同步；同码地区部与代表处验证层级隔离，内联入口始终保留全部行。该场景不证明真实 Operation Map 或 DQE 接入。

## 单元格溢出省略与悬浮提示

交互表格的普通 `string` 字段主值按实际列宽单行展示，超出宽度时以 `…` 省略。鼠标悬停在被截断的文本上，tooltip 展示完整原文；没有发生溢出时不弹提示。取消固定字符数阈值，不提供“更多”或点击展开。键盘聚焦文本同样显示提示，Esc、移出或表格滚动关闭；鼠标可以移入提示查看、选择或滚动长文本。

提示使用白底深色文字，在单元格右侧垂直居中显示；靠近窗口边缘时向内收齐到视口右边界，不翻转到单元格左侧。保留原文换行，按纯文本展示，不执行 HTML；进入浏览器顶层避免表格滚动容器裁剪，宽高限制在视口内，长内容可在提示中滚动。文本变化或组件销毁时关闭旧提示。

该行为由引擎统一处理，不按字段名称识别审批意见，也不增加页面声明。普通、`embedded`、`forecastMatrix`、`reportCompact`、详情与行内子表采用相同规则。已有选择、导航和详情入口保留原有点击行为，受控语义 HTML、数值、次字段与徽标不参与本次省略。

省略只改变屏幕呈现，不截断页面数据源或查询结果，排序、筛选、搜索和 Excel 继续消费完整值。PDF/PNG 等静态导出直接展示全文且没有 tooltip。

可观察入口：`/pages/table-long-text`，使用内联合成审批意见，覆盖四种外观、短文本、空值、不同长度、组合 Emoji 和多行原文。操作及启动方式见 `pages/capabilities/table/README.md`，不代表真实 DQE/Relay 验收。

## 十二行可视高度

所有表格（含普通、`forecastMatrix`、`embedded`、`reportCompact`、Tab、详情及行内子表）默认最多显示十二行数据的高度，不足十二行时按实际内容收缩；更多数据在表格内部纵向滚动，表头保持可见，分页条留在滚动区外。多级表头与独立置顶汇总行单独计高，不占十二行数据名额；按实际渲染行高计算，长文本换行和窗口宽度变化后重新测量。展开子表在父表的可视区域内滚动，不继续撑高父表。

无需新增页面字段或修改既有 JSON。分页大小和查询窗口保持原语义：每页可返回二十或五十条，十二行只限制可视高度，不截断数据、不额外请求或改变总数。搜索、筛选和翻页后的新行集重新计算高度。PDF/PNG 静态导出展开全部应导出行，Excel 的数据范围保持原有契约。

入口 `/pages/table-twelve-row-viewport` 使用内联合成数据，覆盖四种外观、三层表头、长内容、二十条分页和十条短表。启动、操作及可观察结果见 pages/capabilities/table/README.md；不涉及真实 DQE/Relay。

## 渲染外观与变体

展示维度与度量行集；派生行样式由 `rowKindField` 决定，不从文案识别合计。

普通 Table、`variant: "forecastMatrix"` 与 `variant: "embedded"` 的网格采用 TinyVue OS 浅色样式：默认单层表头 40px、14px 字号与 21px 文字行高、灰色表头和短列分隔线；表体基础高度 48px、上下 12px 与左右 16px 内边距，长内容可撑高。多级粘性表头与固定列按实际渲染尺寸定位。固定列总宽超过表内可视宽度时，临时取消横向固定，所有列通过表内滚动访问；空间恢复后自动恢复固定。排序、筛选、搜索、分页和导出范围沿用已有契约。

`forecastMatrix` 保留预测矩阵的容器和对齐；`embedded` 使用十二行可视高度与容器内滚动，长文本可换行并完整访问。`reportCompact` 保持既有紧凑报表外观，不参与此次网格样式调整。行列结构、合并关系、显式值颜色与业务格式不会因皮肤改变而重写。

可观察示例：`table-tiny-os` 同页提供三种纳入的表格、保留的 `reportCompact`、多级表头与固定列，使用内联合成数据。维度候选值端口未注入时如实显示不可用；数值和日期筛选、搜索、分页及 Excel 导出可直接操作。静态导出沿用完整内容展开，隐藏滚动边界阴影与交互控件。

## 表格工具栏与搜索（6.21）

每张表可独立声明 `props.toolbar.search` 和 `props.toolbar.export`，省略哪项就关闭哪项，省略整个工具区保留旧页行为：

```json
{
  "toolbar": {
    "search": { "fields": ["customerName", "projectName"], "placeholder": "搜索客户或项目" },
    "export": { "format": "xlsx", "filename": "项目明细" }
  }
}
```

搜索字段必须是 `main` 数据槽中的文本标量字段，1—64项且不得重复。按 Enter 或搜索按钮提交，清空可恢复集合；提交时重置页码并保留排序与列头筛选。关键词只属于当前表格的实例状态，多个字段按任一字段包含匹配，采用不区分大小写的字面量包含语义，`%`、`_` 不作为通配符。草稿不参与导出。

表格没有可展示明细行时统一显示“暂无数据”，覆盖搜索无匹配、筛选空结果、查询失败后的空表及各表格变体；加载中仍显示“正在加载…”。保留表头、搜索框与当前关键词，清空搜索可恢复原查询。独立置顶汇总行不计入明细行数：只有汇总时，汇总与“暂无数据”同时保留。错误分类与诊断继续沿控制台和 `data-error` 事件传递，空提示不将失败状态改写为成功，也不改变导出完整性约束。无需新增页面字段。可观察场景 `/pages/region-auth-norms-detail` 的“决策意见明细”和 `/pages/table-pinned-summary`。

内联页面数据源及显式完整查询结果先搜索再排序和本地分页。其他查询源的搜索进入生效查询，由数据网关在上游执行；该表必须独占查询页面数据源，避免改动其他消费者的结果。共享查询定义的组合源属于单独的 `pagedJoin` 设计，不由本字段暗中引入。DQE 网关须配置经过核验的搜索编码器；未配置时报 `DQE_CONFIG_ERROR`，不会筛当前页或自动拉全表冒充查询搜索。

## Excel 导出（6.21）

Excel 导出捕获当前已提交搜索、页面筛选、列头筛选和排序，通过同一数据网关准备该表全部匹配行及其依赖。单表结果最多10,000行，准备最多5分钟；网关、服务端及显式声明的单批查询超时独立生效。超限、结果总数变化、分页提前结束或缺少完整性证明均明确失败，不下载部分结果。不同表的导出分别隔离，可取消；页面更新或销毁会中止。

工作簿保持声明的列顺序、多级表头及按 `rowKey` 对齐的数据槽。次字段和徽标字段展开为独立列；数值保留原始数值类型，百分数沿用页面的百分数值口径。Excel 无法直接表达的万／亿缩放和自适应格式采用冻结的展示文本数值格式，底层值仍可计算；此类格式不会随用户在 Excel 中编辑值自动重新计算。语义 HTML 转为可读文本，链接、选择控件与图形装饰不进入单元格。空结果也可导出表头。

普通表格、各表格变体、Tab 内表格复用该能力；详情表格在其完整查询作用域内本地搜索并导出。报告静态导出隐藏工具区，保留已提交搜索限定的行集。真实 DQE 的文本搜索编码仍需由集成应用按当前服务协议提供和验收。

表头 dateRange 日期选择同样默认禁止未来日期；日历上限为今天，手工提交未来日期保留已应用筛选，不触发重查。上限在聚焦和提交时按本地日期更新。

## 静态搜索选项（6.42）

需要在输入框前选择搜索字段时，使用与旧 `fields/placeholder` 分支互斥的静态选项：

```json
{
  "search": {
    "options": [
      { "value": "code", "label": "项目编码", "field": "code", "placeholder": "请输入完整项目编码" },
      { "value": "name", "label": "项目名称", "field": "name", "placeholder": "请输入完整项目名称" }
    ],
    "defaultValue": "name"
  }
}
```

选项为页面文档中的静态枚举，不请求候选值接口。每项声明唯一 `value`、显示 `label`、一个 `main` 槽文本字段 `field` 及可选 `placeholder`；1—64项。省略 `defaultValue` 时选第一项，显式默认值必须存在。所有选项均校验字段类型；普通非完整查询还必须具备查询字段映射。原来的 `fields/placeholder` 配置继续采用字面量包含及多字段 OR。

新分支只做单字段精确匹配；关键词提交时去除首尾空白，编码保留前导零，`%`、`_` 按原文匹配。输入仍由 Enter 或搜索按钮提交；切换选项保留当前输入并立即搜索，placeholder 同步切换。清空输入立即移除搜索条件，但保留当前选项。提交回到第一页，保留排序、页面筛选和表头筛选；搜索与既有条件按 AND 组合。选中项和输入草稿按表格实例隔离；导出冻结已提交的字段、匹配方式和关键词，未提交输入不改变导出。

普通查询的等值搜索由网关追加 `filter.dims` 单值条件，不替换同字段既有条件，不依赖包含搜索编码器。空关键词不产生条件。本地完整结果及组合表在完整行域上精确比较，不对输入或数据做大小写转换；真实 DQE 使用服务原生等值规则。当前本地仿真采用区分大小写比较，真实服务的大小写、重复维度条件 AND 及分页总数一致性仍须实测确认，不能以本地结果宣称实服务验收。

完整示例为 `table-search-options-page`，页面试验场入口 `/pages/table-search-options-demo`；并列展示本地等值搜索、DQE 仿真等值搜索及旧包含搜索。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

## 数值范围和组合表（6.22）

**分页选择与弹层定位**

启用 local/query 分页时，每页条数选择器始终保留，包括切换条数后全部记录只占一页及空结果；仅页码、前后页与跳页入口在单页时隐藏。改变每页条数沿用现有回到第一页的行为。无需新增页面字段。

每页条数、表头筛选及通用选择/日期菜单根据触发控件在当前可视视口的位置定位：下方足够时向下，否则选择空间更多的一侧；两侧都不足时限制弹层高度并在内部滚动。滚动、窗口变化和候选内容变化后重新定位，控件离开视口时关闭；弹层留在原 DOM/ShadowRoot，通过顶层显示避开父容器裁剪。

验收入口 `/pages/table-pagination-popovers` 使用16条内联合成记录，从每页1条的16页切换为20条后仍可切回10条；上下边缘菜单均可操作。本次仅修复呈现交互，不改变分页查询、声明形状或 Schema 版本。

`filterable: { mode: "numberRange" }` 只用于 number/money 度量。控件保存字符串草稿，提交后转换为可缺省的数值 from/to，端点包含；非有限数、反向区间和输入中的 `-` 不改变已提交视图。金额按元、百分数按结果字段原始刻度比较。清空移除条件。

绑定 pagedJoin 时使用单个 `data.main`、稳定业务 `props.rowKey` 和 `pagination: {mode:"query"}`；可点击排序列必须在组合 `ordering.sortableFields` 中。排序、筛选、搜索和页码均由 TableSession 持有，呈现层只显示和发事件。切换排序或条件回到第一页。组合搜索在有界完整最终行集上求值，导出使用同一已提交条件。

`multi-query-table` 仿真验收场景中，金额下限 150000000 匹配 3 行，再加召开率下限 85 后匹配 1 行；这是跨源 AND 后的总数。清空条件后搜索天津返回 1 行，清空搜索后导出应含全部 8 行。输入 `-` 等非法草稿时保留已提交条件，导出与屏幕按相同条件求值。

两张表分别展示「序号」和「预签金额排名」。序号随当前顺序变化；固定排名是数据源投影字段，切换召开率排序后仍跟随同一代表处，第一页可显示 1、4、2，第二页显示 5、6、3。召开率下限 85 时固定排名为 1、4，搜索天津时固定排名为 8；导出保留相同业务名次。两张表使用不同组合源，互不改变排序、筛选或页码。

6.35条件呈现及相关限制见[条件显隐](../conditions.md)；子项全部隐藏不自动收起父容器。

<a id="row-expansion"></a>

## 行内子表格（6.44）

`props.rowExpansion` 声明父行下方的一层独立表格；与同列树形表格及弹窗/抽屉详情不同。父表单一main数据槽，显式稳定唯一的string/number维度`rowKey`，不能与`mergeBy`同用；小计与合计不可展开。`mode`为multiple（默认）或single，默认全部收起。只点击首列展开按钮，不覆盖父表既有单元格交互。

子表`table`就地声明`columns`和分页；6.105 起 `rowKey` 可省略。省略时按返回顺序逐行保留全部记录，不按代表处等业务维度去重，也不要求上游增加记录 ID。显式声明时继续要求该字段为稳定、唯一的 string/number 维度，缺失或重复仍显示不可用。父表的 `props.rowKey` 仍必需，用于定位展开实例；不能一起删除。6.104 及以前的子表声明仍必须写 `rowKey`。

字段绑定、格式、多级表头、分页控件、每页条数及跳页全部复用现有Table。默认白底、无额外卡片，只含表头、数据、分页；不默认继承或生成标题、期间标签、工具栏、搜索和排序入口。仅声明`title`才显示标题；仅声明`toolbar.search`才显示搜索；仅对应列`sortable:true`才显示排序。内部排序不会产生未声明的排序控件。

- `data:{type:"recordList",field:"orders"}`直接绑定父行嵌套明细字段。子表字段从该字段的`items.fields`解析；复用一层、每行最多100项的既有契约。可用none/local分页，缺省为10条本地编号分页。null或不合法明细显示不可用，不伪装为无明细。
- `data:{type:"query",source:"orders",filters:["detail-customer"],bindings:{"detail-customer":{source:"row",field:"customer-id"}}}`引用专属查询定义。子表必须`pagination:{mode:"query"}`，查询不声明complete，不使用compute、结果绑定或pagedJoin。初始页大小沿用DQE`order.limit`（正整数），offset为0；响应必须提供同一父行与条件下的totalCount。不得在子表另设第二个初始pageSize。

省略查询子表行键时，查询必须显式声明 `order_by_field/type` 默认排序；例如按代表处升序只是排序意图，代表处不因此成为唯一行身份。用户排序清空后恢复查询默认排序。只读子表不生成虚构的全局唯一 ID；实时 offset 分页在排序值重复或数据变化时仍可能跨页重复或遗漏。

query输入引用隐藏、非层级dimension/timePoint/timeRange声明，必须全部显式绑定、被本查询消费，且至少一个输入来自父行维度；row/filter/param语法复用既有受控绑定。输入只写入该展开实例的条件副本，不写全页FilterState，不允许其他查询、正文动作或子表读取。缺值、非法日期等不发请求，不能降为全量查询。

模板查询源只能属于一个展开模板，不能与正文、详情或其它查询共享可变结果。主页面首屏不执行这些源。每个父行拥有独立查询程序、数据快照、搜索、排序、页码、页大小、取消信号及代次；并发请求每张父表最多4个。子表翻页不改变父表和其它子表。

查询默认排序若存在须使用 `order_by_field/type` 单字段格式（type 为 asc/desc），不支持 `order.by`。用户排序覆盖默认排序，不自动追加唯一子行键；未声明排序时才以子行键升序查询。指标查询的显式多字段排序发送前报 DQE_CONFIG_ERROR，不静默丢弃后续条件。开启查询搜索时必须配置并验收数据网关encodeSearch，搜索作用于全部匹配结果，不筛当前窗口。排序、搜索或每页条数改变回到该子表第一页。数据是实时offset分页，稳定排序不保证两次查询间数据增删时跨页不重复/遗漏。

查询子表成功返回后，折叠保留当前页面会话内的子表数据及已提交视图；同一父行、相同条件重开时直接恢复页码、排序、搜索及每页条数，不重复查询。每张父表最多缓存20个已折叠的成功实例，超过时释放最久未使用的实例；成功空结果可缓存，错误、加载中及取消的请求不缓存。recordList仍按父行数据呈现。父表翻页或改变父表搜索/列条件、父行消失/数据变化、筛选/参数/层级状态/显示上下文修订变化、父表重新加载或页面销毁均使相关折叠缓存失效；不同父行缓存隔离，权限变化沿用会话硬失效。折叠时未完成的请求仍取消，迟到响应不可回流。同页纯排序保留仍可见且内容未变的父行实例。翻页失败保留目标页码并允许重试，不把旧页内容放在新页码下。无需新增页面配置。验收入口 `/pages/table-row-expansion-cache` 使用内存仿真Gateway。

父表的十二行可视高度按父行计数，已展开子表属于对应父行的额外内容，不占父行名额。父行不超过十二条时随展开内容自然增高；超过十二条时，前十二条父行及其展开行共同确定可视高度，子表继续独立限制自己的可视行数。首次加载、异步返回及子表翻页均重新测量，不能把已成功返回的子表裁在父表可视区外。`table-row-expansion-cache` 用延迟合成响应展示首次展开与翻页。

首期子表只读，拒绝导航、详情、写筛选、列筛选、递归子表及任意组件插槽。未显式启用下文6.70完整父子 Excel 时，导出范围保留原限制：子表不开放导出字段；声明rowExpansion的父表及包含子表的页面暂不启用相应导出，在校验期给出明确待确认提示，不隐式选择导出范围。

完整样例：`table-row-expansion-inline`（无需DQE，第二张表按需启用搜索/标题/排序与单行展开）、`table-row-expansion-query`（本地DQE Sim，默认与可选列排序、单行展开）。`table-child-keyless` 使用合成网关同时展示查询和内联无行键子表：上海两条记录金额为360、999，完整导出保留4条父记录、18条子记录及逐行父关联列。真实DQE搜索编码、性能与身份权限仍需真实接入验收。

## 列筛选候选值

主数据或比较期补查失败时保留用户配置的表格内容，不注入未配置的按钮或失败说明，失败后没有可展示明细行时也显示“暂无数据”，具体错误沿用控制台及 data-error 事件：表头筛选、静态 enumValues 和显式候选请求仍可操作，失败结果不展示为成功数据行。按需组合查询的列候选仍由所属成员独立读取；若候选本身依赖失败的业务输入、完整组合结果或无权限，则继续显示候选失败/不可用，不从残缺行集或过期数据补选项。可观察场景 `/pages/period-comparison-query-page?state=error`：去年同期失败时展开客户表头仍可获得当期23个候选；`?state=retry` 可通过已配置的客户表头筛选触发新查询，恢复完整比较结果。候选和主查询的完整性边界不变。

6.76 的 `pagedJoin.pagination.mode:"query"` 使用单成员操作规则：后提交列所属成员覆盖其他成员的表格排序与过滤，界面勾选与排序标记同步清除，第一页重新查询。预先不可执行的操作只显示局部能力原因，保留有效页，不触发完整扫描。显式“为空”映射到 `isNull`；缺匹配和字段null均属空，目前后端完整为空能力未确认时明确不可用。

该模式打开另一成员菜单时，用预期提交后的条件计算候选与缓存，菜单打开本身不修改表格状态；自动完整候选预热关闭。其余表格继续下述候选规则及原有可见后空闲预热。默认200条候选读取批次、1000条原结果预算独立于表格每页10条与补列批次10条。

已有和新建表格的 filterable: {mode: "select"} 统一枚举本表全部匹配结果中该列实际出现的值，无 candidates.scope 开关。保留固定业务条件、页面筛选、权限、查询结果绑定、已提交表格搜索和其他列表头条件，仅排除当前列自身表头条件。同字段的页面条件与表头条件取交集，空交集不发送无约束请求。

候选采用懒加载与空闲预加载，独立于表格主数据的 loading/ready/error：表格主数据就绪、实际进入视口并完成两帧绘制后，才在浏览器空闲时逐列预加载 select 候选；不可见、未激活或已销毁的表格不预加载。后台候选读取串行执行；主查询优先，并可抢占取消在途候选、立即释放执行位置，不等待迟到响应。显式打开另一列菜单也优先于后台预加载。相同条件的在途请求或已完成候选页可复用；未预加载时点击菜单按需请求，仅菜单显示加载或失败，不将整表切回加载态。表格离开视口停止后台读取，条件改变使相应候选失效；取消可在之后空闲时恢复，失败等待显式打开或重试。

候选拥有独立搜索和分页；默认每页50项。候选搜索不改变表格搜索、页码或已提交条件。翻动本表展示页或改变展示排序不改变候选范围；上游查询窗口作为绑定输入改变时，仍按业务输入变化重取。候选状态按表格和列隔离；相同生效请求可共享执行资源。完整原始结果每批之间让出事件循环，避免快速适配器持续占用微任务队列；后台请求仍有网络与计算成本，但不作为整表渲染的前置条件。

多选筛选弹层按内容自适应宽度，通常介于160—360px，窄屏以视口留白为界；搜索框随弹层伸缩，超长候选换行。无需页面宽度配置。数值和日期区间筛选保留原有宽度。

稳定值保留字符串/数字原始类型，显示名独立。null 不进入首批候选，空字符串不等于 null。失配已选值保持勾选并可移除；完整候选已证实无匹配时标注“已选，当前条件下无匹配”，候选搜索或未加载的后续页不会被误判为失配。

inline 和已声明完整且未截断的 query 从完整行集枚举；计算产出只在完整结果上读取。pagedJoin 按最终组合行域枚举，保留已有完整关联上限（最多1000行），不使用成员字典代替。本表业务 TopN 和上游有限窗口不被自动扩大，当前页也不会冒充完整候选。

普通远程 query 需要数据网关实现可选 fetchColumnCandidates。对象查询优先采用下文的单字段投影路径；以下 fullQuery 兜底保留原查询。平台和 Playground 的共用 DQE 网关已注册 `columnCandidates: {mode: "fullQuery"}`：保留原查询全部 output_dims/output_metrics、模型、粒度、条件、默认排序及业务 TopN，默认按原始结果每批200行读取、总扫描上限1000行（最多5批）；前端仅保留目标列去重集合，不累积全部原始行。不会为枚举候选清空指标或换成维度字典。候选关键词搜索、稳定排序、分页和去重 totalCount 在完整读取后本地计算，不把候选搜索写入表格查询；已提交表格搜索仍沿用既有 DQE 搜索适配。

原始响应每批必须提供准确且一致的 total_count，并返回请求窗口应有的全部行；缺总数、总数变化、截断或任一批失败均不展示部分候选。扫描上限独立于导出上限：`maxRows` 默认1000，`batchSize` 默认200，均须为正安全整数。首批获取准确总数后，若实际候选原始行域（包含业务 TopN 截止）超过上限，立即停止后续批次，返回 `DQE_CANDIDATE_LIMIT_EXCEEDED`，不展示部分选项，并提示“候选数据超过1000条查询上限…请缩小筛选范围，或联系管理员显式提高上限”；超限时停用候选搜索和重试，缩小原表筛选范围后重新获取；该限制同样作用于懒加载和空闲预加载，表格主查询不受影响。集成配置 `columnCandidatesMaxRows` 可显式提高上限；独立网关使用 `columnCandidates: {mode: "fullQuery", maxRows: 2000}`，页面 JSON 不携带此配置。上限不是去重候选数量，默认不会读取一万条再去重；请求可取消。候选搜索或继续加载在候选页缓存未命中时会重新完整读取，网络成本与原表匹配行数相关，不是与候选页50项相关；跨批不承诺服务未提供的事务快照。已有 encodeColumnCandidates 专用去重编码优先；其响应须提供映射后稳定值、可选显示名及准确去重 totalCount。除对象单字段投影路径外，独立使用 createDqeGateway 时须选择上述读取方式或提供专用编码，否则显示“候选值能力不可用”。候选请求与主数据共用网关并发和取消资源。页面顶部维度筛选器继续沿用既有维度／筛选候选端口（fetchDimensionValues、fetchFilterCandidates），不改为列候选。

沿用现有 NO_PERMISSION 等非成功码带非空数据的消费规则，随后独立检查字段、分页长度、去重总数及续页重复；HTTP和信封失败仍按现有规则处理。数据可消费不表示候选已经完整。

可观察示例：table-column-candidates（pages/capabilities/table/table-column-candidates.json），在 Playground 的 /pages/table-column-candidates 打开。使用64行内联合成数据，演示跨页候选、继续加载、搜索、多列联动、数字编码与两表隔离。远程编码通过合成网关契约测试；真实 DQE/Relay 尚待外部服务核验。产品决策与兼容例外见 ADR-0114。

对象查询表头候选：普通查询分页表沿原对象的当前匹配条件，仅查询目标列 output_fields；过滤条件统一使用 filter.fields，原表格仍按10条或声明的页大小查询。候选投影完整返回后去重，响应总数不符则报错，不用当前页冒充完整候选；固定TopN保留业务范围并使用已配置的完整查询兜底或可信适配。参见[对象查询参数与候选](../queries-and-bindings.md#object-query-parameters)，可观察入口 `/pages/business-rejection-details-pagination-10`。

远程完整读取示例：`/pages/table-column-candidates-query`（`pages/capabilities/table/table-column-candidates-query.json`），620条合成 DQE 原始记录、80个去重代表处，部分候选在前三批200行之后才出现。使用平台实际注册的共用网关，以合成 HTTP 信封验证非空指标、跨批读取和多列联动；`?state=over-limit` 演示1001条原始结果在默认1000上限下拒绝候选，`?state=raised-limit` 以显式1200上限完整读取同一1001条记录；`?state=truncated` 演示截断失败，`?state=blocked-candidates` 让候选一直不返回，表格仍显示20行且能翻到第21行，后台候选被抢占取消。不代表真实 DQE/Relay 已验收。操作见页面目录 README。

## 自动序号列（6.48）

普通表格可声明 `props.rowNumber: {}`，在字段列之前增加默认标题为「序号」、宽度64px的呈现列。可设置 `title`、正整数 `width` 和 `fixed: "left"`；省略整个属性则不显示。展开子表格时，序号位于展开按钮之后，子表格可独立声明 `rowExpansion.table.rowNumber`。

```json
{ "rowNumber": { "title": "序号", "width": 64, "fixed": "left" } }
```

序号不绑定页面字段，不要求查询返回编号，也不参与排序、筛选、合并或单元格动作。它为当前呈现行集的每一行（包括小计、合计）编号；本地或查询分页按当前页偏移连续显示，排序、搜索和筛选后从当前结果顺序重新编号。无分页从1开始；空结果保留表头，不生成数据行。各表格变体、多级表头、固定列和Tab内表格共用该能力。

Excel完整导出按导出行集从1编号，并保留多级表头；报告静态导出按展开后的行集从1编号。该列是显示顺序，不是固定业务排名；固定排名仍由数据源返回，组合查询源的 `ordinalField` 保持原义。可观察场景为 `table-row-number`，使用内联合成数据。

## 详情表格的浮层宽度

`openDetail.view` 引用的详情视图只要包含 `table`，运行时自动使用宽版浮层；不新增页面宽度字段。从操作列、指标卡等任意入口打开同一视图，规则相同。居中弹窗与右侧抽屉的外框宽度均为 `min(窗口宽度 × 90%, 1440px, 窗口宽度 − 32px)`；弹窗居中，抽屉保持右侧展开。尺寸以当前浏览器文档的窗口为基准，不受 mount 目标 div 的宽高限制。

宽度按声明的组件类型判定，加载、空结果及错误时保持一致。仅字段详情或不含表格的详情视图沿用原宽度。列放不下时在表格内部横向滚动，保留列宽与字号。宽版弹窗上下至少留16px，抽屉占满窗口高度。

详情弹窗与抽屉通过原生 `dialog.showModal()` 进入浏览器顶层，遮罩覆盖当前文档的整个窗口，包括同一文档内集成应用的侧边栏；弹层保留在原 ShadowRoot 内，继续继承引擎主题。背景内容在打开期间不可交互；关闭按钮、Esc 与点击遮罩关闭，关闭后恢复触发入口焦点。页面更新、筛选变化及实例销毁继续关闭详情并取消请求。此行为不增加页面字段，也不要求集成应用修改 mount 参数。iframe 内的弹层仅覆盖 iframe 自身文档，不能遮挡外层页面。

完整合成场景：`/pages/table-detail-overlay`；公开 mount 集成场景为 Embed 示例 `/examples/detail-overlay.html`（左侧栏、高层级、transform 与 overflow 裁剪、小 div 挂载）；操作与预期结果见 `pages/README.md`。该场景不证明真实 DQE/Relay 取数。


## 标量原文展示与本地尾排（6.60）

查询返回的标量与字段类型或当前绑定格式不符时，表格保留原始标量的 String 展示并按字段、原因聚合控制台告警，不阻断其他单元格。时间组合字符串不截断、不去除首尾空白，数值字段的非数字文本也保留原文；真正 null、undefined 和非有限数字保持缺失占位。结构化字段的结构与安全校验不放宽。inline 数据及文档字面量继续严格校验。

查询归一化保留有效类型值和独立原文证据。计算、行键、动作、候选及查询输入消费有效类型值，原文不能被提升为可信业务键或查询条件；图表和指标卡沿用有效值及缺失规则。异常标量展示消费者为表格及其导出；嵌套 recordList 项保持既有数值容错，不新增项级原文协议。

本地排序按有效值、非空降级文本、缺失值三个组比较，升降序都保持组的先后；方向只影响组内排序。null、undefined、非有限数字、空串、纯空格及首尾空白去除后仅由一个或多个 -、–、— 组成的文本均属于末组。0、false、负数、A-01 保持有效；多键排序继续后续键，最终相等时保留输入顺序。远程排序采用上游结果，不对当前窗口重排。

Excel 原文单元格明确写入文本，不再猜测为日期或数值；合法数字保留数值类型。示例 `/pages/table-value-tolerance` 和 `/pages/table-missing-sort` 使用合成初始行及本地 DQE Sim。

<a id="table-pinned-top"></a>

## 独立查询置顶行（6.60）

props.pinnedTop 指定独立命名槽；列 pinnedTop 的 field/secondaryField/badgeField 用 FieldBinding 绑定该槽。data 是槽名而非数据源 id，完整声明见下方示例入口。

置顶槽须为普通 query，声明 source.resultScope:"complete"，完整返回零或一行；禁止 limit/offset 和依赖本表明细。置顶列仅绑定该槽，类型、角色、币种、单位须与明细一致。其余槽沿用 rowKey 对齐；置顶槽及单 main 表不新增行键要求，普通字段不得反向对齐置顶槽。

每页表头后仅显示一次汇总，不吸顶、不占明细页大小或 totalCount，序号/展开格留空。格式优先级：置顶绑定显式 format > 明细最终 format > 置顶字段 defaultFormat。未绑定格留空，次字段/徽标不继承明细。沿用列宽、对齐、固定列及样式，不继承选择、导航、详情、展开或 mergeBy。

汇总只消费其查询显式绑定的共同条件，不隐式接收地区、表内搜索、列头条件或分页。例中时间/产品绑定两源，地区仅绑定明细。两源均受用户权限约束，省略筛选不得扩大权限。值/标签由指标表区域查询返回，不从明细补算。

汇总加载不阻塞明细；零行不生成汇总；失败、总数不符或多行保留明细并诊断，不复用旧值。共同条件变化使旧汇总失效，迟到响应不回写。明细零行时可仅显示成功汇总，明细 totalCount 仍为零。

Excel 在表头后写一次无序号汇总，再写全部匹配明细。汇总零行可导出，失败或行数非法则整表导出失败；总数据行限10000、准备限5分钟。PDF/PNG 同一投影，展开表格中的成功汇总只出现一次，保留报告部分失败策略。不扩展行内子表声明，已有详情限制保持。

`/pages/table-pinned-summary` 使用两个独立 DQE Sim 查询，覆盖地区、共同时间/产品、零行、多行和失败；不证明真实 DQE 权限或汇总口径。

## 多查询置顶行与固定文字（6.79）

`props.pinnedTop.additionalData:["commercial","contract"]` 声明额外独立完整查询槽，列可绑定主槽或额外槽。各槽须引用不同的普通 complete query，不依赖明细、不带窗口，最多一行。主槽零行则不生成置顶行；额外槽零行则对应格缺失。任一槽加载、失败或行数异常时隐藏置顶行，明细继续显示；汇总失败/未就绪时拒绝完整 Excel。额外槽不参与明细对齐、排序、搜索、计数或分页。

叶子列可用 `pinnedTop:{"text":"合计"}` 声明固定纯文本，与同一单元格的 field/secondaryField/badgeField 分支互斥；不修改数据源或明细值。单槽及字段绑定行为不变。`/pages/business-result-metrics` 演示两张表各自使用三条无组织输出维度的 DQE 汇总查询：四个主指标与商务、合同闭环率分别取数；只有代表处汇总订阅页头区域选择，地区部汇总只订阅时间。页面不新增前端比率计算。该页只含 DQE 查询，无 inline 或 initial；真实聚合、授权及执行须内网验证。组装测试使用合成 HTTP 回执，页面仍使用运行时网关。


<a id="source-navigation"></a>

## 多来源整体排序与来源导航（6.61）

Table 通过单个 `data.main` 消费分页合并源 `pagedUnion`；列继续绑定最终页面字段。字段对应、来源常量、null、整体默认排序和分页声明见[数据源](../data-sources.md#paged-union)。默认排序在两个来源的全部匹配记录上生效，再取全局页面；不要求一次取回全部记录。用户交互排序只开放 `ordering.sortableFields` 声明的字段。沿用 Table 的升降序与 Shift 多列操作，移除最后一项用户排序恢复源默认。

链接列可声明 `navigateBySource: { field, cases }`：`field` 引用当前行的来源文本维度，`cases` 以来源值为键，每个值是普通导航目标（`href`、`query`、条件和目标参数校验）。它不能与 `navigate`、`openDetail` 或 `selection` 同时声明；配合 `link: true`，命中的来源使用对应目标并携带原始行字段，未配置的来源显示普通文本。来源身份字段可以不作为可见列。普通导航的 URL、权限与条件规则继续生效。

完整示例 `paged-union-page`，浏览器场景 `/pages/multi-source-table` 及 `/pages/multi-source-contract-detail`、`/pages/multi-source-commercial-detail`。演示来源为本地合成分页接口，入口与验收步骤见表格示例说明。

## 期间模式列显隐（6.67）

6.67 起可在字段列或分组列的 `visibleWhen` 读取期间筛选模式，例如 `{filter:"statistics-period",part:"mode",op:"in",values:["year","quarter"]}`。显示由已应用 selection.mode 决定，与查询 periodPolicy 独立。既有列投影同步表头、搜索、用户排序/筛选清理与 XLSX/PDF/PNG 导出；隐藏不停止共享查询。示例：[期间模式与查询策略](../examples/period-query-columns-demo.json)。

<a id="hierarchy-selection"></a>

## 层级筛选联动（6.70）

完整 Dashboard 声明见 [table-hierarchy-selection](../examples/table-hierarchy-selection.json)，产品页面为 `pages/capabilities/table/table-hierarchy-selection.json`，入口 `/pages/table-hierarchy-selection`，使用显式标记的合成 DQE Sim。该页的父表数字 `row-id` 与字符串 `region-id` 不同，代表处响应没有 parent；父级归属由独立普通查询提供。

| 声明 | 基数、引用与省略语义 |
|---|---|
| `rowExpansion.selection` | 可选单对象；省略沿用旧生命周期，不执行定位。仅支持 query 子表及显式 single 的两层结构树。 |
| `filter`、`parentLevel`、`childLevel` | 引用层级筛选器及其两个不同层级 id；不修改 URL 或筛选值形状。 |
| `parentField` | 完整父查询的原始 string 维度字段，严格匹配业务稳定值；不是 rowKey 的别名。 |
| `parentLookup:{source,field,filters,bindings}` | 专属 complete 普通查询；无窗口/compute/结果绑定。field 为原始 string 父级维度；至少一个私有输入完整读取当前筛选 values，不能读 row。只在选中子级时查询，去重结果必须恰好一个父值。 |
| `data.bindings[id]:{source:"selection"}` | 仅此子表私有输入联合允许；恰好一个，绑定隐藏非层级 dimension，被子查询消费。未选/选父级明确删除该条件；选子级注入选值。等待或失败不发子查询。其他绑定缺值仍失败。 |
| `toolbar.export.rowExpansion:{scope:"all",parentFields:[...]}` | 显式开启双工作表 Excel；parentFields 为非空去重父表字段列集合，必须当前可见。无此分支仍拒绝子表父表导出。 |

完整父查询独立返回父级整体指标，不能绑定层级筛选或私有输入，不能用 TopN/远程窗口冒充完整结果；父表使用本地分页或完整视图。父行投影先于搜索、表头条件、排序及分页，与 rowVisibleWhen 取交集，不改变共享 raw、计算或结果绑定。父表匹配重复、行键缺失/重复、非法候选、定位等待/无结果/歧义/失败均不会退回全部。归属成功但父结果无匹配时显示空表，不生成零值父行。

父表普通显示沿用[零总数兼容](../data-sources.md)：对象查询 `total_count: 0` 且已有父行时，层级控制器保留返回行和原始总数0，允许本地分页、地区部选择及行展开，不把它认定为已验证完整结果。展开子查询同样适用零总数展示兼容；查询分页仍沿用原协议，不据此推断下一页。仍检查父行键缺失/重复与父级匹配唯一性；非零总数矛盾、父级定位完整读取、跨源完整输入和完整父子导出的限制保持。验收入口 `/pages/query-zero-total-hierarchy` 使用合成HTTP响应。

定位数据源必须只绑定归属实际依赖的条件。组织归属需要期间时显式绑定；产品或期间无业务记录不能被解释为无归属。定位与子表模板默认不执行；URL 初值选子级时先确认候选，再定位并自动展开唯一父行。真实接入需要数据服务能执行这条查询，Schema 不会创造组织关系。

层级的 level/values 改变恢复父子表默认状态；选父级只保留对应父行、手动展开；选子级自动展开一次。共同条件改变保留展开或手动收起、合法会话及父页；已展开子表在第一笔新请求前恢复搜索/排序/每页条数并将子页回第一页。父行离开当前视图释放实例，成功子表的折叠重开沿用上述会话缓存；条件变化后重新查询，迟到响应不可回流。相同逻辑选择不会反复触发自动展开。

## 完整父子 Excel（6.70）

声明 `toolbar.export.rowExpansion:{scope:"all",parentFields:["父关联字段"]}`，要求已启用 `rowExpansion.selection`。

Excel 默认使用“父表汇总”“子表明细”两个数据工作表；组合源容错结果另附“数据异常说明”。父表搜索和表头条件限制导出父行，父页不限制。导出忽略子表局部搜索、排序、页码及展开状态，按声明默认顺序完整读取所有匹配子表。parentFields 加入独立父列数据槽，同名父子字段不覆盖；所有父实例的子表有效列必须一致。冻结条件，任务合计最多10000行、准备5分钟、父行子任务最多并发4个；普通查询/完整性/预算失败不下载部分文件；组合源可恢复的结果异常按组合表格规则附 warning。空子表合法，接受实时 offset 跨请求语义。PDF/PNG 本批保持禁用。

旧页面即使只升 schemaVersion 也不自动获得新语义；旧 recordList、数字行键、远程父分页与普通 Excel 保持。新字段在6.69及更旧版本中由能力下限拒绝。决策见 ADR-0123；真实服务与 Relay 边界见验收证据。


## 组合源数据异常提示与导出

当 main 或其他数据槽的 pagedUnion/pagedJoin 动态结果经过兼容整理时，表格不插入额外提示；来源、处理方式和次数仅通过 `console.warn` 输出。默认空值显示 —；交互继续消费整理后的类型值，不将显示原文作为行键。Excel 数据工作表保留可用匹配行，另附“数据异常说明”；正常导出不增说明表。异常语义及资源边界由[组合表格异常兼容](../data-sources.md#table-result-recovery)维护，合成入口 `/pages/table-data-recovery`。

## 期间比较的查询分页（6.78）

表格 data.main 指向带逐行 compute 的按需 pagedJoin，pagination 写 `{"mode":"query"}`；页大小和补列批次在组合源配置。当前期原始投影列按后端能力排序、筛选，比较计算列只绑定字段和 percent/points 格式，不声明全局 sortable/filterable。页码变化重新选页并按本页键补查，表格不自行调度查询或计算。比较期失败不注入未配置的按钮或失败说明，失败后没有可展示明细行时也显示“暂无数据”；完整导出逐页完成全部主查询对象的补查与计算，超限或失败不给部分文件。该分支不因计算而改变 totalCount，不提供页内伪全局筛选。示例 `/pages/period-comparison-query-page`。

## 自定义展示单位

6.94 起字段列可声明 `unit`，例如 `{"field":"duration","unit":"天"}`。声明、单位与缩放组合、缺失及导出规则见[展示单位](../field-bindings-and-formats.md#display-unit)。场景 `/pages/chart-table-unit`。

<a id="table-trend-arrows"></a>

## 列级上下箭头（6.99）

表格字段列用 `arrowRule` 声明箭头规则，与同级 `colorRule` 独立。只允许绑定 `number` / `money`，支持列组、置顶汇总及展开子表；次字段和徽标不继承规则。省略不显示箭头，旧页面保持原样。

```json
{"type":"table","id":"changes","layout":{"span":12},"data":{"main":"sample"},"props":{"columns":[{"title":"时长变化","field":{"data":"main","field":"durationChange","format":"number-1-signed"},"unit":"天","arrowRule":{"mode":"sign","positive":"down","negative":"up"},"colorRule":{"mode":"sign","positive":"red","negative":"green"}}]}}
```

sample 需要含数值字段 durationChange。这个例子正值显示红色 `↓ +2.5 天`，负值显示绿色 `↑ -1.2 天`。箭头不由正负号或颜色固定决定，必须使用作者声明的映射。

| 规则 | 声明 | 行为 |
| --- | --- | --- |
| 按正负映射 | `{"mode":"sign","positive":"down","negative":"up"}` | 正值 ↓、负值 ↑；可反向或两侧使用相同箭头 |
| 单侧显示 | `{"mode":"sign","positive":"none","negative":"down"}` | 正值无箭头，负值 ↓ |
| 固定箭头 | `{"mode":"fixed","arrow":"up"}` | 所有有效数字（含零和负值）显示 ↑ |
| 显式隐藏 | `{"mode":"fixed","arrow":"none"}` | 不显示箭头 |

`arrowRule.position` 可选 `before` / `after`，省略默认 `before`，两种 mode 均适用。默认显示 `↓ +2.5 天`；声明 `"position":"after"` 显示 `+2.5 天 ↓`。位置只影响箭头与主数值（含单位）的顺序，不改变映射和颜色，隐藏箭头时不保留多余间隔。置顶汇总、列组及子表复用列规则。

箭头值仅接受 `up` / `down` / `none`。sign 模式必须同时声明 positive 和 negative；fixed 模式必须声明 arrow；不允许混用两种模式的属性或传布尔值。表格列不接受 `showTrendArrows` 布尔开关；指标卡的同名开关保持原协议。

sign 模式的零、负零及缺失不显示箭头；fixed 模式与固定颜色一致，包含有效零，但缺失始终无箭头。按正负选择分支时复用现有格式精度：普通带符号数值、`points-1-signed`、`yoy-p-signed` 按舍入结果判断，例如 `number-1-signed` 的 ±0.04 落入零分支，±0.05 分别落入正负分支；其他格式（含 `percent-2-signed`）沿原值正负判断。fixed 不按舍入后的正负切换。枚举标签、非数字和异常回退原文不加箭头。

`colorRule` 或旧 `visual:"signed"` 继续决定文字和箭头颜色，固定颜色不改变箭头规则；`colorRule` 与旧染色声明仍互斥。不增加符号，不比较其他字段或阈值，不改查询、计算和排序。PNG/PDF 与屏幕共用呈现；Excel 使用相同规则在数字格式中按 position 前置或后置箭头，保留原数值类型。

完整 inline 合成场景 `/pages/table-trend-arrows` 覆盖正向、反向、单侧、固定与隐藏规则，包含单位、颜色、零/缺失、舍入边界、紧凑表格和进度条。无需 URL 参数或 DQE，不代表真实 DQE/Relay 验收。

## 时间列转换（6.102）

字段绑定可声明 `format:{"type":"time","pattern":"YYYY-MM-DD HH:mm:ss"}`，按固定 UTC+8 转换；支持常见日期时间字符串和秒/毫秒时间戳，无时区输入按 UTC。页面与 Excel/PDF/PNG 共用格式，Excel 为文本，原始数据和交互保持。输入、格式串及失败规则见[时间格式串](../field-bindings-and-formats.md#time-format)。合成入口 `/pages/table-time-format`。


页面协议 6.105。结构真源为本册[schema.json](../schema.json)，SHA256 `1c7afe28a429e999618ae4484841489e4bebd98134853c9f462e6935456b1a7f`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74"></a>

### `@tableComponent`

Schema位置：`#/definitions/tableComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@tableComponent.id`

Schema位置：`#/definitions/tableComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@tableComponent.visibleWhen`

Schema位置：`#/definitions/tableComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@tableComponent.type`

Schema位置：`#/definitions/tableComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="table" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "table" | 用于选择@tableComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@tableComponent.layout`

Schema位置：`#/definitions/tableComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@tableComponent.data`

Schema位置：`#/definitions/tableComponent/properties/data`。目标：[#/definitions/tableData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f7461626c6544617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@tableComponent.props`

Schema位置：`#/definitions/tableComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f7756697369626c655768656e"></a>

### `@tableComponent.props.rowVisibleWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowVisibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 完整本地表格的私有行展示条件，位于本地视图操作之前。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f7756697369626c655768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.rowVisibleWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowVisibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@tableComponent.props.title`

Schema位置：`#/definitions/tableComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tableComponent.props.title · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c65"></a>

### `@tableComponent.props.subtitle`

Schema位置：`#/definitions/tableComponent/properties/props/properties/subtitle`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 副标题文本取值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c652f616c6c4f662f30"></a>

### `@tableComponent.props.subtitle · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/subtitle/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c626172"></a>

### `@tableComponent.props.toolbar`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 每张表独立配置右上角工具区；省略时不显示搜索和导出。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f736561726368"></a>

### `@tableComponent.props.toolbar.search`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式文本搜索声明；提交的关键词属于表格实例，省略时关闭入口。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f76697369626c655768656e"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].visibleWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].enabledWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f6669656c6473"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].fields`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | main数据槽中的1至64个文本标量字段；不得重复，查询搜索要求有效queryField映射。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].fields[]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f706c616365686f6c646572"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].placeholder`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/placeholder`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 搜索输入提示；省略时显示搜索表格，支持文本取值引用。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f302f70726f706572746965732f706c616365686f6c6465722f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[0].placeholder · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0/properties/placeholder/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f31"></a>

### `@tableComponent.props.toolbar.search · anyOf[1]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["options"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f76697369626c655768656e"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].visibleWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].enabledWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e73"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64 | Schema未设默认；装配/运行时默认见语义说明 | 页面内静态枚举；1至64项，value唯一，每项声明label、一个main槽文本field及可选placeholder；只做单字段精确匹配，与旧fields分支互斥。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e732f6974656d73"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options[]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["value","label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f76616c7565"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options[].value`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options[].label`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options[].field`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f706c616365686f6c646572"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options[].placeholder`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options/items/properties/placeholder`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前选项的搜索输入提示；切换时同步替换，缺省显示搜索表格。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f706c616365686f6c6465722f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].options[].placeholder · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/options/items/properties/placeholder/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f616e794f662f312f70726f706572746965732f64656661756c7456616c7565"></a>

### `@tableComponent.props.toolbar.search · anyOf[1].defaultValue`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1/properties/defaultValue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始选项value，显式配置必须命中options；省略选第一项。清空关键词不重置选中项。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f7274"></a>

### `@tableComponent.props.toolbar.export`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["format"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 完整匹配结果的Excel导出声明；省略时关闭入口。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f76697369626c655768656e"></a>

### `@tableComponent.props.toolbar.export.visibleWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.export.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableComponent.props.toolbar.export.enabledWhen`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.export.enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f666f726d6174"></a>

### `@tableComponent.props.toolbar.export.format`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="xlsx" | Schema未设默认；装配/运行时默认见语义说明 | 首版固定xlsx，导出工作簿而非当前分页截图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "xlsx" | 用于选择@tableComponent.props.toolbar.export.format分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f726f77457870616e73696f6e"></a>

### `@tableComponent.props.toolbar.export.rowExpansion`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/rowExpansion`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["scope","parentFields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 6.70：显式开启完整父子双工作表 Excel；未声明保留旧导出限制。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f726f77457870616e73696f6e2f70726f706572746965732f73636f7065"></a>

### `@tableComponent.props.toolbar.export.rowExpansion.scope`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/rowExpansion/properties/scope`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="all" | Schema未设默认；装配/运行时默认见语义说明 | 首期仅 all，补齐未展开子表并忽略子表局部视图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "all" | 全部类别名称同时呈现，不自动隐藏或只展示前20个。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f726f77457870616e73696f6e2f70726f706572746965732f706172656e744669656c6473"></a>

### `@tableComponent.props.toolbar.export.rowExpansion.parentFields`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/rowExpansion/properties/parentFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 非空、去重的父表可见关联字段列，与子字段分槽写入。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f726f77457870616e73696f6e2f70726f706572746965732f706172656e744669656c64732f6974656d73"></a>

### `@tableComponent.props.toolbar.export.rowExpansion.parentFields[]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/rowExpansion/properties/parentFields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f66696c656e616d65"></a>

### `@tableComponent.props.toolbar.export.filename`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/filename`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 文件名基础文本；省略采用已解析表格标题或表格数据，自动附加.xlsx并清理非法文件名字符。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c6261722f70726f706572746965732f6578706f72742f70726f706572746965732f66696c656e616d652f616c6c4f662f30"></a>

### `@tableComponent.props.toolbar.export.filename · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/filename/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@tableComponent.props.variant`

Schema位置：`#/definitions/tableComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["reportCompact","embedded","forecastMatrix"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "reportCompact" | 紧凑报告呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "embedded" | 嵌入式内容呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "forecastMatrix" | 预测矩阵呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f74746f6d46616465"></a>

### `@tableComponent.props.bottomFade`

Schema位置：`#/definitions/tableComponent/properties/props/properties/bottomFade`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否使用底部渐隐呈现。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6d706f756e6443656c6c4c61796f7574"></a>

### `@tableComponent.props.compoundCellLayout`

Schema位置：`#/definitions/tableComponent/properties/props/properties/compoundCellLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="inline" | Schema未设默认；装配/运行时默认见语义说明 | 复合单元格的受控排列方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "inline" | 用于选择@tableComponent.props.compoundCellLayout分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774e756d626572"></a>

### `@tableComponent.props.rowNumber`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowNumber`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 6.48呈现序号列；默认标题序号、宽度64px，可左固定；按排序筛选后的当前行集跨页连续编号，不绑定数据字段。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774e756d6265722f70726f706572746965732f7469746c65"></a>

### `@tableComponent.props.rowNumber.title`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowNumber/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774e756d6265722f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tableComponent.props.rowNumber.title · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowNumber/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774e756d6265722f70726f706572746965732f7769647468"></a>

### `@tableComponent.props.rowNumber.width`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowNumber/properties/width`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 受控列宽数值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774e756d6265722f70726f706572746965732f6669786564"></a>

### `@tableComponent.props.rowNumber.fixed`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowNumber/properties/fixed`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="left" | Schema未设默认；装配/运行时默认见语义说明 | 表格固定列位置。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70696e6e6564546f70"></a>

### `@tableComponent.props.pinnedTop`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pinnedTop`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["data"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 独立完整查询置顶行，最多一行，不占明细分页和序号。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70696e6e6564546f702f70726f706572746965732f64617461"></a>

### `@tableComponent.props.pinnedTop.data`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pinnedTop/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 置顶行消费的命名数据槽，不能是main或同一个明细源。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70696e6e6564546f702f70726f706572746965732f6164646974696f6e616c44617461"></a>

### `@tableComponent.props.pinnedTop.additionalData`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pinnedTop/properties/additionalData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 额外独立完整汇总查询的命名数据槽，每个槽返回零或一行；不参与明细对齐。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70696e6e6564546f702f70726f706572746965732f6164646974696f6e616c446174612f6974656d73"></a>

### `@tableComponent.props.pinnedTop.additionalData[]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pinnedTop/properties/additionalData/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774b6579"></a>

### `@tableComponent.props.rowKey`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774b696e644669656c64"></a>

### `@tableComponent.props.rowKindField`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowKindField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 表格读取的行类别字段，必须由折叠算子写入。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d657267654279"></a>

### `@tableComponent.props.mergeBy`

Schema位置：`#/definitions/tableComponent/properties/props/properties/mergeBy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 表格合并分组字段，必须是已声明列。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f666974"></a>

### `@tableComponent.props.fit`

Schema位置：`#/definitions/tableComponent/properties/props/properties/fit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["content","container"] | Schema未设默认；装配/运行时默认见语义说明 | 受控适配方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "content" | 正常内容层。 |
| "container" | 当前容器作为交互/呈现作用域。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e73"></a>

### `@tableComponent.props.columns`

Schema位置：`#/definitions/tableComponent/properties/props/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@tableComponent.props.columns[]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/columns/items`。目标：[#/definitions/tableColumnNode](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnNode | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465"></a>

### `@tableColumnNode`

Schema位置：`#/definitions/tableColumnNode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f64652f616e794f662f30"></a>

### `@tableColumnNode · anyOf[0]`

Schema位置：`#/definitions/tableColumnNode/anyOf/0`。目标：[#/definitions/tableColumn](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumn | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e"></a>

### `@tableColumn`

Schema位置：`#/definitions/tableColumn`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f70"></a>

### `@tableColumn.pinnedTop`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 该叶子列的置顶字段绑定；省略则留空，不继承明细值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f30"></a>

### `@tableColumn.pinnedTop · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@tableColumn.pinnedTop · anyOf[0].field`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/0/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f302f70726f706572746965732f7365636f6e646172794669656c64"></a>

### `@tableColumn.pinnedTop · anyOf[0].secondaryField`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/0/properties/secondaryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 次要信息字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f302f70726f706572746965732f7365636f6e646172794669656c642f616c6c4f662f30"></a>

### `@tableColumn.pinnedTop · anyOf[0].secondaryField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/0/properties/secondaryField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f302f70726f706572746965732f62616467654669656c64"></a>

### `@tableColumn.pinnedTop · anyOf[0].badgeField`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/0/properties/badgeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 徽标内容绑定字段。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f302f70726f706572746965732f62616467654669656c642f616c6c4f662f30"></a>

### `@tableColumn.pinnedTop · anyOf[0].badgeField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/0/properties/badgeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f31"></a>

### `@tableColumn.pinnedTop · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["text"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f70696e6e6564546f702f616e794f662f312f70726f706572746965732f74657874"></a>

### `@tableColumn.pinnedTop · anyOf[1].text`

Schema位置：`#/definitions/tableColumn/properties/pinnedTop/anyOf/1/properties/text`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 该列置顶格固定显示的非空纯文本，与字段绑定分支互斥，不修改明细或查询。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumn.visibleWhen`

Schema位置：`#/definitions/tableColumn/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.62 列展示条件，不支持 row；隐藏后退出搜索并清理用户列操作。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumn.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6b696e64"></a>

### `@tableColumn.kind`

Schema位置：`#/definitions/tableColumn/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="field" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "field" | 用于选择@tableColumn.kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656e756d56616c756573"></a>

### `@tableColumn.enumValues`

Schema位置：`#/definitions/tableColumn/properties/enumValues`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; maxItems=1000 | Schema未设默认；装配/运行时默认见语义说明 | 列主字段的前端枚举字典，1至1000项；原始值类型敏感且不得重复，统一显示、静态选项和导出标签，不改写查询编码。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656e756d56616c7565732f6974656d73"></a>

### `@tableColumn.enumValues[]`

Schema位置：`#/definitions/tableColumn/properties/enumValues/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["value","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656e756d56616c7565732f6974656d732f70726f706572746965732f76616c7565"></a>

### `@tableColumn.enumValues[].value`

Schema位置：`#/definitions/tableColumn/properties/enumValues/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656e756d56616c7565732f6974656d732f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@tableColumn.enumValues[].value · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/enumValues/items/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656e756d56616c7565732f6974656d732f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@tableColumn.enumValues[].value · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/enumValues/items/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656e756d56616c7565732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@tableColumn.enumValues[].label`

Schema位置：`#/definitions/tableColumn/properties/enumValues/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6669656c64"></a>

### `@tableColumn.field`

Schema位置：`#/definitions/tableColumn/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f756e6974"></a>

### `@tableColumn.unit`

Schema位置：`#/definitions/tableColumn/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主数值展示单位 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@tableColumn.unit · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7365636f6e646172794669656c64"></a>

### `@tableColumn.secondaryField`

Schema位置：`#/definitions/tableColumn/properties/secondaryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 次要信息字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7365636f6e646172794669656c642f616c6c4f662f30"></a>

### `@tableColumn.secondaryField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/secondaryField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f62616467654669656c64"></a>

### `@tableColumn.badgeField`

Schema位置：`#/definitions/tableColumn/properties/badgeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 徽标内容绑定字段。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f62616467654669656c642f616c6c4f662f30"></a>

### `@tableColumn.badgeField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/badgeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f64616e67657256616c756573"></a>

### `@tableColumn.dangerValues`

Schema位置：`#/definitions/tableColumn/properties/dangerValues`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 应使用异常语义的有限取值集合。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f64616e67657256616c7565732f6974656d73"></a>

### `@tableColumn.dangerValues[]`

Schema位置：`#/definitions/tableColumn/properties/dangerValues/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e"></a>

### `@tableColumn.selection`

Schema位置：`#/definitions/tableColumn/properties/selection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["writes"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 单元格选择写回，优先于同列link。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumn.selection.visibleWhen`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumn.selection.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableColumn.selection.enabledWhen`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableColumn.selection.enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f777269746573"></a>

### `@tableColumn.selection.writes`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 选择写回的目标与字段/固定值映射。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f70657274696573"></a>

### `@tableColumn.selection.writes{key}`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@tableColumn.selection.writes{key} · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@tableColumn.selection.writes{key} · anyOf[0].field`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0/properties/field`。目标：[#/definitions/fieldReference](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6c6576656c"></a>

### `@tableColumn.selection.writes{key} · anyOf[0].level`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@tableColumn.selection.writes{key} · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@tableColumn.selection.writes{key} · anyOf[1].value`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c"></a>

### `@tableColumn.selection.writes{key} · anyOf[1].level`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f70726f70657274794e616d6573"></a>

### `@tableColumn.selection.writes · propertyNames`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7469746c65"></a>

### `@tableColumn.title`

Schema位置：`#/definitions/tableColumn/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tableColumn.title · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7769647468"></a>

### `@tableColumn.width`

Schema位置：`#/definitions/tableColumn/properties/width`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 受控列宽数值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6669786564"></a>

### `@tableColumn.fixed`

Schema位置：`#/definitions/tableColumn/properties/fixed`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","right"] | Schema未设默认；装配/运行时默认见语义说明 | 表格固定列位置。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f736f727461626c65"></a>

### `@tableColumn.sortable`

Schema位置：`#/definitions/tableColumn/properties/sortable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 本列是否开放排序，查询分页仍受能力限制。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c65"></a>

### `@tableColumn.filterable`

Schema位置：`#/definitions/tableColumn/properties/filterable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 表头筛选能力，仅允许适用的维度列。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f30"></a>

### `@tableColumn.filterable · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f6d6f6465"></a>

### `@tableColumn.filterable · anyOf[0].mode`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="select" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "select" | 下拉候选选择。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f73686f7753656c656374416c6c"></a>

### `@tableColumn.filterable · anyOf[0].showSelectAll`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/showSelectAll`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.98：true 展示全选，默认不展示；静态及动态候选全选后该列不限，包含空值，旧 allBehavior 兼容保留。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f64656661756c7456616c756573"></a>

### `@tableColumn.filterable · anyOf[0].defaultValues`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/defaultValues`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | select 列头初始选中的原始值数组；省略或空数组初始不筛选，用户清空后不补回。须符合静态 main 维度字段类型和已有列字典；详情及组合查询沿用各自执行约束。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f64656661756c7456616c7565732f6974656d73"></a>

### `@tableColumn.filterable · anyOf[0].defaultValues[]`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/defaultValues/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f64656661756c7456616c7565732f6974656d732f616e794f662f30"></a>

### `@tableColumn.filterable · anyOf[0].defaultValues[] · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/defaultValues/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f64656661756c7456616c7565732f6974656d732f616e794f662f31"></a>

### `@tableColumn.filterable · anyOf[0].defaultValues[] · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/defaultValues/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f696e697469616c506172616d"></a>

### `@tableColumn.filterable · anyOf[0].initialParam`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/initialParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 6.85：字符串维度参数初值；与 defaultValues 互斥，只初始化会话。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f302f70726f706572746965732f616c6c4265686176696f72"></a>

### `@tableColumn.filterable · anyOf[0].allBehavior`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/0/properties/allBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["values","unrestricted"] | Schema未设默认；装配/运行时默认见语义说明 | 6.85兼容字段：保留旧集合/不限规则；新全选入口只配置 showSelectAll。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "values" | 维度多选值集合。 |
| "unrestricted" | 选中完整显式枚举集时省略该列条件，回显不限，可包含原有 null 和未知值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f31"></a>

### `@tableColumn.filterable · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f616e794f662f312f70726f706572746965732f6d6f6465"></a>

### `@tableColumn.filterable · anyOf[1].mode`

Schema位置：`#/definitions/tableColumn/properties/filterable/anyOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["dateRange","numberRange"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dateRange" | 日期范围筛选控件。 |
| "numberRange" | 数值度量的包含端点范围；按原始单位比较，一端可缺省。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6c696e6b"></a>

### `@tableColumn.link`

Schema位置：`#/definitions/tableColumn/properties/link`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 把当前列/指标行作为导航入口，需对应navigate。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c"></a>

### `@tableColumn.openDetail`

Schema位置：`#/definitions/tableColumn/properties/openDetail`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 点击在页内打开详情浮层，读被点那一行，不离开当前页。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f30"></a>

### `@tableColumn.openDetail · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["surface","fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f73757266616365"></a>

### `@tableColumn.openDetail · anyOf[0].surface`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/surface`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["modal","drawer"] | Schema未设默认；装配/运行时默认见语义说明 | 浮层形态：modal居中、drawer右侧贴边；尺寸与层级由渲染引擎决定。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "modal" | 居中模态浮层。 |
| "drawer" | 右侧贴边抽屉。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumn.openDetail · anyOf[0].visibleWhen`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumn.openDetail · anyOf[0].visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableColumn.openDetail · anyOf[0].enabledWhen`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableColumn.openDetail · anyOf[0].enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f7469746c654669656c64"></a>

### `@tableColumn.openDetail · anyOf[0].titleField`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/titleField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 详情浮层标题取被点行的该字段；省略时用组件标题。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f7469746c654669656c642f616c6c4f662f30"></a>

### `@tableColumn.openDetail · anyOf[0].titleField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/titleField/allOf/0`。目标：[#/definitions/fieldReference](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c6473"></a>

### `@tableColumn.openDetail · anyOf[0].fields`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@tableColumn.openDetail · anyOf[0].fields[]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c64732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@tableColumn.openDetail · anyOf[0].fields[].label`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/fields/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f302f70726f706572746965732f6669656c64732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@tableColumn.openDetail · anyOf[0].fields[].field`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/0/properties/fields/items/properties/field`。目标：[#/definitions/fieldReference](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f31"></a>

### `@tableColumn.openDetail · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["surface","view"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f73757266616365"></a>

### `@tableColumn.openDetail · anyOf[1].surface`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/surface`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["modal","drawer"] | Schema未设默认；装配/运行时默认见语义说明 | 浮层形态：modal居中、drawer右侧贴边；尺寸与层级由渲染引擎决定。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "modal" | 居中模态浮层。 |
| "drawer" | 右侧贴边抽屉。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumn.openDetail · anyOf[1].visibleWhen`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumn.openDetail · anyOf[1].visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableColumn.openDetail · anyOf[1].enabledWhen`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableColumn.openDetail · anyOf[1].enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f7469746c654669656c64"></a>

### `@tableColumn.openDetail · anyOf[1].titleField`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/titleField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 详情浮层标题取被点行的该字段；省略时用组件标题。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f7469746c654669656c642f616c6c4f662f30"></a>

### `@tableColumn.openDetail · anyOf[1].titleField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/titleField/allOf/0`。目标：[#/definitions/fieldReference](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f76696577"></a>

### `@tableColumn.openDetail · anyOf[1].view`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/view`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 引用已经声明的详情视图 id。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e6773"></a>

### `@tableColumn.openDetail · anyOf[1].bindings`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 显式映射详情参数来源，支持行、页面参数或筛选器。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key}`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[0]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[0].source`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[0].field`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[1]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[1].source`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[1].id`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[2]`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[2].source`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[2].id`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@tableColumn.openDetail · anyOf[1].bindings{key} · oneOf[2].part`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6f70656e44657461696c2f616e794f662f312f70726f706572746965732f62696e64696e67732f70726f70657274794e616d6573"></a>

### `@tableColumn.openDetail · anyOf[1].bindings · propertyNames`

Schema位置：`#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e61766967617465"></a>

### `@tableColumn.navigate`

Schema位置：`#/definitions/tableColumn/properties/navigate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["href"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控URL与参数来源映射。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumn.navigate.visibleWhen`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumn.navigate.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableColumn.navigate.enabledWhen`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableColumn.navigate.enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f68726566"></a>

### `@tableColumn.navigate.href`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/href`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 目标URL，必须通过安全协议及结构检查。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f76616c6964617465546172676574496e70757473"></a>

### `@tableColumn.navigate.validateTargetInputs`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/validateTargetInputs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 显式要求集成应用提供目标输入投影后才允许跨页导航；仅传URL输入，不恢复视图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择@tableColumn.navigate.validateTargetInputs分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f7175657279"></a>

### `@tableColumn.navigate.query`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f70657274696573"></a>

### `@tableColumn.navigate.query{key}`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@tableColumn.navigate.query{key} · oneOf[0]`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@tableColumn.navigate.query{key} · oneOf[0].source`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@tableColumn.navigate.query{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@tableColumn.navigate.query{key} · oneOf[0].field`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@tableColumn.navigate.query{key} · oneOf[1]`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@tableColumn.navigate.query{key} · oneOf[1].source`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@tableColumn.navigate.query{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@tableColumn.navigate.query{key} · oneOf[1].id`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@tableColumn.navigate.query{key} · oneOf[2]`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@tableColumn.navigate.query{key} · oneOf[2].source`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@tableColumn.navigate.query{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@tableColumn.navigate.query{key} · oneOf[2].id`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@tableColumn.navigate.query{key} · oneOf[2].part`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f70726f70657274794e616d6573"></a>

### `@tableColumn.navigate.query · propertyNames`

Schema位置：`#/definitions/tableColumn/properties/navigate/properties/query/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f75726365"></a>

### `@tableColumn.navigateBySource`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["field","cases"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按行来源维度选择导航目标；未配置的来源显示普通文本。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f6669656c64"></a>

### `@tableColumn.navigateBySource.field`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f6361736573"></a>

### `@tableColumn.navigateBySource.cases`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 完整穷尽已声明模式或封闭枚举的静态case，没有隐式首项回退。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@tableColumn.navigateBySource.cases{key}`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["href"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumn.navigateBySource.cases{key}.visibleWhen`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumn.navigateBySource.cases{key}.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f656e61626c65645768656e"></a>

### `@tableColumn.navigateBySource.cases{key}.enabledWhen`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@tableColumn.navigateBySource.cases{key}.enabledWhen · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f68726566"></a>

### `@tableColumn.navigateBySource.cases{key}.href`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/href`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 目标URL，必须通过安全协议及结构检查。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f76616c6964617465546172676574496e70757473"></a>

### `@tableColumn.navigateBySource.cases{key}.validateTargetInputs`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/validateTargetInputs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 显式要求集成应用提供目标输入投影后才允许跨页导航；仅传URL输入，不恢复视图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择@tableColumn.navigateBySource.cases{key}.validateTargetInputs分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f7175657279"></a>

### `@tableColumn.navigateBySource.cases{key}.query`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f70657274696573"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key}`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[0]`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[0].source`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[0].field`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[1]`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[1].source`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[1].id`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[2]`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[2].source`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[2].id`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@tableColumn.navigateBySource.cases{key}.query{key} · oneOf[2].part`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572792f70726f70657274794e616d6573"></a>

### `@tableColumn.navigateBySource.cases{key}.query · propertyNames`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6e617669676174654279536f757263652f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@tableColumn.navigateBySource.cases · propertyNames`

Schema位置：`#/definitions/tableColumn/properties/navigateBySource/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f616c69676e"></a>

### `@tableColumn.align`

Schema位置：`#/definitions/tableColumn/properties/align`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","right"] | Schema未设默认；装配/运行时默认见语义说明 | 所在列或文本的对齐方向。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656d706861736973"></a>

### `@tableColumn.emphasis`

Schema位置：`#/definitions/tableColumn/properties/emphasis`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="strong" | Schema未设默认；装配/运行时默认见语义说明 | 强调样式，不改变数值或角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "strong" | 用于选择@tableColumn.emphasis分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f76697375616c"></a>

### `@tableColumn.visual`

Schema位置：`#/definitions/tableColumn/properties/visual`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["plain","rateBar","signed"] | Schema未设默认；装配/运行时默认见语义说明 | 单元格或数值的受控视觉语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "plain" | 普通呈现；分区为无额外容器，文本/单元格按各模块普通样式解释。 |
| "rateBar" | 在单元格内用比例条呈现。 |
| "signed" | 显示正负语义的数值呈现。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f636f6c6f7252756c65"></a>

### `@tableColumn.colorRule`

Schema位置：`#/definitions/tableColumn/properties/colorRule`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 数字展示位置的显式颜色规则，只支持number/money；与旧染色声明互斥。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f636f6c6f7252756c652f616c6c4f662f30"></a>

### `@tableColumn.colorRule · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/colorRule/allOf/0`。目标：[#/definitions/colorRule](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f636f6c6f7252756c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/colorRule | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6172726f7752756c65"></a>

### `@tableColumn.arrowRule`

Schema位置：`#/definitions/tableColumn/properties/arrowRule`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主数值的显式箭头规则，与颜色独立；省略不显示箭头 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6172726f7752756c652f616c6c4f662f30"></a>

### `@tableColumn.arrowRule · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/arrowRule/allOf/0`。目标：[#/definitions/arrowRule](../components/table.md#schema-232f646566696e6974696f6e732f6172726f7752756c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/arrowRule | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c65"></a>

### `@arrowRule`

Schema位置：`#/definitions/arrowRule`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f30"></a>

### `@arrowRule · oneOf[0]`

Schema位置：`#/definitions/arrowRule/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","arrow"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f302f70726f706572746965732f6d6f6465"></a>

### `@arrowRule · oneOf[0].mode`

Schema位置：`#/definitions/arrowRule/oneOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="fixed" | Schema未设默认；装配/运行时默认见语义说明 | 固定箭头模式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "fixed" | 固定箭头。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f302f70726f706572746965732f6172726f77"></a>

### `@arrowRule · oneOf[0].arrow`

Schema位置：`#/definitions/arrowRule/oneOf/0/properties/arrow`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["up","down","none"] | Schema未设默认；装配/运行时默认见语义说明 | 固定箭头，可为up、down或none。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "up" | 显示上箭头。 |
| "down" | 显示下箭头。 |
| "none" | 不显示箭头。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f302f70726f706572746965732f706f736974696f6e"></a>

### `@arrowRule · oneOf[0].position`

Schema位置：`#/definitions/arrowRule/oneOf/0/properties/position`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["before","after"] | Schema未设默认；装配/运行时默认见语义说明 | 箭头相对主数值的位置，省略为before；屏幕及Excel保持一致。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "before" | 箭头放在数值与单位之前（默认）。 |
| "after" | 箭头放在数值与单位之后。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f31"></a>

### `@arrowRule · oneOf[1]`

Schema位置：`#/definitions/arrowRule/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","positive","negative"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f312f70726f706572746965732f6d6f6465"></a>

### `@arrowRule · oneOf[1].mode`

Schema位置：`#/definitions/arrowRule/oneOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="sign" | Schema未设默认；装配/运行时默认见语义说明 | 按数值正负选择箭头映射。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "sign" | 按正负映射箭头。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f312f70726f706572746965732f706f736974697665"></a>

### `@arrowRule · oneOf[1].positive`

Schema位置：`#/definitions/arrowRule/oneOf/1/properties/positive`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["up","down","none"] | Schema未设默认；装配/运行时默认见语义说明 | 正值使用的箭头，支持up/down/none。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "up" | 显示上箭头。 |
| "down" | 显示下箭头。 |
| "none" | 不显示箭头。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f312f70726f706572746965732f6e65676174697665"></a>

### `@arrowRule · oneOf[1].negative`

Schema位置：`#/definitions/arrowRule/oneOf/1/properties/negative`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["up","down","none"] | Schema未设默认；装配/运行时默认见语义说明 | 负值使用的箭头，支持up/down/none。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "up" | 显示上箭头。 |
| "down" | 显示下箭头。 |
| "none" | 不显示箭头。 |

<a id="schema-232f646566696e6974696f6e732f6172726f7752756c652f6f6e654f662f312f70726f706572746965732f706f736974696f6e"></a>

### `@arrowRule · oneOf[1].position`

Schema位置：`#/definitions/arrowRule/oneOf/1/properties/position`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["before","after"] | Schema未设默认；装配/运行时默认见语义说明 | 箭头相对主数值的位置，省略为before；屏幕及Excel保持一致。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "before" | 箭头放在数值与单位之前（默认）。 |
| "after" | 箭头放在数值与单位之后。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f64652f616e794f662f31"></a>

### `@tableColumnNode · anyOf[1]`

Schema位置：`#/definitions/tableColumnNode/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f64652f616e794f662f312f616c6c4f662f30"></a>

### `@tableColumnNode · anyOf[1] · allOf[0]`

Schema位置：`#/definitions/tableColumnNode/anyOf/1/allOf/0`。目标：[#/definitions/tableColumnGroup](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f7570)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnGroup | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f7570"></a>

### `@tableColumnGroup`

Schema位置：`#/definitions/tableColumnGroup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["kind","id","title","children"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f76697369626c655768656e"></a>

### `@tableColumnGroup.visibleWhen`

Schema位置：`#/definitions/tableColumnGroup/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.62 列组条件，隐藏覆盖后代，无可见叶子不生成表头。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@tableColumnGroup.visibleWhen · allOf[0]`

Schema位置：`#/definitions/tableColumnGroup/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6b696e64"></a>

### `@tableColumnGroup.kind`

Schema位置：`#/definitions/tableColumnGroup/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="group" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "group" | 用于选择@tableColumnGroup.kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6964"></a>

### `@tableColumnGroup.id`

Schema位置：`#/definitions/tableColumnGroup/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f7469746c65"></a>

### `@tableColumnGroup.title`

Schema位置：`#/definitions/tableColumnGroup/properties/title`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6368696c6472656e"></a>

### `@tableColumnGroup.children`

Schema位置：`#/definitions/tableColumnGroup/properties/children`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 递归列组或受控子结构的子项。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6368696c6472656e2f6974656d73"></a>

### `@tableColumnGroup.children[]`

Schema位置：`#/definitions/tableColumnGroup/properties/children/items`。目标：[#/definitions/tableColumnNode](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnNode | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e"></a>

### `@tableComponent.props.pagination`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 分页来源与大小配置；query与local条件不同。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f30"></a>

### `@tableComponent.props.pagination · oneOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f302f70726f706572746965732f6d6f6465"></a>

### `@tableComponent.props.pagination · oneOf[0].mode`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="none" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "none" | 用于选择@tableComponent.props.pagination · oneOf[0].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f31"></a>

### `@tableComponent.props.pagination · oneOf[1]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","pageSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f6d6f6465"></a>

### `@tableComponent.props.pagination · oneOf[1].mode`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="local" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "local" | 用于选择@tableComponent.props.pagination · oneOf[1].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f7061676553697a65"></a>

### `@tableComponent.props.pagination · oneOf[1].pageSize`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f6e756d6265726564"></a>

### `@tableComponent.props.pagination · oneOf[1].numbered`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1/properties/numbered`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显示序号。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f32"></a>

### `@tableComponent.props.pagination · oneOf[2]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f322f70726f706572746965732f6d6f6465"></a>

### `@tableComponent.props.pagination · oneOf[2].mode`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/2/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77457870616e73696f6e"></a>

### `@tableComponent.props.rowExpansion`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowExpansion`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按父行显式声明一级独立子表格，省略时没有展开入口。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77457870616e73696f6e2f616c6c4f662f30"></a>

### `@tableComponent.props.rowExpansion · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowExpansion/allOf/0`。目标：[#/definitions/tableRowExpansion](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableRowExpansion | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e"></a>

### `@tableRowExpansion`

Schema位置：`#/definitions/tableRowExpansion`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["data","table"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e"></a>

### `@tableRowExpansion.selection`

Schema位置：`#/definitions/tableRowExpansion/properties/selection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["filter","parentLevel","parentField","childLevel","parentLookup"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 单元格选择写回，优先于同列link。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f66696c746572"></a>

### `@tableRowExpansion.selection.filter`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面已声明筛选器ID；part决定读取值或层级。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6576656c"></a>

### `@tableRowExpansion.selection.parentLevel`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLevel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 层级筛选器的父层级 id。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744669656c64"></a>

### `@tableRowExpansion.selection.parentField`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 父地域/父级字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f6368696c644c6576656c"></a>

### `@tableRowExpansion.selection.childLevel`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/childLevel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 同一层级筛选器的子层级 id，与父层级不同。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b7570"></a>

### `@tableRowExpansion.selection.parentLookup`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["source","field","filters","bindings"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 专属 complete 普通父级定位查询，不依赖候选或子明细携带 parent。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.selection.parentLookup.source`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f6669656c64"></a>

### `@tableRowExpansion.selection.parentLookup.field`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f66696c74657273"></a>

### `@tableRowExpansion.selection.parentLookup.filters`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/filters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 页面筛选器声明集合。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f66696c746572732f6974656d73"></a>

### `@tableRowExpansion.selection.parentLookup.filters[]`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/filters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e6773"></a>

### `@tableRowExpansion.selection.parentLookup.bindings`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 定位私有输入完整显式绑定；只读公共筛选或页面参数，恰好一次读取所选子级 values。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key}`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[0]`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[0].source`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6964"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[0].id`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/0/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[1]`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[1].source`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6964"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[1].id`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f70617274"></a>

### `@tableRowExpansion.selection.parentLookup.bindings{key} · anyOf[1].part`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/1/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f706172656e744c6f6f6b75702f70726f706572746965732f62696e64696e67732f70726f70657274794e616d6573"></a>

### `@tableRowExpansion.selection.parentLookup.bindings · propertyNames`

Schema位置：`#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f6d6f6465"></a>

### `@tableRowExpansion.mode`

Schema位置：`#/definitions/tableRowExpansion/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["multiple","single"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "multiple" | 允许同时展开多行，缺省模式。 |
| "single" | 同一父表最多展开一行。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f64617461"></a>

### `@tableRowExpansion.data`

Schema位置：`#/definitions/tableRowExpansion/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f30"></a>

### `@tableRowExpansion.data · oneOf[0]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["type","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f302f70726f706572746965732f74797065"></a>

### `@tableRowExpansion.data · oneOf[0].type`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/0/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="recordList" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "recordList" | 用于选择@tableRowExpansion.data · oneOf[0].type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@tableRowExpansion.data · oneOf[0].field`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f31"></a>

### `@tableRowExpansion.data · oneOf[1]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["type","source","filters","bindings"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f74797065"></a>

### `@tableRowExpansion.data · oneOf[1].type`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.data · oneOf[1].source`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f66696c74657273"></a>

### `@tableRowExpansion.data · oneOf[1].filters`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/filters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 页面筛选器声明集合。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f66696c746572732f6974656d73"></a>

### `@tableRowExpansion.data · oneOf[1].filters[]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/filters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e6773"></a>

### `@tableRowExpansion.data · oneOf[1].bindings`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 私有查询输入与父行、页面参数或页面筛选器的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key}`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f30"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[0]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[0].source`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[0].field`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f31"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[1]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[1].source`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[1].id`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f32"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[2]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[2].source`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[2].id`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[0] · oneOf[2].part`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level","mode"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |
| "mode" | 导航引用已应用时间模式；只允许display=modes范围筛选，与from/to一起构造目标URL。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[1]`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f736f75726365"></a>

### `@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[1].source`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="selection" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "selection" | 用于选择@tableRowExpansion.data · oneOf[1].bindings{key} · anyOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f646174612f6f6e654f662f312f70726f706572746965732f62696e64696e67732f70726f70657274794e616d6573"></a>

### `@tableRowExpansion.data · oneOf[1].bindings · propertyNames`

Schema位置：`#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65526f77457870616e73696f6e2f70726f706572746965732f7461626c65"></a>

### `@tableRowExpansion.table`

Schema位置：`#/definitions/tableRowExpansion/properties/table`。目标：[#/definitions/rowExpansionTable](../components/table.md#schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rowExpansionTable | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 独立列定义的只读子表格；默认仅内容与分页。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c65"></a>

### `@rowExpansionTable`

Schema位置：`#/definitions/rowExpansionTable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f7469746c65"></a>

### `@rowExpansionTable.title`

Schema位置：`#/definitions/rowExpansionTable/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@rowExpansionTable.title · allOf[0]`

Schema位置：`#/definitions/rowExpansionTable/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f726f774e756d626572"></a>

### `@rowExpansionTable.rowNumber`

Schema位置：`#/definitions/rowExpansionTable/properties/rowNumber`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 6.48子表格独立序号列，复用普通表格声明和编号规则。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f726f774e756d6265722f70726f706572746965732f7469746c65"></a>

### `@rowExpansionTable.rowNumber.title`

Schema位置：`#/definitions/rowExpansionTable/properties/rowNumber/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f726f774e756d6265722f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@rowExpansionTable.rowNumber.title · allOf[0]`

Schema位置：`#/definitions/rowExpansionTable/properties/rowNumber/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f726f774e756d6265722f70726f706572746965732f7769647468"></a>

### `@rowExpansionTable.rowNumber.width`

Schema位置：`#/definitions/rowExpansionTable/properties/rowNumber/properties/width`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 受控列宽数值。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f726f774e756d6265722f70726f706572746965732f6669786564"></a>

### `@rowExpansionTable.rowNumber.fixed`

Schema位置：`#/definitions/rowExpansionTable/properties/rowNumber/properties/fixed`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="left" | Schema未设默认；装配/运行时默认见语义说明 | 表格固定列位置。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f726f774b6579"></a>

### `@rowExpansionTable.rowKey`

Schema位置：`#/definitions/rowExpansionTable/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f636f6c756d6e73"></a>

### `@rowExpansionTable.columns`

Schema位置：`#/definitions/rowExpansionTable/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@rowExpansionTable.columns[]`

Schema位置：`#/definitions/rowExpansionTable/properties/columns/items`。目标：[#/definitions/tableColumnNode](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnNode | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f666974"></a>

### `@rowExpansionTable.fit`

Schema位置：`#/definitions/rowExpansionTable/properties/fit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["content","container"] | Schema未设默认；装配/运行时默认见语义说明 | 受控适配方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "content" | 正常内容层。 |
| "container" | 当前容器作为交互/呈现作用域。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e"></a>

### `@rowExpansionTable.pagination`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 分页来源与大小配置；query与local条件不同。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f30"></a>

### `@rowExpansionTable.pagination · oneOf[0]`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f302f70726f706572746965732f6d6f6465"></a>

### `@rowExpansionTable.pagination · oneOf[0].mode`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="none" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "none" | 用于选择@rowExpansionTable.pagination · oneOf[0].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f31"></a>

### `@rowExpansionTable.pagination · oneOf[1]`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","pageSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f6d6f6465"></a>

### `@rowExpansionTable.pagination · oneOf[1].mode`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="local" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "local" | 用于选择@rowExpansionTable.pagination · oneOf[1].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f7061676553697a65"></a>

### `@rowExpansionTable.pagination · oneOf[1].pageSize`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/1/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f6e756d6265726564"></a>

### `@rowExpansionTable.pagination · oneOf[1].numbered`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/1/properties/numbered`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显示序号。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f32"></a>

### `@rowExpansionTable.pagination · oneOf[2]`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f322f70726f706572746965732f6d6f6465"></a>

### `@rowExpansionTable.pagination · oneOf[2].mode`

Schema位置：`#/definitions/rowExpansionTable/properties/pagination/oneOf/2/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f746f6f6c626172"></a>

### `@rowExpansionTable.toolbar`

Schema位置：`#/definitions/rowExpansionTable/properties/toolbar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按需启用子表格实例搜索，省略时不显示工具区。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f746f6f6c6261722f70726f706572746965732f736561726368"></a>

### `@rowExpansionTable.toolbar.search`

Schema位置：`#/definitions/rowExpansionTable/properties/toolbar/properties/search`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按需声明实例内搜索；查询搜索需要网关编码能力。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f70726f706572746965732f6669656c6473"></a>

### `@rowExpansionTable.toolbar.search.fields`

Schema位置：`#/definitions/rowExpansionTable/properties/toolbar/properties/search/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@rowExpansionTable.toolbar.search.fields[]`

Schema位置：`#/definitions/rowExpansionTable/properties/toolbar/properties/search/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f70726f706572746965732f706c616365686f6c646572"></a>

### `@rowExpansionTable.toolbar.search.placeholder`

Schema位置：`#/definitions/rowExpansionTable/properties/toolbar/properties/search/properties/placeholder`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 子表格搜索提示文本，省略时沿用现有表格默认提示。 |

<a id="schema-232f646566696e6974696f6e732f726f77457870616e73696f6e5461626c652f70726f706572746965732f746f6f6c6261722f70726f706572746965732f7365617263682f70726f706572746965732f706c616365686f6c6465722f616c6c4f662f30"></a>

### `@rowExpansionTable.toolbar.search.placeholder · allOf[0]`

Schema位置：`#/definitions/rowExpansionTable/properties/toolbar/properties/search/properties/placeholder/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@tableComponent.props.actions`

Schema位置：`#/definitions/tableComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@tableComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `table-trend-arrows`：表格箭头。反例：[table-arrow-old](../errors/table-arrow-old.json)、[table-arrow-text](../errors/table-arrow-text.json)、[table-arrow-type](../errors/table-arrow-type.json)、[table-arrow-position](../errors/table-arrow-position.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-row-key`：多数据槽表格必须声明各槽都有且类型一致的 dimension rowKey。反例：[table-multi-slot-without-row-key](../errors/table-multi-slot-without-row-key.json)、[table-row-key-missing-in-slot](../errors/table-row-key-missing-in-slot.json)、[table-row-key-not-dimension](../errors/table-row-key-not-dimension.json)、[table-row-key-type-inconsistent](../errors/table-row-key-type-inconsistent.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-row-kind-field`：表格行类别字段必须存在且由该数据源的折叠算子写入。反例：[table-row-kind-field-unknown](../errors/table-row-kind-field-unknown.json)、[table-row-kind-field-not-written](../errors/table-row-kind-field-not-written.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-merge-by-column`：mergeBy 必须是表格已声明的列字段。反例：[table-merge-by-not-column](../errors/table-merge-by-not-column.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-selection-writes`：单元格选择只能写入已声明的 dimension 筛选器。反例：[table-selection-writes-unknown-filter](../errors/table-selection-writes-unknown-filter.json)、[table-selection-writes-non-dimension](../errors/table-selection-writes-non-dimension.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-column-binding-unique`：表格列字段绑定不重复。反例：[table-duplicate-column-binding](../errors/table-duplicate-column-binding.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-filterable-dimension`：表头筛选只能声明在 dimension 列上。反例：[table-filterable-on-measure](../errors/table-filterable-on-measure.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-local-inline`：pagination.mode='local' 只允许绑定 inline 或显式 complete 且无分页窗口的数据源。反例：[pagination-local-on-query](../errors/pagination-local-on-query.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-query-source`：pagination.mode='query' 只允许绑定 query 数据源。反例：[pagination-query-on-inline](../errors/pagination-query-on-inline.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-query-order`：查询分页要求 DQE order.offset 为 0 且 limit 为正整数。反例：[pagination-offset-not-zero](../errors/pagination-offset-not-zero.json)、[pagination-limit-not-positive](../errors/pagination-limit-not-positive.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-initial-rows`：查询分页的内嵌初始行必须声明 totalCount 且是完整第一页。反例：[pagination-initial-without-total-count](../errors/pagination-initial-without-total-count.json)、[pagination-initial-not-full-page](../errors/pagination-initial-not-full-page.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-exclusive-source`：查询分页表格必须独占页面数据源。反例：[pagination-shared-source](../errors/pagination-shared-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-toolbar-search`：表格工具区由6.21引入，搜索显式引用文本标量字段。反例：[table-toolbar-before-6.21](../errors/table-toolbar-before-6.21.json)、[table-search-nontext-field](../errors/table-search-nontext-field.json)、[table-search-duplicate-field](../errors/table-search-duplicate-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `paged-join`：6.22 组合表全局视图与普通查询定义引用；记录模式成员独立消费查询参数。反例：[paged-join-non-record-member-parameter](../errors/paged-join-non-record-member-parameter.json)、[record-join-unknown-member-parameter](../errors/record-join-unknown-member-parameter.json)、[table-number-range-before-6.22](../errors/table-number-range-before-6.22.json)、[paged-join-initial-predicate-null](../errors/paged-join-initial-predicate-null.json)、[paged-join-initial-predicate-in](../errors/paged-join-initial-predicate-in.json)、[paged-join-initial-predicate-numeric](../errors/paged-join-initial-predicate-numeric.json)、[paged-join-initial-predicate-date](../errors/paged-join-initial-predicate-date.json)、[paged-join-before-6.22](../errors/paged-join-before-6.22.json)、[paged-join-unknown-member](../errors/paged-join-unknown-member.json)、[paged-join-invalid-key](../errors/paged-join-invalid-key.json)、[paged-join-invalid-projection](../errors/paged-join-invalid-projection.json)、[paged-join-member-topn](../errors/paged-join-member-topn.json)、[paged-join-shared-root](../errors/paged-join-shared-root.json)、[paged-join-invalid-initial](../errors/paged-join-invalid-initial.json)、[table-number-range-non-numeric](../errors/table-number-range-non-numeric.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-search-options`：6.42 静态搜索选项唯一、默认项有效且每项引用文本字段。反例：[table-search-options-before-6.42](../errors/table-search-options-before-6.42.json)、[table-search-options-duplicate](../errors/table-search-options-duplicate.json)、[table-search-options-default-missing](../errors/table-search-options-default-missing.json)、[table-search-options-nontext](../errors/table-search-options-nontext.json)、[table-search-options-unmapped](../errors/table-search-options-unmapped.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-row-expansion`：6.44单层子表格的作用域、只读及查询分页约束。反例：[row-expansion-before-6.44](../errors/row-expansion-before-6.44.json)、[row-expansion-missing-parent-key](../errors/row-expansion-missing-parent-key.json)、[row-expansion-query-local-page](../errors/row-expansion-query-local-page.json)、[row-expansion-unbound-parent](../errors/row-expansion-unbound-parent.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-pinned-top`：独立完整查询置顶，明确字段及行域归属。反例：[pinned-top-version](../errors/pinned-top-version.json)、[pinned-top-main](../errors/pinned-top-main.json)、[pinned-top-window](../errors/pinned-top-window.json)、[pinned-top-unknown-field](../errors/pinned-top-unknown-field.json)、[pinned-top-incomplete](../errors/pinned-top-incomplete.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `paged-union`：多来源逐行合并、显式字段投影与全局视图。反例：[union-uuid-old](../errors/union-uuid-old.json)、[union-uuid-conflict](../errors/union-uuid-conflict.json)、[union-initial-predicate-null](../errors/union-initial-predicate-null.json)、[union-initial-predicate-date](../errors/union-initial-predicate-date.json)、[union-initial-predicate-numeric](../errors/union-initial-predicate-numeric.json)、[union-initial-predicate-in](../errors/union-initial-predicate-in.json)、[union-before-6.61](../errors/union-before-6.61.json)、[union-missing-source](../errors/union-missing-source.json)、[union-missing-mapping](../errors/union-missing-mapping.json)、[union-incompatible-unit](../errors/union-incompatible-unit.json)、[union-null-required](../errors/union-null-required.json)、[union-source-window](../errors/union-source-window.json)、[union-invalid-key](../errors/union-invalid-key.json)、[union-source-navigation-field](../errors/union-source-navigation-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-column-visibility`：列显隐条件与版本下限。反例：[table-column-old-version](../errors/table-column-old-version.json)、[table-column-row-context](../errors/table-column-row-context.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-column-search-fields`：列搜索须关联主、次或徽标字段。反例：[table-column-unowned-search](../errors/table-column-unowned-search.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-hierarchy-selection`：6.70显式归属定位、父行投影、私有选择及完整父子导出。反例：[hierarchy-old-version](../errors/hierarchy-old-version.json)、[hierarchy-parent-window](../errors/hierarchy-parent-window.json)、[hierarchy-without-selection](../errors/hierarchy-without-selection.json)、[hierarchy-export-fields](../errors/hierarchy-export-fields.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-column-enums`：前端列枚举值唯一及版本下限。反例：[table-enums-old-version](../errors/table-enums-old-version.json)、[table-enums-duplicate-value](../errors/table-enums-duplicate-value.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-header-filter-defaults`：select 原始值默认筛选、字段类型与版本下限。反例：[table-header-defaults-old-version](../errors/table-header-defaults-old-version.json)、[table-header-defaults-duplicate](../errors/table-header-defaults-duplicate.json)、[table-header-defaults-wrong-type](../errors/table-header-defaults-wrong-type.json)、[table-header-defaults-unknown-enum](../errors/table-header-defaults-unknown-enum.json)、[table-header-defaults-remote-sharing](../errors/table-header-defaults-remote-sharing.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-table.json)：独立完整页面，保留必要语义依赖。
- [reportCompact](../examples/component-table-reportCompact.json)：独立完整页面，保留必要语义依赖。
- [embedded](../examples/component-table-embedded.json)：独立完整页面，保留必要语义依赖。
- [forecastMatrix](../examples/component-table-forecastMatrix.json)：独立完整页面，保留必要语义依赖。
- [table-trend-arrows](../examples/table-trend-arrows.json)：完整合法页面；查询仅为静态契约证据。
- [query-dashboard](../examples/query-dashboard.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-export-column-actions](../examples/reference-export-column-actions.json)：完整合法页面；查询仅为静态契约证据。
- [table-toolbar-page](../examples/table-toolbar-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-number-range-page](../examples/table-number-range-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-fixed-rank-page](../examples/paged-join-fixed-rank-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-search-options-page](../examples/table-search-options-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-row-expansion-inline](../examples/table-row-expansion-inline.json)：完整合法页面；查询仅为静态契约证据。
- [table-row-expansion-query](../examples/table-row-expansion-query.json)：完整合法页面；查询仅为静态契约证据。
- [table-row-expansion-inputs](../examples/table-row-expansion-inputs.json)：完整合法页面；查询仅为静态契约证据。
- [table-row-expansion-none](../examples/table-row-expansion-none.json)：完整合法页面；查询仅为静态契约证据。
- [table-row-number-page](../examples/table-row-number-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-scalar-fallback-page](../examples/table-scalar-fallback-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-pinned-summary-page](../examples/table-pinned-summary-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-page](../examples/paged-union-page.json)：完整合法页面；查询仅为静态契约证据。
- [paged-union-branches](../examples/paged-union-branches.json)：完整合法页面；查询仅为静态契约证据。
- [table-column-visibility](../examples/table-column-visibility.json)：完整合法页面；查询仅为静态契约证据。
- [table-hierarchy-selection](../examples/table-hierarchy-selection.json)：完整合法页面；查询仅为静态契约证据。
- [table-child-keyless](../examples/table-child-keyless.json)：完整合法页面；查询仅为静态契约证据。
- [table-hierarchy-lookup-param](../examples/table-hierarchy-lookup-param.json)：完整合法页面；查询仅为静态契约证据。
- [paged-join-query-page](../examples/paged-join-query-page.json)：完整合法页面；查询仅为静态契约证据。
- [record-join-query-page](../examples/record-join-query-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-column-enums](../examples/table-column-enums.json)：完整合法页面；查询仅为静态契约证据。
- [period-comparison-query-page](../examples/period-comparison-query-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-multiple-pinned-page](../examples/table-multiple-pinned-page.json)：完整合法页面；查询仅为静态契约证据。
- [table-header-filter-defaults](../examples/table-header-filter-defaults.json)：完整合法页面；查询仅为静态契约证据。
- [table-header-filter-defaults-query](../examples/table-header-filter-defaults-query.json)：完整合法页面；查询仅为静态契约证据。
- [table-header-select-all](../examples/table-header-select-all.json)：完整合法页面；查询仅为静态契约证据。
- [table-header-select-all-query](../examples/table-header-select-all-query.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-table.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "sales-tabs-detail",
  "type": "table",
  "layout": {
    "span": 12
  },
  "data": {
    "main": "demo"
  },
  "props": {
    "title": "销售明细：内联演示数据",
    "columns": [
      {
        "field": "name",
        "title": "演示内容"
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/table.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/table/expansion.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/table/validate-expansion.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/table/validate-selection.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/table/header-defaults.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/0`：[合法完整页面](../examples/tab-mixed-content.json)，JSON Pointer `#/sections/0/components/0/props/tabs/1/components/2/props/toolbar/search`。
- `#/definitions/tableComponent/properties/props/properties/toolbar/properties/search/anyOf/1`：[合法完整页面](../examples/table-search-options-page.json)，JSON Pointer `#/sections/0/components/0/props/toolbar/search`。
- `#/definitions/tableColumnNode/anyOf/0`：[合法完整页面](../examples/component-table.json)，JSON Pointer `#/sections/0/components/0/props/columns/0`。
- `#/definitions/tableColumn/properties/pinnedTop/anyOf/0`：[合法完整页面](../examples/chart-table-unit.json)，JSON Pointer `#/sections/0/components/5/props/columns/1/children/0/pinnedTop`。
- `#/definitions/tableColumn/properties/pinnedTop/anyOf/1`：[合法完整页面](../examples/chart-table-unit.json)，JSON Pointer `#/sections/0/components/5/props/columns/0/pinnedTop`。
- `#/definitions/tableColumn/properties/enumValues/items/properties/value/anyOf/0`：[合法完整页面](../examples/table-column-enums.json)，JSON Pointer `#/sections/0/components/0/props/columns/1/enumValues/0/value`。
- `#/definitions/tableColumn/properties/enumValues/items/properties/value/anyOf/1`：[合法完整页面](../examples/table-trend-arrows.json)，JSON Pointer `#/sections/0/components/0/props/columns/6/enumValues/0/value`。
- `#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0`：[合法完整页面](../examples/filters-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/selection/writes/region`。
- `#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1`：[合法完整页面](../examples/filters-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/selection/writes/city`。
- `#/definitions/tableColumn/properties/filterable/anyOf/0`：[合法完整页面](../examples/unified-overflow-header.json)，JSON Pointer `#/sections/0/components/0/props/columns/16/filterable`。
- `#/definitions/tableColumn/properties/filterable/anyOf/0/properties/defaultValues/items/anyOf/0`：[合法完整页面](../examples/table-header-filter-defaults.json)，JSON Pointer `#/sections/2/components/0/props/columns/1/filterable/defaultValues/0`。
- `#/definitions/tableColumn/properties/filterable/anyOf/0/properties/defaultValues/items/anyOf/1`：[合法完整页面](../examples/table-header-filter-defaults.json)，JSON Pointer `#/sections/2/components/0/props/columns/2/filterable/defaultValues/0`。
- `#/definitions/tableColumn/properties/filterable/anyOf/1`：[合法完整页面](../examples/unified-overflow-header.json)，JSON Pointer `#/sections/0/components/0/props/columns/14/filterable`。
- `#/definitions/tableColumn/properties/openDetail/anyOf/0`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/7/components/0/props/columns/0/openDetail`。
- `#/definitions/tableColumn/properties/openDetail/anyOf/1`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/4/components/0/props/columns/0/openDetail`。
- `#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/0`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/4/components/0/props/columns/0/openDetail/bindings/detail-customer`。
- `#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/1`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/5/components/0/props/columns/0/openDetail/bindings/detail-customer`。
- `#/definitions/tableColumn/properties/openDetail/anyOf/1/properties/bindings/additionalProperties/oneOf/2`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/6/components/0/props/columns/0/openDetail/bindings/detail-customer`。
- `#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/0`：[合法完整页面](../examples/tab-url-source.json)，JSON Pointer `#/sections/0/components/1/props/columns/0/navigate/query/sales-tab`。
- `#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/1`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/9/components/0/props/columns/0/navigate/query/customer`。
- `#/definitions/tableColumn/properties/navigate/properties/query/additionalProperties/oneOf/2`：[合法完整页面](../examples/reference-export-column-actions.json)，JSON Pointer `#/sections/10/components/0/props/columns/0/navigate/query/customer`。
- `#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/0`：[合法完整页面](../examples/paged-union-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/navigateBySource/cases/contract/query/record-id`。
- `#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/1`：[合法完整页面](../examples/paged-union-branches.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/navigateBySource/cases/contract/query/route-label`。
- `#/definitions/tableColumn/properties/navigateBySource/properties/cases/additionalProperties/properties/query/additionalProperties/oneOf/2`：[合法完整页面](../examples/paged-union-branches.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/navigateBySource/cases/contract/query/from`。
- `#/definitions/arrowRule/oneOf/0`：[合法完整页面](../examples/table-trend-arrows.json)，JSON Pointer `#/sections/0/components/0/props/columns/2/arrowRule`。
- `#/definitions/arrowRule/oneOf/1`：[合法完整页面](../examples/table-trend-arrows.json)，JSON Pointer `#/sections/0/components/0/props/columns/1/children/0/arrowRule`。
- `#/definitions/tableColumnNode/anyOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/5/props/columns/0`。
- `#/definitions/tableComponent/properties/props/properties/pagination/oneOf/0`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/5/props/pagination`。
- `#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/6/props/pagination`。
- `#/definitions/tableComponent/properties/props/properties/pagination/oneOf/2`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/pagination`。
- `#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/0`：[合法完整页面](../examples/table-hierarchy-lookup-param.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/selection/parentLookup/bindings/lookup-year`。
- `#/definitions/tableRowExpansion/properties/selection/properties/parentLookup/properties/bindings/additionalProperties/anyOf/1`：[合法完整页面](../examples/table-hierarchy-selection.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/selection/parentLookup/bindings/lookup-office`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/0`：[合法完整页面](../examples/table-row-expansion-inline.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/data`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/1`：[合法完整页面](../examples/table-row-expansion-query.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/data`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0`：[合法完整页面](../examples/table-row-expansion-query.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/data/bindings/customer-default`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/0`：[合法完整页面](../examples/table-row-expansion-query.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/data/bindings/customer-default`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/1`：[合法完整页面](../examples/table-row-expansion-inputs.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/data/bindings/segment-0`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/0/oneOf/2`：[合法完整页面](../examples/table-row-expansion-inputs.json)，JSON Pointer `#/sections/1/components/0/props/rowExpansion/data/bindings/segment-1`。
- `#/definitions/tableRowExpansion/properties/data/oneOf/1/properties/bindings/additionalProperties/anyOf/1`：[合法完整页面](../examples/table-hierarchy-selection.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/data/bindings/detail-office`。
- `#/definitions/rowExpansionTable/properties/pagination/oneOf/0`：[合法完整页面](../examples/table-row-expansion-none.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/table/pagination`。
- `#/definitions/rowExpansionTable/properties/pagination/oneOf/1`：[合法完整页面](../examples/table-row-expansion-inline.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/table/pagination`。
- `#/definitions/rowExpansionTable/properties/pagination/oneOf/2`：[合法完整页面](../examples/table-row-expansion-query.json)，JSON Pointer `#/sections/0/components/0/props/rowExpansion/table/pagination`。

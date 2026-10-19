# 已有权限下的页面显隐与区域联动：统一规则执行方案

更新：2026-10-19。状态：用户已确认统一规则方向及容器简化要求；本仓实现已完成，正在完成最终回归与分发验收；真实内网接入单列未验。本文为本批唯一执行入口，替代此前待审提案中的容器策略和重复确认项。

目标是让页面作者只学习一套条件声明，让引擎集中维护求值、展示投影和筛选提交。已有后端数据权限继续沿用；CloudIOC 专属身份、凭据和接口映射留在仓库外 Deployment Adapter。

## 1. 已确认范围与实施基线

### 1.1 已确认的规则

1. 条件就地声明：`visibleWhen` 控制展示，`enabledWhen` 控制动作；各位置共用同一条件语法、校验和求值。
2. 条件允许展示、当前导航选择、数据快照状态分别拥有事实，最终组合呈现。
3. 节点只受自身和父级条件约束。父级隐藏覆盖后代；子项全部隐藏不改变父级，保留父级标题、外观和原有布局占位。
4. 不增加必要子项列表、容器完整性策略、子项计数或空容器自动收起。需要整块隐藏时直接声明父级条件，后代不重复相同条件。
5. 筛选器、内容分区、组件、单个 Tab、表格行、按钮与既有交互入口、局部文字纳入同一批交付；保持现有有界组件树和表格 Tab 内容约束。
6. 查询条件变化通过既有 `filterBindings` 和依赖图刷新；隐藏不自动停查，不将展示条件编译成 DQE。
7. 页面导出冻结当前筛选和事实，展开全部条件允许的分区和 Tab；普通导航选择不缩小正文范围。
8. 权限沿用已有结果，不新建第二套内容权限系统；权限修订先硬失效旧实例、数据、详情和导出。
9. 完整本地表格支持行展示投影；query／pagedJoin 的全局范围变化走查询绑定。本批不开放仅删当前窗口行的模式。
10. 不建立顶层具名规则库、任意表达式语言、节点之间的规则依赖或增量规则调度器。

这些决定已在本会话确认，实施不重复请求同一范围的批准。真实架构冲突或外部接入缺项应按具体阻碍处理；不能用文档落盘替代产品验收。

### 1.2 基线与并行工作保护

- 2026-10-19 已 fetch，`origin/main` 为 `9c39d6455776cfbd0084d78394fe4edeb55dc3f7`，页面写出版本 `6.33`。
- 原 `main` 检出含其他任务未提交改动，保持原样；本批在独立 worktree 的 `codex/unified-visibility` 实施，协议写出版本为 `6.34`。
- 主线已新增图表呈现扩展和 `initialTabUrlParam`／`initial-tabs.ts`。显隐接线必须保留这些行为，不以旧工作区为产品基线。
- 不预占 `6.34` 或 ADR 编号。B0 扫描实际最新版本与 ADR 后登记本批能力；之后主线推进时先核对冲突。
- 本轮仅更新本计划与计划索引；未修改产品协议、派生 Skill、ADR 或运行时代码，未提交、推送。

相关约束：[ADR 基线](../adr/README.md)、[页面文档结构](../adr/topics/page-document-structure.md)、[数据获取与查询](../adr/topics/data-fetching-and-query-model.md)、[功能与协议能力验收](../agents/feature-acceptance.md)。

## 2. 当前能力与本批接线位置

| 现有能力 | 当前真源／实现入口 | 本批处理 |
|---|---|---|
| strict 页面、分区和组件 Schema | `packages/page/src/schema/`、`page.ts`、`validate.ts`、`version.ts` | 增量条件字段与闭集成员，保持原结构校验 |
| 静态筛选显隐 | `runtime-ui/src/filters/filter-bar.ts` | 静态限制与动态判定组合，隐藏控件不删除筛选状态 |
| 内容分区组 | `runtime-ui/src/section-navigation.ts`、`RuntimeSurface.svelte` | 条件允许与当前选组分开，公共分区仍按原约定处理 |
| 卡内 Tab、URL 初选 | `ComponentRenderer.svelte`、主线 `initial-tabs.ts`、widgets 的 TabContainer | 条件裁剪可用页签；保留 URL 初选、用户选择及回退 |
| 共享筛选与查询刷新 | `runtime/src/filter-state.ts`、`orchestrator.ts`、`data-execution/src/filter-values.ts` | 收口写入口和空选层级，复用查询订阅 |
| 候选级联 | `runtime/src/dimension-values.ts`、`runtime-ui/src/filters/cascade.ts` | 完整请求身份、代次校验、递归后代清理 |
| 地图层级 | `runtime-ui/src/map-hierarchy.ts` | 读取同一层级事实，保留底图与地图行过滤 |
| 表格视图 | `data-execution/src/table-view.ts`、`runtime/src/table-session.ts`、`runtime-ui/src/table-controller.ts` | 在完整本地结果的视图前增加行投影，状态仍由 TableSession 提交 |
| 筛选文本与片段组合 | `page/src/filter-text-value.ts`、`text-value.ts`、`runtime-ui/src/filter-text.ts` | 沿用整值引用与组合；另为 text 正文增加受控条件片段 |
| 导出 | `runtime/src/export-snapshots.ts`、`runtime-ui/src/ExportView.svelte`、`export-render-state.ts`、`report-view.ts`、`table-export.ts` | 共用条件与行投影；不另写导出规则解释器 |
| 创作与分发 | 平台 workbench、Python editing／validation、`tools/scripts/export-authoring-contracts.ts` | 规则创建、编辑、重开、校验和仓外安装同批闭合 |

表中 runtime 路径以 `packages/engine/` 为根；data-execution 和 page 分别以 `packages/data-execution/`、`packages/page/` 为根。新增文件名见后文，均为拟新增，不代表当前已存在。

## 3. 页面协议的具体增量

### 3.1 公共条件

拟新增 `schema/condition.ts` 和 `condition.ts`。前者持有 strict Schema，类型从同一真源推导；后者负责上下文校验和纯求值。内部文件可按职责拆分，不增加新发布包。

条件只有布尔组合和受控比较：

| 来源 | 拟议形状 | 值与合法上下文 |
|---|---|---|
| 筛选层级 | `{filter, part:"level", op, value}` | 层级筛选器的当前层级 ID；可在普通节点使用 |
| 筛选取值 | `{filter, part:"values"或"value"或"from"或"to", op, ...}` | 根据已声明筛选器类型限定 part、操作和值类型 |
| 已有权限 | `{permission:"已有结果键"}` | 等价于该布尔事实严格为 true；仅从集成输入读取 |
| 业务事实 | `{fact:"业务事实键", op, ...}` | 只读的具名标量或标量集合，不支持点路径 |
| 当前行 | `{row:"字段ID", op, ...}` | 仅表格行、行内入口及明确传入当前行的已有动作位置合法 |
| 组合 | `{all:[...]}`、`{any:[...]}`、`{not:...}` | 复用同一子条件类型，不引用其他节点判定 |

操作集合及类型规则：

- 标量：`eq/ne`、`in/notIn`、`isNull/isNotNull`；数值另支持 `gt/gte/lt/lte`，与已有结果输入过滤词汇对齐。
- 集合：`containsAny/containsAll`，使用 `values`；集合和字符串可用 `isEmpty/isNotEmpty`。维度多选始终为集合，禁止隐式标量化。
- `value` 是单个字面量，`values` 是字面量集合；二者按操作互斥。不做字符串、数字、布尔之间的类型转换。
- 默认层级从已声明的 `defaultLevel` 或 hierarchy 首项解析；无筛选值时不能把层级当作未知。
- 普通维度无附加选择视为已知空集合；其他筛选类型没有已应用值时按已知空值处理，需用显式空值操作判断。未知外部事实与业务空值不同。
- `isNull/isNotNull` 只用于标量，`isEmpty/isNotEmpty` 不接收数值和布尔。缺少已声明行字段是输入错误；字段合法且值为 null 则按空值规则处理。
- 布尔组合最多 4 层、64 个叶子；`all/any` 至少一项；集合最多 1000 个字面量，全部与引用类型匹配。前置类型检查不被短路求值跳过。
- 复用已有比较词汇和必要的纯比较函数，不强行改写 `resultBindings.where`：它继续负责查询输入行，保留其专有上下文和失败语义。

本例拟议增量：

```json
{
  "visibleWhen": {
    "filter": "organization",
    "part": "level",
    "op": "ne",
    "value": "department"
  }
}
```

这里的 `organization` 和 `department` 必须是页面已声明的真实 ID。条件放在目标内容分区上，隐藏分区时同时移除标题和布局盒；恢复时按原文档结构呈现。

### 3.2 字段落点

| 对象 | 新字段所在位置 | 语义 |
|---|---|---|
| 内容分区 | `sections[].visibleWhen` | 控制该分区及其全部后代 |
| 组件，包括组合卡和 Tab 容器 | 组件顶层 `visibleWhen` | 不放到各组件专属 props 中；现有子组件闭集同步继承 |
| 筛选器 | `filters[].visibleWhen` | 只控制控件，静态 `visible:false` 始终优先；状态和查询绑定保留 |
| 单个 Tab | `props.tabs[].visibleWhen` | 同时控制页签和该 Tab 的内容 |
| 内容分区组 | `sectionGroups[].visibleWhen` | 显式控制组入口及归组分区，作为这些分区的上级门禁；未归组分区不受影响 |
| 表格行 | `table.props.rowVisibleWhen` | 一条表格私有条件，对完整本地行集求值 |
| 独立按钮 | 组件顶层 `visibleWhen/enabledWhen` | 控制按钮本身；不允许行引用 |
| 已有动作 | `actions[].visibleWhen/enabledWhen` | 控制该动作入口或点击行为，不反向隐藏所属图表或表格 |
| 直接声明的导航、详情、选择入口 | 对应导航／openDetail／selection 对象的 `visibleWhen/enabledWhen` | 共用动作门禁形状；表格单元格普通值保留，移除或禁用交互装饰与行为 |
| 表格工具栏 search／export、文本链接等已声明入口 | 入口对象的 `visibleWhen/enabledWhen` | 工具栏无当前行，禁止 row 引用；不新增任意工具栏系统 |
| text 正文片段 | `props.parts[].visibleWhen` | 只控制该片段，不推导整段 text 的显隐 |

内容分区组条件是显式门禁，不从所含分区的可见数量推导。组内所有分区隐藏仍保留组入口。章节锚点依据目标分区本身的资格与激活状态生成，不按目标分区内部是否有可见子项推断。

共享 Schema 片段在上述准入位置组合；禁止全局递归给所有 JSON 对象加字段。布局轨道、组件拓扑与条件语义分别维护。

### 3.3 按钮、固定值动作与正文片段

- 拟新增受控 `button` 组件，`props` 包含 `label`、单个现有 click `action`；初期沿用既有 UI 按钮样式，不引入自由样式字段。
- `writeFilter` 在现有行字段分支外，增加互斥的 `value:string` 字面量分支，沿用同一动作类型；一次动作仍写入一个已声明维度筛选器。层级写入通过统一提交路径保留／解析合法层级，不直接写错误维度。
- 保留现有多筛选表格 `selection.writes` 的原子提交，不另起字面值动作系统。新增层级写入形状必须声明对应层级并完成字段类型校验。
- `enabledWhen` 未声明时默认允许；隐式图表动作受门禁限制但不因此隐藏图表。按钮级与内部动作级门禁按祖先关系收窄。
- text 的 `props.parts` 与 `body` 互斥，片段为 `{id,text,visibleWhen?}`。`text` 沿用现有 Text Value，支持字面量、参数、筛选引用及现有显式组合；不再增加片段嵌套。
- `parts` 正文为纯文本，不与 `bodyFormat:"semanticHtml"` 混用，不裁切 HTML。标点和连接词由所属片段声明，隐藏后直接连接剩余文本。
- 现有全局 Text Value 的 `{parts:[字面量或引用]}` 保持原义。条件片段仅出现在 text.props.parts，明确区分两个位置，不扩展全部标题、列名与单元格富文本。

## 4. 条件求值与展示投影

### 4.1 求值的四种结果

`evaluateCondition(condition, context)` 返回 `allow/deny/pending/error` 与可定位原因，纯函数不订阅、不取数、不访问时钟或 DOM。

一条规则先解析并检查所有引用，再计算布尔值。引用错误优先返回 error；输入尚未就绪返回 pending；输入齐备才执行 all/any/not。即使 any 的一支为 true，也等待该规则其他已引用输入就绪；这是避免未知值取反和多态布尔传播的固定取舍。

输入失败只影响依赖它的节点，其余独立内容继续展示。pending/error 的内容不挂载；开发诊断保留规则位置、来源键与错误类别，不输出业务值和权限明细，不生成一个替代业务容器改变布局。

### 4.2 展示 Module 的 Interface

拟新增 `runtime/src/presentation.ts`，内部实现可拆分编译、投影与选择校正：

```ts
const program = compilePresentation(page); // 页面替换时重编译一次
const presentation = program.evaluate({ filters, displaySnapshot });
const tableRows = program.projectRows(tableLocator, completeRows, context);
```

输出按已有稳定目标定位保存 `eligible/enabled/reason` 和必要的行投影，不返回删减后的 Page。条件依赖可在编译时收集供诊断；首版每次有效输入更新线性求值，不建立跨规则依赖调度器。

运行时再用现有导航状态求当前屏幕展示：

```text
可展示资格 = 静态限制 ∧ 祖先资格 ∧ 自身 visibleWhen
可执行资格 = 可展示资格 ∧ 祖先可执行限制 ∧ 自身 enabledWhen ∧ 动作有效性
屏幕展示   = 可展示资格 ∧ 当前分区组／Tab 选择
```

程序中的祖先还包含显式所属分区组、Tab 项和动作容器。未知或错误结果沿祖先传播，子条件不得扩大父级资格。不允许条件读取其他节点的资格，不产生显隐依赖环。

### 4.3 容器与选择的固定行为

- 分区、组合卡、Tab 容器都只使用自身与祖先门禁。子项全隐藏时仍保留容器、标题和原有空壳／最小尺寸，不计数、不上推。
- 新增条件时，由统一呈现入口排除隐藏单元格，使其不占栅格位置；保留原列轨与比例，不自动重写 span、columnTracks 或补满布局。
- Tab 可用列表来自 Tab 项自身及祖先条件。首次初始化依次尝试合法 URL 初选、defaultTab、声明顺序第一项；运行期保留仍可用的当前选择，否则依次尝试 defaultTab、声明顺序第一项，不再重新消费 URL 初选。
- 所有 Tab 项不可用时，活动项为 undefined，页签和正文为空，Tab 容器仍保留。恢复后按同一规则选择，不建立“曾经隐藏前”的第二套选择历史。
- 内容分区组沿用相同选择归属；全部组不可用时仅公共且条件允许的分区展示，导航外壳按现有布局保留。
- 组或 Tab 的用户选择仍属于各自的实例状态。统一 Module 计算可用项与回退结果，原持有者提交选择，不新增一份 selectedTab/selectedGroup 镜像。
- 没有新条件的旧页面保持原来的选择和空态行为。数据加载、空结果、错误均不触发容器资格变化。

## 5. 筛选提交与候选值

### 5.1 一个提交入口

在 `runtime/src/filter-state.ts` 收口声明感知的提交处理；复用 `write/writeMany/fromURL` 对外契约，内部共用一个规范化与提交过程。RuntimeSurface 只适配事件，不再分别维护级联清理逻辑。

顺序固定为：

1. 检查目标声明、值类型、层级及图表局部固定候选约束。
2. 保留合法显式层级，补齐同层 dimension；扁平维度空集合仍表示清除。
3. 对依赖关系做递归后代失效清理；多字段写入按依赖顺序校验，清除与本次新父值不一致的后代，不把迟到的旧选择重新写回。
4. 原子提交一次完整 Map，增加一次 `filterRevision`；无变化的写入不增加修订。
5. 展示投影、文本、URL、候选与查询订阅观察同一已提交状态。查询仍自行根据绑定和依赖决定刷新范围。

下拉、图表局部筛选、图表动作、地图、表格 selection、字面值按钮、URL 初始化与历史恢复均走此路径。不得把全部输入广播成一次整页重挂。

### 5.2 空选层级与 URL

`{type:"dimension", level, dimension, values:[]}` 在层级筛选器上是合法已知状态，表示该层级无附加取值限制。无状态则按默认层级解析。两者都不生成空值 DQE 谓词。

同步修改 `data-execution/src/filter-values.ts`、effective-query 与 URL 编解码：仅有 level 的链接可恢复；无 values 时仍序列化显式 level。默认值、地图与规则读取同一层级解析函数。

核心回归为：不选地区，仅从默认层切到地区部，目标分区立即隐藏；URL 重开保持隐藏；切回其他层级恢复。

### 5.3 候选请求与级联

`dimension-values.ts` 的请求身份至少包含筛选器／消费者身份、当前 dimension、规范化上游约束和会话代次。相同完整身份可共享，不同身份不得只因 dimension 同名而串状态。

新增请求代次，每次成功、失败、取消回调同时核对会话、请求 key 和代次；abort 只负责取消，不能替代过期校验。加载状态仍区分 idle/loading/ready/empty/unavailable/error。

保持公共维度端口的业务含义；内部加载器与表头候选消费者同步迁移，外部网关只接收原 dimension、constraints、signal。权限修订通过实例失效切换会话。

候选到达后校正失效选择，不静默跳到其他地区或扩大范围；空结果与能力不可用、失败分别呈现。授权候选由已有网关供给，CloudIOC 特有接口在仓外 Adapter 组合。

## 6. 已有权限与业务事实输入

### 6.1 最小公开接缝

为 RuntimeView 与 JS mount 透传同一个可选 `displayInputs`：读取当前不可变快照、订阅变化、取消订阅。其对象在同一实例生命周期内保持稳定。

快照包含：

- `permissionRevision`：标识身份、工作空间和已有权限的一致会话；不包含用户凭据。
- `permissions`：已有结果键到 pending/ready/error 状态，ready 值严格为 boolean。
- `values`：具名业务事实到 pending/ready/error 状态，ready 值限标量或同类型标量集合。
- 依赖筛选的业务事实条目携带请求对应的 `filterRevision`；与筛选无关的条目由 Adapter 明确作为独立事实提供。旧修订条目不得参与当前求值。
- 运行时 `filter-change` 事件增加可选 `filterRevision`，外部请求响应带回同一修订。不新增规则可写的权限状态或任意 HTTP 配置。

未使用外部条件的页面无需 displayInputs。引用外部键却未配置输入源或缺键属于可定位配置错误；等待必须由 Adapter 显式发布 pending。异步读取与订阅先后由组合入口统一处理，保证首次快照更新不会丢失。

可选输入须贯通 `runtime-ui/src/types.ts`、RuntimeView、`embed/src/types.ts`、输入白名单、EmbedRoot、平台 integration/services 与工作台预览；更新公共导出清单和独立消费者。

### 6.2 生命周期

| 变化 | 行为 |
|---|---|
| 筛选／层级变化 | 保留实例，一次提交新修订；候选和绑定查询刷新，旧业务事实等待新修订 |
| 同权限修订内的事实变化 | 重算展示、校正失效选择与详情；不重置筛选和表格会话 |
| 身份／工作空间／权限修订变化 | 立即停用旧展示、交互、详情、总结和导出，取消请求；集成应用销毁旧实例并以当前身份重新初始化 |

权限修订变化后，旧 query initial、pagedJoin initial、ExecutionBootstrap、缓存、inline 文档和导出结果不得用作新身份的失败回退。集成应用重新取得合法文档与初始化；新实例就绪前不恢复旧实例。

`mount.update` 保持现有完整替换语义；普通事实推送走订阅，不用 update 模拟局部输入。权限修订由集成应用负责重挂，运行时检测到变更后先停用，不能等待重挂才清旧内容。

## 7. 表格行、动作与详情

### 7.1 完整本地行投影

`rowVisibleWhen` 仅允许用于已知完整的本地结果或固定行表，位置在既有搜索、表头筛选、排序和本地分页之前。查询首屏 initial 或自动查询分页窗口不视为完整本地结果，即使未显式声明 pagination。

统一行投影输出给 TableView/TableSession、屏幕、页内详情和 XLSX；原始快照、compute 和 resultBindings 不修改。共享一个源的其他表格不受本表条件影响。

本地总条数与页码按投影后的行集计算；合计／小计数据保持其已声明计算口径，不自动按可见行重算。源级总额与可见行求和可能不同，示例与文档明确说明。

有条件行且存在选择、详情或行动作时，要求合法稳定 `rowKey`；提交交互前按键确认行仍在当前投影中。不得用被过滤后的行下标定位原始行。条件事实变化使当前页越界时，仍由 TableSession 校正页码。

query／pagedJoin／自动远程分页下声明 rowVisibleWhen 直接校验失败并指向查询绑定方案。完整导出不得临时放宽该限制，避免屏幕和导出采用不同含义。

### 7.2 动作与详情

所有入口在显示时取得同一门禁结果，执行时再读取当前结果。可见但禁用的入口保留禁用呈现；隐藏入口保留普通业务单元格，不残留链接或点击处理。

已有导航、selection、openDetail 和动作列表在一个内部入口适配为受控动作，复用同一判定；不要求旧页面迁移到新的外层 action 包装。

条件变化后：来源节点或来源行不允许展示时关闭对应详情；普通筛选变化继续沿用现有关闭逻辑；权限修订关闭所有详情。query 详情使用自身隔离筛选状态，并消费相同权限事实修订，不读取来源页的过期行上下文。

没有当前行的独立按钮与工具栏引用 row 是校验错误。自定义内容即使存在，也只能在其页面节点门禁允许时挂载；内部私有 DOM 不自动成为规则目标，不增加 Worker 权限或网关能力。

## 8. 导出的一致性

页面 PDF／PNG 与表格 XLSX 在开始时捕获同一批筛选、filterRevision、permissionRevision、业务事实、条件判定、文字和表格会话状态。

- 页面导出遍历原页面声明，使用冻结的可展示资格，展开所有允许的分区和 Tab；不应用当前屏幕选组／选 Tab 限制。
- 父容器允许而后代全隐藏时，导出同样保留父容器标题与外观；不得在导出侧额外删除空壳。
- 单表导出仅针对当前允许且可执行的入口；完整取数后使用同一行投影、搜索和排序。现有行数／时间上限与完整性诊断保留。
- 普通筛选或业务事实变化不修改已经捕获的导出；权限修订变化立即取消，下载前再次核对权限会话。
- 详情导出沿用其隔离上下文及同一条件 Module，不另解释规则。
- 查询根集合与计算口径继续使用原 Page；导出展示过滤不裁剪 SourceProgram 执行根。
- 图表呈现透传、静态筛选标签、Worker PDF／PNG 和导出错误语义沿用主线，不回退到旧 DOM 截图入口。

冻结的是不可变数据与纯判定结果，不持有读取实时 store 的闭包。B5 用“开始导出后改变筛选／权限”验证冻结和失效语义。

## 9. 创作、版本与文档同步

### 9.1 人工与 AI 创作

沿用现有稳定定位：sectionId、filterId、componentId；嵌套对象使用 componentId 加 tabId、字段槽／字段ID、片段ID等受控位置，不开放任意 JSON Pointer 修改。

平台属性编辑和 Python editing 共用目标种类与白名单字段。创建与修改均支持规则，更新操作只改目标门禁；删除筛选器后有残留条件引用必须校验失败。隐藏节点仍出现在作者结构视图并标明原因，预览消费真实展示结果。

`authoring-layout.ts` 重排时保留新门禁字段，防止只复制 id/title/container/columnTracks 而丢失规则。保存、重开、移动组件和导出页面文档后条件精确保留。

Python `page_validation.py` 的产品 Bridge 能力探测纳入全部新字段、动作分支和 button/parts，不只判断 Schema 版本；目标合法性、规则语义均由产品 TS 判断，不新增 Python 条件求值器。人工端与 AI 端复用同一受控编辑语义。

### 9.2 版本与兼容

- B0 从最新主线选择实际下一次版本，为条件、行投影、按钮／固定值动作、条件片段登记能力路径。
- 旧页面无条件时保持原行为；新页面仅依赖筛选／行时不强制 displayInputs。
- 新字段不能借只读 5.x 或旧 6.x 标签绕过门禁。遍历 section、filter、sectionGroup、detailViews、Tab、组合卡、动作和文本片段；检测原始文档，不能等物化后再扫描。
- 新页面由旧引擎明确拒绝；不剥离条件或默认全展示。回退须保留支持该协议的引擎或恢复上一合法页面修订。
- 旧静态 visible:false 永远限制展示；新条件只能收窄。工具栏和层级选择器保持静态外观职责。
- 共享条件规则不放入中立 UI 包。公共新增仅限必要输入类型，更新 tests/public-api；纯内部编译和展示投影不默认公开导出。

### 9.3 真源与派生物

同批更新 PAGE-METADATA.md、必要时 PAGE-PARAMETERS.md，以及 docs/page-metadata 的 page、sections-and-layout、filters、actions-and-navigation、params-and-text-values、table/tabContainer/text/compositeCard 文档；新增条件语义模块和 button 组件说明，接入 reference-map。

从隔离检出的产品真源生成契约、页面参考与独立校验器。同步 `metriccanvas-authoring/SOURCES.md`、Bundle manifest、Skill 作者说明及对应生成项，复制完整 Skill 到仓外验证。工作流变化需按[真实 DS 验收流程](../agents/skill-ds-model-acceptance.md)建立无模型／确定性／真实模型／产物／浏览器的独立结论。

## 10. 实施批次与完成条件

本批交付是以下批次整体闭合；中间批次可独立验证，不以 B1 或 B4 通过宣布功能完成。依赖按顺序执行，不要求增加并行 agent。

| 批次 | 文件范围与主要工作 | 完成条件 |
|---|---|---|
| B0 基线与决策 | 隔离检出；ADR 及主题合并；本计划与验收矩阵；版本、公共输入和受控字段落点登记 | 最新主线与差异核对完成；已确认决定进入正式 ADR；没有容器回推策略 |
| B1 协议与纯求值 | page/schema、condition、validate、version、component-walk、page-param/text usages、button；合法／非法契约向量 | 全部位置与类型可表达；4 种结果、复杂度和旧版本拒绝可测；无 Svelte/HTTP 依赖 |
| B2 统一提交与候选 | runtime/filter-state、dimension-values；data-execution/filter-values及effective-query；cascade 与全部事件入口 | 仅层级空选及 URL 保留；递归级联；代次竞态；同维度不同消费者隔离；一次提交一次通知 |
| B3 展示输入与投影 | runtime/presentation、display-inputs；runtime-ui/types、RuntimeView；embed 全链路；平台 integration | 独立输入可订阅；输入更新不重置实例；权限变化硬失效；原 Page 不被投影修改 |
| B4 全部呈现入口 | RuntimeSurface、RuntimeSection、ComponentRenderer、section-navigation、Tab、表格controller/session、按钮、TextBlock、filter-bar、详情 | 六类对象共用判定；父隐藏覆盖后代；子全隐藏不收父；所有选择回退、行键和动作复核一致 |
| B5 导出 | export-render-state、ExportView、report-view、export-snapshots、table-export、详情导出 | 冻结资格；全允许内容展开；容器保留；完整行投影；权限变更取消；主线 PDF/PNG 回归 |
| B6 创作闭合 | workbench/Inspector及property-edit；metric-canvas稳定定位与authoring-layout；Python编辑／校验／工具Schema | 人工／AI可创建修改；隐藏节点可编辑；保存重开重排不丢；TS Bridge 单一语义 |
| B7 页面、分发与本地验收 | pages及目录；Playground示例事实Adapter；协议文档；契约生成器；Skill/Bundle/public-api；浏览器与独立消费者 | 验收矩阵逐条有结果；完整安装与构建通过；生成差异归本批；真实模型结论独立列明 |
| B8 CloudIOC 联调 | 仓外 Adapter 与内部账号／组织服务；本仓证据记录 | 真实权限候选、事实修订、region异步响应、撤权和导出验收；无环境时保留 NOT_RUN 和恢复步骤 |

顺序为 B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7。B8 的接口盘点可提前进行，真实接入不阻塞不依赖内网的代码与本地验收。

每批完成后记录改动文件、通过命令、证据位置和剩余项；提交和推送另按本仓 scoped-main-delivery，以显式范围交付，不把其他任务文件带入。

## 11. Playground 场景与验收矩阵

### 11.1 页面与输入

已新增并注册以下完整页面，浏览器和行为测试直接读取这些声明：

| 页面 | 可观察内容 | 环境 |
|---|---|---|
| `pages/page-visibility-region-linkage.json` | organization 的默认层、地区部、代表处；目标分区与子组件条件；Tab和分区组；按钮；片段；筛选文字；本地表格行与交互 | 本地可直接运行；需要重查的源使用明确 DQE Sim 查询 |
| `pages/page-visibility-inputs.json` | pending/allow/deny/error、外部事实迟到、权限会话改变、导出冻结和取消 | Playground 中立示例 Adapter，明显标注 Sim 事实 |
| 旧页面兼容入口 | 已有 sectionGroups、Tab URL初选、图表局部筛选、PNG/PDF 与表格导出 | 复用现有 pages，B0 登记实际 ID，不复制旧页制造第二份声明 |

Playground 示例 Adapter 通过开发应用接缝注入，不增加页面模拟权限字段或把模拟开关带入生产 Schema。目录入口必须能从 /pages/<id> 直接打开，并登记需要的 URL 参数和启动方式。

### 11.2 必测项

| 编号 | 操作／边界 | 必须观察到的结果 |
|---|---|---|
| C01 | 不选具体地区，仅切到地区部，再切回 | 目标分区连标题和占位隐藏／恢复；层级不因空 values 丢失 |
| C02 | 仅含 level 的 URL 重开、历史恢复 | 层级、控件、文字、显隐及查询字段一致 |
| C03 | 隐藏父容器；随后仅隐藏全部子项 | 前者整块消失；后者父容器、标题、外观仍保留，PDF/PNG 同样保留 |
| C04 | 条件控制筛选器，且原 visible:false | 控件门禁收窄；已提交筛选状态和查询绑定仍生效 |
| C05 | 当前 Tab/组失效、URL初选失效、全部失效及恢复 | 合法回退；全部失效无活动项；父容器／组入口不因子项数量自动消失 |
| C06 | 条件层级变化与纯 Tab 切换 | 仅绑定查询更新；纯切换不重启页面 SourceProgram |
| C07 | 同一数据源两个本地表，仅一个有行条件 | 本表行数、分页、详情、选择、XLSX 一致；另一表、raw、compute 不变 |
| C08 | query、pagedJoin或自动远程分页声明行条件 | 定位到 rowVisibleWhen 的明确校验错误，不出现短页假象 |
| C09 | 按钮、图表动作、表格导航／选择／详情、工具栏条件失效 | 入口显示／禁用一致；旧回调不执行；普通数据值保留 |
| C10 | text 正文条件片段与已有全局 parts | 片段隐藏与标点正确；既有标题组合及 semanticHtml 不变 |
| C11 | 同规则含 not/any 与缺键、pending、错类型 | 依赖规则 pending/error，不因取反或短路错误放行；不依赖该事实的内容正常 |
| C12 | 父级变化 A→B，A 的成功／失败／取消迟到 | 不覆盖 B；多级后代清理；同维度不同请求不串状态 |
| C13 | 导出期间改变筛选或事实；另测权限修订 | 普通变动保留捕获结果；权限修订取消下载，旧initial/inline/详情不复用 |
| C14 | 新条件改写旧版本、嵌套动作、详情、片段 | raw能力检测拒绝全部绕行；旧合法页面读取保持 |
| C15 | 人工／AI新建、修改、保存、重开、重排隐藏节点 | 规则精确保留、差分只改目标；产品TS与独立校验器结论一致 |
| C16 | npm、JS mount、平台预览与仓外 Skill | 输入透传和类型闭合、浏览器行为一致；无仓内软链或 Python 解释器依赖 |
| C17 | 权限／业务事实修订与URL试图覆盖事实 | 事实只读；错误修订不求值；重挂前先停用旧实例；没有凭据流入页面或Worker |

宽窄视口均检查隐藏单元格无遗留占位、恢复后的列轨和组件顺序不变；子项全隐藏的父级占位属于已确认行为，不列为布局缺陷。

## 12. 验证命令、证据与交付

### 12.1 定向验证

以下为实施时的执行命令；新增测试文件和浏览器脚本由对应批次建立，本轮未执行产品验收。

```sh
pnpm exec vitest run packages/page/tests/condition.test.ts packages/page/tests/visibility-contract.test.ts packages/page/tests/version.test.ts
pnpm exec vitest run packages/engine/runtime/tests/filter-state.test.ts packages/engine/runtime/tests/dimension-values.test.ts packages/engine/runtime-ui/tests/filter-cascade.test.ts packages/engine/runtime-ui/tests/map-hierarchy.test.ts
pnpm exec vitest run packages/engine/runtime/tests/presentation.test.ts packages/engine/runtime-ui/tests/visibility-interactions.test.ts packages/engine/runtime-ui/tests/section-navigation.test.ts packages/engine/runtime-ui/tests/export-render-state.test.ts packages/engine/runtime-ui/tests/table-export.test.ts
pnpm exec vitest run packages/engine/runtime-ui/tests/initial-tabs.test.ts packages/engine/runtime-ui/tests/filter-text.test.ts packages/page/tests/chart-option.test.ts packages/page/tests/chart-local-filter.test.ts packages/engine/runtime-ui/tests/report-pdf.test.ts packages/engine/runtime-ui/tests/report-png.test.ts
pnpm validate pages
```

现有 validate CLI 的参数是目录而非单个文件，新增页面随 pages 目录校验；不使用尚不支持的单文件调用形式。新增测试按消费方落位；上述 initial-tabs 与 chart-option 回归文件已在主线存在，隔离实施后运行。表格和导出更细的现有回归按实际影响在 B4/B5 补齐，避免只测新增功能。

### 12.2 文档、Skill 与包

```sh
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts tests/public-api.test.ts
pnpm exec tsc --noEmit -p tests/tsconfig.json
pnpm authoring:test
pnpm check
pnpm build:packages
pnpm build:playground
pnpm adr:index:check
```

Python 使用已装锁定依赖的环境；不将依赖缺失记为规则产品失败。已有错误先与隔离基线对比，新增失败修复后再继续。

最终兼容检查从明确提交的本批源码树运行 `pnpm compatibility:check`，核对 source-tree；默认 HEAD 不验证未提交工作区。需要打包前先完成本批显式提交，不能用一份旧 HEAD 的成功结果验收当前工作。

### 12.3 浏览器与真实接入

启动 Playground 和需要的 DQE Sim，已新增 `apps/playground/tests/page-visibility-browser.mjs`，入口使用 C01–C17 登记的完整页面，覆盖 npm直接渲染与平台/JS输入链。启动 `pnpm --filter playground dev --port 5185`，执行 `VISIBILITY_BASE_URL=http://127.0.0.1:5185 node apps/playground/tests/page-visibility-browser.mjs /tmp/visibility-browser`；Sim 控制只在 `page-visibility-inputs` 页面外部注入。实际命令与分层结论见 [验收记录](../evidence/page-visibility-region-linkage/result.md)。

运行浏览器期间不并行执行会导致开发服务重载的构建或契约生成。PDF/PNG 必须检查实际导出内容，而不只检查点击成功。

证据统一放入 `docs/evidence/page-visibility-region-linkage/`，记录基线 SHA、页面与输入摘要、命令、结果、截图／导出文件、NOT_RUN 原因及恢复步骤。临时机器产物留在证据消费者附近或临时目录，不堆进 docs/plan。

本地仿真与浏览器证明规则、状态和接线行为；真实 CloudIOC、Java／Relay／DQE 与真实模型分别给出结论。没有相应环境时完成其余本地工作，明确保留外部未验收状态。

### 12.4 完成定义与当前进度

- [x] 核对当前主线与旧工作区差异，记录 `6.33` 和 Tab URL初选增量。
- [x] 统一规则方向与容器简化要求已确认，执行方案收口；不再保留待审 U1–U5。
- [x] B0：隔离产品基线、正式 ADR／主题和实际版本登记。
- [x] B1–B6：协议、筛选、事实输入、投影、全部呈现入口、导出、创作完成。
- [ ] B7：Playground真实浏览器、文档、Skill仓外复制、模型／分发与兼容验证完成。
- [x] B8：真实 CloudIOC／Java／Relay／DQE 接入未运行；明确记录为 NOT_RUN，接入后按同一页面复验。

产品能力完成必须包含可直接加载的页面、真实浏览器可观察结果、协议文档和同版 Skill；计划、静态校验、提交或 push 均不等于功能完成。

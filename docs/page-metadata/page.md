# 页面、版本与布局

页面元数据是统一运行时消费的声明式文档；数据上下文、会话、修订和执行身份由宿主管理。页面id、字段id、组件id分别属于自己的命名空间，组件id在整页唯一。

平台云宝创作时，页面 ID 与会话 ID 是独立身份；删除会话 ID 后仍能按页面 ID 查询并渲染元数据，另建会话。每轮输入采用前端收齐并冻结的完整页面文档，包含尚未保存的布局与组件修改，不能用服务端旧文档替代。页面标题直接更新 meta.title；管理入口可直接更新标题、描述与可访问路径。会话、工作副本锁与部署访问路径不写入页面 params、筛选器或新建 meta 字段；本文档版本保持原义。flow-page 是合成内容演示，完整对话与恢复行为在 Platform 本地验收入口运行，不由统一运行时生成会话。

作者版本与可读范围由 `versionPolicy` 和 `supportedVersions()` 定义；本册 `index.json` 的 `schemaVersion` 标明导出时的作者版本，可读范围以 `schema.json` 为准。5.x在读取边界转换为6.x运行态文档。6.0使用layoutForm，6.1起允许layout。双字段同时出现即拒绝；缺布局默认report。normalizePageDocument只进行已声明的兼容规范化并保留文档原始字段，不将运行时参数替换结果保存。历史修订先核验原文hash再规范化。

## 旧页面继续开发与显式升级

创作期升级与渲染期兼容读取分开：local-authoring的upgrade-page.mjs默认只检查，指定新输出目录后保存原始字节、SHA256、完整目标校验通过的新页面和迁移报告，保留页面id。工具接受5.0—5.4和6.0至当前版本作为候选，检查原始能力下限，仅按明确规则转换为工具当前作者版本；不支持降级，不改变运行时可读范围。目标运行时需支持写出版本。

MC 内容包也分发同一产品实现的旧页检查与升级脚本。内容包版本、页面 schemaVersion 与模板版本独立标识；读取兼容范围由 supportedVersions() 导出，能力下限由产品检查器判定，不能用升级候选范围代替可读范围。检查分别返回读取合法性、可否迁移与语义缺口；MC 提供结论，Skill 决定是否采用。后续 Schema 更新须重新生成整包、复验旧输入并另目录产出新文件，保留原字节与迁移报告；不通过修改版本字面量自动放行未来版本或未知旧语义。

规则包含旧布局、5.x导航兼容转换，以及旧图表props.filter向组合卡内独立filterGroup的显式转换。图表id、外层跨度、筛选器默认值、选项和查询绑定保持；组合卡内旧图表筛选需在原卡内显式拆分。历史修订只读，迁移产物保存为新文档或新修订。未知属性和目标校验错误仍拒绝，不能通过丢弃查询或initial获得通过。

未知/未来版本、6.5/6.6非空数组参数旧写入语义、6.13/6.14页头filterIds自动期间文字返回具体错误并保留原件，不直接改版本号。整页升级被阻止时，原页若仍通过校验且本次修改只使用原版本能力，可以保留原版本继续局部开发；只有原页无效或需要新能力时才处理相应迁移缺口。静态成功后继续原任务并预览所涉交互；静态校验不证明真实数据执行。schema-upgrade-demo场景展示旧布局升级、继续编辑标题以及原数据和排序保留。

report定宽居中，dashboard占满宿主宽度。页面页头统一由 IocHeader 呈现。dashboardToolbar 仅兼容读取：缺省／visible 自动适配行内页头，hidden 不生成默认页头，compact 对象适配紧凑呈现及只读说明；不保留旧工具栏实现。新页面使用 iocHeader。meta.title是页面级标题，缺席时消费方可回退页头再回退页面id。

## 创作时显式选择布局形态

新页面建议显式声明 `layout: "dashboard"` 或 `layout: "report"`，便于核对用户选择；这是创作要求，读取边界继续接受省略布局并默认 report。布局形态描述外框，不按组件名称、query／inline、图表数量或是否带日期筛选自动推断。`reportHeader` 也可用于 Dashboard 对象详情；Report 专用工具带仍受其组件约束。

完整结构对照使用 `ioc-project-overview`、`ioc-opportunity-analysis`、`ioc-opportunity-list`、`ioc-project-detail`、`business-sdt-report-monthly`、`flow-analysis-report` 六个成型页面；独立本地创作 Skill 从这些页面提炼结构范式，先识别、取得明确形态确认，再分流生成。确认是创作会话行为，不新增页面字段，不由 Schema 校验器判断。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

<a id="ioc-公共页头632"></a>

## IOC 公共页头（6.36）

根级 `iocHeader` 独立于 `layout`，用于 IOC 身份与页级筛选归属。普通/密集看板和详情报表共用同一个呈现 Module；meta.title仍是目录标题。6.41 新页面声明 iocHeader 时无需同时写 dashboardToolbar；显式声明 visible/compact 与 iocHeader 仍为冲突。旧版本的显式 hidden 继续读取，没有 IOC 声明的旧页面通过同一呈现 Module 保持原布局。正文独立章节页头可保留，首个业务reportHeader或projectDetail不能重复承担页面身份。

`identity`可省略；title不声明就没有标题占位，不回退meta.title。title显式参数引用缺值显示“未命名”；code、description、tags、facts缺值整体省略。编码用label/value；标签有唯一id及显式neutral/info/success/warning/danger色调，数组决定顺序。说明为纯文本，inline或键盘可达tooltip；不接受任意HTML。facts区分queryPeriod/latestDataPeriod/refreshedAt/generatedAt；value显式TextValue，不根据kind生成当前时间。统计期间应引用已应用filter。B1尚无HeaderFactReference/displayInputs，可信时间可通过已声明参数传入。

`filterIds`依序认领已声明且静态可见的页级筛选。重复、不存在、隐藏、图表独立或详情私有筛选，以及与reportHeader重复认领均拒绝。已认领项从通用FilterBar排除，其余可见项保留。期间筛选原有Dashboard位置继续有效；report中的period须由IOC认领，期间语义和查询精度不变。详情单月仍用timePoint，不截断年季月来伪造单月；离散月份仍用dimension绑定，不能扩成连续区间。

`presentation.density`为normal/compact；`collapse`为none/firstRow，缺省normal/none。firstRow按直接容器实际换行测量，折叠保留首行，隐藏项inert并关闭弹层；展开不改值、不查询。日期复用DatePicker/PeriodFilter；月→季→年→月保留月份锚点，近一年为当前月之前12完整月。锚点与展开是实例局部状态，不写入Page。

`back:true`只表达返回意图。集成应用须同时提供非空`navigation.returnContext.entryId`与back函数才显示；直接打开无来源隐藏。B1没有完整视图快照或导航栈恢复。可选actions、有限枚举/单选、条件启用、V2候选、最新期上限和全页操作分别保留B2–B6规划，6.36不接受这些尚未交付字段。

共用筛选协调对write/writeMany/控件/action/地图/URL恢复执行整组类型与边界校验；非法组整次拒绝。依赖变化一次清理所有后代，自动清空进入待确认门禁；用户显式选择或清空才解除。非空维度初值须经当前候选验证；loading/error/unavailable或不合法候选只暂停消费它的查询及下游，无关查询继续。候选重试读取当前依赖；成功和失败都检查代次，缓存按本实例、filterId、层级、完整规范化依赖隔离。只读拦截全部用户写入口，初始化/restore仍校验，静态隐藏不意味着停止查询。门禁同时约束目标表导出和整页静态准备。

验收直接加载 `ioc-header-overview-demo`、`ioc-header-dense-filter-demo`、`ioc-header-detail-demo`、`ioc-header-month-set-demo`；查询使用本地DQE仿真条件回显，明确是合成验收。真实DQE、CloudIOC权限、Relay、门户和业务字段均需单独验证。

## 可信期间事实输入（6.39）

`RuntimeView` / JS `mount` 可传稳定的 `displayInputs:{getSnapshot,subscribe}`，订阅返回unsubscribe。snapshot为 `{permissionRevision,permissions,values,timeZone,periods:{[fact]:DataPeriodFact}}`；不使用标量权限/展示事实时仍传`permissions:{},values:{}`。ready事实含granularity(month/date)、latest，可选latestComplete、missingRanges、refreshedAt/generatedAt；其他状态为loading/empty/unavailable/error。时间戳必须带时区、按集成应用timeZone显示，不替换为浏览器当前时间。依赖筛选的事实携带filterRevision，与filter-change事件返回的修订匹配；独立数据域事实可省略。具名事实不能由Page/URL参数覆盖。

同permissionRevision事实更新保留已应用选择并重验相关候选/查询/导出；事实就绪时只初始化从未提供值的availability.initial，不能覆盖用户选择或合法URL。permissionRevision改变立即停止旧实例、清除旧展示，集成应用必须destroy/remount。原输入源及所有订阅随实例销毁清理。此接口只接期间事实，不启用待审Condition。

IOC `identity.facts[].value:{fact,part}` 只允许固定part latest/latestComplete/refreshedAt/generatedAt，并与kind匹配。状态仅影响该信息项；availability引用同一事实时才影响查询。身份标题与其他无关查询可继续显示。

期间事实沿统一`displayInputs`提供：`DisplaySnapshot`保留`permissionRevision/permissions/values`，扩展可选`timeZone/periods`具名分支；期间事实不直接当作标量Condition输入。单一订阅同步更新，两种事实共用身份撤销边界；同身份只改变展示values不触发时间查询。组合场景见`ioc-header-availability-demo`的期间说明开关。

## 唯一页头（6.41）

新页面统一声明根级 `iocHeader`，布局形态不决定业务身份。`presentation.layout` 为 `stacked`（缺省）或 `inline`；前者保留身份与筛选上下排，后者承接旧 Dashboard 标题与筛选同行。`presentation.collapse` 为 `none`、按实际首行测量的 `firstRow` 或按数量收纳的 `overflow`：不超过五项全部常驻，密集时搜索回正文，其余前四项常驻、剩余进“更多筛选”。`density:"compact"` 不执行数量收纳；搭配 inline 时为 56px 紧凑吸顶行；窄容器内筛选行自行横向滚动，说明换行，不撑开页面。

页头组件自身统一提供 **16px 底部外间距**，适用于普通行内、上下排、紧凑及静态呈现。该间距位于页头外框与后续正文之间，不是页头内部padding；不需页面JSON声明。旧工具栏适配与导出正文不再叠加另一份页头间距。未渲染页头时没有此占位。当前可观察入口为 `ioc-header-demo`、`ioc-header-standard` 与旧紧凑入口 `ioc-opportunity-analysis`。

`readOnly:true` 统一限制用户筛选写入，包括更多面板与组件动作；初始化与合法恢复保持原有机制。`note` 是页头纯文本说明。只读不阻止合法返回；显式 `back:true` 仍要求集成应用提供合法 returnContext 和 back。未声明 back 的新页头不接管返回，避免隐藏集成应用的返回入口。

所有筛选通过同一 FilterBar 接收候选重试、只读和时间事实；没有 IOC 专属筛选状态。 IOC Region 默认使用单选树形下拉，在同一棵树内选择地区部或代表处，不增加前置层级按钮；默认单选层级筛选省略 `hierarchyPicker` 即使用树形下拉；有真实父子候选时声明 `display:"tree"`、`treeSelection:"level"`、`selection.mode:"single"`，交互和候选契约见[结构树](filters.md#business-filters)。未认领的筛选留在内容区，已被 reportHeader 或图表认领的筛选不会再次进入页头。静态呈现复用 IocHeader，移除交互而保留身份与已应用条件。B6 的主题、全屏和附加操作仍未启用。

实际页面复用既有 `ioc-project-overview`、`ioc-opportunity-list`、`ioc-opportunity-analysis`：分别验证普通、更多筛选及紧凑呈现。`dashboard-period-filter` 使用同一页头且仅保留一个年份入口。旧文档回归使用完整兼容夹具，不再新增演示入口。筛选声明见[筛选模块](filters.md)。


普通行内页头（`layout:"inline"`、`density:"normal"`、`collapse:"none"`）按小箭头 `<`、标题、可选灰色标签、筛选依次进入同一个换行流；窄容器不固定两栏。标准/密集/详情合成页不自动添加说明、编码或期间事实。compact、firstRow、overflow和stacked继续各自原有呈现。返回仍要求可信 returnContext/back。完整场景见 `ioc-header-standard`、`ioc-header-dense`、`ioc-header-detail` 与 `/ioc-header-review`。

MC 内容投影与本地创作知识由同一产品参考生成。完整性诊断场景为 `mc-content-layout-demo`；内容身份、页面版本与实际部署身份分别核对。旧文件的可读性、能力下限、可迁移性和人工语义处理项分别返回，不能仅提升 schemaVersion 绕过迁移。

# 页面、版本与布局

页面元数据是统一运行时消费的声明式文档；数据上下文、会话、修订和执行身份由宿主管理。页面id、字段id、组件id分别属于自己的命名空间，组件id在整页唯一。

作者版本与可读范围由 `versionPolicy` 和 `supportedVersions()` 定义，当前写出6.39，公开读取接受5.0—5.4、6.5及6.11—6.39；本册 `index.json` 的 `schemaVersion` 标明导出时的作者版本。5.x在读取边界转换为6.x运行态文档。6.0使用layoutForm，6.1起允许layout。双字段同时出现即拒绝；缺布局默认report。normalizePageDocument只进行已声明的兼容规范化并保留文档原始字段，不将运行时参数替换结果保存。历史修订先核验原文hash再规范化。

report定宽居中，dashboard占满宿主宽度。dashboardToolbar缺省visible；hidden用于页面已有自有页头；compact对象表达紧凑工具栏，readOnly只影响呈现，不是服务权限。meta.title是页面级标题，缺席时消费方可回退页头再回退页面id。

## 创作时显式选择布局形态

新页面建议显式声明 `layout: "dashboard"` 或 `layout: "report"`，便于核对用户选择；这是创作要求，读取边界继续接受省略布局并默认 report。布局形态描述外框，不按组件名称、query／inline、图表数量或是否带日期筛选自动推断。`reportHeader` 也可用于 Dashboard 对象详情；Report 专用工具带仍受其组件约束。

完整结构对照使用 `ioc-project-overview`、`ioc-opportunity-analysis`、`ioc-opportunity-list`、`ioc-project-detail`、`business-sdt-report-monthly`、`flow-analysis-report` 六个成型页面；独立本地创作 Skill 从这些页面提炼结构范式，先识别、取得明确形态确认，再分流生成。确认是创作会话行为，不新增页面字段，不由 Schema 校验器判断。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

<a id="ioc-公共页头632"></a>

## IOC 公共页头（6.36）

根级 `iocHeader` 独立于 `layout`，用于 IOC 身份与页级筛选归属。普通/密集看板和详情报表共用同一个呈现 Module；meta.title仍是目录标题。普通看板须显式 `dashboardToolbar:"hidden"`，没有IOC声明的旧页面保持原布局。正文独立章节页头可保留，首个业务reportHeader或projectDetail不能重复承担页面身份。

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

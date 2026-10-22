# IOC 专用公共页头：全量功能特性与建设规划

日期：2026-10-16。状态：§17方案已获用户批准；B0+B1进入正式实施，当前验证与交付见§18。本文为本批唯一主计划。用户已明确内部附件无法继续回传，后续基于已有材料推进，不再把外部截图、CSV 或内部库源码设为规划前置。

## 1. 已确认范围与证据使用

| 编号 | 用户已确认内容 | 本计划处理 |
|---|---|---|
| D01 | IOC 专用，同时统一基础布局、行为并支持业务信息 | 覆盖身份区、筛选区、说明区、操作与跨页行为；通用看板保持现有默认行为 |
| D02 | 页面范围先列全，用户从中选择 | 维护全量候选与功能族；全量盘点不表示全部页面已获迁移授权 |
| D03 | 跨页采用业务链路显式继承 B | 显式声明字段映射；各页面独立状态；返回恢复来源视图，不引入全应用可变筛选单例 |
| D04 | 操作也先列全，再选择 | 既有来源操作、控件内部交互、建议新增操作分别列出 |
| D05 | 视觉按内部实现还原 A | 采用报告中的源码尺寸、顺序与外观；原页面截图与实测缺失，不承诺已证明像素一致 |
| D06 | 基于已有材料完成全量功能梳理 | 缺证据的行为采用明确推荐和失败语义，不继续索取全面调查；真实业务接入仍按事实验收 |

来源材料为 [页头整体](../../调查报告/页头/页头整体.md)、[功能详情](../../调查报告/页头/功能详情.md)、[行为补充报告](../../调查报告/页头/行为补充报告.md)、[完整调查报告](../../调查报告/页头/页头完整调查报告.md)。内部基线为 fd038ba9720c750260d9e1c4ee2ffa5787f46369；本机没有核验内部源码或运行页面。四份报告互有修正，采用较新且有具体依据的结论；仍矛盾的条目标为未验证，不猜测补齐。

本仓事实盘点基于2026-10-16工作区，当时 [version.ts](../../packages/page/src/version.ts) 为6.29；2026-10-19交接时已为6.30，本次Interface审查时源码为6.31（详见§17）。工作区含并行修改，本文不表示这些修改已提交或上线；实施时需重新核对基线及最新版本，不预占下一个版本号。

证据口径：**来源报告**只说明内部静态调查；**本仓已有**表示当前源码有对应能力；**复用扩展**表示有底座但不能直接覆盖要求；**新增**表示需产品实现；**未验证**表示实际效果或业务契约未知。全文功能均未因本次盘点获得浏览器、真实 DQE、Relay、CloudIOC、CI 或部署验收。

## 2. 产品职责与完整使用过程

IOC 页头属于页面内容，承载页面身份、业务信息、筛选入口及有限页级操作。品牌、应用主导航、用户登录和角色切换入口属于集成门户或集成应用。目录返回、草稿、修订、发布和编辑属于平台资产操作区，不并入 IOC 业务页头。

一次完整使用过程应为：读取合法页面与当前可信上下文 → 确定参数和筛选初值 → 取得授权候选与最新数据期 → 显示标题、标签与已应用条件 → 用户提交合法变化 → 原子更新相关状态、清理失效候选和表格页码 → 执行受影响查询 → 拒绝迟到结果 → 更新正文和期间说明 → 按显式映射进入目标页面 → 返回时恢复来源视图。导出捕获同一份已应用状态；身份变化中止旧会话后重新初始化。

| 职责 | 唯一所有者 | 页头能做什么 |
|---|---|---|
| 页面身份与控件位置 | 页面文档 + IOC 页头呈现 Module | 确定布局、顺序、标签和有限操作入口 |
| 已应用筛选值 | 统一运行时的 FilterState | 读取并提交用户意图，不持有另一份全局选值 |
| 草稿、展开和焦点 | 控件或页头局部状态 | 输入校验前保留草稿；展开不触发查询 |
| 候选值及失效 | 统一运行时候选 Module + 数据网关 | 展示各状态，不自行发内部 GraphQL 请求 |
| 生效查询与依赖执行 | data-execution / SourceProgram + 运行时编排 | 沿用 DQE 与筛选绑定，不在页头拼查询字符串 |
| 跨页映射 | 页面导航声明 | 只传显式允许的行、参数、筛选值 |
| 返回栈与跨页视图快照 | 集成应用 | 页头触发返回意图，运行时提供有界状态接缝 |
| 身份、已有权限和内部接口 | 集成应用及仓外 Adapter；授权由现有后端保证 | 消费合法结果及可用性，不推断授权 |
| XLSX / PDF | 现有表格导出 / 报告内置下载 Module | 引用明确目标，不重新实现取数与编码 |

## 3. 全量功能特性清单

表中“源”表示来源报告，“已有”表示本仓可复用。优先级为建议实施次序：P0 是公共页头和一致性基础；P1 是主要业务筛选与操作；P2 是复杂时间、货币和容器扩展。优先级不删除任何功能，最终选择按稳定编号进行。

### 3.1 页面身份、业务信息与布局

| 编号 | 功能 | 目标行为及规则 | 本仓情况 / 建议批次 |
|---|---|---|---|
| H01 | 页面标题 | 固定、参数、已应用筛选引用及显式片段组合；目录标题与业务页头标题可分别声明 | TextValue 已有；IOC 呈现新增，P0 |
| H02 | 返回来源 | 仅有合法返回上下文时显示；无来源隐藏，不拼 undefined，不伪造固定上一页 | 导航接缝已有，统一入口需补，P0 |
| H03 | 业务编码 | 项目、客户等编码作为有标签的身份项，长值可复制的需求单列，不默认新增复制操作 | 文本已有，布局扩展，P0 |
| H04 | 状态和业务标签 | 稳定标签顺序、显式语义/颜色；缺失项不产生空色块；不按第几个标签推断业务含义 | reportHeader 有 tags/badge，IOC 扩展，P0 |
| H05 | 副标题和说明 | 固定或动态文本、工具提示；语义富内容只沿用既有受控能力 | TextValue/说明底座已有，P0 |
| H06 | 数据期与刷新时间 | 区分查询期间、数据最新期、数据刷新时间、页面生成时间；缺值不显示成当前时间 | asOf/generatedBy 可参考，需明确可信输入，P0 |
| H07 | 无标题形态 | 合同总览等可只有筛选区，不留下空标题占位 | 源已有；新页头支持，P0 |
| H08 | 标准、密集、详情组合 | 同一 IOC 页头 Module，按声明的内容自然布局；不按正式页面 id 选样式 | 新增，P0 |
| H09 | 筛选归属和顺序 | 引用既有 filterIds；同一控件只出现一次；隐藏参数筛选、图表独立筛选不自动搬到页头 | 需统一位置归属，P0 |
| H10 | 展开/收起 | IOC 使用实际换行测量；收起保留首行；折叠不清值、不改变查询，展开状态为局部会话状态 | 与现有按数量“更多筛选”不同，新增专用策略，P0 |
| H11 | 操作区 | 按明确动作类型、目标和可用性显示；没有操作时无空区 | 旧页头无操作槽，本仓需新增，P1 |
| H12 | 长标题、多标签、窄容器 | 可用宽度归直接容器；文本换行/收缩、控件回流、弹层避免裁剪；不复制来源溢出缺陷 | 视觉结构新增，P0 |
| H13 | 键盘和辅助技术 | 返回、展开、模式、菜单具备名称、焦点、展开状态；错误关联输入；收起不留下可聚焦的不可见控件 | 同批必需，P0 |
| H14 | 加载、空值、失败、只读 | 保留身份与当前合法选值；候选失败可重试；只读说明原因；单个控件失败不抹掉其他已成功内容 | 候选状态与只读底座已有，需整合，P0 |

### 3.2 勾选、业务枚举与树形选择

下列业务字段是使用情境，不建立 34 个业务布尔开关。页面筛选声明表达数据类型与输入，IOC 页头仅引用它们。真实维度候选来自数据网关；有限、稳定的业务枚举若需内联候选，必须通过产品契约增量明确允许，不能套用图表局部 options 绕过当前页级候选规则。

| 编号 | 功能 | 选择语义与特殊要求 | 本仓情况 / 建议批次 |
|---|---|---|---|
| F01 | 仅看 Top100 | boolean；取消表示不加该限制，与“明确筛选非Top100”不同 | boolean 可复用，P1 |
| F02 | 仅看重点国代 | boolean；旧 '1'/'0' 的实际查询映射显式声明；不得用 truthiness 忽略 false | boolean/binding 可复用，P1 |
| F03 | 含 YW 客户 | boolean + 提示；受影响指标范围由绑定说明，不能暗示全部财经指标都改变 | 复用，业务映射需核，P1 |
| F04 | 仅看中资出海 | boolean；与其他区域/客户筛选按显式绑定共同作用 | 复用，P1 |
| F05 | 产业 | 多选；与业务类型的启用、清空和候选联动见 L04 | dimension 可复用，P1 |
| F06 | 区域 | 地区部/代表处明确层级；全球、清空、未就绪、无权限分别定义；多选必须真实进入查询 | 层级可复用，旧对象树与跨层混选需扩展，P1 |
| F07 | 客户分类 | 多选；pageNaType 限制和 SMB 可用性变为显式候选约束；读取候选不修改共享筛选 | dimension + 候选约束，P1 |
| F08 | 行业 | 两级选择；代码和显示名分离；父节点与叶子查询规则明确 | 可复用部分树形/层级，需适配，P1 |
| F09 | 父子客户 | 多选业务枚举；全部/空值语义显式 | dimension，P1 |
| F10 | 活动类型 | 多选、搜索候选、全选/清空；不把选项表写进页头代码 | dimension，P1 |
| F11 | 业务类型 | 两级业务分类；产业未满足条件时禁用并按声明清值 | dimension + 有界联动新增，P1 |
| F12 | 跨 BG 协同 | 动态多选；无候选与接口不可用分开，空数组不当作已支持全部 | dimension；真实候选接入未验证，P1 |
| F13 | 项目级别 | 多选；含未立项等实际业务值；没有候选证据时不猜编码 | dimension，P1 |
| F14 | 超期状态 | 多选；固定档位边界由数据/规则提供方定义 | dimension，P1 |
| F15 | 机会点阶段 | 动态多选，稳定代码进入查询；CSS等编码不由文字标签推断 | dimension，P1 |
| F16 | 无接触天数 | 档位枚举；30/60/90 的等于/至少/区间语义按实际绑定明确 | dimension 可表达档位；业务契约需核，P1 |
| F17 | 客户排序 | 来源名为排序但实际是内部/外部客户分类多选；不擅自接成表格 order | dimension，P1 |
| F18 | 是否突破 | 是/否多选，选两项为不限；需要三态时不能直接用单 boolean 代替 | dimension，P1 |
| F19 | 是否上量 | 同 F18，旧 '0' 必须作为有效字符串值保留 | dimension，P1 |
| F20 | 模型 | 候选受时间范围影响；更新时验证旧选值；旧请求不得覆盖新候选 | 维度已有，时间候选约束新增，P2 |
| F21 | 框架执行率区间 | 档位枚举，百分比刻度和边界明确；不依赖旧 DOM tag hack | dimension，P1 |
| F22 | 销毛率偏差区间 | 同 F21；偏差与增长率/百分点不混用 | dimension，P1 |
| F23 | 激励策略 | 动态多选；按当前身份与依赖条件加载 | dimension，P1 |
| F24 | 协同小组 | 授权候选；未加载、失败、无权限、无配置分别呈现，禁止无依据回退静态全量 | dimension + Adapter，P1 |

### 3.3 货币与金额

| 编号 | 功能 | 目标行为 | 本仓情况 / 建议批次 |
|---|---|---|---|
| M01 | RMB/USD 选择 | 单选业务维度，显示名与查询代码分离；只改变绑定到它的数据与展示 | dimension 可用，页级单选候选约束需补，P1 |
| M02 | 币种进入查询 | 允许显式币种条件选行或静态查询声明不同货币字段；不将人民币数值仅换美元标签 | 维度绑定可用；selectField仅查询后拷贝，USD和动态货币契约需扩展，P2 |
| M03 | 预签金额预设 | 各币种有明确单位与闭区间；“全部”两端都空；档位值来源于合法页面声明 | numberRange 有底座，预设与单位新增，P1 |
| M04 | 自定义金额面板 | 草稿内确定/取消；有限非负数；允许单边；建议 IOC 双边要求下界小于上界，保留通用范围允许相等的现有规则 | 需要可选约束与面板，不全局收紧，P1 |
| M05 | 币种切换清金额 | 一次状态提交同时换币种、清金额并重查；不能先用旧单位范围发一次请求 | writeMany 可复用，声明式联动新增，P1 |
| M06 | 表格/图表/导出一致 | 使用同一已应用币种、字段契约、单位及格式；导出捕获开始时快照 | CNY与表格导出已有；USD money/格式扩展，P2 |

本仓 money 当前仅 CNY，不能把未知美元数据声明为 CNY。推荐扩展显式 USD 金额字段与格式；优先保留 CNY/USD 两个静态货币输出，消费者按受控选择显示相应字段。现有 selectField 只在查询后将字段复制到静态 output，不改变查询投影，也不改变 output 的货币元数据；不能把两个货币字段汇入同一静态 CNY 输出后声称闭合。若只能取得一个随 currency 变化的字段，则需额外明确动态货币结果契约并单独审核，不能靠页头猜测。无汇率和换算规则时不提供前端换算。内部 DataFilterType 实现未知，不作为单位换算真源。

### 3.4 时间与期间

| 编号 | 功能 | 目标行为 | 本仓情况 / 建议批次 |
|---|---|---|---|
| T01 | 单月 | ISO YYYY-MM 状态；查询格式经已有 binding 转为 YYYYMM | timePoint 已有，P0 |
| T02 | 单日 | ISO YYYY-MM-DD 状态；查询可显式 compact | timePoint 已有，P1 |
| T03 | 月/日范围 | 完整闭区间；半区间只保留草稿，不查询 | timeRange 已有，P1 |
| T04 | 日/月切换 | 有限模式、明确切换后的默认/保留规则；原子更新模式和范围；查询聚合粒度另行声明 | 组合选择和动态绑定需扩展，P2 |
| T05 | 周/月切换 | 周选择、周所属年、起止日及回显一致；推荐新契约明确 ISO周/周一开始，旧周编码未验真 | 相对周已有，单周控件与编码缺少，P2 |
| T06 | 近1/7/30/90天 | 含锚点日，近7天为锚点减6至锚点；显式区间Tab，锚点使用同一时钟快照 | 相对范围底座已有，Tab配置新增，P1 |
| T07 | 月模式相对区间 | 月份数量、含不含当前月、未完成期明确；不能直接套用天数 | 相对月已有，组合展示扩展，P2 |
| T08 | 最近12月候选多选 | 明确候选锚点和是否含当前月；可不连续选择；不能压为最小月至最大月连续范围 | 可用维度绑定月份列；真正时间集合需新执行契约，P2 |
| T09 | 年/季/月/近一年 | 复用现有 period；近一年仍为当前月之前12完整月，不与 T08 混名 | 6.27 已有；IOC放置需同步支持范围，P1 |
| T10 | 最新数据期默认与上限 | 显式绑定指标/数据域的可信最新期；默认与最大可选值分别说明 | 最新期、max/动态约束接入新增，P1 |
| T11 | 未来/缺数/完成期 | 当前未完成期是否可选由业务声明；无数据期返回空；最新不等于已定稿 | min/disableFuture 已有部分，完成期业务事实待验，P1 |
| T12 | 期间显示与累计窗口 | 头部显示已应用值；累计、同比等窗口由查询/具名算子声明，切控件不自动改变聚合 | 文本取值/binding/算子底座已有，P0 |

T04/T05 不能通过仅换日期控件、保留旧查询粒度来冒充完整支持。计划先冻结有限模式到查询窗口/字段/聚合的映射，再扩展对应 page 与 data-execution 契约；不引入任意表达式或查询字符串改写。真实 DQE 不支持的模式标为不可用，保留上次合法选择。

T08 优先复用真实年月维度与显式 dimension 绑定，这能准确表示离散月份。数据只有 dtime 时间字段时，现有 timeRange 不支持多区间；需独立确认 DQE 能力后再交付多区间时间绑定，不静默扩大到中间月份。

### 3.5 候选、条件联动与状态一致性

| 编号 | 功能 | 目标行为 | 本仓情况 / 建议批次 |
|---|---|---|---|
| L01 | 候选来源 | 真实业务维度/授权组织走数据网关；固定业务枚举仅在受控协议允许时声明 | 唯一候选端口已有，P0 |
| L02 | 状态和错误 | 未请求、加载、就绪、空、不可用、失败分开；失败保留合法已选项但禁用不可信候选操作 | 状态底座已有，P0 |
| L03 | 级联 | 上游变化清理所有失效后代，校验依赖图，整次只提交一个状态版本 | 仅直接下游清理已有，需共用权限方案补递归协调，P0 |
| L04 | 条件启用与清值 | 产业→业务类型、币种→金额等有限规则；禁用原因可见；false/0/空数组可有效提交 | 新增有界交互规则，P1 |
| L05 | 时间→模型候选 | 候选请求显式包含已应用时间范围和当前身份；模型保留有效交集；不可再用旧候选发查询 | 端口只支持维度约束，需版本化扩展，P2 |
| L06 | 单选/多选/全选 | 单选必须校验只有一个；“全部”显示摘要而非注入 DOM；真实候选全选和不加条件分别明确 | 多选已有，页级单选/枚举约束需补，P1 |
| L07 | 初始化顺序 | 参数初始化→合法显式URL/导航输入→统一校验→候选/依赖就绪→执行；不会用异步到达顺序定义优先级 | 现有初始化可复用，候选门禁需补，P0 |
| L08 | 原子提交 | 日期模式、币种/金额、层级/后代一次提交；无效草稿不覆盖已应用状态 | writeMany已有，统一写入口需扩展，P0 |
| L09 | 查询刷新 | 只刷新绑定变化及依赖闭包；页码重置到1，保留有效排序；隐藏组同样处理受影响表格 | 部分规则已有，需整合验收，P0 |
| L10 | 候选缓存与迟到响应 | 身份/权限代次、filterId、层级、完整规范化依赖为请求身份；成功/失败/取消回调都检查代次 | 当前按dimension缓存存在缺口，共用整改，P0 |
| L11 | 只读/禁用/显隐 | 只读不等于无权限；静态隐藏不自动停止查询；动态规则复用已有权限方案的有限条件 | 整体只读已有；动态规则仍待建设，P1 |
| L12 | 页头搜索 | 明确目标源、匹配字段、范围、服务端能力后才显示；表格本地/全量搜索保持表格归属 | 页头search UI有但DQE绑定不闭合，候选扩展，P2 |

禁止隐藏条件继续影响未授权页面、禁止读取某页候选时反向修改全局筛选、禁止进入 Token 页删除其他页面状态、禁止无候选证据回退“全部可选”。候选错误不会自动转成空选后放宽查询。

## 4. 跨页继承与返回恢复

| 编号 | 功能 | 推荐规则 | 本仓情况 |
|---|---|---|---|
| N01 | 概览→列表→详情传值 | 源与目标按显式映射传区域、期间、币种、实体键等；相同名字不自动继承 | row/param/filter→URL 已有 |
| N02 | 不兼容值 | 源页先验证类型、粒度、层级和必需输入，不强转；目标页取得授权候选后再校验范围，未知时允许进入加载态但不启动依赖它的业务查询；不合法时明确说明 | 需补一致验证与错误呈现，不要求源页预取目标候选 |
| N03 | 页面独立 | 进入目标复制合法初值，后续修改不反写来源或参数；无全局共享单例 | FilterState与initialParam已有 |
| N04 | 返回筛选/参数 | 真实来源导航条目保存来源查询串与修订；直接进入无来源不构造返回 | Playground有简单来源槽；需实例隔离 |
| N05 | 完整阅读状态 | 在同一可信上下文中恢复筛选、查询分页、排序、表头条件、内容组/Tab、滚动；重建后重新验证合法性 | 尚无统一视图快照，需新增有界接缝 |
| N06 | 多来源/多窗口 | 返回条目按导航实例区分，不能只以目标pageId覆盖唯一槽位；新窗口不消费另一窗口历史 | 集成应用需补 |
| N07 | 页面修订变化 | 文档/字段/筛选身份变化后丢弃不兼容快照项；通知用户已恢复范围，不按数组序号套状态 | 新增验证 |
| N08 | URL与刷新 | URL显式承载可序列化状态；刷新不依赖内存单例；不承诺浏览器重启后永久保留完整阅读状态 | 编码底座已有，平台接线未闭合 |

进入方式分三条定义，避免混成一个全局“优先级”：

1. **直接打开/显式导航**：先用页面默认或 initialParam 形成初值，再由合法 URL/导航映射覆盖；目标输入有唯一写者，冲突配置拒绝。继承字段只是目标的初始化输入。
2. **返回来源**：集成应用取得来源条目和匹配文档，再向运行时恢复有界视图快照；校验后一次提交合法筛选，再恢复有效表格和内容状态；不重放过期业务数据快照。
3. **执行快照打开**：已有执行快照只有在页面、参数、筛选及可信上下文匹配时消费；不得用旧执行快照覆盖新的显式导航输入。不匹配则重新执行或明确拒绝，不能静默选一份。

N05 推荐纳入基础建设目标，但不视为用户已选择全部内部页面迁移。恢复失败降级为合法筛选/参数及默认视图；权限已变化则不恢复旧业务状态。导航栈仍归集成应用，运行时只提供状态导出/验证/恢复的有界 Interface，不提供浏览器路由器或长期历史服务。

快照只保存交互状态、页面/修订和可信上下文引用，不保存业务数据行、权限令牌或已有查询结果。推荐同一窗口当前会话最多保留20个来源条目，淘汰后按合法筛选/参数降级；身份或权限修订变化立即清空。数量属于可配置工程上限，不能以快照存在作为访问授权。

## 5. 全量操作候选

| 编号 | 操作 | 来源与范围 | 推荐位置与状态 |
|---|---|---|---|
| O01 | 返回 | 内部页头已有 | 保留页头内；接 N04–N06，P0 |
| O02 | 展开/收起 | 内部页头已有 | 页头布局交互；不算业务查询动作，P0 |
| O03 | 深浅色切换 | 内部总览已有 | 可选页级主题意图；当前引擎无对应公共行为，需覆盖正文和控件，不只改页头，P2 |
| O04 | 数据导出 XLSX | 内部页面侧；报告称多处调用，精确数量未验证 | 默认保留表格；允许页头明确引用 tableId，复用既有导出，P1 |
| O05 | 全屏/退出全屏 | 内部客户/经营/伙伴/项目地图页面侧 | 显式指定整个页面或组件目标；默认整个渲染实例，失败保留可用界面，P1 |
| O06 | 金额确定/取消 | 页头金额面板内部 | 保留控件内部，确定才应用，取消不改变当前查询，P1 |
| O07 | 整页 PDF 下载 | 来源页头未证实；本仓报告已有 | 可选整页操作，独立于XLSX；IOC布局/主题/过滤作用域需适配现有内置流程，P2 |
| O08 | 刷新数据 | 来源未找到实现证据 | 建议扩展候选；保持当前已应用条件，刷新依赖闭包，不冒充清空或页面重载，待选择 |
| O09 | 重置筛选 | 来源未找到实现证据 | 建议扩展候选；按明确基线重置，一次提交，不清身份/来源，不默认全部无条件，待选择 |
| O10 | 查询/应用按钮 | 来源修改即生效 | 首期建议保持修改即生效；只有显式选择草稿提交模式才增加，待选择 |
| O11 | 更多操作菜单 | 来源未找到实现证据 | 仅在已选操作数量需要时承载同一批动作，不发明额外能力，待选择 |
| O12 | 页头搜索入口 | 来源搜索主要在页面内容区 | 保留表格搜索；全页搜索需 L12 完整消费契约，P2 |

导出、全屏实例数不等于能力种类；28个导出调用不等于28种页头动作。返回、主题、全屏、XLSX和PDF按有限动作类型分发，禁止保存 JavaScript 回调、任意菜单 HTML 或内部 URL 端点。XLSX必需明确目标表格；整页下载不暗示“所有数据完整”。行级操作保持行上下文，不无条件提升为页级按钮。

动作状态统一为可用、禁用/原因、运行中、失败可重试、能力不可用；取消和销毁终止本实例任务，迟到回执不更新新页面。具体PDF沿用当前内置下载和内部清理策略，不重新增加已移除的公共 withExportView 或用户取消按钮。

## 6. 视觉基线与近似还原规则

用户的方向仍为内部视觉 A；当前可执行基线是四份报告里的文字与源码尺寸，来源类别为 text_spec。没有真实截图、Tiny3完整主题和computed style，不把推导值称为实测，也不将本地同形页面截图当成原系统参考截图。

| 元素 | 已有外部依据 | 实施处理 |
|---|---|---|
| 外框 | 白底、满宽、22px/32px内边距 | 作为默认目标，不把尺寸写进页面JSON |
| 标题 | 24px、粗体、36px行高、右间隔40px | 基于当前可用字体实现；字体差异单列 |
| 控件行 | 报告项高28px、右间隔16px、底间隔5px | 结合实际控件盒核对，不裁切文字与点击区 |
| 折叠 | 45px判断阈值、32px折叠高度 | 保留首行展开体验；按钮、键盘、字体缩放可访问性优先，修正值需登记 |
| 币种按钮 | 36px × 30px | 作为专用紧凑按钮参考 |
| 标签 | 来源前5项自动配色 | 使用明确颜色声明或中性缺省，超过5项仍可读；不继承缺样式问题 |
| 吸顶 | 来源无sticky/fixed | 默认随内容滚动；现有compact页面不被全局修改，IOC吸顶作为可选新需求 |
| 窄容器 | 来源无明确断点，靠回流 | 采用流式布局与直接容器约束；不新造“原系统断点”；验证溢出和弹层 |
| 控件主题/图标 | Tiny3小型主题、ti-icon，资源未取得 | 复用本仓UI/图标并登记差异，不复制未知私有主题或宣称逐像素一致 |

实施按照仓库 SDD 流程从当前文字基线提炼可测规则，用户审核后冻结。视觉验证区分“本地已符合文字规则”和“原系统视觉等价未验证”。后续若有真实参考，只更新受影响视觉规则，不反推数据契约，不重做已闭合逻辑。

## 7. 推荐的产品结构与 Interface

以下是推荐设计，不是现行协议；本轮不写 Schema 或产品实现。

### 7.1 页级显式 IOC 页头声明

推荐新增可选页级 IOC 页头声明（工作名称 iocHeader），由统一运行时挂载一个 IocHeader Module。它独立于布局形态，能统一看板与当前详情页的身份区，而不强迫项目详情从 report 改成 dashboard。原有 DashboardToolbar 和 reportHeader 继续读取旧页面。

| 方案 | 优点 | 代价 / 结论 |
|---|---|---|
| 扩展 dashboardToolbar 的 ioc variant | 复用现有看板挂载点 | 详情当前为report，若强制改布局会影响外框/PDF；不作首选 |
| 页级 IOC 声明 + 专用呈现 Module | 一处身份与筛选归属、适配多布局，不开放任意嵌套 | 需新增根协议与冲突校验；**推荐** |
| 普通分区内任意放置 iocHeader 组件 | 接近原HTML调用方式 | 易多页头、嵌套筛选、重复工具栏，额外控制唯一性与顶层位置；暂不推荐 |

推荐 Interface 只包含六组声明：身份文本与标签、返回入口、filterIds及顺序、说明、有限操作及目标、必要的呈现选项。筛选类型/默认/候选/绑定仍分别保存在原有页面位置；不把34个show字段与当前值重复复制到页头。

关键约束：每个页面实例一个页级 IOC 页头；开启时不能同时出现通用 DashboardToolbar 或承担同一页面身份职责的旧业务页头，例如projectDetail。正文中的独立报告或章节页头仍允许存在。显式迁移的dashboard页面声明隐藏旧工具栏；report详情移除或替换旧首个projectDetail页头。未迁移页面行为不变。IOC引用的筛选从通用FilterBar中移除；其余可见筛选保持原位置。图表独立筛选与详情私有筛选禁止被页头认领。

标题和说明只消费现有 TextValue。查询返回的项目名称等若需要实时进入身份区，目前没有任意数据字段文本绑定；优先复用已授权页面参数初始化，真正需实时查询标题时另加明确结果绑定契约，不让纯呈现 Module 取数。

### 7.2 筛选与交互扩展采用共用底座

静态枚举/单选、范围预设、日期上限、周和离散多月、有限依赖联动、候选类型约束分别进入page真源；与现有条件显隐方案重叠的字段共用一个有限规则契约。规则仅允许已声明依赖与封闭操作，不运行表达式。实现通过统一状态协调，避免某些UI控件会清后代、地图或普通action却绕过处理。

时间型候选约束需要扩展中立候选端口和数据网关Adapter；不把页面业务HTTP端点写进Page。相同字段语义的有限模式拷贝可评估已有selectField；跨币种输出不能靠它改变货币契约。查询字段、聚合或窗口模式变化必须由可校验声明决定，selectField不替代查询能力。现行 DQE 协议边界保持，来源GraphQL只作为旧行为说明。

### 7.3 与已有权限方案的关系

复用 [已有权限下的页面显隐与区域联动计划](2026-10-15-page-visibility-and-region-interactions.md) 的候选、状态写入、依赖清理、请求代次和可信上下文失效工作；该计划仍待审核，不能当作已实现依赖。

后端既有数据权限是该计划已经确认的产品前提；内部报告未核验服务端授权，不推翻此前前提，也不提供新的生产授权验收。IOC页头只消费当前可信事实和候选。权限或身份修订变化后，旧筛选、候选、详情、导出和initial失效，集成应用重新挂载合法实例；不回退到旧权限数据。当前平台session键不含完整role/permission修订，需统一补接，不能只添加页头本地监听。

## 8. 页面与场景覆盖目录

清单用于覆盖功能族和后续选页，不宣称内部精确页面总数。内部报告的HTML、路由、组件和Tab子页计数混用，本批用逐项覆盖判断，不以42/45等总数作验收条件。用户尚未从中选择全部迁移范围。

| 功能族 | 来源页面/组件候选 | 页头重点 |
|---|---|---|
| 总览 | overview-page | 标题、刷新时间、区域、月份、币种、模式 |
| 地图概览 | customer-overview、project-overview / project-home-page、business-overview、partner-overview / partner-map | 多维度、区域层级、金额、全屏 |
| 其他概览 | commercial-market、chinese-funded-overseas、sales-administration-expense、partner-incentive | 精简筛选、周/月、提示、激励策略 |
| 专项分析 | token-specific / token-specific-page、partner-system、project-race-list / project-management-race、cross-bg-list | 日/月范围、模型候选、协同、复杂联动 |
| 机会点与项目列表 | opportunity-list、sales-project-list、opportunity-page、project-page | 返回、密集筛选、金额、项目级别、导出 |
| 客户与伙伴列表 | customer-list、activity-list、dealer-list、cloud-distributor-list、solution-provider-list | 客户分类、行业、活动、表格搜索归属 |
| 业务明细 | region-frame-deviation、region-detail、outbound-transaction-details、framework-customer-details、hypothesis-management | 业务区间、周/月、来源与层级 |
| 无接触明细 | contactless-details；contactless-na-details / contactless-kc-details / contactless-cc4-details | 三条业务路由共用组件；标题、无接触档位、返回 |
| 项目/客户详情 | project-detail、customer-detail / customer-detail-page | 动态标题、编码、标签、月份、来源状态 |
| 合同业务 | contract-business-overview、contract-detail、decision-task-details、commercial-decision-detail | 无标题、区域、多月份、参数标题、导出 |
| NA Tab子页 | customer-breakthrough、customer-activity-progress、long-term-contactless、expansion-activities、long-term-no-inspect | 共享入口与子页状态归属，避免重复订阅和筛选互相清除 |
| 经营Tab子页 | management-flow、business-income、business-revenue、product-layout-public-cloud | 子页切换、期间与区域；不把子页组件直接当完整Page嵌套 |
| 容器入口 | na-page、management-na-page、business-revenue-tab、product-layout | 外壳自身无页头；迁移需决定独立页面或现有内容组，混合Tab拓扑单列 |
| 独立报告 | exercise-efficiency-report | 原有reportHeader/期间/PDF保持独立，除非用户明确选择迁移 |
| 停用项 | management-income、product-layout中的混合云分支 | 最新报告称注释禁用；只记录，不计活跃迁移任务 |

斜线表示报告中的路由/组件名称组合，不代表所有别名关系已核验。本仓现有四页为 ioc-project-overview、ioc-opportunity-list、ioc-opportunity-analysis、ioc-project-detail。建议先承接概览/列表/详情，并保留机会点分析自身业务语义；不得把它按名称近似替换为Token专项。其他功能族用完整合成页面验收，实际业务页迁移按用户最终选择逐项纳入。

本次新功能验收与既有IOC四页优化、IOC全量迁移的完成判据分别维护；页头成功不能替代整页字段/查询/全部来源入口验收。

## 9. 架构冲突、兼容与技术债务

| 编号 | 风险 | 处理与退出条件 |
|---|---|---|
| A01 | 用正式页面id挑样式/交互违反ADR-0021 | 页头由显式声明选择；id变化不改变DOM/样式 |
| A02 | 再建HeaderOptionService复制状态与查询 | FilterState与既有编排唯一写者；页面进入不删除他页状态 |
| A03 | 将IOC外观塞入中性UI，或引擎依赖CloudIOC SDK | IOC组合归engine；ui只承载中性控件；内部SDK/身份映射归外部Adapter |
| A04 | 与待审核权限/区域方案重复建条件DSL和候选缓存 | 共用相同状态协调与生命周期工作项；依赖未批准则不宣称已具备 |
| A05 | 仅改外观遗漏周/时间集合/DQE搜索/货币语义 | 真缺口分别交付协议、执行与失败语义；无服务支持不显示虚假功能 |
| A06 | 详情强制改成dashboard改变外框和PDF | 推荐页级IOC声明独立于布局；旧reportHeader保留兼容读取 |
| A07 | 双页头、双返回和重复筛选 | 根级冲突校验、单一控件位置归属；分别验平台、Playground、Embed |
| A08 | 旧candidate异步覆盖新权限或新筛选 | 完整请求身份+代次检查；成功/失败/取消均校验，加入迟到回归 |
| A09 | 返回条目按目标pageId覆盖、旧状态套新修订 | 导航实例有界快照，校验页面/修订/可信上下文，无法匹配时合法降级 |
| A10 | 将控件约束反向收紧所有页面 | IOC金额约束、时间模式等显式增量；存量numberRange等行为保持 |
| A11 | 仅换币种标签或格式造成数值含义错误 | 显式结果货币/字段选择，不确定单位则不开放该模式 |
| A12 | 全选/空候选被解释为扩大数据范围 | 空值、全部、失败、无权限各自有定义；授权始终由既有后端保证 |
| A13 | 拷贝来源DOM定时器、tag注入和fixed id | 组件状态驱动摘要、实例内定位；并列实例互不干扰 |
| A14 | 没截图却宣称精确复刻 | 按text_spec验规则；真实视觉等价保持未验证，无需继续阻塞规划 |
| A15 | 功能落地但创作/分发不支持 | 同批更新pages、文档、Schema、生成Skill、独立安装校验与兼容向量 |

新协议按现有次版本增量规则加入能力门禁，具体版本在实施基线确定。旧文档默认不出现IOC页头；不批量重写所有保存资产。迁移只改明确选择页面，保存为新修订；回退恢复匹配版本的产品与Skill，保留业务资产并尊重读写版本门禁。

新增组件/模式/货币/候选约束影响所有序列化消费者：TS类型与校验、data-execution、runtime、runtime-ui、Embed HTML、Python作者工具及契约投影、页面搭建工作台、文档、Bundle、独立Skill。示例需被安装后消费者fixture复制闭包覆盖，不能只在monorepo内通过。

## 10. 建设批次与代码职责

本表是构建分工和依赖，不是正式单app SDD tasks。正式执行按独立前端app/Story拆分，先冻结文字QA基线；本轮不制造缺输入的tasks或alpha-tests。

| 批次 | 功能范围 | 主要真源与职责 | 出口 |
|---|---|---|---|
| B0 范围与规则 | 全量盘点、选页、操作、文字视觉基线 | 本主计划；现有四份来源报告保持原样 | 明确选中的功能与允许的差异 |
| B1 页头协议与呈现 | H01–H14、O01/O02；单一身份/控件归属 | packages/page/src/schema/page.ts、page.ts、version.ts、validate.ts；runtime-ui/RuntimeSurface.svelte及新增IOC页头Module | 显式IOC声明、冲突校验、存量页面不变 |
| B2 状态与候选 | L01–L04、L07–L11、F06/F08；权限方案共享底座 | runtime/filter-state.ts、dimension-values.ts；runtime-ui/filters/cascade.ts、FilterBar.svelte；data-execution/ports.ts及绑定消费 | 所有入口原子提交、递归失效、代次隔离 |
| B3 主要业务控件 | F01–F24中非模型复杂项、M01/M03–M05、T01–T03/T06/T09–T12 | page/filter及schema/filter、query与schema/data-source中的绑定定义；runtime-ui/filters与现有中性UI；data-execution/effective-query | 业务枚举/金额预设/最新期接缝、真实绑定与失败语义 |
| B4 复杂时间/货币 | T04/T05/T07/T08、L05、F20、M02/M06 | page时间/货币/绑定契约；data-execution有效查询及候选端口；runtime状态；控件呈现 | 周、多月、时间模型与USD分别闭合，不能以一个开关验收 |
| B5 显式跨页传值 | 本轮N01–N03；N04–N08未选部分留规划 | runtime/navigate.ts、runtime-ui/types.ts；Playground、Platform与Embed导航契约 | 显式映射和目标输入校验，不实现视图恢复，见§22 |
| B6 操作与主题（挂起） | O03–O12保留规划 | 本轮不实施 | 用户明确挂起，见§22 |
| B7 创作与分发 | 所选全部特性 | 页面搭建属性/定位、metriccanvas-authoring生成/编辑、PAGE-METADATA/PAGE-PARAMETERS、local-authoring导出器与打包闭包 | 创建/编辑/保存重开/独立安装一致 |
| B8 场景与验收 | 全量选定特性 | pages、Playground目录、pages/README、行为/浏览器/安装后消费者测试 | 本地功能与真实集成证据分别报告 |

B2优先处理共用正确性，B3依赖它；B4可按周/多月/USD拆开交付。B5完整恢复不能用已有查询串返回代替。B7/B8是每一已交付能力同批完成条件，不能等所有业务页迁移后再补。

## 11. 验收场景与功能映射

依据 [新功能验收要求](../agents/feature-acceptance.md)，每个新能力均提供pages完整页面、文档和独立Skill同步。以下文件名为规划建议，尚未创建；实际生成时使用届时当前合法协议。

| 场景 | 建议完整页面 | 覆盖与关键断言 |
|---|---|---|
| C01 基础身份与无标题 | ioc-header-overview-demo | H01–H09、H13/H14；动态标题/编码/标签/期间，空标签，无标题，不重复工具栏 |
| C02 密集筛选 | ioc-header-dense-filter-demo | H10/H12/H13、F05–F24；折叠不清值，字体/容器变化重测，键盘及弹层可用 |
| C03 四类勾选 | ioc-header-business-flags-demo | F01–F04；false、0及空值真实保留，绑定只影响声明查询 |
| C04 区域与行业层级 | ioc-header-region-demo | F06/F08、L01–L03；单层多值、切层空选、父子策略、授权候选，绝不只用第一项 |
| C05 产业/业务类型 | ioc-header-dependency-demo | F05/F11、L03/L04/L08；递归清理、禁用原因、地图/action与控件写入等价 |
| C06 金额与币种 | ioc-header-currency-demo | M01–M06；非负/单边/相等边界、取消草稿、全部无上限、换币清金额一次提交，显示/导出单位一致 |
| C07 日期与最新期 | ioc-header-date-demo | T01–T03/T06/T09–T12；月底跨年、候选最新期、必选清空、非法URL、未完成期，头部与查询一致 |
| C08 日/月/周 | ioc-header-time-mode-demo | T04/T05/T07；模式切换、ISO跨年周、query聚合/窗口映射，非法模式保留合法状态 |
| C09 离散月份 | ioc-header-month-set-demo | T08；只选1月和3月时绝不查2月；不支持的上游能力如实拒绝 |
| C10 时间与模型 | ioc-header-model-demo | F20/L05/L10；A→B快速切换，旧成功/旧失败均不能覆盖；有效选值交集与空候选 |
| C11 来源与目标 | ioc-header-navigation-source / ioc-header-navigation-target | N01–N04；显式继承、局部修改隔离、详情不清来源状态、无来源隐藏返回 |
| C12 完整返回 | 同C11，扩展长列表和内容组 | N05–N08；两来源进同详情、不同窗口、分页排序Tab滚动恢复、修订变化/权限变化降级 |
| C13 操作 | ioc-header-actions-demo | 选定O03–O12；tableId明确、任务防重、失败可重试、全屏Esc/拒绝、主题全页生效 |
| C14 空与失败 | 上述页面配套失败/空响应 | L02/L11、H14；候选失败不放宽查询、查询错误不抹身份、只读原因 |
| C15 权限代次 | 区域页面配套身份切换测试 | L10/L11；旧initial/候选/详情/导出失效，合法新实例前不回退旧数据 |
| C16 多实例与生命周期 | Embed同屏双实例场景 | filterId/DOM/弹层/返回上下文隔离，销毁清理任务和监听 |
| C17 旧页面回归 | 现有四页、普通dashboard、reportHeader和PDF页 | 无IOC声明保持旧行为；迁移后单一标题/返回/筛选，日期参数不反写 |
| C18 创作和分发 | 独立安装Skill产出上述代表页面 | 配置校验、局部编辑保留无关字段、保存重开、安装包链接闭合、同源哈希一致 |

源码校验、行为测试、浏览器/本地DQE Sim、真实DQE/CloudIOC、真实Relay/模型、推送CI及部署身份分层报告。合成页面标记数据性质；用全源执行规则保护共享/隐藏消费者，不把隐藏筛选误解成停止取数。权限切换、取消和迟到响应等无法用静态页面复现的部分配独立行为测试。

视觉矩阵覆盖宽/窄/短容器、长标题、多标签、展开/折叠、下拉及不同字体回退。桌面原参考为报告建议的1440×900；1920/1024/390为观察宽度，不当作源码原有响应式断点。没有原截图时只能证明本地规则和可用性，不出具原系统像素等价结论。

## 12. 审核入口与推荐默认

| 审核项 | 推荐默认 | 状态 |
|---|---|---|
| U01 功能覆盖 | 保留本文所有功能；按P0→P1→P2推进，每项交付闭合查询、交互、创作与验收 | 全量梳理获授权，实施优先级为推荐 |
| U02 页面迁移 | 先现有IOC四页及功能样例；其他来源页面逐族选择；独立报告不自动迁移 | 待用户从清单选择 |
| U03 页头位置 | 可选页级IOC声明，统一模块、独立于布局形态，保持旧页兼容 | 架构推荐，尚未冻结 |
| U04 跨页行为 | 显式继承B已确认；完整视图恢复采用有界快照 | B已确认；快照细节为推荐 |
| U05 复杂语义 | 新周契约ISO；多月用真实月份维度优先；金额UI下界严格小于上界；USD显式货币字段 | 业务/协议推荐；不以旧代码偶然行为作为批准 |
| U06 操作 | O01/O02基础；O04明确目标表格；O05全屏可选；O03/O07–O12按需选择 | 待选择，暂不自动加入刷新/查询/全页搜索 |
| U07 视觉 | 维持内部A方向，以现有源码文字规则近似实现并登记差异 | 基于现有材料规划已授权；实测等价未验证 |

以上已把外部资料无法取得转为可管理的证据限制，而不是后续规划阻塞。真正影响某项生产交付的依赖为：实际候选/最新期数据、字段与货币单位、周/时间集合的DQE能力、CloudIOC权限修订通知和集成应用导航接线。缺少时可完成契约、实现、负向场景与合成验收，实际业务模式保持不可用或未验证，不能捏造成功。

## 13. 本轮交付状态

完成：全量功能目录、来源页面功能族、旧实现问题处理、当前能力/缺口对照、推荐Module与Interface、兼容和风险、分批建设、验收映射及审核入口。

未执行：产品代码、页面迁移、Schema/版本修改、ADR采纳、测试、原系统截图采集、真实接口/模型/浏览器验收、Git提交与推送。

相关在途工作的事实与证据分别沿用其主计划；本文不把用户批准“全量梳理”解释为批准所有新架构、所有操作或所有页面实施。

## 14. 2026-10-19新会话执行顺序

用户认可本计划作为后续工作基础，明确先做prototype、查看组件API、最后正式编码。新会话先读 [执行交接](2026-10-19-ioc-header-handoff.md)，第一阶段交付可运行原型供用户查看；按反馈审查现有API及拟议Interface，再进入产品实现。原型、API和产品验收分别记状态，本计划仍是功能范围唯一真源。

## 15. 2026-10-19第一阶段原型交付

已新增隔离的 [IOC 页头交互原型](../../packages/ui/prototypes/ioc-header/README.md)，提供八场景、同一视觉方向下的 A/B/C 布局、状态观察和88项稳定编号目录。入口、单条启动命令及待反馈项见原型 README；本地类型检查与桌面/窄屏交互证据见 [验证记录](../../packages/ui/prototypes/ioc-header/evidence/verification.md)。

当时状态：第一阶段产物已交付，待用户原型反馈；最新阶段状态见§17，正式生产编码尚未开始。所有数据与权限均为本地模拟，原型不证明真实 DQE/CloudIOC/Relay/导出或原系统视觉等价。仅新增原型目录并在本节追加入口，未修改生产组件、Page协议、业务页面、包导出或启动脚本；未提交或推送，保留工作区并行修改。

## 16. 2026-10-19原型反馈后的补齐状态

用户要求先完成原型。已针对年季月入口和后续九组缺口补齐本地交互，保留详情单月、独立单日、期间锚点和来源隔离，新增可展开树、候选异常/权限形态、三层依赖、实体导航校验、表头条件恢复、逐项动作和任务生命周期。88项各有场景入口、步骤与边界说明，分类为70项交互样例、13项契约草案、5项集成边界，不再使用默认已覆盖标签。

入口和操作见 [原型README](../../packages/ui/prototypes/ioc-header/README.md)，本地类型检查与46条浏览器操作观察见 [本次验证](../../packages/ui/prototypes/ioc-header/evidence/verification.md)。第一阶段原型已可供用户查看；随后用户明确要求进入组件元数据方案设计，第二阶段审查稿见§17，产品实现仍待Interface审查。新增与修改仅在独立原型目录，本节只追加记录；未编辑并行中的生产组件、协议、页面或启动脚本，未提交/推送。

## 17. 2026-10-19组件元数据与Interface审查稿

**阶段状态：用户已查看补齐后的原型，并明确要求进入组件元数据方案设计。本节是第二阶段审查产物；正式编码须在本节审查后开始。** §3–§5的88项范围、D01–D06和C01–C18继续有效。本节细化§7，不另建主计划，不把原型演示设置或所有可选操作默认写入产品。

### 17.1 设计结论与源码基线

推荐：**可选页级 `iocHeader` + 引擎内专用呈现Module + 共用筛选协调**。页头保存身份与位置，`filters`保存筛选语义，查询的`filterBindings`保存消费关系；已应用值只由FilterState拥有。中立UI只接收值和事件，不接收Page、DQE或CloudIOC对象。

本次只读核对的HEAD为 `8ff56a268a659dc026ec76b90d6bcc4353c48d5d`，本地源码`CURRENT_MINOR=31`。版本说明是本地源码事实，不表示远端或部署已验收；提交之后仍须复核并行变化。下述新增类型均为**拟议Interface**，当前6.31校验器不接受，未预占下一个次版本。既有类型示意省略无关属性时会明确说明。

| 现有真源 | 已有Interface／限制 | 本方案如何处理 |
|---|---|---|
| [UI导出](../../packages/ui/src/index.ts)、[DatePicker](../../packages/ui/src/components/date-picker/DatePicker.svelte) | `precision: year/quarter/month/date`，`value: {from,to}\|null`，`onchange`；min、disableFuture、disabled；年/季不支持range，没有任意max或离散可选日期 | 直接复用；动态max、周选择和合法日期集合按显式能力扩展，不另造日期库 |
| [Select](../../packages/ui/src/components/select/Select.svelte)、[Button](../../packages/ui/src/components/button/Button.svelte)、[UI类型](../../packages/ui/src/types.ts) | Select单选string与UiOption[]；Button支持loading/disabled；UI尚无导出的多选、树选 | 保留单选Interface；新增MultiSelect/TreeSelect，不把单选value改为联合类型；原型Select焦点修正须在正式批次独立回归 |
| [DashboardToolbar](../../packages/engine/runtime-ui/src/dashboard/DashboardToolbar.svelte) | title、declarations、values、candidates和六类写入回调；compact/readOnly/note/back；更多筛选按分组数量处理 | 保持旧调用；IOC按实际换行折叠，不扩展成巨大variant分支 |
| [ReportHeader协议](../../packages/page/src/schema/components/report-header.ts)、[View](../../packages/engine/runtime-ui/src/ReportHeaderView.svelte) | title必填，无数据槽；filterIds仅日期；projectDetail/shortBar；exportButtons为PDF/PNG；widget只接收物化props和onback | 旧页面保持；不将所有维度筛选塞进reportHeader，不创建假的reportHeader驱动IOC导出 |
| [筛选声明](../../packages/page/src/filter.ts)、[Zod](../../packages/page/src/schema/filter.ts) | 六类筛选；dimension有hierarchy/display/单一dependsOn；没有页级options/单选约束；boolean取消默认不加条件 | 复用六类；有限枚举、单选、结构树和多依赖为增量；F18/F19仍为dimension |
| [期间与日期校验](../../packages/page/src/report-date-filters.ts)、[期间模型](../../packages/page/src/period-filter.ts) | period目前限定Dashboard；initialParam需配套initialMode，default与initialParam互斥；自然年季月和之前12完整月已实现 | IOC显式认领时扩展放置范围；不普遍放开旧reportHeader；修复月份锚点并纳入视图恢复。**initialParam与initialMode不是互斥** |
| [FilterState](../../packages/engine/runtime/src/filter-state.ts)、[级联](../../packages/engine/runtime-ui/src/filters/cascade.ts) | writeMany一次通知，但逐项跳过非法值；级联只清直接下游 | 新协调Module先整组校验、计算递归失效，再调用writeMany；所有写入口共用 |
| [候选加载器](../../packages/engine/runtime/src/dimension-values.ts)、[中立端口](../../packages/data-execution/src/ports.ts) | 状态idle/loading/ready/empty/unavailable/error；缓存按dimension；仅维度constraints；reload取消但settle未核对请求实例 | 新请求身份、逐请求代次及扩展端口；abort之外仍拒绝旧成功和旧失败 |
| [查询绑定](../../packages/page/src/query.ts)、[金额字段](../../packages/page/src/field.ts)、[selectField](../../packages/page/src/compute.ts) | 现有时间、维度、boolean、numberRange绑定；没有search消费；money仅CNY；selectField只复制已返回字段 | 复用绑定；USD、模式查询、金额单位及页头搜索不能伪装已有 |
| [导航输入](../../packages/engine/runtime-ui/src/types.ts)、[URL组装](../../packages/engine/runtime/src/navigate.ts)、[试验场返回](../../apps/playground/src/lib/page-return.ts) | href及显式row/param/filter映射；navigation.navigate返回true才接管；来源仅pageId/search；试验场按目标pageId存单槽 | 保留URL协议，补目标输入验证和来源视图快照；来源条目按导航实例隔离 |
| [表格会话](../../packages/engine/runtime/src/table-session.ts)、[表格导出](../../packages/engine/runtime-ui/src/table-export.ts)、[整页导出](../../packages/engine/runtime-ui/src/report-export-context.ts) | 表格拥有已提交页码/排序/表头条件/搜索；XLSX全量准备与PDF/PNG任务已有；后者仍接ReportHeaderProps | 复用各自Module，增加有界命令接缝；导出与恢复不直接修改表格私有DOM或map |

现行内容显隐、可信展示输入仍是[待审方案](2026-10-15-page-visibility-and-region-interactions.md)，不是现有能力。本节沿用其Condition、displayInputs、筛选协调和身份失效方向，不创建第二种条件语言或权限中心。另有[元数据枚举容错待审方案](2026-10-19-page-enum-fallback.md)；以下新语义仍先按严格校验设计，不能以删除非法筛选后继续查全量作为降级。

### 17.2 页级元数据：只声明身份、位置与意图

```ts
// 草案：文档态。TextValue复用既有字面量、param/filter引用及一层parts。
interface IocHeaderDeclaration {
  identity?: {
    title?: TextValue;
    code?: { label: TextValue; value: TextValue };
    description?: { text: TextValue; presentation?: 'inline' | 'tooltip' };
    tags?: Array<{
      id: string;
      text: TextValue;
      tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
    }>;
    facts?: Array<{
      id: string;
      kind: 'queryPeriod' | 'latestDataPeriod' | 'refreshedAt' | 'generatedAt';
      label: TextValue;
      value: TextValue | HeaderFactReference;
    }>;
  };
  back?: true;
  filterIds?: string[];
  presentation?: {
    density?: 'normal' | 'compact';   // 默认normal；不改变筛选语义
    collapse?: 'none' | 'firstRow';  // 默认none；只折叠筛选行
  };
  actions?: IocHeaderAction[];
}
// 仅facts.value接受，不扩展所有TextValue位置，也不引用任意对象路径。
interface HeaderFactReference {
  fact: string;
  part: 'latest' | 'latestComplete' | 'refreshedAt' | 'generatedAt';
}
```

`iocHeader`位于Page根，与`filters/sections`同级，不是`sections.components`的新type，也没有`layout.span`。每个页面至多一个。`identity`省略即无身份行；title省略不自动取meta.title，支持合同只有筛选；显式title引用缺值时显示“未命名”，其他缺失项整体省略，包括code标签、空tag和fact，避免留空色块。meta.title继续作为目录标题，不能偷偷改写业务身份。没有任何可见内容的空声明在创作校验中拒绝。

facts只描述显示类别，不会据kind自动取得系统当前时间。queryPeriod应显式引用已应用filter；其他时间由可信参数或HeaderFactReference物化，缺值就不显示。fact引用只能出现在facts.value，按kind检查part（例如refreshedAt只能取对应事实）；物化后仍为字符串。所依赖事实未就绪时只显示该信息项的状态，不阻断无关身份文本；availability消费同一事实时才影响筛选合法性。最新期不能从正文最大行日期推断；项目名称/编码优先使用已有页面参数。首批不允许`dataSource/row/path`任意结果绑定；确需实时改名，应另加明确结果绑定，而非让纯呈现Module取数。说明首批纯文本，旧reportHeader的semanticHtml继续原处使用。

tags以id区分、数组决定顺序、tone决定中性色板；tone不隐含业务规则。不开放任意CSS/HTML/像素坐标。普通、密集、详情用同一结构自然排版；原型A/B/C不是三个必须固化的协议variant，默认采用已展示的A结构。直接容器宽度决定换行；firstRow按实测筛选行收起，隐藏控件同时退出焦点序列；展开不清值、不查询，状态不进入Page文档。

**控件归属规则：** filterIds只认领已声明且静态可见的页级筛选，保持数组顺序；重复、不存在、图表独立筛选、详情私有筛选或与reportHeader重复认领均拒绝。认领的筛选从通用FilterBar排除，其余保持原位置；visible:false不会因认领而显示。dashboard使用iocHeader时显式`dashboardToolbar:"hidden"`，冲突不静默选择一份。report迁移时移除承担同一页面身份职责的旧projectDetail/首个业务页头；正文独立章节页头可保留，但不能重复认领筛选或整页导出。

### 17.3 有限操作与现有导出配置复用

```ts
// 草案；label为TextValue，可选，缺省由动作类型给出。
type HeaderActionBase = { id: string; label?: TextValue };
type IocHeaderAction = HeaderActionBase & (
  | { type: 'tableExport'; tableId: string }
  | ({ type: 'pageExport' } & ReportExportButtonDeclaration)
  | { type: 'fullscreen'; target: { kind: 'page' } | { kind: 'component'; id: string } }
  | { type: 'theme' }
  | { type: 'refresh' }
  | { type: 'reset'; baseline: 'initial' }
);
// 从现有reportHeader.exportButtons叶子Schema抽取共享定义，不复制两份真源。
type ReportExportButtonDeclaration =
  | { format: 'pdf'; label?: TextValue; filename?: TextValue; scale?: 2 | 3 | 4 }
  | { format: 'png'; label?: TextValue; filename?: TextValue; scale?: 3 | 4 };
```

`tableExport`引用表格自身的`props.toolbar.export`（现有`{format:"xlsx",filename?}`），不再保存第二份文件名、搜索字段或查询。目标必须是本页可定位且配置该能力的表格；页头和表格入口共用任务状态，忙时禁止重复启动。首批保留表格原入口；是否只在页头显示属于后续位置选择，不通过删掉toolbar.export取消能力。详情私有表格不能被页面级入口越过上下文导出。

`pageExport`复用6.31的format/label/filename/scale、直接点击下载和内部任务清理；在IOC actions数组中就地声明，不另加一个同义exportButtons数组。先把ReportExportContext对ReportHeaderProps的依赖收窄为标题、导出配置和捕获状态，再由旧reportHeader与IOC共享。不得将旧公共withExportView恢复为调用入口。整页导出需新增IOC静态呈现Adapter，打印身份和已应用条件、去掉操作/返回/展开控件，沿用现有完整取数、10000行/60秒限制与部分失败标识；不能仅把新按钮连到当前报告路径就宣称已支持Dashboard导出。

fullscreen默认page实例，组件目标须存在；使用目标ownerDocument及Fullscreen API，失败有可恢复原因。theme为当前页面实例的主题意图，需覆盖正文/弹层/图表/导出；集成应用允许的主题与控制权由能力输入决定，不能只换页头颜色。普通报表或宿主未支持时明确unavailable。refresh保持当前已应用条件，刷新绑定查询闭包；reset恢复**本实例初始化完成后的合法条件**，不是无条件全部，不改身份、参数和来源。

返回由`back:true`单独声明，不能配置固定“上一页”URL；只有集成应用提供合法returnContext且有back处理函数才显示。折叠是布局行为，金额确定/取消属于金额控件，更多菜单由已声明动作和空间自动排布。actions省略默认无操作。theme/refresh/reset仍为可选能力，不因原型有演示而默认启用。

查询/应用按钮由下节可选提交模式生成，不作为另一条action；页头搜索须先有L12的明确服务端消费契约，首批不新增一个看似可用的search动作。行导航仍用既有ComponentAction，不上提成脱离行上下文的按钮。

### 17.4 共用筛选元数据增量

本节是适用于页级筛选的增量，不藏在iocHeader里。旧声明不出现新字段时保持原语义；options例外需要同步领域文档对“唯一候选端口”的限定，Schema Metadata仍不包含业务候选。

```ts
// 草案：添加到dimension声明；已有id/type/dimension/hierarchy等保留。
interface DimensionSelectionExtension {
  selection?: {
    mode: 'single' | 'multiple';
    required?: boolean;
    allBehavior?: 'values' | 'unrestricted';
  };
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  treeSelection?: 'level';
  candidateContext?: {
    filterIds: string[];
    reconcile: 'clear' | 'intersection';
  };
  candidateWindow?: { unit: 'month'; n: 12; includeCurrent: boolean; anchorFact?: string };
}
// 草案：共用交互附加项，Condition直接引用显隐主计划的同一类型。
interface FilterInteractionExtension {
  hint?: TextValue;
  enabledWhen?: Condition;
  clearOnDisable?: true;
  clearOnChangeOf?: string[];
}
```

selection缺省保留既有多选；display=tabs继续单选，显式声明multiple与tabs冲突拒绝。single要求至多一个值，required要求恰好一个；适用于币种。options只允许创作期已确认的封闭枚举，与动态候选来源互斥；有options不请求网关，值唯一，代码与label分开。此分支不接真实组织/权限候选，不用于失败后回退静态全量。

allBehavior默认values，选中候选仍送完整集合；unrestricted仅允许显式穷尽options且multiple时使用，选中所有有效枚举后编译为不加该维度条件，UI/URL仍能保留实际选择；适用F18/F19的`"1"/"0"`。动态或分页候选禁止此优化。清空（不限制）、空结果（无可选项）、未就绪、无权限不能互换。单boolean继续支持whenTrue/whenFalse，不把勾选和否值当成同一种语义。

结构树选择增加`treeSelection:"level"`并要求hierarchy；候选由扩展端口提供显式level/parent关系，禁止从`"/"`拆业务码。选中父节点就是该层级业务值，切层一次清除不兼容旧值；当前FilterValue只保存一个level，首批禁止跨层混选。存量display=tree不带treeSelection的“父选批量叶子”行为保持，不能全球改成新语义。区域、行业共用结构树，levelQueryFields仍必须逐层齐全。

candidateContext允许维度、期间等多个依赖。既有dependsOn保留单维级联，归一化到同一依赖图；新旧字段指向同一上游时拒绝重复，所有依赖合并校验无自依赖/无环。`reconcile:clear`在依赖改变时清除旧值；intersection只在**新授权候选就绪**后保留合法交集。产业→业务类型→小组使用递归后代清理；时间→模型使用intersection。币种→金额使用`clearOnChangeOf:["currency"]`，不伪装成候选级联。

enabledWhen只消费声明的筛选或可信事实，使用显隐计划的all/any/not/eq/in/empty等闭集和未知态，不接受表达式。声明enabledWhen必须同时声明clearOnDisable:true，条件确认为不满足时原子清值；等待或输入错误时先阻断相关提交/查询，不把未知当成业务禁用后查询全部。普通readOnly只阻止编辑，**不清合法已应用条件**。static visible:false、动态隐藏和授权收回的处理继续遵守共同可信输入规则。

### 17.5 时间、金额和查询模式的独立扩展

| 场景 | 推荐元数据及执行规则 | 实施边界 |
|---|---|---|
| T01/T02单月、单日 | 原有timePoint，granularity=month/date；查询绑定显式valueFormat=iso/compact | 直接复用；详情保持单月 |
| T03范围 | 原有timeRange，precision=month/date；半区间只留草稿 | 直接复用；原有datetime不被IOC全局删除 |
| T09年季月/近一年 | 原有display=period与default=`{mode,value?}`；initialParam须配initialMode；selection是运行态属性 | IOC认领后放开位置；近一年仍为当前月之前12完整月；年月锚点属会话状态，不写入Page |
| T06/T07快捷范围 | 拟议timeRange.presets为`{id,label,range:RelativeTimeExpression}[]`；同次初始化/提交共享时钟 | 日近N含锚点日；完整月明确includeCurrent:false；不改成固定天数 |
| T08离散月份 | 优先dimension+真实年月维度候选；candidateWindow显式声明12月及includeCurrent，anchorFact省略时共享时钟；queryField显式绑定，选1/3月传两个值 | 窗口通过V2端口传递，不解析label猜月份、不补2月；只有dtime时现有range不够，多区间时间绑定暂不提供 |
| T10/T11数据最新期 | timePoint/timeRange拟议`availability:{fact,initial?:"latest"\|"latestComplete",max:"latest"\|"latestComplete"}`；可另有静态min/max | fact指向可信展示输入中具名数据域的期间事实，含latest/latestComplete/缺数区间与状态；initial和default/initialParam互斥，合法URL仍优先；max始终校验，不把默认当上限 |
| T04/T05可切日/月/ISO周 | 拟议timeRange的display=modes分支，见下；默认/可选模式、模式查询必须对齐 | 不从日期控件自动推断查询聚合；旧私有周码能力未核实，使用ISO周一至周日并拒绝未知码 |
| M01币种 | dimension+显式options+single/required；业务码RMB与货币元数据CNY分开 | 代码由配置确定，不凭label猜 |
| M03/M04金额 | numberRange拟议constraints、units、presets；状态保存基本单位有限数字，输入换算由受控比例决定 | 禁止负数、NaN/Infinity；允许单边；IOC双边严格from<to为可选约束，通用范围仍允许相等 |
| M02/M06货币字段 | money新增USD；消费者按有限字段绑定选择CNY/USD两个静态输出，见下 | 不换标签冒充换币，不用selectField改货币元数据，无汇率不前端换算 |

期间事实作为显隐主计划displayInputs的具名业务事实分支统一提供，拟议类型为`DataPeriodFact = {status:"ready",granularity:"month"|"date",latest:string,latestComplete?:string,missingRanges?:TimeRangeValue[],refreshedAt?:string,generatedAt?:string} | {status:"loading"|"empty"|"unavailable"|"error"}`。身份修订和相关filterRevision由该输入源统一携带；日期值按granularity校验，时间戳用带时区的ISO值且按集成应用规定时区显示，不取浏览器当前时间替代。URL不可覆盖事实。缺latestComplete时complete策略不可用，不能回退latest。缺数区间不变成数值0；有查询能力但该期无行时呈现空。

availability的max比较完整已提交范围端点，不静默截短自然年/季度；跨越上限的完整自然期暂不可选。业务要求“今年截至最新日”时应显式声明累计window或独立范围模式，不能把完整自然年偷偷改成YTD。latest表示允许当前有数据但未完成的最细期间，latestComplete才表示事实粒度下已完成；不从“当前月”猜数据定稿。该保守首批规则仍支持普通单日/单月和范围，后续需要跨粒度完成状态时扩展事实契约再审。

**模式草案（与普通range和period为互斥分支）：**

```ts
type ModeId = 'day' | 'month' | 'isoWeek';
interface ModeTimeRangeDeclaration {
  id: string;
  type: 'timeRange';
  display: 'modes';
  label?: string;
  modes: Array<{ id: ModeId; default: TimeRangeValue | RelativeTimeExpression }>;
  defaultMode: ModeId;
  required: true;
}
// 一次写入完整模式和范围；day/isoWeek使用YYYY-MM-DD，month使用YYYY-MM。
type ModeTimeRangeValue = { type: 'timeRange'; mode: ModeId; from: string; to: string };
```

周范围须是同一ISO周的周一和周日，周所属年从ISO规则导出；跨年周例如2027-W01必须按日历校验，不能用公历年+周序号直接拼接。各模式保留上次合法范围是会话行为；恢复失败用该模式合法默认值；缺映射的模式禁用并解释原因，不提交旧查询。模式URL编码须有显式mode及from/to，不能将周值挤入month字符串。首批modes不同时支持initialParam，导航使用带模式的目标筛选输入；后续单独扩展参数类型时再放开。

查询模式建议作为**DQE查询定义的互斥分支**：普通query继续body/filterBindings；模式query改用`timeModes:{filterId,cases:{[mode]:{body,filterBindings}}}`，每个case提供完整静态DQE请求体和筛选绑定。case必须覆盖全部声明模式、输出同一组结果字段名/类型/货币、别名保持同一queryField映射，才可在一个页面数据源中切换；不能实现时拆独立场景，不声称“只换period就改了聚合”。本分支需要page、SourceProgram、查询去重/缓存、Relay、初始数据兼容与真实DQE共同验收，不能只在runtime-ui里拼请求。T12累计/同比window仍显式在相应case绑定中声明。

**金额和字段选择草案（以下为独立P2协议，不是新页头的必需字段）：**

```json
{
  "id": "amount",
  "type": "numberRange",
  "label": "预签金额",
  "constraints": { "min": 0, "bounds": "strict" },
  "units": {
    "filterId": "currency",
    "cases": {
      "RMB": { "currency": "CNY", "label": "万元", "scale": 10000 },
      "USD": { "currency": "USD", "label": "万美元", "scale": 10000 }
    }
  },
  "presets": [
    { "id": "all", "label": "全部", "range": {} },
    { "id": "large", "label": "100万及以上", "range": { "from": 100 } }
  ],
  "clearOnChangeOf": ["currency"]
}
```

presets与输入均按当前units的显示单位，提交时乘scale形成基本单位；“100万”是100×10000，不能再被绑定乘一次。scale为正有限受控整数，换算溢出拒绝提交。币种变化与清金额同一事务完成；取消金额面板不改状态。范围绑定新增互斥metric选择支路`{target:"numberRange",metricByFilter:{filterId:"currency",cases:{RMB:"amount_rmb",USD:"amount_usd"}}}`，普通metric仍保持。每个分支的字段和货币须匹配units。

消费者FieldBinding拟议增加非递归`{byFilter:{filterId,cases:{[value]:StaticFieldBinding}}}`分支；叶子复用现有`string | {data,field,format?,missingText?,match?}`，每个case有静态、明确currency的结果字段。只允许已声明required单选枚举，穷尽cases，不设置隐式兜底货币；图表同一系列各case的单位须可解释，不能混币相加。例：`{byFilter:{filterId:"currency",cases:{RMB:{data:"main",field:"amount-cny",format:"number-grouped"},USD:{data:"main",field:"amount-usd",format:"number-grouped"}}}}`。字段标题和单位同样按当前case投影，导出冻结该case。所有使用fieldName/字段收集/compute输入校验的消费者必须识别新增绑定，不能只修Table。选择在**渲染/导出投影**发生，不建立货币不明确的合并输出字段。

这保留两个静态货币输出，代价是查询和结果可能更宽。只返回一个随currency变币种的字段不纳入本草案，需另审动态货币结果契约。金额档位、超期、无接触天数、执行率与偏差的真实边界仍由真实字段绑定提供，当前缺证据不在示例中伪造生产码。

### 17.6 状态协调与候选端口Interface

```ts
// 拟议内部Module。统一入口覆盖控件、action、地图、URL和恢复；不新增全局单例。
interface FilterCoordinator {
  commit(intent: FilterIntent): CommitResult;
}
type CommitResult =
  | { ok: true; filterRevision: number; changedIds: string[] }
  | { ok: false; issues: Array<{ filterId: string; code: string; message: string }> };
type FilterIntent =
  | { type: 'set'; filterId: string; value: FilterValue }
  | { type: 'clear'; filterId: string }
  | { type: 'applyDraft'; changes: ReadonlyArray<readonly [string, FilterValue | null]> }
  | { type: 'reset'; baseline: 'initial' }
  | { type: 'initialize'; values: FilterValues }
  | { type: 'restore'; values: FilterValues };
// FilterValue包含经批准后的显式模式扩展；initialize/restore仅由引擎调用。
```

固定顺序：校验目标和**整组**类型/边界/只读→求依赖闭包与条件→生成合法下一状态及执行门禁→一次writeMany通知→按筛选版本更新候选→只重建受影响生效查询及依赖闭包→相关表格页码归零（UI第一页），保留合法排序。隐蔽Tab里的表格同样失效。任何一项非法整次拒绝，不能沿用writeMany“跳过非法项”模拟事务。新的协调Module保持私有，原公开FilterState读写签名先兼容；实际接入必须保证旧write/action入口也经过同一协调链，不能只有新页头受控。

依赖变化使旧选择待验证时，暂停**消费该筛选的查询及其下游**，无关正文继续。新候选到达后整组校验交集；自动剪裁到空不会按“全部”执行，保留待选择/待确认门禁，直到用户显式清空表示不限或选择合法值。失败保留上次合法选择及可定位状态，但不使用其生成不可信的新查询。此执行门禁来自筛选合法性，不从visibleWhen或内容隐藏推导，因此不改变ADR-0105“非当前内容也执行”的默认原则。

```ts
// 拟议可选V2端口；旧fetchDimensionValues(dimension, options)继续存在。
interface FilterCandidatesGateway {
  fetchFilterCandidates(request: {
    filterId: string;
    dimension: string;
    level?: string;
    calendarWindow?: { granularity: 'month'; from: string; to: string };
    constraints: {
      dimensions: Readonly<Record<string, readonly string[]>>;
      times: Readonly<Record<string, { from: string; to: string; mode?: ModeId }>>;
    };
  }, options: { signal: AbortSignal }): Promise<FilterCandidatesResult>;
}
type FilterCandidatesResult =
  | { kind: 'values'; candidates: Array<{
      value: string; label: string; level?: string;
      parent?: { level: string; value: string };
    }> }
  | { kind: 'unavailable' }
  | { kind: 'denied' }
  | { kind: 'unconfigured' };
```

V2不是新HTTP协议，定义在data-execution中立ports，真实CloudIOC/组织接口由仓外Adapter满足。只有dimension约束的旧页面仍能用旧端口；V2缺席且需求包含时间/候选窗口/结构树/授权状态时明确unavailable，禁止丢掉新约束调用旧方法。请求上下文身份由集成应用重挂后的会话隔离，不让Page/URL提供用户ID或权限凭据。trusted identity变化先取消/销毁旧实例再初始化。

候选缓存键包含会话代次、filterId、dimension、level、规范化的完整维度、时间约束及calendarWindow；值数组规范化后再去重。每个键有独立generation，reload/取消/销毁同时推进；resolve与reject均比较generation及会话，旧回调不能删除新controller或发布结果。同维度不同控件不会互相覆盖。candidateWindow只用于明确声明为年月语义的维度，由Adapter按实际业务码解释窗口；它不改变已选择集合的谓词语义。V2首批返回当前请求完整候选，未设计分页时不得把部分候选用于全选或合法交集裁剪；超出有界容量应明确不可用/需搜索能力，不能截断后当完整集合。

候选状态保留idle/loading/ready/empty/unavailable/error，并增加denied/unconfigured；readonly/disabled是独立交互状态（附原因），不挤进数据加载状态。retry由统一运行时reload当前规范化请求，不重放旧依赖。查询错误继续按现有数据执行规则呈现空数据并保留结构化诊断；totalCount不一致保留返回行并告警，与候选失败的门禁分开处理。

初始化采用§4既定三条路径。参数只作不可变输入，筛选初始化不反向改参数；合法URL/显式导航覆盖默认，目标输入重复写者拒绝；候选依赖就绪后才启动消费查询。模式锚点、草稿、焦点和展开不是查询条件，不混进Page参数。

### 17.7 引擎与中立UI的调用Interface

下列均为**拟议调用**，不表示当前包已导出IocHeader/MultiSelect/TreeSelect。IOC业务组合放engine/runtime-ui，不进入`@metriccanvas/ui`公共导出。

```ts
// 引擎内部呈现输入：文档已解析，文字已物化，能力与只读已判定。
interface IocHeaderProps {
  model: ResolvedIocHeader;
  filters: readonly HeaderFilterModel[]; // 按filterIds顺序，含值/候选/可编辑性及原因
  actions: readonly HeaderActionModel[]; // ready/disabled/busy/error/unavailable
  returnContext?: { entryId: string; label?: string };
  onfilter: (intent: FilterIntent) => void;
  onaction: (actionId: string) => void;
  onback?: () => void;
  presentationState: { expanded: boolean };
  onexpanded: (expanded: boolean) => void;
}
```

补充内部状态形状（六类config/value按type一一配对；这里展示dimension分支，其他分支直接复用其既有声明和值类型，不接受跨类型组合）：

```ts
type FilterInteraction =
  | { kind: 'editable' }
  | { kind: 'readonly' | 'disabled'; reason: string };
type DimensionHeaderFilterModel = {
  id: string;
  type: 'dimension';
  config: DimensionFilterDeclaration & DimensionSelectionExtension & FilterInteractionExtension;
  value: DimensionFilterValue | null;
  candidates: FilterCandidatesSnapshot;
  interaction: FilterInteraction;
  hint?: string;
};
type HeaderActionModel = {
  id: string;
  type: IocHeaderAction['type'];
  label: string;
  state: { kind: 'ready' } | { kind: 'busy'; message: string }
    | { kind: 'disabled' | 'unavailable'; reason: string }
    | { kind: 'error'; message: string; retryable: boolean };
};
```

ResolvedIocHeader由§17.2的声明在固定文本位置物化为string，fact引用转换成字符串和信息项状态；它不再接受TextValue引用。FilterCandidatesSnapshot使用§17.6列出的加载状态，ready才含完整candidates，error含脱值诊断。只读来源建议为RuntimeView/embed可选中立`filterEditing:{readOnly:boolean,reason?:string}`及共享条件的逐控件判定；省略保留旧行为，须同步Svelte入口、JS挂载白名单及EmbedRoot。此输入不授予权限，也不能覆盖服务端候选；readOnly须拦截全部用户筛选写入（含地图/action），不阻止合法初始化/恢复；只读期间不自动禁用导航与导出。

HeaderFilterModel按type判别并引用既有FilterValue/声明投影，HeaderActionModel以id和类型连接已校验命令；不是把任意对象透传给DOM。ResolvedIocHeader不携带原始Page或query。纯呈现不发请求、不自己判断真实来源、不调用浏览器路由器。运行时在回调触发时再次核对filterRevision、身份代次、只读与动作能力，避免显示后权限变化仍可执行。

中立UI增量使用以下受控输入（可复用同一个SelectionProps，不让业务候选状态依赖进入UI）：

```ts
interface SelectionProps {
  label: string;
  value: string[];
  options: readonly UiOption[];
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onchange: (values: string[]) => void;
}
// MultiSelect新增searchable?:boolean；搜索只过滤当前候选，不生成DQE搜索。
// TreeSelect使用独立UiTreeNode[]；node含key/label/value?/children?/disabled?。
// 无value的节点只展开；有value的节点只选择自身，不隐式代选后代。
```

TreeSelect只处理显式结构，level由引擎适配为本层可选节点；选项键稳定、父子关系无环。中立UI不知道组织层级或industry。清除/全选是显式用户事件，disabled时不发事件；单选仍调用现有Select。

```svelte
<!-- 拟议内部调用；controller、presenter均是本实例内部变量。 -->
<IocHeader model={presenter.header} filters={presenter.filters}
  actions={presenter.actions} returnContext={navigation.returnContext}
  onfilter={intent => controller.commit(intent)}
  onaction={id => controller.runAction(id)} onback={navigation.back}
  presentationState={view.header} onexpanded={expanded => view.setHeaderExpanded(expanded)} />

<!-- 既有DatePicker调用无需改名或引入Page依赖。 -->
<DatePicker label="统计月份" precision="month" required
  value={month ? {from: month, to: month} : null}
  disabled={!editable} onchange={range => setMonth(range?.from ?? null)} />

<!-- 拟议中立多选；ready选项和状态说明由引擎投影。 -->
<MultiSelect label="客户分类" value={selectedCodes} options={options}
  disabled={!editable} loading={loading} error={errorText}
  onchange={values => controller.commit({type: 'set', filterId: 'customer-kind',
    value: {type: 'dimension', values}})} />
```

DatePicker拟议新增`max?:string`和`blockedRanges?:readonly DateRangeValue[]`，只接收规范日历值、不接受业务HTTP或规则表达式；min/max/禁用日期与已有disableFuture取交集，空交集明确不可选。仅缺数时是否禁选由页面显式策略决定，默认可查询并显示空，不能把无数据伪装权限拒绝。对省略属性的旧调用保持行为；年/季range仍拒绝。周选择是中立日历扩展或小型WeekPicker，不能把周规则写到IOC业务组件。弹层保留原mount root及ShadowRoot样式，收起/切只读后关闭弹层并恢复合适焦点；错误与输入关联；候选重载保留可解释的已选摘要。业务错误文本由引擎给出，中立UI不打印QueryError原始对象。

提交模式建议首批保持immediate；后续若用户选择O10，添加页级`filterCommit:{mode:"explicit",filterIds:[...]}`，由统一协调Module拥有一份草稿，仅作用于指定筛选；应用整组提交、取消丢草稿，不覆盖即时图表筛选。不能同时再配置一条apply action。该可选模式不作为本轮默认实施范围。

### 17.8 普通、密集、详情页面声明示例

以下三段是**完整小型页面形状的审查示例**，`schemaVersion`故意使用`PROPOSAL`，提醒不能直接提交给6.31执行。inline仅提供静态演示正文，不宣称筛选会改变这些行；真实页面必须另接本节给出的query绑定。示例业务码和数据均为示意，禁止直接覆盖现有IOC四页。

**普通：年季月、区域与币种。** 目录与身份标题独立；默认无可选动作。

```json
{
  "schemaVersion": "PROPOSAL",
  "id": "ioc-header-overview-review",
  "meta": { "title": "项目概览" },
  "layout": "dashboard",
  "dashboardToolbar": "hidden",
  "iocHeader": {
    "identity": {
      "title": "项目概览",
      "facts": [{ "id": "query-period", "kind": "queryPeriod", "label": "统计期间", "value": { "filter": "period", "format": "period" } }]
    },
    "filterIds": ["period", "region", "currency"]
  },
  "filters": [
    { "id": "period", "type": "timeRange", "display": "period", "precision": "month", "required": true, "default": { "mode": "month", "value": "2026-09" } },
    { "id": "region", "type": "dimension", "dimension": "region_code", "label": "区域" },
    { "id": "currency", "type": "dimension", "dimension": "currency_code", "label": "币种", "selection": { "mode": "single", "required": true }, "options": [{ "value": "RMB", "label": "人民币" }, { "value": "USD", "label": "美元" }], "default": ["RMB"] }
  ],
  "dataSources": { "demo": { "fields": { "count": { "type": "number", "role": "measure", "label": "数量" } }, "source": { "type": "inline", "rows": [{ "count": 12 }] } } },
  "sections": [{ "id": "body", "components": [{ "id": "overview-table", "type": "table", "layout": { "span": 12 }, "data": { "main": "demo" }, "props": { "columns": [{ "field": "count" }] } }] }]
}
```

运行时适配：解析引用→period由现有PeriodFilter+DatePicker投影，region走候选端口，currency走封闭枚举Select→用户意图进入同一coordinator。UI收到的identity为字符串、各控件收到其值/候选/可编辑性，**不会收到原始iocHeader或DQE体**。真实查询时间体须保留`filter.time.period:"month"`并用`period:{target:"time"}`绑定，range来自期间模型；currency只影响声明绑定的源，不能改变无关计数口径。

**密集：条件启用、递归依赖、树层级和表格导出。**

```json
{
  "schemaVersion": "PROPOSAL",
  "id": "ioc-header-dense-review",
  "layout": "dashboard",
  "dashboardToolbar": "hidden",
  "iocHeader": {
    "identity": { "title": "机会点清单", "description": { "text": "筛选后查看当前范围的机会点" } },
    "filterIds": ["industry", "business", "group", "region", "breakthrough"],
    "presentation": { "density": "compact", "collapse": "firstRow" },
    "actions": [{ "id": "export-list", "type": "tableExport", "tableId": "opportunity-table", "label": "导出清单" }]
  },
  "filters": [
    { "id": "industry", "type": "dimension", "dimension": "industry_code", "label": "产业" },
    { "id": "business", "type": "dimension", "dimension": "business_type", "label": "业务类型", "dependsOn": "industry", "enabledWhen": { "not": { "filter": "industry", "op": "empty" } }, "clearOnDisable": true },
    { "id": "group", "type": "dimension", "dimension": "collaboration_group", "label": "协同小组", "dependsOn": "business" },
    { "id": "region", "type": "dimension", "dimension": "department_code", "label": "区域", "display": "tree", "treeSelection": "level", "hierarchy": [{ "id": "department", "dimension": "department_code", "label": "地区部" }, { "id": "office", "dimension": "office_code", "label": "代表处" }] },
    { "id": "breakthrough", "type": "dimension", "dimension": "breakthrough_code", "label": "是否突破", "selection": { "mode": "multiple", "allBehavior": "unrestricted" }, "options": [{ "value": "1", "label": "是" }, { "value": "0", "label": "否" }] }
  ],
  "dataSources": { "demo": { "fields": { "name": { "type": "string", "role": "dimension", "label": "机会点" } }, "source": { "type": "inline", "rows": [{ "name": "演示机会点" }] } } },
  "sections": [{ "id": "body", "components": [{ "id": "opportunity-table", "type": "table", "layout": { "span": 12 }, "data": { "main": "demo" }, "props": { "toolbar": { "export": { "format": "xlsx", "filename": "机会点清单" } }, "columns": [{ "field": "name" }] } }] }]
}
```

运行时适配：只有新树声明才使用V2结构候选；source不支持则该控件unavailable，不降回斜杠树。business的条件按共用Condition求值，industry变化清business/group一次通知；失败阻断相关查询。UI按实测折行决定是否显示展开；XLSX命令引用opportunity-table现有导出配置，不从当前DOM读取分页行。

**详情：实体参数、标签、真实来源返回与独立单月。**

```json
{
  "schemaVersion": "PROPOSAL",
  "id": "ioc-header-detail-review",
  "meta": { "title": "项目详情" },
  "layout": "report",
  "params": {
    "query": {
      "dimensions": [{ "id": "project-id", "dim_name": "project_code", "required": true }],
      "times": [{ "id": "report-month", "granularity": "month", "start": "2026-09", "end": "2026-09" }]
    },
    "display": [{ "id": "project-name", "type": "string", "required": true }, { "id": "project-code", "type": "string", "required": false }, { "id": "status-label", "type": "string", "required": false }]
  },
  "iocHeader": {
    "back": true,
    "identity": {
      "title": { "param": "project-name" },
      "code": { "label": "项目编码", "value": { "param": "project-code" } },
      "tags": [{ "id": "status", "text": { "param": "status-label" }, "tone": "info" }],
      "facts": [{ "id": "query-period", "kind": "queryPeriod", "label": "统计月份", "value": { "filter": "month", "format": "period" } }]
    },
    "filterIds": ["month"]
  },
  "filters": [{ "id": "month", "type": "timePoint", "granularity": "month", "required": true, "initialParam": "report-month", "disableFuture": true }],
  "dataSources": { "demo": { "fields": { "name": { "type": "string", "role": "dimension", "label": "演示内容" } }, "source": { "type": "inline", "rows": [{ "name": "静态详情占位，不代表真实项目数据" }] } } },
  "sections": [{ "id": "body", "components": [{ "id": "detail-table", "type": "table", "layout": { "span": 12 }, "data": { "main": "demo" }, "props": { "columns": [{ "field": "name" }] } }] }]
}
```

详情由集成应用提供project-id/project-name等必需参数；没有输入不执行实体业务查询，不能用显示名替代实体键。month初值读取参数后独立变化，参数保持不变。UI身份只收到物化的名称/编码/标签；有合法来源时收到returnContext并显示返回，直接打开无来源隐藏。report布局外框不变，不引入DashboardToolbar。

真实查询配置调用示例，以下仅为既有query对象中的**绑定片段**；完整DQE body与queryField必须在实际页面就地声明并执行核验：

```json
{
  "filterBindings": {
    "period": { "target": "time" },
    "region": { "target": "dimension", "levelQueryFields": { "department": "region_dept_code", "office": "rep_office_code" } },
    "breakthrough": { "target": "dimension", "queryField": "breakthrough_code" }
  }
}
```

此片段面向使用层级region的页面，不能原样贴入普通扁平region示例；扁平声明必须用queryField分支。详情month改用`{target:"timePoint",queryField:"mtime",valueFormat:"compact"}`，需要累计窗口时才使用有明确window的time绑定。F01/F02等boolean用`{target:"boolean",queryField:"...",whenTrue:["1"]}`；要明确筛false才声明whenFalse。合同无标题可省略identity，使用region与离散month-set维度，保留同一页头结构。

可选整页导出示例（须用户选择，并完成IOC静态Adapter）：`{"id":"pdf","type":"pageExport","format":"pdf","label":"导出PDF","filename":{"parts":["项目-",{"param":"project-name"}]},"scale":2}`。PNG与6.31共用相同入口纪律，不因88项仅列PDF就另建第二种导出状态机。

### 17.9 显式导航与返回视图Interface（原规划；本轮不选恢复，见§22）

Page导航继续复用href/query，不新增隐式“继承全部”。列表行示例：

```json
{
  "on": "click",
  "navigate": {
    "href": "/pages/ioc-project-detail",
    "query": {
      "project-id": { "source": "row", "field": "project-code" },
      "project-name": { "source": "row", "field": "project-name" },
      "month": { "source": "filter", "id": "month", "part": "value" }
    }
  }
}
```

目标已声明URL键的类型与必需输入应由集成应用提供的目标输入契约验证；无目标契约的普通外链保留既有URL行为，不推断它是IOC详情。需要强类型保证的IOC链路必须有目标输入契约（页面修订的参数/筛选输入投影），不能仅凭href猜目标。源页先验证实体键和形状；目标再按当前授权候选确认合法范围。年/季/last12Months不能自动截成详情单月；缺必需键拒绝本次导航并说明原因；源页无需预取目标完整候选。

```ts
// 草案：状态快照不是页面元数据、不是业务数据快照。
interface RuntimeViewSnapshot {
  version: 1;
  pageId: string;
  pageRevisionId: string;
  contextRevision: string; // 中立可信上下文标识，不是token
  search: string;
  tables: Record<string, TableQueryView>;
  activeContent: Record<string, string>; // sectionGroup/Tab的稳定id
  expandedRows: Record<string, string[]>; // componentId → 稳定业务行键
  header: { expanded: boolean; periodAnchors: Record<string, string> };
  scroll: { anchorId?: string; offset: number };
}
interface RuntimeViewStateHandle {
  capture(): RuntimeViewSnapshot;
  restore(snapshot: unknown): Promise<{
    restored: string[]; discarded: string[]; reason?: string;
  }>;
}
```

该handle是引擎可导出/校验/恢复的有界状态Interface，集成应用仍拥有导航栈和存储。建议通过可选`onviewstate(handle|null)`交付，销毁时撤销handle，Svelte与embed同一形状；RuntimeNavigation新增可选returnContext，navigate目标新增可选sourceView，旧实现忽略新属性仍可导航。接管者必须同步捕获来源state后才转场；navigate返回true语义不变，未接管的普通链接不承诺完整恢复。

快照以稳定componentId/filterId/字段名定位；表格已提交状态来自TableSession，搜索草稿不保存；periodAnchor按filterId保存。行展开只按已声明rowKey恢复，没有稳定行键的展开状态丢弃，不能按行序号套用；页内详情浮层不跨页重放。恢复先验证页面/修订/可信上下文，再统一校验筛选，重建执行，恢复有效表格/内容状态；等布局稳定后恢复锚点及有界偏移。页码超出新结果范围校正，不从旧业务行恢复内容。TableSession需增加统一合法restore入口，不能逐项setPage/setSort导致中间请求；局部表格会话也归统一快照协调，不能只恢复查询分页表格。

权限或身份变化拒绝整个旧业务视图；同身份页面修订变化按稳定ID检查每项，不兼容项丢弃并反馈恢复范围。state不保存结果行、凭据、候选列表、DOM、未提交输入或未完成导出；数据查询重新执行。会话来源条目以window+navigationEntryId隔离，数量/容量有界（建议20个且可配置）；刷新可从URL恢复合法筛选，未找到会话条目则恢复默认阅读状态，不承诺浏览器重启永久保留。不得将此handle扩成引擎路由器。

### 17.10 88项落点、兼容与实施顺序

| 功能编号（计数） | 本节Interface与唯一归属 | 建设批次 |
|---|---|---|
| H01–H14（14） | identity/TextValue/back/filterIds/presentation；IocHeader呈现、可访问性与显式状态 | B1，共用候选安全前置B0 |
| F01–F04（4） | 原有boolean及whenTrue/whenFalse，hint | B2 |
| F05–F17（13） | 原有dimension、结构树、options与candidateContext；业务码不写死 | B2；真实档位与候选接线按证据验收 |
| F18/F19（2） | dimension封闭是/否枚举，allBehavior=unrestricted | B2 |
| F20（1） | candidateContext时间依赖+V2端口+合法交集门禁 | B4 |
| F21–F24（4） | dimension真实档位/授权候选，denied/unconfigured显式状态 | B2/B4 |
| M01–M06（6） | 单选币种、范围单位/预设、clearOnChangeOf、USD及静态字段选择 | B3；依赖B0/B2 |
| T01–T03（3） | 既有timePoint/timeRange | B1/B2 |
| T04/T05（2） | modes、ISO周、query.timeModes闭合 | B4 |
| T06/T07（2） | presets与统一时钟 | B2/B4 |
| T08（1） | 离散月份dimension候选窗口；不连续集合绑定 | B2，只有dtime时仍明确缺口 |
| T09（1） | 原有period+锚点+IOC位置校验 | B1 |
| T10/T11（2） | availability、可信期间事实与UI max/日期约束 | B4 |
| T12（1） | 已应用TextValue、既有time window/具名算子 | B1/B4 |
| L01–L12（12） | B0协调/候选/身份安全；B2规则；L12服务端搜索不默认启用 | B0/B2/B4 |
| N01–N08（8） | 显式导航及目标输入验证；来源viewstate/entry保留原规划 | B5本轮仅传值；恢复未选，见§22 |
| O01/O02（2） | 已有back/presentation保留；不新增来源视图恢复 | B1；B5范围见§22 |
| O03–O07（5） | theme、tableExport、fullscreen、金额面板、pageExport | B3/B6；可选动作按用户选择 |
| O08–O12（5） | refresh/reset/explicit提交/自动动作菜单/搜索契约 | B6候选能力，默认仍immediate且无附加动作 |

共14+24+6+12+12+8+12=88，未删项。B编号细化§10既有批次，不代表本轮已获得全部实施授权。

| 批次 | 具体可交付范围 | 必须一起完成的闭环 |
|---|---|---|
| B0 共用状态安全 | FilterCoordinator、递归依赖、请求代次、缓存键、筛选门禁 | 控件/action/地图/URL/restore同入口；复用权限主计划同一实现 |
| B1 最小公共页头 | 根iocHeader、身份/引用/折叠/返回意图；年季月与详情单月；旧布局兼容 | 三种实际pages场景；排重；TextValue遍历、版本能力、静态呈现 |
| B2 业务筛选 | 单/多选、有限枚举、结构树、boolean、依赖与候选状态 | 保留旧树/旧dependsOn语义；真实query绑定与普通/详情私有归属 |
| B3 金额货币 | 范围面板/单位/预设、USD、静态字段选择与币种事务 | 查询字段、格式、图表/表格/计算与XLSX/PDF一致；缺真实USD不能标全量完成 |
| B4 复杂时间/候选 | V2候选端口、可信latest/max、ISO周/模式query、离散月份 | 适配器能力检查、SourceProgram/Relay/去重/初始数据；真实DQE另验 |
| B5 显式跨页传值（用户收窄） | 目标输入投影、row/param/filter显式URL映射、来源与目标独立 | 概览→列表→详情传值、类型/粒度/必需输入和候选门禁；不实现视图恢复，见§22 |
| B6 可选操作（用户挂起） | 表格导出、整页PDF/PNG、全屏、主题及刷新等保留规划 | 本轮不实施、不启用，见§22 |

每个产品批次必须同批完成`packages/page`的Zod/领域类型/引用语义/能力门禁与可读版本测试；`pages/`可直接消费场景、Playground目录及说明；页面元数据/参数/导出文档；生成authoring知识和工具可创作/可编辑能力；Bundle与独立安装消费者闭合。不能只给Schema类型而让创作生成仍丢字段。版本按实施时实际下一可用minor登记，不将本节PROPOSAL作为产品版本。

兼容和技术债务明确如下：

1. 旧页面没有iocHeader，DashboardToolbar/reportHeader、六类筛选、相对时间与现有默认行为保持；迁移按用户选择的页面allowlist进行，不批量改IOC四页或改report布局。
2. period放置范围、V2候选、options、modes、USD/字段选择分别登记能力，旧引擎拒绝不认识的能力，不能读后静默忽略筛选。对非法展示枚举的容错待另一主计划批准后统一接入；业务语义失败始终阻断相关执行。
3. 新字段选择会影响fieldName/字段闭包/验证/导出，改动面较大，独立B3交付；不因页头想换币种就对全部绑定偷偷放宽。动态单字段货币、任意跨层混选、仅dtime多区间不是本草案已解决能力。
4. 共享Condition/displayInputs仍待审；B0可先实现确定的递归清理/代次保护，涉及动态启用与权限输入必须与该方案统一审核，不复制一份IOC专属规则解释器。
5. 导出新入口需抽取共享叶子配置并收窄内部Context；PDF/PNG当前能下载不等于IOC静态视图、真实门户ShadowRoot/CSP、Worker、字体和完整数据均已验收。
6. 最新期/授权候选/真实周编码/金额档位来自Adapter或受控字段契约，本设计不索取新的内部调查材料；缺真实能力时如实unavailable，保留模拟验收与真实接线验收的区分。

### 17.11 本轮验证与审核入口

本轮仅修改主计划及其索引阶段说明。未修改生产协议、组件、运行时、业务页面、原型、ADR或authoring分发；未执行提交/推送。设计示例按草案作JSON语法、引用、唯一ID、控件归属、导出目标及88项落点核对；没有对未知PROPOSAL版本运行现有校验器并宣称通过，也没有执行产品测试冒充实施验收。

建议按此顺序审查：①根iocHeader及身份/筛选唯一归属；②UI复用与筛选共用增量；③复杂时间/USD/候选的能力范围；④显式导航与完整返回状态；⑤先实施B0+B1、其余按上述批次展开。审查的是具体Interface与失败语义，不重新征集已确认的视觉方向和业务调查。用户认可后才进入正式编码；单次认可本节结构仍不等于选择迁移所有页面或启用所有可选操作。

## 18. 2026-10-19 B0+B1正式实施

用户已明确认可§17并授权先完成B0+B1。实施基线HEAD为`952b3a273f0f4f8be5820f5af1bb76c2f5afa513`，源码6.31；本批增量登记为6.32。工作隔离在`/Users/moon/.codex/worktrees/ioc-header-b0-b1/DataDashboard`，原工作区并行ADR、文档、原型和内部材料保留；未提交或推送。

- B0：旧write/writeMany、控件/action/地图/URL与restore进入共用协调，整组类型/日期/只读校验，递归后代清理，一次状态通知；自动清空待用户确认，相关查询及下游和导出受门禁约束，无关查询继续。候选按实例、filterId/level和完整规范化依赖隔离，成功/失败均比较请求代次，重试用当前依赖。
- B1：根iocHeader、身份TextValue、缺值整项省略/显式未命名、唯一筛选归属、实际首行折叠与inert、合法来源返回意图、静态呈现。复用产品日期控件并保留月→季→年→月的锚点、详情单月和离散集合语义。普通/密集/详情及无标题四个真实声明页面在pages目录，不迁移已有IOC业务页。
- 分发：同源Zod、类型、能力门禁、引用语义及正反契约、文档/索引、Python产品Bridge和set_ioc_header受控编辑、本地Skill及Bundle生成闭合；仓外Skill与tarball安装消费者验证见验收记录。

本批仅交付上述B0/B1确定能力。B1的facts只消费TextValue；HeaderFactReference、Condition/displayInputs、options/selection/结构树、动态月份候选窗口、时间模式/最新期、USD、完整viewstate以及可选actions仍按B2–B6规划。88项编号及其落点继续保留，不能将本批标成88项全部完成。返回只验合法returnContext+back意图，不宣称B5完整来源视图恢复。

实施命令、页面入口、浏览器宽窄/交互、独立安装、静态呈现和真实服务边界统一记录于[本批验收](../evidence/ioc-header-b0-b1/acceptance.md)及[证据账本](../evidence/ioc-header-b0-b1/alpha-tests.md)。本地合成、源码和安装成功不是原系统像素等价或真实DQE/CloudIOC/Relay/DS/门户/CI/部署验收；没有新索取内部材料。

## 19. 2026-10-19 B2业务筛选正式实施

用户确认B0+B1结果后要求继续推进，本批承接B2。起点是同一隔离工作树的未提交6.32状态，完整文件哈希与备份位置冻结于`docs/evidence/ioc-header-b2/evidence/start-manifest.json`，不能将HEAD6.31当作B2净起点。本批能力版本6.33；原工作区并行修改保留，未提交或推送。

- 协议与执行：dimension的selection、required恰好一个、有限options/disabled、显式allBehavior、treeSelection=level、candidateContext；六类共用hint/clearOnChangeOf。合并新旧依赖图、普通/详情私有归属、版本及参数/默认值/整组写入校验，同一有效查询编译服务普通、组合、查询捕获与导出。全选不限只省略对应动态谓词，原查询静态谓词和URL/UI已选值保留。
- 候选与协调：有限枚举不发候选请求；动态仍走候选端口。保留旧dependsOn及斜杠树，结构树按level/parent显式构建且业务码不拆分；required切层保留控件内草稿，选择后整体提交。当前上下文完整候选驱动clear/intersection，空交集等待显式确认，denied/unconfigured及当前层空候选阻断相关查询、下游、初始数据/seed复用与导出，无关源继续。
- B2结构树和期间依赖需要V2候选的最小请求/结果契约，因此提前落地该公共端口及UI/SourceProgram共享校验和实例回执复用；无能力时不丢时间约束降级，不跨不同Adapter合并授权候选。这只闭合B2已声明约束，F20完整能力、可信latest/calendarWindow/ISO周/新timeModes仍留B4，不改88项计数和剩余规划。
- 页面及分发：新增`ioc-header-business-options-demo`、`ioc-header-business-tree-demo`、`ioc-header-business-detail-demo`，直接消费真实声明与查询绑定；共用说明、静态已应用条件、受控维度/日期编辑、本地Skill、Bundle与安装消费者同批闭合。静态导出中的tooltip说明展开成正文，避免在静态结果留下交互折叠内容。

实施验证和证据入口：[B2验收](../evidence/ioc-header-b2/acceptance.md)、[B2账本](../evidence/ioc-header-b2/alpha-tests.md)。交互预览使用本地合成HTTP契约服务；没有迁移既有IOC业务页，没有新增默认可选操作，没有把本地验证提升为真实DQE、CloudIOC、Relay、DS、门户、CI或部署验收。Condition/displayInputs仍待审；B3–B6其余能力保持规划。

## 20. B3 金额货币本地实施（2026-10-19）

沿§17.5实施Schema6.34：静态`money.currency`新增USD，`usd-adaptive`显式表示美元；`byFilter`仅选择已声明静态money字段，控制器为required单选封闭枚举且cases穷尽，不递归、不做汇率换算。所有一致枚举组合逐项验证（最多4096，业务数据源共享），未知选择不使用首项兜底；字段、格式、单位、图表、表格与静态导出统一投影。详情先绑定私有筛选再选择case。旧业务数据中的同名byFilter键不作为声明扫描。

`numberRange`新增constraints、units、presets；金额状态/URL/查询保存基本单位，输入与预设按显示scale仅换算一次。金额拒绝负数与非有限值，支持单边/全部，新金额默认严格双边，旧通用相等范围兼容。`metricByFilter`是查询的隐式选择依赖，与units的静态money币种逐项匹配。币种变化沿共用状态事务清金额，并继续等待明确确认范围；错误整组写入拒绝，无关查询继续。表格旧列排序/搜索/表头条件在case变化时清理，候选字段按已应用case准备；导出在首次异步前冻结case及条件，显示选择器未合法选择时禁止导出等待占位。

实际验收页为`pages/capabilities/ioc-header/scenarios/ioc-header-currency-demo.json`，本地合成HTTP提供独立人民币/美元基本单位字段及两组同币种计算结果。已同步页面协议正文、能力门槛、正反契约、金额受控创建/更新与保存重开、字段选择列编辑、独立Skill、Bundle与六包仓外消费者。没有迁移已有业务页，没有新增默认可选操作，也未启用B6的IOC整页导出按钮；已有静态呈现与表格XLSX路径消费相同case。

证据入口：[B3验收](../evidence/ioc-header-b3/acceptance.md)、[B3结果](../evidence/ioc-header-b3/result.md)、[B3账本](../evidence/ioc-header-b3/alpha-tests.md)。可交互预览为`http://127.0.0.1:4200/pages/ioc-header-currency-demo`。本批本地实施不等于真实USD业务、DQE、CloudIOC、Relay、DS模型、门户、CI或部署验收；这些仍未运行。B4–B6及待审Condition/displayInputs保持原规划，原88项清单和期间语义不变。不提交、不推送。

## 21. B4 复杂时间与候选实施记录（2026-10-19）

承接B3未提交6.34快照，按§17实施6.35：日/月/ISO周及完整静态query.timeModes、时间快捷范围、可信数据期间事实的具名displayInputs快照/订阅、latest/latestComplete的独立initial/max策略、静态日期边界/禁选、V2十二个日历月候选及时间模型交集。模式、范围、查询与URL原子一致，详情单月、自然年季月/之前12完整月、离散1/3月继续分开；不增加私有周码或仅dtime的多区间绑定。

无上下文证明的旧initial/seed/执行快照不复用；读取与导出冻结条件、时钟及事实，捕获查询的谓词按冻结条件重编译。合法URL在动态默认初始化之前解析；同上下文事实更新保留已应用选择并重新检查相关查询/候选，身份修订变化停止旧实例并要求重新挂载。仅落地已批准DataPeriodFact分支，Condition、通用权限规则及任意对象路径保持待审。

实际场景为time-modes/time-presets/availability/calendar-window四个IOC验收页；合成HTTP宿主在`http://127.0.0.1:4204/pages/ioc-header-time-modes-demo`。共用协议、正反例、静态呈现、XLSX、受控时间程序原子编辑、保存重开、Skill/Bundle与安装消费者同批核验，证据写入[本批账本](../evidence/ioc-header-b4/alpha-tests.md)和[本批结果](../evidence/ioc-header-b4/result.md)。验证结论以这些记录的实际状态为准。

其余B5/B6保持规划，88项功能清单不删改；没有批量迁移业务页，没有默认新增可选操作，没有提交或推送。真实DQE/CloudIOC/Relay/DS模型/门户、私有周码及CI/部署仍未运行，本地合成验收不能代替真实服务验收。

## 22. B5范围收窄与B6挂起（2026-10-19）

用户明确“B5只做跨页传值就行，不需要恢复，B6挂起。执行”。本决定覆盖§17.9及既往批次表的完整恢复建议：当前B5仅实施N01–N03及跨页URL打开/刷新所必需的输入解释。row/param/filter按显式映射生成URL；目标输入投影校验类型、日期粒度、层级和必需值，授权候选由目标页就绪后验证；不同页面实例独立，不回写来源。

不创建viewstate、capture/restore、TableSession恢复、导航来源条目存储，也不恢复排序、分页、Tab、展开行、页头折叠或滚动。原88项编号保留，N04–N08未选部分不计入本批完成；已有基本返回/URL行为保留。B6整体挂起，不引入或启用任何可选操作。

实施在既有隔离工作树承接未提交6.35；需要新协议字段时登记下一可用minor6.36。页面场景、文档、受控创作、Skill/Bundle与安装闭合仍为完成条件。验收入口：[B5范围](../evidence/ioc-header-b5/scope.md)、[B5结果](../evidence/ioc-header-b5/result.md)。真实服务与模型单独标明，不提交推送。

B5本地实施已完成（Schema6.36），实际source/list/detail页面、Playground、受控创作与分发闭环已验收。具体命令、重试说明与证据边界见[B5验收](../evidence/ioc-header-b5/acceptance.md)和[B5账本](../evidence/ioc-header-b5/alpha-tests.md)。

B5兼容实施说明：新链路显式声明strictURLInputs:true；旧页兼容规范化可能升至当前版本，故不按规范化后的版本号暗中切换URL行为。受控set_url_input_validation独立编辑策略；恢复和B6范围不变。

## 23. 2026-10-20 main合并与协议版本协调

用户授权提交并合并main。交付期间main已发布图表高级呈现6.32、Tab URL初值6.33、指标卡前置文字6.34及统一呈现条件6.35，IOC未发布实施版本顺延：B0+B1为6.36、B2为6.37、B3为6.38、B4为6.39、B5为6.40。能力表、实际IOC页面、正反契约、协议正文与local-authoring分发按同一映射更新；main既有能力版本和行为保留。前述实施日志/指纹为当时未合并快照，不改写历史证据。

统一接缝沿已发布displayInputs/DisplaySnapshot扩展可选timeZone/periods具名期间事实分支；permissionRevision统一作为身份修订，保持单一订阅与销毁门禁，不创建第二个事实源。FilterState保留已发布数值revision读取，并由共用协调器管理事务、候选与查询门禁。B5继续仅传值，恢复不实施，B6挂起。

合并验证与交付结论见[交付记录](../evidence/ioc-header-delivery/result.md)；真实服务验收边界不因提交或CI通过改变。

合并中的非法子筛选写入仍按§17.6已批准规则整组拒绝；父筛选未变化，因此后代保留在原上下文。main的陈旧后代回归用例同步验证整组拒绝、零通知、修订不变，不能恢复为跳过非法子项后部分提交。

交付兼容性回归补充：旧页未声明selection的initialParam数组继续初始化tabs已应用条件，点选仍提交单值；显式single的初值与写入保持严格校验。非strictURLInputs的图表非法URL先排除再读取默认值。候选加载期间仅暂存经既有条件/源定义验证的初始快照，通过候选后首次释放且不重复查询；条件、事实或表格视图变化丢弃暂存，后续失效不得复活旧行。安装消费者复制完整运行夹具，B4布局采集固定仓内输入并输出到Playwright临时产物，不依赖个人电脑路径或改写历史证据。

## 24. 页头实现统一（2026-10-20）

用户决定“DashboardToolbar 的能力并入 iocheader，后面只需要保留一个”。本决定更新早期 IOC 与通用看板分别呈现的实现边界：运行时只保留 IocHeader，原 Dashboard 行内标题、返回、按数量收纳、紧凑吸顶、只读与说明均并入；FilterBar 继续承担共享筛选控件。dashboardToolbar 仅为旧元数据兼容输入，不保留第二套渲染组件。新声明使用 iocHeader，原三个 IOC 业务演示页迁移，已有期间页改为统一页头内只选年份，不新增公开演示页。

本批协议为 6.41；只选年份由共享期间筛选的 periodModes 声明，不引入页头专属时间状态。既有模式对象列表、查询、候选、跨页与导出状态沿用共享能力；B5 仅传值、B6 挂起等决定保持。实际测试、分发和服务边界见[统一页头验收](../evidence/unified-page-header/README.md)，本批仍为未提交本地改动。

## 25. Playground 展示与能力索引优化（2026-10-20）

用户认可“一个完整演示入口 + 四个功能专题 + 能力一览”，本轮只优化开发工具。首页增加 IOC 公共页头能力筛选，并将该集合归入功能演示；15 个验证页面收拢为一个 `/ioc-header` 入口。基础呈现是四类功能共用结构，不与时间、业务筛选、币种金额、跨页传值并列为独立产品能力。

能力一览按使用者可理解的 32 项能力归并，给出适用条件、状态、演示及编号映射；全部 88 项编号在已支持/需业务接入/暂缓/暂不支持中完整且唯一追溯，不把接口能力当作真实业务已经接通。恢复保持未选，B6 继续挂起；不新增操作、批量迁移业务页或改变时间/金额/导航语义。

试验场仅为明确注册的 IOC 页头样例提供内置合成查询、候选和期间事实，使本地可直接体验；无未知查询或候选的网络回退。原页面 JSON、产品协议与 local-authoring 契约不变。实际结果及证据边界见 [验收记录](../evidence/ioc-header-playground/acceptance.md)。用户已于本轮授权提交并合入 main；交付保留并行修改，按最新 main 复验。


## 2026-10-22 归档批次按主线迁移

用户明确以主线契约为准交付已确认行为。七主题整体确认入口 `/ioc-header-review` 与12份正式页面复用唯一页头、FilterCandidatesGateway/DisplayInputs、selection.mode、候选上下文和原子清除。6.46补齐必选多选、无依赖候选和units.cases币种预设；不合入旧6.33并行协议。地区部/代表处在新增及主线相应示例中均显式单选。范围、命令及真实服务边界见[迁移验收](../evidence/ioc-header-main-delivery-2026-10-22/acceptance.md)。生产B组字典/payload/逐源接线与C组未决问题继续保留。

# Dashboard 期间筛选实施规划

更新：2026-10-15。状态：用户批准后已完成本地实现，本功能引入于 Schema 6.27，保留 6.26 读取兼容；并行 PDF 批次已将当前写出版本升级为 6.28。功能验收与限制见[验收记录](../evidence/dashboard-period-filter/result.md)。下文“当前能力与缺口”为实施前勘察，实施结果以验收记录为准。

建议在现有 `timeRange` 筛选器上增量增加期间选择形态，复用顶部筛选栏、筛选状态、相对时间求值与查询时间绑定。年／季／月／近一年共同拥有一个筛选器 ID，范围变化一次性提交。正式实现不复制原型的 Dashboard 外框或另建查询执行流程。

## 已确认的交互

| 选项 | 右侧呈现 | 范围语义 |
|---|---|---|
| 年 | 年份框，例如 2026 年 | 完整自然年 |
| 季 | 季度框，例如 2026 年 Q4；面板 Q1／Q2／Q3／Q4 | 完整自然季度，可切换年份 |
| 月 | 月份框，沿用现有月份选择器 | 完整自然月 |
| 近一年 | 只读文本，无日期框、日历按钮或截止月份选择 | 当前月之前的 12 个完整月份，不含当前月 |

2026 年 10 月选择近一年，显示 `25年10月~26年9月`，实际闭区间为 `2025-10-01` 至 `2026-09-30`。它与年／季／月的已选日期无关；切回年／季／月时保留先前选中的期间。该保留值是会话内交互草稿，不单独形成查询条件。

控件放在 Dashboard 通用顶部 filter 中。原型的独立筛选行只表达归属；正式排布服从现有 `DashboardToolbar → FilterBar`，包括普通／compact 形态、更多筛选、容器宽度与只读模式。作为一个筛选器计数，不把四个选项拆成四项筛选。

原型：[源码](../../packages/ui/prototypes/dashboard-time/README.md)，[近一年截图](../../packages/ui/prototypes/dashboard-time/evidence/filter-rolling-range.jpg)，[季度截图](../../packages/ui/prototypes/dashboard-time/evidence/quarter-q-labels.jpg)。图表与指标仍是静态示例，原型未证明真实取数。

## 当前能力与缺口

| 层次 | 已实现且本轮核对的能力 | 本次增量 |
|---|---|---|
| 基础 UI | `DatePicker` 支持 month／date 单点及范围；含年份导航层、键盘、浮层、ShadowRoot、min／disableFuture | 年份目前是导航层，不能直接作为年精度提交；无季度提交能力、无组合切换器。扩展真正的 year／quarter 选择，保持旧模式行为 |
| 筛选声明 | 六类筛选器，日期为 `timePoint`／`timeRange`；后者有 month／date／datetime 精度 | 增加期间选择形态与初始模式声明；不能只改 Svelte 控件 |
| 相对时间 | `resolveRelativeTime` 已支持 month + lastN(12) + includeCurrent=false | 直接复用“近一年”语义；补期间选择到范围的统一解析与月份序列化 |
| 筛选状态 | `FilterState`、URL 读写、最后筛选记录、相等判断、批量写入均已存在 | 当前时间范围只有 from／to，无法恢复“年／季／月／近一年”模式；增加有校验的选择语义及序列化 |
| 顶部 filter | `DashboardToolbar` 使用 `FilterBar`，已有常驻／更多筛选／内容筛选分组 | 在 `FilterBar` 的 timeRange 分支分发新形态；复用原分组策略，验证控件宽度和浮层 |
| 生效查询 | `composeEffectiveQuery` 将 timeRange 传至 `target:time`；DQE 保留原查询的 period／is_aggregate | 继续发送实际 from／to，不把 Q4 或展示文案送进查询；首期不新增网关协议 |
| 页面参数 | 日期参数初始化、提取候选、确认与文本引用已有 | 参数仍只初始化，控件不反写参数；定义与期间模式的兼容及不可推导时的拒绝规则 |
| 创作 | Python 有 add／update／remove_date_filter；人工日期配置目前挂在报告页头 Inspector | 同步新声明与工具契约；人工 Dashboard 需要页面级入口，不能要求选中报告页头 |
| 分发与验收 | 已有协议导出、独立本地创作 Skill、pages 场景与跨包兼容检查 | 同批生成并验证新契约、知识、校验器、页面及浏览器行为 |

本轮执行现有相对时间函数，固定时钟为 2026-10-15，得到 `2025-10-01` 至 `2026-09-30`。这是现有纯函数能力的验证，不代表新控件已接入。

## 推荐的职责与协议路径

### 选择形态扩展 timeRange

优先保留 `type:timeRange`，增加可选的期间选择声明。它表达的仍是时间窗口，因此无需新增第七类筛选器，也无需把 `timePoint` 的等值语义改成区间语义。旧页面不声明新字段，继续使用原有范围选择器。

不采用“一个维度筛选器负责选项、一个时间筛选器负责范围”：它会制造两个 ID、两次状态更新及无效组合。也不使用两个 input 私下拼出季度后绕过页面声明；刷新、导航、创作和服务端取数都必须理解该状态。

拟定模型包含三个不同信息，最终字段名与 Schema 在实施第一步冻结：

- **声明**：选择形态、允许的四种模式、初始模式及初始期间。默认形态建议月、初始期间建议当前月份；原型默认近一年只是为了展示新增规则，不视为产品默认值已确认。
- **已应用选择**：year + 年份、quarter + 年份／季度、month + 年月，或 last12Months。近一年不接受用户传入的截止月份。
- **生效范围**：唯一纯函数从选择及共享求值时刻物化 from／to。范围是派生投影，不允许控件、调用者和查询分别计算；必要的状态冗余由同一写入入口校验一致性。

保留 `precision:month|date`，它决定实际查询范围的编码，不等于左侧选项，也不等于图表的时间聚合粒度。新形态首期不支持 datetime，校验明确拒绝；已有 datetime 范围筛选保持原样。

| 模式 | date 精度的实际范围 | month 精度的实际范围 |
|---|---|---|
| 2026 年 | 2026-01-01 ～ 2026-12-31 | 2026-01 ～ 2026-12 |
| 2026 年 Q4 | 2026-10-01 ～ 2026-12-31 | 2026-10 ～ 2026-12 |
| 2026 年 10 月 | 2026-10-01 ～ 2026-10-31 | 2026-10 ～ 2026-10 |
| 2026 年 10 月的近一年 | 2025-10-01 ～ 2026-09-30 | 2025-10 ～ 2026-09 |

现有 `report-date-filters.ts` 明确禁止 month 精度的结构化相对默认值，只接受显式 YYYY-MM 两端；`resolveRelativeTime` 当前的 month 参数也没有返回月份字符串。这不是现成可用的“动态月份范围”。实施须为新期间形态增加受控的默认选择和统一序列化，不直接删除旧形态限制，也不把 date 值冒充 month 值。

### 计算与状态

期间纯函数放在 `packages/page` 的无框架模块，接收显式 `now`，并由浏览器与 `@metriccanvas/data-execution` 共用。基础 UI 只处理日期／期间选择、样式和事件，不理解页面协议或直接写查询。

运行时写入保持一个事务：选择合法后，物化范围并更新选择语义／范围，触发一次有效的筛选通知。未完成或非法输入保留上一合法选择。相等判断区分 UI 模式变化与查询范围变化；范围相同可以不重复取数，但仍更新模式显示。不能只比较 from／to 而吞掉模式变化，例如 1 月时“上一自然年”和“近一年”可能范围相同。

URL、最后筛选记录及返回恢复必须携带模式和必要期间值，不能从绝对范围猜测模式。近一年恢复时使用相对选择重新求值，不将上次绝对范围永久冻结；同一次已应用筛选批次保存实际范围，供查询、文本和导出共同消费。旧 timeRange URL 格式保持原样。新形态收到非法或不完整模式／期间时不静默套用猜测值，按必填规则保留或恢复声明的合法初值。

建议的时钟规则：页面打开、显式重新选择近一年时取得当前本地月份；同一次初始化或提交共享同一 `now`。长驻页面不加月界定时器，不在导出过程中重新计算；下次打开／显式选择才刷新期间。跨月后重新选择当前模式也须可重新求值。此规则是本计划建议，实施前冻结。

### 查询与取数

仍绑定 `filterBindings[filterId] = {target:time}`，消费物化范围。原查询保留时间聚合口径；有绑定的源重执行，没有绑定的源不受影响。时间目标的唯一来源约束继续生效，不能同时保留固定 start／end、页面参数时间来源或另一份时间筛选。

month 精度仍要求查询显式 `filter.time.period=month`；date 精度按已有查询契约校验。范围改变须沿用分页回首页、下游结果绑定重新调度、取消／迟到结果隔离及错误态。已有 `source.initial` 只在当前条件与默认条件匹配时可用；相对期间跨月后的旧 initial 不能冒充新范围的结果。

近期已将查询合成与初始化放入 `@metriccanvas/data-execution`。实现应修改共享真源并覆盖浏览器／单次页面执行，不能只改引擎里兼容导出的文件而让 Relay 取数继续按旧默认执行。

### 参数 文本 导出

- 页面参数继续是页面打开时确定的输入；选择期间只写筛选状态，不修改参数定义或实际参数值。
- `initialParam` 与新期间默认选择互斥。绝对参数初始化须与声明的初始模式吻合，例如季度必须完整覆盖一个自然季度；不完整季度不截断、不猜 Q。近一年不能由绝对参数覆盖时钟，矛盾声明拒绝。
- 参数提取沿用已有“相对时间先明确为可信绝对基线”的规则；提取结果须保留期间形态。不能把动态近一年提取成永久固定参数，也不能为 Dashboard 自动生成报告页头控件。
- 普通 `{filter,format:period}` 文本仍展示已应用实际范围。短文案 `25年10月~26年9月` 先属于该控件，不顺带新增全局 period-compact 格式。
- PDF／PNG／Excel 导出捕获当前已应用范围，不能在导出中以另一个当前时间重算。只读呈现展示实际选择和范围，不产生可编辑控件；报告页头旧路径需回归。

### 创作与兼容

本地创作 Skill 能声明该形态、选择默认模式、绑定多个查询并说明不含当前月。Python 日期编辑工具同步新增字段与可读版本，尤其避免当前 add／update_date_filter 硬写 6.13 降低新页面版本。不另建另一套期间编辑工具链。

人工页面搭建增加 Dashboard 页面级筛选入口，复用日期绑定校验、原子文档编辑、保存／撤销及初始行失效策略。当前 `ReportDateProperties` 仅在选中 reportHeader 时出现，不能直接当作 Dashboard 的现成入口。拆出通用日期筛选编辑逻辑，报告页头只保留位置引用处理。

Schema 采用增量次版本及 capability gate，同步公共类型、Zod、语义校验、合法／非法向量、公共导出快照和版本门禁。新形态先限定 Dashboard 顶部声明；报告页头与图表独立筛选不自动开放该新形态，保持已有模型。存量报告与 timePoint／普通 timeRange 页面无需迁移。

## 影响范围

| 位置 | 计划改动 | 影响级别 |
|---|---|---|
| `packages/ui/src/components/date-picker/`、公开入口与浏览器夹具 | 年／季选择面板及输入格式；月面板复用；共享浮层与键盘行为 | 直接修改，回归旧模式 |
| `packages/page/src/filter.ts`、`schema/filter.ts`、`version.ts`，期间解析模块及相关校验 | 声明、默认值、精度、期间解析、能力门禁 | 直接修改 |
| `packages/data-execution/src/filter-values.ts`、`effective-query.ts` 及执行入口 | 初始化和选择物化；查询继续消费标准范围，必要时补充类型分支 | 直接修改与回归 |
| `packages/engine/runtime/src/filter-state.ts`、`filter-history.ts`、导航、orchestrator | 原子状态、URL／恢复、相等判断、共享时刻、重执行与初始行匹配 | 直接修改与回归 |
| `packages/engine/runtime-ui/src/filters/FilterBar.svelte` 及新期间适配器 | 新形态分发与回调；年季月／近一年组合交互 | 直接修改 |
| `dashboard/DashboardToolbar.svelte`、`filter-groups.ts`、`RuntimeSurface.svelte` | 顶部接入、控件计数、常驻／更多筛选、只读和窄宽度 | 主要复用，按实际缺口调整 |
| `packages/page/src/extract-page-params.ts`、参数初始化和筛选文本消费 | 保留形态，初始化兼容，拒绝动态相对选择被固定化 | 直接修改与回归 |
| Platform 的 Inspector／页面级设置、日期文档编辑逻辑 | Dashboard 页面级新增／编辑／删除及绑定配置 | 新入口与通用逻辑收敛 |
| `metriccanvas-authoring/tool/` 日期工具、契约投影、Skill 工作流 | 受控生成／编辑新筛选及绑定，版本策略 | 直接修改 |
| `contracts/metriccanvas/`、本地创作 Skill 与独立安装校验器 | 从真源生成，同步知识／契约／版本／哈希 | 必选生成及校验 |
| `pages/`、Playground 场景目录、页面协议文档 | 完整场景与文档、自动验收直接消费页面 | 必选交付 |
| embed、Platform、Playground、查询分页、PDF／Excel | 包消费、ShadowRoot、请求与导出范围一致 | 兼容验收；有缺口才改代码 |

首期不要求修改 DQE 服务端协议或 Java 持久化接口；须核对其现有 Schema／筛选记录是否有封闭枚举，若有则列为真实接入依赖，不能用本地通过替代。聚合粒度联动如被选择，会扩大查询模型及真实 DQE 验收范围。

## 实施顺序与完成条件

| 阶段 | 工作 | 阶段出口 |
|---|---|---|
| 0 规格与基线 | 冻结交互、初始模式、聚合粒度范围、时钟／恢复规则及原型与正式工具栏差异；按 SDD 冻结 QA；盘点并行工作与协议版本 | 期间语义和文件清单可执行，未进入产品编码 |
| 1 协议与纯函数 | timeRange 增量声明、选择联合、精度序列化、默认／参数约束、版本与向量；期间函数接收显式时钟 | TS／独立校验规则一致，边界通过 |
| 2 共享执行与状态 | 浏览器及共享执行初始化；URL／历史恢复；原子提交、查询合成、initial 匹配、分页与迟到响应 | 同一选择在各执行路径产生同一范围，无绑定源不重查 |
| 3 基础 UI 与顶部 filter | 扩展 year／quarter；组合适配器进入 FilterBar；只读范围；普通／compact／更多筛选／ShadowRoot | 正式 Dashboard 场景真实驱动筛选，视觉和键盘行为可验 |
| 4 创作入口 | 人工页面级入口、Python 日期操作、默认与绑定配置、保存撤销、参数提取 | 新建、编辑、删除均经统一校验，产物可再次加载 |
| 5 文档与分发验收 | 页面、目录、协议文档、Skill 与契约生成、独立安装、包消费及浏览器／导出验证 | 功能到页面／文档／Skill 映射完整，分层报告结果 |

用户已批准连续实施；上述阶段均已在本地执行。真实网关、Edge 与全仓原有失败单独登记，不与本功能定向验证混同。

## 验收场景

1. 年／季度 Q1–Q4／月份均选择完整期间，覆盖闰年二月、跨年和季度边界；无半输入提交。
2. 固定当前月为 2026-10，近一年文本严格为 `25年10月~26年9月`，实际范围正确，日期输入和日历按钮均不存在。
3. 先选 2024-02 再选近一年，仍按当前月计算；切回月份恢复 2024-02。当前模式再次选择、跨月重开与导出各自遵守时钟规则。
4. 单筛选器一次提交；相同范围不同模式仍能正确更新显示，不触发无意义重复查询。
5. 有绑定查询传入实际范围，无绑定源保持原样；保留查询聚合、分页回首页、结果绑定依赖更新、取消与迟到响应隔离。
6. month 和 date 两种精度各有完整页面，编码不混用；datetime、新旧默认冲突、非法季度、参数精度／期间不匹配均有拒绝用例。
7. URL／导航返回／最后筛选恢复保留模式；动态近一年不被旧绝对记录冻结；非法 URL 不清空必需合法状态。
8. 标准／compact、常驻／更多筛选、窄容器、ShadowRoot、键盘及只读状态均覆盖；整个组合按一个 filter 计数。
9. 人工配置和本地创作分别产出可校验页面；参数只初始化、不反写，报告页头和存量日期筛选回归。
10. 导出沿用已应用范围；跨月情况下导出日期、查询日期和页面所示日期一致。

建议新增 `pages/capabilities/filters/dashboard-period-filter.json` 与月份精度场景，注册到 `apps/playground/page-catalog.json`，写入 `pages/README.md`。自动验收直接读取这些页面，不在测试内临时拼出功能。异常由非法契约夹具及状态／执行测试补充。

静态／单元、浏览器与 Sim、独立 Skill 安装、真实模型、真实 Relay／DQE／Java、推送与 CI 分开报告。本次已验证正式控件、实际请求合成与安装包；真实接入未验证。

## 本次采用的实施规则

- **时间聚合**：推荐首期只改变筛选窗口，保留各查询原聚合粒度；若同时改变聚合，需明确四档到查询粒度的映射及不同图表的适用范围。本次按已批准计划采用，不修改查询聚合。
- **默认与时钟**：建议默认月／当前月份，近一年在页面打开或显式选择时求值；年／季／月的未来期间限制沿用显式配置，不从新控件自动推断。本次按已批准计划采用。
- **协议字段与初始化**：按上述选择／范围分工冻结字段、默认互斥、参数兼容及新形态 URL；不把原型里的局部变量名直接当正式契约。

## 源码依据

- [DatePicker](../../packages/ui/src/components/date-picker/DatePicker.svelte)、[日历计算](../../packages/ui/src/components/date-picker/calendar.ts)
- [日期筛选领域类型与相对时间](../../packages/page/src/filter.ts)、[筛选 Schema](../../packages/page/src/schema/filter.ts)、[日期绑定限制](../../packages/page/src/report-date-filters.ts)、[版本真源](../../packages/page/src/version.ts)
- [共享筛选值与初始化](../../packages/data-execution/src/filter-values.ts)、[生效查询合成](../../packages/data-execution/src/effective-query.ts)、[共享执行](../../packages/data-execution/src/execute.ts)
- [筛选状态](../../packages/engine/runtime/src/filter-state.ts)、[最后筛选记录](../../packages/engine/runtime/src/filter-history.ts)、[导出快照](../../packages/engine/runtime/src/export-snapshots.ts)
- [顶部工具栏](../../packages/engine/runtime-ui/src/dashboard/DashboardToolbar.svelte)、[筛选分组](../../packages/engine/runtime-ui/src/dashboard/filter-groups.ts)、[FilterBar](../../packages/engine/runtime-ui/src/filters/FilterBar.svelte)
- [参数提取](../../packages/page/src/extract-page-params.ts)、[人工日期编辑](../../apps/platform/src/lib/workbench/report-date-edit.ts)、[Inspector](../../apps/platform/src/lib/workbench/Inspector.svelte)
- [Python 日期编辑](../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/editing/interaction_editing.py)、[新功能验收要求](../agents/feature-acceptance.md)、[Skill 维护流程](../agents/local-authoring-skill-maintenance.md)

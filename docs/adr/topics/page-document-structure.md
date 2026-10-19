# 页面文档结构与书写原则

> 局部显式、就地声明；格式归组件字段绑定；分区容器、权重列轨、响应式宽度与布局形态的所有权划分。

6.18进一步补齐 `number-2-signed` 与 `number-grouped-signed`，全部 `number` 格式都有对应的带符号版本，各自保留原精度与千分位策略，统一按展示结果判断符号、正负颜色及变化箭头（[ADR-0103](../0103-signed-numbers-use-displayed-polarity.md)）。

**带符号普通数值（[ADR-0103](../0103-signed-numbers-use-displayed-polarity.md)）：** 6.17 新增 `number-signed` 与 `number-1-signed`。新格式按展示精度统一符号、正负颜色与变化箭头，舍入到零时无符号、普通颜色、无箭头；固定颜色仍含有效零，已有格式保持原始方向规则。组件绑定拥有最终格式，数据与计算不变，6.16继续读取。

**现行结论:** 页面文档局部、顺序地自描述:每个页面数据源在当前位置声明完整的结果字段契约,每个表格在当前组件中声明完整列;不提供 `fieldDefaults`、`fieldSets`、`columnSets` 或顶层 `definitions` 这类需要跳转才能理解含义的机制。`query` 数据源的标量字段可按 `dimensions`/`measures` 分组作为角色简写,结构化明细字段使用 `recordList/detail` 并就地声明项字段契约,DQE 已完成内容组合的受控富内容使用 `semanticHtml/detail`;查询字段须就地声明 `queryField`、`type` 等完整信息,具名算子产出字段就地声明类型与角色但不声明 `queryField`,不引入默认值、模板插值或表达式。

查询结果绑定自6.14起以稳定数据源与原始维度字段显式声明下游维度集合输入，计算产出不作为查询输入；透视列可覆盖默认取值字段，有限主集合左关联与完整辅助源分别校验，保留此前可读版本（[ADR-0099](../0099-raw-query-result-bindings-and-bounded-left-joins.md)）。

标准展示格式(`format`)归属组件字段绑定,不归属数据源;数据源和元数据快照只提供可被组件覆盖的 `defaultFormat` 展示建议。这样同一字段在指标卡、表格、图表中可以有不同格式,格式化实现仍集中在统一运行时。人民币金额以 `money/CNY` 表达结果字段语义、以 `cny-adaptive` 表达可覆盖的展示策略；受控语义 HTML 中无属性 `<data>` 标记的规范数字也由当前组件字段绑定格式化，Table 只作为显式消费者处理该能力。已在 Schema 6.32 实施并完成[本地验收](../../evidence/chart-echarts-option/result.md)的 [ADR-0110](../0110-hidden-echarts-presentation-options.md) 为柱/线/饼图新增隐含 `props.echartsOption`：允许 JSON 呈现补丁与模板覆盖当前显示格式，不更改原始数据或字段绑定；完整契约可查，面板不展示、AI 默认不主动使用。该子树不参与页面文本引用解析。

**显式数字颜色与图表标签（[ADR-0101](../0101-explicit-value-colors-and-chart-labels.md)）：** 6.16 在表格数字列、指标卡变化项就地声明 `colorRule`，固定颜色与正负映射互斥，颜色闭集只含 red/green，统一运行时不推断业务好坏。新规则的箭头方向与颜色独立；旧声明继续读取。柱状图、折线图和混合图可声明全部类别标签、旋转与常驻数值标签，不隐藏全量标签或用总计代替每项数值。图例、轴名称与文字所需间距归直接绘图容器内的通用几何计算，静态导出保留相同呈现策略。ADR-0110 局部允许高级入口声明 grid 边距，但几何计算保留防裁切修正；扩展失败单次回退基础图，基础失败留空，诊断仅 console，页面不显示提示。静态导出发生降级则终止且仅 console，不复用页头失败文字；这部分是已确认设计，实施状态由对应主计划维护。

页面 `id` 只用于文件命名、页面仓储加载、路由和修订归属,统一运行时不得按某个正式页面 `id` 选择样式、组件或交互;两份除 `id` 外相同的页面元数据必须产生相同的 DOM 结构和计算样式。正式页面 `id` 不得以字面量出现在产品源码中,由自动化门禁校验。

内容分区的外观自 Schema 5.0 起由可选的 `section.container` 单一声明(封闭三档:`plain`/`panel`/`card`,缺省为通用看板外观);`section.variant` 与 `section.layout` 已删除。内容分区缺省是 12 列等权 Grid；Schema 5.3 起，真实结构无法表达时可声明最多 12 条受控正整数权重轨，不开放 CSS、坐标或像素宽高([ADR-0054](../0054-section-weighted-column-tracks.md))。统一运行时不得按组件组合或子组件 `props.variant` 推断分区外观。同一视觉行内同类型、同 `props.variant` 且具备行对齐能力的组件由统一运行时自动对齐行轨高度,这是运行时不变量而非页面声明;对齐通过显式契约协作,统一运行时不出现组件内部选择器。新增 `container` 档位必须证明"结构上不可区分且视觉上必须不同"。

**指标卡前置连接文字（[ADR-0111](../0111-metric-card-before-connection-layout.md)）：** 6.34 在指标卡 `layout.before` 声明短连接文字和双侧间距档位，由统一运行时派生内部排布盒；整组占成员 span 之和，内部扣除文字和间距后按 span 比例分配。仅支持 Dashboard、plain/card、默认 12 列顶层指标卡。原相邻两卡都呈现才显示连接，不跨隐藏项重连。该能力只为连接关系放开受控 gap，修订 ADR-0038/0054 的全面拒绝；页面树、直接组件尺寸盒和无配置页面保持原有语义。

**响应式宽度所有权([ADR-0059](../0059-direct-component-box-responsive-ownership.md)):** `RuntimeView` 的 `mc-runtime` 只负责页面级与跨组件排布；`RuntimeSection` 顶层单元、组合卡 slot 与 Tab 活动面板以 `mc-component-box` 给直接 Page Component 提供可用 inline-size；组件内部只使用最近的直接布局盒或匿名 self container。旧 viewport 数值不得机械迁移为容器阈值，优先用流式 CSS；组件根填满直接盒，固有内容尺寸必须有收缩或内部 overflow owner。该边界不进入 Page Metadata，不新增响应字段或生产态断点注册表。

**组件能力目录的 `defaultSpan` 是相对比例,不是绝对宽度([ADR-0057](../0057-proportional-row-packing-and-page-header-in-assembly.md))。** 依据是人工搭的看板对它的用法:33 个分区里 14 个覆盖了 `defaultSpan`,但覆盖后的宽度几乎都保持了默认值之间的比例(指标卡 3 配柱状图 6 写成 4 + 8,三张指标卡各 3 写成 4 + 4 + 4)。创作期装配据此在**每个分区内**按比例贪心分行、每行缩放到恰好占满整行,因此视觉行的 span 之和恒等于分区列数;装箱不跨分区搬动组件,ADR-0055 的一组一分区不动。装箱是装配期的确定性纯函数(`packages/server/mcp/src/authoring/section-layout.ts`),模型不参与 span 决策——span 是纯几何,模型只会带来方差。分行判断只在比例空间里做,受控权重列轨只改变最终整数分配。手写页面继续显式声明 `span`,不受影响;目录没有「宽度上限」概念,装配因此会把独占分区的饼图与排行卡拉到通栏,该现象留待有真实产物证据后单独裁决。

**页面外框与分区内层次([ADR-0052](../0052-dashboard-layout-form-backdrop-and-safe-area.md)):** 顶层可选 `layoutForm` 封闭两档 `report`(缺省)/`dashboard`,是页面外框几何与画布外观的唯一真源,`dashboard` 要求宿主交出全部宽度(见 [`docs/host-contract.md`](../../host-contract.md));组件 `layout.layer: "backdrop"` 让组件铺满分区并置于同分区其余组件之下,其余组件仍走该分区当前列轨的自动流(缺省为 12 列),页面不写坐标、宽高或 z-index。三个声明各管一层:`layoutForm` 管页面外框、`container` 管分区外壳、`layer` 管分区内层次,唯一硬冲突是 `backdrop` 要求 `container: "plain"`。铺底组件的未遮挡矩形(**安全区**)由 `RuntimeSection` 计算并经 CSS 自定义属性下发,**明确不进页面 schema**——那会把布局结果写进页面元数据；该通道已经实现并覆盖加载、字体变化、窗口缩放与窄屏回流。`dashboard` + `panel` 与 `report` + `backdrop` 两个组合合法但没有设计过观感,决定不禁、以测试钉住现状。同一份 ADR 把聚合根改称**页面**,「看板」与「报表」降为布局形态。

**组件级分组容器([ADR-0053](../0053-composite-card-component-level-grouping-container.md)):** 新增组件类型 `compositeCard`(**组合卡**)——一张卡框住若干组件,自身不承载数据,子组件是五种的白名单(`metricCard`、`pieChart`、`gauge`、`keyValuePanel`、`categoryBreakdown`)、禁止递归、卡内复用同一条 12 列自动流,分隔线是容器上的一位布尔信息且位置由结构派生。同批附带一个叶子组件 `categoryBreakdown`(**分类明细**,按类别逐行、按度量逐列的紧凑明细)——按仓里先例新增叶子组件不单写 ADR,因此它登记在这份 ADR 的白名单里;它与并排饼图之间有一条硬约束:**颜色按类别取值决定,不按行序决定**,该约束不进页面文档,只能由测试钉住。它与 `section.container: "card"` 的判据是层次而不是功能:`container` 是**分区级**、卡与卡只能纵向堆叠;组合卡是**组件级**、进 12 列栅格、可以横向并排若干张。`container` 仍是分区外观的唯一真源,组合卡不改变也不推断分区外观,因此 ADR-0038 那条「新增 `container` 档位必须证明结构上不可区分且视觉上必须不同」不被触发。该 ADR **推翻了 ADR-0038 否决「`group` 层级」时的前提**——「当前没有需要独立 DOM 所有权的场景」已不成立——但只放开一层非递归的组件级容器,不引入 `rows`/`stack` 递归布局语言。按 ADR-0051 是纯增量,登记为 **5.2**;协议、widget 与统一运行时已经实现,概览页已迁移为三张并排组合卡。编辑器仍原子化处理组合卡,嵌套子组件创作明确延期。

`timeRange` 筛选器的 `default` 除既有天级预设与绝对区间外,新增**结构化相对时间**分支(粒度单位 + 区间描述 + 锚点,并显式承载是否包含当前未完成周期);它是声明式数据而不是表达式字符串,求值发生在服务端取数编排期且一次页面加载内共享同一求值时刻,0003 的"禁表达式与脚本"原样成立。页面另需一处可表达"本页面含 N 个临时指标"及其已被显式接受的声明(ADR-0036),使这一风险在后续查看与审计中始终可见。

**已生效的 5.1 增量:** [ADR-0047](../0047-first-class-page-parameters.md) 顶层新增可选的 `params`,文本属性取值从 `string` 放宽为「字面量或页面参数引用」;物化后领域类型仍是 `string`。[ADR-0048](../0048-navigation-intent-and-host-routing.md) 跨页下钻只上抛导航意图,路由与回跳属宿主。[ADR-0050](../0050-filter-type-closure-and-hierarchical-dimensions.md) 筛选器闭集从两类扩到六类并支持层级与级联,**ADR-0035 的结构化相对时间欠账已随 0050 偿还**。[ADR-0052](../0052-dashboard-layout-form-backdrop-and-safe-area.md) 新增顶层 `layoutForm` 与组件 `layout.layer`(见上一段)。[ADR-0049](../0049-table-server-side-and-presentation-capabilities.md) 表格的排序与列头筛选按数据源模式整体下推或整体本地化——它长期停在提议,卡的是"查询分页下拒绝 `sortable`/`filterable`"这条硬规则;[ADR-0086](../0086-server-side-sorting-and-header-filters-under-query-pagination.md) 已解除该互斥,**改由上游执行**:排序进生效查询的 `sort`(数组序即优先级,编码沿用中间层的 `@order(type, priority)`,该编码待真实环境复验),表头筛选落成维度谓词;两者都是**会话态而不进页面文档**(用户当下的看法不是页面的声明),变化时页码重置到第一页,字段没有 `queryField` 映射就整条跳过。全部为纯增量,存量页面不迁移。

ADR-0018 的局部显式在这批中被反复援引为边界依据,但守法方式是**限制间接的形态而不是限制它出现的位置**:单个页面参数引用保持整值替换、不允许模板表达式；6.23 按 [ADR-0109](../0109-explicit-text-value-composition.md) 可用一层 parts 显式组合字面量、参数与筛选引用,格式复用 ADR-0013 的既有闭集;计算产出字段必须就地声明在结果字段契约里;层级到谓词字段的映射写在查询里而不是网关配置里。按组件类型限制参数消费面的方案已被 ADR-0047 否决——那会让页面为了显示一个值而被迫引入某个组件。

来源:[ADR-0017](../0017-page-schema-v3-hard-cutover.md)、[ADR-0018](../0018-keep-page-metadata-locally-explicit.md)、[ADR-0013](../0013-format-belongs-to-component-field-binding.md)、[ADR-0021](../0021-page-id-is-not-a-rendering-switch.md)、[ADR-0026](../0026-controlled-nested-detail-fields.md)、[ADR-0028](../0028-controlled-semantic-html-detail-fields.md)、[ADR-0035](../0035-structured-relative-time-expressions.md)、[ADR-0036](../0036-metric-gap-non-blocking-exit.md)、[ADR-0038](../0038-section-container-and-row-alignment-invariant.md)、[ADR-0042](../0042-money-fields-and-semantic-embedded-values.md)、[ADR-0052](../0052-dashboard-layout-form-backdrop-and-safe-area.md)、[ADR-0053](../0053-composite-card-component-level-grouping-container.md)、[ADR-0054](../0054-section-weighted-column-tracks.md)、[ADR-0059](../0059-direct-component-box-responsive-ownership.md)。

**报告日期与内置导出（[ADR-0097](../0097-report-date-filter-and-instance-export-view.md)）：** reportHeader显式引用时间筛选器；6.28通过pdfExport启用内置下载。2026-10-16裁决移除withExportView及其公共DOM类型，不保留兼容入口，也移除用户取消按钮。每实例捕获查询作用域并展开正文，主线程分批准备静态画面，一次截图解析多块复用；Dedicated Worker裁切、无损编码并组装PDF，所有页成功后下载。连续A4零额外外边距，部分取数失败保留可用内容；下载成功不证明完整性。每结果10000行、准备60秒及内部更新/销毁清理保持。Worker代码随npm与HTML单文件分发，宿主允许worker-src blob:。6.30通过pngExport增加固定名称“导出图片”，3/4倍并且只保存一张完整PNG；内部块接入同一行流式编码，不提供多图/ZIP/其他格式回退。PDF与PNG在独立文档挂载正式静态视图，仅带入自有组件样式、受限主题与字体，原页面水印不变；主动跨文档注入仍须真实门户接线验收。

**显式筛选文本与期间格式（[ADR-0100](../0100-explicit-filter-text-values-and-period-format.md)）：** 6.15 文本取值可显式引用参数或当前已应用筛选状态；6.23 按 [ADR-0109](../0109-explicit-text-value-composition.md) 扩展为显式 parts 组合，所有既有文本位置共用，组件最终仍接收字符串。filterIds 只负责控件位置，不自动创建或覆盖 asOf；日期单点、范围统一使用 period 格式，不引入专用连接词或模板插值。运行时投影文字，导出捕获静态结果；6.13/6.14 保留旧页头派生兼容。

2026-10-19修订：6.31使用reportHeader.props.exportButtons数组统一PDF/PNG按钮，每项配置format、label、filename及scale。直接点击下载，取消格式菜单、清晰度弹窗和二次保存；旧字段只在读取接缝兼容。PDF支持2/3/4倍，PNG支持3/4倍，超限明确失败。见[ADR-0097最新修订](../0097-report-date-filter-and-instance-export-view.md)。

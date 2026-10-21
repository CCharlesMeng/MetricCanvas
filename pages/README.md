# 页面示例与验收场景

页面试验场为引擎使用者提供“查找能力 → 体验操作 → 查看配置 → 参考业务页面”的路径。首页保留业务示例／功能演示／验收样例及 Dashboard／Report 布局形态筛选，并新增能力主题、运行条件筛选；同一页面可属于多个能力主题；IOC 公共页头的多个场景集中为一个目录入口，其余页面各显示一个目录卡片。

每页顶部的“体验与配置说明”提供操作与预期、数据环境、启动方式、关键配置、完整 JSON 下载、适用边界和关联入口。配置片段从当前加载文档提取，不维护第二份运行声明。说明属于试验场外框，不进入引擎页面或导出结果。协议文档链接指向仓库 main，当前运行输入以下载的 JSON 为准。

新功能仍按[必选验收要求](../docs/agents/feature-acceptance.md)维护页面、协议文档和本地创作 Skill。JSON 是运行输入，测试直接读取同一文件。本次目录信息结构调整只改变开发工具导航与说明，不新增页面协议、运行时能力或本地创作流程；已有协议文档和 Skill 声明规则继续适用。

本轮信息结构改进的范围、浏览器结果与截图见[目录验收记录](../docs/evidence/page-catalog-information-structure/result.md)。

### 目录返回时恢复查找条件

- 启动 `pnpm dev:playground`，入口 `/`；无需 DQE，详情复用内联合成示例 `/pages/table-detail-overlay` 和 `/pages/table-toolbar-demo`。
- 在目录选择“表格与明细”、Dashboard、“无需额外服务”、“功能演示”，搜索“详情弹窗”。打开唯一结果，再点顶部“页面目录”：关键词、四项选择、匹配结果及滚动位置保持原样。也可从详情的相关示例继续跳转后返回目录。
- 切换为 Report，修改搜索为“Excel”并打开结果，连续使用浏览器后退／前进：各目录历史记录恢复各自的条件；刷新目录或详情后返回，条件仍保留。无匹配结果也保留；点击“重置筛选”后再往返，不恢复旧条件。
- 会话存储损坏或分类选项已删除时回退默认值；存储被禁用时保留当前应用内状态。范围仅为试验场目录，不改变页面协议、业务页面筛选、页面参数或本地创作 Skill。浏览器验收脚本：`node apps/playground/tests/catalog-navigation-browser.mjs`；可用 `PLAYGROUND_BASE_URL` 指定服务地址。

## IOC 公共页头统一入口

打开 Playground 的 `/ioc-header`；首页可选择“IOC 公共页头”能力和“功能演示”用途，或用 `/#group-ioc-header` 定位入口。首页收拢为一张卡片，原始 15 份页面 JSON 与 `/pages/<id>` 地址保持有效。

- `/ioc-header`：常用完整演示，期间、币种、区域可以直接操作。
- `/ioc-header?topic=time&scene=time-modes`：时间专题，含年季月、详情单月、离散月份、日/月/ISO周、快捷范围与可信最新期场景。
- `/ioc-header?topic=business&scene=business-options`：业务筛选专题，含单多选、勾选、区域树、级联与详情独立条件。
- `/ioc-header?topic=currency&scene=currency`：币种与金额专题，观察范围确认、币种切换及独立货币字段。
- `/ioc-header?topic=navigation&scene=navigation-source`：从概览选择条件，点击进入清单，再点击项目进入详情；修改详情不影响来源。
- `/ioc-header?view=capabilities`：查阅 32 项使用能力，按名称、说明或规划编号搜索，展开适用条件并进入对应演示。暂缓实施项单列，全部原 88 项编号可追溯。

本组当前 Playground 入口提供**内置合成查询、候选和期间事实**，只需 `pnpm dev:playground`；不需要 DQE Sim 或 Embed 示例服务。直接查看清单/详情时，统一入口会填写明确标识的演示参数。业务页面 JSON 和查询绑定不变，真实服务仍需集成应用注入相应能力。后文各批次中的 HTTP、Embed 和外部输入要求描述独立验收环境，不是本统一入口的启动前置。

操作后观察正文数据、期间说明和候选变化；日/月/周同步静态查询，不连续月份不扩成连续范围。切到业务树的 2026-06/05 可观察无权限/未配置门禁；时间事实固定为演示 latest=2026-10、latestComplete=2026-09。B5 仅传值、B6 挂起，真实 DQE/Relay/CloudIOC/门户未因此获得验收。

使用与验证记录见 [IOC 页头 Playground 优化验收](../docs/evidence/ioc-header-playground/acceptance.md)。此处只增加开发工具查看路径，不修改页面协议及 local-authoring 知识规则。

## 能力索引

### TinyVue OS 表格外观

- 页面：[table-tiny-os.json](table-tiny-os.json)，直接打开 [TinyVue OS 表格样式验收](http://localhost:5173/pages/table-tiny-os)。启动 `pnpm dev:playground`，无需 DQE。
- 普通、预测矩阵、内嵌三种表格显示灰色 40px 表头、短分隔线、SVG 排序图标与统一网格间距；`reportCompact` 保持原外观。点击金额列切换排序，搜索客户25、清空、翻页，展开数值下限与日期筛选后清除；导出沿用完整匹配结果范围。
- 窄屏在表格内部横滚，固定列随实际列宽定位；下方多级表头按实际层高定位。维度候选值端口未注入时显示不可用，不用假候选项冒充真实取值。
- 浏览器验证直接读取上述 JSON：`packages/embed/tests/browser/table-tiny-os.spec.ts`。冻结官方 CSS 与相同数据/宽度的局部像素比较只证明对应网格场景，不代表所有业务页面和全部交互状态均已像素一致；真实 DQE/Relay 未在本场景验收。

### 其他能力

| 能力 | 推荐主示例 | 扩展与业务应用 |
|---|---|---|
| 布局与内容组织 | [指标卡与文字混排](metric-card-equation.json)、[内容导航](ioc-content-navigation.json) | [IOC 地图概览](ioc-project-overview.json)、[分析简报](flow-analysis-report.json) |
| 筛选与状态联动 | [Report 时间联动](report-date-filter-example.json)、[Dashboard 期间选择](dashboard-period-filter.json) | [图表独立筛选](chart-local-filter-page.json)、[SDT 单月报告](business-sdt-report-monthly.json) |
| 表格与明细 | [多级表头、搜索和导出](table-toolbar-demo.json)、[详情弹窗与抽屉](table-detail-overlay.json) | [多查询组合表](multi-query-table.json)、[IOC 清单](ioc-opportunity-list.json) |
| 查询与数据处理 | [查询分页与级联](query-result-where-page.json)、[数值容错](query-numeric-tolerance.json) | [SDT 两条级联链](business-sdt-cascade-example.json)、[空数据呈现](empty-state-showcase.json) |
| 导航与页面参数 | [来源演示页](demo.json) → [销售明细](sales-detail.json) | [IOC 清单](ioc-opportunity-list.json) → [项目详情](ioc-project-detail.json)、[显式参数报告](flow-analysis-report-params.json) |
| 导出与分享 | [报告 PDF／PNG](report-png-export.json)、[表格 Excel](table-toolbar-demo.json) | [单张长图](report-png-long-export.json)、[无效倍率回退](report-export-scale-fallback.json)、[业务月报](sdt/commercial-sdt-efficiency-ultimate-monthly.json) |

## 数据与运行条件

数据性质与运行条件独立描述：“合成演示”不等于“无需额外服务”，“内嵌初始行可预览”不等于“动态交互已接通”。

| 运行条件 | 启动方式 | 体验范围 |
|---|---|---|
| 无需额外服务 | `pnpm dev:playground` | 内联页面可直接体验 |
| 本地 DQE Sim | 一起启动用 `pnpm dev:dqe`；已有试验场时仅运行 `pnpm sim:dqe` | 支持范围以各页说明及夹具为准；不匹配的查询显式失败 |
| 对应业务服务 | 启动试验场，接入匹配的数据网关、数据集与权限 | 内嵌初始行只证明首屏可展示，不能替代业务取数 |
| Platform 页面搭建 | `pnpm dev:platform`，在页面搭建工作台加载对应页面资产 | 试验场仅展示页面内容，拖拽、删除与撤销须在工作台操作 |

开发代理和灰度配置见[试验场说明](../apps/playground/README.md)。所有演示均与真实 DQE、Relay、身份、权限及部署验收分别举证。

## 布局与内容组织

### 本地创作的布局形态范式

本批增强本地创作流程，不新增运行时能力；复用以下已注册的完整页面作为范式源，避免另造同能力演示页。试验场可搜索“创作范式”。选择依据与业务边界由 Skill 的范式卡说明，结构摘要由导出器读取这些精确页面生成，不复制其业务数据、查询或地址。

| 布局形态／范式 | 实际页面与入口 | 核对重点 | 数据环境 |
|---|---|---|---|
| Dashboard 地图概览 | [ioc-project-overview](ioc-project-overview.json)，`/pages/ioc-project-overview` | backdrop 地图、权重轨、业务组合卡和 Tab 明细 | 合成页面；动态交互需对应网关 |
| Dashboard 主题分析 | [ioc-opportunity-analysis](ioc-opportunity-analysis.json)，`/pages/ioc-opportunity-analysis` | 四组主题指标和每个组织 Tab 内的多表 | 合成数据；筛选下推需对应查询服务 |
| Dashboard 筛选清单 | [ioc-opportunity-list](ioc-opportunity-list.json)，`/pages/ioc-opportunity-list` | 页面筛选与全宽主表，完整列和表格操作 | 合成页面；查询分页依赖网关 |
| Dashboard 对象详情 | [ioc-project-detail](ioc-project-detail.json)，`/pages/ioc-project-detail` | hidden 工具栏、自有 reportHeader、概况／规范、预测／叙述 | 合成页面；对象参数与查询需项目提供 |
| Report 经营月报 | [business-sdt-report-monthly](business-sdt-report-monthly.json)，`/pages/business-sdt-report-monthly` | 报告期间、总览／趋势、分层明细章节 | 业务查询；完整取数需真实 DQE，不由仿真保证 |
| Report 分析简报 | [flow-analysis-report](flow-analysis-report.json)，`/pages/flow-analysis-report` | 指标／趋势／风险及客户、赛道、产业的阅读顺序 | 页面初始行供预览，真实查询另验 |

自动验收直接读取上表页面，核对提炼后的布局、权重轨与完整嵌套组件树，并在仓外复制安装 Skill 检查链接和知识哈希。原页面的 `reportHeader`、Tab、多筛选保留，特别验证“详情页含 reportHeader 仍为 Dashboard”。创作行为复测分别覆盖未确认时只提问、明确指定 Dashboard 后显式写 layout、确认后沿分支范式生成；确认状态属于会话，不写入页面 JSON。

结构摘要及静态检查不能证明识别模型的准确率、视觉还原、筛选真实取数或生产交付；本批证据见[验收记录](../docs/evidence/local-authoring-layout-form/result.md)。

### 指标卡与文字混排、内容导航

- [metric-card-equation](metric-card-equation.json)，入口 `/pages/metric-card-equation`：内联合成数据，无需额外服务。观察等号、加号与指标卡的同行排列，再查看文字和组件的 `layout.span`；符号只表达展示关系，不声明计算公式。
- [ioc-content-navigation](ioc-content-navigation.json)，入口 `/pages/ioc-content-navigation`：内联合成数据，无需额外服务。在分区 A 翻页，切到 B 再返回 A，检查局部状态保留。它是匿名导航样例，不是 IOC 来源页面。

### Platform 搭建画布体验

- 页面：[platform-canvas-experience.json](platform-canvas-experience.json)，页面试验场「验收样例 → 画布交互验收（静态演示）」。全部为静态演示文字，无 DQE、Relay 或真实业务数据依赖。
- 操作入口：在 Platform 页面搭建工作台打开该页面；浏览器自动验收直接读取此文件，使用受控页面资产与保存端口运行 `node apps/platform/tests/workbench/canvas-experience-browser.mjs`。试验场仅展示页面，搭建操作须在 Platform 验收。
- 悬停或键盘聚焦组件后，右上角显示拖动手柄；选中后显示蓝色微渐变细框，组件旁的就地操作条提供上移、下移与删除。拖动手柄可同分区重排或跨分区移动；整行组件按上/下半区判断前后，同行组件按左/右半区判断。靠近滚动区边缘继续拖动可滚屏；结束或取消后清除落点。
- 组件配置提供常用宽度、逐轨调节及展示属性，不再重复摘要卡或移动/删除按钮；页面设置独立呈现日期筛选配置。操作条跟随选择、尺寸和滚动，目标完全滚出视野后隐藏。选中组件按 Delete 可删除，输入框中的 Delete 不触发删除。
- 删除或移动一个分区的最后组件时，该分区在搭建草稿中保留并可继续接收拖入，正式页面投影移除空分区。页面须至少保留一个组件；删除最后一个组件会显示原因且保留原文档。删除不回收共享页面数据源。
- 修改与删除可用顶部「撤销上一步」恢复；点击「保存草稿」才提交。本地浏览器测试证明交互、文档投影与受控保存回读，不能替代真实 Java 资产服务或部署验收。
## 表格与明细

### 三层表头

- 页面：[table-toolbar-demo.json](table-toolbar-demo.json)，入口：[三层表头示例](http://localhost:5173/pages/table-toolbar-demo)。目录中可搜索“三层表头”。
- 数据：6 个区域的 `inline` 静态演示数据，无需 DQE；沿用原页 Report 布局及下方客户搜索、导出场景。
- 初次打开：顶部表格显示三行表头，“经营指标 → 收入／利润 → 目标／实际”；区域跨三行，客户数跨两行，经营指标跨五列，收入和利润各跨两列。
- 点击收入的“实际”列排序：升序首行为西北（420），降序首行为华东（1,320）；数据保持 6 行，表头结构保持三层。
- 证据边界：验证既有递归列组能力的页面声明、静态校验与本地浏览器呈现，不代表真实业务数据或 DQE 验收。

### 表格点击与详情弹窗

- 页面：[table-detail-overlay.json](table-detail-overlay.json)，试验场「功能演示」，直接打开 [表格点击与详情弹窗](http://localhost:5173/pages/table-detail-overlay)。
- 数据：2026年9月的内联合成数据，无需 DQE。主表汇总8笔订单、3笔待交付、0笔异常，金额合计861,000元；三个列入口分别引用预先准备的完整快照。
- 点击「订单数（弹窗）」的8：居中显示全部订单表格，每页5笔；支持搜索、原始金额排序与Excel导出。点击「待交付（抽屉）」的3：右侧只显示3笔待交付订单。点击「异常订单（空结果）」的0：打开空表格。关闭按钮、Esc与背板可关闭浮层，URL保持不变。
- 此页仅复用现有 `openDetail.view` 和 `detailViews.mode: snapshot`，不新增协议或运行时能力。它不证明按任意点击行动态过滤、query详情传参或真实DQE取数；查询取消与迟到响应由既有详情视图测试覆盖。

### 多查询表格

- 页面：[multi-query-table.json](multi-query-table.json)，试验场「验收样例 → 多查询表格验收（仿真）」。
- 启动：在仓库根运行 `pnpm dev:dqe`，打开 [多查询表格](http://localhost:5173/pages/multi-query-table)。该命令同时启动 DQE Sim 与页面试验场；保持统计月份为 2026-09。
- 数据：8 个代表处的合成数据，仅支持本地 DQE Sim；页面无真实业务查询或能力证明。顶部月份改变到其他期间会显式失败。

页面同时提供两张独立组合表，共用普通查询定义。场景一的「序号」由 `ordinalField` 在当前排序/筛选后编号；场景二的「预签金额排名」来自普通查询字段 `bidding_rank`，在完整统计月份行域按预签金额降序计算，再按代表处编码投影。场景二的表格排序、筛选和搜索保留原名次；同额按编码升序打破并列。本组合源不计算固定业务排名，真实接入需上游返回已验真的排名字段。

以下操作先在场景一执行：

| 操作 | 预期结果 |
|---|---|
| 初次打开 | 预签金额降序第一页：上海、北京、广州；总数8，页大小3 |
| 点击召开率表头两次，切到降序 | 第一页上海、深圳、北京；独立图仍为8类，下方独立完整表仍为8行 |
| 下一页 | 杭州、成都、广州；序号4、5、6 |
| 召开率降序时，金额下限输入150000000并提交 | 回到第一页，匹配上海、北京、广州，总数3；金额按元比较 |
| 再加召开率下限85 | 跨源条件 AND 后仅上海，总数1；百分数使用原始刻度85 |
| 清空数值条件，搜索「天津」并提交 | 在完整行域匹配天津，共1行；独立图与完整表保持8行 |
| 清空搜索后导出 | Excel 含全部8条数据；有过滤时只导出全部匹配行；未提交或非法草稿不进入导出 |

然后在场景二执行以下操作，场景一的已提交视图保持独立：

| 操作 | 预期结果 |
|---|---|
| 初次打开 | 上海、北京、广州，预签金额排名1、2、3 |
| 召开率切到降序 | 上海、深圳、北京，预签金额排名1、4、2 |
| 下一页 | 杭州、成都、广州，预签金额排名5、6、3 |
| 召开率下限85 | 回到第一页，仅上海、深圳，预签金额排名1、4；不会重新编号为1、2 |
| 上述条件下导出 | 两条匹配数据的预签金额排名仍为1、4 |
| 清除条件，搜索天津 | 唯一结果的预签金额排名仍为8；场景一序号表在相同搜索下为1 |

协议见[数据源](../docs/page-metadata/data-sources.md#多查询组合源-pagedjoin622)、[表格](../docs/page-metadata/components/table.md#数值范围和组合表622)。自动证据为 `packages/embed/tests/browser/paged-join.spec.ts` 与 `tools/dqe-sim/tests/multi-query-table.test.ts`，直接读取本页面；其他错误、取消与范围边界由共享执行测试覆盖。既有实施证据见[验收报告](../docs/evidence/multi-query-table/result.md)，真实接入仍按报告单独验收。

## 筛选与状态联动

### 时间选择统一入口

时间选择控件统一默认禁止未来时间；表头日期范围在 [IOC 机会点清单](ioc-opportunity-list.json) 的“机会点创建时间／进展更新时间”列验证。

时间选择集中在两个页面，均位于页面试验场「功能演示」，可按“时间选择”搜索；不再为测试变体新增独立演示卡片。

| 页面 | 入口 | 覆盖能力 |
|---|---|---|
| [Report 时间选择与联动](report-date-filter-example.json) | `/pages/report-date-filter-example` | 单月、月份范围、标题及正文联动、清空、参数初值、禁止未来月份及日期 |
| [Dashboard 期间选择与查询](dashboard-period-filter.json) | `/pages/dashboard-period-filter` | 统一页头中的单年份筛选，以及完整自然年查询与未绑定查询对照 |

Report 页面按三节组织，控件相互独立：

1. “单月与范围文字联动”：报告月份初始为2026-09，改为2026-10后标题和正文同步变化；未提交草稿与无效输入不改变已应用标题。清除后显示“全部期间 经营分析报告”。对照期间支持范围及同月折叠，本节不改变明细查询。
2. “范围筛选与查询联动”：报告期间由页面参数初始化为2026-01至2026-06，修改后当前期间与月度明细同步变化。这一节使用本地 DQE 仿真；运行 `pnpm dev:dqe` 后操作，不代表真实业务数据。
3. “月份与日期禁止未来时间”：所有控件默认限制未来时间，不需逐个启用。受限月份／日期另展示2020-06下限；日期范围不能结束于明天，精确时间范围不能超过当前分钟。面板、输入、URL 和外部状态写入均受限，非法值保留已应用状态，不触发查询；跨月后新月份可选。

原 `report-title-filter-example`、`time-point-no-future` 的演示能力已并入 Report 页面；旧独立页面入口撤下。浏览器回归直接消费聚合页，协议专用夹具仍保留。

### Dashboard 期间筛选

- 统一入口 `dashboard-period-filter` 使用 iocHeader 与日期精度，只有一个年份框：sales 绑定完整自然年，fixed 不绑定。
- 月份精度、进入“更多筛选”、compact 只读三种变体仅保留于 `packages/page/fixtures/contract-valid/dashboard-period-filter-{month,more,readonly}.json`，不在演示目录重复展示。浏览器直接加载完整夹具，不临时拼装配置；安装包兼容性验收同步携带这些夹具。
- 人工配置入口：运行 `pnpm --filter platform exec vite --config tests/browser/report-date.vite.config.ts` 后，打开 `http://127.0.0.1:5187/tests/browser/report-date-editor.html?dashboard`；复用正式属性面板，使用本地合成数据。
- 数据环境：浏览器自动验收通过合成网关响应回显实际请求起止范围；人工使用时需要 DQE 网关提供匹配字段，页面本身不包含已验证真实业务数据。
- 操作：在统一页头选择年份；检查当前年可选、未来年不可选；改变 URL 年份并缩窄容器。完整年／季／月／近一年切换由期间契约夹具回归。
- 预期：一次选择只更新一个筛选状态，sales 查询完整自然年而 fixed 不重取。不允许的模式或未来年份 URL 保留合法默认年；协议／日历／状态与请求断言见对应 period-filter 测试。
- 证据边界：浏览器测试为合成数据，真实 DQE／Relay／Java 及部署未由此证明。

### Dashboard 图表独立筛选

- 页面：[chart-local-filter-page.json](chart-local-filter-page.json)，页面试验场「验收样例」，入口 `/pages/chart-local-filter-page`。启动 `pnpm dev:dqe`，数据由本地 DQE Sim 提供，为固定合成数据。
- 四张图左上角分别显示圆角单选按钮组，选中项黑底白字：订单默认中国区、收入默认海外、渠道默认亚太、地图默认中国区。每个选项的显示名称与查询值可在页面创作时配置，例如“中国区”对应 CN、“海外”对应 OVERSEAS。
- 将订单切到海外：只重新查询订单，图中从国内一组/二组变为海外一组/二组；其他三个筛选和全区域对照图保持原值。收入与地图也能独立切换。
- 渠道切到“欧洲（空结果）”：图表为空，但标题和筛选仍可操作；切回亚太恢复两组数据。查询失败同样保留筛选。
- URL 带独立筛选值，重开保留选择；未知值或多值 URL 回退各图默认项。静态导出保留捕获时的选项名称与数据，去掉按钮交互。宽/窄屏中控件均在图表左上角，不进入公共工具栏。
- 自动验收：`packages/embed/tests/browser/chart-local-filter.spec.ts` 直接加载本页面，通过真实浏览器与网关检查请求范围、候选值请求缺席、URL和空结果。静态导出投影由引擎内部测试覆盖。协议反例覆盖共享源、跨查询依赖、非法初值及版本下限。
- 协议：[图表独立筛选](../docs/page-metadata/filters.md#图表独立筛选629)。这些本地证据不代表真实 DQE/Relay、DS 模型或部署验收。

### 商务 SDT 报告与单月筛选

- 原页面：[business-sdt-report.json](business-sdt-report.json)，入口 `/pages/business-sdt-report`，保留人工维护的固定2026年10月报告。
- 新页面：[business-sdt-report-monthly.json](business-sdt-report-monthly.json)，入口 [商务SDT报告（单月筛选）](http://localhost:5173/pages/business-sdt-report-monthly)，目录「经营分析」。从当前原页复制，保留全部图表、表格和业务查询口径。
- 在报告顶部「报告月份」提交2026-09，报告主标题和「统计月份」同步变化；15个查询声明均绑定月份；实际呈现的14个查询联动，其中11个取所选月，3个趋势取含所选月的近6个月。2026-09对应2026-04～2026-09，2020-06对应2020-01～2020-06。
- 月份必选，最早2020-06，无上限。日历禁用2020年1—5月和更早年份；手工提交2020-05或非法月份时显示错误，标题、已应用月份与查询保持不变。URL `?report-month=2020-06` 可初始化，越界URL回退合法默认月2026-10。
- 原页另有未被组件消费的 `rep-office-efficiency` 查询声明，新页保留并配置月份绑定，运行时按既有规则不主动执行。
- 报告摘要保留原页内容并明确标记为「2026年10月固定摘要（不随月份筛选更新）」，本次不提供动态数值或排名摘要。
- 协议页面：[time-point-min-page.json](../packages/page/fixtures/contract-valid/time-point-min-page.json)，覆盖 month/date 两种下限。协议见[时间点下限](../docs/page-metadata/filters.md#时间点下限624)。
- 自动验收读取新页面：`packages/embed/tests/browser/business-sdt-monthly.spec.ts` 检查14个呈现查询窗口、文字联动、选择器禁用、越界草稿、URL与空结果。测试使用明确的合成传输回放，只证明交互与绑定，不能证明真实业务数据。
- 运行 `pnpm dev:dqe` 可预览；本地DQE Sim未覆盖此人工更新报告的完整15个查询，直接预览可能显示查询失败。真实DQE、Relay、线上部署不属于本地验收结论。

### 业务月份限制

[商务SDT终极版](sdt/commercial-sdt-efficiency-ultimate-monthly.json)保留为独立业务报告，默认2026-10并禁止未来月份，报告期间和全部查询继续跟随月份；主标题保持“商务SDT行权效率专项报告”。业务页需要真实 DQE，本地选择器验收不证明业务取数成功。通用月份／日期限制请使用上方 Report 时间选择入口。

## 查询与数据处理

### 查询数值容错

- 页面：[query-numeric-tolerance.json](query-numeric-tolerance.json)，试验场「验收样例」，或直接打开 [数值容错](http://localhost:5173/pages/query-numeric-tolerance)。
- 数据：八行固定合成数据，含正常数值、占位符、null、数字字符串、真实零、负数、布尔和空串；首屏使用 initial，本地动态查询由 DQE Sim 提供相同原始值。
- 操作：启动 `pnpm dev:dqe` 后打开页面；表格应保留八行，数值依次为 10.0、—、—、12.5、0.0、-4.0、—、—，完成率按相同缺失规则计算。折线保留 10、12.5、0、-4 四个有效点及其间缺口。排序后八行仍保留。两张指标卡分别显示缺失占位符和真实的 0%，缺失值进度环不能显示 0%。
- 动态链路：自动行为测试直接读取此页面，通过真实网关和 Sim 执行函数验证无 initial 的动态结果、告警计数、计算、保存与重开；内嵌首屏不请求 DQE。
- 边界：字段缺失、维度类型、行/明细结构仍拒绝；number 与 money 的查询度量缺失即使 nullable=false 也继续显示。inline 仍严格。
- 协议：[结果字段契约](../docs/page-metadata/fields.md#查询数值度量的容错)。静态/行为和本地浏览器证据不代表真实 DQE、Relay、DS 模型或部署验收。

此页面同时用于查询错误与结果总数回归：`packages/embed/tests/browser/result-diagnostics.spec.ts` 直接读取页面，在 DQE HTTP 边界注入异常。字段缺失或维度类型错误时，表格、指标卡和折线图呈现空数据，错误只打印到控制台；总数小于或大于实际八行时，八行继续显示并打印 `TOTAL_COUNT_MISMATCH`，不修改上游总数。协议见[查询异常与结果总数](../docs/page-metadata/data-sources.md#查询异常与结果总数)。

### 商务SDT级联查询保留场景

[business-sdt-cascade-example.json](business-sdt-cascade-example.json)，试验场「验收样例」。它保存原有Top5项目→阶段明细的完整配置，替代人工业务报告作为自动级联与展示格式的回归输入。运行本地DQE Sim后，9/10月HTTP验收检查两条独立链使用各自商务编号，并验证导出与屏幕结果一致；不证明真实业务数据。

### 查询分页、排序与级联

[query-result-where-page](query-result-where-page.json)，入口 `/pages/query-result-where-page`，使用本地 DQE Sim。改变主表任意列排序后回到第一页，翻页后两张下游评估表随当前窗口项目更新；大额与小额条件各自过滤输入。下游读取当前查询窗口，不是全部 80 个项目。配置解读见[查询定义与绑定](../docs/page-metadata/queries-and-bindings.md)。

## 导航与页面参数

先从来源页进入目标页，再比较 URL、筛选条件与对象标识；单独打开目标页只使用其默认参数，不能展示完整上下文传递。

- `/pages/demo` → `/pages/sales-detail`：本地 DQE Sim 支持区域、渠道与销售明细场景。
- `/pages/ioc-opportunity-list` → `/pages/ioc-project-detail`：查询源带合成内嵌初始行，动态交互需对应网关；真实业务接入另验。
- `/pages/flow-analysis-report-params`：查看打开时固定的代表处和报告月份，以及各查询显式声明的时间窗口。初始行供预览，实际查询需要对应业务服务。

## 导出与分享

推荐先体验 `/pages/report-png-export` 的统一导出按钮，再按需查看 PDF 单独配置、长图与无效倍率场景。业务应用使用 SDT 月报，业务数据仍需对应服务。Excel 导出使用上方表格主示例。

### Report 内置 PDF 下载

[report-pdf-export.json](report-pdf-export.json)（页面 id：`report-pdf-export`，页面试验场 `/pages/report-pdf-export`）使用纯 inline 合成数据，无外部网关。顶部更改月份后点击“下载经营报告”，预期下载包含全部45行的多页PDF，文件名和正文期间使用点击时已应用的月份；日期与下载工具带不进入PDF。第二个页头不配置日期，`pdfExport: {}` 显示默认“下载 PDF”；最后一个页头未配置导出，不显示按钮。点击任意按钮均下载整页，文件名取触发按钮所在页头的配置或标题。

生成失败、实例更新/销毁、并发和宽内容由对应行为回归覆盖；高于一页的块按原布局连续切片。图片和PDF编码在Worker，DOM按时间预算分批处理；无取消入口，旧withExportView已移除。浏览器需要Worker/ImageBitmap/OffscreenCanvas及允许Blob Worker的CSP。合成数据验收不代表真实DQE、内网浏览器或部署已验证。
按钮使用白底描边，准备／生成状态在按钮内显示，成功后恢复配置名称；失败可重试，悬停可看原因。自动回归检查 Worker、实际文件和临时资源清理。

### Report 导出图片

- `report-png-export`：本地合成12行，包含日期、图表、表格、2倍PDF+3倍图片、4倍PDF+4倍图片及未启用对照。Playground `/pages/report-png-export`；页头直接显示“导出 PDF”和“导出图片”，点击按元数据倍率下载；无格式/清晰度弹窗或二次保存。文件名与标题使用点击时的月份。
- `report-png-long-export`：本地合成140行；`/pages/report-png-long-export`。3倍导出跨多个内部截图块，最终仍只有一张完整长PNG。不能按当前表格10行分页截取；无ZIP或其他格式。
- HTML单文件接入：`packages/embed/examples/report-image-download.html`消费同一作者页面，`?page=report-png-long-export`切换长图。水印由浏览器测试在父文档注入，业务页面不声明水印。合成场景不证明实际门户、真实DQE/Relay、生产部署或终端扩展隔离。

- `report-export-scale-fallback`：本地合成数据，PDF配置99、PNG配置2、旧PNG配置字符串“4”；页面正常打开，按钮直接下载，分别采用默认2/3/3倍。入口 `/pages/report-export-scale-fallback`。图表和输出像素尺寸由浏览器测试验证，不代表真实门户/DQE验收。

## 开发环境

### Windows gray 开发环境

这是页面试验场与平台的开发服务器配置，不新增页面能力或协议字段，页面文档与本地创作 Skill 沿用当前版本。配置与 hosts/HTTPS 步骤见[试验场说明](../apps/playground/README.md#windows-本地连接-gray-cloudioc)与[平台说明](../apps/platform/README.md)。

- 复用已在目录注册的完整业务页面 [business-sdt-report-monthly.json](business-sdt-report-monthly.json)，入口 `https://local.cloudioc.huawei.com/pages/business-sdt-report-monthly`；它包含业务查询，不承诺 gray 环境具备对应数据集和权限。
- Windows 填入有效 cftk 并打开开关后，运行 `pnpm dev:playground`，加载页面并提交报告月份。动态查询经本地 DQE 路径代理到 gray 的同路径；浏览器和上游请求均带配置中的 cftk，可在 Network 的 Request Headers 查看。请求体及页面绑定沿用原规则；静态构建不注入 cftk。仅该开发代理设置 `secure: false`。
- Windows 启用但 cftk 为空或包含无效换行时启动失败；关闭开关恢复原有仿真代理。macOS/Linux 即使打开开关也保持 HTTP 5173 和仿真代理。灰度服务的查询拒绝或鉴权失败沿现有错误处理呈现，不回退到仿真数据。
- 可选 `PLAYGROUND_CLOUDIOC_COOKIE` 将完整 Cookie 请求头由 Vite 代理发往 gray；留空保留浏览器 Cookie，配置后覆盖整个上游 Cookie 头。Cookie 不注入浏览器，更新后须重启；非法 HTTP 头字符导致启动失败且错误不回显凭据。
- 平台使用 `PLATFORM_CLOUDIOC`、`PLATFORM_CLOUDIOC_CFTK`、`PLATFORM_CLOUDIOC_COOKIE`，在同一域名与 443 下将完整服务前缀（含页面资产与 DQE）转发至 gray；从 `/manage` 进入目录与页面搭建工作台，观察请求与错误状态。平台关闭开关恢复 IOC 代理。两端 gray 模式须择一启动，AI 总结仍使用本地 Sim。
- 配置边界由 `tests/dev-server-contract.test.ts` 覆盖，`tests/dev-server-proxy.test.ts` 用本地上游替身验证两端 CFTK、Cookie 覆盖/透传与路径/参数/请求体保持。替身与浏览器证据不能证明真实 Windows/gray 的证书、鉴权或业务取数成功。
- 浏览器回归：仓根运行 `node --import tsx tests/dev-server-proxy-browser.mjs`。真实 Chrome 打开上述月报与平台 `/manage`，消费本地合成服务响应，验证上游 CFTK/Cookie 与 401 原样返回。脚本在 macOS 上求值 Windows 配置后将监听改成回环 HTTP 随机端口，不验证真实 Windows/443/HTTPS；截图和机器报告写入 `.scratch/cloudioc-proxy/evidence/`。

## 图表高级呈现扩展（6.32）

入口：[chart-echarts-option-page.json](chart-echarts-option-page.json)，页面 id 与文件名一致，Playground 注册于验证分组。全部为 inline 演示数据，无外部查询依赖。

查看柱图声明序/stackOrder 的颜色对应、折线平滑与标签模板、饼图半径数组；调整容器宽度并下载 PDF/PNG。移除 echartsOption 后应恢复普通属性效果。缺失行不绘成零，真实零保留。页面不出现诊断文案；错误、单次回退和导出终止由浏览器故障注入用例验证，详情仅 console；保护路径拒绝由契约向量验证。静态/浏览器证据不等于真实 DQE 或真实模型验收。

## URL 初始化 Tab 与跨页链接

- 入口 `/pages/tab-url-source`（[来源页](tab-url-source.json)）及 `/pages/tab-url-initialization`（[目标页](tab-url-initialization.json)）。使用内联合成数据，无需 DQE 服务。
- 来源页点击“固定打开明细与已关闭工单”，目标两个独立容器分别选中“销售明细”和“已关闭工单”；URL 保留 `#tabs` 锚点，引擎不额外负责定位滚动。
- 点击“页面参数打开明细”或表格中的当前行链接，核对 `sales-tab` 来自来源页参数或行字段，目标选中对应页签。参数绑定不自动携带其他来源页输入。
- 直接打开目标页时，销售容器选中已声明默认“销售概览”（不是第一项），工单容器选中第一项“未关闭工单”。来源页的无效、空值、重复值链接均回退同样的默认页签。
- 打开 `?sales-tab=detail&support-tab=closed` 后手动切换销售页签，工单保持原选择，地址不变化；刷新后重新应用 URL 初值。未声明的 `?tab=detail` 不影响容器。
- 页面协议、参数命名互斥、初始化及导出边界见 [Tab 容器](../docs/page-metadata/components/tabContainer.md#url-初始化页签633)。自动浏览器验收直接消费以上两页；本地导航和内联渲染成功不代表真实门户、DQE、Relay 或模型验收。

## 统一条件显隐（6.35）

使用 `pnpm --filter playground dev --port 5185` 启动；以下页面均为 inline 本地演示，不需要 DQE。自动验收直接消费这三份页面：`node apps/playground/tests/page-visibility-browser.mjs /tmp/visibility-browser`；使用其他端口时设置 `VISIBILITY_BASE_URL`。

- `/pages/page-visibility-region-linkage`：切换“地区部”，地区部行权规范分区消失；“保留父容器”仍保留标题和空容器；局部文字、Tab 与表格行一起变化。切回全球，内容恢复；Tab 保持仍有效的当前项。URL 可只携带 `?organization.level=department`，刷新仍保留层级。“显示扩展内容／恢复基础内容”由独立按钮写入同一个筛选状态。
- `/pages/page-visibility-inputs`：Sim 控制在页面文档之外，初始等待时只展示独立内容；允许、拒绝、等待、错误即时改变依赖内容。“更换权限会话”使旧实例失效，需点击“重新初始化页面”；导出期间更换权限会话应取消下载。JS/平台接入通过 `displayInputs` 提供已有权限结果和有限具名事实。
- `/pages/page-visibility-report`：在地区部层级下载 PDF、PNG、表格 XLSX，核对地区部分区未导出、允许的空父容器保留、所有允许 Tab 展开、条件表格只保留两行代表处记录。导出捕获后普通筛选变化不改变本次内容。

规则非法来源、未知层级、类型错误、深度超限、重复片段 id 和缺少稳定行键由共享 conformance 向量验证；异步候选隔离、迟到响应和筛选级联由行为测试验证。宽窄屏、页面导出和公共 JS 输入由上述 Chrome 脚本验证。本地 Sim、inline 以及模型受控 HTTP 替身不代表真实 CloudIOC、Java、DQE 或 Relay 验收。

## 指标卡前置连接文字

入口：`/pages/metric-card-equation`（`pages/metric-card-equation.json`），`pnpm dev:playground` 后在页面目录选择“指标卡与文字混排｜收入构成”。无需 URL 参数、数据网关或 DQE，使用静态演示数据。

观察四张 span 3 指标卡在默认 12 列中等宽同行，`=`、`+` 和“其中”按内容占宽，两侧各为 8 CSS px；缩小集成应用容器时转为单列，文字在两卡之间且纵向双侧仍为 8px。宽度不足的部分跨列组合同样不能撑出页面。页面搭建中编辑前置文字和间距，保存重开仍保留；移动/删除打断相邻关系后只清理失效前缀，撤销一起恢复。

协议边界由 metric-before 契约向量及单元测试覆盖：Report、自定义列轨、嵌套、backdrop、connectPrevious、非法间距及连接跨度超过 12 均被拒绝。连接是展示关系，不执行收入计算；本页不证明真实 DQE、权限隐藏或生产部署。

## IOC公共页头 B0+B1（6.36）

| 入口 | 操作与预期 |
| --- | --- |
| `/pages/ioc-header-overview-demo` | 月→季→年→月仍保留原月份；近一年排除当前月；统计期间和服务条件回显一起变化，无关表查询不刷新。区域只出现一次。 |
| `/pages/ioc-header-dense-filter-demo` | 展开/收起不发查询；缩窄容器首行实测折叠，隐藏项不可聚焦。区域→地区部→代表处选值后改区域，递归清空后代并门禁；用户显式选择/清空后再执行。 |
| `/pages/ioc-header-detail-demo` | Report外框；身份来自参数，可选标签/刷新时间缺值不显示；单月独立修改不反写输入参数。直接打开无返回；集成应用给合法returnContext+back才显示。 |
| `/pages/ioc-header-month-set-demo` | 无身份行；选2026-01和2026-03，条件回显只含两个值，不包含2月。仅复用既有dimension；B2动态月份窗口未实施。 |

数据环境：以上是**本地DQE仿真合成验收**。服务回显实际声明绑定收到的时间/维度谓词，响应标识固定为1，并非业务指标。可用DQE Sim或嵌入测试内容服务交互；候选失败/迟到/多实例由配套行为测试补充。源码/安装校验、浏览器HTTP往返与真实DQE/CloudIOC/Relay分别报告，合成成功不代表真实服务验收。现有IOC四页没有迁移，可选动作未默认启用。

### IOC公共页头B2业务筛选（本地合成）

- `ioc-header-business-options-demo`：单选替换且停用档位不可选；突破枚举全选保留URL而省动态谓词；勾选/明确false分别回显1/0。
- `ioc-header-business-tree-demo`：显式结构树切层不混值，旧斜杠树仍批量选叶子；2026-08候选仅B、07仅C形成空交集待明确清空、06拒绝、05未配置、04空候选。相关查询及导出等待，无关源继续。
- `ioc-header-business-detail-demo`：详情独立单月与详情枚举，不改变概览或参数。

独立内容服务使用 `MC_EMBED_EXAMPLE_PORT=4198 node packages/embed/tests/serve.mjs`；三个页面的导航宿主注入合成V2 Adapter。Playground没有V2 Adapter时显示不可用是预期边界。不要把合成回显标识1当业务指标，真实服务/模型验收未执行。

- `ioc-header-currency-demo`：B3 Dashboard金额验收页。合成HTTP端口提供独立CNY/USD静态字段，sumFields分别计算同币种含费用金额；切币种与清范围一次提交，明确选择范围后重查。输入/预设按万元/万美元，URL及查询使用基本单位；取消不写入，负数/相等双边拒绝。表格/图表/指标卡同步选择字段，XLSX冻结对应货币。直接打开`http://127.0.0.1:4200/pages/ioc-header-currency-demo`，或页面试验场注入同一仿真数据网关；真实USD、DQE/CloudIOC/Relay/DS/门户与部署未验收。

## IOC B4：复杂时间与候选（本地合成）

- `ioc-header-time-modes-demo`：日/月/ISO周切换、模式URL、查询回显与XLSX；不是生产周聚合证明。
- `ioc-header-time-presets-demo`：含今日近7天、上个完整月、显式锚点，禁选区间内预设拒绝。
- `ioc-header-availability-demo`：可信latest=2026-10、complete=2026-09；默认完成期，合法URL优先；缺数7月禁选。测试宿主可切事实状态/身份，观察相关查询门禁及无关源继续。6.39组合场景使用同一displayInputs提供标量展示事实和periods；切换“隐藏/显示期间说明”只改变文字可见性，不增加查询，权限修订变化停止整个旧实例。
- `ioc-header-calendar-window-demo`：V2十二个日历月候选、1/3月离散集合和时间模型交集。

完整交互宿主：`MC_EMBED_EXAMPLE_PORT=4204 node packages/embed/tests/serve.mjs`，先构建embed，然后打开 `/pages/<id>`。后两页由测试宿主的 `examples/ioc-time-inputs.mjs` 注入稳定可信输入；候选服务为本地 `/__fixtures/filter-candidates`。Playground目录也注册这些页，集成应用若没有注入displayInputs/V2则明确显示不可用。数据环境是同源合成HTTP，真实DQE/CloudIOC/Relay/DS/门户及生产数据未验收。

## IOC B5：显式跨页传值

本地合成验收，三个实际页面可从Playground“验收样例”目录发现：

- `/pages/ioc-header-navigation-source-demo`：选择期间/币种/多值区域，点“携带已应用条件进入清单”。
- `/pages/ioc-header-navigation-list-demo?origin=直接入口`：来源标签和条件来自显式映射；选单月后点“示例项目甲”。季度或近一年不得截成详情单月；缺编码行拒绝并显示原因。
- `/pages/ioc-header-navigation-detail-demo?project-id=P001&project-name=示例项目&origin=直接入口&month=2026-09&currency=RMB&regions=north`：页头显示项目参数，合成HTTP回显项目/月/币种/区域谓词；修改详情筛选不回写来源。新窗口及刷新只消费URL。

启动：根目录`pnpm --filter playground dev --host 127.0.0.1 --port 4208`，DQE_SIM_PORT=4210配置本地DQE代理端口；确切命令见B5结果。Embed用`MC_EMBED_EXAMPLE_PORT=4212 pnpm --filter @metriccanvas/embed exec playwright test ioc-navigation.spec.ts`。

异常：概览缺目标能力链接提示不可用；清单切季度或点击缺编码行拒绝；详情将month改为quarter:2026-Q3/bad，或删project-id、改未知区域，显示输入错误且不发业务查询。

内联清单为导航边界样例，不是实际筛选结果。详情合成HTTP不代表真实DQE/CloudIOC/Relay验收。无viewstate、历史存储或恢复，B6挂起。

## 唯一页头与年份筛选（6.41）

复用现有页面，不增加目录入口。启动 `pnpm --filter playground exec vite dev --port 5196`。业务页数据为合成演示，动态交互需匹配的 DQE 网关；自动浏览器验收使用本地仿真服务和合成响应，不证明真实业务数据。

- `/pages/ioc-opportunity-list`：明确声明 iocHeader，前四项常驻，“更多筛选”收纳其余六项，只有一个页头、一个标题。展开候选失败项可重试；将 iocHeader.readOnly 设为 true 并重开后，主区域和更多面板都显示只读，写入不会触发查询。
- `/pages/ioc-project-overview`：同一页头呈现普通布局，五项可见筛选全部常驻。
- `/pages/ioc-opportunity-analysis`：同一页头以 inline + compact 呈现七个筛选和既有说明，保留原查询绑定。
- `/pages/dashboard-period-filter`：单个年份框，无年季月切换栏；默认当前年。选择 2024 后绑定表回显 `2024-01-01~2024-12-31`，未绑定表不重取。`?period-filter=year%3A2025` 恢复年份；月、季度、近一年、未来或非法年份 URL 不覆盖合法默认年。
- 1440/1024/390 宿主宽度下检查更多面板及年份面板不导致页面横向溢出。历史 compact/readOnly、无显式页头和 hidden 文档由完整夹具回归，运行时只有 IocHeader 实现。

非法声明夹具包括 unified-header-version、unified-header-conflict、period-modes-empty、period-modes-duplicate、period-modes-default、period-modes-plain-range。参数模式冲突、只读写入与候选重试由契约和浏览器测试补充。真实 DQE／Relay／CloudIOC／门户／模型未由这些场景验收。

## 表格搜索字段切换（6.42）

- 页面：[table-search-options-demo.json](table-search-options-demo.json)，目录「功能演示」，入口 `/pages/table-search-options-demo`，不需要 URL 参数。
- 根目录运行 `pnpm dev:dqe`，同时启动页面试验场和 DQE Sim。第一、三张表使用 inline 合成数据，第二张表使用真实 HTTP 链路访问本地 DQE Sim；均不包含真实业务数据。
- 默认选「项目名称」。输入「星河项目」并 Enter：等值表匹配2行，不含「星河项目二期」；旧包含搜索则匹配更多行。
- 保留「星河项目」切到「责任人」：立即匹配责任人为该文本的「其他项目」记录；切换 placeholder。输入「00123」后切到「项目编码」：立即匹配前导零完整编码。清空保留「项目编码」，恢复7行并回第一页。
- 正常输入仍需 Enter/搜索按钮；只修改输入草稿后点击导出，下载内容沿用上次已提交条件。搜索、排序与翻页彼此协作，其他表的选中项与关键词不变化。
- 编码 `ABC`、`abc` 在本地/Sim中区分；`A%_` 按字面量等值匹配；输入 `123` 不匹配 `00123`。宽屏及320/390窄屏检查下拉框、输入、清空和导出入口。
- 非法配置复现：在页面试验场的 JSON 预览中复制本页，修改默认项为 `missing`、重复选项 value，或将任一选项 field 改为 `amount`，应显示校验错误；恢复配置后正常。命令行反例由 table-search-options 契约向量分发。
- 自动验收：`node apps/playground/tests/table-search-options-browser.mjs`，默认访问5173，可用 `TABLE_SEARCH_BASE_URL` 指向隔离服务。脚本保留页面中的搜索配置，验证静态选项、精确匹配、切换、查询请求体、清空、独立状态、导出与窄屏。
- 证据边界：协议、本地与 Sim 通过不等于真实 DQE/Relay/生产验收；真实服务大小写规则、重复同字段条件 AND 及匹配总数仍待核验。

本批验收结果见[搜索字段切换验收记录](../docs/evidence/table-search-options/acceptance.json)，包含场景映射、测试命令及真实服务未验收边界。


### IOC页头选择控件

`/pages/ioc-header-selection`：6.43协议，沿用对象selection；本地合成候选与查询夹具。区域树单选替换稳定代码，行业父子独立，业务仅叶子，多标签固定单行横向滚动，模型关闭搜索，存量路径树父选后代。支持名称/代码/路径搜索；搜索与展开不改URL/查询。证据见`docs/plan/ioc-header-selection/`；真实DQE/Relay未运行。

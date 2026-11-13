# 代表处指标卡业务页

## 行权规范代表处明细与搜索空结果

入口：`/pages/region-auth-norms-detail`，[页面 JSON](region-auth-norms-detail.json)。按2026-11-10用户提供的完整页面更新。旧紧凑工具栏已迁为首分区首组件 `iocHeader`，Schema 采用该结构的最低版本6.81；保留标题、工具栏说明、统计期间、区域与客户分类筛选、默认值、查询绑定、Tab及下钻。合并及关联明细的页大小按本轮原稿使用10条。

启动 `pnpm dev:dqe`，无必填URL参数；真实业务查询仍需要实际DQE服务。本地浏览器回归 `apps/playground/tests/region-auth-norms-search.browser.ts` 读取本页，拦截业务响应提供合成数据，核对审批人与评审组织人精确搜索均向商务及合同两个成员发出等值条件、成功零匹配时显示“暂无数据”并保留表头及关键词，清空搜索恢复原行集。该回归不证明真实业务数据或真实DQE搜索已接通。

本页 `decision-valid-table` 沿用最新附件的 `toolbar.search.options`，按完整审批人名称精确匹配；`reviewer-rejection-table` 按用户要求同样使用 `options`，按完整评审组织人姓名精确匹配。两表都只配置一个固定搜索字段，界面只显示输入框，不显示字段选择器；输入框分别提示输入完整审批人或评审组织人姓名。两表经 `pagedUnion` 分别映射为各自商务及合同成员“商务审批人”和“审批人名称”的 `filter.dims` 等值条件，不依赖包含搜索编码器。移植时保留 `options` 分支及两个成员的字段映射；改回 `fields` 会切换为包含匹配。包含搜索缺少 `encodeSearch` 时，引擎在发送HTTP前抛出 `DQE_CONFIG_ERROR`；错误空表同样显示“暂无数据”，错误继续保留在控制台与data-error事件。紧急决策两表沿用有界完整关联后的本地搜索。真实服务的等值规则、字段支持及回执仍需另验，本次不新增Schema字段或运行时能力。

行权规范情况入口：`/pages/region-authorization-norms`，[JSON](region-authorization-norms.json)。无必填 URL 参数；沿用页面默认统计期间，Region 空选时立即发起地区部、代表处和三张趋势图的查询，不必先选全球。全球不添加区域谓词，选择地区部或代表处后按对应字段筛选。Playground 使用合成组织候选，业务查询仍走 DQE 网关；可先运行 `pnpm dev:dqe` 和 `pnpm dev:playground`。打开 Region，展开长组织树并缩短窗口时，只滚动候选列表，搜索框固定。自动回归 `apps/playground/tests/authorization-norms.browser.ts` 拦截业务响应，覆盖首屏请求、区域切换、单层滚动及正常/空/失败状态，不代表真实 DQE 或线上部署验收。

- 行权效率：`/pages/rep-office-execution-efficiency`，[JSON](rep-office-execution-efficiency.json)。
- 业务结果指标：`/pages/rep-business-result`，[JSON](rep-business-result.json)。

启动：仓库根目录运行 `pnpm dev:dqe`，同时启动 Playground 与本地 DQE 仿真；无必填 URL 参数。两个入口均包含真实业务查询定义，需要实际 DQE 才能取得业务结果；内联数据不代表真实业务结果。业务结果页以2026-11-12用户提供的三段完整 JSON 为当前基线，客户商务信息与合同风险明细的改造见下文。

两个入口均使用 Dashboard，首分区首组件为 `iocHeader`。行权效率使用 Schema 6.109，业务结果使用6.118；业务结果从6.95通过升级工具迁移，为原动态列头筛选显式保留 `showSearch:true`。业务结果的页头继续保留统计期间、代表处、客户分类和原默认行为。

观察方式：

1. 业务结果页在 1440px 下展示两张 `compactStack` 和两张 `primaryDetail`。四卡同排等高，短卡底部留白；字体、颜色、间距、同比和次级指标位置保持各自形态。
2. 390px 下逐卡堆叠，各卡按内容自然定高，不跨视觉行统一高度。
3. 行权效率页保留四张单面板 `compactStack`，同排复用相同拉伸规则。

行权效率的指标卡分区与下方 Tab 分区沿用引擎统一的16px分区间距；即使含IOC页头的首分区被独立渲染，也不应与后续内容贴合。隐藏或空的分区容器不额外占据这段间距。

完整数值合成演示位于 `/pages/metric-card-primary-detail` 的 `mixed-variants` 分区。前后几何/样式比对和数据边界见[验收记录](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-11-03-metric-card-height/acceptance.md)。本批未验收真实 DQE、Relay 或线上部署。

## 业务结果的多源排序与合同风险明细精确搜索

入口 `/pages/rep-business-result`，[JSON](rep-business-result.json)，无必填 URL 参数；可选 `rep-office-name` 沿原页面绑定约束查询。启动方式同上，真实业务结果需要实际 DQE 服务。页头已有 `iocHeader`，保留统计期间、代表处、客户分类和原默认值。客户维度的净商务折扣原价同比在目标列显式使用 `points-1-signed`，保留百分点口径；决策任务的落实时间显式使用 `{type:"time",pattern:"YYYYMMDD"}`，遵循固定 UTC+8，原值不变。

“框架执行率明细”的 `business-info-table` 绑定 `business-info-detail` 自动分页记录源。`business-info-framework` 按商务编码和站点分组，决定当期业务范围并消费期间、代表处和客户分类；`business-basic-info` 以商务编号补生效时间、失效时间、申请类型和有效期，`business-approval-detail` 以商务 ID 补审批通过时间。两份补充查询只消费原有区域和代表处参数，成员显式声明 `notApplicableFilters:["mtime","customer-category"]`，不猜测期间字段。三个来源的字段和查询定义保持原业务口径；真实服务须兑现商务编码、商务编号、商务 ID 可关联及补充成员同键唯一的契约，不能擅自从多条审批记录取最新一条。

“合同风险率明细”的 `contract-risk-table` 改为单个 `data.main:"contract-risk-detail"`。`contract-risk-clause` 仍按原期间、区域、客户分类确定全部风险记录；`contract-basic-info` 按这些记录的合同 ID 补列，不消费期间和客户分类。成员普通查询均声明 `resultScope:"complete"`，移除旧固定窗口及当前页 `resultBindings`，由组合源读取；合同资料中的范围外合同不进入结果。合同 ID 仅作为关联键，`riskRowId` 使用现有记录模式的快照内标识，同一合同下多条风险记录全部保留；商务表的 `businessRowId` 同样保留同一商务编码下的多站点记录。快照标识不用于跨刷新业务定位，原业务编号及链接字段不变。

两张表采用 Schema 6.118 的 `pagination:{mode:"auto",pageSize:10}`，保留 `records:{batchSize:500,maxBytes:67108864,timeoutMs:180000}` 及历史结构要求 `fallback.maxRows:1000`，不声明 records.maxRows。仅主查询成员 canSelectPage 为 true。默认商务编码、合同编号排序由主查询决定；引擎只取当前10条记录和准确总数，先显示本轮主查询列，再按本页去重关联键并行补列。500为补列键和完整读取单批大小，未启动其他业务页的后台全量扫描。未投影的 businessRowId/riskRowId 继续使用快照内位置标识，重复关联键的站点、风险行不合并。

主查询可独立兑现全部条件且单列排序字段非空时走快路径；可空排序、多列、补充字段排序、补充字段搜索、跨来源筛选和能力不足时完整读取。商务表保留七个可排序字段，合同表保留激活与风险评审日期排序；跨来源表头条件按 AND 保留，排序切换不清除其他成员条件。缺补列保留主行。完整路径递增 offset 直到后端准确总数，再筛选、排序、分页，不因500、1000或10000条截断。可空字段未确认 DQE 空值排尾时仍完整关联，不擅自改成非空契约。

商务编号单字段精确搜索可下推到主查询；合同完整项目名称、完整客户名称来自补充源，搜索走完整关联，合同编号精确搜索可走快路径。清空、提交搜索回第一页。表头候选基于完整匹配范围，打开候选可能触发完整读取。Excel 始终冻结当前完整条件并完整读取，保留重复关联键，仍受单表10000行上限约束。快路径字节预算计入本页实际读取和投影，完整路径计入全部读取；单批180秒预算不变。查询失败不触发快路径的全量补救扫描；完整路径保留既有异常兼容与告警。

浏览器回归 `apps/playground/tests/rep-business-result-search.browser.ts` 直接加载本页，配套 `rep-business-result-complete-fixture.ts` 在 DQE HTTP 边界注入合成响应：100000个商务编号加一条同编号不同站点记录，共100001行。冻结两个补列响应时，前10行、重复商务编码与准确总数已显示，主请求仅一次 offset=0/limit=10，两个补列已同时发出，补列返回后原位补齐。另验证默认合同查询与末页直达、补列字段全局排序、跨成员筛选、精确搜索与清空、完整Excel、缺补列、空结果、请求失败、12002条风险记录及150秒风险响应。运行 `pnpm --filter playground exec playwright test tests/rep-business-result-search.browser.ts --workers=1`。真实 DQE 的字段过滤、键唯一性、日期原值、准确总数、跨页顺序与实际延迟仍须在用户环境复验；合成数据不证明真实业务接通。


## 行权效率首个 Tab 的三份查询

### 商务审批明细跨槽搜索（6.109）

入口 `/pages/rep-office-execution-efficiency`，[JSON](rep-office-execution-efficiency.json) 的 `approval-detail-table`。启动 `pnpm dev:dqe`，无必填URL参数；真实业务数据仍需实际DQE。搜索选项保留商务编号，新增责任人与客户名称，均输入完整值精确匹配。后两项分别通过 `{data:"basic",field:"owner-name"}` 和 `{data:"basic",field:"cust-company-name"}` 引用补充槽。

引擎先独立按责任人或客户名称查 `approval-basic`，完整取得匹配商务编号，再将编号与审批时长查询原条件取交集，以每批最多1000个 ID 完整读取主记录并补查人数，统一筛选、排序、计数后分页。整次搜索独立限制累计100000行、64 MiB及180秒；超过1000个匹配编号继续分批，超预算或回执不完整明确失败。切换选项立即使用当前输入搜索；清空回到第一页及原范围。统计期间、代表处参数、排序和其他条件保留。移植时须保留主表与补充槽同名行键、查询字段映射及既有单条结果绑定，不能只复制搜索字段。

浏览器回归 `apps/playground/tests/table-slot-search.browser.ts` 直接读取本页，用24条合成记录验证责任人命中第12/24条、客户名称命中第11/22条、总数、空结果和清空恢复；执行回归另验分页、导出、约束交集与取消。真实服务对象字段、总数及分页稳定性未在本批复验。


当前 `rep-office-execution-efficiency` 使用 Schema 6.109、首分区首位 `iocHeader`，页头沿用最新原稿的统计期间与客户分类。首个 Tab 将两个指标拆开，人数按最新确认仅按商务编号分组：

- `approval-duration`：只查询商审决策时长，保留原分组维度、期间及代表处参数，以 `limit:10 / offset:0` 开始后端分页。
- `approval-basic`：按本页商务编号补查对象资料，保留原字段及查询；不扫描所有商务。
- `approval-headcount`：`output_dims` 只保留“商务编号”，`output_metrics` 只保留“商审决策人数”；字段契约同步仅保留这两项。期间及代表处参数仍约束查询，通过 `resultBindings` 仅查询本页商务编号。`resultScope:complete` 表示该编号集合内完整返回，不是全表读取；不再独立取人数查询的第一页。

主查询为空时跳过两份补查。表格以原 `biz-code` 对齐三个数据槽；真实服务仍须兑现原有每个商务编号唯一的行键约定。人数列保留下钻及原项目名称、代表处传参；`source:row` 仍从 `main` 读取。人数变为当前页补查列后，不提供全局排序入口；时长及账期排序仍由主查询执行。

本次仅修改页面查询配置，未新增 Schema 或运行时能力。合成执行核对首屏、下一页、空结果及真实零值；真实 DQE 的字段、粒度、计数与返回内容仍待验。

## 人数列按项目下钻

点击首个 Tab 的商审决策人数，进入 `/pages/rep-office-approval-detail?project-name=<当前 main 行的项目名称>`。详情页已声明可选查询参数 `project-name`，通过 `approval-detail.source.query.paramBindings` 将其用于对象查询的“项目名称”等值条件；继续保留原期间条件及每页10条后端分页。直接打开详情页且不传该参数时不新增项目条件。

详情页已由6.84根级IOC页头升级为6.86首分区组件，保留原筛选与返回意图。原链接中的 `rep-office-name` 仍作为URL携带，不额外绑定详情查询；详情页代表处条件仍由已有Region筛选控制。项目名称传值来自主指标查询，与对象槽中显示的同商务项目名称是否一致，需要真实数据核对。

合成验证覆盖URL特殊字符编码、目标参数解析、最终对象查询的项目名称谓词，以及无参数直接打开；真实服务对 `Commercial-Decision_Duration_Metric_Detail` 的“项目名称”筛选支持仍待验，不将合成请求构造当作真实查询成功。

## 授权规范父子表格

入口 `/pages/authorization-norms`，[JSON](authorization-norms.json)。保留用户提供的 Schema 6.101 页面，用于核对地区部父表、代表处查询子表、固定列和完整 Excel 导出。参考组件为 `region-dept-auth-norms-table`，子表通过 `detail-region` 绑定当前父行地区部，`rowExpansion.selection` 配合 `office-region-lookup` 定位代表处所属地区部；页头已有首分区首组件 `iocHeader`，沿用原配置。

启动 Playground 后打开该入口，展开地区部再点击“导出”；父子表格应在下载前后保持正确行序、列对齐与展开状态。复现数据可固定为父表一个地区部、子表一个代表处；浏览器注入响应只能验证页面呈现与下载，真实业务数据需要实际 DQE 服务。移植时须一并映射对象字段、查询字段映射、行键、隐藏筛选及父级定位关系。页面原说明中关于 geo 层级、父表 Region 绑定及 datetime 账期的描述与实际声明存在差异，本轮原样保留，不作为真实查询能力已验收的依据。

浏览器回归 `apps/playground/tests/authorization-norms-child-export.browser.ts` 直接读取本页，注入对象查询的合成响应，覆盖单地区部单代表处在四种屏宽下连续导出、收起子表，以及超过十二条父行时同时展开两个子表。断言展开内容完整位于父表可视区域内；此检查不代表真实 DQE 接通。

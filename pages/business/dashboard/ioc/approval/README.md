# 代表处指标卡业务页

## 行权规范代表处明细与搜索空结果

入口：`/pages/region-auth-norms-detail`，[页面 JSON](region-auth-norms-detail.json)。按2026-11-10用户提供的完整页面更新。旧紧凑工具栏已迁为首分区首组件 `iocHeader`，Schema 采用该结构的最低版本6.81；保留标题、工具栏说明、统计期间、区域与客户分类筛选、默认值、查询绑定、Tab及下钻。合并及关联明细的页大小按本轮原稿使用10条。

启动 `pnpm dev:dqe`，无必填URL参数；真实业务查询仍需要实际DQE服务。本地浏览器回归 `apps/playground/tests/region-auth-norms-search.browser.ts` 读取本页，拦截业务响应提供合成数据，核对审批人与评审组织人精确搜索均向商务及合同两个成员发出等值条件、成功零匹配时显示“暂无数据”并保留表头及关键词，清空搜索恢复原行集。该回归不证明真实业务数据或真实DQE搜索已接通。

本页 `decision-valid-table` 沿用最新附件的 `toolbar.search.options`，按完整审批人名称精确匹配；`reviewer-rejection-table` 按用户要求同样使用 `options`，按完整评审组织人姓名精确匹配。两表都只配置一个固定搜索字段，界面只显示输入框，不显示字段选择器；输入框分别提示输入完整审批人或评审组织人姓名。两表经 `pagedUnion` 分别映射为各自商务及合同成员“商务审批人”和“审批人名称”的 `filter.dims` 等值条件，不依赖包含搜索编码器。移植时保留 `options` 分支及两个成员的字段映射；改回 `fields` 会切换为包含匹配。包含搜索缺少 `encodeSearch` 时，引擎在发送HTTP前抛出 `DQE_CONFIG_ERROR`；错误空表同样显示“暂无数据”，错误继续保留在控制台与data-error事件。紧急决策两表沿用有界完整关联后的本地搜索。真实服务的等值规则、字段支持及回执仍需另验，本次不新增Schema字段或运行时能力。

行权规范情况入口：`/pages/region-authorization-norms`，[JSON](region-authorization-norms.json)。无必填 URL 参数；沿用页面默认统计期间，Region 空选时立即发起地区部、代表处和三张趋势图的查询，不必先选全球。全球不添加区域谓词，选择地区部或代表处后按对应字段筛选。Playground 使用合成组织候选，业务查询仍走 DQE 网关；可先运行 `pnpm dev:dqe` 和 `pnpm dev:playground`。打开 Region，展开长组织树并缩短窗口时，只滚动候选列表，搜索框固定。自动回归 `apps/playground/tests/authorization-norms.browser.ts` 拦截业务响应，覆盖首屏请求、区域切换、单层滚动及正常/空/失败状态，不代表真实 DQE 或线上部署验收。

- 行权效率：`/pages/rep-office-execution-efficiency`，[JSON](rep-office-execution-efficiency.json)。
- 业务结果指标：`/pages/rep-business-result`，[JSON](rep-business-result.json)。

启动：仓库根目录运行 `pnpm dev:dqe`，同时启动 Playground 与本地 DQE 仿真；无必填 URL 参数。文件来自用户提供的两份完整业务页面（业务结果由两段粘贴内容拼合），包含查询数据源及内联合成明细。查询尚未取得真实服务回执，本地查询指标可能显示缺失占位；内联行不代表真实业务结果。

沿用已确认的 Dashboard、Schema 6.80 与根级 `iocHeader`，当前 6.81 引擎按旧页兼容规则读取。页头保留标题、重点国代、客户分类、统计期间及原默认行为。原查询、筛选绑定、分页、表格与指标形态保持。业务结果原稿中两处不受协议支持的 `secondaryUnderline:false` 已在初次预览时移除，次级指标使用既有下划线。

观察方式：

1. 业务结果页在 1440px 下展示两张 `compactStack` 和两张 `primaryDetail`。四卡同排等高，短卡底部留白；字体、颜色、间距、同比和次级指标位置保持各自形态。
2. 390px 下逐卡堆叠，各卡按内容自然定高，不跨视觉行统一高度。
3. 行权效率页保留四张单面板 `compactStack`，同排复用相同拉伸规则。

行权效率的指标卡分区与下方 Tab 分区沿用引擎统一的16px分区间距；即使含IOC页头的首分区被独立渲染，也不应与后续内容贴合。隐藏或空的分区容器不额外占据这段间距。

完整数值合成演示位于 `/pages/metric-card-primary-detail` 的 `mixed-variants` 分区。前后几何/样式比对和数据边界见[验收记录](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-11-03-metric-card-height/acceptance.md)。本批未验收真实 DQE、Relay 或线上部署。

## 行权效率首个 Tab 的三份查询

### 商务审批明细跨槽搜索（6.109）

入口 `/pages/rep-office-execution-efficiency`，[JSON](rep-office-execution-efficiency.json) 的 `approval-detail-table`。启动 `pnpm dev:dqe`，无必填URL参数；真实业务数据仍需实际DQE。搜索选项保留商务编号，新增责任人与客户名称，均输入完整值精确匹配。后两项分别通过 `{data:"basic",field:"owner-name"}` 和 `{data:"basic",field:"cust-company-name"}` 引用补充槽。

引擎先独立按责任人或客户名称查 `approval-basic`，完整取得匹配商务编号，再将编号与审批时长查询原条件取交集、分页并补查资料与人数。查找最多沿用绑定的1000条预算，超限或回执不完整明确失败；不在当前页资料中搜索。切换选项立即使用当前输入搜索；清空回到第一页及原范围。统计期间、代表处参数、排序和其他条件保留。移植时须保留主表与补充槽同名行键、查询字段映射及既有单条结果绑定，不能只复制搜索字段。

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

# IOC 页头

普通组件外壳，属性复用旧 IOC Header。仅允许首 section 首位，span固定12，最多一个；跟随section条件和分组，不绑定数据源。身份、筛选认领、返回、只读、吸顶、导出及读取迁移语义由[页面模块](../page.md#ioc-页头进入分区681)统一维护。

完整合成场景：`ioc-header-section-placement`（混排与显隐）、`ioc-header-section-groups`（分组）、`ioc-header-section-sticky`（吸顶）。均可在Playground按页面id访问。

普通期间筛选绑定默认跟随年、季、月，与页头位置和新旧工具栏写法无关，近一年按月；页面只需 `target:"time"`。显式固定粒度、期间比较、指定日期字段等查询继续使用自己的规则，月度趋势需显式固定为 month。默认行为覆盖屏幕、列候选和完整导出，详见[查询独立期间策略](../queries-and-bindings.md#查询独立期间策略)；合成传输验收入口 `quarter-query-period`。

重点国代标准 boolean 筛选 `key-office` / `key-national-only` / `key-rep-only` 勾选后统一与 Region 取交集，无需新增声明。Region 保留完整候选和最新选择；取消勾选仅移除重点条件，时间、客户级别及权限继续生效。集成应用仍须完成完整授权名单桥接。历史显式 Region 覆盖不再改变该口径。详见[布尔筛选覆盖与交集](../filters.md#boolean-filter-overrides)。

<a id="页头子控件691"></a>

## 页头子控件（6.91）

新页头通过 `props.components` 显式排列子控件；没有 `regionFilter` 就不添加 Region。子控件只允许放在 IOC 页头内，不声明 layout 或 data，不能独立放进 section。页头本身仍为首 section 首组件、全宽。

```json
{
  "id": "header", "type": "iocHeader", "layout": { "span": 12 },
  "props": {
    "identity": { "title": "伙伴健康度" },
    "components": [
      { "id": "year-control", "type": "filterControl", "props": { "filterId": "stat-year" } },
      { "id": "region-control", "type": "regionFilter" }
    ]
  }
}
```

`filterControl.props.filterId` 引用现有静态可见的页级 `filters` 声明，时间及其他业务筛选行为不变。`regionFilter` 内置公共筛选 `region`，页面不再声明 `filters.region`；不得通过另一控件重复认领。子控件 id 在全页面组件间唯一。`components` 至少一项，与旧 `filterIds` 互斥；旧 `filterIds` 及完整 Region 声明仍兼容读取，旧页面无需改写。

RegionFilter 固定提供可搜索、可清空的单选组织树，层级为 `geo` / `region-dept` / `office`，对应候选路由 `geo-pc-code` / `region-dept-code` / `rep-office-code`。IOC 页头的 Region 在页面实例初始化且没有 URL 输入、显式 default 或恢复状态时，等待完整合法候选树，优先选中可用的 `value:"全球"` 节点，否则选中返回顺序中的第一个可用节点，并使用该节点自己的层级与维度。禁用节点不能成为默认项；候选未就绪、为空、拒绝或失败时不制造候选或选择。只初始化一次，用户清空后、业务条件刷新或候选重载均不补回；旧 `filterIds` 声明沿用同一规则，显式 `default:[]` 可保持初始不选。普通维度筛选不受影响。应用级 `withOperationMapRegion(dataGateway, adapter)` 安装一次候选接线，页面不配置接口地址、凭据、候选请求映射或额外同步开关。其他组织值沿用当前中文业务值约定；Adapter 将“全球”节点及其父引用规范为 `value:"全球"`，label 仅用于显示。缺失、拒绝及非法候选沿用原门禁，不能回退到越权候选。

解析时只在运行投影展开标准筛选，源文档保留简写。统一筛选状态、URL、候选加载、查询 `filterBindings.region`、初始化和现有选择回写继续复用。未绑定 region 的查询不会新增组织谓词；绑定的查询仍显式声明自己的 `levelQueryFields`。此能力不引入实时跨应用同步机制。应用级代码示例见集成应用契约的 Operation Map Region 接入章节。

6.95 起，表格列可通过 `selection.writes.region: {field:"office-value",level:"office"}` 更新这个公共筛选，页头自动回显并沿用相同查询刷新链路。`regionFilter` 子控件 ID 无需被表格引用，页面无需重复声明 `filters.region`。详见[单元格点击与筛选联动](table.md#table-cell-selection)。

完整合成验收入口 `/pages/ioc-header-controls`，声明与操作见场景目录 `pages/capabilities/ioc-header/controls/README.md`。真实 Operation Map 接口与 DQE 数据由集成环境另验。

## 标题跳转（6.115）

`props.identity.titleNavigate` 是可选的普通导航目标，复用表格列 `navigate` 的 `href`、`query`、`validateTargetInputs`、`visibleWhen` 和 `enabledWhen`。必须同时声明 `identity.title`；不增加 `link` 开关，不改变标题的文本取值写法。

```json
{
  "id": "page-header", "type": "iocHeader", "layout": { "span": 12 },
  "props": {
    "identity": {
      "title": "经营概览",
      "titleNavigate": { "href": "/operation-map/overview" }
    }
  }
}
```

`href` 允许 HTTP(S) 和相对 URL，沿用已有地址安全、路由解析与导航接管规则。`query` 可显式引用页面参数或已应用筛选，标题没有行上下文，拒绝 `source:"row"`。查询值沿用既有编码和目标输入校验，不自动携带未声明的参数或筛选。

省略时呈现普通标题；声明时标题为原生链接，保留现有字号、字重与颜色，悬停显示下划线，可键盘激活、复制地址或在新标签页打开。`visibleWhen` 不满足时只取消链接，标题文字仍显示；`enabledWhen` 不满足时保留文字并标记禁用。返回按钮与标题导航各自独立。只读筛选不禁止导航；静态导出仅保留标题文字。旧根级 IOC 声明在版本满足时复用相同行为；已有无链接页面无需修改。

完整合成入口 `/pages/ioc-header-title-link` 与 `/pages/ioc-header-title-link-target`，覆盖页面参数、布尔筛选、目标校验和条件；操作与证据边界见示例目录 README。该场景不验证真实业务地址或 DQE。

<a id="ioc-header-filter-rows"></a>

## 页头筛选行（6.133）

在 IOC 页头组件的 `props.filterRows` 声明一条或多条独立筛选行，按数组顺序呈现。每行 `title` 可省略，填写时使用非空纯文本。每行 `filterIds` 按显示顺序引用已由 `components` 或兼容 `props.filterIds` 认领的筛选 ID。Region 使用筛选 ID `region`。同一筛选在所有行中最多引用一次。每行至少引用一个筛选。省略 `filterRows` 时沿用现有页头排版。旧根级 `iocHeader` 继续按历史协议读取。

```json
{
  "id": "header",
  "type": "iocHeader",
  "layout": { "span": 12 },
  "props": {
    "identity": { "title": "业务结果指标情况" },
    "presentation": { "layout": "inline", "collapse": "firstRow" },
    "components": [
      { "id": "period-control", "type": "filterControl", "props": { "filterId": "mtime" } },
      { "id": "business-type-control", "type": "filterControl", "props": { "filterId": "business-type" } },
      { "id": "cloud-service-control", "type": "filterControl", "props": { "filterId": "cloud-service" } }
    ],
    "filterRows": [
      { "title": "净商务折扣筛选项", "filterIds": ["business-type", "cloud-service"] }
    ]
  }
}
```

未分行的已认领筛选按原顺序进入首行，沿用 `presentation.collapse`。行内布局下，首行筛选从主标题后自然排列。独立行的小标题紧邻本行第一个筛选，标题与筛选作为一组靠右排列。当首行一行放得下且宽于独立行时，两者共用右边界。窄屏下控件在各自的行内换行。行内所有控件因条件隐藏时，整行随之隐藏。筛选的值、默认值、候选、URL 及查询作用范围继续由现有声明决定。静态导出同样呈现有效行及当前选值。

合成入口 `/pages/ioc-header-filter-rows` 验证两条独立行及条件显隐。业务入口 `/pages/business-result-metrics` 将业务类型和云服务排除项放在「净商务折扣筛选项」一行，查询范围沿用原绑定。

<a id="office-navigation"></a>

## 代表处跨页下钻（6.121）

来源页在 `regionFilter.props.officeNavigate` 声明一个目标。`href` 必填，`query` 可选，沿用 URL 导航的页面参数与筛选传参。控件没有行上下文。引擎以本次选中的 `office` 节点稳定值覆盖 URL 上的 `rep-office`，因此 `query` 不允许声明这个键。目标页使用标准 Region URL 输入，按自身候选权限校验组织值。

```json
{
  "id": "region-control",
  "type": "regionFilter",
  "props": {
    "officeNavigate": {
      "href": "/pages/ioc-office-drill-detail",
      "query": {
        "period": { "source": "filter", "id": "stat-period", "part": "value" },
        "period-from": { "source": "filter", "id": "stat-period", "part": "from" },
        "period-to": { "source": "filter", "id": "stat-period", "part": "to" }
      }
    }
  }
}
```

配置后，在 IOC 页头选中一个代表处会直接打开目标页，保留来源页原有筛选和历史记录。初始化时已有一个代表处（例如 URL 输入）会在概览渲染和业务查询前导航，并替换当前历史记录。`back: true` 及兼容的 `back: "auto"` 沿用浏览器后退行为。目标使用独立详情页，避免指回概览。地区部的子节点数量不影响当前页筛选。省略 `officeNavigate` 时，代表处仍可作为页内筛选使用。

统计期间使用当前已应用值。近一年显式映射模式值及起止范围，以便目标页恢复同一窗口。目标 URL 键由其实际筛选声明决定。合成入口 `/pages/ioc-office-drill-overview` 与 `/pages/ioc-office-drill-detail`，操作见 `pages/capabilities/ioc-header/controls/README.md`。

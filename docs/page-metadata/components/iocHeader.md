# IOC 页头

普通组件外壳，属性复用旧 IOC Header。仅允许首 section 首位，span固定12，最多一个；跟随section条件和分组，不绑定数据源。身份、筛选认领、返回、只读、吸顶、导出及读取迁移语义由[页面模块](../page.md#ioc-页头进入分区681)统一维护。

完整合成场景：`ioc-header-section-placement`（混排与显隐）、`ioc-header-section-groups`（分组）、`ioc-header-section-sticky`（吸顶）。均可在Playground按页面id访问。

重点国代标准 boolean 筛选 `key-office` / `key-national-only` 勾选后默认覆盖 Region，页头和筛选声明无需添加 `overridesFilters`。Region 保留完整候选和最新选择；取消勾选后恢复 Region，时间、客户级别及权限继续生效。默认覆盖不提供名单，集成应用仍须完成授权名单桥接。详见[布尔筛选覆盖](../filters.md#boolean-filter-overrides)。

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

RegionFilter 固定提供可搜索、可清空的单选组织树，层级为 `geo` / `region-dept` / `office`，对应候选路由 `geo-pc-code` / `region-dept-code` / `rep-office-code`。默认只确定 geo 层级，不默认选中“全球”。应用级 `withOperationMapRegion(dataGateway, adapter)` 安装一次候选接线，页面不配置接口地址、凭据、候选请求映射或额外同步开关。其他组织值沿用当前中文业务值约定；Adapter 将“全球”节点及其父引用规范为 `value:"全球"`，label 仅用于显示。缺失、拒绝及非法候选沿用原门禁，不能回退到越权候选。

解析时只在运行投影展开标准筛选，源文档保留简写。统一筛选状态、URL、候选加载、查询 `filterBindings.region`、初始化和现有选择回写继续复用。未绑定 region 的查询不会新增组织谓词；绑定的查询仍显式声明自己的 `levelQueryFields`。此能力不引入实时跨应用同步机制。应用级代码示例见集成应用契约的 Operation Map Region 接入章节。

6.95 起，表格列可通过 `selection.writes.region: {field:"office-value",level:"office"}` 更新这个公共筛选，页头自动回显并沿用相同查询刷新链路。`regionFilter` 子控件 ID 无需被表格引用，页面无需重复声明 `filters.region`。详见[单元格点击与筛选联动](table.md#table-cell-selection)。

完整合成验收入口 `/pages/ioc-header-controls`，声明与操作见场景目录 `pages/capabilities/ioc-header/controls/README.md`。真实 Operation Map 接口与 DQE 数据由集成环境另验。

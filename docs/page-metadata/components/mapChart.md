# 地图 mapChart

展示国家或省级地域分布，可按层级维度筛选器做三级下钻。适用于明确要求中国/世界地图，且地域名称能映射到地图。数据形状：地域名称 dimension 字段 + 一个 metric 数值字段。

map限定china/world，区域名称须与底图名称或显式nameMap匹配；协议地名资产来自实际底图。regionalOverview、分段legend、tooltip字段与固定摘要遵循声明；未知地名可能无法着色，静态校验不能证明实际地理匹配。

nameMap 的方向是数据地名 → 底图区域名，例如 {"中国":"China"}。欧洲等宏观区域不能直接等同一个国家，须有明确的区域到几何或国家集合映射；缺少该输入时不能猜测替代国家。

层级绑定的 levelField 值必须等于 dimension filter 的 hierarchy.id，而非显示 label；例如 id 为 global、label 为 全球时，行内层级值为 global。初始作用域、codeField 和 parentField 需要与层级数据一致。地图着色、提示与下钻仍须在运行时验证，未知或未匹配地区不能用零值伪造完整覆盖。

<a id="ioc-region-map-viewport"></a>

## IOC Region 宿主视口

集成应用启用 Region 地图适配后，`hierarchyFilter: "region"` 的地图可按已选地区部或代表处聚焦。底图继续由 `map` 或 `levelMaps` 决定；显式视口优先。绑定 Region 的 `regionalOverview` 在没有显式视口时按组织覆盖的底图边界自动取景。地区部也可按已知下属代表处的点位范围取景，单点居中并放大。缺少可定位资料时使用默认视角。其他地图沿用底图默认视角。「全球」使用默认视角。

地区部地图可用 `actions.writeFilter` 指定 Region 和目标层级。代表处地图使用 `hierarchyFilter`、`parentField`、`codeField`，点击按当前授权候选核对组织名和父地区部，再走 IOC 页头选择。解绑的行可保留在表格。地图和列表可引用同一数据源，`nameMap` 负责底图地名匹配，查询字段继续用 `levelQueryFields`。

`regionalOverview` 的代表处散点把图钉放在名称标签内部的左侧。悬浮或点击图钉时，按该代表处行展示提示或切换选择。集成应用可按实际底图为各可选地区部和代表处提供 `viewport.center` 和 `viewport.zoom`，使选中后聚焦。

合成场景 `/pages/ioc-region-map-demo`。集成应用通过公开的 Embed `regionMap` 输入提供资料。

<a id="map-geography"></a>
## 组织地图地理资料（6.139）

Region 地图可从集成应用的 `regionMap.geography` 读取公共地理资料。页面根级可选 `mapOverrides` 使用相同结构。两者按实际底图（world/china）、组织层级（region-dept/office）、候选业务值三级查找。例如：

```json
{"mapOverrides":{"world":{"region-dept":{"欧洲地区部":{"viewport":{"zoom":6.4}}}}}}
```

地区部图通过写入 region 的 action.level 识别行层级，代表处图通过 hierarchyFilter=region、codeField 和 parentField 识别。point 可给 `{"lngLat":[21,52.13]}` 或 `{"feature":"Germany"}`。匹配顺序为页面 point、组件 nameMap、公共 point、业务值同名底图要素。features 是当前行指标着色的底图要素名数组，可独立于散点覆盖；空数组清除着色。共享要素归属有歧义时使用原始散点选择组织。viewport.center（WGS84 经纬度）和 zoom（正数）逐字段叠加到已有 resolveViewport 回执，优先级为页面、公共资料、回执。数组和点位整体替换。地区部全球汇总点和选中该地区部时的镜头分别配置。匹配失败只跳过对应散点。

合同商务总览的全球/空选择显示地区部行。地区部和代表处的中国及海外分区通过现有展示事实 regionDepartment 区分，集成应用从授权树派生。地图和表格绑定同一数据源。合成示例 `/pages/ioc-region-map-demo`。

<a id="map-tooltip-rows"></a>

## 悬浮提示与散点标签（6.141）

`props.tooltipRows` 按声明顺序绘制非空指标行，每行使用 `label` 和 `field`，可跟一个同排 `comparison`，它也使用 `label` 和 `field`。字段绑定至同一个地图主数据槽的度量并沿用绑定格式。无外边框的提示以当前组织名称为标题，标题和数值均使用 400 字重，普通值默认黑色。同排对比值与带符号格式的指标按方向显示，正值为绿、负值为红，零和缺失值保持黑色。只有能唯一对应实际数据行的散点或着色区域显示指标提示。声明 `tooltipRows` 时由作者列出所有行，包括需显示的地图着色指标。旧 `tooltipFields` 仍在地图着色指标之后逐行追加，两种提示配置互斥。

```json
{
  "nameField": "org-key",
  "valueField": { "data": "main", "field": "discount", "format": "percent-1" },
  "map": "world",
  "scatter": "point",
  "pointLabel": "nameAndValue",
  "tooltipRows": [
    {
      "label": "净商务折扣",
      "field": { "data": "main", "field": "discount", "format": "percent-1" },
      "comparison": {
        "label": "同比",
        "field": { "data": "main", "field": "discount-yoy", "format": "points-1-signed" }
      }
    }
  ]
}
```

`pointLabel: "nameAndValue"` 在散点名称后附上使用 `valueField` 格式的指标值，数字使用 400 字重。值为空或尚未就绪时只显示名称。散点的数据身份、授权区域选择和固定摘要规则保持原样。合成示例 `/pages/ioc-region-map-demo`，完整四行见 `/pages/contract-business-overview`。

集成应用可以在 Embed 挂载参数中传入 `regionMap.displayNames`，例如 `{ "region-dept": {"中国地区部":"中国区"}, "office": {"德国代表处":"德国"} }`。组内键取原组织业务值。命中的显示名仅用于 Region 地图的散点标签和对应数据行的悬浮标题。缺省、空白或没有命中时使用原名称。页头候选、明细表和点击回写继续使用已有字段。合成示例 `/pages/ioc-region-map-demo?mapLabels=short` 可观察特意指定的「中国区」和简称缺省回退。

有稳定组织行和位置字段时，地图可以用本轮[渐进数据](../data-sources.md#progressive-map-data)先显示点位，再随折扣和其他指标返回补齐着色、标签和提示。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。

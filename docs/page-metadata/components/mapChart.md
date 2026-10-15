# 地图 mapChart

展示国家或省级地域分布，可按层级维度筛选器做三级下钻。适用于明确要求中国/世界地图，且地域名称能映射到地图。数据形状：地域名称 dimension 字段 + 一个 metric 数值字段。

map限定china/world，区域名称须与底图名称或显式nameMap匹配；协议地名资产来自实际底图。regionalOverview、分段legend、tooltip字段与固定摘要遵循声明；未知地名可能无法着色，静态校验不能证明实际地理匹配。

nameMap 的方向是数据地名 → 底图区域名，例如 {"中国":"China"}。欧洲等宏观区域不能直接等同一个国家，须有明确的区域到几何或国家集合映射；缺少该输入时不能猜测替代国家。

层级绑定的 levelField 值必须等于 dimension filter 的 hierarchy.id，而非显示 label；例如 id 为 global、label 为 全球时，行内层级值为 global。初始作用域、codeField 和 parentField 需要与层级数据一致。地图着色、提示与下钻仍须在运行时验证，未知或未匹配地区不能用零值伪造完整覆盖。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文可通过 `props.filter` 在左上角配置独立单选筛选。选项名称和值分离，default 与查询绑定显式声明；见[图表独立筛选](../filters.md#chart-local-filter)和 `chart-local-filter-page` 完整页面。

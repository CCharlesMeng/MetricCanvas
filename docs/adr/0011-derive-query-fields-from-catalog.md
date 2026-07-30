---
status: superseded by ADR-0014
---

# query 字段契约由结构化查询与元数据快照解析

schemaVersion 2.0 的 query 页面数据源不再重复持久化完整 `fields`。统一运行时以结构化查询中的 metrics/dimensions 确定字段角色，以元数据快照补全名称、标量类型和默认展示建议，再合并页面可选的字段名称覆盖；inline 页面数据源仍须用 `fields` 完整描述随页面固化的数据行。这样减少了 query 页面中与供给侧目录重复且可能漂移的声明，同时为当前统一运行时和未来 A2UI Adapter 保留同一份解析后字段语义。最终展示格式的归属由 ADR-0013 进一步修订。

## Consequences

- 元数据快照 formatVersion 2.0 必须提供维度值类型，并可为指标和维度提供 `defaultFormat` 展示建议；query 正式渲染依赖匹配的元数据快照。
- `fieldOverrides` 只用于覆盖 `label`，不能改变由数据服务治理的字段角色与类型；旧 `format` 仅兼容读取。
- schemaVersion 1.0 作为 N-1 继续读取；迁移器删除 query 完整 `fields`，把其中的 label/format 保守迁入 `fieldOverrides`，inline `fields` 不变。
- 页面加载后解析出的完整字段契约是内存派生结果，不形成第二份持久化页面资产。

## Considered Options

- 所有来源继续完整声明 `fields`：页面自包含且来源形态统一，但 query 重复数据服务目录事实，页面更冗长且存在漂移风险。
- query 完全不保留页面级字段信息：最简，但无法表达页面特有的标签和格式选择。
- 从返回数据行猜测字段：空集、全 null、日期字符串和数值语义均无法可靠判断，被否决。

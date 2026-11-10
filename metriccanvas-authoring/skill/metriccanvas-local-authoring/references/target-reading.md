# 目标事实局部读取

先用组件目录取documentAt，或沿用已知准确位置。scan回执含page的id/schemaVersion/layout，bindings的source项说明inline/query等类型；不再读/schemaVersion或/dataSources根对象。以下方面独立选择，不逐项执行：

```sh
node "<skill-dir>/scripts/analyze-data.mjs" scan --page page.json --at <documentAt> --select config
node "<skill-dir>/scripts/analyze-data.mjs" scan --page page.json --at <documentAt> --select fields --field amount --field rate
```

`config`返回当前组件或其内准确属性；大对象按目录继续收窄。`bindings`返回实际绑定与来源，`fields`保留真实字段契约，改变共享字段或来源时才查`consumers`：它按来源依赖闭包列消费者身份与位置，不按字段过滤；仅改局部绑定以非目标差异检查确认隔离。都有2KB预算及明确续查，按next保留相同参数续读；目标文件或参数变化不能复用cursor。字段、属性或引用不明确时保留缺口，不猜第一项，不回退整页打印。`--component <唯一id>`仍支持，重复id须用at。

只有需要核对原值才显式用`--select samples --source <实际来源> --field <字段> --limit <数量>`；不从无关来源抽样，长样本会明确标记omitted且不提供全文入口，不能把未返回的部分当作完整值；确实需要全文时保留该缺口，不默认打印原数据。其他方面默认没有rows/initial或查询正文。局部读取范围不缩小完成后的完整页面校验。

旧的无select scan保留兼容，其闭包较大；普通局部创作使用上述方面，不启动整页扫描或完整MD匹配。事实已明确后进入修改和校验，不因页面有query自动查查询创作章节。

# 创作数值呈现与受控多槽装配

创作工具复用既有页面 Schema、数据槽和字段绑定，PageDocument 字段净增减为零。Tokens 百万是新创作政策；已有合法金额百万格式继续由引擎支持。原始数值、查询身份和已确认的业务刻度保持。

## Tokens 与实际字段绑定

`results.normalize.v2` 显式选择新创作政策。可信基础刻度、完整结果且最小非零值缩放后满足安全阈值时，Tokens 默认使用 `compact-million-1`。partial、unknown 不从当前样本推断量级；已缩放结果不再缩放。其他单位沿用原 number、万、亿选择。未知刻度与显式冲突保留并报告，不能把建议当成事实。

`page.presentation` 通过实际 Schema 绑定遍历及同一字段解析器检查最终有效格式，包括表格、指标、图表和行明细的字段引用。它返回 data-only 范围及具体 binding pointer，不声称完成视口或 DOM 验收。轴、标签和 Tooltip 的呈现须通过实际运行时预览。

可提供原始页面 `baseline`，只报告新增或数值契约变化的冲突；标题、列宽、布局及对象键或组件重排沿用既有数值声明。明确希望百分比显示原数值时，`presentationIntent.rawValuePaths` 必须指向实际 number 系列绑定；不能据此豁免币种或二次缩放冲突。显式配置始终保留，检查不自动覆盖用户意图。

## 受控多槽与结果覆盖

`page.compose.v2` 和 `page.edit.v2` 同时接受单源和受控 `tableSlots`。它是创作输入，不进入页面协议；每槽明确来源、字段与期间，以既有 `data`、`rowKey` 和槽级字段绑定装配页面。度量字段按各列槽归属独立选择，按行对齐的槽须共享同 ID、同类型的稳定行键，不要求度量字段相同。

辅助普通 query 必须声明 complete 且结果证据证明完整，空结果 0/0 合法；缺匹配按引擎对齐语义留空，辅助额外行不扩充主行。覆盖报告只计算本次返回主键范围，不把部分查询样本当成全集。重复、空值、错误类型键、失败或未知完整性以及期间不匹配拒绝受影响块。主槽 partial 仅在可证明的第一查询窗口和单维行键下启用查询分页，不回退为本地分页，不生成第二份 join 行缓存。

新 compose/edit 操作通过可信程序调用同一 `page.presentation` 做最终适用检查；partial 保留可审查候选与诊断，error 不返回半改文档。旧十三项操作描述和默认行为保留，逐操作旧消费者回放与新版本验收分别进行。

## 本地适用检查

安装目录仅需 Node 22+，读取完整实际页面；输入文件可提供 evaluation、baseline 和 presentationIntent：

```sh
node scripts/associate-data.mjs page.presentation --page page.json --input presentation-input.json
```

空对象输入检查全页；提供 baseline 时比较受影响语义。产品拒绝退出 2，调用或文件错误退出 3，结果只写 stdout。它不查询、不保存、不重写页面。合成 Dashboard 入口为 `/pages/relay-multislot-presentation`，用于观察 Tokens 百万显示、乱序对齐、缺匹配留空及原值对照。


页面协议 6.89。结构真源为本册[schema.json](schema.json)，SHA256 `40cbb3ec45288519e3fca2621b5021b664fc6bab74e8ece3940e9ea2273f870d`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

## 语义规则与反例（生成）


## 示例与溯源（生成）

- [relay-multislot-presentation](examples/relay-multislot-presentation.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`metriccanvas-authoring/core/presentation/audit.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`metriccanvas-authoring/core/presentation/policy.json`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/field-resolution.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`metriccanvas-authoring/tool/metriccanvas_authoring/data/field_presentation.py`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

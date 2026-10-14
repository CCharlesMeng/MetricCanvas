# 常用合法写法

这些是插入组件位置的短片段，不是完整页面。当前字段和分支以[Schema](page-metadata/schema.json)为准；完整示例含它们所需的数据源和字段。

## 分区与标识

分区允许 id、title、container、columnTracks、components。默认12轨；没有 columns、像素坐标、高度或任意CSS。页面数据源键用小写连字符形式，如 project-summary，不用 projectSummary。完整例子见[分区布局](page-metadata/sections-and-layout.md)。

## 主值与变化

假设 main 数据槽引用单行数据源，字段 count、delta 为数字：

```json
{"id":"activity-count","type":"metricCard","layout":{"span":12},"data":{"main":"activity-summary"},"props":{"variant":"compactStrip","rows":[{"label":"数量","valueField":"count","changes":[{"label":"较上期","field":{"data":"main","field":"delta"}}]}]}}
```

表格列标题用 title，分类明细列标题用 label；不要混用。

变化对象在 rows[].changes，必填 label/field；没有 changeField。valueField 引用稳定页面字段。更多主值可增加 rows，不要为没读过的变体猜属性。读[指标卡](page-metadata/components/metricCard.md)和[compactStrip完整示例](page-metadata/examples/component-metricCard-compactStrip.json)。

## 分类与同色明细

main 引用含 category/count 的多行源：

```json
{"id":"category-detail","type":"categoryBreakdown","layout":{"span":7},"data":{"main":"categories"},"props":{"variant":"compactList","categoryField":"category","columns":[{"label":"数量","field":"count"}]}}
```

columns 是 label/field 对象数组，不是 valueFields。要色点时，先声明绑定同一 category 字段的 pieChart，再开 swatches。读[组合卡完整例子](page-metadata/examples/component-compositeCard-metricGrid.json)；图表、明细的分组顺序与总数需要核对。

## 表格切换

Tab 不声明 data，每一项是 id、label，加 component 单个表组件或 components 非空表格数组；两种分支择一：

```json
{"id":"detail-tabs","type":"tabContainer","layout":{"span":4},"props":{"defaultTab":"overview","tabs":[{"id":"overview","label":"概览","component":{"id":"overview-table","type":"table","layout":{"span":12},"data":{"main":"overview"},"props":{"columns":[{"title":"名称","field":"name"},{"title":"金额","field":"amount","sortable":true}],"fit":"container"}}}]}}
```

表列的金额字段为数字/金额，不预先生成带单位字符串用于排序。完整分支见[Tab](page-metadata/examples/component-tabContainer.json)与[表格](page-metadata/components/table.md)。

## 日期与工具栏

dashboard 使用统一工具栏显示页面筛选器；reportHeader 的 filterIds 只用于 report 日期工具带。期间文字与控件位置分开声明。readOnly 是禁用呈现，不是缺少查询时的自动要求。inline 数据下控件即使可选择，也不自动过滤数据；数据行为能力见[本地验收](local-workflow.md)。

# 组合卡 compositeCard

把若干组件框进一张卡,并让这张卡作为一个组件进 12 列栅格横向并排。适用于需要若干张白卡横向并排,每张卡自带卡壳、可选标题与卡内分隔、要装的这组组件本身就是一个内容分区时改用 section.container: "card"、卡内是多张表格互斥切换时改用 Tab 容器。数据形状：不绑定页面数据源；每个子组件自己声明数据槽与字段绑定。

metricGrid、compactSummary、analysisStack等变体决定卡内结构；子组件仅使用各变体允许的类型与布局。组合卡拥有完整子树，删除时依赖清理由创作工具负责。

Dashboard中放入白底Tab或白底分区时，组合卡复用指标卡的1px黑色10%透明度实线外框，内部指标保持无框；无需新增页面字段。示例：[`tab-mixed-content`](../examples/tab-mixed-content.json)。

纯指标内容使用现有 `variant: "metricGrid"`，按内容自适应高度；默认组合卡仍保留280px最小高度，`compact` / `projectNorms` 沿用各自高度约束。示例中的指标组合使用 `metricGrid`，避免撑高同一行的普通指标卡。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

6.35条件呈现及相关限制见[条件显隐](../conditions.md)；子项全部隐藏不自动收起父容器。

组合卡允许独立 filterGroup 及柱、线、饼、地图四类图表作为叶子组件，用于筛选与内容的显式组合；仍禁止组合卡递归和任意子组件。筛选作用范围由查询绑定决定，卡内位置不自动限定数据范围。

6.58 增加 aiSummary 子组件（Report 限制仍适用）；摘要必须在卡内内容最前并占满 12 列，可显式 scope: "container" 总结本卡关联数据。正文、生成、缓存和导出复用同一 aiSummary；文字不进入分析输入。其他准入及嵌套规则不变。示例：[`report-ai-summary-regions`](../examples/report-ai-summary-regions.json)。

## 筛选工具栏（6.63）

`props.filterLayout:"toolbar"` 将开头连续的 filterGroup 排入卡顶工具栏：align:left（默认）靠左，align:right 作为一个紧凑组整体居右，组内间距 12px；短选项下拉使用现有 160px 控件宽度。宽度不足时先让右组整体换行，组内仅在自身也容纳不下时换行，保持右对齐。此时这些筛选组件的 span 不分配工具栏内部比例；它们仍分别拥有 filterId、候选、状态和查询绑定。遇到第一个非 filterGroup 后结束提取，其后所有组件仍沿用原栅格顺序、span 与分隔线。没有显式声明时保持原布局。

示例 `/pages/filter-group-parallel-selects`：左侧一个指标按钮组，右侧区域、渠道两个下拉；内容为趋势图与合计。只读和导出复用原筛选组件的禁用与选中标签投影。

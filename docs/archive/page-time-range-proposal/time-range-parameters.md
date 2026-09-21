# 显式时间区间参数：建议结构

状态：已讨论的结构提案，尚未实现。当前协议不能接受本文的 `timeRange` 参数；落地时应新增协议能力版本。`PAGE-PARAMETERS.md` 是已实现能力的正式入口。

## 目的

保存「某天至某天」「某月至某月」两个显式端点。与单点 `time` 参数通过窗口推导范围并列；区间作为一个完整输入，避免开始和结束分别缺省而拼出意外范围。

## 参数结构

日期区间：

```json
{
  "id": "analysis-range",
  "type": "timeRange",
  "granularity": "date",
  "required": true,
  "default": { "start": "2026-09-03", "end": "2026-09-15" }
}
```

月份区间：

```json
{
  "id": "analysis-range",
  "type": "timeRange",
  "granularity": "month",
  "required": true,
  "default": { "start": "2025-11", "end": "2026-03" }
}
```

`label` 可选。`default` 可省略，由初始化输入提供整个区间。`granularity` 描述输入精度，不决定指标统计周期或刷新频率。

## 查询绑定

```json
{
  "paramBindings": {
    "analysis-range": { "target": "time" }
  }
}
```

区间已提供完整起止，不再声明 `window`。运行时将两端写入查询副本的 `filter.time.start/end`，保留查询粒度与聚合设置，不修改保存的默认值。

## 第一版建议规则

- 两端必填、精度一致、合法日历值，开始不晚于结束；允许相等、跨月与跨年。
- 月份格式YYYY-MM，日期格式YYYY-MM-DD；起止均包含。
- 暂不支持单边开放区间，不读取系统当前时间，不截断或回退到最新可用期。
- 非法显式输入阻止初始化，不回退默认区间。默认值应作为整体使用。
- 同一查询的时间只由一个参数控制，不与静态起止或时间筛选器竞争。
- 查询绑定要求必需参数；首版延续月输入匹配month、日输入匹配day的查询粒度约束。
- 范围不自动改变指标口径，不自动求和、计算同比或选择历史预测版本。

## 实施前仍需确定

URL如何编码一个区间、文本引用如何展示区间、执行回执与跨页导航如何承载区间值。JSON结构确认不代表这些运行时协议已确定。

## 与现行窗口的关系

`time + yearToDate/monthToDate/lastN/period`：输入一个基准期，由规则推导起止。

`timeRange`：输入明确起止，直接用于查询。本提案不替代现行窗口。

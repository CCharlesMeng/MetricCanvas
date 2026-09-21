# 显式时间区间参数提案（2026-09-16，已被取代）

## 这批做了什么

一份结构提案：给页面参数加一个 `timeRange` 分支，用「某天至某天」「某月至某月」两个显式端点表达区间，与单点 `time` 参数通过窗口推导范围并列。动机是避免开始和结束分别缺省时拼出意外范围。

## 结论落在哪

**提案没有按原样落地。** 同一个需求由 **Schema 6.6 的分组参数**解决：`params.dimensions/times/scalars` 分组声明，多组时间按 ID 独立引用，实际值用 `dim_value_list`、`start/end`、`value` 表达。

现行入口是 [`PAGE-PARAMETERS.md`](../../../PAGE-PARAMETERS.md)（`#66-分组参数新页面` 段），已实现方案的完整字段与兼容规则见 [`docs/plan/2026-09-20-grouped-page-params.md`](../../plan/2026-09-20-grouped-page-params.md)。

`PAGE-PARAMETERS.md` 正文两处明确写了：**本提案不属于现行协议**，只作历史讨论。

## 被推翻的是什么

提案自己写的前提「当前协议不能接受本文的 `timeRange` 参数，落地时应新增协议能力版本」是对的，但落地形态换了——不是加一个 `timeRange` 参数类型，而是把整个 `params` 按维度/时间/标量重新分组。旧数组形态的 `time` 仍为单值，兼容语义保留在 `PAGE-PARAMETERS.md` 里。

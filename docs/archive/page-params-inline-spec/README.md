# 页面参数原位引用与模板化 Spec（2026-09-17）

2026-09-17 提出「模板与真实页面共用同一份 Page 文档、参数在取值位置原位引用」的方案，配套 P1–P7 执行计划与一份验收用例。**计划一个任务都没开工，参数声明的形状先后被换了两次。** 2026-09-21 归档。

## 最终生效的结论落在哪

**产品边界那一半活下来了**：模板与实例是同一份 Page 文档，不引入第二份 Schema、不做 PageTemplate 包装或资产附属映射。这条由 [ADR-0078](../../adr/0078-dimension-values-templates-and-page-instances.md) 承载，今天仍然成立。

**参数声明的形状那一半被替代了**：页面协议 6.6 的分组参数（`params.dimensions/times/scalars`）取代了本 Spec 的参数数组与 `timeRange.value`。形状真源是 [`PAGE-PARAMETERS.md`](../../../PAGE-PARAMETERS.md)，演进脉络见 [数据获取与查询模型](../../adr/topics/data-fetching-and-query-model.md)。

## 被推翻的方向与推翻它的依据

- **参数数组 + `timeRange.value`**：6.6 的分组声明认为「多个独立期间」需要按 id 独立引用，本 Spec 的单一数组表达不了。6.6 落地后复盘又发现「多个独立期间」与「由基准点派生窗口」被切成了互斥两条路，这是 `docs/plan/2026-09-21-page-params-orthogonal-shape.md` 正交化提案的起因——**同一处形状被改了两轮，本 Spec 是第一轮的输入而不是结论。**
- **P7「保留不能安全迁移的页面」**：正交化提案 A 下不再存在这类页面，该任务的前提消失。

## 里面有什么

Spec 正文、P1–P7 执行计划（`tasks.md`）、验收用例（`acceptance.md`，标注「计划用例，未执行」）。读它们只为追「当时为什么这么设计」，不要当成待办清单。

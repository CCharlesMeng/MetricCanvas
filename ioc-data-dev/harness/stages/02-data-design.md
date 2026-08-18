---
stage: data-design
activity: act.data-design
skill: ioc-data-design
card: 02-data-design.md
produces: [feature-delta-indicator.md v1 回填]
requires_gates: []
next: ads-design
---

# 02 · Data Design(数据设计)

## 目的
SE 裁定指标逻辑来源,回填 indicator v1。

## 产出
- `feature-delta-indicator.md` — 回填 v1:逻辑来源引用、已/不支持维度、来源类型(SE 裁定)

## Definition of Done
- [ ] 每个指标有逻辑来源引用(不要求 ADS 表/字段名)
- [ ] v1 列由 ioc-data-design 写入(CORE-AX6 写权限)
- [ ] 先查 `knowledge-base/` 基线(CORE-AX4)

## 出口门禁
- 置位 `data_design = pass` → 放行 `ads-design`

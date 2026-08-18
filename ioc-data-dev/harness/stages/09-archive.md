---
stage: archive
activity: act.archive
skill: sdd-archive-workspace
card: 09-archive.md
produces: [archive-summary.md, baseline-update.md]
requires_gates: [sql_promotion, platform_formal]
next: null
---

# 09 · Archive(归档)

## 目的
归档交付物,回写 knowledge-base 基线。

## 产出(CTR-ARC-*)
- `archive-summary.md` — 归档摘要
- `baseline-update.md` — 基线增量登记

## Definition of Done
- [ ] 交付物清单齐全(见模板)
- [ ] 基线增量已合并(CORE-AX4):特性树 ADDED/MODIFIED、维度注册、指标索引
- [ ] evidence-index.md 更新
- [ ] 门禁终态:sql_validation_static/test_execution/platform_test/sql_promotion = pass

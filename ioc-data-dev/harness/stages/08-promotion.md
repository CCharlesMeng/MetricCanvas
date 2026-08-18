---
stage: promotion
activity: act.promotion
skill: sql-generator
card: 08-promotion.md
produces: [hql/*.sql]
requires_gates: [test_execution, platform_test, sql_validation_static]
next: [job-create(FORMAL), platform-formal]
---

# 08 · Promotion(正式脚本)

## 目的
基于验证通过的测试态 SQL,生成正式脚本(库名/表名/分区还原)。

## 产出(CTR-SQL-002)
- `hql/*.sql` — 正式 SQL(正式库/正式表名)

## Definition of Done
- [ ] 测试态→正式态差异清单(库名/表名/分区)完整
- [ ] 结构校验全部 PASS(validate_*.py)
- [ ] `sql_promotion = pass` → 放行 `job-create(FORMAL)` / `platform-formal`

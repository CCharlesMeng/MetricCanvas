---
stage: sql-validation
activity: act.sql-validation
skill: sql-validator
card: 07-sql-validation.md
produces: [mock-data-plan.md, validation-report.md]
requires_gates: [sql_validation_static]
next: job-create
---

# 07 · SQL Validation(SQL 验证)

## 目的
Mock 数据试算 + 静态校验,产出验证报告(等级 L1/L2/L3)。

## 产出
- `mock-data-plan.md` — Mock 数据方案(前置:delta-design-ads + sql-test + GWT验收)
- `validation-report.md` — 验证报告

## Definition of Done
- [ ] 结构校验全部 PASS(validate_*.py)
- [ ] 等级 ≥ **L2**(Mock 试算通过)才能进入 job-create(TEST)
- [ ] P0 问题 closed 或挂起澄清
- [ ] `sql_validation_static = pass` → 放行 `job-create(TEST)` / `platform-test`

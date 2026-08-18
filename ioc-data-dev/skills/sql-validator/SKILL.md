---
name: sql-validator
description: IOC SQL 验证(sql-validation):产出 mock-data-plan.md 与 validation-report.md,运行结构校验与 Mock 试算,判定产物等级 L1/L2/L3(≥L2 才能进 job-create TEST)。Use when 需要验证生成的测试 SQL、写 mock 数据方案、判定 validation-report 等级、或修复验证失败项。
---

# sql-validator — SQL 验证

## 输入

- `hql_test/*_test.sql`(sql-generator 产出)
- `delta-design-ads.md`(设计)
- `GWT验收.md`(场景)

## 产出

1. **mock-data-plan.md** — Mock 策略:每张来源表的行数/生成方式/覆盖 GWT 场景;必须覆盖边界(分母 0、active NULL/reserved 恒 NULL、多区域站点)。
2. **validation-report.md** — 逐 SQL 结果(结构/ETL/领域模式/列引用/试算)+ 问题处置 + **产物等级**。

## 产物等级(deliverable_level)

- L1 = 结构合规(全部 validate_*.py PASS)
- L2 = L1 + Mock 试算通过(**进入 job-create(TEST) 的最低要求**)
- L3 = L2 + 业务口径核验(GWT 对照)

## 执行

1. `ioc_validate(validator=sql-ddl|sql-etl|domain-patterns, path=<hql_test>)`
2. 写 mock-data-plan.md
3. 试算(工作平台或本地执行)→ 填 validation-report.md
4. 判定等级 → `ioc_validate(validator=deliverable-level, path=<report>, min=L2)`
5. 置位 `sql_validation_static = pass` → 放行 job-create(TEST)/platform-test

## 修复闭环

- P0 问题:closed 或挂起澄清;未闭环不得 pass(POL-DESIGN-010)。
- 试算失败 → 回 sql-generate 修复 → 重新验证。

# validation-report.md — SQL 验证报告(CTR-VAL-002)
# 前置:mock-data-plan.md + sql-test;产出:validation-report.md(等级 L1/L2/L3)

## 1. 验证范围

| 项 | 值 |
|----|-----|
| SQL 文件 | {hql_test/*.sql 清单} |
| 目标库 | bi_test / cbc_test |
| Mock 数据 | {mock-data-plan.md 引用} |

## 2. 验证结果

| SQL | 结构校验 | ETL 模式 | 领域模式 | 列引用 | 试算结果 | 结论 |
|-----|----------|----------|----------|--------|----------|------|
| {file} | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | {行数/错误} | PASS/FAIL |

## 3. 产物等级(deliverable_level.py)

- L1: 结构合规(所有 validate_*.py PASS)
- L2: L1 + Mock 数据试算通过
- L3: L2 + 业务口径核验(GWT 对照)通过

**本报告等级: {L1/L2/L3}** — job-create(TEST) 要求 ≥ L2。

## 4. 问题与处置

| # | 问题 | 严重度 | 处置 | 状态 |
|---|------|--------|------|------|
| 1 | {问题} | P0/P1/P2 | {修复/澄清/豁免} | open/closed |

## 5. 门禁置位

- sql_validation_static: pass / fail(由本报告结论驱动)

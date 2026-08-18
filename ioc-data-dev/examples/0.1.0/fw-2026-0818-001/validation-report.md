# validation-report.md — SQL 验证报告(示例)

## 1. 验证范围

| 项 | 值 |
|----|-----|
| SQL 文件 | hql_test/ads_dm_customer_active_m_0818_ads_db_marketing_test.sql |
| 目标库 | bi_test(hive) |
| Mock 数据 | mock-data-plan.md |

## 2. 验证结果

| SQL | 结构校验 | ETL 模式 | 领域模式 | 列引用 | 试算结果 | 结论 |
|-----|----------|----------|----------|--------|----------|------|
| ads_dm_customer_active_m_0818_ads_db_marketing_test.sql | PASS | PASS | PASS | PASS | 128 行 | PASS |

## 3. 产物等级

**本报告等级: L2**(L1 结构合规 + Mock 试算通过)

## 4. 问题与处置

| # | 问题 | 严重度 | 处置 | 状态 |
|---|------|--------|------|------|
| 1 | 无 | — | — | — |

## 5. 门禁置位

- sql_validation_static: pass

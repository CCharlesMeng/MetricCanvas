---
stage: sql-generate
activity: act.sql-generate
skill: sql-generator
card: 06-sql-generate.md
produces: [hql_test/*_test.sql]
requires_gates: [ads_design_validation, clouddevops_review, sql_bindings_ready]
next: sql-validation
---

# 06 · SQL Generate(测试态 SQL 生成)

## 目的
按绑定契约生成测试态 SQL(DDL + ETL),目标库 `bi_test`(hive)/ `cbc_test`(dli)。

## 产出(CTR-SQL-001)
- `hql_test/*_test.sql`

## 硬性约束(POL-SQL-*)
- 测试态表名 `{原始表名}*_{MMDD}_*{原始库名}`(POL-SQL-DDL-009)
- DDL 含固定 ORC SerDe(hive;DLI 豁免,POL-SQL-DDL-001)
- CREATE 前 DROP TABLE IF EXISTS(POL-SQL-DDL-005)
- CTE 先于 INSERT;INSERT OVERWRITE 分区表显式 PARTITION(POL-SQL-ETL-002/003)
- 先过滤→JOIN→聚合(POL-SQL-ETL-007);禁止 SELECT *(POL-SQL-QRY-005)

## Definition of Done
- [ ] 生成后立即跑 `validate_sql_ddl.py` / `validate_sql_etl_patterns.py` / `validate_domain_patterns.py` / `validate_sql_column_refs.py`
- [ ] 全部 PASS(结构)后方可进入验证阶段

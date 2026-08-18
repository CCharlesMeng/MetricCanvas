---
name: sql-generator
description: IOC SQL 生成(sql-bindings-ready / sql-generate / promotion):基于绑定契约生成测试态与正式态 SQL(DDL+ETL),遵守 POL-SQL-DDL/ETL/QRY 与引擎分支(HIVE/DLI)。Use when 需要写 sql-source-bindings.yaml、生成 hql_test 测试 SQL、或 promotion 阶段生成正式 hql SQL。
---

# sql-generator — SQL 生成

## 阶段链路

1. **sql-bindings-ready**:产出 `sql-source-bindings.yaml`(source_table/target_table/filter/engine)+ `table-schema.json`(由 clouddp-cli 列信息构建,CORE-AX3)。
2. **sql-generate**:产出 `hql_test/*_test.sql`(目标库 bi_test/cbc_test)。
3. **promotion**:产出 `hql/*.sql`(正式库/表名还原)。

## 硬性约束(POL-SQL-*)

**DDL**
- CREATE 前 DROP TABLE IF EXISTS(POL-SQL-DDL-005)
- 测试态表名 `{原始表名}*_{MMDD}_*{原始库名}`(POL-SQL-DDL-009)
- HIVE 含固定 ORC SerDe;DLI 完全省略(POL-SQL-DDL-001 / POL-REV-PLATFORM-003)
- 字段顺序与设计文档一致(POL-SQL-DDL-006);分区表加列 CASCADE(POL-SQL-DDL-007)

**ETL**
- CTE(WITH)先于 INSERT(POL-SQL-ETL-002)
- INSERT OVERWRITE 分区表显式 PARTITION(POL-SQL-ETL-003)
- 先过滤→再 JOIN→再聚合(POL-SQL-ETL-007)
- 聚合内部先 COALESCE(POL-SQL-ETL-009);率值分母 0 → NULL(POL-SQL-ETL-006)

**Query**
- 表别名有意义,禁止 t1/t2(POL-SQL-QRY-001);字段引用带表别名(POL-SQL-QRY-002)
- 禁止 SELECT *;嵌套 ≤ 3 层(POL-SQL-QRY-005)

**领域模式(KW-AX5)**
- 来源表必选过滤:汇率维表 Corporate+昨日、CDH 客户 valid_flag=1、global 表 data_site_type 等(见 domain-source-patterns.yaml)

## 生成后

- 立即跑 `ioc_validate`:
  - `validator=sql-ddl, path=<sql>, engine=<hive|dli>, test=true`
  - `validator=sql-etl, path=<sql>`
  - `validator=domain-patterns, path=<sql>`
- 全部 PASS 才能进入 sql-validation。

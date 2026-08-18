# mock-data-plan.md — Mock 数据方案(CTR-VAL-001)
# 前置:delta-design-ads.md + hql_test/*_test.sql + GWT验收.md

## 1. Mock 策略

| 表 | 来源分层 | 行数 | 生成方式 | 覆盖场景(GWT) |
|----|----------|------|----------|----------------|
| {dwd_t_xxx} | DWD | {n} | {手工/脚本/抽样} | {GWT-01, GWT-02} |

## 2. 边界数据

- 分母为 0 的率值(POL-SQL-ETL-006)
- active 列 NULL / reserved 恒 NULL(POL-SQL-ETL-005)
- 多区域站点(china / oversea / europe,PAT-DOM-SITE-001)

## 3. Mock 数据文件

- {path/to/mock.csv} — 说明

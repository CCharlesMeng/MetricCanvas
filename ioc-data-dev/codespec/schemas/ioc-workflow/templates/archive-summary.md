# archive-summary.md — 归档摘要(CTR-ARC-001)

## 1. 归档范围

| 项 | 值 |
|----|-----|
| feature_id | {feature-id} |
| version | {version} |
| 主路径 | data / subject |
| engine | hive / dli |

## 2. 交付物清单

- [ ] proposal-fe.md
- [ ] feature-delta-spec.md
- [ ] feature-delta-acceptance.md
- [ ] feature-delta-indicator.md(v2/v3 回填)
- [ ] GWT验收.md
- [ ] delta-design-ads.md
- [ ] ads-design-validation-report.md
- [ ] sql-source-bindings.yaml
- [ ] table-schema.json
- [ ] hql_test/*_test.sql
- [ ] mock-data-plan.md
- [ ] validation-report.md
- [ ] hql/*.sql
- [ ] 作业(工作平台 TEST/FORMAL)

## 3. 门禁终态

| gate | 终态 |
|------|------|
| sql_validation_static | pass |
| test_execution | pass |
| platform_test | pass |
| sql_promotion | pass |
| platform_formal | pass(建议) |

## 4. 知识回写

- baseline-update.md 记录对 knowledge-base 的增量(特性树 ADDED/MODIFIED、维度注册、指标索引)。

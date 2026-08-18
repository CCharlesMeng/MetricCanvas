# contracts-index.md — 契约产物索引(Published Language)

> 位置:`codespec/guidelines/ioc-kernel/contracts-index.md`
> 规则:契约是阶段交接的语言。结构变更必须同步模板(`codespec/schemas/ioc-workflow/templates/`)与工具(`harness/tools/`)。

## 1. 三层分界(+ Asset-Delta)

| 层级 | Core 类 | 说明 |
|------|---------|------|
| Deliverable (D) | Deliverable | 阶段交接的正式发布物;结构变更须同步模板与工具 |
| Evidence (E) | Evidence | 可重复生成的快照;缺失降低置信度 |
| Governance (G) | Feature + Gate | manifest/Packet/evidence-index |
| Asset-Delta (A) | DataAsset | 基线增量登记,交付前须合并 |

## 2. 核心契约

| contract_id | path | tier | 产出 activity |
|-------------|------|------|--------------|
| CTR-GOV-001 | change-manifest.yaml | G | act.intake |
| CTR-GOV-002 | packets/change-packet.md | G | 全部 |
| CTR-GOV-003 | evidence-index.md | G | act.intake |
| CTR-PRD-001 | proposal-fe.md | D | act.prd |
| CTR-PRD-002 | feature-delta-spec.md | D | act.prd |
| CTR-PRD-003 | feature-delta-acceptance.md | D | act.prd |
| CTR-PRD-004 | feature-delta-indicator.md | D | act.prd(v0)→act.data-design(v1)→act.ads-design(v2)→act.service-design(v3) |
| CTR-PRD-005 | GWT验收.md | D | act.prd |
| CTR-DES-001 | delta-design-ads.md | D | act.ads-design |
| CTR-DES-002 | ads-design-validation-report.md | D | act.ads-validate |
| CTR-BIND-001 | sql-source-bindings.yaml | D | act.sql-bindings |
| CTR-BIND-002 | table-schema.json | D | act.sql-bindings |
| CTR-SQL-001 | hql_test/*_test.sql | D | act.sql-generate |
| CTR-SQL-002 | hql/*.sql | D | act.promotion |
| CTR-ARC-001 | archive-summary.md | D | act.archive |
| CTR-ARC-002 | baseline-update.md | D | act.archive |

## 3. 支持性契约(Evidence)

| path | 说明 |
|------|------|
| evidence/schema_*.json | clouddp-cli 表结构证据 |
| evidence/metric_ZB*.json | 指标证据 |
| evidence/lineage-draft.yaml | 血缘草稿 |
| evidence/etl-sql/*.sql | ETL 血缘 SQL 证据 |
| evidence/**-receipt.json | 工具执行回执 |
| evidence/**-service-evidence.json | 服务证据 |
| data-tree-changes/evidence/schema_*.json | DataTree 变更证据 |

## 4. 契约变更纪律

- **Deliverable 结构变更** → 必须同步更新模板 + 校验器 + 本文档(三者原子提交)。
- **Evidence 缺失** → 降低置信度,不得作为 Deliverable 的替代。
- **Asset-Delta** → 交付(archive)前必须合并进基线。

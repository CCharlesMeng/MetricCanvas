---
name: sdd-archive-workspace
description: IOC archive 归档(sdd-archive-workspace):产出 archive-summary.md 与 baseline-update.md,核对交付物与门禁终态,回写 knowledge-base(特性树/维度注册/指标索引)。Use when 数据开发链路进入 archive 阶段、需要归档交付物或回写知识基线。
---

# sdd-archive-workspace — 归档

## 输入

- 全部交付物(PRD/设计/绑定/SQL/验证报告/作业)
- 门禁终态(sql_validation_static/test_execution/platform_test/sql_promotion = pass;platform_formal 建议 pass)

## 产出(CTR-ARC-*)

1. **archive-summary.md** — 归档范围、交付物清单、门禁终态(模板: codespec/schemas/ioc-workflow/templates/archive-summary.md)
2. **baseline-update.md** — 基线增量登记(模板: .../templates/baseline-update.md)

## 知识回写(CORE-AX4)

- **特性树**: `knowledge-base/feature-tree/feature-tree.yaml` ADDED/MODIFIED 节点
- **维度注册**: 新增维度 → `knowledge-base/architecture/dimension/dimension-registry.yaml`
- **指标索引**: 新指标 → `knowledge-base/ontology/hwcloud_marketing/catalog.yml`
- **语义模型**: 新模型 → `knowledge-base/ontology/hwcloud_marketing/models/`
- 更新 `evidence-index.md`

## 完成条件

- 交付物清单全勾选;基线增量已合并;门禁终态确认。
- 归档完成 → 整个 feature 链路闭环。

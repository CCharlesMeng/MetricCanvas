---
name: ioc-ads-design
description: IOC ads-design 阶段(act.ads-design):基于 5 个 PRD 产物设计 ADS 表,产出 delta-design-ads.md,回填 indicator v2(ADS 表名/字段名/消费数据源/绑定状态),遵守 KW-AX8 分层与 POL-DESIGN 命名约束。Use when 需要设计 ADS 增量表、写 delta-design-ads.md、回填指标 v2、或设计被门禁打回需修复。
---

# ioc-ads-design — ADS 增量设计

## 输入(5 个 PRD 产物,缺一不可)

proposal-fe.md · feature-delta-spec.md · feature-delta-acceptance.md · feature-delta-indicator.md · GWT验收.md

## 产出

1. `delta-design-ads.md`(模板: codespec/schemas/ioc-workflow/templates/delta-design-ads.md)
2. `feature-delta-indicator.md` **v2 回填**(ADS 表名/字段名/消费数据源/绑定状态)

## 硬性约束

- **分层**(KW-AX8 / POL-DESIGN-001):ADS 只可消费 DWD/DWS/DM/DIM,禁止 SDI/ODS。
- **库名**:从 actual_schemas 枚举选择(POL-DESIGN-002)。
- **表名**:符合 `ads_dm` pattern(POL-DESIGN-003);地图类带 `map_` 前缀(POL-DESIGN-007)。
- **维度列**:来自一致性维度注册表(POL-DESIGN-004)。
- **复用**:ads_reuse 跨 FE 须授权记录(POL-DESIGN-008)。
- **来源统一**:同一区域 table 字段来源统一(POL-DESIGN-009)。

## 流程

1. 读 5 个 PRD 产物与 knowledge-base(ontology 六层规则 + dimension-registry)
2. 设计每张 ADS 表(库/表/粒度/字段/来源)
3. 回填 indicator v2
4. 跑 `ioc_validate(validator=lifecycle-columns, path=<indicator>)`
5. 进入 ads-design-validation 阶段(ioc-ads-design-validate 职责)

## 澄清联动

设计校验产生澄清项时,由 ioc-clarification skill 走闭环;P0 open 时 `ads_clarification_applied` 不得 pass(POL-DESIGN-010)。

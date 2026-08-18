---
name: ioc-data-design
description: IOC data-design 阶段(act.data-design):SE 裁定指标逻辑来源,回填 feature-delta-indicator.md v1(逻辑来源引用/已支持维度/不支持维度/来源类型)。Use when 指标盘点需从 v0 推进到 v1、裁定指标逻辑来源、或数据设计阶段澄清来源类型。
---

# ioc-data-design — 数据设计

## 输入

- `feature-delta-indicator.md`(v0 盘点,来自 sdd-prd)
- `knowledge-base/` 基线(CORE-AX4:先查后写)

## 产出

回填 indicator **v1** 列(仅以下列,写权限矩阵见 indicator-lifecycle.md):

| 列 | 内容 | 裁定者 |
|----|------|--------|
| 逻辑来源引用 | 数据来自哪张逻辑表/逻辑口径 | SE 裁定 |
| 已支持维度 | 指标可下钻维度 | SE |
| 不支持维度 | 明确不支持的维度 | SE |
| 来源类型 | 由「待确认」改为实际类型 | SE |

## 约束

- v1 **不要求** ADS 表名/字段名(那是 v2 的职权);禁止提前编造。
- 遇到基线冲突 → 停工,写入 change-packet(CORE-AX5)。
- 写列名/表名必须从磁盘 evidence 重读(CORE-AX3)。

## 完成条件

- 全部指标 v1 回填完成 → 置位 `data_design = pass`(由本 skill 完成)→ 过 `ioc_stage_gate` 进入 ads-design。

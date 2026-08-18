# core-ontology.md — IOC 数据开发核心本体与公理

> 位置:`codespec/guidelines/ioc-kernel/core-ontology.md`(MetaSpec 单向约束源)
> 规则:本文档是 CORE-AX*/KW-AX* 公理与 15 个顶层类的唯一真源。任何其它文件不得定义与其冲突的公理。

## 1. 顶层类(15 个)

| # | 顶层类 | 说明 | 真源位置 |
|---|--------|------|----------|
| 1 | Feature | 增量需求单元 | `codespec/changes/{version}/{feature-id}/` |
| 2 | Change | 一次变更(多仓粒度) | `change-manifest.yaml` |
| 3 | Artifact | 阶段产物(契约承载) | `contracts-index.md` |
| 4 | Contract | 契约(层级见 contracts-index) | `contracts-index.md` |
| 5 | Activity | 流程活动(act.*) | `activities-registry.yaml` |
| 6 | Stage | 流程阶段 | `schema.yaml` main_paths |
| 7 | Gate | 门禁(5 类) | `gates-glossary.md` |
| 8 | Indicator | 指标(生命周期 v0→v3) | `references/indicator-lifecycle.md` |
| 9 | Evidence | 证据(可重复生成快照) | `evidence/` |
| 10 | DataAsset | 数据资产(基线增量登记) | `knowledge-base/` |
| 11 | Table | 物理表(分层:ODS/SDI/DWD/DWS/DM/DIM/ADS) | `knowledge-base/ontology/` |
| 12 | Dimension | 一致性维度 | `knowledge-base/ontology/shared-dimensions.yml` |
| 13 | Policy | 策略(POL-*) | `policies-index.yaml` |
| 14 | DomainPattern | 领域模式(PAT-DOM-*) | `domain-patterns-index.yaml` |
| 15 | Skill | 可调度技能(白名单) | `schema.yaml` skills |

## 2. 核心公理(CORE-AX*)

| 公理 | 名称 | 约束 | 违反后果 |
|------|------|------|----------|
| CORE-AX1 | 语义一致 | 结论必须与 evidence 语义一致 | 停工 |
| CORE-AX3 | 从磁盘读 | 写入列名/表名时必须从磁盘重读 evidence | 停工 |
| CORE-AX4 | 唯一真源优先 | 维表、指标、数据设计约束必须先查基线 | 停工 |
| CORE-AX5 | 基线冲突即停工 | 遇到唯一真源冲突立即停止,写入 Packet | 停工 |
| CORE-AX6 | 指标生命周期 | v0→v1→v2→v3 列定义与写权限 | 校验拦截 |
| CORE-AX8 | 澄清须人工 | 澄清项 answered/closed 只能由人类裁定 | 停工 |
| CORE-AX9 | Fail-Closed | stage gate BLOCKED 即停工 | 停工 |
| CORE-AX10 | 工具失败即停工 | required_tools 失败时禁止落盘 evidence | 停工 |

> 说明:CORE-AX2/CORE-AX7 未在 v1.0 文档中出现,编号保留不占位。

## 3. Kimball 数仓公理(KW-AX*)

| 公理 | 约束 |
|------|------|
| KW-AX3 | ETL 模式(CTE 先于 INSERT、分区显式等) |
| KW-AX5 | 领域模式(来源表必选过滤) |
| KW-AX7 | 区域来源一致性(同一区域 table 字段来源统一) |
| KW-AX8 | 语义层消费(分层约束:ADS 禁止消费 SDI/ODS) |

## 4. 语义层分层(KW-AX8 引用)

```
ODS → SDI → DWD → DWS → DM/DIM → ADS
                    ↑
               ADS 禁止消费 SDI/ODS(BLOCKED)
               ADS 可从 DWD/DWS/DM/DIM 取数
               DWS 可从 DWD/ODS 取数
```

六层调用规则的完整机读定义见 `knowledge-base/ontology/ontology-layers.yaml`。

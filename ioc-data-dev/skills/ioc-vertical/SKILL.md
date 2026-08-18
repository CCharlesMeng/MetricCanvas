---
name: ioc-vertical
description: IOC 数据开发垂直领域总纲:主流程(15/13 阶段)、并行轨道、CORE-AX 公理、五类门禁、POL-* 策略、指标生命周期、四仓契约。Use when 开始任何 IOC 数据开发任务、判断当前阶段、确认纪律/公理/策略、或不确定某产物/门禁归属。
---

# IOC 数据开发垂直领域(ioc-vertical)

## 主流程

- **data 主路径(15 阶段)**: intake → requirement → data-design → ads-design → ads-design-validation → ads-clarification-apply → clouddevops-review → sql-bindings-ready → sql-generate → sql-validation → job-create(TEST) → platform-test → promotion → job-create(FORMAL) → platform-formal → archive
- **subject 主路径(13 阶段)**: requirement → subject-design → subject-design-validation → subject-clarification-apply → subject-sql-bindings-ready → sql-generate → sql-validation → job-create → platform-test → promotion → platform-formal → archive
- **并行轨道**(ads-design-validation 后): service 三件套(service-design → service-develop → frontend-plan)+ 测试三件套(test-analyzer → testpoint-analyzer → testcase-designer)

## 核心公理(CORE-AX*,不可违反)

| 公理 | 约束 |
|------|------|
| CORE-AX1 | 结论必须与 evidence 语义一致 |
| CORE-AX3 | 写列名/表名必须从磁盘重读 evidence |
| CORE-AX4 | 维表/指标/设计约束必须先查 knowledge-base 基线 |
| CORE-AX5 | 基线冲突即停工,写入 Packet |
| CORE-AX6 | 指标生命周期 v0→v1→v2→v3 写权限 |
| CORE-AX8 | 澄清项 answered/closed 只能由人类裁定 |
| CORE-AX9 | 阶段门禁 BLOCKED 即停工;禁止自改 gates.* 绕过 |
| CORE-AX10 | 工具失败禁止落盘 evidence |

## 阶段门禁

- 每阶段推进前调用 `ioc_stage_gate(feature=..., stage=...)`;BLOCKED 即停工。
- 五类门禁:Invariant / Definition of Done / Decision Gate / Handoff Gate / Playbook。
- 12 个 manifest gate 字段见 `codespec/guidelines/ioc-kernel/gates-glossary.md`。

## 关键策略(POL-*)

- ADS 禁止消费 SDI/ODS(POL-DESIGN-001 / KW-AX8);ADS 库名/表名须符合枚举与 pattern(POL-DESIGN-002/003)
- SQL:CTE 先于 INSERT、INSERT OVERWRITE 显式 PARTITION、先过滤→JOIN→聚合、禁止 SELECT *、表别名有意义
- 引擎分离:HIVE(ORC SerDe/CDM 节点/bi_test)/ DLI(豁免/cbc_test,须显式 engine: dli)

## 指标生命周期

v0(sdd-prd,来源=待确认,禁编造)→ v1(ioc-data-design,SE 裁定逻辑来源)→ v2(ioc-ads-design,ADS 绑定)→ v3(ioc-service-design,接口标识)。详见 `codespec/guidelines/ioc-kernel/references/indicator-lifecycle.md`。

## 使用顺序

1. 定位阶段 → 读 `harness/stages/<当前阶段>.md` 薄卡片
2. 跑 `ioc_stage_gate` 确认可进入
3. 查 `knowledge-base/`(CORE-AX4)
4. 执行对应 skill(ioc-data-design / ioc-ads-design / sql-generator / sql-validator …)
5. 写产物后跑 `ioc_validate` 结构校验;退出阶段前再过门禁

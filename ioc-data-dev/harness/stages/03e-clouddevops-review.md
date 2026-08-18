---
stage: clouddevops-review
activity: act.clouddevops-review
skill: sdd-clouddevops-update
card: 03e-clouddevops-review.md
produces: [clouddevops-review-report.md]
requires_gates: []
next: sql-bindings-ready
---

# 03e · CloudDevOps Review(云上资源评审)

## 目的
评审 ADS 表在云上平台(库/表/权限/CDM 节点)的落地可行性。

## 产出
- `clouddevops-review-report.md`

## Definition of Done
- [ ] 库/表在目标平台可用(库名来自 actual_schemas,POL-DESIGN-002)
- [ ] HIVE 引擎确认 CDM 节点/ORC SerDe;DLI 引擎确认豁免(POL-REV-PLATFORM-003)
- [ ] `clouddevops_review = pass` → 放行 `sql-bindings-ready`

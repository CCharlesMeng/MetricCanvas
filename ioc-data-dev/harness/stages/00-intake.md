---
stage: intake
activity: act.intake
skill: null
card: 00-intake.md
produces: [.codespec.yaml, change-manifest.yaml]
next: requirement
---

# 00 · Intake(变更接入)

## 目的
建立 Feature 工作目录与治理骨架,声明 schema 与 engine。

## 产出
- `.codespec.yaml` — schema 声明(`ioc-workflow`)
- `change-manifest.yaml` — 治理清单(gates.* 全部 not_started)

## Definition of Done
- [ ] feature 目录位于 `codespec/changes/{version}/{feature-id}/`
- [ ] manifest 含 feature_id / version / engine(hive|dli)
- [ ] 未置位任何 gate

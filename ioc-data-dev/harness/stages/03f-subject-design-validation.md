---
stage: subject-design-validation
activity: act.subject-design-validate
skill: ioc-subject-design-validate
card: 03f-subject-design-validation.md
produces: [subject-design-validation-report.md]
next: subject-clarification-apply
---

# 03f · Subject Design Validation(专题设计校验)

## 目的
机器校验 subject-design.md。

## 产出
- `subject-design-validation-report.md`

## 校验项
- `validate_subject_design.py`、`validate_subject_template.py`、`validate_indicator_source_binding.py`

## Definition of Done
- [ ] 结构校验全部 PASS;FAIL 有处置
- [ ] `ads_design_validation = pass/fail` 驱动下游

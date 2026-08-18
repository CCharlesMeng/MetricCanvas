---
stage: ads-clarification-apply
activity: act.ads-clarification-apply
skill: ioc-ads-design
card: 03c-ads-clarification-apply.md
produces: [澄清回写 ADS]
requires_gates: []
next: clouddevops-review
---

# 03c · ADS Clarification Apply(澄清闭环回写)

## 目的
把 ads-design-validation 产生的澄清项回写到 ADS 设计,直至 P0 全部 resolved。

## 规则(CORE-AX8)
- 澄清项 `answered`/`closed` 只能由人类裁定,AI 不得 closed P0(`validate_ads_clarification.py`)
- P0 open 时 `ads_clarification_applied` 不得 pass(POL-DESIGN-010),阻塞各阶段

## Definition of Done
- [ ] 所有 P0 澄清项 resolved 且回写 delta-design-ads.md
- [ ] `ads_clarification_applied = pass`

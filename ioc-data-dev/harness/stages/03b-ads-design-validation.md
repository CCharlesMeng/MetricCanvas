---
stage: ads-design-validation
activity: act.ads-validate
skill: ioc-ads-design-validate
card: 03b-ads-design-validation.md
produces: [ads-design-validation-report.md]
requires_gates: []
next: [ads-clarification-apply, clouddevops-review, parallel_tracks]
---

# 03b · ADS Design Validation(ADS 设计校验)

## 目的
对 delta-design-ads.md 做机器校验,产出校验报告。

## 产出
- `ads-design-validation-report.md`

## 校验项
- 结构:`validate_layer_consumption.py`、`validate_ads_table_design.py`、`validate_indicator_ads_binding.py`
- 语义:独立读取 evidence 比对(CORE-AX3)

## Definition of Done
- [ ] 结构校验全部 PASS;FAIL 项有处置
- [ ] 判定 pass / fail;fail 则进入澄清闭环,阻塞下游

## 并行触发
通过后触发并行轨道:service 三件套 + 测试三件套(§schema parallel_tracks)。

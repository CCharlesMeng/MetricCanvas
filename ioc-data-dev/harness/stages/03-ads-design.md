---
stage: ads-design
activity: act.ads-design
skill: ioc-ads-design
card: 03-ads-design.md
produces: [delta-design-ads.md, feature-delta-indicator.md v2 回填]
requires_gates: [data_design]
next: ads-design-validation
---

# 03 · ADS Design(ADS 增量设计)

## 目的
基于 5 个 PRD 产物设计 ADS 表,回填 indicator v2。

## 产出
- `delta-design-ads.md` — ADS 增量设计(引用全部前置产物)
- `feature-delta-indicator.md` — v2 回填(ADS 表名/字段名/消费数据源/绑定状态)

## Definition of Done
- [ ] 引用 5 个 PRD 产物(CTR-DES-001)
- [ ] ADS 库名/表名符合 POL-DESIGN-002/003;地图类带前缀(POL-DESIGN-007)
- [ ] 分层合规:ADS 未消费 SDI/ODS(POL-DESIGN-001 / KW-AX8)
- [ ] 维度列来自一致性维度注册表(POL-DESIGN-004)

## 出口门禁
- 前置:`data_design = pass`(BLOCKED 时停工,CORE-AX9)

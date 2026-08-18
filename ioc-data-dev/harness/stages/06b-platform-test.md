---
stage: platform-test
activity: act.platform-test
skill: null
card: 06b-platform-test.md
produces: [platform-test-execution.md]
requires_gates: [sql_validation_static]
next: promotion
---

# 06b · Platform Test(工作平台试算)

## 目的
在平台执行 TEST 作业,记录试算结果。

## 产出
- `platform-test-execution.md` — 试算执行记录(行数/错误/耗时)

## Definition of Done
- [ ] 试算通过 → `test_execution = pass`、`platform_test = pass`
- [ ] 试算失败 → 回到 sql-validation 修复,禁止带病进入 promotion

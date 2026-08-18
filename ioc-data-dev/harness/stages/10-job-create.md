---
stage: job-create
activity: act.job-create
skill: sdd-job-creator
card: 10-job-create.md
produces: ["TEST/FORMAL zip"]
requires_gates: [sql_validation_static]
next: [platform-test, platform-formal]
---

# 10 · Job Create(作业创建)

## 目的
把 SQL 打包为工作平台作业(TEST 或 FORMAL)。

## 产出
- TEST zip(来源 `hql_test/*_test.sql`)
- FORMAL zip(来源 `hql/*.sql`)

## 决策门(人类拍板,Decision Gate)
- TEST 前置:`sql_validation_static = pass` 且 validation-report ≥ L2
- FORMAL 前置:`sql_promotion = pass`

## 定义
- TEST/FORMAL 切换必须由人类确认;AI 不得代拍板。

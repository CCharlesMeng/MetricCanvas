---
name: ioc-stage-gate
description: IOC 阶段出口门禁执行与解释(CORE-AX9 Fail-Closed):跑 ioc_stage_gate、读 BLOCKED 原因、按 blocks_when 规则修复、禁止自改 manifest gates 绕过。Use when 推进/退出 IOC 阶段、门禁返回 BLOCKED 需要定位阻塞项、检查 change-manifest.yaml 的 gates 置位。
---

# ioc-stage-gate — 阶段门禁

## 执行

```text
ioc_stage_gate(feature=<feature-dir>, stage=<stage-id>)
```

- `feature` = 含 change-manifest.yaml 的目录(如 `codespec/changes/0.1.0/fw-001`)
- `stage` = intake / requirement / data-design / ads-design / ads-design-validation / ads-clarification-apply / clouddevops-review / sql-bindings-ready / sql-generate / sql-validation / job-create / platform-test / promotion / platform-formal / archive(或 subject-* 变体)

## 结果解释

- `PASS` → 允许进入/继续。
- `BLOCKED` → **立即停工**(CORE-AX9 Fail-Closed)。逐条修复阻塞原因,不得跳过。

## blocks_when 三类阻塞

1. **gate 条件**: 目标阶段所需 manifest gate 未置位为 pass(规则见 schema.yaml blocks_when)。
2. **min_level**: 进入 job-create(TEST) 需要 validation-report.md 等级 ≥ L2。
3. **missing_contract**: 进入阶段所需契约产物缺失(如 sql-generate 需 delta-design-ads.md + sql-source-bindings.yaml)。

## 纪律(绝对禁止)

- **禁止自改 change-manifest.yaml 的 gates.\* 绕过门禁**(CORE-AX9;validate_gate_change.py 会拦截非法 gate 值)。
- **禁止伪造产物绕过门禁**(gate=pass 但产物缺失,validate_gate_change.py --strict 拦截)。
- 修复路径:补产物 → 跑 `ioc_validate` → 由置位者 skill 置位 gate → 再过门禁。

## 辅助

- `ioc_validate(validator=gate-change, path=<manifest>)` — 校验 gates 结构合法性。
- `ioc_validate(validator=deliverable-level, path=<validation-report.md>, min=L2)` — 产物等级。

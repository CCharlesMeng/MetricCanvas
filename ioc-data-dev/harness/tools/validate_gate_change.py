#!/usr/bin/env python3
"""validate_gate_change.py — change-manifest.yaml gates.* 校验(CORE-AX9)。

检查:
  - 必备字段(feature_id/version/engine)
  - gates.* 全部为门禁词汇已登记字段,无未登记 gate
  - gate 值合法(not_started/in_progress/pass/fail/waived)
  - --strict: gate=pass 但对应产物缺失 → FAIL(防伪造产物绕过)

用法:
  python validate_gate_change.py <change-manifest.yaml> [--strict] [--feature <feature-dir>]

退出码:0=通过 2=FAIL(BLOCKED) 3=错误
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import (  # noqa: E402
    EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, GATE_VALUES, GATES,
    banner, load_yaml, print_line,
)

# gate → 校验其 pass 时必须存在的产物
GATE_ARTIFACT = {
    'data_design': 'feature-delta-indicator.md',
    'ads_design_validation': 'ads-design-validation-report.md',
    'clouddevops_review': 'clouddevops-review-report.md',
    'sql_bindings_ready': 'sql-source-bindings.yaml',
    'sql_validation_static': 'validation-report.md',
    'sql_promotion': 'hql',
}


def main():
    ap = argparse.ArgumentParser(description='change-manifest gates.* 校验')
    ap.add_argument('manifest', help='change-manifest.yaml 路径')
    ap.add_argument('--strict', action='store_true', help='gate=pass 须有对应产物(防伪造)')
    ap.add_argument('--feature', default=None, help='feature 目录(用于产物存在性检查)')
    args = ap.parse_args()

    banner(f'validate_gate_change :: {args.manifest}')
    if not os.path.isfile(args.manifest):
        print('[FAIL] 文件不存在')
        return EXIT_BLOCKED

    manifest = load_yaml(args.manifest)
    checks = []

    for field in ('feature_id', 'version', 'engine'):
        v = manifest.get(field)
        checks.append((bool(v), f'{field}: {v or "缺失"}'))
    eng = manifest.get('engine')
    if eng and eng not in ('hive', 'dli'):
        checks.append((False, f'engine={eng!r}(须 hive|dli)'))

    gates = manifest.get('gates', {})
    if not isinstance(gates, dict) or not gates:
        checks.append((False, 'gates.* 缺失或为空'))
    else:
        unknown = [g for g in gates if g not in GATES]
        checks.append((not unknown, f'未登记 gate: {unknown or "无"}'))
        illegal = [f'{g}={v}' for g, v in gates.items() if v not in GATE_VALUES]
        checks.append((not illegal, f'非法 gate 值: {illegal or "无"}'))

    if args.strict:
        base = args.feature or os.path.dirname(os.path.abspath(args.manifest))
        for g, rel in GATE_ARTIFACT.items():
            if gates.get(g) == 'pass':
                p = os.path.join(base, rel)
                exists = os.path.isdir(p) if rel == 'hql' else os.path.isfile(p)
                checks.append((exists, f'gate {g}=pass 且产物存在: {rel}(防伪造)'))

    failed = [t for ok, t in checks if not ok]
    for ok, t in checks:
        print_line(ok, t)
    if failed:
        print(f'\n[RESULT] FAIL — {len(failed)} 项未通过(CORE-AX9)')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

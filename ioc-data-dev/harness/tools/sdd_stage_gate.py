#!/usr/bin/env python3
"""sdd_stage_gate.py — 阶段出口统一门禁入口(CORE-AX9 Fail-Closed)。

流程:加载 change-manifest.yaml → 结构校验(gates.* 合法性)→ blocks_when 检查
      → 返回 PASS / BLOCKED。

用法:
  python sdd_stage_gate.py --feature <feature-dir> --stage <stage-id> [--json]

退出码:0=PASS 2=BLOCKED(停工) 3=错误
任何无法证明可进入的情况都按 BLOCKED 处理(Fail-Closed)。
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blocks_when import check as blocks_when_check  # noqa: E402
from ioc_common import (  # noqa: E402
    EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, GATE_VALUES, GATES,
    banner, find_manifest, load_yaml, print_line,
)


def validate_manifest(manifest):
    """manifest 结构校验。返回 (ok, checks, reasons)。"""
    checks = []
    reasons = []
    for field in ('feature_id', 'version', 'engine'):
        v = manifest.get(field)
        ok = bool(v)
        checks.append((ok, f'{field}: {v or "缺失"}'))
        if not ok:
            reasons.append(f'{field} 缺失')
    eng = manifest.get('engine')
    if eng and eng not in ('hive', 'dli'):
        checks.append((False, f'engine={eng!r}(须 hive|dli)'))
        reasons.append('engine 非法')
    elif eng:
        checks.append((True, f'engine={eng}(分支合规)'))
    gates = manifest.get('gates', {})
    unknown = [g for g in gates if g not in GATES]
    if unknown:
        checks.append((False, f'未登记 gate: {", ".join(unknown)}'))
        reasons.append('存在未登记 gate')
    else:
        checks.append((True, 'gates.* 均在门禁词汇登记内'))
    illegal = [f'{g}={v}' for g, v in gates.items() if v not in GATE_VALUES]
    if illegal:
        checks.append((False, f'非法 gate 值: {", ".join(illegal)}'))
        reasons.append('gate 值非法')
    else:
        checks.append((True, 'gate 值全部合法'))
    # CORE-AX9: gate=pass 但产物缺失 → 视为伪造嫌疑(WARNING,不自动 BLOCKED,
    # 由 validate_gate_change.py 的 --strict 处理;此处记录)
    return (not reasons), checks, reasons


def main():
    ap = argparse.ArgumentParser(description='IOC 阶段出口门禁(Fail-Closed)')
    ap.add_argument('--feature', required=True, help='feature 目录(含 change-manifest.yaml)')
    ap.add_argument('--stage', required=True, help='目标阶段 id')
    ap.add_argument('--json', action='store_true', help='输出 JSON')
    args = ap.parse_args()

    feature_dir = args.feature
    manifest_path = find_manifest(feature_dir)
    banner(f'stage gate :: {os.path.basename(feature_dir)} -> {args.stage}')

    if not manifest_path:
        if args.json:
            print(json.dumps({'result': 'BLOCKED', 'stage': args.stage,
                              'reasons': ['change-manifest.yaml 缺失(Fail-Closed)']}, ensure_ascii=False))
        else:
            print('[BLOCKED] change-manifest.yaml 缺失 — Fail-Closed,停工')
        return EXIT_BLOCKED

    manifest = load_yaml(manifest_path)
    ok, checks, reasons = validate_manifest(manifest)
    for c_ok, text in checks:
        print_line(c_ok, text)
    if not ok:
        reasons.append('manifest 结构校验未通过')

    # blocks_when
    bw_code, bw_checks, bw_reasons = blocks_when_check(feature_dir, args.stage)
    for c_ok, text in bw_checks:
        print_line(c_ok, text)
    reasons.extend(bw_reasons)

    if reasons:
        print('\n[RESULT] BLOCKED — 停工(CORE-AX9 Fail-Closed)')
        for r in reasons:
            print(f'  - {r}')
        if args.json:
            print(json.dumps({'result': 'BLOCKED', 'stage': args.stage, 'reasons': reasons},
                             ensure_ascii=False))
        return EXIT_BLOCKED

    print('\n[RESULT] PASS — 允许进入/继续')
    if args.json:
        print(json.dumps({'result': 'PASS', 'stage': args.stage, 'reasons': []}, ensure_ascii=False))
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""deliverable_level.py — 产物等级(L1/L2/L3)解析。

L1 = 结构合规(validate_*.py 全 PASS)
L2 = L1 + Mock 数据试算通过
L3 = L2 + 业务口径核验(GWT)通过

用法:
  python deliverable_level.py <validation-report.md> [--min L2]

退出码:0=等级达标 2=等级不足/缺失 3=错误
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, banner  # noqa: E402

LEVELS = ('L1', 'L2', 'L3')


def parse_level(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    for m in re.finditer(r'等级\s*[:：]\s*(L[123])', text):
        return m.group(1)
    for m in re.finditer(r'本报告等级[^L]*?(L[123])', text):
        return m.group(1)
    return None


def main():
    ap = argparse.ArgumentParser(description='产物等级解析')
    ap.add_argument('report', help='validation-report.md')
    ap.add_argument('--min', choices=sorted(LEVELS), default='L1')
    args = ap.parse_args()

    banner(f'deliverable_level :: {args.report}')
    if not os.path.isfile(args.report):
        print('[FAIL] validation-report.md 不存在(无法判定等级)')
        return EXIT_BLOCKED
    level = parse_level(args.report)
    if level is None:
        print('[FAIL] 未声明产物等级(模板: **本报告等级: L1/L2/L3**)')
        return EXIT_BLOCKED
    ok = LEVELS.index(level) >= LEVELS.index(args.min)
    print(f'[INFO] 产物等级: {level}(要求 ≥ {args.min})')
    print(f'[RESULT] {"PASS" if ok else "FAIL"}')
    return EXIT_PASS if ok else EXIT_BLOCKED


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""validate_lifecycle_columns.py — 指标生命周期列定义校验(CORE-AX6)。

解析 feature-delta-indicator.md 的指标表格,检查:
  - v0 阶段来源类型必须为「待确认」,禁止编造 ZB/物理表名
  - v1 阶段须有逻辑来源引用(不要求 ADS 表/字段名)
  - v2 阶段须有 ADS 表名/字段名
  - 生命周期状态表阶段列只能出现 v0/v1/v2/v3

用法:
  python validate_lifecycle_columns.py <feature-delta-indicator.md>

退出码:0=通过 2=FAIL(BLOCKED) 3=错误
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, banner, print_line  # noqa: E402


def _tables(text):
    """把 markdown 表格按空行切分为多个表:每表 [header, *data];分隔行(|---|)为表内分隔。"""
    tables, cur = [], []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith('|') and stripped.endswith('|'):
            row = [c.strip() for c in stripped.strip('|').split('|')]
            if all(re.fullmatch(r':?-{2,}:?', c or '-') for c in row):
                continue  # 分隔行,不属于数据
            cur.append(row)
        elif cur:
            tables.append(cur)
            cur = []
    if cur:
        tables.append(cur)
    return tables


def main():
    ap = argparse.ArgumentParser(description='指标生命周期列校验(CORE-AX6)')
    ap.add_argument('file', help='feature-delta-indicator.md')
    args = ap.parse_args()

    banner(f'validate_lifecycle_columns :: {args.file}')
    if not os.path.isfile(args.file):
        print('[FAIL] 文件不存在')
        return EXIT_BLOCKED

    with open(args.file, 'r', encoding='utf-8') as f:
        text = f.read()
    tables = _tables(text)
    if not tables:
        print('[FAIL] 未找到指标表格')
        return EXIT_BLOCKED

    checks = []
    found = 0
    for t in tables:
        if len(t) < 2:
            continue
        header, data = t[0], t[1:]
        h = {name: i for i, name in enumerate(header)}
        if '指标名称' in h and not any('阶段' in c for c in header):
            # 指标清单表:记录 v0 行检查(来源类型列)
            found += 1
            src_col = next((i for i, c in enumerate(header) if '来源' in c), None)
            for row in data:
                if not row or not row[0] or row[0].startswith('<!--'):
                    continue
                if 'v0' in [r for r in row] or (src_col is not None and len(row) > src_col):
                    src = row[src_col] if src_col is not None and len(row) > src_col else ''
                    if src == '待确认':
                        checks.append((True, f'指标 {row[0]}: v0 来源类型=待确认(合规)'))
        elif '阶段' in h or any('阶段' in c for c in header):
            # 生命周期状态表
            found += 1
            stage_col = next(i for i, c in enumerate(header) if '阶段' in c)
            ads_col = next((i for i, c in enumerate(header) if 'ADS 表名' in c or 'ADS表名' in c), None)
            src_col = next((i for i, c in enumerate(header) if '来源类型' in c), None)
            for row in data:
                if not row or len(row) <= stage_col:
                    continue
                name, stage = row[0], row[stage_col].strip()
                if not stage:
                    continue
                if stage not in ('v0', 'v1', 'v2', 'v3'):
                    checks.append((False, f'指标 {name}: 非法阶段 {stage!r}'))
                    continue
                if stage == 'v0':
                    src = row[src_col] if src_col is not None and len(row) > src_col else ''
                    ok = src == '待确认'
                    checks.append((ok, f'指标 {name}(v0): 来源类型={src}(须「待确认」,禁编造)'))
                elif stage == 'v1':
                    src = row[src_col] if src_col is not None and len(row) > src_col else ''
                    checks.append((bool(src), f'指标 {name}(v1): 逻辑来源={src or "缺失"}'))
                elif stage == 'v2':
                    ads = row[ads_col] if ads_col is not None and len(row) > ads_col else ''
                    checks.append((bool(ads and ads != '—'), f'指标 {name}(v2): ADS 绑定={ads or "缺失"}'))

    if found == 0:
        print('[FAIL] 未识别到指标表(需含「指标名称」或「阶段」列)')
        return EXIT_BLOCKED

    # 编造检测:v0 行存在但全篇出现疑似物理表模式 → 提示(不阻断)
    fabricated = re.findall(r'(?<![\w])(ZB\d{4,}|dwd_t_[a-z_]+|ads_dm_[a-z_]+)', text)
    if fabricated:
        checks.append((True, f'提示: 文中出现物理表模式 {sorted(set(fabricated))[:5]}(请确认非 v0 编造)'))

    failed = [t for ok, t in checks if not ok]
    for ok, t in checks:
        print_line(ok, t)
    if failed:
        print(f'\n[RESULT] FAIL — {len(failed)} 项未通过(CORE-AX6)')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

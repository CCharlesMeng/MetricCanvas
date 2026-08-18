#!/usr/bin/env python3
"""validate_ads_clarification.py — 澄清项校验(CORE-AX8 / POL-DESIGN-010)。

解析 *-clarification-questions.md 的澄清项表格:
  - status 只允许 open / answered / closed
  - closed 必须由人类裁定(closed_by 不得为 ai/agent/AI)
  - 存在 P0 open 项 → FAIL(POL-DESIGN-010:gate 不得 pass)

用法:
  python validate_ads_clarification.py <*-clarification-questions.md>

退出码:0=通过 2=FAIL(BLOCKED) 3=错误
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, banner, print_line  # noqa: E402

ALLOWED_STATUS = {'open', 'answered', 'closed'}
AI_MARKERS = ('ai', 'agent', '模型', '机器')


def _rows(text):
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            # 跳过分隔行 |---|---|
            if all(re.fullmatch(r':?-{2,}:?', c or '-') for c in cells):
                continue
            rows.append(cells)
    return rows


def main():
    ap = argparse.ArgumentParser(description='澄清项校验(CORE-AX8)')
    ap.add_argument('file', help='*-clarification-questions.md')
    args = ap.parse_args()

    banner(f'validate_ads_clarification :: {args.file}')
    if not os.path.isfile(args.file):
        print('[FAIL] 文件不存在')
        return EXIT_BLOCKED

    with open(args.file, 'r', encoding='utf-8') as f:
        text = f.read()
    rows = _rows(text)
    if len(rows) < 2:
        print('[PASS] 无澄清项表格(空澄清)')
        return EXIT_PASS

    header = rows[0]
    h = {name: i for i, name in enumerate(header)}
    if 'id' not in h or 'status' not in h:
        print('[FAIL] 澄清表格缺少 id/status 列')
        return EXIT_BLOCKED

    checks = []
    p0_open = 0
    for row in rows[1:]:
        if not row or len(row) < 2:
            continue
        rid = row[h['id']]
        status = row[h['status']].lower() if len(row) > h['status'] else ''
        if status not in ALLOWED_STATUS:
            checks.append((False, f'澄清 {rid}: 非法 status={status!r}'))
            continue
        priority = row[h['priority']].lower() if 'priority' in h and len(row) > h['priority'] else ''
        if priority == 'p0' and status == 'open':
            p0_open += 1
        if status == 'closed':
            cb = row[h['closed_by']].lower() if 'closed_by' in h and len(row) > h['closed_by'] else ''
            if any(m in cb for m in AI_MARKERS):
                checks.append((False, f'澄清 {rid}: closed_by={cb!r}(CORE-AX8 只能人类裁定)'))
            elif not cb:
                checks.append((False, f'澄清 {rid}: closed 但未记录 closed_by'))
            else:
                checks.append((True, f'澄清 {rid}: 人类裁定 closed'))

    checks.append((p0_open == 0, f'P0 open 项: {p0_open}(POL-DESIGN-010 须为 0)'))

    failed = [t for ok, t in checks if not ok]
    for ok, t in checks:
        print_line(ok, t)
    if failed:
        print(f'\n[RESULT] FAIL — {len(failed)} 项未通过;澄清未闭环,gate 不得 pass')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

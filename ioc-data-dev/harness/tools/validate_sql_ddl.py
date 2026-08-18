#!/usr/bin/env python3
"""validate_sql_ddl.py — DDL 结构校验(POL-SQL-DDL-*)。

检查:
  - POL-SQL-DDL-005: CREATE TABLE 前须 DROP TABLE IF EXISTS
  - POL-SQL-DDL-001: DDL 须含固定 ORC SerDe(hive;--engine dli 豁免)
  - POL-SQL-DDL-009: 测试态表名格式 {原始表名}*_{MMDD}_*{原始库名}(--test 时)
  - POL-SQL-DDL-007: 分区表 ADD COLUMNS 须带 CASCADE
  - POL-SQL-DDL-002: 测试态目标库按 engine 分支(bi_test/cbc_test;--test 时)

用法:
  python validate_sql_ddl.py <sql-file|dir> [--engine hive|dli] [--test]

退出码:0=通过 2=FAIL(BLOCKED) 3=错误
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, banner, print_line  # noqa: E402

DROP_RE = re.compile(r'DROP\s+TABLE\s+IF\s+EXISTS', re.I)
CREATE_RE = re.compile(r'CREATE\s+TABLE\s+', re.I)
SERDE_RE = re.compile(r'(ROW\s+FORMAT\s+SERDE|STORED\s+AS\s+ORC|serde)', re.I)
TEST_TABLE_RE = re.compile(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([\w.]+)`?", re.I)
TEST_NAMING_RE = re.compile(r'_\d{4}_')
ALTER_ADD_RE = re.compile(r'ALTER\s+TABLE[^;]*?ADD\s+(?:COLUMNS?\s+)?\(', re.I | re.S)
CASCADE_RE = re.compile(r'CASCADE', re.I)


def _sql_files(path):
    if os.path.isdir(path):
        return sorted(glob.glob(os.path.join(path, '**', '*.sql'), recursive=True))
    return [path]


def check_sql(text, engine, is_test):
    checks = []
    creates = CREATE_RE.findall(text)
    if creates:
        # DDL-005: DROP 先于 CREATE
        first_drop = DROP_RE.search(text)
        first_create = CREATE_RE.search(text)
        ok = first_drop is not None and first_drop.start() < first_create.start()
        checks.append((ok, f'POL-SQL-DDL-005: DROP TABLE IF EXISTS 先于 CREATE({"有" if ok else "缺失/顺序错"})'))
        # DDL-001: ORC SerDe(hive 必须)
        if engine == 'hive':
            ok = SERDE_RE.search(text) is not None
            checks.append((ok, f'POL-SQL-DDL-001: ORC SerDe({"有" if ok else "缺失"}(hive 必须))'))
        else:
            checks.append((True, 'POL-SQL-DDL-001: DLI 豁免 ORC SerDe'))
        # DDL-009: 测试态表名
        if is_test:
            m = TEST_TABLE_RE.search(text)
            name = (m.group(1).split('.')[-1] if m else '') or ''
            ok = bool(name) and bool(TEST_NAMING_RE.search(name))
            checks.append((ok, f'POL-SQL-DDL-009: 测试态表名 {name!r} 含 _MMDD_({"合规" if ok else "不合规"})'))
        # DDL-002: 测试态目标库
        if is_test:
            lib = 'bi_test' if engine == 'hive' else 'cbc_test'
            ok = re.search(rf'`?{re.escape(lib)}`?', text, re.I) is not None
            checks.append((ok, f'POL-SQL-DDL-002: 目标库含 {lib}(engine={engine})'))
    # DDL-007: ALTER ADD COLUMNS 带 CASCADE
    for m in ALTER_ADD_RE.finditer(text):
        seg = text[m.start():m.start() + 400]
        ok = bool(CASCADE_RE.search(seg))
        checks.append((ok, 'POL-SQL-DDL-007: 分区表加列带 CASCADE'))
    return checks


def main():
    ap = argparse.ArgumentParser(description='DDL 结构校验')
    ap.add_argument('path', help='SQL 文件或目录')
    ap.add_argument('--engine', choices=['hive', 'dli'], default='hive')
    ap.add_argument('--test', action='store_true', help='测试态 SQL(执行 DDL-002/009)')
    args = ap.parse_args()

    banner(f'validate_sql_ddl :: {args.path} (engine={args.engine}, test={args.test})')
    files = _sql_files(args.path)
    if not files:
        print('[FAIL] 未找到 SQL 文件')
        return EXIT_BLOCKED

    total_failed = []
    for f in files:
        with open(f, 'r', encoding='utf-8') as fh:
            text = fh.read()
        checks = check_sql(text, args.engine, args.test)
        failed = [t for ok, t in checks if not ok]
        print(f'\n--- {os.path.basename(f)} ---')
        for ok, t in checks:
            print_line(ok, t)
        total_failed.extend([(os.path.basename(f), t) for t in failed])

    if total_failed:
        print(f'\n[RESULT] FAIL — {len(total_failed)} 项未通过')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

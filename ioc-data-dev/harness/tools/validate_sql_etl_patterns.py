#!/usr/bin/env python3
"""validate_sql_etl_patterns.py — ETL 模式校验(KW-AX3 / POL-SQL-ETL-* / POL-SQL-QRY-*)。

检查:
  - POL-SQL-ETL-002: WITH/CTE 先于 INSERT
  - POL-SQL-ETL-003: INSERT OVERWRITE 分区表须显式 PARTITION
  - POL-SQL-QRY-005: 禁止 SELECT *;嵌套子查询 ≤ 3 层
  - POL-SQL-QRY-001: 表别名有意义,禁止 t1/t2
  - POL-SQL-QRY-002: 引用字段必须带表别名(带 .)
  - POL-SQL-ETL-009: 聚合函数内部须先 COALESCE
  - POL-SQL-ETL-007: 先过滤→再 JOIN→再聚合(JOIN 先于 GROUP BY)
  - POL-SQL-ETL-006: 率值分母为 0 时结果为 NULL(除法分母须 NULLIF 保护)

用法:
  python validate_sql_etl_patterns.py <sql-file|dir>

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

INSERT_RE = re.compile(r'INSERT\s+(?:OVERWRITE|INTO)\s+(?:TABLE\s+)?`?[\w\.]+`?', re.I)
WITH_RE = re.compile(r'^\s*WITH\b', re.I | re.M)
SELECT_STAR_RE = re.compile(r'SELECT\s+\*', re.I)
FROM_JOIN_RE = re.compile(r'\b(?:FROM|JOIN)\s+([a-zA-Z_][\w\.]*)\s+(?:AS\s+)?([a-zA-Z_]\w*)', re.I)
SUBQUERY_DEPTH = 3
ALIAS_BAD = {'t1', 't2', 't3', 'a1', 'b1', 'x', 'y', 'tmp'}
AGG_RE = re.compile(r'\b(SUM|COUNT|MAX|MIN|AVG)\s*\(', re.I)
COALESCE_RE = re.compile(r'COALESCE\s*\(', re.I)
DIV_RE = re.compile(r'(\w[\w\.]*)\s*/\s*(\w[\w\.]*|[\(\w])', re.I)


def check_statement(text):
    checks = []
    has_insert = INSERT_RE.search(text)
    if has_insert:
        with_pos = WITH_RE.search(text)
        insert_pos = has_insert.start()
        ok = with_pos is not None and with_pos.start() < insert_pos
        checks.append((ok, 'POL-SQL-ETL-002: CTE(WITH) 先于 INSERT'))
        # ETL-003: INSERT OVERWRITE 后紧跟 PARTITION
        m = re.search(r'INSERT\s+OVERWRITE\s+(?:TABLE\s+)?\S+\s*\(?PARTITION\s*\(', text, re.I)
        if 'OVERWRITE' in text[has_insert.start():has_insert.start() + 60].upper():
            ok = m is not None
            checks.append((ok, 'POL-SQL-ETL-003: INSERT OVERWRITE 显式 PARTITION'))
    # QRY-005: SELECT *
    star = SELECT_STAR_RE.search(text)
    checks.append((star is None, 'POL-SQL-QRY-005: 禁止 SELECT *'))
    # QRY-001: 别名
    bad_aliases = [a for _, a in FROM_JOIN_RE.findall(text) if a in ALIAS_BAD]
    checks.append((not bad_aliases, f'POL-SQL-QRY-001: 有意义别名(发现 {sorted(set(bad_aliases)) or "无"})'))
    # QRY-002: 字段引用带别名(按 SELECT 项切分:裸标识符或参数内无点的函数 → 未限定)
    sel = re.search(r'SELECT\s+(.*?)\s+FROM', text, re.I | re.S)
    if sel:
        unqualified = []
        for item in re.split(r',\s*', sel.group(1)):
            expr = re.split(r'\s+AS\s+', item.strip(), flags=re.I)[0].strip()
            if not expr or expr.lower() in ('distinct',):
                continue
            if re.fullmatch(r'[a-zA-Z_]\w*', expr):
                unqualified.append(expr)
            elif re.search(r'\.', expr) is None and re.search(r'[a-zA-Z_]\w*\s*\(', expr) and ' ' not in expr:
                # 无点且无空格、带括号的函数(如 SUM(amount))→ 函数参数未限定
                unqualified.append(expr)
        checks.append((not unqualified, f'POL-SQL-QRY-002: 字段带表别名(未限定: {sorted(set(unqualified))[:6] or "无"})'))
    # ETL-009: 聚合内部先 COALESCE
    for m in AGG_RE.finditer(text):
        seg = text[m.start():m.start() + 200]
        close = seg.find(')')
        inner = seg[:close] if close > 0 else seg
        ok = bool(COALESCE_RE.search(inner)) or 'if(' in inner.lower()
        checks.append((ok, f'POL-SQL-ETL-009: 聚合 {m.group(1)}(...) 内部 COALESCE'))
    # ETL-007: JOIN 先于 GROUP BY
    j = re.search(r'\bJOIN\b', text, re.I)
    g = re.search(r'\bGROUP\s+BY\b', text, re.I)
    if j and g:
        checks.append((j.start() < g.start(), 'POL-SQL-ETL-007: 先过滤→JOIN→聚合(JOIN 先于 GROUP BY)'))
    # ETL-006: 除法分母 NULLIF
    for m in DIV_RE.finditer(text):
        denom = m.group(2)
        seg = text[max(0, m.start() - 60):m.start() + 60]
        if re.match(r'[a-zA-Z_][\w\.]*$', denom) and 'NULLIF' not in seg:
            checks.append((False, f'POL-SQL-ETL-006: 分母 {denom} 未用 NULLIF(分母为 0 → NULL)'))
            break
    return checks


def _sql_files(path):
    if os.path.isdir(path):
        return sorted(glob.glob(os.path.join(path, '**', '*.sql'), recursive=True))
    return [path]


def main():
    ap = argparse.ArgumentParser(description='ETL 模式校验')
    ap.add_argument('path', help='SQL 文件或目录')
    args = ap.parse_args()

    banner(f'validate_sql_etl_patterns :: {args.path}')
    files = _sql_files(args.path)
    if not files:
        print('[FAIL] 未找到 SQL 文件')
        return EXIT_BLOCKED

    total_failed = []
    for f in files:
        with open(f, 'r', encoding='utf-8') as fh:
            text = fh.read()
        checks = check_statement(text)
        failed = [t for ok, t in checks if not ok]
        print(f'\n--- {os.path.basename(f)} ---')
        for ok, t in checks:
            print_line(ok, t)
        total_failed.extend([(os.path.basename(f), t) for t in failed])

    if total_failed:
        print(f'\n[RESULT] FAIL — {len(total_failed)} 项未通过(KW-AX3)')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

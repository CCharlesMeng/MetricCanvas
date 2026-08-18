#!/usr/bin/env python3
"""validate_domain_patterns.py — 领域模式必选过滤校验(KW-AX5 / PAT-DOM-*)。

对 SQL 中引用的每个来源表,按 PAT-DOM 触发规则检查 MUST 过滤条件是否出现。
触发规则表以 domain-patterns-index.yaml 为基准 + 内置表名触发词(可按 --patterns-file 扩展)。

用法:
  python validate_domain_patterns.py <sql-file|dir> [--patterns-file <yaml>]

退出码:0=通过 2=FAIL(BLOCKED) 3=错误
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import (  # noqa: E402
    EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, KIT_ROOT, banner, load_yaml, print_line,
)

# 内置 表名触发词 → 必选条件列表(与 domain-patterns-index.yaml 对齐)
BUILTIN_PATTERNS = [
    {'id': 'PAT-DOM-SRC-001', 'triggers': ['landscape', 'customer_insight', '客户洞察'],
     'must': ["map_type='LANDSCAPE_MAP'", 'space IS NOT NULL'],
     'note': '客户洞察地图月表'},
    {'id': 'PAT-DOM-SRC-002', 'triggers': ['cdh_party', 'cdh_party_relation'],
     'must': ['cdh_party_relation_valid_flag', 'valid_flag'],
     'note': 'CDH 客户信息表(valid_flag=1)'},
    {'id': 'PAT-DOM-SRC-003', 'triggers': ['cloud_service', 'scd_product', 'product_scd', '云服务产品'],
     'must': ['start_date', 'end_date', 'valid_date', 'effective'],
     'note': '云服务产品 SCD 维表(生效日期条件)'},
    {'id': 'PAT-DOM-SRC-004', 'triggers': ['root_resource', 'resource_relation', '根资源'],
     'must': ['valid_flag', 'is_valid', 'valid'],
     'note': '客户根资源关系维表(有效标识)'},
    {'id': 'PAT-DOM-SRC-005', 'triggers': ['exchange_rate', '汇率'],
     'must': ["exchange_rate_type_cn_name='Corporate'", 'date_sub(current_date,1)'],
     'note': '汇率维表(Corporate + 昨日及之前)'},
    {'id': 'PAT-DOM-SITE-002', 'triggers': ['_global', '_glb'],
     'must': ['data_site_type'],
     'note': 'global 表须 data_site_type 路由'},
    {'id': 'PAT-DOM-SITE-008', 'triggers': ['_intl'],
     'must': [], 'forbid': ['data_site_type'],
     'note': 'intl 表不得用 data_site_type'},
]

TABLE_RE = re.compile(r'\b(?:FROM|JOIN)\s+`?([a-zA-Z_][\w\.]*)`?(?:\s+(?:AS\s+)?[a-zA-Z_]\w*)?', re.I)


def _sql_files(path):
    if os.path.isdir(path):
        return sorted(glob.glob(os.path.join(path, '**', '*.sql'), recursive=True))
    return [path]


def load_patterns(patterns_file):
    pats = list(BUILTIN_PATTERNS)
    try:
        data = load_yaml(patterns_file)
    except Exception:  # noqa: BLE001
        return pats
    for grp in ('site_patterns', 'source_patterns'):
        for p in data.get(grp, []):
            must = p.get('must', '')
            pats.append({'id': p.get('id'), 'triggers': [p.get('id', '').split('-')[-1]],
                         'must': [must] if must else [], 'note': p.get('pattern', '')})
    return pats


def check_sql(text, pats):
    tables = {t.split('.')[-1].lower() for t in TABLE_RE.findall(text)}
    checks = []
    norm = re.sub(r'\s+', '', text.lower())  # 空白归一化:map_type = 'X' 与 map_type='X' 等价
    for pat in pats:
        hit = [t for t in tables if any(trig in t for trig in pat['triggers'])]
        if not hit:
            continue
        for m in pat.get('must', []):
            ok = re.sub(r'\s+', '', m.lower()) in norm
            checks.append((ok, f"{pat['id']}: 表 {sorted(hit)} 必选过滤 {m!r}({pat['note']})"))
        for f in pat.get('forbid', []):
            ok = re.sub(r'\s+', '', f.lower()) not in norm
            checks.append((ok, f"{pat['id']}: 表 {sorted(hit)} 禁止使用 {f!r}"))
    if not any(True for _ in checks):
        checks.append((True, '未命中领域模式表(无需过滤检查)'))
    return checks


def main():
    ap = argparse.ArgumentParser(description='领域模式必选过滤校验')
    ap.add_argument('path', help='SQL 文件或目录')
    ap.add_argument('--patterns-file', default=os.path.join(KIT_ROOT, 'codespec', 'guidelines', 'ioc-kernel', 'domain-patterns-index.yaml'))
    args = ap.parse_args()

    banner(f'validate_domain_patterns :: {args.path}')
    files = _sql_files(args.path)
    if not files:
        print('[FAIL] 未找到 SQL 文件')
        return EXIT_BLOCKED
    pats = load_patterns(args.patterns_file)

    total_failed = []
    for f in files:
        with open(f, 'r', encoding='utf-8') as fh:
            text = fh.read()
        checks = check_sql(text, pats)
        failed = [t for ok, t in checks if not ok]
        print(f'\n--- {os.path.basename(f)} ---')
        for ok, t in checks:
            print_line(ok, t)
        total_failed.extend([(os.path.basename(f), t) for t in failed])

    if total_failed:
        print(f'\n[RESULT] FAIL — {len(total_failed)} 项未通过(KW-AX5)')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

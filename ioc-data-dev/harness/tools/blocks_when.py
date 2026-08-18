#!/usr/bin/env python3
"""blocks_when.py — 机读 blocks_when 执行器。

按 ioc-workflow schema.yaml 的 blocks_when 规则检查:
  - gate 条件(requires_gates 全部 = pass)
  - min_level 条件(validation-report.md 产物等级 ≥ min_level)
  - missing_contract 条件(进入该阶段所需契约产物必须已存在)

用法:
  python blocks_when.py --feature <feature-dir> --stage <stage-id> [--schema <schema.yaml>]
  python blocks_when.py --list

退出码:0=PASS(可进入) 1=WARNING 2=BLOCKED(CORE-AX9) 3=错误
"""
from __future__ import annotations

import argparse
import glob
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from ioc_common import (  # noqa: E402
    EXIT_BLOCKED, EXIT_ERROR, EXIT_PASS, EXIT_WARNING, GATE_VALUES, GATES,
    SCHEMA_PATH, banner, load_yaml, print_line,
)

# 进入某阶段所需的既有契约产物(missing_contract 依据,来自契约索引)
STAGE_CONTRACTS = {
    'ads-design': ['proposal-fe.md', 'feature-delta-spec.md', 'feature-delta-acceptance.md',
                   'feature-delta-indicator.md', 'GWT验收.md'],
    'ads-design-validation': ['delta-design-ads.md'],
    'clouddevops-review': ['delta-design-ads.md'],
    'sql-bindings-ready': ['delta-design-ads.md'],
    'sql-generate': ['delta-design-ads.md', 'sql-source-bindings.yaml', 'table-schema.json'],
    'sql-validation': ['delta-design-ads.md', 'sql-source-bindings.yaml'],
    'job-create': ['validation-report.md'],
    'platform-test': ['validation-report.md'],
    'promotion': ['validation-report.md'],
    'platform-formal': ['hql/'],
    'archive': ['validation-report.md'],
    'service-develop': ['ioc-service-design.md'],
    'frontend-plan': ['ioc-service-design.md'],
}

STAGE_LEGAL = {
    'intake', 'requirement', 'data-design', 'ads-design', 'ads-design-validation',
    'ads-clarification-apply', 'clouddevops-review', 'sql-bindings-ready',
    'sql-generate', 'sql-validation', 'job-create', 'platform-test', 'promotion',
    'platform-formal', 'archive', 'subject-requirement', 'subject-design',
    'subject-design-validation', 'subject-clarification-apply',
    'subject-sql-bindings-ready', 'service-design', 'service-develop',
    'frontend-plan', 'test-analyzer', 'testpoint-analyzer', 'testcase-designer',
}


def _gates_pass(manifest, required):
    missing = []
    for g in required:
        if g not in manifest.get('gates', {}):
            missing.append(f'{g}: 未登记')
        elif manifest['gates'][g] != 'pass':
            missing.append(f'{g}: {manifest["gates"][g]}(需 pass)')
    return missing


def _level_ok(feature_dir, min_level):
    """读取 validation-report.md 的产物等级。"""
    report = os.path.join(feature_dir, 'validation-report.md')
    if not os.path.isfile(report):
        return False, 'validation-report.md 缺失(无法判定等级)'
    with open(report, 'r', encoding='utf-8') as f:
        text = f.read()
    for level in ('L3', 'L2', 'L1'):
        if f'**本报告等级: {level}' in text or f'等级: {level}' in text:
            return level >= min_level, f'validation-report 等级={level}(需 ≥ {min_level})'
    return False, f'validation-report.md 未声明等级(需 ≥ {min_level})'


def _contracts_missing(feature_dir, stage):
    want = STAGE_CONTRACTS.get(stage, [])
    missing = []
    for rel in want:
        p = os.path.join(feature_dir, rel)
        if rel.endswith('/'):  # 目录存在性检查
            if not os.path.isdir(p) or not os.listdir(p):
                missing.append(rel)
        elif not os.path.isfile(p):
            # 通配支持
            if '*' in rel:
                if not glob.glob(p):
                    missing.append(rel)
            else:
                missing.append(rel)
    return missing


def _p0_open_count(feature_dir):
    """统计 *-clarification-questions.md 中 P0 open 澄清项数(POL-DESIGN-010)。"""
    count = 0
    for f in glob.glob(os.path.join(feature_dir, '*-clarification-questions.md')):
        try:
            with open(f, 'r', encoding='utf-8') as fh:
                for line in fh:
                    if '|' not in line:
                        continue
                    cells = [c.strip().lower() for c in line.strip('|').split('|')]
                    if len(cells) >= 4 and cells[2] in ('open',) and 'p0' in cells[3]:
                        count += 1
        except OSError:
            continue
    return count


def check(feature_dir: str, stage: str, schema_path: str = SCHEMA_PATH):
    """返回 (exit_code, checks, reasons)。checks: [(ok, text)]。"""
    checks = []

    if stage not in STAGE_LEGAL:
        return EXIT_BLOCKED, [(False, f'未知阶段 {stage!r}(Fail-Closed,CORE-AX9)')], [f'未知阶段 {stage!r}']

    manifest_path = os.path.join(feature_dir, 'change-manifest.yaml')
    if not os.path.isfile(manifest_path):
        return EXIT_BLOCKED, [(False, f'change-manifest.yaml 缺失: {manifest_path}')], ['manifest 缺失']

    manifest = load_yaml(manifest_path)
    gates = manifest.get('gates', {})
    checks.append((True, 'manifest 已加载'))

    # 1. manifest 结构合法性(非法 gate 值 → BLOCKED)
    illegal = [f'{g}={v}' for g, v in gates.items() if v not in GATE_VALUES]
    if illegal:
        checks.append((False, f'非法 gate 值: {", ".join(illegal)}'))
    else:
        checks.append((True, 'gate 值全部合法'))

    # 2. schema blocks_when 规则
    schema = load_yaml(schema_path)
    rules = [r for r in schema.get('blocks_when', []) if r.get('stage') in (stage, '*')]
    # 全局 "*" 规则(ads_clarification_applied)仅在存在 P0 open 澄清项时生效(POL-DESIGN-010)
    p0_open = _p0_open_count(feature_dir)
    if p0_open == 0:
        rules = [r for r in rules if r.get('stage') != '*']
    reasons = []
    for rule in rules:
        for g in rule.get('requires_gates', []):
            ok = gates.get(g) == 'pass'
            text = f'gate {g} = {gates.get(g, "未登记")}(需 pass)'
            checks.append((ok, text))
            if not ok:
                reasons.append(text)

    # 3. min_level
    if any(r.get('min_level') for r in rules):
        min_level = next(r['min_level'] for r in rules if r.get('min_level'))
        ok, text = _level_ok(feature_dir, min_level)
        checks.append((ok, text))
        if not ok:
            reasons.append(text)

    # 4. missing_contract
    for rel in _contracts_missing(feature_dir, stage):
        checks.append((False, f'缺少契约产物: {rel}'))
        reasons.append(f'缺少契约产物: {rel}')

    if not reasons:
        checks.append((True, f'进入阶段 {stage} 无阻塞项'))
        return EXIT_PASS, checks, []
    return EXIT_BLOCKED, checks, reasons


def main():
    ap = argparse.ArgumentParser(description='blocks_when 机读执行')
    ap.add_argument('--feature', required=True, help='feature 目录')
    ap.add_argument('--stage', required=True, help='目标阶段 id')
    ap.add_argument('--schema', default=SCHEMA_PATH)
    ap.add_argument('--list', action='store_true', help='列出全部 blocks_when 规则')
    args = ap.parse_args()

    if args.list:
        schema = load_yaml(args.schema)
        for r in schema.get('blocks_when', []):
            print(r)
        return EXIT_PASS

    banner(f'blocks_when :: {os.path.basename(args.feature)} -> {args.stage}')
    code, checks, reasons = check(args.feature, args.stage, args.schema)
    for ok, text in checks:
        print_line(ok, text)
    if reasons:
        print('\n[BLOCKED] 阻塞原因:')
        for r in reasons:
            print(f'  - {r}')
        return EXIT_BLOCKED
    print('\n[RESULT] PASS — 无 blocks_when 阻塞')
    return EXIT_PASS


if __name__ == '__main__':
    sys.exit(main())

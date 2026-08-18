#!/usr/bin/env python3
"""ioc_common.py — IOC 工具链共享库(零依赖)。

用法:脚本把本文件所在目录加入 sys.path 后 `from ioc_common import *`。
"""
from __future__ import annotations

import os
import sys

# ── 退出码约定 ──────────────────────────────────────────────────────────────
EXIT_PASS = 0          # 通过
EXIT_WARNING = 1       # 有警告(可继续,但需注意)
EXIT_BLOCKED = 2       # BLOCKED 停工(CORE-AX9)
EXIT_ERROR = 3         # 工具自身错误(参数/IO)

GATE_VALUES = {'not_started', 'in_progress', 'pass', 'fail', 'waived'}
GATES = [
    'data_design', 'ads_design_validation', 'clouddevops_review',
    'ads_clarification_applied', 'service_design', 'service_develop',
    'sql_bindings_ready', 'sql_validation_static', 'test_execution',
    'platform_test', 'sql_promotion', 'platform_formal',
]

HERE = os.path.dirname(os.path.abspath(__file__))       # ioc-data-dev/harness/tools/lib/
TOOLS_DIR = os.path.dirname(HERE)                        # ioc-data-dev/harness/tools/
KIT_ROOT = os.path.dirname(TOOLS_DIR)                    # ioc-data-dev/harness/
KIT_ROOT = os.path.dirname(KIT_ROOT)                     # ioc-data-dev/
SCHEMA_PATH = os.path.join(KIT_ROOT, 'codespec', 'schemas', 'ioc-workflow', 'schema.yaml')


def load_yaml(path: str):
    """优先 PyYAML,回退 mini_yaml(零依赖)。"""
    try:
        import yaml  # type: ignore
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except ImportError:
        sys.path.insert(0, os.path.join(HERE, 'lib'))
        from mini_yaml import load_file  # type: ignore
        return load_file(path)


def find_manifest(feature_dir: str):
    """在 feature 目录定位 change-manifest.yaml;找不到返回 None。"""
    p = os.path.join(feature_dir, 'change-manifest.yaml')
    return p if os.path.isfile(p) else None


def feature_rel(feature_dir: str, path: str):
    return os.path.relpath(path, feature_dir)


def marker(ok: bool, text: str, width: int = 10):
    tag = 'PASS' if ok else 'FAIL'
    return f'[{tag:<{width}}] {text}'


def print_line(ok: bool, text: str):
    print(marker(ok, text))


def banner(title: str):
    print('=' * 64)
    print(title)
    print('=' * 64)


def summary(checks):
    """checks: list of (ok: bool, text: str)。返回 (exit_code, failed)。"""
    failed = [t for ok, t in checks if not ok]
    if not failed:
        return EXIT_PASS, []
    return EXIT_BLOCKED, failed

"""Read-only deployment evidence. Run with the SAME Python/PYTHONPATH as Relay.

Does not prepend the checkout to sys.path or import/instantiate internal adapters.
Matching hashes prove file consistency, never production integration readiness.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

MODULES = (
    'metriccanvas_authoring.data.data_context',
    'metriccanvas_authoring.pages.scope_annotations',
    'metriccanvas_authoring.data.metadata_session',
    'metriccanvas_authoring.data.results',
    'metriccanvas_authoring.data.executable_units',
    'metriccanvas_authoring.pages.referenced',
    'metriccanvas_authoring.pages.composition.page_structure',
    'metriccanvas_authoring.pages.validation.page_validation',
    'metriccanvas_authoring.data.semantic_catalog',
    'metriccanvas_authoring.data.discover_data_context',
    'metriccanvas_authoring.data.validation_policy',
    'metriccanvas_authoring.work.authoring_turns',
    'metriccanvas_authoring.work.state',
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_state(root):
    def run(*args):
        return subprocess.check_output(['git', '-C', str(root), *args], text=True,
                                       stderr=subprocess.DEVNULL).strip()
    try:
        return {'head': run('rev-parse', 'HEAD'),
                'dirty': bool(run('status', '--porcelain', '--', str(root)))}
    except (OSError, subprocess.CalledProcessError):
        return {'head': None, 'dirty': None}


def fingerprint(root, adapter_root=None):
    root = root.resolve()
    lock = json.loads((root / 'bundle.lock.json').read_text())
    expected = {item['file']: item['sha256'] for item in lock['artifacts']}
    drift = []
    for name, sha in expected.items():
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            drift.append({'file': name, 'status': 'missing_or_outside_bundle'})
        elif digest(path) != sha:
            drift.append({'file': name, 'status': 'digest_mismatch'})
    modules = []
    for name in MODULES:
        relative = 'tool/' + name.replace('.', '/') + '.py'
        item = {'module': name, 'path': None, 'matchesBundle': False}
        try:
            spec = importlib.util.find_spec(name)
            if spec and spec.origin:
                path = Path(spec.origin).resolve()
                item.update(path=str(path), sha256=digest(path))
                item['matchesBundle'] = item['sha256'] == expected.get(relative)
        except (ImportError, ValueError, OSError):
            pass
        modules.append(item)
    try:
        from metriccanvas_authoring.data.validation_policy import load_query_validation_policy
        mode = load_query_validation_policy().mode
    except Exception:
        mode = 'unavailable_or_invalid'
    skills = [{'file': name, 'sha256': digest(root / name)} for name in sorted(expected)
              if name.startswith('skill/') and (root / name).is_file()]
    adapter = {'status': 'not_provided'}
    if adapter_root is not None:
        adapter_root = adapter_root.resolve()
        # Hash source only. Never read runtime databases, env files or credentials.
        files = [{'file': str(p.relative_to(adapter_root)), 'sha256': digest(p)}
                 for p in sorted(adapter_root.rglob('*.py'))
                 if p.is_file() and not p.is_symlink() and not any(
                     part.startswith('.') or part == '__pycache__'
                     for part in p.relative_to(adapter_root).parts)]
        adapter = {'status': 'recorded' if files else 'no_python_source',
                   'path': str(adapter_root), 'git': git_state(adapter_root), 'files': files}
    return {'bundleRoot': str(root), 'python': sys.executable, 'git': git_state(root),
            'bundleVersion': lock['bundleVersion'], 'bundleLockSha256': digest(root / 'bundle.lock.json'),
            'bundleDrift': drift, 'modules': modules, 'queryValidationMode': mode,
            'skillFiles': skills, 'adapter': adapter, 'productionIntegration': 'not_verified'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle-root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--adapter-root', type=Path, help='Actual deployed plugin source, not the template')
    args = parser.parse_args()
    report = fingerprint(args.bundle_root, args.adapter_root)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if (not report['bundleDrift'] and all(m['matchesBundle'] for m in report['modules'])
                 and report['queryValidationMode'] in {'strict', 'relaxed'}) else 2


if __name__ == '__main__':
    raise SystemExit(main())

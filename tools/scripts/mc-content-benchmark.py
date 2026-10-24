"""Measure installed cold CLI paths. Candidate budgets are observations, never SLA gates."""
import argparse
from copy import deepcopy
import json
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'metriccanvas-authoring/mc-content'


def measure(command, count, cwd):
    values = []
    for _ in range(count):
        start = time.perf_counter()
        result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=True)
        values.append((time.perf_counter() - start) * 1000)
        value = json.loads(result.stdout)
        if value.get('status') in {'invalid', 'blocked', 'needs_review'}:
            raise ValueError(value)
    ordered = sorted(values)
    return {'samplesMs': values, 'medianMs': statistics.median(values),
        'p95ObservedMs': ordered[max(0, int(len(values) * .95 + .999) - 1)], 'maxMs': max(values)}


def benchmark(count):
    with tempfile.TemporaryDirectory(prefix='mc-benchmark-') as folder:
        import shutil
        installed = Path(folder) / 'mc-content'
        shutil.copytree(CONTENT, installed, ignore=shutil.ignore_patterns('__pycache__'))
        old = json.loads((ROOT / 'tools/fixtures/local-authoring-upgrade/schema-upgrade-demo.json').read_text())
        old['dataSources']['overview']['source']['rows'] = [{'region': '合成对象' + str(i) + '-' + 'x' * 60, 'gmv': i} for i in range(10000)]
        input_file = Path(folder) / 'old.json'
        input_file.write_text(json.dumps(old, ensure_ascii=False))
        command = [sys.executable, str(installed / 'scripts/mc_content.py')]
        dry = subprocess.run([*command, 'upgrade', '--input', str(input_file), '--out-dir', str(Path(folder) / 'initial')], text=True, capture_output=True, check=True)
        if not json.loads(dry.stdout).get('output'):
            raise ValueError(dry.stdout)
        current = Path(json.loads(dry.stdout)['output'])
        operations = {'verify': [*command, 'verify'],
            'knowledge': [*command, 'query', '--topic', 'knowledge', '--key', 'table.width'],
            'schema1MiB': [*command, 'schema', '--input', str(current)],
            'migrationDryRun1MiB': [*command, 'upgrade', '--input', str(input_file)]}
        measured = {key: measure(value, count, folder) for key, value in operations.items()}
        measured['migrationWrite1MiB'] = measure_writes(command, input_file, count, Path(folder))
        return {'environment': {'python': sys.version, 'node': subprocess.check_output(['node', '--version'], text=True).strip(),
            'platform': platform.platform(), 'machine': platform.machine()}, 'iterations': count,
            'inputBytes': input_file.stat().st_size, 'inlineRows': 10000,
            'installedFiles': sum(file.is_file() for file in installed.rglob('*')),
            'installedBytes': sum(file.stat().st_size for file in installed.rglob('*') if file.is_file()),
            'operations': measured, 'budget': '1s inspection / 2s migration remain unapproved candidates; no pass/fail SLA',
            'scope': 'cold Python CLI + package verify + Node product implementation; local disk; no Relay/network/model/rendering'}


def measure_writes(command, input_file, count, folder):
    samples = []
    for index in range(count):
        samples.extend(measure([*command, 'upgrade', '--input', str(input_file), '--out-dir', str(folder / f'write-{index}')], 1, folder)['samplesMs'])
    ordered = sorted(samples)
    return {'samplesMs': samples, 'medianMs': statistics.median(samples),
        'p95ObservedMs': ordered[max(0, int(count * .95 + .999) - 1)], 'maxMs': max(samples)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--iterations', type=int, default=10)
    parser.add_argument('--output')
    args = parser.parse_args()
    if args.iterations < 1:
        parser.error('iterations must be positive')
    text = json.dumps(benchmark(args.iterations), ensure_ascii=False, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(text)
    else:
        print(text)

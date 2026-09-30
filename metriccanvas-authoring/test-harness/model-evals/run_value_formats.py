"""Real-model and scripted acceptance of authoring display defaults.

Only the transport changes. Metadata, DQE HTTP, MCP server and asset lifecycle
use the existing main-flow harness. Expected formats never enter model messages.
"""
import argparse
import asyncio
from copy import deepcopy
import json
from pathlib import Path

import run_platform_v2 as flow

PROFILES = {
    'cny': ('Tokens流水', '人民币元', [11030729.634093193, 29729963.32342134], 'compact-wan-1'),
    'mixed': ('Tokens流水', '人民币元', [5000, 125000000], 'compact-wan-1'),
    'tiny': ('Tokens流水', '人民币元', [38, 125000000], 'number'),
    'quantity': ('Tokens消耗量', 'Tokens', [11358989639011.566, 23518208780053.55], 'compact-yi-1'),
    'scaled': ('Tokens流水', '万元', [1103.1, 2973.0], 'number'),
}


def prepare(profile, root, fixture, suite):
    metric, unit, values, expected_format = PROFILES[profile]
    # Replace only the metric identity in this explicitly synthetic fixture.
    fixture = json.loads(json.dumps(fixture, ensure_ascii=False).replace('Tokens请求量', metric).replace('Tokens 请求量', metric))
    suite = json.loads(json.dumps(suite, ensure_ascii=False).replace('Tokens请求量', metric).replace('Tokens 请求量', metric))
    for declaration in fixture['dataset']['logical_schema']['field_schema']['metrics']:
        if declaration['name'] == metric:
            declaration['unit'] = unit
            declaration['definition'] = '统计期内的 Tokens 消耗数量' if profile == 'quantity' else '统计期内的 Tokens 服务人民币流水金额'
            declaration['description'] = declaration['definition']
    fixture['fields'][metric]['unit'] = unit
    fixture['fields'][metric].pop('defaultFormat', None)
    fixture['displayExpectations'] = {
        'cny': ['1,103.1万', '2,973.0万'],
        'mixed': ['0.5万', '12,500.0万'],
        'tiny': ['38', '125000000'],
        'quantity': ['113,589.9亿', '235,182.1亿'],
        'scaled': ['1103.1', '2973'],
    }[profile]
    for row, value in zip(fixture['rows'], values, strict=True):
        row[metric] = value
    case = next(c for c in suite['cases'] if c['id'] == 'create-report')
    case['expected'].update(metric=metric, unit=unit, rows=deepcopy(fixture['rows']))
    case['prompt'] += ' 请核对业务单位，图表数值轴、提示值和明细列必须共用固定单位，不能逐值变换单位；保留原始查询结果。'
    suite['cases'] = [case]
    flow.dump(root / 'fixture.json', fixture)
    flow.dump(root / 'suite.json', suite)
    return metric, expected_format


async def run(output, scripted):
    output.mkdir(parents=True, exist_ok=False)
    fixture = json.loads(flow.FIXTURE_PATH.read_text())
    suite = json.loads(flow.SUITE_PATH.read_text())
    results = []
    for profile in PROFILES:
        root = output / profile
        root.mkdir()
        metric, expected_format = prepare(profile, root, fixture, suite)
        flow.FIXTURE_PATH, flow.SUITE_PATH = root / 'fixture.json', root / 'suite.json'
        report = await flow.run(root / 'run', scripted, ['create-report'])
        artifact_path = root / 'run/create-report/artifact.json'
        issues = []
        if artifact_path.exists():
            artifact = json.loads(artifact_path.read_text())
            fields = [f for s in artifact['document']['dataSources'].values() for f in s['fields'].values() if f.get('queryField') == metric]
            if not fields or any(f.get('defaultFormat') != expected_format for f in fields):
                issues.append('DISPLAY_FORMAT_MISMATCH')
            def bindings(value):
                if isinstance(value, dict):
                    if 'field' in value and 'format' in value:
                        yield value
                    for child in value.values():
                        yield from bindings(child)
                elif isinstance(value, list):
                    for child in value:
                        yield from bindings(child)
            if any(b['format'] != expected_format for b in bindings(artifact['document']['sections'])):
                issues.append('COMPONENT_FORMAT_OVERRIDE_MISMATCH')
            flow.dump(root / 'document.json', artifact['document'])
        else:
            issues.append('PAGE_ARTIFACT_MISSING')
        results.append({'id':profile, 'passed':report['passed'] and not issues,
                        'issues':issues, 'modelCalls':report['modelCalls'], 'tokens':report['tokens']})
    result = {'passed':all(r['passed'] for r in results), 'cases':results,
              'evidenceKind':'scripted' if scripted else 'real-deepseek-local-http',
              'limitations':['Synthetic Java/DQE/Relay services; not internal production integration']}
    flow.dump(output / 'report.json', result)
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--scripted', action='store_true')
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.output.resolve(), args.scripted))['passed'] else 1)

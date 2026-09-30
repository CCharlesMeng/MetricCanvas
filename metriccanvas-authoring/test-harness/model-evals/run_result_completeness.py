"""Large ordinary query acceptance: real model sees every returned row."""
import argparse
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import run_platform_v2 as flow

async def run(output, scripted):
    output.mkdir(parents=True, exist_ok=False)
    fixture = json.loads(flow.FIXTURE_PATH.read_text())
    suite = json.loads(flow.SUITE_PATH.read_text())
    fixture['rows'] = [{'区域': f'区域{i:03d}', 'Tokens请求量': 1200 + i} for i in range(128)]
    fixture['paginationExpectation'] = {'pageSize': 10, 'totalCount': 128, 'lastCategory': '区域127'}
    case = deepcopy(next(c for c in suite['cases'] if c['id'] == 'create-report'))
    case['expected']['rows'] = deepcopy(fixture['rows'])
    case['prompt'] += ' 展示全部区域，不能取 Top N 或丢弃区域。请包含柱状图与完整明细表。'
    suite['cases'] = [case]
    flow.dump(output / 'fixture.json', fixture)
    flow.dump(output / 'suite.json', suite)
    flow.FIXTURE_PATH, flow.SUITE_PATH = output / 'fixture.json', output / 'suite.json'
    report = await flow.run(output / 'run', scripted, ['create-report'])
    flow.dump(output / 'report.json', report)
    print(json.dumps({'passed': report['passed'], 'modelCalls': report['modelCalls'], 'tokens': report['tokens']}))
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--scripted', action='store_true')
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.output.resolve(), args.scripted))['passed'] else 1)

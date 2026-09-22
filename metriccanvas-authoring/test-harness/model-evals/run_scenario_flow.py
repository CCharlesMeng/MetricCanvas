"""Opt-in real-model regression using existing local flow sample projections.

Only skill, tool schemas and governed fixture metadata enter the model channel.
Business rows and complete candidate documents remain in the local program channel.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path

from fastmcp import Client
import run_trusted_local as runner
from eval_evidence import sha
from reference_injection import ReferenceInjection

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SCENE = 'business-report'
LIBRARY_ROOT = ROOT
DATA_PROFILE = 'basic'


def fixture_client(configuration):
    server = configuration['mcpServers']['content']
    server['args'][0] = str(HERE / 'scenario_flow_server.py')
    server['env'].update(FASTMCP_CHECK_FOR_UPDATES='off', FASTMCP_SHOW_SERVER_BANNER='false')
    server['env'].update(METRICCANVAS_EVAL_SCENE=SCENE, METRICCANVAS_EVAL_LIBRARY_ROOT=str(LIBRARY_ROOT))
    server['env']['METRICCANVAS_EVAL_DATA_PROFILE'] = DATA_PROFILE
    return Client(configuration)


async def main():
    global SCENE, LIBRARY_ROOT, DATA_PROFILE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--neutral', action='store_true')
    parser.add_argument('--repeats', type=int, default=3)
    parser.add_argument('--baseline-root', type=Path)
    parser.add_argument('--cases-file', type=Path)
    parser.add_argument('--max-output-tokens', type=int, choices=(4096, 8192, 12288), default=4096,
                        help='Explicit bounded output allowance; recorded in the run manifest.')
    args = parser.parse_args()
    runner.PARAMS['max_tokens'] = args.max_output_tokens
    os.umask(0o077)
    args.output.mkdir(parents=True, exist_ok=False, mode=0o700)
    case_path = (args.cases_file or HERE / ('scenario-neutral.cases.json' if args.neutral else 'scenario-flow.case.json')).resolve()
    cases = json.loads(case_path.read_text())['cases'] if args.neutral or args.cases_file else [json.loads(case_path.read_text())]
    manifest = runner.source_manifest(ROOT, case_path, Path(__file__), cases, 'unified')
    if args.baseline_root:
        LIBRARY_ROOT = args.baseline_root.resolve()
        # Same neutral prompt and reference loading policy; freeze the actual baseline references and code.
        class BaselineReferences(ReferenceInjection):
            def __init__(self, root, case, include_examples=False):
                super().__init__(LIBRARY_ROOT, {k:v for k,v in case.items() if k != 'scene'}, include_examples)
        runner.ReferenceInjection = BaselineReferences
        manifest['baselineRoot'] = str(LIBRARY_ROOT)
        manifest['baselineHashes'] = {str(p.relative_to(LIBRARY_ROOT)): sha(p) for p in
            (LIBRARY_ROOT/'metriccanvas-authoring/tool/metriccanvas_authoring').rglob('*.py')}
        manifest['baselineHashes'].update({str(p.relative_to(LIBRARY_ROOT)):sha(p) for p in
            (LIBRARY_ROOT/'metriccanvas-authoring/skill/metriccanvas-platform-authoring').rglob('*.md')})
    manifest.update(evidenceKind='real-model-local-fixture', parameters=runner.PARAMS,
                    tokenBudget=350000, maxModelStepsPerTurn=6, limitations=runner.LIMITATIONS)
    for path in [HERE / 'scenario_flow_server.py', ROOT / 'tools/dqe-sim/fixtures/flow-analysis-report.json', ROOT / 'pages/flow-analysis-report.json']:
        manifest['sourceHashes'][str(path.relative_to(ROOT))] = sha(path)
    runner.dump(args.output / 'manifest.json', manifest)
    runner.Client = fixture_client
    # A worktree may deliberately have no secrets file.  Callers can point to an
    # existing local runtime configuration; its values stay in memory only.
    config_path = Path(os.environ.get('METRICCANVAS_EVAL_CONFIG', ROOT / 'apps/platform/.env'))
    configuration = runner.config(config_path)
    for case in cases:
        SCENE = case.get('scene', 'business-report')
        DATA_PROFILE = case.get('dataProfile', 'basic')
        for repeat in range(1, (args.repeats if args.neutral or args.cases_file else 1)+1):
            transport = runner.HttpTransport(configuration, 350000)
            result = await runner.run_case({**case,'repeat':repeat}, args.output / case['id'] / str(repeat), transport)
            print(json.dumps({'case':case['id'],'repeat':repeat,**{k: result.get(k) for k in ['status', 'reason', 'modelRequests', 'toolCalls', 'candidateCount']}}, ensure_ascii=False),flush=True)


if __name__ == '__main__':
    asyncio.run(main())

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

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def fixture_client(configuration):
    server = configuration['mcpServers']['content']
    server['args'][0] = str(HERE / 'scenario_flow_server.py')
    server['env'].update(FASTMCP_CHECK_FOR_UPDATES='off', FASTMCP_SHOW_SERVER_BANNER='false')
    return Client(configuration)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    args.output.mkdir(parents=True, exist_ok=False, mode=0o700)
    case_path = HERE / 'scenario-flow.case.json'
    case = json.loads(case_path.read_text())
    manifest = runner.source_manifest(ROOT, case_path, Path(__file__), [case], 'unified')
    manifest.update(evidenceKind='real-model-local-fixture', parameters=runner.PARAMS,
                    tokenBudget=350000, maxModelStepsPerTurn=6, limitations=runner.LIMITATIONS)
    for path in [HERE / 'scenario_flow_server.py', ROOT / 'tools/dqe-sim/fixtures/flow-analysis-report.json', ROOT / 'pages/flow-analysis-report.json']:
        manifest['sourceHashes'][str(path.relative_to(ROOT))] = sha(path)
    runner.dump(args.output / 'manifest.json', manifest)
    runner.Client = fixture_client
    transport = runner.HttpTransport(runner.config(ROOT / 'apps/platform/.env'), 350000)
    result = await runner.run_case(case, args.output / case['id'], transport)
    print(json.dumps({k: result.get(k) for k in ['status', 'reason', 'modelRequests', 'toolCalls', 'candidateCount']}, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())

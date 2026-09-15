"""Read-only model-eval preflight: no model/network call, no credentials in output."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
from eval_evidence import injection_paths, sha, verify_hashes


async def inspect(root, config_path):
    from run_local import config
    from fastmcp import Client
    folder=Path(__file__).parent
    provenance=json.loads((folder/'history/first-round.provenance.json').read_text())
    raw=Path(provenance['rawEvidencePath'])
    mismatches=verify_hashes(raw,provenance['rawFileHashes'])
    configuration='available'
    try:config(config_path)
    except (OSError,ValueError):configuration='missing-or-incompatible'
    suite=json.loads((folder/'unified-authoring.cases.json').read_text())
    missing={arm:sorted({str(p.relative_to(root)) for c in suite['cases'] for p in injection_paths(root,c,arm) if not p.is_file()}) for arm in ['baseline','unified']}
    client_config={'mcpServers':{'content':{'command':sys.executable,'args':['-m','metriccanvas_authoring.content_server'],'env':{'PYTHONPATH':str(root/'metriccanvas-authoring/tool'),'PYTHONDONTWRITEBYTECODE':'1'}}}}
    async with Client(client_config) as client:
        definitions=await client.list_tools()
    return {'modelRequests':0,'configuration':configuration,
            'dependencies':{n:importlib.metadata.version(n) for n in ['fastmcp','httpx','jsonschema','pydantic']},
            'registeredTools':{t.name:hashlib.sha256(json.dumps(t.inputSchema,sort_keys=True).encode()).hexdigest() for t in definitions},
            'suiteSha256':sha(folder/'unified-authoring.cases.json'), 'missingInjectionSources':missing,
            'historicalRawFiles':len(provenance['rawFileHashes']), 'historicalHashMismatches':mismatches,
            'historicalSourceHashes':{p.name:sha(p) for p in sorted((folder/'history').iterdir()) if p.is_file()},
            'routing':'blocked: local manual Skill assignment','latest':'blocked: local fixture baseline only',
            'dataServices':'blocked: not configured in isolated child environment'}


async def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--config',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    report=await inspect(Path(__file__).resolve().parents[3],a.config)
    with a.output.open('x') as f:json.dump(report,f,ensure_ascii=False,indent=2);f.write('\n')
    print(json.dumps({'modelRequests':0,'configuration':report['configuration'],'tools':list(report['registeredTools']),'historicalHashMismatches':report['historicalHashMismatches']}))

if __name__=='__main__':asyncio.run(main())

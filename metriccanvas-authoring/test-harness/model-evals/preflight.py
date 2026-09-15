"""Read-only model-eval preflight: no model/network call, no credentials in output."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
from eval_evidence import injection_paths, sha, verify_hashes


SURFACES = {
    'legacy-content': ('metriccanvas_authoring.content_server', 'metriccanvas-content'),
    'unified-content': ('metriccanvas_authoring.unified_content_server', 'metriccanvas-platform-content'),
}
LEGACY_TOOLS = {'discover_data_context', 'compose_page', 'create_content_page', 'edit_page'}


def client_configuration(root, surface='legacy-content'):
    module, _ = SURFACES[surface]
    return {'mcpServers':{'content':{'command':sys.executable,'args':['-m',module],
            'env':{'PYTHONPATH':str(root/'metriccanvas-authoring/tool'),'PYTHONDONTWRITEBYTECODE':'1'}}}}


def surface_evidence(surface, definitions):
    _, name = SURFACES[surface]
    expected = LEGACY_TOOLS | ({'read_page_context'} if surface == 'unified-content' else set())
    errors = []
    names = [t.name for t in definitions]
    if set(names) != expected or len(names) != len(expected):
        errors.append('Registered tool set does not match selected surface')
    if surface == 'unified-content':
        for tool in definitions:
            schema = tool.inputSchema
            properties = schema.get('properties', {})
            if 'context_ref' not in schema.get('required', []) or properties.get('context_ref', {}).get('type') != 'string':
                errors.append(tool.name + ': required string context_ref missing')
            if {'page_id', 'baseline_token', 'source_token'} & properties.keys():
                errors.append(tool.name + ': legacy identity/token input exposed')
    return {'surface':surface, 'expectedServerName':name,
            'introspection':{'status':'fail' if errors else 'pass', 'errors':errors,
                             'scope':'Tool names and input schemas only; no content tool invoked'},
            'modelRunner':{'status':'blocked' if surface == 'unified-content' else 'not-run',
                           'reason':'Unsupported: run_local.py has no trusted current-turn port injection; legacy tokens cannot evaluate S2'
                           if surface == 'unified-content' else 'S1 legacy runner only; real model authorization required'},
            'trustedCurrentTurn':{'status':'blocked', 'reason':'No trusted provider injected by this preflight'},
            'writeReadiness':'blocked: listing tools does not prove usable write capability',
            'latest':'blocked: introspection does not verify provider latest semantics'}


async def inspect(root, config_path, surface='legacy-content'):
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
    client_config=client_configuration(root, surface)
    async with Client(client_config) as client:
        definitions=await client.list_tools()
    return {'modelRequests':0,'configuration':configuration,
            'dependencies':{n:importlib.metadata.version(n) for n in ['fastmcp','httpx','jsonschema','pydantic']},
            'registeredTools':{t.name:hashlib.sha256(json.dumps(t.inputSchema,sort_keys=True).encode()).hexdigest() for t in definitions},
            'suiteSha256':sha(folder/'unified-authoring.cases.json'), 'missingInjectionSources':missing,
            'historicalRawFiles':len(provenance['rawFileHashes']), 'historicalHashMismatches':mismatches,
            'historicalSourceHashes':{p.name:sha(p) for p in sorted((folder/'history').iterdir()) if p.is_file()},
            'routing':'blocked: local manual Skill assignment','latest':'blocked: local fixture baseline only',
            'dataServices':'blocked: not configured in isolated child environment',
            **surface_evidence(surface, definitions)}


async def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--config',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--surface',choices=sorted(SURFACES),default='legacy-content');a=p.parse_args()
    report=await inspect(Path(__file__).resolve().parents[3],a.config,a.surface)
    with a.output.open('x') as f:json.dump(report,f,ensure_ascii=False,indent=2);f.write('\n')
    print(json.dumps({'modelRequests':0,'configuration':report['configuration'],'tools':list(report['registeredTools']),'historicalHashMismatches':report['historicalHashMismatches']}))

if __name__=='__main__':asyncio.run(main())

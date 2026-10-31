"""Local program-channel example, independent of Relay SDK or the source repository."""
from pathlib import Path
import json
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from mc_content import compile_layout, inspect_assembly, preflight, query_content
from mc_resources import value_digest


def run():
    environment = preflight('all')
    if environment['status'] != 'ok':
        return {'status': 'not_run', 'environment': environment}
    identity = query_content('version')
    if identity['truncated'] or identity['content'] is None:
        return {'status': 'not_run', 'reason': 'Complete content identity is required.'}
    version = identity['content']['alignedWith']['pageSchemaVersion']
    request = {'requestId': 'synthetic-program-association',
        'templateRef': {'scene': 'business-report', 'variant': 'standard', 'templateVersion': '1'},
        'plan': {'title': '本地合成调用', 'sources': {}, 'sections': [{'id': 'summary',
            'blocks': [{'id': 'note', 'type': 'text', 'body': '合成程序验收'}]}]}}
    compiled = compile_layout(request)
    if compiled['status'] != 'ok':
        return {'status': compiled['status'], 'compile': compiled}
    document = {'id': 'synthetic-program-association', 'schemaVersion': version, 'layout': 'dashboard', 'dataSources': {},
        'sections': [{'id': 'header', 'components': [{'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': '本地合成调用'}}]},
            {'id': 'summary', 'components': [{'id': 'note', 'type': 'text', 'layout': {'span': 12}, 'props': {'body': '合成程序验收'}}]}]}
    spec = compiled['inspectionSpec']
    correlation = {'requestId': request['requestId'], 'compileInput': request,
        'documentSha256': value_digest(document), 'inspectionSpecSha256': value_digest(spec)}
    report = inspect_assembly(document, spec, correlation=correlation)
    return {'status': 'ok' if report['status'] == 'ok' and report.get('correlation', {}).get('status') == 'checked' else 'not_run',
        'compileStatus': compiled['status'], 'inspectionStatus': report['status'],
        'correlation': report.get('correlation'), 'notVerified': report.get('notVerified'),
        'scope': 'synthetic local program example; no Relay registration, data execution or save'}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(run(), ensure_ascii=False))

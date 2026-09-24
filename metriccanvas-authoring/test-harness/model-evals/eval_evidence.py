"""Offline evidence checks. No model calls; missing evidence never passes."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import re


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def injection_paths(root, case, arm):
    skills = root/'metriccanvas-authoring/skill'
    if arm == 'baseline':
        folder = skills/('metriccanvas-platform-create' if case['workflow'] == 'create' else 'metriccanvas-platform-edit')
        return [folder/n for n in ['SKILL.md', 'references/platform-authoring.md', 'references/layouts/report.md', 'references/layouts/dashboard.md']]
    folder = skills/'metriccanvas-platform-authoring'
    paths = [folder/'SKILL.md', folder/'references/tools.md']
    if case['workflow']:
        paths.append(folder/'workflows'/f"{case['workflow']}.md")
    if case['workflow'] == 'create' or case['expected'].get('operation') == 'set_page_layout':
        layout = case['expected'].get('layout', 'report')
        paths.append(folder/'references/layouts'/f'{layout}.md')
    if case['workflow'] == 'create':
        paths.append(folder/'references/scenarios.md')
        design = folder/'references/reading-design.md'
        if design.is_file(): paths.append(design)  # Frozen pre-v3 arms have no such reference.
        if case.get('scene') in {'business-report', 'usage-report'}:
            paths.append(folder/'references/scenarios'/f"{case['scene']}.md")
    return paths


def legacy_runner_protocol(skill_path):
    """Fail closed unless repository-style frontmatter declares the S1 protocol.

    This deliberately accepts only the existing block-list metadata convention;
    unknown/ambiguous YAML forms require explicit harness support, not guessing.
    """
    reason = 'Unsupported Skill protocol: legacy runner requires metriccanvas-content and S1 tools'
    try:
        text = skill_path.read_text()
        parts = text.split('---', 2)
        if len(parts) != 3 or parts[0].strip():
            raise ValueError('Missing frontmatter')
        header = parts[1]
        servers = re.findall(r'^  mcp_servers:\s*\n((?:    - [a-z0-9_-]+\n)+)(?=\s*\Z)', header, re.M)
        allowed = re.findall(r'^allowed-tools:\s*\n((?:  - [a-z0-9_]+\n)+)(?=^[^ \t]|\Z)', header, re.M)
        metadata = re.findall(r'^metadata:\s*$', header, re.M)
        if len(servers) != 1 or len(allowed) != 1 or len(metadata) != 1:
            raise ValueError('Unsupported metadata')
        server_names = [line.strip()[2:] for line in servers[0].splitlines()]
        tool_names = [line.strip()[2:] for line in allowed[0].splitlines()]
        if server_names != ['metriccanvas-content'] or not tool_names or not set(tool_names) <= {'discover_data_context', 'compose_page', 'create_content_page', 'edit_page'}:
            raise ValueError('Incompatible protocol')
        return {'status':'pass', 'skillSha256':sha(skill_path), 'servers':server_names,
                'reason':'S1 legacy content protocol; no trusted current-turn claim'}
    except (OSError, ValueError):
        return {'status':'blocked', 'reason':reason, 'modelRequests':0,
                'skillSha256':sha(skill_path) if skill_path.is_file() else None}


def select_tools(definitions, profile, production):
    registered = {t.name for t in definitions}
    if profile == 'diagnostic':
        return definitions
    if not production or len(set(production)) != len(production) or not set(production) <= registered:
        raise ValueError('Production tool allowlist missing, duplicated or not registered')
    return [t for t in definitions if t.name in production]


def source_manifest(root, suite, runner, cases, arm):
    files = {suite, runner, Path(__file__)}
    for case in cases:
        files.update(injection_paths(root, case, arm))
    for relative in ['bundle.lock.json', 'contract-lock.json', 'tool/requirements.lock', 'tool/metriccanvas_authoring/bootstrap/adapter_contract.py', 'tool/metriccanvas_authoring/bootstrap/deployment.py']:
        files.add(root/'metriccanvas-authoring'/relative)
    files.update((root/'metriccanvas-authoring/tool/metriccanvas_authoring').rglob('*.py'))
    files.add(root/'metriccanvas-authoring/test-harness/tests/test_page_editing.py')
    files.add(root/'packages/page/fixtures/contract-valid/composite-page.json')
    return {'head':subprocess.check_output(['/Library/Developer/CommandLineTools/usr/bin/git','rev-parse','HEAD'],cwd=root,text=True).strip(),
            'sourceHashes':{str(p.relative_to(root)):sha(p) for p in sorted(files)},
            'workingTreeStatus':subprocess.check_output(['/Library/Developer/CommandLineTools/usr/bin/git','status','--porcelain'],cwd=root,text=True).splitlines(),
            'suiteSha256':sha(suite), 'cases':[c['id'] for c in cases]}


def audit_messages(value, secret=''):
    if secret and secret in json.dumps(value, ensure_ascii=False):
        raise ValueError('Credential in evidence')
    if isinstance(value, dict):
        if {'schemaVersion','dataSources','sections'} <= value.keys() or 'rows' in value or 'artifactEnvelope' in value:
            raise ValueError('Program artifact or rows in model channel')
        for child in value.values(): audit_messages(child, secret)
    elif isinstance(value, list):
        for child in value: audit_messages(child, secret)
    elif isinstance(value, str):
        try: decoded = json.loads(value)
        except ValueError: return
        if isinstance(decoded, (dict,list)): audit_messages(decoded, secret)


def status(checks):
    states = {c['status'] for c in checks.values()}
    return next((s for s in ['fail','blocked','inconclusive'] if s in states), 'pass' if states else 'inconclusive')


def verify_hashes(folder, hashes):
    errors=[]
    for name,digest in hashes.items():
        path=(folder/name).resolve()
        if not path.is_relative_to(folder.resolve()) or not path.is_file() or sha(path)!=digest:
            errors.append(name)
    return errors


def audit_trace(folder, calls):
    requests=sorted(folder.glob('request-*.json'))
    responses=sorted(folder.glob('response-*.json'))
    if not requests or len(requests)!=len(responses) or len(responses)!=len(calls):
        return {'status':'inconclusive','reason':'Missing or incomplete original request/response trace'}
    models=[]
    try:
        for request_path in requests:
            request=json.loads(request_path.read_text())
            audit_messages(request['messages'])
            response_path=folder/request_path.name.replace('request-','response-',1)
            response=json.loads(response_path.read_text())
            models.append(response['model'])
            usage=response['usage']
            if not isinstance(usage.get('total_tokens'),int):raise ValueError('Missing token accounting')
        if sorted(models)!=sorted(c.get('model','') for c in calls):
            raise ValueError('Model trace mismatch')
    except (KeyError, ValueError, OSError, TypeError, AttributeError):
        return {'status':'fail','reason':'Original trace invalid or model-channel safety violation'}
    return {'status':'pass','reason':'Original requests/responses present and model-channel artifact check passed'}


def score(case, folder, review=None):
    raw=json.loads((folder/'result.json').read_text())
    non_model=raw.get('evidenceKind') == 'non-model-evidence'
    unified=raw.get('protocol') == 'unified-content'
    checks={}
    if non_model:checks['evidenceKind']={'status':'blocked','reason':'Scripted transport is non-model-evidence regardless of review'}
    def check(name, passed, reason):
        checks[name]={'status':'pass' if passed else 'fail','reason':reason}
    if raw.get('status') == 'blocked':
        checks['execution']={'status':'blocked','reason':raw.get('reason','Runtime unavailable')}
    turns=raw.get('turns',[])
    calls=[c for t in turns for c in t.get('calls',[])]
    checks['rawTrace']={'status':'blocked','reason':'No real model transport'} if non_model else audit_trace(folder,calls)
    tools=[t for c in calls for t in c.get('tools',[])]
    operations=[o for t in tools for o in t.get('arguments',{}).get('request',{}).get('operations',[])]
    before=json.loads((folder/'before.json').read_text()) if (folder/'before.json').exists() else None
    after=json.loads((folder/'after.json').read_text()) if (folder/'after.json').exists() else None
    artifacts=[t for t in tools if t.get('artifactSha256')]
    if not calls:
        checks['modelTrace']={'status':'blocked' if raw.get('status')=='blocked' else 'inconclusive','reason':'No model calls'}
    else:
        check('loopCompleted', all(not t.get('error') for t in turns) and len(turns)==len(case['turns']), 'Every requested turn completed within budget')
    # Import the production validator only for actual artifacts.
    if artifacts:
        from run_local import document_sha256, validate_page_document, diff
        check('artifactIntegrity', after is not None and not validate_page_document(after) and document_sha256(after)==artifacts[-1]['artifactSha256'], 'Production validator and document hash')
    else:
        diff=None
    states=[]
    if unified:
        checks['trustedCandidateEvidence']={'status':'inconclusive','reason':'Retired candidate traces are historical evidence only; evaluate current platform artifacts separately'}
    expected=case['expected']
    for name,value in expected.items():
        if name in ['semantic','explainLayoutImpact']:
            continue
        if name=='noDiscovery':
            check(name,not value or not any(t['name']=='discover_data_context' for t in tools),'Actual discovery calls')
        elif name=='noTools':
            if unified:
                checks[name]={'status':'inconclusive','reason':'Original S1 noTools assertion not applicable unchanged: S2 requires read_page_context; frozen expectation retained'}
                check('readOnlyContentBoundary',all(t['name']=='read_page_context' for t in tools),'No discovery or mutation in configuration answer')
            else:check(name,not tools,'Read-only question made no content calls')
        elif name=='tool':check(name,any(t['name']==value for t in tools),'Actual tool call')
        elif name=='target':check(name,any(o.get('componentId')==value for o in operations),'Actual target')
        elif name=='operation':check(name,any(o.get('type')==value for o in operations),'Actual controlled operation')
        elif name=='targets':check(name,[o.get('componentId') for o in operations]==value,'Ordered actual targets')
        elif name in ['layout','creation','preserveExcept','preserveExisting','legalBackdropPreserved','preserveManualColumnWidth','titleValue','freshBaselineEveryTurn']:
            if not artifacts or after is None:
                checks[name]={'status':'blocked' if any(('CONFIG' in i.get('code','') or 'UNAVAILABLE' in i.get('code','')) for t in tools for i in t.get('summary',{}).get('issues',[])) else 'fail','reason':'No verified artifact'}
                continue
            if name=='layout':ok=after['layout']==value
            elif name=='creation':
                ok=before is None and bool(states) and after['id']==states[0]['binding']['pageId'] if unified else before is None and after['id']==turns[0]['context']['page_id']
            elif name=='preserveExcept':ok=set(d['path'] for d in diff(before,after))==set(value)
            elif name=='preserveExisting':
                candidate=json.loads(json.dumps(after));candidate['sections'][0]['components']=candidate['sections'][0]['components'][:len(before['sections'][0]['components'])];ok=candidate==before
            elif name=='legalBackdropPreserved':ok=dict(after,layout=before['layout'])==before
            elif name=='preserveManualColumnWidth':ok=after['sections'][0]['components'][2]['props']['columns'][0]['width']==value
            elif name=='titleValue':ok=after['sections'][0]['components'][2]['props']['title']==value
            else:
                if unified:
                    tokens=[t['context']['context_ref'] for t in turns]
                    ok=len(states)==len(turns) and len(tokens)==len(set(tokens)) and len(states)>1
                    for i in range(1,len(states)):
                        previous=[t for c in turns[i-1].get('calls',[]) for t in c.get('tools',[]) if t.get('artifactSha256')]
                        doc=states[i]['documentJson']
                        ok=ok and bool(previous) and doc is not None and document_sha256(json.loads(doc))==previous[-1]['artifactSha256']
                    for i,turn in enumerate(turns):
                        ok=ok and all(t['arguments'].get('context_ref')==tokens[i] for c in turn.get('calls',[]) for t in c.get('tools',[]))
                else:
                    tokens=[t['context']['baseline_token'] for t in turns]
                    used=[t['arguments'].get('baseline_token') for t in tools if t['name']=='edit_page']
                    ok=len(tokens)==len(set(tokens)) and tokens==used and len(artifacts)>=2 and turns[1]['context']['documentSha256']==artifacts[0]['artifactSha256']
            check(name,ok,'Program artifact/trace comparison; fixture freshness does not prove server latest')
        else:
            checks[name]={'status':'inconclusive','reason':'Unsupported assertion; requires review'}
    # Every answer needs a trace-bound review for false saved/published claims and task semantics.
    digest=sha(folder/'result.json')
    if review and review.get('resultSha256')==digest and review.get('reviewer') and review.get('reason') and review.get('status') in ['pass','fail','blocked','inconclusive']:
        checks['semanticReview']={k:review[k] for k in ['status','reason']}
    else:
        checks['semanticReview']={'status':'inconclusive','reason':'Needs reviewer, reason and exact resultSha256; no canned semantic pass'}
    from protocol_acceptance import protocol_assessment
    assessment=protocol_assessment(case,folder,raw,checks,review)
    return {'id':case['id'],'repeat':raw.get('repeat'),'status':'blocked' if non_model else status(checks),'checks':checks,'evidenceKind':raw.get('evidenceKind'),'modelRequests':raw.get('modelRequests',len(calls)),'simulatedModelCalls':raw.get('simulatedModelCalls',0),
            'resultSha256':digest,'models':sorted({c.get('model','unknown') for c in calls}),
            'modelCalls':len(calls),'toolCalls':len(tools),'seconds':raw.get('seconds'),
            'usage':dict(sum((Counter({k:v for k,v in (c.get('usage') or {}).items() if isinstance(v,(int,float))}) for c in calls),Counter())),
            'routing':'blocked','latestGuarantee':'blocked','protocolAssessment':assessment}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('raw',type=Path);p.add_argument('--reviews',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    suite=json.loads((Path(__file__).parent/'unified-authoring.cases.json').read_text())
    manifest=json.loads((a.raw/'manifest.json').read_text())
    if sha(Path(__file__).parent/'unified-authoring.cases.json') != manifest['suiteSha256']:
        p.error('Suite changed since execution')
    reviews=json.loads(a.reviews.read_text()) if a.reviews else {}
    results=[]
    for case in suite['cases']:
        if case['id'] not in manifest['cases']:continue
        for repeat in range(1,4):
            folder=a.raw/case['id']/str(repeat)
            if not (folder/'result.json').is_file():
                results.append({'id':case['id'],'repeat':repeat,'status':'inconclusive','reason':'Missing repetition'})
            else:results.append(score(case,folder,reviews.get(f"{case['id']}/{repeat}")))
    report={'arm':manifest['arm'],'profile':manifest['toolProfile'],'manifestSha256':sha(a.raw/'manifest.json'),'rawFileHashes':{str(f.relative_to(a.raw)):sha(f) for f in sorted(a.raw.rglob('*.json'))},'counts':dict(Counter(r['status'] for r in results)),'results':results,'protocolCounts':dict(Counter(r['protocolAssessment']['status'] for r in results if r.get('protocolAssessment')))}
    with a.output.open('x') as f:json.dump(report,f,ensure_ascii=False,indent=2);f.write('\n')
    print(json.dumps(report['counts']))

if __name__=='__main__':main()

"""Shared five-tool loop with trusted local fixtures and interchangeable transports.

Scripted runs are non-model-evidence. HTTP is opt-in and still cannot prove remote
latest, Relay routing, save/recovery, or real data provider behavior.
"""
import argparse
import asyncio
from copy import deepcopy
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time
from uuid import uuid4
from fastmcp import Client

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).parent
sys.path[:0]=[str(ROOT/'metriccanvas-authoring/tool'),str(ROOT/'metriccanvas-authoring/test-harness/tests')]
from eval_evidence import audit_messages, injection_paths, sha, source_manifest
from preflight import surface_evidence
from run_local import baseline, config, diff, dump, PARAMS, MAX_CALLS
from model_transport import ScriptedTransport, HttpTransport, deny_network
from trusted_scenarios import scenarios
from test_authoring_turns import Turns
from metriccanvas_authoring.application.authoring_turns import SCOPE_KEYS
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.domain.page_validation import validate_page_document


LIMITATIONS={name:'blocked' for name in ['remoteLatest','relayRouting','save','publish','restartRecovery','realDataProvider','productionIdentity']}


def make_state(case, document=None, turn=1):
    if document is None and turn==1:
        if case.get('context',{}).get('baseline'): document=baseline(case)
        elif case.get('mode','existing')=='existing':
            document=deepcopy(Turns().baseline.document)
            document['sections'][0]['components'][2]['props']['columns'][0]['width']=230
    mode='existing' if document is not None else 'new'
    provider=Turns(mode)
    binding=deepcopy(provider.binding)
    binding.update(contextRef='local-context-'+uuid4().hex, requestId='local-request-'+uuid4().hex,
                   runId='local-run-'+uuid4().hex,turnId='local-turn-'+str(turn)+'-'+uuid4().hex,
                   pageId=document['id'] if document else 'local-page-'+uuid4().hex)
    raw=json.dumps(document,ensure_ascii=False) if document is not None else None
    binding.update(baseRef={'pageId':document['id'],'revisionId':'local-r'+str(turn),'resourceId':'local-synthetic'} if document else None,
                   documentSha256=hashlib.sha256(raw.encode()).hexdigest() if raw else None,
                   selectedComponentId=case.get('context',{}).get('selectedComponentId','table') if document else None)
    scope={k:binding[k] for k in SCOPE_KEYS}
    if case.get('scopeMismatch'):scope['actorId']='local-other-actor'
    return {'binding':binding,'scope':scope,'documentJson':raw,'evidenceKind':'local-synthetic',
            **{key:case.get(key,'local-synthetic') for key in ['turnProvider','dataProvider','candidateProvider']}}


def reject_program_evidence(value):
    if isinstance(value,dict):
        if {'rootBinding','sourceDescriptions','descriptors'} & value.keys() or value.get('type')=='source_description_evidence':
            raise ValueError('Program-only source or binding evidence in model channel')
        for child in value.values():reject_program_evidence(child)
    elif isinstance(value,list):
        for child in value:reject_program_evidence(child)
    elif isinstance(value,str):
        try:decoded=json.loads(value)
        except ValueError:return
        if isinstance(decoded,(dict,list)):reject_program_evidence(decoded)


def model_view(output, name=None):
    if 'modelSummary' in output:
        safe=output['modelSummary']
    elif name=='discover_data_context' and {'ok','matches','dataContextVersion'} <= output.keys() and set(output) <= {'ok','dataContextVersion','businessDomains','matches','resolution','time','intent','structureOperation','issues'}:
        safe=output
    elif name=='read_page_context' and output.get('ok') is True and output.get('view') in ['root','candidate']:
        safe=output  # Production bounded read_page_context projection.
    else: raise ValueError('Unknown tool result envelope')
    audit_messages(safe)
    reject_program_evidence(safe)
    return deepcopy(safe)


def admit_candidate(output, state, records, requested_parent):
    envelope=output.get('artifactEnvelope')
    if envelope is None:return None
    if envelope.get('kind')!='metriccanvas.authoring-candidate':raise ValueError('Unexpected artifact kind')
    record=envelope['artifact']; document=record['document']
    if record['rootBinding']!=state['binding']:raise ValueError('Candidate binding mismatch')
    if output.get('modelSummary',{}).get('status')=='unchanged' and requested_parent==record['candidateRef']:
        if records.get(requested_parent)!=record:raise ValueError('Unchanged candidate differs from admitted record')
        if any(output['modelSummary'].get(k)!=record[k] for k in ['candidateRef','candidateVersion','documentSha256']):raise ValueError('Unchanged summary mismatch')
        return deepcopy(record)
    if record['parentRef']!=requested_parent:raise ValueError('Candidate parent mismatch')
    parent=records.get(requested_parent) if requested_parent else None
    if requested_parent and parent is None:raise ValueError('Unobserved parent candidate')
    if record['candidateVersion']!=(parent['candidateVersion']+1 if parent else 1):raise ValueError('Candidate version mismatch')
    if document_sha256(document)!=record['documentSha256'] or validate_page_document(document):raise ValueError('Invalid candidate artifact')
    if document['id']!=state['binding']['pageId']:raise ValueError('Candidate page mismatch')
    summary=output['modelSummary']
    if any(summary.get(key)!=record[key] for key in ['candidateRef','candidateVersion','documentSha256']):raise ValueError('Candidate summary mismatch')
    if record['candidateRef'] in records and records[record['candidateRef']]!=record:raise ValueError('Candidate mutated')
    records[record['candidateRef']]=deepcopy(record)
    return record


def local_checks(case, results, before, after, records, contexts):
    checks={}
    def check(name,value):checks[name]='pass' if value else 'fail'
    if case.get('expectedError'):
        check('preciseProviderError', bool(results) and all(r.get('issues',[{}])[0].get('code')==case['expectedError'] for r in results))
        check('noCandidate',not records)
        return checks
    check('candidateCreated',bool(records))
    if not records:return checks
    kind=case.get('check')
    if kind=='chain':
        check('candidateChain',len(records)==2 and list(records.values())[-1]['candidateVersion']==2)
    if kind in ['chain','fresh-turn']:
        check('finalTitle',after['sections'][0]['components'][0]['props']['title']=='Final')
        check('untouchedContent',set(d['path'] for d in diff(before,after))=={'/sections/0/components/0/props/title'})
        check('manualWidth',after['sections'][0]['components'][2]['props']['columns'][0]['width']==230)
    if kind=='fresh-turn':
        check('freshLocalContext',len(set(contexts))==2 and list(records.values())[-1]['rootBinding']['baseRef']['revisionId']=='local-r2')
    if kind=='preserve-existing':
        check('preserveExisting',after['sections'][0]['components'][:4]==before['sections'][0]['components'] and all(after['dataSources'][k]==v for k,v in before['dataSources'].items()))
    if kind in ['data','mixed','preserve-existing']:
        check('mappedData',bool(after['dataSources'].get('result')))
        check('sourceEvidenceProgramOnly',any(o.get('type')=='source_description_evidence' for r in records.values() for o in r['operations']))
    if kind=='mixed':check('mixedContent',{'new-chart','new-note'} <= {c['id'] for s in after['sections'] for c in s['components']})
    if kind=='partial':
        check('dependencyFailure',results[-1].get('status')=='partial' and [o['status'] for o in results[-1]['operations']]==['failed','skipped','applied'])
        check('preciseMissingSource',results[-1]['operations'][0]['issues'][0]['code']=='SOURCE_DESCRIPTION_UNAVAILABLE')
        check('noInventedData',after['dataSources']=={})
    check('explicitLayout',after['layout']==case.get('layout','report'))
    return checks


async def run_case(case, folder, transport):
    folder.mkdir(parents=True,mode=0o700,exist_ok=False)
    if case.get('context',{}).get('entry')=='ordinary-ask':
        result={'id':case['id'],'status':'blocked','evidenceKind':transport.evidence_kind,'reason':'RELAY_ROUTING_UNAVAILABLE',
                'modelRequests':0,'simulatedModelCalls':0,'toolCalls':0,'candidateCount':0,'deterministicStatus':'not-evaluated','limitations':LIMITATIONS}
        dump(folder/'result.json',result)
        return result
    state=make_state(case); before=json.loads(state['documentJson']) if state['documentJson'] else None
    after=deepcopy(before);records={};summaries=[];contexts=[];messages=[];calls=[]
    dump(folder/'trusted-state.json',state)
    if before:dump(folder/'before.json',before)
    sources=injection_paths(ROOT,case,'unified')
    # No legacy aliases here: source/identity are trusted-process inputs only.
    system='Local synthetic content evaluation. No tool saves or publishes. '+ '\n\n'.join(p.read_text() for p in sources)
    dump(folder/'injection.json',{str(p.relative_to(ROOT)):sha(p) for p in sources})
    mcp={'mcpServers':{'content':{'command':sys.executable,'args':[str(HERE/'trusted_fixture_server.py'),str(folder/'trusted-state.json')],
         'env':{'PYTHONDONTWRITEBYTECODE':'1','PYTHONPATH':str(ROOT/'metriccanvas-authoring/tool')}}}}
    attempted_before=transport.calls
    start=time.monotonic()
    result={'id':case['id'],'evidenceKind':transport.evidence_kind,'status':'inconclusive', 'protocol':'unified-content','repeat':case.get('repeat',1),'arm':'unified','toolProfile':case.get('toolProfile','diagnostic'),
            'modelRequests':0,'simulatedModelCalls':0,'usage':None,'limitations':LIMITATIONS,'turns':[],
            'originalExpected':case.get('expected',{}),'assertionApplicability':{'noTools':'S2 allows read_page_context; original noTools is not silently redefined; requires protocol-specific review'}}
    try:
        async with Client(mcp) as client:
            definitions=await client.list_tools()
            if surface_evidence('unified-content',definitions)['introspection']['status']!='pass':raise ValueError('Surface mismatch')
            tools=[{'type':'function','function':{'name':t.name,'description':t.description,'parameters':t.inputSchema}} for t in definitions]
            dump(folder/'tools.json',tools)
            for turn,prompt in enumerate(case['prompts'],1):
                if turn>1:
                    state=make_state(case,after,turn)
                    dump(folder/'trusted-state.json',state)
                dump(folder/f'trusted-turn-{turn}.json',state)
                context={'context_ref':state['binding']['contextRef'],'mode':state['binding']['mode'],
                         'baselineAuthority':'local-synthetic; remote latest unverified; next local turn uses last admitted candidate'}
                contexts.append(context['context_ref'])
                messages=[{'role':'system','content':system},{'role':'user','content':json.dumps({'trustedContext':context,'userRequest':prompt},ensure_ascii=False)}]
                transport.begin_turn();tool_count=0;turn_calls=[]
                result['turns'].append({'context':context,'calls':turn_calls})
                for step in range(MAX_CALLS):
                    audit_messages(messages)
                    request=transport.prepare_request({'messages':deepcopy(messages),'tools':tools})
                    dump(folder/f'request-{turn}-{step}.json',request)
                    started=time.monotonic();response=await transport.complete(request)
                    dump(folder/f'response-{turn}-{step}.json',response)
                    call={'model':response.get('model'),'usage':response.get('usage'),'seconds':round(time.monotonic()-started,4),'tools':[]}
                    calls.append(call);turn_calls.append(call)
                    message=response['choices'][0]['message'];messages.append(message)
                    if not message.get('tool_calls'):break
                    for invocation in message['tool_calls']:
                        tool_count+=1
                        if tool_count>12:raise ValueError('Tool budget exhausted')
                        name=invocation['function']['name'];args=json.loads(invocation['function']['arguments'])
                        if name not in {t.name for t in definitions}:raise ValueError('Unknown tool')
                        if any(k in args for k in ['page_id','baseline_token','source_token']):raise ValueError('Legacy argument rejected')
                        started=time.monotonic()
                        output=(await client.call_tool(name,args,raise_on_error=False)).structured_content
                        if not isinstance(output,dict):raise ValueError('Missing structured tool output')
                        record=admit_candidate(output,state,records,args.get('candidate_ref'))
                        safe=model_view(output,name);summaries.append(safe)
                        index=f'{turn}-{step}-{tool_count}'
                        dump(folder/f'program-tool-{index}.json',output)
                        if record:
                            after=deepcopy(record['document']);dump(folder/f'candidate-{index}.json',record)
                        trace={'name':name,'arguments':args,'summary':safe,'programFile':f'program-tool-{index}.json','seconds':round(time.monotonic()-started,4)}
                        if record:trace['artifactSha256']=record['documentSha256']
                        call['tools'].append(trace)
                        messages.append({'role':'tool','tool_call_id':invocation['id'],'content':json.dumps(safe,ensure_ascii=False)})
                else:raise ValueError('Model step budget exhausted')
                audit_messages(messages);dump(folder/f'model-messages-{turn}.json',messages)
        if after:dump(folder/'after.json',after)
        result['deterministicChecks']=local_checks(case,summaries,before,after,records,contexts) if case.get('localSmoke') else {}
        result['deterministicStatus']='fail' if 'fail' in result['deterministicChecks'].values() else 'pass' if result['deterministicChecks'] else 'not-evaluated'
        result['status']='blocked' if transport.evidence_kind=='non-model-evidence' else 'inconclusive'
    except Exception as error:
        result.update(status='blocked',deterministicStatus='fail',error=type(error).__name__)
        if str(error) in {'TOKEN_BUDGET_EXHAUSTED','MODEL_HTTP_ERROR','TOKEN_USAGE_UNAVAILABLE','CREDENTIAL_ECHO'}:result['reason']=str(error)
        # Exact known provider issue codes remain in tool summaries; no arbitrary exception text.
        if transport.evidence_kind=='non-model-evidence': result['localFailure']=str(error) if isinstance(error,(ValueError,AssertionError)) else type(error).__name__
    result.update(modelRequests=transport.calls-attempted_before if transport.evidence_kind!='non-model-evidence' else 0,
                  simulatedModelCalls=sum(1 for c in calls) if transport.evidence_kind=='non-model-evidence' else 0,
                  seconds=round(time.monotonic()-start,4),toolCalls=sum(len(c['tools']) for c in calls),
                  candidateCount=len(records), usage=None if transport.evidence_kind=='non-model-evidence' else [c['usage'] for c in calls])
    dump(folder/'result.json',result)
    return result


def load_cases(suite, selected, transport):
    if suite=='local-smoke':
        cases=scenarios()
        for case in cases:case['localSmoke']=True
        path=HERE/'trusted_scenarios.py'
    else:
        if transport=='scripted':raise ValueError('Frozen model suite has no scripted answers; use local-smoke for transport tests')
        path=HERE/'unified-authoring.cases.json';cases=json.loads(path.read_text())['cases']
        for case in cases:
            case['prompts']=case['turns'];case['mode']='existing' if case['context'].get('baseline') else 'new'
    if selected!=['all']:
        if set(selected)-{c['id'] for c in cases}:raise ValueError('Unknown case')
        cases=[c for c in cases if c['id'] in selected]
    return cases,path


async def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--transport',choices=['scripted','http'],required=True)
    p.add_argument('--profile',choices=['diagnostic','production'],default='diagnostic')
    p.add_argument('--suite',choices=['local-smoke','frozen'],default='local-smoke')
    p.add_argument('--scenario',nargs='+',default=['all']);p.add_argument('--repetitions',type=int,default=3)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--config',type=Path)
    p.add_argument('--allow-real-model',action='store_true');p.add_argument('--token-budget',type=int,default=600000)
    a=p.parse_args()
    if not 1<=a.repetitions<=3:p.error('repetitions must be 1..3; complete model benchmark requires 3')
    if a.transport=='scripted' and (a.config or a.allow_real_model):p.error('scripted never accepts model configuration')
    if a.transport=='http' and not (a.allow_real_model and a.config):p.error('http requires specific external authorization, --allow-real-model and --config')
    cases,suite_path=load_cases(a.suite,a.scenario,a.transport)
    if a.transport=='scripted':deny_network()
    os.umask(0o077);a.output.mkdir(parents=True,mode=0o700,exist_ok=False)
    shared_http=HttpTransport(config(a.config),a.token_budget) if a.transport=='http' else None
    manifest=source_manifest(ROOT,suite_path,Path(__file__),cases,'unified')
    for source in [HERE/'trusted_fixture_server.py',HERE/'model_transport.py',HERE/'trusted_scenarios.py',HERE/'preflight.py',*sorted((ROOT/'metriccanvas-authoring/test-harness/tests').rglob('*.py')),*sorted((ROOT/'metriccanvas-authoring/test-harness/adapters').rglob('*.py')),*sorted((ROOT/'metriccanvas-authoring/test-harness/fixtures').glob('*.json'))]:
        manifest['sourceHashes'][str(source.relative_to(ROOT))]=sha(source)
    manifest.update(arm='unified',toolProfile=a.profile,protocol='unified-content',transport=a.transport,suite=a.suite,repetitions=a.repetitions,evidenceKind='non-model-evidence' if a.transport=='scripted' else 'real-model-local-fixture',
                    limitations=LIMITATIONS,parameters=PARAMS,tokenBudget=a.token_budget,maxModelStepsPerTurn=MAX_CALLS,maxToolCallsPerTurn=12,
                    dependencies={n:importlib.metadata.version(n) for n in ['fastmcp','httpx','jsonschema']})
    dump(a.output/'manifest.json',manifest);results=[]
    for case in cases:
        for repeat in range(1,a.repetitions+1):
            transport=shared_http or ScriptedTransport(case['turns'])
            result=await run_case(dict(case,repeat=repeat,toolProfile=a.profile),a.output/case['id']/str(repeat),transport)
            results.append({'id':case['id'],'repeat':repeat,**{k:result[k] for k in ['status','deterministicStatus','modelRequests','simulatedModelCalls','toolCalls','candidateCount']}})
            print(json.dumps(results[-1]),flush=True)
            if result['deterministicStatus']=='fail':break
        if results[-1]['deterministicStatus']=='fail':break
    report={'evidenceKind':manifest['evidenceKind'],'status':'blocked' if a.transport=='scripted' else 'inconclusive',
            'results':results,'modelRequests':sum(r['modelRequests'] for r in results),'simulatedModelCalls':sum(r['simulatedModelCalls'] for r in results),
            'limitations':LIMITATIONS,'rawHashes':{str(f.relative_to(a.output)):sha(f) for f in sorted(a.output.rglob('*.json'))}}
    dump(a.output/'report.json',report)
    if any(r['deterministicStatus']=='fail' for r in results):raise SystemExit(2)

if __name__=='__main__':asyncio.run(main())

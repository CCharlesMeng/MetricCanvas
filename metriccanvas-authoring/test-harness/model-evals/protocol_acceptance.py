"""Versioned protocol assessment alongside, never in place of, frozen scores."""
from copy import deepcopy
import json
from pathlib import Path
from eval_evidence import sha, status

MAPPING=Path(__file__).with_name('protocol-acceptance.v1.json')


def protocol_assessment(case,folder,raw,original_checks,review=None):
    mapping=json.loads(MAPPING.read_text())
    if raw.get('protocol')!=mapping['protocol'] or case['id'] not in mapping['cases']:return None
    spec=mapping['cases'][case['id']];digest=sha(folder/'result.json')
    checks={key:deepcopy(value) for key,value in original_checks.items() if key not in spec['replacesAssertions']+['semanticReview']}
    def check(name,ok,reason):checks[name]={'status':'pass' if ok else 'fail','reason':reason}
    if sha(MAPPING.with_name('unified-authoring.cases.json'))!=mapping['frozenSuiteSha256']:
        checks['mappingSource']={'status':'blocked','reason':'Frozen suite hash differs from mapping; create a new reviewed mapping'}
    tools=[t for turn in raw.get('turns',[]) for call in turn.get('calls',[]) for t in call.get('tools',[])]
    check('noMutationTools',all(t['name'] not in {'compose_page','create_content_page','edit_page'} for t in tools),'No content creation/edit calls')
    check('noDiscovery',all(t['name']!='discover_data_context' for t in tools),'No business-data discovery for configuration explanation')
    successful=[];pages={}
    try:
        before=json.loads((folder/'before.json').read_text());after=json.loads((folder/'after.json').read_text())
        check('unchangedProgramDocument',before==after and not list(folder.glob('candidate-*.json')),'Full local document unchanged and no candidates')
        for number,turn in enumerate(raw.get('turns',[]),1):
            state=json.loads((folder/f'trusted-turn-{number}.json').read_text())
            binding=state['binding'];target=binding['selectedComponentId']
            if not isinstance(target,str) or not target:raise ValueError('Selected target unavailable')
            for call in turn.get('calls',[]):
                for tool in call.get('tools',[]):
                    if tool['name']!='read_page_context':continue
                    path=(folder/tool['programFile']).resolve()
                    if not path.is_relative_to(folder.resolve()):raise ValueError('Outside evidence directory')
                    output=json.loads(path.read_text())
                    if (tool['arguments'].get('context_ref')==binding['contextRef'] and output==tool['summary']
                            and output.get('ok') is True and output.get('view')=='root'
                            and output.get('targetComponentId')==target and output.get('entries')):
                        pages.setdefault((number,binding['contextRef'],target),[]).append((output,tool['programFile']))
        for group in pages.values():
            offset=0;total=None;names=[];complete=False
            for output,name in sorted(group,key=lambda pair:pair[0]['range']['offset']):
                span=output['range']
                if span['offset']<offset:continue
                if span['offset']!=offset or span['end']-offset!=len(output['entries']):break
                if total is not None and span['total']!=total:break
                total=span['total'];offset=span['end'];names.append(name)
                if offset==total and output.get('nextCursor') is None:complete=True;break
            if complete:successful.extend(names)
        check('successfulCurrentTargetRead',bool(successful),'Completed bounded target configuration read matches program evidence and current context')
    except FileNotFoundError:
        checks['configurationEvidence']={'status':'inconclusive','reason':'Missing program document/current-turn/read evidence'}
    except (KeyError,ValueError,TypeError):
        checks['configurationEvidence']={'status':'fail','reason':'Invalid or mismatched program configuration evidence'}
    version=mapping['mappingVersion']
    reviews=review.get('protocolReviews',{}) if isinstance(review,dict) else {}
    semantic=reviews.get(version,{}) if isinstance(reviews,dict) else {}
    if not isinstance(semantic,dict):semantic={}
    evidence=semantic.get('evidenceFiles',{})
    if not isinstance(evidence,dict):evidence={}
    valid=(semantic.get('reviewer') and semantic.get('reason') and semantic.get('resultSha256')==digest
           and semantic.get('mappingSha256')==sha(MAPPING) and isinstance(evidence,dict) and bool(evidence))
    responses=[]
    try:
        for name,digest_value in evidence.items():
            path=(folder/name).resolve()
            if not path.is_relative_to(folder.resolve()) or sha(path)!=digest_value:valid=False;break
            if path.name.startswith('response-'):
                response=json.loads(path.read_text());message=response['choices'][0]['message']
                if message.get('content') and not message.get('tool_calls'):responses.append(name)
        valid=valid and bool(responses) and bool(successful) and all(name in evidence for name in successful)
    except (OSError,KeyError,TypeError,ValueError):valid=False
    for criterion in spec['semanticCriteria']:
        criteria=semantic.get('criteria',{})
        decision=criteria.get(criterion,{}) if isinstance(criteria,dict) else {}
        if not isinstance(decision,dict):decision={}
        if valid and decision.get('status') in ['pass','fail','blocked','inconclusive'] and decision.get('reason'):
            checks[criterion]={'status':decision['status'],'reason':decision['reason']}
        else:checks[criterion]={'status':'inconclusive','reason':'Requires hash-bound human review of final answer and successful read; no automatic semantic pass'}
    if raw.get('evidenceKind')!='real-model-local-fixture':
        checks['modelEvidence']={'status':'blocked','reason':'Scripted/mock/unclassified traces are not real model evidence'}
    assessment_status='blocked' if raw.get('evidenceKind')!='real-model-local-fixture' else status(checks)
    return {'mappingVersion':version,'mappingSha256':sha(MAPPING),'frozenSuiteSha256':mapping['frozenSuiteSha256'],
            'status':assessment_status,'checks':checks,'scope':mapping['scope']}

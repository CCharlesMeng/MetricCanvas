"""Trace-derived structural and cost evidence. Semantic/visual acceptance is not auto-scored."""
import argparse
import hashlib
import json
import statistics
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'metriccanvas-authoring/tool'))
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from eval_evidence import audit_trace
from metriccanvas_authoring.pages.editing.edit_page import document_sha256


def review(folder):
    raw=json.loads((folder/'result.json').read_text())
    calls=[c for t in raw.get('turns',[]) for c in t.get('calls',[])]
    tools=[t for c in calls for t in c.get('tools',[])]
    page=json.loads((folder/'after.json').read_text()) if (folder/'after.json').exists() else None
    page_origin='completed-run' if page is not None else 'none'
    candidate=None
    if page is None:
        admitted=[t for t in tools if t.get('artifactSha256')]
        if admitted:
            last=admitted[-1]
            path=folder/last['programFile'].replace('program-tool-','candidate-',1)
            if path.exists():
                candidate=json.loads(path.read_text())
                if document_sha256(candidate['document']) != last['artifactSha256']:
                    raise ValueError('Candidate hash mismatch')
                page=candidate['document']; page_origin='unfinished-run-last-admitted-candidate'
    plans=[t['arguments']['request']['plan'] for t in tools if 'plan' in t.get('arguments',{}).get('request',{})]
    plan=plans[-1] if plans else None
    if candidate:
        states=[o['state'] for o in candidate.get('operations',[]) if o.get('type')=='structure_state']
        if states: plan=states[-1]['plan']
    components=[c for s in (page or {}).get('sections',[]) for c in s['components']]
    cards=[c for c in components if c['type']=='metricCard']
    changes=[x for c in cards for r in c['props']['rows'] for x in r.get('changes',[])]
    usage={k:sum((c.get('usage') or {}).get(k,0) for c in calls) for k in ['prompt_tokens','completion_tokens','total_tokens']}
    issues=[i for t in tools for i in t.get('summary',{}).get('issues',[])]
    issues += [i for t in tools for o in t.get('summary',{}).get('operations',[]) for i in o.get('issues',[])]
    injection=json.loads((folder/'injection.json').read_text()) if (folder/'injection.json').exists() else {}
    query_trace=folder/'data-executions.jsonl'
    checks={'validPage':page is not None and not validate_page_document(page),
            'v2Plan':plan is not None and plan.get('version')=='2',
            'objectCardSurface':bool(cards) and all(c['props'].get('variant')=='compactSummary' for c in cards),
            'mainChangeHierarchy':bool(changes),
            'sameObjectChanges':all(r['valueField'].get('match')==x['field'].get('match') for c in cards for r in c['props']['rows'] for x in r.get('changes',[])
                                    if isinstance(r['valueField'],dict) and isinstance(x['field'],dict)),
            'oneCreate':sum(t['name']=='create_content_page' for t in tools)==1,
            'modelChannelAudit':audit_trace(folder,calls)['status']=='pass'}
    return {'id':raw['id'],'repeat':raw.get('repeat'),'runnerStatus':raw['status'],
        'runnerError':raw.get('error'),'runnerReason':raw.get('reason'),
        'pageOrigin':page_origin,'completedRun':raw['status']!='blocked',
        'modelResponses':len(calls),'models':sorted({c.get('model') for c in calls}),
        'traceAudit':audit_trace(folder,calls),
        'resultSha256':hashlib.sha256((folder/'result.json').read_bytes()).hexdigest(),
        'modelRequests':raw['modelRequests'],'toolCalls':raw['toolCalls'],'candidateCount':raw['candidateCount'],
        'dataQueries':len(query_trace.read_text().splitlines()) if query_trace.exists() else 0,
        'seconds':raw['seconds'],**usage,'checks':checks,'issues':issues,
        'cards':len(cards),'compactCards':sum(c['props'].get('variant')=='compactSummary' for c in cards),
        'changeBindings':len(changes),'missingBlocks':sum(c['id'].startswith('structure-missing-') for c in components),
        'sections':[{'id':s['id'],'title':s['title'],'businessQuestion':s.get('businessQuestion'),
                    'businessObject':s.get('businessObject'),'distinctFrom':s.get('distinctFrom'),
                    'blocks':[{'id':b['id'],'purpose':b.get('purpose'),'source':b.get('source')} for b in s['blocks']]} for s in (plan or {}).get('sections',[])],
        'injection':injection,'businessReview':'pending-human-review','visualReview':'user-owned'}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--new',type=Path,required=True);p.add_argument('--baseline',type=Path);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    report={'evidenceKind':'trace-derived-structural-review','visualAcceptance':'user-owned','arms':{}}
    for label,root in [('v2',args.new),('v1',args.baseline)]:
        if root is None or not root.exists():
            report['arms'][label]={'status':'not-executed','runs':[]};continue
        runs=[review(f.parent) for f in sorted(root.glob('*/*/result.json'))]
        groups={}
        for id in sorted({r['id'] for r in runs}):
            selected=[r for r in runs if r['id']==id]
            groups[id]={'runs':len(selected),'medians':{k:statistics.median(r[k] for r in selected) for k in
                ['modelRequests','toolCalls','dataQueries','prompt_tokens','completion_tokens','total_tokens','seconds']}}
        report['arms'][label]={'runs':runs,'groups':groups}
    if args.baseline and args.baseline.exists():
        new_tools={hashlib.sha256(f.read_bytes()).hexdigest() for f in args.new.glob('*/*/tools.json')}
        old_tools={hashlib.sha256(f.read_bytes()).hexdigest() for f in args.baseline.glob('*/*/tools.json')}
        report['toolSchemaComparison']={'identical':bool(new_tools) and new_tools==old_tools,
            'newHashes':sorted(new_tools),'baselineHashes':sorted(old_tools)}
        report['comparisonConclusion']='requires-runtime-origin-verification; never infer full-version isolation from reference hashes'
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({a: v.get('groups',v.get('status')) for a,v in report['arms'].items()},ensure_ascii=False))


if __name__=='__main__': main()

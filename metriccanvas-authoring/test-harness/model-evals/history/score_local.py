"""Reproduce deterministic assertions and attach explicit human semantic review.

Input: restricted local run directory. Output: shareable evidence without pages/rows.
Does not call a model or alter first-run traces.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from run_local import diff, document_sha256, validate_page_document

REVIEW = {
 'create-report': {'reason':'报告被识别为数据页面；发现失败后明确停止，不冒称创建。'},
 'create-dashboard': {'reason':'明确采用 dashboard；数据发现配置错误后停止。'},
 'create-user-choice': {'explicitChoiceWins':True, 'reason':'明确采用用户指定 dashboard，未以经营分析用途改成 report。'},
 'create-ambiguous': {'clarifyBeforeCreation':True,'reason':'首轮未调用工具，先问用途；回答后确认 report，但数据配置阻塞产物。'},
 'missing-baseline': {'awaitTrustedBaseline':True,'reason':'请求可信基线并等待，无工具调用；运行器 page_id 字段被误当已有页 ID，身份措辞不能据此验收。'},
 'ambiguous-target': {'clarifyTarget':True,'reason':'询问目标组件和新标题，未调用编辑。'},
 'switch-dashboard': {'explainLayoutImpact':True,'reason':'解释宽度、标题/容器/span 保留、单列回流和工具栏显示。'},
 'switch-report-backdrop': {'reason':'解释报告定宽、工具栏隐藏、轨道保留及铺底窄屏回流。'},
}

def sha(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def main():
 parser=argparse.ArgumentParser();parser.add_argument('raw',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
 cases=json.loads((Path(__file__).parent/'platform-authoring.cases.json').read_text())['cases']
 results=[];totals=Counter(); tools_counter=Counter(); models=set()
 for case in cases:
  folder=args.raw/case['id'];raw=json.loads((folder/'result.json').read_text())
  calls=[c for t in raw['turns'] for c in t['calls']]
  tool_calls=[x for c in calls for x in c['tools']]
  operations=[o for x in tool_calls for o in x['arguments'].get('request',{}).get('operations',[])]
  before=json.loads((folder/'before.json').read_text()) if (folder/'before.json').exists() else None
  after=json.loads((folder/'after.json').read_text()) if (folder/'after.json').exists() else None
  artifacts=[x for x in tool_calls if x.get('artifactSha256')]
  checks={}
  def check(key,ok,reason): checks[key]={'status':'pass' if ok else 'fail','reason':reason}
  for key,value in case['expected'].items():
   if key in ['skill','platformSkillsNotSelected']:
    checks[key]={'status':'blocked','reason':'No real Relay registration/routing; Skill manually assigned from case.expected.'}
   elif key=='layout':
    if artifacts:check(key,after['layout']==value,'Verified complete program artifact layout.')
    else:checks[key]={'status':'blocked','reason':'No creation artifact; stated layout intent alone is insufficient.'}
   elif key=='creation':
    checks[key]={'status':'blocked','reason':'DATA_CONTEXT_CONFIG_ERROR prevented data creation.'}
   elif key=='tool':check(key,any(t['name']==value for t in tool_calls),'Actual tool trace.')
   elif key=='target':check(key,any(o.get('componentId')==value for o in operations),'Actual controlled operation target.')
   elif key=='operation':check(key,any(o.get('type')==value for o in operations),'Actual controlled operation type.')
   elif key=='preserveExcept':check(key, bool(artifacts) and set(d['path'] for d in diff(before,after))==set(value),'Full document recursive equality outside allowed paths.')
   elif key=='preserveExisting':
    expected=json.loads(json.dumps(after));expected['sections'][0]['components']=expected['sections'][0]['components'][:len(before['sections'][0]['components'])]
    check(key,expected==before,'Remove only appended component; complete original document equals before.')
   elif key=='forbiddenTools':check(key,not any(t['name'] in value for t in tool_calls),'Forbidden tools remained visible; none called.')
   elif key=='noEditUntilResolved':check(key,not artifacts and not any(t['name']=='edit_page' for t in tool_calls),'No edit tool or artifact.')
   elif key=='legalBackdropPreserved':check(key,dict(after,layout=before['layout'])==before,'Whole document equality except layout; full validator passes.')
   elif key=='freshBaselineEveryTurn':
    tokens=[t['context']['baseline_token'] for t in raw['turns']]
    used=[x['arguments']['baseline_token'] for x in tool_calls if x['name']=='edit_page']
    check(key,len(set(tokens))==len(tokens) and tokens==used and raw['turns'][1]['context']['documentSha256']==artifacts[0]['artifactSha256'],'New opaque token and exact first artifact hash for second turn.')
   elif key=='preserveManualColumnWidth':check(key,after['sections'][0]['components'][2]['props']['columns'][0]['width']==value,'Program-side complete artifact.')
   elif key=='targets':check(key,[o.get('componentId') for o in operations]==value,'Ordered controlled operation targets.')
   elif key=='newPageIdFromProgram':check(key,bool(artifacts) and after['id']==raw['turns'][0]['context']['page_id'] and after['id']!=before['id'],'Created artifact uses program-assigned new id distinct from baseline ref.pageId.')
   elif key=='originalUntouched':
    token=raw['turns'][0]['context']['baseline_token']
    check(key,json.loads((folder/(token+'.json')).read_text())['document']==before and not any(t['name']=='edit_page' for t in tool_calls),'Original immutable baseline still equals initial document; no edit invocation.')
   elif key in REVIEW.get(case['id'],{}):check(key,REVIEW[case['id']][key],REVIEW[case['id']]['reason'])
   else:checks[key]={'status':'inconclusive','reason':'Requires additional evidence.'}
  if case['group']=='edit':
   unexpected=[x['name'] for x in tool_calls if x['name']!='edit_page']
   check('skillAllowedToolScope',not unexpected,'edit Skill allowed-tools only edit_page; observed extra calls: '+str(unexpected))
  if artifacts:
   check('artifactIntegrity',not validate_page_document(after) and document_sha256(after)==artifacts[-1]['artifactSha256'],'Production validator and canonical document hash.')
  local=[v['status'] for k,v in checks.items() if k not in ['skill','platformSkillsNotSelected']]
  status='fail' if 'fail' in local else 'inconclusive' if 'inconclusive' in local else 'blocked' if 'blocked' in local or not local else 'pass'
  for c in calls:
   totals['apiRequests']+=1;models.add(c['model']);u=c.get('usage') or {}
   for name in ['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens']:totals[name]+=u.get(name,0)
   totals['apiSeconds']+=c['seconds']
   for x in c['tools']:tools_counter[x['name']]+=1
  totals['caseSeconds']+=raw.get('seconds',0)
  # No complete page or row-valued diff enters shareable output.
  safe_diffs=[{'path':d['path'],'beforeSha256':sha(d['before']),'afterSha256':sha(d['after'])} for d in raw.get('diff',[])]
  results.append({'id':case['id'],'group':case['group'],'status':status,'statusScope':'local non-routing expected assertions plus Skill tool scope','calibrationReused':raw['phase']=='calibration','assertions':checks,'semanticReview':REVIEW.get(case['id'],{}),'artifactHashes':[t['artifactSha256'] for t in artifacts],'diff':safe_diffs,'seconds':raw.get('seconds',0),'turns':raw['turns'],'criticalViolations':[]})
  # Strip complete structural diffs from tool traces (retained in restricted raw).
  for t in results[-1]['turns']:
   for c in t['calls']:
    for x in c['tools']:x.pop('diff',None)
 summary={'requestedModel':'deepseek-v4-flash','responseModels':sorted(models),'fixedModelVersionVerified':False,'counts':dict(Counter(r['status'] for r in results)),'actualModelCases':sum(bool(r['turns']) for r in results),'totals':dict(totals),'toolCounts':dict(tools_counter),'fee':'unknown: not returned by API','relayRouting':'blocked for all 14 cases','results':results}
 args.output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in summary.items() if k!='results'},ensure_ascii=False,indent=2))

if __name__=='__main__': main()

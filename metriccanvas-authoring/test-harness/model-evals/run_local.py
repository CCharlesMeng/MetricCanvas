"""Bounded direct-model Skill evaluation; never a Relay implementation.

Credentials are read into memory, never copied into child env or evidence.
Run with the project's existing Python environment (fastmcp/httpx installed).
"""
import argparse
import asyncio
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid
import importlib.metadata
from eval_evidence import source_manifest, injection_paths, select_tools, audit_messages

ROOT = Path(__file__).resolve().parents[3]
AUTHORING = ROOT / 'metriccanvas-authoring'
sys.path[:0] = [str(AUTHORING / 'tool'), str(AUTHORING / 'test-harness/tests')]
from fastmcp import Client
import httpx
from test_page_editing import page
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.domain.page_validation import validate_page_document

PARAMS = {'temperature': 0, 'max_tokens': 4096, 'thinking': {'type': 'disabled'}}
MAX_CALLS = 6  # per user turn; no transport retries
MAX_TOTAL_TOKENS = 600000

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    path.chmod(0o600)

def config(path):
    values = {}
    for line in path.read_text().splitlines():
        match = re.match(r'(?:export\s+)?(DEEPSEEK_[A-Z_]+)\s*=\s*(.*)', line)
        if match:
            values[match[1]] = match[2].strip().strip('\"\'')
    for key in ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL']:
        if not values.get(key):
            raise ValueError('Missing configuration: ' + key)
    if values['DEEPSEEK_MODEL'] != 'deepseek-v4-flash':
        raise ValueError('Configured model differs from authorized deepseek-v4-flash')
    if values['DEEPSEEK_BASE_URL'].rstrip('/') != 'https://api.deepseek.com':
        raise ValueError('Configured destination differs from scoped DeepSeek destination')
    return values

def diff(a, b, path=''):
    if type(a) is not type(b):
        return [{'path': path, 'before': a, 'after': b}]
    if isinstance(a, dict):
        result = []
        for key in sorted(a.keys() | b.keys()):
            p = path + '/' + key.replace('~', '~0').replace('/', '~1')
            if key not in a or key not in b:
                result.append({'path': p, 'before': a.get(key), 'after': b.get(key)})
            else:
                result.extend(diff(a[key], b[key], p))
        return result
    if isinstance(a, list):
        result = []
        for i in range(max(len(a), len(b))):
            if i >= len(a) or i >= len(b):
                result.append({'path': path+'/'+str(i), 'before': a[i] if i<len(a) else None, 'after': b[i] if i<len(b) else None})
            else:
                result.extend(diff(a[i], b[i], path+'/'+str(i)))
        return result
    return [] if a == b else [{'path': path, 'before': a, 'after': b}]

def baseline(case):
    context = case['context']
    if not context.get('baseline'):
        return None
    document = page() if context['baseline'] == 'test_page_editing.page' else json.loads((ROOT/context['baseline']).read_text())
    document['schemaVersion'] = '6.2'
    document['layout'] = context['layout']
    if context.get('container'):
        document['sections'][0]['container'] = context['container']
    for path, value in context.get('manualChanges', {}).items():
        current = document
        parts = path.strip('/').split('/')
        for part in parts[:-1]:
            current = current[int(part)] if isinstance(current,list) else current[part]
        current[parts[-1]] = value
    assert not validate_page_document(document)
    return document

def safe_context(document, folder, turn, new_id, existing):
    context = {'entry':'platform', 'page_id':new_id, 'existingPage':existing,
               'baseline_token':None, 'externalDataServices':'not configured; do not invent business data'}
    if document:
        token = 'baseline-' + uuid.uuid4().hex
        ref = {'pageId':document['id'], 'revisionId':f'fixture-r{turn}', 'resourceId':'isolated-eval'}
        dump(folder/(token+'.json'), {'ref':ref, 'document':document, 'documentSha256':document_sha256(document)})
        context.update(baseline_token=token, baselineRef=ref, documentSha256=document_sha256(document), layout=document['layout'],
                       sections=[{'id':s['id'], 'title':s.get('title'), 'components':[{'id':c['id'],'type':c['type'],'title':c.get('props',{}).get('title')} for c in s['components']]} for s in document['sections']])
    return context

async def run_case(case, cfg, output, phase):
    folder = output/case['id']/str(case['repeat']); folder.mkdir(mode=0o700, parents=True)
    if case['context']['entry'] == 'ordinary-ask':
        result = {'id':case['id'], 'phase':phase, 'status':'blocked', 'reason':'Real ordinary-ask entry/Relay not configured; manual selection cannot validate isolation.', 'turns':[], 'assertions':{k:{'status':'blocked'} for k in case['expected']}}
        dump(folder/'result.json',result)
        return result
    skill = cfg['skill']
    sources = injection_paths(ROOT, case, cfg['arm'])
    system = '本次为隔离的本地 Skill 行为评测；Skill 由测试程序手动选择，不代表 Relay 路由。你只可使用所给可信摘要和内容工具。部署程序已过滤完整产物，不会执行保存。\n' + '\n\n'.join(p.read_text() for p in sources)
    document = baseline(case); original = copy.deepcopy(document)
    if original: dump(folder/'before.json',original)
    result = {'id':case['id'],'phase':phase,'manuallyAssignedSkill':skill,'status':'inconclusive','turns':[], 'assertions':{}, 'repeat':case['repeat'], 'arm':cfg['arm'], 'toolProfile':cfg['profile'], 'routing':'blocked', 'latestGuarantee':'blocked', 'modelVersionVerified':False}
    messages = [{'role':'system','content':system}]
    child_env = {'PYTHONPATH':str(AUTHORING/'tool'), 'PYTHONDONTWRITEBYTECODE':'1', 'METRICCANVAS_CONTENT_BASELINES_DIR':str(folder)}
    mcp_config = {'mcpServers':{'content':{'command':sys.executable,'args':['-m','metriccanvas_authoring.content_server'],'env':child_env}}}
    new_id = 'eval-'+uuid.uuid4().hex
    start = time.monotonic()
    async with Client(mcp_config) as client, httpx.AsyncClient(timeout=120) as http:
        tool_defs = select_tools(await client.list_tools(), cfg['profile'], cfg['productionTools'])
        # All content tools remain visible so forbidden creation attempts are observable.
        tools = [{'type':'function','function':{'name':t.name,'description':t.description or '', 'parameters':t.inputSchema}} for t in tool_defs]
        dump(folder/'tools.json',tools)
        dump(folder/'prompt-sources.json', {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})
        for turn_number, prompt in enumerate(case['turns'],1):
            context = safe_context(document,folder,turn_number,new_id,bool(document) or case['context'].get('existingPage',False))
            context['selectedComponentId'] = case['context'].get('selectedComponentId')
            if document and case['context'].get('includeTargetConfig'):
                context['targetConfig'] = next(c['props'] for section in document['sections'] for c in section['components'] if c['id'] == context['selectedComponentId'])
            messages.append({'role':'user','content':json.dumps({'trustedContext':context,'userRequest':prompt},ensure_ascii=False)})
            turn = {'prompt':prompt,'context':context,'calls':[]}; result['turns'].append(turn)
            for step in range(MAX_CALLS):
                request = {'model':cfg['DEEPSEEK_MODEL'], **PARAMS, 'messages':messages,'tools':tools}
                audit_messages(messages, cfg['DEEPSEEK_API_KEY'])
                # UTF-8 byte count plus protocol reserve conservatively bounds input tokens.
                reserve = len(json.dumps(request, ensure_ascii=False).encode('utf-8')) + 8192 + PARAMS['max_tokens']
                if run_case.tokens + reserve > cfg['tokenBudget']:
                    raise RuntimeError('TOKEN_BUDGET_EXHAUSTED')
                dump(folder/f'request-{turn_number}-{step}.json',request)
                call_start = time.monotonic()
                response = await http.post(cfg['DEEPSEEK_BASE_URL'].rstrip('/')+'/chat/completions',headers={'Authorization':'Bearer '+cfg['DEEPSEEK_API_KEY']},json=request)
                if response.status_code != 200:
                    # Never persist arbitrary provider error bodies or headers.
                    turn['error'] = {'httpStatus':response.status_code}
                    result['status']='blocked'; dump(folder/'result.json',result)
                    raise RuntimeError(f'HTTP {response.status_code}; stopped with no retry')
                payload = response.json()
                if cfg['DEEPSEEK_API_KEY'] in json.dumps(payload):
                    raise RuntimeError('CREDENTIAL_ECHO')
                dump(folder/f'response-{turn_number}-{step}.json',payload)
                call = {'model':payload.get('model'),'usage':payload.get('usage'), 'seconds':round(time.monotonic()-call_start,3), 'finishReason':payload['choices'][0].get('finish_reason'),'tools':[]}
                turn['calls'].append(call)
                usage = payload.get('usage',{}).get('total_tokens')
                if not isinstance(usage, int) or usage < 0:
                    raise RuntimeError('TOKEN_USAGE_UNAVAILABLE')
                run_case.tokens += usage
                if run_case.tokens > cfg['tokenBudget']:
                    raise RuntimeError('Total token limit exceeded; stopped')
                message = payload['choices'][0]['message']
                messages.append(message)
                call['answer'] = message.get('content')
                if not message.get('tool_calls'):
                    break
                for invocation in message['tool_calls']:
                    if sum(len(c['tools']) for c in turn['calls']) >= 12:
                        raise RuntimeError('TOOL_CALL_LIMIT')
                    name = invocation['function']['name']
                    arguments = json.loads(invocation['function']['arguments'])
                    tool_record = {'name':name,'arguments':arguments}; call['tools'].append(tool_record)
                    if name not in {t['function']['name'] for t in tools}:
                        raise RuntimeError('UNREGISTERED_TOOL_ATTEMPT')
                    tool_start = time.monotonic()
                    tool_result = await client.call_tool(name,arguments,raise_on_error=False)
                    tool_record['seconds'] = round(time.monotonic()-tool_start,3)
                    structured = tool_result.structured_content
                    dump(folder/f'tool-{turn_number}-{step}-{len(call["tools"])}.json',structured or {'error':'unstructured_tool_error'})
                    if structured and 'modelSummary' in structured:
                        safe = structured['modelSummary']
                        envelope = structured.get('artifactEnvelope')
                        if envelope:
                            artifact = envelope['artifact']; candidate=artifact['document']
                            assert document_sha256(candidate)==artifact['documentSha256']
                            assert not validate_page_document(candidate)
                            tool_record['artifactSha256']=artifact['documentSha256']
                            tool_record['diff']=diff(document,candidate)
                            document=candidate
                            dump(folder/f'artifact-{turn_number}-{step}.json',candidate)
                    else:
                        safe = structured if structured is not None else {'status':'tool_error'}
                    audit_messages(safe, cfg['DEEPSEEK_API_KEY'])
                    tool_record['summary']=safe
                    messages.append({'role':'tool','tool_call_id':invocation['id'],'content':json.dumps(safe,ensure_ascii=False)})
            else:
                turn['error']={'code':'MODEL_LOOP_LIMIT'}
            dump(folder/'result.json',result)
    result['seconds']=round(time.monotonic()-start,3)
    if document:
        dump(folder/'after.json',document)
        result['finalSha256']=document_sha256(document)
        result['diff']=diff(original,document)
    dump(folder/'result.json',result)
    print(json.dumps({'case':case['id'],'phase':phase,'seconds':result['seconds'],'tokensSoFar':run_case.tokens}),flush=True)
    return result
run_case.tokens = 0

async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--arm', choices=['baseline', 'unified'], required=True)
    parser.add_argument('--profile', choices=['diagnostic', 'production'], required=True)
    parser.add_argument('--production-tools', nargs='+')
    parser.add_argument('--cases', nargs='+')
    parser.add_argument('--token-budget', type=int, default=600000)
    args = parser.parse_args()
    if not 4096 <= args.token_budget <= MAX_TOTAL_TOKENS:
        parser.error('token budget must be between 4096 and 600000')
    os.umask(0o077)
    # Exclusive output protects all historical and prior-repeat evidence.
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    suite_path = Path(__file__).parent/'unified-authoring.cases.json'
    suite = json.loads(suite_path.read_text())
    cases = suite['cases']
    if args.cases:
        unknown = set(args.cases)-{c['id'] for c in cases}
        if unknown: parser.error('unknown case ids')
        cases = [c for c in cases if c['id'] in args.cases]
    cfg = config(args.config)
    cfg.update(arm=args.arm, profile=args.profile, productionTools=args.production_tools,
               skill='metriccanvas-platform-authoring' if args.arm == 'unified' else 'legacy-manual-workflow', tokenBudget=args.token_budget)
    # Missing sources fail before any billable request.
    for case in cases:
        for source in injection_paths(ROOT, case, args.arm):
            if not source.is_file(): raise ValueError('Missing injection source: '+str(source))
    if args.profile == 'production' and not args.production_tools:
        parser.error('production profile requires confirmed --production-tools')
    manifest = source_manifest(ROOT, suite_path, Path(__file__), cases, args.arm)
    manifest.update(model=cfg['DEEPSEEK_MODEL'], parameters=PARAMS, maxCallsPerTurn=MAX_CALLS, maxToolCallsPerTurn=12,
                    tokenBudget=args.token_budget, retries=0, arm=args.arm, toolProfile=args.profile,
                    productionTools=args.production_tools, repetitions=3,
                    dependencies={n:importlib.metadata.version(n) for n in ['fastmcp','httpx','jsonschema','pydantic']},
                    runtime=sys.version, startedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
                    externalBoundary='Real model and production content stdio; local fixture baseline; no Relay/Java/Pangu/data services; no saves',
                    injectionMode='eager case-specific files; no filesystem tool; errors/examples not loaded; missing reference remains blocked')
    dump(args.output/'manifest.json', manifest)
    run_case.tokens = 0
    stopped = False
    try:
        for case in cases:
            for repeat in range(1,4):
                item = dict(case, repeat=repeat)
                if stopped:
                    folder=args.output/case['id']/str(repeat);folder.mkdir(parents=True)
                    dump(folder/'result.json', {'id':case['id'],'repeat':repeat,'status':'blocked','reason':'Batch stopped after runtime failure; no retry','turns':[]})
                    continue
                try:
                    await run_case(item, cfg, args.output, args.arm+'-'+args.profile)
                except Exception as error:
                    folder=args.output/case['id']/str(repeat)
                    path=folder/'result.json'
                    record=json.loads(path.read_text()) if path.exists() else {'id':case['id'],'repeat':repeat,'turns':[]}
                    # Do not serialize provider exception text or credentials.
                    known={'TOKEN_BUDGET_EXHAUSTED','TOKEN_USAGE_UNAVAILABLE','UNREGISTERED_TOOL_ATTEMPT','CREDENTIAL_ECHO','TOOL_CALL_LIMIT','Total token limit exceeded; stopped'}
                    code=str(error) if str(error) in known else type(error).__name__
                    record.update(status='blocked',reason='Runtime stopped: '+code)
                    dump(path,record)
                    stopped=True
    finally:
        manifest.update(totalTokens=run_case.tokens, stopped=stopped,
                        finishedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
        dump(args.output/'manifest.json',manifest)
    if stopped: raise SystemExit(2)

if __name__=='__main__':
    asyncio.run(main())

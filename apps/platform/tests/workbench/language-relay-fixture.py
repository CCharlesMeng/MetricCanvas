"""Explicit external Relay/Java substitute for #146, composing the real public MCP entries.
Never imported by production. HTTP is a loopback test transport, not a proposed service API.
"""
import asyncio
import hashlib
import json
import sys
import uuid
from copy import deepcopy
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
ROOT = Path(__file__).resolve().parents[4]
BUNDLE = ROOT / 'metriccanvas-authoring'
sys.path[:0] = [str(BUNDLE/'tool'), str(BUNDLE/'test-harness'), str(BUNDLE/'test-harness/tests')]
from fastmcp import Client
from content_stdio_server import server as content_server
from metriccanvas_authoring.entrypoints.compat.content_mcp import create_content_mcp_server
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.work.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.entrypoints.compat.lifecycle_mcp import create_lifecycle_mcp_server
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleIdentity, LifecycleError
from lifecycle_stdio_server import ProposedService, Programs, Identities
from content_stdio_server import server, fixture, FakeDataContextPort, FakeDqeExecutionPort, DqeExecutionResult, execution

class TrustedPrograms(Programs):
    async def load(self, token, identity):
        if identity != identities.current(): raise LifecycleError('FORBIDDEN')
        if token not in self.inputs: raise LifecycleError('PROGRAM_NOT_FOUND')
        return deepcopy(self.inputs[token])
class Service(ProposedService):
    conflict = False
    def authorize(self, identity):
        if identity != LifecycleIdentity('developer-1','local','fixture-secret'): raise LifecycleError('FORBIDDEN')
    async def save(self, identity, command):
        if self.conflict:
            self.save_calls += 1
            return {'status':'rejected','operationId':command['context']['operationId'],'code':'REVISION_CONFLICT'}
        return await super().save(identity,command)
class Baselines:
    async def read(self, token):
        context = contexts.get(token)
        if not context or not context['base']: raise ContentBaselineError('BASELINE_NOT_FOUND')
        raw = await service.read(identities.current(), context['base'])
        if raw['ref'] != context['base']: raise ContentBaselineError('BASELINE_REF_MISMATCH')
        return ContentBaseline(raw['ref'], raw['document'], document_sha256(raw['document']))
identities = Identities()
identities.value = LifecycleIdentity('developer-1','local','fixture-secret')
programs = TrustedPrograms()
service = Service()
contexts, notifications, operations, summaries = {}, {}, {}, []
prepared_turns = {}
reads = 0

def authorize(context):
    if (context['actorId'],context['workspaceId']) != ('developer-1','local'): raise LifecycleError('FORBIDDEN')

def model_safe(value):
    text = json.dumps(value)
    assert 'dataSources' not in text and 'artifactEnvelope' not in text and 'fixture-secret' not in text and 'Private body' not in text
    summaries.append(deepcopy(value))

async def tool(name, token):
    async with Client(create_lifecycle_mcp_server(service,programs,identities)) as client:
        result = await client.call_tool(name, {'request_token':token})
        model_safe(result.structured_content)
        return result.structured_content

def delivery(result, context):
    op = context['operationId']
    status = result['status']
    if status == 'saved':
        program = programs.outputs[result['programToken']]
        assert program['context']['operationId'] == op
        assert program['context']['origin']['runId'] == context['runId']
        assert program['base'] == context['base']
        if op not in operations:
            notification = str(uuid.uuid4())
            notifications[notification] = {'binding':deepcopy(context),'ref':deepcopy(result['ref'])}
            operations[op] = notification
        return {'status':'saved','draftId':operations[op], 'operations': contexts[op].get('operations',[])}
    return {'status': 'failed' if status in ('rejected','unavailable') else status, 'operations':contexts[op].get('operations',[])}

async def dispatch(path, body):
    global service, programs, contexts, notifications, operations, summaries, reads, prepared_turns
    if path == '/reset':
        service, programs = Service(), TrustedPrograms()
        contexts, notifications, operations, summaries, reads = {}, {}, {}, [], 0
        prepared_turns = {}
        return {'ok':True}
    if path == '/metrics': return {'saves':service.save_calls,'revisions':len(service.revisions),'reads':reads,'model':summaries,'notifications':list(notifications)}
    if path == '/latest':
        if not service.head or service.head['pageId'] != body['pageId']: raise LifecycleError('PAGE_NOT_FOUND')
        return await dispatch('/revision', {'ref':service.head})
    if path == '/prepare':
        authorize(body)
        mode = body['mode']
        if mode == 'existing':
            latest = body['latest']
            ref = {key:latest[key] for key in ('pageId','revisionId','resourceId')}
            if ref != service.head or body['pageId'] != ref['pageId']: raise LifecycleError('STALE_BASE')
            raw = await service.read(identities.current(), ref)
            if json.loads(body['documentJson']) != raw['document'] or latest['document'] != raw['document']: raise LifecycleError('DOCUMENT_MISMATCH')
            sha = hashlib.sha256(body['documentJson'].encode('utf-8')).hexdigest()
            page_id = ref['pageId']
        else:
            if mode != 'new' or any(body[key] is not None for key in ('pageId','latest','documentJson','selectedComponentId')): raise LifecycleError('INVALID_NEW_BASE')
            ref, sha, page_id = None, None, 'language-page'
        binding = {key:body[key] for key in ('actorId','workspaceId','requestId','runId','turnId','mode','access','selectedComponentId')}
        binding.update(version='1.0',contextRef=str(uuid.uuid4()),capabilityVersion='1.0',status='active',pageId=page_id,baseRef=ref,documentSha256=sha)
        prepared_turns[binding['contextRef']] = deepcopy(binding)
        return binding
    if path == '/run':
        context, mode = deepcopy(body['context']), body['prompt']
        authorize(context)
        binding = context['binding']
        if prepared_turns.get(binding['contextRef']) != binding: raise LifecycleError('TURN_MISMATCH')
        if binding['baseRef'] != context['base'] or binding['requestId'] != context['operationId']: raise LifecycleError('TURN_MISMATCH')
        op = context['operationId']
        if op in contexts: raise LifecycleError('IDEMPOTENCY_CONFLICT')
        contexts[op] = deepcopy(context)
        if mode in ('text','waiting','failed'):
            contexts[op]['terminal'] = mode
            return {'status':mode,'operations':[]}
        request = {'operations':[{'id':'title','type':'set_title','componentId':'text','title':mode}]}
        if mode == 'partial':
            request['operations'] += [{'id':'bad','type':'set_title','componentId':'absent','title':'invalid'}, {'id':'dependent','type':'set_title','componentId':'text','title':'never','dependsOn':['bad']}]
        if mode == 'invalid': request['operations'] = [{'id':'bad','type':'set_title','componentId':'absent','title':'invalid'}]
        content = create_content_mcp_server(ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')), FakeDqeExecutionPort(DqeExecutionResult(rows=execution['rows']))),Baselines())
        async with Client(content) as client:
            if context['base'] is None:
                args = {'page_id':'language-page','title':'Language page','request':{'operations': [{'id':'text','type':'add_text','componentId':'text','sectionId':'main','body':'Private body','title':'Created'}]}}
                if mode == 'invalid': args['request']=request
                result = await client.call_tool('create_content_page',args)
            else: result = await client.call_tool('edit_page',{'baseline_token':op,'request':request})
            payload=result.structured_content
            model_safe(payload['modelSummary'])
            artifact=payload.get('artifactEnvelope')
            contexts[op]['operations']=[{'id':item['id'],'status':item['status']} for item in payload['modelSummary'].get('operations',[])]
        if not artifact:
            contexts[op]['terminal']='failed'
            return {'status':'failed','operations':contexts[op]['operations']}
        artifact=artifact['artifact']
        assert document_sha256(artifact['document']) == artifact['documentSha256']
        if context['base']: assert artifact['baseRef'] == context['base']
        programs.inputs[op]={'kind':'save','context':{'operationId':op,'actorId':context['actorId'],'workspaceId':context['workspaceId'],'origin':{'kind':'relay','skillVersion':'fixture/1','runId':context['runId']}},'pageId':artifact['document']['id'],'base':context['base'],'document':artifact['document'],'description':mode,'retainDimensionValues':context['retainDimensionValues']}
        service.lose_ack = mode == 'lost-ack'
        service.conflict = mode == 'conflict'
        service.lookup_status = {'status':'unknown'} if mode == 'offline' else None
        result=await tool('save_draft',op)
        service.lookup_status = None
        service.conflict = False
        if mode.startswith('slow'): await asyncio.sleep(0.5)
        return delivery(result,context)
    if path == '/lookup':
        context=body['context'];authorize(context); op=context['operationId']
        if op not in contexts: return {'status':'not-applied','operations':[]}
        if contexts[op].get('terminal'): return {'status':contexts[op]['terminal'],'operations':[]}
        return delivery(await tool('get_save_result',op), context)
    if path == '/read':
        reads += 1
        value=notifications[body['draftId']]
        authorize(value['binding'])
        token=str(uuid.uuid4());programs.inputs[token]={'kind':'read','ref':value['ref']}
        result=await tool('read_revision',token)
        assert result['status']=='read', result
        raw=programs.outputs[result['programToken']]
        return {'binding':value['binding'],'draft':{'draftId':body['draftId'],'ref':raw['ref'],'document':raw['document']}}
    if path == '/revision':
        ref=body['ref']; token=str(uuid.uuid4());programs.inputs[token]={'kind':'read','ref':ref}
        result=await tool('read_revision',token);raw=programs.outputs[result['programToken']]
        return {**ref,'document':raw['document'],'revisionNumber':1,'baseRevisionId':None,'contentHash':raw['contentHash'],'createdAt':'','createdBy':'','dataContextVersion':None}
    raise ValueError(path)

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        try:
            body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            result=asyncio.run(dispatch(self.path,body))
            encoded=json.dumps(result,ensure_ascii=False).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(encoded)
        except (BrokenPipeError,ConnectionResetError): pass
        except Exception as error:
            import traceback;traceback.print_exc()
            self.send_response(500);self.end_headers();self.wfile.write(json.dumps({'error':str(error)}).encode())
if __name__ == '__main__':
    print('S1 explicit Relay boundary fixture listening',flush=True)
    HTTPServer(('127.0.0.1',int(sys.argv[1] if len(sys.argv)>1 else 5192)),Handler).serve_forever()

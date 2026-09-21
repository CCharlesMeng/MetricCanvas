"""Interchangeable message transports; shared runner owns every tool invocation."""
from copy import deepcopy
import json
import time
from uuid import uuid4
from eval_evidence import audit_messages
from run_local import PARAMS


class ScriptedTransport:
    evidence_kind = 'non-model-evidence'
    def __init__(self, turns):
        self.turns = iter(turns); self.actions = iter(()); self.calls = 0
    def prepare_request(self, request):return {'model':'scripted-no-model',**PARAMS,**request}
    def begin_turn(self): self.actions = iter(next(self.turns))
    async def complete(self, request):
        self.calls += 1
        action = next(self.actions, None)
        if action is None:
            return {'model':'scripted-no-model', 'usage':None,
                    'choices':[{'message':{'role':'assistant','content':'Script completed (not a model answer).'}}]}
        # Resolve opaque refs exclusively from the same channel an actual model receives.
        current_start = max(i for i,m in enumerate(request['messages']) if m['role']=='user')
        context = json.loads(request['messages'][current_start]['content'])['trustedContext']
        candidate = None
        for m in request['messages'][current_start+1:]:
            if m['role']=='tool':
                value=json.loads(m['content'])
                if value.get('candidateRef'): candidate=value['candidateRef']
        def resolve(v):
            if v=='$context': return context['context_ref']
            if v=='$candidate':
                if candidate is None: raise ValueError('No candidate in model channel')
                return candidate
            if isinstance(v,dict): return {k:resolve(x) for k,x in v.items()}
            if isinstance(v,list): return [resolve(x) for x in v]
            return v
        args=resolve(deepcopy(action['arguments']))
        return {'model':'scripted-no-model','usage':None,'choices':[{'message':{'role':'assistant','content':None,
                'tool_calls':[{'id':'script-'+uuid4().hex,'type':'function','function':{'name':action['name'],'arguments':json.dumps(args,ensure_ascii=False)}}]}}]}


class HttpTransport:
    evidence_kind = 'real-model-local-fixture'
    def __init__(self, configuration, token_budget=600000, client_factory=None, message_auditor=audit_messages):
        if not 4096 <= token_budget <= 600000: raise ValueError('Invalid token budget')
        self.configuration=configuration; self.token_budget=token_budget; self.tokens=0; self.calls=0
        self.client_factory=client_factory
        self.message_auditor=message_auditor
    def begin_turn(self): pass
    def prepare_request(self, request):
        return {'model':self.configuration['DEEPSEEK_MODEL'],**PARAMS,'messages':request['messages'],'tools':request['tools']}
    async def complete(self, request):
        import httpx
        cfg=self.configuration
        payload=request
        if payload.get('model')!=cfg['DEEPSEEK_MODEL'] or any(payload.get(k)!=v for k,v in PARAMS.items()):
            raise ValueError('Request was not prepared with frozen model parameters')
        self.message_auditor(payload['messages'],cfg['DEEPSEEK_API_KEY'])
        reserve=len(json.dumps(payload,ensure_ascii=False).encode())+8192+PARAMS['max_tokens']
        if self.tokens+reserve>self.token_budget: raise RuntimeError('TOKEN_BUDGET_EXHAUSTED')
        factory=self.client_factory or httpx.AsyncClient
        self.calls += 1
        async with factory(timeout=120) as client:
            response=await client.post(cfg['DEEPSEEK_BASE_URL'].rstrip('/')+'/chat/completions',
                headers={'Authorization':'Bearer '+cfg['DEEPSEEK_API_KEY']},json=payload)
        if response.status_code!=200: raise RuntimeError('MODEL_HTTP_ERROR')
        value=response.json()
        if cfg['DEEPSEEK_API_KEY'] in json.dumps(value): raise RuntimeError('CREDENTIAL_ECHO')
        usage=value.get('usage',{}).get('total_tokens')
        if not isinstance(usage,int) or isinstance(usage,bool) or usage<0: raise RuntimeError('TOKEN_USAGE_UNAVAILABLE')
        self.tokens += usage
        if self.tokens>self.token_budget: raise RuntimeError('TOKEN_BUDGET_EXHAUSTED')
        return value


def deny_network():
    """Hard-stop IP networking in scripted parent and synthetic stdio child."""
    import socket
    original_connect=socket.socket.connect
    original_connect_ex=socket.socket.connect_ex
    def checked(method):
        def call(sock, address):
            if sock.family in (socket.AF_INET, socket.AF_INET6):
                raise RuntimeError('NETWORK_FORBIDDEN_IN_LOCAL_SYNTHETIC_RUN')
            return method(sock,address)
        return call
    socket.socket.connect=checked(original_connect)
    socket.socket.connect_ex=checked(original_connect_ex)

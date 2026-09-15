"""Transport/stdio integration tests: no live models, no external data services."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest.mock import patch

EVALS=Path(__file__).resolve().parents[1]/'model-evals'
sys.path.insert(0,str(EVALS))
from model_transport import HttpTransport, ScriptedTransport, deny_network
from run_trusted_local import run_case, load_cases, model_view, admit_candidate
from eval_evidence import score, sha
from trusted_scenarios import scenarios

CONFIG={'DEEPSEEK_API_KEY':'mock-key-not-a-credential','DEEPSEEK_MODEL':'deepseek-v4-flash','DEEPSEEK_BASE_URL':'https://api.deepseek.com'}


class MockHttpClient:
    def __init__(self, payload, status=200):self.payload=payload;self.status=status;self.requests=[]
    async def __aenter__(self):return self
    async def __aexit__(self,*args):pass
    async def post(self,url,**kwargs):
        self.requests.append((url,kwargs))
        class Response:
            status_code=self.status
            def json(inner):return self.payload
        return Response()


class TrustedTransportTest(unittest.IsolatedAsyncioTestCase):
    async def test_http_shape_usage_and_batch_budget_are_shared(self):
        client=MockHttpClient({'model':'mock-only','usage':{'total_tokens':20000},'choices':[{'message':{'role':'assistant','content':'test'}}]})
        transport=HttpTransport(CONFIG,50000,client_factory=lambda **kw:client)
        request=transport.prepare_request({'messages':[{'role':'user','content':'test'}],'tools':[]})
        await transport.complete(request);transport.begin_turn();await transport.complete(request)
        with self.assertRaisesRegex(RuntimeError,'BUDGET'):await transport.complete(request)
        self.assertEqual(transport.calls,2);self.assertEqual(transport.tokens,40000)
        url,sent=client.requests[0]
        self.assertEqual(url,'https://api.deepseek.com/chat/completions')
        self.assertIs(sent['json'],request)
        self.assertEqual(sent['json']['temperature'],0)
        self.assertEqual(sent['json']['thinking'],{'type':'disabled'})
        self.assertEqual(sent['json']['tools'],[])
        self.assertNotIn(CONFIG['DEEPSEEK_API_KEY'],json.dumps(sent['json']))

    async def test_http_error_missing_usage_and_budget_never_retry(self):
        for status,payload,error in [(401,{},'HTTP'),(200,{},'USAGE')]:
            client=MockHttpClient(payload,status)
            transport=HttpTransport(CONFIG,client_factory=lambda **kw:client)
            with self.assertRaisesRegex(RuntimeError,error):await transport.complete(transport.prepare_request({'messages':[],'tools':[]}))
            self.assertEqual(transport.calls,1);self.assertEqual(len(client.requests),1)
        client=MockHttpClient({});transport=HttpTransport(CONFIG,4096,client_factory=lambda **kw:client)
        with self.assertRaisesRegex(RuntimeError,'BUDGET'):await transport.complete(transport.prepare_request({'messages':[],'tools':[]}))
        self.assertEqual(transport.calls,0);self.assertEqual(client.requests,[])

    async def test_shared_stdio_loop_candidate_chain_and_summary_only(self):
        case=scenarios()[0];case['localSmoke']=True
        with tempfile.TemporaryDirectory() as t, patch('httpx.AsyncClient',side_effect=AssertionError('No model HTTP in scripted run')):
            folder=Path(t)/'run'
            result=await run_case(case,folder,ScriptedTransport(case['turns']))
            self.assertEqual(result['deterministicStatus'],'pass',result)
            self.assertEqual(result['modelRequests'],0)
            self.assertGreater(result['simulatedModelCalls'],0)
            messages=json.loads((folder/'model-messages-1.json').read_text())
            for message in messages:
                if message['role']=='tool':
                    value=json.loads(message['content'])
                    self.assertNotIn('artifactEnvelope',value);self.assertNotIn('rootBinding',value)
                    self.assertNotIn('source_description_evidence',json.dumps(value))
                    self.assertNotIn('private-region',message['content'])
            review={'resultSha256':sha(folder/'result.json'),'reviewer':'test','reason':'looks good','status':'pass'}
            self.assertEqual(score(case,folder,review)['status'],'blocked')
            records=[json.loads(f.read_text()) for f in sorted(folder.glob('candidate-*.json'))]
            state=json.loads((folder/'trusted-turn-1.json').read_text())
            bad=deepcopy(records[0]);bad['documentSha256']='0'*64
            with self.assertRaises(ValueError):admit_candidate({'artifactEnvelope':{'kind':'metriccanvas.authoring-candidate','artifact':bad},'modelSummary':{}},state,{},None)

    async def test_five_tools_missing_provider_and_new_turn(self):
        for id in ['missing-turn-provider','fresh-local-turn','data-new']:
            case=next(c for c in scenarios() if c['id']==id);case['localSmoke']=True
            with tempfile.TemporaryDirectory() as t:
                result=await run_case(case,Path(t)/'run',ScriptedTransport(case['turns']))
                self.assertEqual(result['deterministicStatus'],'pass',result)
                self.assertEqual(result['modelRequests'],0)
                if id=='missing-turn-provider':self.assertEqual(result['toolCalls'],5)

    async def test_failed_http_attempt_is_retained_by_runner(self):
        case=scenarios()[0]
        client=MockHttpClient({},503);transport=HttpTransport(CONFIG,client_factory=lambda **kw:client)
        with tempfile.TemporaryDirectory() as t:
            result=await run_case(case,Path(t)/'run',transport)
            self.assertEqual(result['modelRequests'],1)
            self.assertEqual(result['status'],'blocked')
            self.assertEqual(result['deterministicStatus'],'fail')

    async def test_unified_scoring_uses_program_turns_and_preserves_no_tools_difference(self):
        for id,expected in [('static-new',{'creation':True}),('fresh-local-turn',{'freshBaselineEveryTurn':True}),('read-edit-chain',{'noTools':True})]:
            case=next(c for c in scenarios() if c['id']==id)
            with tempfile.TemporaryDirectory() as t:
                folder=Path(t)/'run'
                await run_case(case,folder,ScriptedTransport(case['turns']))
                scored=score(dict(case,expected=expected),folder)
                self.assertEqual(scored['status'],'blocked')
                self.assertEqual(scored['checks']['trustedCandidateEvidence']['status'],'pass',scored)
                if 'noTools' in expected:
                    self.assertEqual(scored['checks']['noTools']['status'],'inconclusive')
                    self.assertEqual(scored['checks']['readOnlyContentBoundary']['status'],'fail')
                else:self.assertEqual(scored['checks'][next(iter(expected))]['status'],'pass',scored)

    async def test_ordinary_ask_stops_before_model_transport(self):
        case={'id':'ordinary-ask','context':{'entry':'ordinary-ask'}}
        transport=ScriptedTransport([])
        with tempfile.TemporaryDirectory() as t:
            result=await run_case(case,Path(t)/'run',transport)
            self.assertEqual(result['reason'],'RELAY_ROUTING_UNAVAILABLE')
            self.assertEqual(transport.calls,0)

    def test_model_view_rejects_complete_artifact_and_source_records(self):
        with self.assertRaises(ValueError):model_view({'artifactEnvelope':{'document':{}},'ok':True})
        with self.assertRaises(ValueError):model_view({'modelSummary':{'artifactEnvelope':{}}})

    def test_safe_title_words_are_not_program_evidence(self):
        safe={'modelSummary':{'title':'rootBinding explanation and sourceDescriptions documentation'}}
        self.assertEqual(model_view(safe),safe['modelSummary'])
        for nested in [{'x':{'rootBinding':{}}},{'x':json.dumps({'sourceDescriptions':[]})},{'x':{'type':'source_description_evidence'}}]:
            with self.assertRaises(ValueError):model_view({'modelSummary':nested})

    def test_frozen_suite_is_read_without_mutating_cases_or_replacing_no_tools(self):
        path=EVALS/'unified-authoring.cases.json';before=sha(path)
        cases,source=load_cases('frozen',['all'],'http')
        self.assertEqual(source,path);self.assertEqual(len(cases),9)
        self.assertTrue(any(c['expected'].get('noTools') for c in cases))
        self.assertEqual(before,sha(path))
        with self.assertRaises(ValueError):load_cases('frozen',['all'],'scripted')

    def test_scripted_network_guard_rejects_ip_sockets(self):
        with patch.object(socket.socket,'connect',socket.socket.connect),patch.object(socket.socket,'connect_ex',socket.socket.connect_ex):
            deny_network()
            with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as sock:
                with self.assertRaisesRegex(RuntimeError,'NETWORK_FORBIDDEN'):sock.connect(('127.0.0.1',1))
                with self.assertRaisesRegex(RuntimeError,'NETWORK_FORBIDDEN'):sock.connect_ex(('127.0.0.1',1))

if __name__=='__main__':unittest.main()

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

    async def test_multiturn_preserves_safe_history_with_new_current_context(self):
        case=next(c for c in scenarios() if c['id']=='fresh-local-turn')
        class RecordingScripted(ScriptedTransport):
            def __init__(self,turns):super().__init__(turns);self.requests=[]
            async def complete(self,request):
                self.requests.append(deepcopy(request))
                return await super().complete(request)
        transport=RecordingScripted(case['turns'])
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t)/'run';result=await run_case(case,folder,transport)
            self.assertNotEqual(result.get('deterministicStatus'),'fail',result)
            second=next(r for r in transport.requests if sum(m['role']=='user' for m in r['messages'])==2)
            users=[json.loads(m['content']) for m in second['messages'] if m['role']=='user']
            self.assertNotEqual(users[0]['trustedContext']['context_ref'],users[1]['trustedContext']['context_ref'])
            self.assertTrue(any(m['role']=='tool' for m in second['messages']))
            self.assertTrue(any(m['role']=='assistant' for m in second['messages']))
            state=json.loads((folder/'trusted-turn-2.json').read_text())
            self.assertEqual(users[-1]['trustedContext']['context_ref'],state['binding']['contextRef'])
            self.assertEqual(json.loads(state['documentJson'])['sections'][0]['components'][0]['props']['title'],'Stage one')

    async def test_scripted_candidate_resolution_cannot_reuse_previous_turn(self):
        transport=ScriptedTransport([[{'name':'edit_page','arguments':{'context_ref':'$context','candidate_ref':'$candidate'}}]])
        transport.begin_turn()
        messages=[{'role':'user','content':json.dumps({'trustedContext':{'context_ref':'old'}})},
                  {'role':'tool','content':json.dumps({'candidateRef':'old-candidate'})},
                  {'role':'user','content':json.dumps({'trustedContext':{'context_ref':'new'}})}]
        with self.assertRaisesRegex(ValueError,'No candidate'):await transport.complete({'messages':messages,'tools':[]})

    async def test_ordinary_ask_stops_before_model_transport(self):
        case={'id':'ordinary-ask','context':{'entry':'ordinary-ask'}}
        transport=ScriptedTransport([])
        with tempfile.TemporaryDirectory() as t:
            result=await run_case(case,Path(t)/'run',transport)
            self.assertEqual(result['reason'],'RELAY_ROUTING_UNAVAILABLE')
            self.assertEqual(transport.calls,0)

    async def test_error_reference_injection_and_explicit_examples_reach_shared_payload(self):
        case=next(c for c in scenarios() if c['id']=='missing-data')
        case['includeExamples']=True
        class Recording(ScriptedTransport):
            def __init__(self,turns):super().__init__(turns);self.requests=[]
            async def complete(self,request):self.requests.append(deepcopy(request));return await super().complete(request)
        transport=Recording(case['turns'])
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t)/'run';result=await run_case(case,folder,transport)
            self.assertEqual(result['modelRequests'],0)
            events=json.loads((folder/'injection.json').read_text())['events']
            errors=[e for e in events if e['path'].endswith('/errors.md')]
            examples=[e for e in events if e['path'].endswith('/examples.md')]
            self.assertEqual(len(errors),1);self.assertEqual(errors[0]['phase'],'first-tool-issue')
            self.assertEqual(len(examples),1);self.assertEqual(examples[0]['phase'],'startup')
            root=EVALS.parents[2]
            error_text=(root/errors[0]['path']).read_text()
            self.assertNotIn(error_text,json.dumps(transport.requests[0],ensure_ascii=False))
            self.assertTrue(any(error_text in m['content'] for m in transport.requests[1]['messages'] if m['role']=='system'))
            # Same fully prepared payload reaches mock HTTP; no credential read or network.
            client=MockHttpClient({'model':'mock-only','usage':{'total_tokens':1},'choices':[{'message':{'role':'assistant','content':'mock'}}]})
            http=HttpTransport(CONFIG,client_factory=lambda **kw:client)
            payload=http.prepare_request({'messages':transport.requests[1]['messages'],'tools':transport.requests[1]['tools']})
            await http.complete(payload)
            self.assertIs(client.requests[0][1]['json'],payload)
            self.assertTrue(any(error_text in m['content'] for m in client.requests[0][1]['json']['messages'] if m['role']=='system'))

    async def test_preflight_without_config_never_reads_credentials(self):
        from preflight import inspect
        with patch('run_local.config',side_effect=AssertionError('Credential access forbidden')) as config_reader:
            report=await inspect(EVALS.parents[2],surface='unified-content')
        config_reader.assert_not_called()
        self.assertEqual(report['modelRequests'],0)
        self.assertTrue(report['configuration'].startswith('not-inspected'))
        self.assertEqual(report['introspection']['status'],'pass')

    def test_reference_availability_is_explicit_and_missing_errors_fails_closed(self):
        from reference_injection import ReferenceInjection
        case={'workflow':None,'expected':{}}
        root=EVALS.parents[2];loader=ReferenceInjection(root,case)
        loader.initial()
        self.assertFalse(any(e['path'].endswith('/examples.md') for e in loader.events))
        self.assertIn('not-available',loader.policy['examples'])
        self.assertIsNone(loader.after_tools([{'ok':True}],1,0))
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaisesRegex(ValueError,'ERROR_REFERENCE_UNAVAILABLE'):ReferenceInjection(Path(t),case).initial()

    async def test_versioned_readonly_mapping_keeps_old_score_and_requires_semantic_evidence(self):
        from protocol_acceptance import MAPPING
        from trusted_scenarios import action
        case={'id':'heldout-config','workflow':None,'mode':'existing','expected':{'noTools':True},
              'prompts':['Explain the selected configuration without changing it.'],
              'turns':[[action('read_page_context',use_selection=True)]]}
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t)/'run';await run_case(case,folder,ScriptedTransport(case['turns']))
            original=score(case,folder)
            self.assertEqual(original['checks']['noTools']['status'],'inconclusive')
            mapped=original['protocolAssessment'];self.assertEqual(mapped['mappingVersion'],'unified-content-readonly-v1')
            for name in ['noMutationTools','noDiscovery','unchangedProgramDocument','successfulCurrentTargetRead']:
                self.assertEqual(mapped['checks'][name]['status'],'pass',mapped)
            self.assertEqual(mapped['checks']['configurationAnswerGrounded']['status'],'inconclusive')
            evidence={p.name:sha(p) for p in folder.glob('program-tool-*.json')}
            evidence.update({p.name:sha(p) for p in folder.glob('response-*.json')})
            # Reviewer decision is a test fixture, never a real semantic/model score.
            decision={'resultSha256':sha(folder/'result.json'),'mappingSha256':sha(MAPPING),'reviewer':'unit-test-only','reason':'Synthetic review fixture',
                      'evidenceFiles':evidence,'criteria':{k:{'status':'pass','reason':'Synthetic test decision'} for k in ['configurationAnswerGrounded','noFalsePersistenceClaim']}}
            review={'protocolReviews':{'unified-content-readonly-v1':decision}}
            mapped=score(case,folder,review)['protocolAssessment']
            self.assertEqual(mapped['checks']['configurationAnswerGrounded']['status'],'pass')
            self.assertEqual(mapped['status'],'blocked')  # Scripted evidence can never become model success.
            malformed=deepcopy(review);malformed['protocolReviews']['unified-content-readonly-v1']['criteria']=None
            self.assertEqual(score(case,folder,malformed)['protocolAssessment']['checks']['configurationAnswerGrounded']['status'],'inconclusive')
            decision['evidenceFiles']['response-1-1.json']='0'*64
            mapped=score(case,folder,review)['protocolAssessment']
            self.assertEqual(mapped['checks']['configurationAnswerGrounded']['status'],'inconclusive')
            raw=json.loads((folder/'result.json').read_text())
            raw['turns'][0]['calls'][0]['tools'].append({'name':'discover_data_context'})
            (folder/'result.json').write_text(json.dumps(raw))
            mapped=score(case,folder)['protocolAssessment']
            self.assertEqual(mapped['checks']['noDiscovery']['status'],'fail')
            raw['turns'][0]['calls'][0]['tools'].append({'name':'edit_page'})
            (folder/'result.json').write_text(json.dumps(raw))
            self.assertEqual(score(case,folder)['protocolAssessment']['checks']['noMutationTools']['status'],'fail')
            first=raw['turns'][0]['calls'][0]['tools'][0]
            output_path=folder/first['programFile'];output=json.loads(output_path.read_text())
            output['range']['offset']=2;first['summary']=output
            output_path.write_text(json.dumps(output));(folder/'result.json').write_text(json.dumps(raw))
            self.assertEqual(score(case,folder)['protocolAssessment']['checks']['successfulCurrentTargetRead']['status'],'fail')

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

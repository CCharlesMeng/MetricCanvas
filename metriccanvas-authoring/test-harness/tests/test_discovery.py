"""Focused discovery contract, clarification and durable continuation checks."""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'examples'))
from adapter_template.storage.platform_state import SqlitePlatformState
from adapter_template.firstparty.discovery_knowledge import MockBusinessKnowledge
from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
from metriccanvas_authoring.data.discovery import DiscoveryDependencies, DiscoveryLimits
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.work.state import digest

ROOT = Path(__file__).resolve().parents[2]


class Metadata:
    version = 'v1'
    def __init__(self):
        self.models = [{'id': 'commerce', 'name': '电商经营', 'workspace_id': 'w', 'logical_schema': {'field_schema': {
            'metrics': [
                {'id': 'payment', 'name': '支付金额', 'synonyms': ['销售额'], 'definition': '成功支付的金额，未扣除退款。'},
                {'id': 'net', 'name': '净实收金额', 'synonyms': ['销售额'] + ['别名'+str(i) for i in range(12)], 'definition': '支付金额扣除退款后的实收金额。'},
                {'id': 'refund', 'name': '退款金额', 'definition': '退款发生时确认的金额。'}],
            'dimensions': [{'id': 'region', 'name': '地区', 'column_id': '地区'}]}}}]

    async def search(self, binding, query, limit):
        return {'dataContextVersion': self.version, 'models': deepcopy(self.models), 'issues': [],
                'coverage': {'complete': True, 'scope': 'authorized'}}

    async def detail(self, binding, source):
        return {'source': source, 'unit': '元'}


class Trusted:
    def __init__(self, message='销售额'):
        self.value = {'formatVersion': '1.0', 'actorId': 'a', 'workspaceId': 'w', 'sessionRef': 's',
            'requestEventId': 'e1', 'messageRef': 'm1', 'messageText': message,
            'receivedAt': datetime.now(timezone.utc).isoformat(), 'timezone': 'Asia/Shanghai', 'invocationKind': 'new'}

    async def current(self, binding): return deepcopy(self.value)

    def resume(self, response, answer=None):
        self.value.update(invocationKind='resume', requestEventId='e2', messageRef='m2',
                          taskRef=response['discovery']['taskRef'], expectedRevision=response['discovery']['revision'])
        if answer is not None:
            self.value.update(interactionId=response['interactionEnvelope']['interactionId'], answer=answer)


class DiscoveryTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'state.db'
        self.store = SqlitePlatformState(self.path)
        self.metadata = Metadata()
        self.trusted = Trusted()
        self.binding = {'actorId': 'a', 'workspaceId': 'w', 'pageId': 'p', 'turnId': 't1', 'contextRef': 'ctx1'}
        self.catalog = self.make_catalog()

    def tearDown(self): self.temp.cleanup()

    def make_catalog(self, **kwargs):
        return SemanticCatalog(self.metadata, self.store, discovery=DiscoveryDependencies(trusted_context=self.trusted, **kwargs))

    async def discover(self, catalog=None):
        return await (catalog or self.catalog).discover(self.binding, '模型检索词不覆盖原句', 10, [])

    async def test_sentence_multi_need_and_eleventh_alias(self):
        self.trusted.value['messageText'] = '比较支付金额和退款金额'
        result = await self.discover()
        needs = result['discovery']['requirements']
        self.assertEqual({r['expression'] for r in needs}, {'支付金额', '退款金额'})
        self.assertTrue(all(r['status']=='resolved' for r in needs))
        legacy = SemanticCatalog(self.metadata, self.store)
        alias = await legacy.discover(self.binding, '别名11', 10, [])
        self.assertEqual(alias['matches'][0]['name'], '净实收金额')
        sentence = await legacy.discover(self.binding, '上个月各地区支付金额', 10, [])
        self.assertIn('支付金额', [c['name'] for c in sentence['matches']])

    async def test_one_review_replay_and_restart_resume(self):
        first = await self.discover()
        self.assertEqual(first['discovery']['status'], 'awaiting_choice')
        self.assertEqual(first, await self.discover())
        item = first['interactionEnvelope']['items'][0]
        choice = next(o for o in item['options'] if o['label']=='净实收金额')
        self.trusted.resume(first, {'kind':'choices', 'choices':[{'requirementId':item['requirementId'],'optionId':choice['optionId']}]})
        self.binding.update(turnId='t2', contextRef='ctx2')
        # SQLite content can be loaded by an independent process, not in-memory state.
        code = "from adapter_template.storage.platform_state import SqlitePlatformState; import asyncio,sys; print(asyncio.run(SqlitePlatformState(sys.argv[1]).read('discovery_task',sys.argv[2]))[1]['revision'])"
        env = {**os.environ, 'PYTHONPATH': str(ROOT/'tool')+os.pathsep+str(ROOT/'examples'), 'PYTHONDONTWRITEBYTECODE':'1'}
        check = subprocess.check_output([sys.executable,'-c',code,str(self.path),first['discovery']['taskRef']],env=env,text=True)
        self.assertEqual(check.strip(), '1')
        self.store = SqlitePlatformState(self.path)
        result = await self.discover(self.make_catalog())
        self.assertIsNone(result['interactionEnvelope'])
        self.assertEqual(result['discovery']['requirements'][0]['selectedBy'], 'user')
        self.assertEqual(result['discovery']['status'], 'ready')
        # Different payload under the same event cannot reinterpret a submitted choice.
        self.trusted.value['messageText'] = 'different'
        with self.assertRaisesRegex(ContentBaselineError, 'DISCOVERY_EVENT_MISMATCH'):
            await self.discover(self.make_catalog())

    async def test_source_change_does_not_accept_old_confirmation(self):
        first = await self.discover()
        item = first['interactionEnvelope']['items'][0]
        self.trusted.resume(first, {'kind':'choices','choices':[{'requirementId':item['requirementId'],'optionId':item['options'][0]['optionId']}]})
        self.binding['turnId']='t2'
        self.metadata.version='v2'
        result = await self.discover()
        self.assertEqual(result['discovery']['status'], 'paused')
        self.assertIsNone(result['interactionEnvelope'])
        self.assertTrue(all(r['selectedBy']!='user' for r in result['discovery']['requirements']))

    async def test_scope_expiry_and_concurrent_cas(self):
        service = self.catalog.discovery
        invocation = await self.trusted.current(self.binding)
        claims = await asyncio.gather(*(service.tasks.begin(self.binding, invocation) for _ in range(2)), return_exceptions=True)
        self.assertEqual(sum(not isinstance(c,Exception) for c in claims),1)
        claim = next(c for c in claims if not isinstance(c,Exception))
        await service.tasks.abort(claim)
        first = await self.discover()
        self.trusted.resume(first)
        self.trusted.value['actorId']='other'
        with self.assertRaisesRegex(ContentBaselineError, 'DISCOVERY_SCOPE_MISMATCH'):
            await self.discover()
        self.trusted.value['actorId']='a'
        service.tasks.clock=lambda: 9999999999
        with self.assertRaisesRegex(ContentBaselineError, 'DISCOVERY_TASK_EXPIRED'):
            await self.discover()

    async def test_knowledge_model_degrade_and_forged_proposal(self):
        class Unavailable:
            async def search(self,*args): raise RuntimeError('SECRET')
            async def propose(self,context): return {'fake':'SECRET'}
        self.trusted.value['messageText']='销售额'
        result = await self.discover(self.make_catalog(knowledge=Unavailable(),interpreter=Unavailable()))
        self.assertEqual(result['knowledgeStatus'],'unavailable')
        self.assertEqual(result['interpretationStatus'],'unavailable')
        self.assertNotIn('SECRET',json.dumps(result))
        self.assertEqual(result['discovery']['requirements'][0]['status'],'needs_choice')

    async def test_mock_topic_and_calculation_are_bounded(self):
        knowledge=MockBusinessKnowledge(ROOT/'examples/semantic-discovery/business-knowledge.mock.json')
        self.trusted.value['messageText']='经营情况'
        result=await self.discover(self.make_catalog(knowledge=knowledge))
        self.assertEqual(len(result['discovery']['requirements']),3)
        # A topic hint for a nonexistent Java metric cannot create that metric.
        missing=next(r for r in result['discovery']['requirements'] if r['expression']=='支付订单数')
        self.assertEqual(missing['status'],'unsupported')

    async def test_query_check_does_not_invoke_discovery(self):
        self.trusted.value['messageText']='支付金额'
        await self.discover()
        self.catalog.discover=lambda *args: self.fail('query reentered discover')
        request={'businessDomain':'电商经营','metrics':[{'name':'支付金额'}]}
        self.assertEqual(await self.catalog.query_issues_for_context(self.binding,request,{'version':'v1'}),[])
        request['metrics'][0]['name']='退款金额'
        with self.assertRaisesRegex(ContentBaselineError,'DISCOVERY_SELECTION_REQUIRED'):
            await self.catalog.query_issues_for_context(self.binding,request,{'version':'v1'})

    async def test_external_nonliteral_candidate_and_mcp_program_channel(self):
        from fastmcp import Client
        from types import SimpleNamespace
        from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
        from metriccanvas_authoring.data.semantic_catalog import metric_card
        model = self.metadata.models[0]
        ref = metric_card(model, model['logical_schema']['field_schema']['metrics'][1])['metricRef']
        class External:
            async def retrieve(self, *args): return {'dataContextVersion':'v1','candidateRefs':[ref]}
        self.trusted.value['messageText']='实际到账规模'
        catalog=self.make_catalog(retrieval=External())
        async def discover(context_ref, query, limit, detail_refs):
            return await catalog.discover(self.binding, query, limit, detail_refs or [])
        app=SimpleNamespace(discover=discover, semantic_catalog=catalog)
        async with Client(create_platform_mcp_server(app)) as client:
            result=await client.call_tool('discover_data_context',{'context_ref':'ctx1'})
        payload=result.structured_content
        self.assertEqual(payload['modelSummary']['matches'][0]['name'],'净实收金额')
        self.assertIn('interactionEnvelope',payload)
        self.assertNotIn('interactionEnvelope',payload['modelSummary'])
        model_text=''.join(c.text for c in result.content if hasattr(c,'text'))
        self.assertNotIn('interactionId',model_text)
        self.assertNotIn('originalRequest',model_text)

    async def test_conflicting_knowledge_and_negation_cannot_be_confirmed(self):
        from metriccanvas_authoring.data.discovery.retrieval import proposition_conflicts
        self.assertEqual(proposition_conflicts('不扣退款','扣除退款后的金额')[1],['refund'])
        knowledge=MockBusinessKnowledge(ROOT/'examples/semantic-discovery/business-knowledge.mock.json')
        # A source hint explicitly names a metric whose Java definition contradicts it.
        item=knowledge.snapshot['items'][0]
        item['metricHints']=[{'metricName':'支付金额','relation':'candidate'}]
        self.trusted.value['messageText']='实际收到的钱'
        result=await self.discover(self.make_catalog(knowledge=knowledge))
        self.assertEqual(result['discovery']['requirements'][0]['status'],'conflicted')
        self.assertEqual(result['interactionEnvelope']['items'][0]['options'],[])

    async def test_text_answer_modify_cancel_and_relation_dedup(self):
        first=await self.discover()
        self.trusted.resume(first, {'kind':'free_text','text':'用净实收金额'})
        self.binding['turnId']='t2'
        result=await self.discover()
        self.assertEqual(result['discovery']['requirements'][0]['selectedBy'],'user_text')
        self.assertEqual(result['discovery']['status'],'ready')
        self.trusted.value.pop('answer')
        self.trusted.value.pop('interactionId')
        self.trusted.value.update(invocationKind='modify',requestEventId='e3',messageText='比较销售额和退款金额',expectedRevision=result['discovery']['revision'])
        self.binding['turnId']='t3'
        class Interpreter:
            async def propose(self,context):
                needs=context['requirements']
                return {'formatVersion':'1.0','dataContextVersion':'v1','requirements':[
                    {'id':r['id'],'expression':r['expression'],'candidateRefs':r['candidateRefs'],
                     'evidenceIds':r['candidateRefs'],'unresolved':[]} for r in needs],
                    'relationships':[{'kind':'comparison','requirementIds':[r['id'] for r in needs]}], 'searchTerms':[]}
        result=await self.discover(self.make_catalog(interpreter=Interpreter()))
        self.assertEqual(len(result['discovery']['relationships']),1)
        self.assertEqual(result['interpretationStatus'],'applied')
        self.trusted.value.update(invocationKind='cancel',requestEventId='e4',expectedRevision=result['discovery']['revision'])
        self.binding['turnId']='t4'
        cancelled=await self.discover()
        self.assertEqual(cancelled['status'],'cancelled')
        _,record=await self.store.read('discovery_task',first['discovery']['taskRef'])
        self.assertEqual(record['originalRequest']['messageText'],'销售额')
        self.assertEqual(len(record['requestRevisions']),1)

    async def test_lease_recovery_does_not_reset_model_budget(self):
        service=self.catalog.discovery
        invocation=await self.trusted.current(self.binding)
        claim=await service.tasks.begin(self.binding,invocation)
        claim.record['analysisBudget']['modelCalls']=1
        await service.tasks.checkpoint(claim)
        # Simulate process death without abort, and a later process after lease timeout.
        now=service.tasks.clock()
        restarted=self.make_catalog().discovery
        restarted.tasks.clock=lambda: now+31
        recovered=await restarted.tasks.begin(self.binding,invocation)
        self.assertEqual(recovered.record['analysisBudget']['modelCalls'],1)
        await restarted.tasks.abort(recovered)

if __name__=='__main__': unittest.main()

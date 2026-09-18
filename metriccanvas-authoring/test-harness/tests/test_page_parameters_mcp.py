import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT/'metriccanvas-authoring/tool'), str(ROOT/'metriccanvas-authoring/test-harness/tests')]
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_unified_content_mcp import dependencies
from metriccanvas_authoring.application.authoring_turns import AuthoringTurnGate, SCOPE_KEYS
from metriccanvas_authoring.application.authoring_candidates import AuthoringCandidates
from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.application.page_parameters import PageParameters, ParameterDependencies
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.adapters.outbound.parameter_program import SubprocessParameterProgram
from metriccanvas_authoring.adapters.outbound.sqlite_parameter_records import SqliteParameterRecords


class VerifiedFixture:
    async def verify(self, prepared, document, candidate_ref):
        return {'baseline': 'verified-fixture-r1', 'sourceSha256': document_sha256(document),
                'dimensionIdentities': {key: {'区域': 'region'} for key in document['dataSources']}}


class PageParametersMcpTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name)/'parameters.db'
        self.now = 1000
        self.store = SqliteParameterRecords(self.db)
        self.program = SubprocessParameterProgram(('node', '--import', 'tsx',
            'packages/page/examples/parameter-program.ts'), cwd=str(ROOT))
        self.params = ParameterDependencies(self.program, self.store, VerifiedFixture(), clock=lambda: self.now)
        self.turns, self.candidates = Turns(), MemoryCandidates()
        self.source = json.loads((ROOT/'packages/page/fixtures/parameter-extraction/tokens-parameter-source.json').read_text())
        self.source['sections'][0]['components'][0]['props']['body'] = '中国区 2026-01 至 2026-06'
        self.bind(self.source)

    def bind(self, document):
        ref = {'pageId': document['id'], 'revisionId': 'r1', 'resourceId': 'resource1'}
        self.turns.baseline = ContentBaseline(ref, document, document_sha256(document))
        self.turns.document_json = json.dumps(document)
        self.turns.binding.update(pageId=document['id'], baseRef=ref, selectedComponentId=None,
            documentSha256=hashlib.sha256(self.turns.document_json.encode()).hexdigest())
        self.turns.scope = {k: self.turns.binding[k] for k in SCOPE_KEYS}

    def server(self, params=True):
        return create_unified_content_mcp_server(dependencies(), self.turns,
            candidate_store=self.candidates, parameter_dependencies=self.params if params else None)

    async def extract(self, client):
        result = await client.call_tool('extract_page_parameters', {'context_ref': 'current-context'})
        self.assertTrue(result.structured_content['ok'], result)
        self.assertNotIn('中国区', str(result.content))
        self.assertNotIn('dsl_list', str(result.content))
        return result.structured_content['modelSummary']

    async def template(self, client, summary):
        choices = [{'slot_id': s['slot_id'], 'kind': 'literal', 'text': 'Tokens 报告'} for s in summary['text_slots']]
        result = await client.call_tool('apply_page_parameter_selection', {'context_ref': 'current-context',
            'extraction_ref': summary['extraction_ref'], 'selected_ids': [c['candidate_id'] for c in summary['candidates']],
            'text_choices': choices})
        self.assertTrue(result.structured_content['ok'], result)
        return result.structured_content

    async def test_actual_eight_tools_roundtrip_and_temporary_instance(self):
        async with Client(self.server()) as client:
            tools = {t.name:t for t in await client.list_tools()}
            self.assertEqual(len(tools), 8)
            self.assertEqual(set(tools['extract_page_parameters'].inputSchema['properties']), {'context_ref', 'candidate_ref'})
            summary = await self.extract(client)
            self.assertTrue(all(c['candidate_id'] != c['param_id'] for c in summary['candidates']))
            output = await self.template(client, summary)
            ref = output['modelSummary']['candidate_ref']
            template = output['artifactEnvelope']['artifact']['document']
            self.assertEqual(output['artifactEnvelope']['kind'], 'metriccanvas.parameter-template')
            self.assertTrue(all('value' not in p and 'default' not in p for p in template['params']))
            self.assertTrue(all('initial' not in d['source'] for d in template['dataSources'].values()))
            original = deepcopy(template)
            values = {'region':'欧洲区', 'report-period':{'start':'2026-07','end':'2026-09','granularity':'month'}}
            result = (await client.call_tool('resolve_page_parameters', {'context_ref':'current-context',
                'candidate_ref':ref, 'values':values})).structured_content
            self.assertTrue(result['ok'], result)
            self.assertFalse(result['modelSummary']['executed'])
            self.assertFalse(result['modelSummary']['saved'])
            instance = result['artifactEnvelope']['artifact']
            self.assertEqual(result['artifactEnvelope']['kind'], 'metriccanvas.parameter-instance')
            for d in instance['payload']['resolvedPage']['dataSources'].values():
                f=d['source']['query']['body']['dsl_list'][0]['filter']
                self.assertEqual(f['dims'][0]['dim_value_list'], ['欧洲区'])
                self.assertEqual(f['time']['end'], '2026-09')
            self.assertEqual(template, original)
            module = PageParameters(AuthoringTurnGate(self.turns), AuthoringCandidates(self.candidates), self.params)
            self.assertEqual(await module.read_instance('current-context', instance['ref']), instance)
            self.assertNotIn(instance['ref'], self.candidates.records)
            projection=(await client.call_tool('read_page_context', {'context_ref':'current-context','candidate_ref':ref})).structured_content
            self.assertEqual(len(projection['parameters']), 2)
            self.assertNotIn('value', projection['parameters'][0])

    async def test_fail_closed_missing_provider_and_missing_verification(self):
        async with Client(self.server(False)) as client:
            r=(await client.call_tool('extract_page_parameters', {'context_ref':'current-context'})).structured_content
            self.assertFalse(r['ok'])
            self.assertIn('UNAVAILABLE', str(r))
        self.params=ParameterDependencies(self.program,self.store)
        async with Client(self.server()) as client:
            r=(await client.call_tool('extract_page_parameters', {'context_ref':'current-context'})).structured_content
            self.assertFalse(r['ok'])

    async def test_invalid_selection_slot_and_required_inputs(self):
        async with Client(self.server()) as client:
            summary=await self.extract(client)
            for selected, choices in [(['region'], []), (['choice-1','choice-1'], []),
                (['choice-1'], [{'slot_id':'/dataSources','kind':'literal','text':'evil'}])]:
                r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                    'extraction_ref':summary['extraction_ref'],'selected_ids':selected,'text_choices':choices})).structured_content
                self.assertFalse(r['ok'])
            output=await self.template(client,summary)
            for values in ({}, {'region':[]}, {'unknown':'x'}):
                r=(await client.call_tool('resolve_page_parameters', {'context_ref':'current-context',
                    'candidate_ref':output['modelSummary']['candidate_ref'],'values':values})).structured_content
                self.assertFalse(r['ok'])
                self.assertIsNone(r['artifactEnvelope'])

    async def test_restart_expiry_and_cross_turn_rejected(self):
        async with Client(self.server()) as client: summary=await self.extract(client)
        self.store=SqliteParameterRecords(self.db)
        self.params=ParameterDependencies(self.program,self.store,VerifiedFixture(),clock=lambda:self.now)
        async with Client(self.server()) as client:
            await self.template(client,summary) # immutable record survives process adapter reconstruction
            self.now+=1801
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok'])
            self.now=1000
            self.turns.binding['turnId']='another';self.turns.scope['turnId']='another'
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok'])

    async def test_late_program_result_and_read_only_apply_rejected(self):
        self.turns.binding['access']='read'
        async with Client(self.server()) as client:
            summary=await self.extract(client)
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok'])
            self.assertIn('READ_ONLY', str(r))
        self.turns.binding['access']='write'
        real=self.program
        turns=self.turns
        class Late:
            async def prepare(self, request):
                result=await real.prepare(request)
                turns.binding['status']='cancelled'
                return result
        self.params=ParameterDependencies(Late(),self.store,VerifiedFixture())
        async with Client(self.server()) as client:
            r=(await client.call_tool('extract_page_parameters', {'context_ref':'current-context'})).structured_content
            self.assertFalse(r['ok'])
            self.assertIsNone(r['artifactEnvelope'])

    async def test_store_immutable_and_subprocess_limits(self):
        await self.store.put({'ref':'test','value':1})
        with self.assertRaises(Exception): await self.store.put({'ref':'test','value':2})
        program=SubprocessParameterProgram(('node','-e','process.stdout.write("x".repeat(10000))'),cwd=str(ROOT),max_bytes=500)
        with self.assertRaises(ValueError): await program.prepare({})
        program=SubprocessParameterProgram(('node','-e','setTimeout(()=>{},10000)'),cwd=str(ROOT),timeout_seconds=.05)
        with self.assertRaises(TimeoutError): await program.prepare({})

    async def test_tampered_record_and_wrong_identity_rejected(self):
        async with Client(self.server()) as client: summary=await self.extract(client)
        real=self.store
        class Tampered:
            async def put(self, record): await real.put(record)
            async def get(self, ref):
                record=await real.get(ref)
                record['expiresAt']+=10000
                return record
        self.params=ParameterDependencies(self.program,Tampered(),VerifiedFixture(),clock=lambda:self.now)
        async with Client(self.server()) as client:
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok'])
            self.assertIn('PARAMETER_REFERENCE_INVALID', str(r))
        self.params=ParameterDependencies(self.program,real,VerifiedFixture(),clock=lambda:self.now)
        self.turns.binding['actorId']='bob';self.turns.scope['actorId']='bob'
        async with Client(self.server()) as client:
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok'])
            self.assertIn('PARAMETER_REFERENCE_INVALID', str(r))

    async def test_changed_source_and_revoked_verification_rejected(self):
        async with Client(self.server()) as client: summary=await self.extract(client)
        class Revoked:
            async def verify(self, *args): raise RuntimeError('private query and credential details')
        self.params=ParameterDependencies(self.program,self.store,Revoked(),clock=lambda:self.now)
        async with Client(self.server()) as client:
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok']);self.assertNotIn('credential', str(r))
            self.assertIn('PARAMETER_VERIFICATION_UNAVAILABLE', str(r))
        self.params=ParameterDependencies(self.program,self.store,VerifiedFixture(),clock=lambda:self.now)
        changed=deepcopy(self.source);changed['sections'][0]['components'][0]['props']['body']='changed'
        self.bind(changed)
        async with Client(self.server()) as client:
            r=(await client.call_tool('apply_page_parameter_selection', {'context_ref':'current-context',
                'extraction_ref':summary['extraction_ref'],'selected_ids':[]})).structured_content
            self.assertFalse(r['ok'])

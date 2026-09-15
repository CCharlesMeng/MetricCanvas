import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_source_mapping import DescriptorFixture
from test_page_editing import title
from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
from metriccanvas_authoring.application.compose_page import ComposePageDependencies
from metriccanvas_authoring.application.ports import DqeExecutionResult
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server


def dependencies():
    def fixture(name): return json.loads((ROOT / 'test-harness/fixtures' / name).read_text())
    execution = fixture('page-build-execution.json')
    return ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')),
        FakeDqeExecutionPort(DqeExecutionResult(rows=execution['rows'], total_count=execution.get('totalCount'), captured_at=execution.get('capturedAt'))), source_description=DescriptorFixture())


class UnifiedContentMcpTest(unittest.IsolatedAsyncioTestCase):
    async def test_tools_current_baseline_preservation_and_read(self):
        turns = Turns()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=MemoryCandidates())) as client:
            tools = {t.name: t for t in await client.list_tools()}
            self.assertEqual(set(tools), {'read_page_context', 'discover_data_context', 'compose_page', 'create_content_page', 'edit_page'})
            self.assertEqual(set(tools['edit_page'].inputSchema['properties']), {'context_ref', 'request', 'candidate_ref'})
            read = await client.call_tool('read_page_context', {'context_ref': 'current-context', 'use_selection': True})
            self.assertTrue(read.structured_content['ok'])
            self.assertNotIn('private-region', str(read.structured_content))
            self.assertNotIn('dataSources', str(read.structured_content['entries']))
            output = await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [title()]}})
            self.assertTrue(output.structured_content['ok'])
            document = output.structured_content['artifactEnvelope']['artifact']['document']
            from copy import deepcopy
            expected = deepcopy(turns.baseline.document)
            expected['sections'][0]['components'][0]['props']['title'] = 'Changed'
            self.assertEqual(document, expected)
            self.assertNotIn('private-region', str(output.content))
            turns.binding['access'] = 'read'
            output = await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [title()]}})
            self.assertFalse(output.structured_content['ok'])
            self.assertIsNone(output.structured_content['artifactEnvelope'])

    async def test_new_composition_and_existing_mode_rejected(self):
        turns = Turns(mode='new')
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=MemoryCandidates())) as client:
            spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
            output = await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})
            self.assertTrue(output.structured_content['ok'])
            self.assertEqual(output.structured_content['artifactEnvelope']['artifact']['document']['id'], turns.binding['pageId'])
            output = await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [title()]}})
            self.assertFalse(output.structured_content['ok'])

    async def test_production_does_not_fallback_to_old_factory_or_tokens(self):
        from metriccanvas_authoring.unified_content_server import create_production_unified_content_server
        with patch('metriccanvas_authoring.content_server.create_production_content_server', side_effect=AssertionError('legacy bypass')), patch.dict(os.environ, {'METRICCANVAS_CONTENT_BASELINES_DIR': '/tmp/old-tokens'}):
            async with Client(create_production_unified_content_server()) as client:
                for ref in ('current-context', 'trusted-baseline-token'):
                    result = await client.call_tool('edit_page', {'context_ref': ref, 'request': {'operations': [title()]}})
                    self.assertEqual(result.structured_content['modelSummary']['issues'][0]['code'], 'CURRENT_TURN_UNAVAILABLE')

    async def test_late_async_composition_result_is_discarded(self):
        turns = Turns(mode='new'); deps = dependencies()
        original = deps.dqe.execute
        async def late(*args, **kwargs):
            result = await original(*args, **kwargs)
            turns.binding['status'] = 'cancelled'
            return result
        with patch.object(deps.dqe, 'execute', late):
            async with Client(create_unified_content_mcp_server(deps, turns, candidate_store=MemoryCandidates())) as client:
                spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
                output = await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})
                self.assertFalse(output.structured_content['ok'])
                self.assertIsNone(output.structured_content['artifactEnvelope'])

    async def test_new_content_creation_and_expired_read(self):
        turns = Turns(mode='new')
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=MemoryCandidates())) as client:
            result = await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'New',
                'request': {'operations': [{'id': 'text', 'type': 'add_text', 'sectionId': 'main', 'componentId': 'note', 'body': 'Hello'}]}})
            self.assertTrue(result.structured_content['ok'])
            self.assertEqual(result.structured_content['artifactEnvelope']['artifact']['document']['id'], turns.binding['pageId'])
            turns.binding['status'] = 'cancelled'
            result = await client.call_tool('read_page_context', {'context_ref': 'current-context'})
            self.assertFalse(result.structured_content['ok'])

    async def test_real_line_chart_binding_projection_excludes_business_payload(self):
        import hashlib
        from metriccanvas_authoring.application.content_ports import ContentBaseline
        from metriccanvas_authoring.application.edit_page import document_sha256
        turns = Turns()
        document = json.loads((ROOT / 'contract-snapshot/page/conformance/valid/mixed-page.json').read_text())
        # Use the real governed chart configuration, with secret business evidence in sources.
        document['dataSources']['private-evidence'] = {'fields': {
            'large': {'type': 'number', 'role': 'measure'}, 'small': {'type': 'number', 'role': 'measure'},
            'text': {'type': 'string', 'role': 'dimension'}, 'query': {'type': 'string', 'role': 'dimension'}}, 'source': {'type': 'inline', 'rows': [
            {'large': 1e21, 'small': 1e-7, 'text': '业务保密𐀀', 'query': 'private-dqe-body'}]}}
        ref = {'pageId': document['id'], 'revisionId': 'r1', 'resourceId': 'res1'}
        turns.baseline = ContentBaseline(ref, document, document_sha256(document))
        turns.document_json = json.dumps(document, ensure_ascii=False)
        turns.binding.update(pageId=document['id'], baseRef=ref, selectedComponentId='sales-trend',
                             documentSha256=hashlib.sha256(turns.document_json.encode()).hexdigest())
        turns.scope['pageId'] = document['id']
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=MemoryCandidates())) as client:
            entries = []
            args = {'context_ref': 'current-context', 'use_selection': True, 'limit': 2}
            while True:
                result = (await client.call_tool('read_page_context', args)).structured_content
                self.assertTrue(result['ok'])
                entries.extend(result['entries'])
                if result['nextCursor'] is None: break
                args.update(cursor=result['nextCursor'], offset=result['range']['end'])
            values = {entry['path']: entry['value'] for entry in entries}
            self.assertEqual(values['/data/main'], 'live-sales')
            self.assertEqual(values['/props/xField/field'], 'stat-date')
            self.assertEqual(values['/props/xField/format'], 'date-month-day')
            self.assertEqual(values['/props/series/0/field/field'], 'gmv')
            self.assertEqual(values['/props/series/0/field/format'], 'compact-yi-1')
            self.assertNotIn('业务保密', json.dumps(entries, ensure_ascii=False))
            self.assertNotIn('private-dqe-body', json.dumps(entries))
            self.assertNotIn('dataSources', json.dumps(entries))
        from metriccanvas_authoring.application.authoring_turns import AuthoringTurnGate
        verified = await AuthoringTurnGate(turns).require('current-context')
        self.assertEqual(verified.baseline.document, json.loads(turns.document_json))
        self.assertEqual(verified.baseline.document['dataSources']['private-evidence']['source']['rows'][0],
                         {'large': 1e21, 'small': 1e-7, 'text': '业务保密𐀀', 'query': 'private-dqe-body'})

    async def test_candidate_chain_noop_partial_and_root_cursor_separation(self):
        turns = Turns(); store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            first = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [title()]}})).structured_content
            record1 = first['artifactEnvelope']['artifact']; ref = record1['candidateRef']
            self.assertEqual(first['artifactEnvelope']['kind'], 'metriccanvas.authoring-candidate')
            self.assertEqual(first['modelSummary']['candidateRef'], ref)
            root_read = (await client.call_tool('read_page_context', {'context_ref': 'current-context', 'limit': 1})).structured_content
            candidate_read = (await client.call_tool('read_page_context', {'context_ref': 'current-context', 'candidate_ref': ref, 'limit': 1})).structured_content
            self.assertEqual(candidate_read['view'], 'candidate')
            self.assertNotEqual(root_read['nextCursor'], candidate_read['nextCursor'])
            mixed = (await client.call_tool('read_page_context', {'context_ref': 'current-context', 'candidate_ref': ref, 'limit': 1,
                         'offset': 1, 'cursor': root_read['nextCursor']})).structured_content
            self.assertFalse(mixed['ok'])
            unchanged = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'candidate_ref': ref,
                'request': {'operations': [title()]}})).structured_content
            self.assertEqual(unchanged['modelSummary']['status'], 'unchanged')
            self.assertEqual(unchanged['modelSummary']['candidateRef'], ref)
            self.assertEqual(len(store.records), 1)
            changed = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'candidate_ref': ref,
                'request': {'operations': [title(value='Final'), title(id='bad', component='missing')]}})).structured_content
            record2 = changed['artifactEnvelope']['artifact']
            self.assertEqual(changed['modelSummary']['status'], 'partial')
            self.assertEqual(record2['candidateVersion'], 2)
            self.assertEqual(record2['parentRef'], ref)
            self.assertEqual(record2['rootBinding'], record1['rootBinding'])
            self.assertEqual(record2['document']['dataSources'], record1['document']['dataSources'])
            self.assertNotIn('Final', str(changed['modelSummary']))
            turns.scope['actorId'] = 'other'
            rejected = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'candidate_ref': ref,
                'request': {'operations': [title()]}})).structured_content
            self.assertFalse(rejected['ok'])
            self.assertIsNone(rejected['artifactEnvelope'])

    async def test_new_candidate_can_be_edited_and_missing_store_fails_before_work(self):
        turns = Turns(mode='new'); store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            created = (await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'New',
                'request': {'operations': [{'id': 'text', 'type': 'add_text', 'sectionId': 'main', 'componentId': 'note', 'body': 'Hello'}]}})).structured_content
            ref = created['modelSummary']['candidateRef']
            edited = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'candidate_ref': ref,
                'request': {'operations': [title(component='page-header')]}})).structured_content
            self.assertTrue(edited['ok'])
            self.assertEqual(edited['artifactEnvelope']['artifact']['rootBinding']['mode'], 'new')
            self.assertIsNone(edited['artifactEnvelope']['artifact']['rootBinding']['baseRef'])
            self.assertEqual(edited['artifactEnvelope']['artifact']['candidateVersion'], 2)
        deps = dependencies()
        with patch.object(deps.dqe, 'execute', side_effect=AssertionError('must not query without store')):
            async with Client(create_unified_content_mcp_server(deps, turns)) as client:
                spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
                rejected = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})).structured_content
                self.assertEqual(rejected['modelSummary']['issues'][0]['code'], 'CANDIDATE_STORE_UNAVAILABLE')

    async def test_initial_unchanged_and_failed_batches_create_no_candidates(self):
        store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(dependencies(), Turns(), candidate_store=store)) as client:
            for request in ({'operations': [title(value='Original')]}, {'operations': [title(component='missing')]}):
                result = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': request})).structured_content
                self.assertIsNone(result['artifactEnvelope'])
                self.assertNotIn('candidateRef', result['modelSummary'])
            self.assertEqual(store.records, {})

    async def test_candidates_reject_cross_identity_turn_and_root(self):
        turns = Turns(); store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            created = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [title()]}})).structured_content
            ref = created['modelSummary']['candidateRef']
            from copy import deepcopy
            binding = deepcopy(turns.binding); scope = deepcopy(turns.scope)
            for key in ('actorId', 'workspaceId', 'turnId', 'runId', 'requestId'):
                turns.binding[key] = 'other'; turns.scope[key] = 'other'
                for tool, args in [('read_page_context', {}), ('edit_page', {'request': {'operations': [title()]}})]:
                    result = (await client.call_tool(tool, {'context_ref': 'current-context', 'candidate_ref': ref, **args})).structured_content
                    self.assertFalse(result['ok'], key)
                    self.assertIsNone(result['artifactEnvelope'])
                    self.assertEqual(result['modelSummary']['issues'][0]['code'], 'CANDIDATE_BINDING_MISMATCH')
                turns.binding = deepcopy(binding); turns.scope = deepcopy(scope)
            # A valid newer baseline in this same turn is still a different root.
            from metriccanvas_authoring.application.content_ports import ContentBaseline
            turns.binding['baseRef']['revisionId'] = 'r2'
            turns.baseline = ContentBaseline(deepcopy(turns.binding['baseRef']), turns.baseline.document, turns.baseline.document_sha256)
            result = (await client.call_tool('read_page_context', {'context_ref': 'current-context', 'candidate_ref': ref})).structured_content
            self.assertEqual(result['modelSummary']['issues'][0]['code'], 'CANDIDATE_BINDING_MISMATCH')

    async def test_composed_data_candidate_text_edit_and_sibling_cursor_isolation(self):
        turns = Turns(mode='new'); store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=store)) as client:
            spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
            first = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})).structured_content
            record = first['artifactEnvelope']['artifact']; ref = record['candidateRef']
            before = record['document']['dataSources']
            request = {'operations': [{'id': 'note', 'type': 'add_text', 'sectionId': record['document']['sections'][0]['id'], 'componentId': 'note', 'body': 'Context note'}]}
            children = []
            for _ in range(2):
                result = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'candidate_ref': ref, 'request': request})).structured_content
                self.assertTrue(result['ok'])
                child = result['artifactEnvelope']['artifact']
                self.assertEqual(child['document']['dataSources'], before)
                children.append(child)
            self.assertEqual(children[0]['documentSha256'], children[1]['documentSha256'])
            self.assertNotEqual(children[0]['candidateRef'], children[1]['candidateRef'])
            read = (await client.call_tool('read_page_context', {'context_ref': 'current-context', 'candidate_ref': children[0]['candidateRef'], 'limit': 1})).structured_content
            self.assertTrue(read['ok'])
            self.assertEqual(read['view'], 'candidate')
            self.assertIsNotNone(read['nextCursor'])
            for other in (None, children[1]['candidateRef']):
                args = {'context_ref': 'current-context', 'cursor': read['nextCursor'], 'offset': 1, 'limit': 1}
                if other is not None: args['candidate_ref'] = other
                result = (await client.call_tool('read_page_context', args)).structured_content
                self.assertFalse(result['ok'])
                self.assertEqual(result['modelSummary']['issues'][0]['code'], 'PAGE_CONTEXT_CURSOR_STALE')

    async def test_store_exception_details_never_reach_model(self):
        class BrokenStore(MemoryCandidates):
            async def put(self, record): raise RuntimeError('password=private-provider-data')
        async with Client(create_unified_content_mcp_server(dependencies(), Turns(), candidate_store=BrokenStore())) as client:
            result = await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [title()]}})
            self.assertFalse(result.structured_content['ok'])
            self.assertNotIn('private-provider-data', str(result))
            self.assertEqual(result.structured_content['modelSummary']['issues'][0]['code'], 'CANDIDATE_STORE_UNAVAILABLE')

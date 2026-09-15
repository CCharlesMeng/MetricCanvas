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
from test_page_editing import title
from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
from metriccanvas_authoring.application.compose_page import ComposePageDependencies
from metriccanvas_authoring.application.ports import DqeExecutionResult
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server


def dependencies():
    def fixture(name): return json.loads((ROOT / 'test-harness/fixtures' / name).read_text())
    execution = fixture('page-build-execution.json')
    return ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')),
        FakeDqeExecutionPort(DqeExecutionResult(rows=execution['rows'], total_count=execution.get('totalCount'), captured_at=execution.get('capturedAt'))))


class UnifiedContentMcpTest(unittest.IsolatedAsyncioTestCase):
    async def test_tools_current_baseline_preservation_and_read(self):
        turns = Turns()
        async with Client(create_unified_content_mcp_server(dependencies(), turns)) as client:
            tools = {t.name: t for t in await client.list_tools()}
            self.assertEqual(set(tools), {'read_page_context', 'discover_data_context', 'compose_page', 'create_content_page', 'edit_page'})
            self.assertEqual(set(tools['edit_page'].inputSchema['properties']), {'context_ref', 'request'})
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
        async with Client(create_unified_content_mcp_server(dependencies(), turns)) as client:
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
            async with Client(create_unified_content_mcp_server(deps, turns)) as client:
                spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
                output = await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})
                self.assertFalse(output.structured_content['ok'])
                self.assertIsNone(output.structured_content['artifactEnvelope'])

    async def test_new_content_creation_and_expired_read(self):
        turns = Turns(mode='new')
        async with Client(create_unified_content_mcp_server(dependencies(), turns)) as client:
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
        async with Client(create_unified_content_mcp_server(dependencies(), turns)) as client:
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

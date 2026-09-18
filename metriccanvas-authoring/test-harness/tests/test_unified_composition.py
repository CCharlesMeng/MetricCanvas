"""S6 public MCP creation and existing-page mixed-composition regression."""
from copy import deepcopy
from dataclasses import replace
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_unified_content_mcp import dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.application.unified_composition import CREATION_OPERATIONS
from metriccanvas_authoring.domain.page_validation import validate_page_document


def spec(): return json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
def data_op(): return {'id': 'data', 'type': 'add_data_component', 'sectionId': 'main', 'componentId': 'new-chart', 'spec': spec()}
def text_op(): return {'id': 'note', 'type': 'add_text', 'sectionId': 'main', 'componentId': 'new-note', 'body': 'Controlled explanation'}
def content(document): return [c for s in document['sections'] for c in s['components'] if c['type'] != 'reportHeader']


class UnifiedCompositionTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_schema_exposes_exact_creation_allowlist(self):
        async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=MemoryCandidates())) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}
            self.assertEqual(len(tools), 8)
            schema = tools['create_content_page'].inputSchema['properties']['request']
            operations = schema['properties']['operations']
            self.assertEqual({op['properties']['type']['const'] for op in operations['items']['oneOf']}, CREATION_OPERATIONS)
            self.assertEqual(operations['maxItems'], 50)
            self.assertFalse(schema['additionalProperties'])

    async def test_report_dashboard_mixed_creation_retains_explicit_span_and_order(self):
        for layout in ('report', 'dashboard'):
            store = MemoryCandidates()
            request = {'operations': [data_op(), text_op(),
                {'id': 'span', 'type': 'set_component_layout', 'componentId': 'new-chart', 'changes': {'span': 5}, 'dependsOn': ['data']},
                {'id': 'move', 'type': 'move_component', 'componentId': 'new-note', 'sectionId': 'main', 'beforeId': 'new-chart', 'dependsOn': ['note', 'data']}]}
            async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=store)) as client:
                result = await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'Mixed page', 'layout': layout, 'request': request})
                output = result.structured_content
                self.assertTrue(output['ok'], output)
                self.assertEqual(output['modelSummary']['status'], 'changed')
                record = output['artifactEnvelope']['artifact']; document = record['document']
                self.assertEqual(validate_page_document(document), [])
                self.assertEqual(document['layout'], layout)
                self.assertEqual([c['id'] for c in content(document)], ['new-note', 'new-chart'])
                self.assertEqual(content(document)[1]['layout']['span'], 5)
                headers = [c for s in document['sections'] for c in s['components'] if c['type'] == 'reportHeader']
                self.assertEqual(headers, [{'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': 'Mixed page'}}])
                self.assertIn('result', document['dataSources'])
                self.assertTrue(any(op['type'] == 'source_description_evidence' for op in record['operations']))
                self.assertNotIn('sourceDescriptions', str(result.content))
                self.assertNotIn('Controlled explanation', str(result.content))

    async def test_existing_page_mixed_additions_preserve_original_layout_and_properties(self):
        turns = Turns(); before = deepcopy(turns.baseline.document)
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=MemoryCandidates())) as client:
            result = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [data_op(), text_op()]}})).structured_content
            self.assertTrue(result['ok'])
            document = result['artifactEnvelope']['artifact']['document']
            self.assertEqual(document['layout'], before['layout'])
            self.assertEqual(document['meta'], before['meta'])
            self.assertEqual(document['sections'][0]['components'][:4], before['sections'][0]['components'])
            for key, value in before['dataSources'].items(): self.assertEqual(document['dataSources'][key], value)
            self.assertEqual(document['sections'][0]['container'], before['sections'][0]['container'])

    async def test_failed_data_dependency_partial_static_success_and_missing_provider(self):
        deps = replace(dependencies(), source_description=None)
        dependent = text_op(); dependent.update(id='dependent', componentId='dependent-note', dependsOn=['data'])
        async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=MemoryCandidates())) as client:
            output = (await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'Partial',
                'request': {'operations': [data_op(), dependent, text_op()]}})).structured_content
            self.assertTrue(output['ok'])
            self.assertEqual(output['modelSummary']['status'], 'partial')
            self.assertEqual([item['status'] for item in output['modelSummary']['operations']], ['failed', 'skipped', 'applied'])
            document = output['artifactEnvelope']['artifact']['document']
            self.assertEqual(document['dataSources'], {})
            self.assertEqual([c['id'] for c in content(document)], ['new-note'])

    async def test_static_creation_needs_no_source_or_query_and_header_cannot_be_mutated(self):
        deps = replace(dependencies(), source_description=None)
        with patch.object(deps.dqe, 'execute', side_effect=AssertionError('static creation queried DQE')):
            async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=MemoryCandidates())) as client:
                for operation in [
                    {'id': 'bad', 'type': 'set_component_layout', 'componentId': 'page-header', 'changes': {'span': 1}},
                    {'id': 'bad', 'type': 'move_component', 'componentId': 'page-header', 'sectionId': 'main'},
                    {'id': 'bad', 'type': 'set_page_layout', 'layout': 'dashboard'},
                ]:
                    result = (await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'Protected', 'request': {'operations': [operation]}})).structured_content
                    self.assertFalse(result['ok']); self.assertIsNone(result['artifactEnvelope'])
                result = (await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'Static', 'request': {'operations': [text_op()]}})).structured_content
                self.assertTrue(result['ok'])

    async def test_unsupported_explicit_component_and_unresolved_fields_create_no_placeholder(self):
        unsupported = data_op(); unsupported['spec']['units'][0]['pinnedComponent'] = 'mapChart'
        # Existing discovery has no map capability for this regional metric.
        missing_field = {'id': 'field', 'type': 'add_field_text', 'sectionId': 'main', 'componentId': 'field-note',
                         'dataSourceId': 'missing', 'fieldId': 'unresolved'}
        async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=MemoryCandidates())) as client:
            for operation in (unsupported, missing_field):
                result = (await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': 'Unsupported', 'request': {'operations': [operation]}})).structured_content
                self.assertFalse(result['ok']); self.assertIsNone(result['artifactEnvelope'])
                self.assertTrue(result['modelSummary']['operations'][0]['issues'])

"""S5 public new-page and existing-page data groups, preserving manual content."""
from copy import deepcopy
from dataclasses import replace
import json
from pathlib import Path
import sys
import unittest
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'tool'), str(ROOT/'test-harness')]
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_unified_content_mcp import dependencies
from test_source_mapping import DescriptorFixture
from test_page_editing import title
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.domain.page_validation import validate_page_document


def spec(): return json.loads((ROOT/'test-harness/fixtures/page-build-spec.json').read_text())
def add(component='new-chart', **extra):
    return {'id':component,'type':'add_data_component','sectionId':'main','componentId':component,'spec':spec(), **extra}


class UnifiedDataAdditionTest(unittest.IsolatedAsyncioTestCase):
    async def test_both_public_paths_share_stable_fields_and_preserve_manual_page(self):
        deps = dependencies(); turns = Turns(); store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(deps, turns, candidate_store=store)) as client:
            output = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[add()]}})).structured_content
            self.assertTrue(output['ok'], output)
            candidate = output['artifactEnvelope']['artifact']
            evidence = candidate['operations'][-1]
            self.assertEqual(evidence['type'], 'source_description_evidence')
            self.assertEqual(evidence['descriptors'][0]['descriptorVersion'], '1')
            self.assertNotIn('descriptors', json.dumps(output['modelSummary']))
            document = candidate['document']; self.assertFalse(validate_page_document(document))
            expected = deepcopy(turns.baseline.document)
            for key in ('schemaVersion','layout','meta'): self.assertEqual(document[key], expected[key])
            self.assertEqual(document['sections'][0]['components'][:-1], expected['sections'][0]['components'])
            self.assertEqual(document['dataSources']['sales'], expected['dataSources']['sales'])
            self.assertEqual(document['dataSources']['total'], expected['dataSources']['total'])
            self.assertEqual(document['sections'][0]['components'][-1]['data'], {'main':'result'})
            self.assertNotIn('dataSources', json.dumps(output['modelSummary']))
            before = len(deps.source_description.calls)
            title_only = (await client.call_tool('edit_page', {'context_ref':'current-context','candidate_ref':candidate['candidateRef'],
                'request':{'operations':[title(value='Only title')]}})).structured_content
            self.assertTrue(title_only['ok']); self.assertEqual(len(deps.source_description.calls), before)
            second = (await client.call_tool('edit_page', {'context_ref':'current-context','candidate_ref':candidate['candidateRef'],
                'request':{'operations':[add('second-chart')]}})).structured_content
            self.assertTrue(second['ok'], second)
            self.assertEqual(second['artifactEnvelope']['artifact']['document']['dataSources'], document['dataSources'])
        async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=MemoryCandidates())) as client:
            created = (await client.call_tool('compose_page', {'context_ref':'current-context','spec':spec()})).structured_content
            self.assertTrue(created['ok'], created)
            self.assertEqual(created['artifactEnvelope']['artifact']['document']['dataSources']['result']['fields'], document['dataSources']['result']['fields'])

    async def test_missing_description_before_dqe_rolls_back_group_keeps_independent_edit(self):
        turns = Turns(); deps = replace(dependencies(), source_description=None)
        class NoDqe:
            async def execute(self, query): raise AssertionError('DQE before trusted descriptor')
        deps = replace(deps, dqe=NoDqe())
        request = {'operations':[add(), title('after-data', component='new-chart', dependsOn=['new-chart']), title('independent')]}
        async with Client(create_unified_content_mcp_server(deps, turns, candidate_store=MemoryCandidates())) as client:
            output = (await client.call_tool('edit_page', {'context_ref':'current-context','request':request})).structured_content
        self.assertEqual(output['modelSummary']['status'], 'partial', output)
        self.assertEqual([o['status'] for o in output['modelSummary']['operations']], ['failed','skipped','applied'])
        self.assertEqual(output['modelSummary']['operations'][0]['issues'][0]['code'], 'SOURCE_DESCRIPTION_UNAVAILABLE')
        self.assertEqual(output['artifactEnvelope']['artifact']['document']['dataSources'], turns.baseline.document['dataSources'])

    async def test_conflict_missing_section_and_uncontrolled_input_leave_no_candidate(self):
        for mutation in ('source-conflict','missing-section','raw-query'):
            operation = add()
            if mutation == 'source-conflict': operation['spec']['units'][0]['dataSourceId'] = 'sales'
            elif mutation == 'missing-section': operation['sectionId'] = 'absent'
            else: operation['query'] = {'sql':'model raw query'}
            store = MemoryCandidates()
            async with Client(create_unified_content_mcp_server(dependencies(), Turns(), candidate_store=store)) as client:
                output = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[operation]}})).structured_content
            self.assertFalse(output['ok'], (mutation, output)); self.assertIsNone(output['artifactEnvelope'])
            self.assertEqual(store.records, {})

    async def test_label_is_not_query_field_and_unclaimed_output_alias_rejects(self):
        for wrong_alias in (False, True):
            descriptor = DescriptorFixture(overrides={'Tokens请求量':{'label':'Display-only label','defaultFormat':'number-2'}},
                aliases={'Tokens请求量':'not-declared-output'} if wrong_alias else None)
            deps = replace(dependencies(), source_description=descriptor)
            async with Client(create_unified_content_mcp_server(deps, Turns(), candidate_store=MemoryCandidates())) as client:
                output = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[add()]}})).structured_content
            if wrong_alias:
                self.assertFalse(output['ok']); self.assertIsNone(output['artifactEnvelope'])
            else:
                self.assertTrue(output['ok'], output)
                fields = output['artifactEnvelope']['artifact']['document']['dataSources']['result']['fields']
                metric = next(f for f in fields.values() if f['role']=='measure')
                self.assertEqual(metric['queryField'], 'Tokens请求量'); self.assertEqual(metric['label'], 'Display-only label')
                self.assertEqual(metric['defaultFormat'], 'number-2')

    async def test_cancelled_data_group_does_not_publish_candidate(self):
        turns = Turns(); deps = dependencies(); store = MemoryCandidates(); execute = deps.dqe.execute
        async def late(query):
            result = await execute(query); turns.binding['status'] = 'cancelled'; return result
        deps.dqe.execute = late
        async with Client(create_unified_content_mcp_server(deps, turns, candidate_store=store)) as client:
            output = (await client.call_tool('edit_page', {'context_ref':'current-context','request':{'operations':[add()]}})).structured_content
        self.assertFalse(output['ok']); self.assertEqual(store.records, {})

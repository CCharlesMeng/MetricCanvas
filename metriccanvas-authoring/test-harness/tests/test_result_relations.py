"""Trusted query relations survive the public platform compose/edit path."""

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str((_Path(__file__).resolve().parent / '../../examples').resolve()))
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
import tempfile
import unittest
from fastmcp import Client
from authoring_fixtures import presentation_plan
from scenario_flow_server import dependencies
from test_authoring_turns import Turns
from test_platform_v2 import Authorization, Identities, Service, Preview
from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
from adapter_template.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.work.state import Limits


class ResultRelationsTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup)
        self.store = SqlitePlatformState(Path(tmp.name) / 'state.db')
        self.deps, self.turns, self.service = dependencies(), Turns('new'), Service()
        self.plan = presentation_plan()

    def app(self):
        return PlatformAuthoring(self.deps, self.turns, self.store,
            analysis_authorization=Authorization(), lifecycle_service=self.service,
            lifecycle_identities=Identities(), relay_preview=Preview(), limits=Limits(mutations=4))

    async def query(self, client):
        result = (await client.call_tool('query_data', {'context_ref': 'current-context', 'request': {
            'question': self.plan['question'], 'dataContextVersion': self.plan['dataContextVersion'],
            'requests': self.plan['dataRequests']}})).structured_content
        self.assertEqual(result['modelSummary']['status'], 'ready', result)
        return result['modelSummary']['results'][0]

    async def compose(self, client, evidence):
        return (await client.call_tool('compose_page', {'context_ref': 'current-context', 'request': {
            'title': 'Report', 'sources': {'totals': evidence['resultRef']}, 'sections': self.plan['sections']}})).structured_content

    async def test_public_query_restart_compose_edit_preserve_change_bindings(self):
        async with Client(create_platform_mcp_server(self.app())) as client:
            evidence = await self.query(client)
        # Restart consumes the stored evidence; it does not reload a different relation set.
        self.deps = replace(self.deps, metric_relations=None)
        async with Client(create_platform_mcp_server(self.app())) as client:
            response = await self.compose(client, evidence)
            self.assertEqual(response['modelSummary']['saveStatus'], 'saved', response)
            cards = response['artifactEnvelope']['artifact']['previewJson']['sections'][1]['components'][:3]
            self.assertEqual([c['layout']['span'] for c in cards], [4, 4, 4])
            for card in cards:
                self.assertEqual(card['props']['variant'], 'compactSummary')
                for row in card['props']['rows']:
                    self.assertEqual(row['valueField']['format'], 'compact-million-2')
                    self.assertEqual(row['changes'][0]['field']['format'], 'percent-1')
                    self.assertEqual(row['changes'][0]['field']['match'], row['valueField']['match'])
            block = deepcopy(self.plan['sections'][0]['blocks'][0]); block['id'] = 'extra-card'
            edited = (await client.call_tool('edit_page', {'context_ref': 'current-context',
                'page_id': self.turns.binding['pageId'], 'expected_version': 1,
                'request': {'operations': [{'id': 'extra', 'type': 'add_result_component', 'sectionId': 'business',
                    'resultRef': evidence['resultRef'], 'block': block}]}})).structured_content
            self.assertEqual(edited['modelSummary']['saveStatus'], 'saved', edited)
            before = edited['artifactEnvelope']['artifact']['document']
            revised = (await client.call_tool('edit_page', {'context_ref': 'current-context',
                'page_id': self.turns.binding['pageId'], 'expected_version': 2,
                'request': {'operations': [{'id': 'rename', 'type': 'set_section', 'sectionId': 'business',
                    'changes': {'title': 'Updated'}}]}})).structured_content
            self.assertEqual(revised['modelSummary']['saveStatus'], 'saved', revised)
            after = revised['artifactEnvelope']['artifact']['document']
            self.assertEqual(before['dataSources'], after['dataSources'])
            self.assertEqual(before['sections'][1]['components'], after['sections'][1]['components'])
            self.assertEqual(after['sections'][1]['title'], 'Updated')

        self.assertEqual(len(self.deps.dqe.calls), 1)
        self.assertEqual(len(self.service.calls), 3)
        expected = {change['evidenceRef'] for block in self.plan['sections'][0]['blocks']
                    for metric in block['presentation']['metrics'] for change in metric['changes']}
        self.assertTrue(expected <= {item['evidenceRef'] for item in evidence['relations']})
        self.assertNotIn('initial', self.service.calls[0]['document']['dataSources']['totals']['source'])

    async def test_absent_relations_cannot_be_invented_by_composition(self):
        self.deps = replace(self.deps, metric_relations=None)
        async with Client(create_platform_mcp_server(self.app())) as client:
            evidence = await self.query(client)
            response = await self.compose(client, evidence)
        self.assertEqual(response['modelSummary']['status'], 'failed')
        self.assertEqual(self.service.calls, [])
        self.assertTrue(all(op['issues'][0]['code'] == 'STRUCTURE_CHANGE_RELATION_UNVERIFIED'
                            for op in response['modelSummary']['operations']))

    async def test_relations_for_another_period_are_not_authority_for_this_query(self):
        provider = self.deps.metric_relations
        class WrongPeriod:
            async def resolve(self, *args):
                result = await provider.resolve(*args)
                for item in result['relations']: item['time']['start'] = '1999-01'
                return result
        self.deps = replace(self.deps, metric_relations=WrongPeriod())
        async with Client(create_platform_mcp_server(self.app())) as client:
            evidence = await self.query(client)
            response = await self.compose(client, evidence)
        self.assertEqual(response['modelSummary']['status'], 'failed')
        self.assertEqual(self.service.calls, [])

    async def test_public_relation_evidence_is_bounded(self):
        import json
        provider = self.deps.metric_relations
        class ManyRelations:
            async def resolve(self, *args):
                result = await provider.resolve(*args)
                original = deepcopy(result['relations'])
                for index in range(6):
                    for item in original:
                        result['relations'].append({**deepcopy(item), 'evidenceRef': item['evidenceRef'] + '-' + str(index)})
                return result
        self.deps = replace(self.deps, metric_relations=ManyRelations())
        app = self.app(); app.state.limits = Limits(evidence_bytes=5000)
        async with Client(create_platform_mcp_server(app)) as client:
            evidence = await self.query(client)
        self.assertLessEqual(len(evidence['relations']), 20)
        self.assertTrue(evidence['relationCoverage']['truncated'])
        self.assertEqual(evidence['relationCoverage']['shownCount'], len(evidence['relations']))
        self.assertLessEqual(len(json.dumps({'status': 'ready', 'dataContextVersion': self.plan['dataContextVersion'],
            'results': [evidence]}, ensure_ascii=False, allow_nan=False).encode()), 5000)

    async def test_unknown_relation_reference_is_rejected_without_saving(self):
        for block in self.plan['sections'][0]['blocks']:
            for metric in block['presentation']['metrics']:
                for change in metric['changes']: change['evidenceRef'] = 'invented'
        async with Client(create_platform_mcp_server(self.app())) as client:
            response = await self.compose(client, await self.query(client))
        self.assertEqual(response['modelSummary']['status'], 'failed')
        self.assertEqual(self.service.calls, [])

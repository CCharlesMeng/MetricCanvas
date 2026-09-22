"""Current structure contract, rendering rules and work-based revision."""
from copy import deepcopy
from dataclasses import replace
import unittest
from authoring_fixtures import plan, dependencies, presentation_plan
from scenario_flow_server import dependencies as presentation_dependencies
from test_authoring_turns import Turns
from metriccanvas_authoring.pages.composition.structure_composition import compose_structure
from metriccanvas_authoring.pages.composition.structure_preflight import inspect_plan
from metriccanvas_authoring.pages.components.structure_presentation import capabilities
from metriccanvas_authoring.pages.editing.structure_revision import revise_structure
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


async def current():
    pass


class CurrentStructureTest(unittest.IsolatedAsyncioTestCase):
    async def test_retired_versions_rejected_before_any_query(self):
        self.assertEqual(capabilities()['versions'], ['3'])
        for version in ('1', '2', None, '4'):
            value = plan()
            value['version'] = version
            deps = dependencies()
            self.assertTrue(inspect_plan(value)['fatal'])
            result = await compose_structure('report', 'Report', 'report', value, deps, current=current)
            self.assertEqual(result['status'], 'failed')
            self.assertEqual(deps.dqe.calls, [])

    async def test_current_plan_reuses_source_and_preserves_layout_on_revision(self):
        deps = replace(dependencies(), authoring_scope=dict(Turns('new').binding), require_source_description=True)
        result = await compose_structure('report', 'Report', 'report', plan(), deps, current=current)
        self.assertEqual(result['status'], 'changed', result['issues'])
        document = result['document']
        self.assertEqual(validate_page_document(document), [])
        self.assertEqual(len(deps.dqe.calls), 1)
        self.assertEqual(len(document['sections'][1]['components']), 2)
        self.assertFalse(any(c['id'].startswith('structure-scope-') for s in document['sections'] for c in s['components']))
        parent = {'workVersion': 1, 'document': document,
                  'operations': [{'type': 'structure_state', 'state': result['structureState']}]}
        request = {'structureRevision': {'planVersion': '3', 'parentVersion': 1,
                    'patches': [{'type': 'set-section', 'sectionId': 'business', 'changes': {'title': 'Updated'}}]}}
        revised = await revise_structure(parent, request, deps, current=current)
        self.assertEqual(revised['status'], 'changed', revised['issues'])
        self.assertEqual(revised['document']['sections'][1]['title'], 'Updated')
        self.assertEqual(revised['document']['dataSources'], document['dataSources'])
        self.assertEqual(len(deps.dqe.calls), 1)
        request['structureRevision']['parentVersion'] = 0
        self.assertEqual((await revise_structure(parent, request, deps, current=current))['status'], 'failed')

    async def test_metric_summary_bindings_and_presentation_are_retained(self):
        deps = replace(presentation_dependencies(), authoring_scope=dict(Turns('new').binding), require_source_description=True)
        value = presentation_plan()
        result = await compose_structure('report', 'Report', 'report', value, deps, current=current)
        self.assertEqual(result['status'], 'changed', result['issues'])
        self.assertEqual(validate_page_document(result['document']), [])
        cards = result['document']['sections'][1]['components']
        self.assertEqual(len(cards), 3)
        for card in cards:
            self.assertEqual(card['props']['variant'], 'compactSummary')
            self.assertEqual(card['layout']['span'], 4)
            for row in card['props']['rows']:
                self.assertEqual(row['valueField']['format'], 'compact-million-2')
                for change in row['changes']:
                    self.assertEqual(change['field']['match'], row['valueField']['match'])
                    self.assertEqual(change['field']['format'], 'percent-1')

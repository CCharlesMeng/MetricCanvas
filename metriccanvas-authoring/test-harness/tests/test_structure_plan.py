import json
import unittest
from copy import deepcopy
from dataclasses import replace
from fastmcp import Client
from jsonschema import Draft202012Validator
from test_unified_content_mcp import dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_source_mapping import fixture
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.pages.composition.page_structure import block_component, StructureError
from metriccanvas_authoring.pages.editing.section_editing import edit_section


def plan():
    unit = fixture('page-build-spec.json')['units'][0]
    unit = {k: v for k, v in unit.items() if k not in {'intent', 'pinnedComponent', 'title'}}
    return {'version': '1', 'scene': 'usage-report', 'question': '区域运营报告',
            'dataContextVersion': '2026-09-02.1', 'dataRequests': [unit],
            'sections': [{'id': 'business', 'title': '经营表现', 'pattern': 'comparison',
                          'blocks': [block('chart'), block('details', 'table')]}]}


def block(id, component='barChart'):
    return {'id': id, 'type': 'data', 'source': 'result', 'component': component,
            'fields': ['区域', 'Tokens请求量'], 'title': id}


class StructurePlanTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_tool_schemas_are_valid_json_schemas(self):
        async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=MemoryCandidates())) as client:
            for tool in await client.list_tools():
                Draft202012Validator.check_schema(tool.inputSchema)

    async def test_page_ids_reject_camel_case_before_query(self):
        p = plan(); p['sections'][0]['blocks'][0]['id'] = 'overviewAmount'
        deps = dependencies(); result = await self.create(p, deps)
        self.assertFalse(result['ok']); self.assertEqual(deps.dqe.calls, [])

    async def test_natural_structure_prefix_and_titled_text_are_valid(self):
        p = plan(); p['sections'][0]['blocks'].append({'id': 'structure-note', 'type': 'text', 'title': '说明', 'body': '样例'})
        result = await self.create(p)
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['modelSummary']['status'], 'changed')

    def test_metric_card_match_uses_stable_dimension_and_rejects_ambiguity(self):
        source = {'fields': {'scope-id': {'type': 'string', 'role': 'dimension', 'queryField': 'scope'},
                            'amount-id': {'type': 'number', 'role': 'measure', 'queryField': 'amount', 'unit': '元'}},
                  'source': {'type': 'query', 'initial': {'rows': [{'scope': 'total', 'amount': 20}, {'scope': 'a', 'amount': 10}], 'totalCount': 2}}}
        b = {**block('total', 'metricCard'), 'fields': ['amount'], 'match': {'field': 'scope', 'equals': 'total'}}
        component = block_component(b, {'result': source})
        self.assertEqual(component['props']['rows'][0]['valueField'], {'data': 'main', 'field': 'amount-id', 'match': {'field': 'scope-id', 'equals': 'total'}})
        source['source']['initial']['rows'][1]['scope'] = 'total'
        with self.assertRaisesRegex(StructureError, 'STRUCTURE_ROW_SELECTION_AMBIGUOUS'):
            block_component(b, {'result': source})

    def test_section_removal_requires_exact_observed_components(self):
        page = {'sections': [{'id': 'main', 'components': [{'id': 'note', 'type': 'text'}]}]}
        op = {'type': 'remove_section', 'sectionId': 'main', 'componentIds': []}
        with self.assertRaisesRegex(StructureError, 'SECTION_COMPONENTS_CHANGED'):
            edit_section(page, op)
        self.assertEqual(edit_section(page, {**op, 'componentIds': ['note']})['sections'], [])
        self.assertEqual(len(page['sections']), 1)

    async def test_domain_enumeration_pagination_and_snapshot(self):
        async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=MemoryCandidates())) as client:
            first = (await client.call_tool('discover_data_context', {'context_ref': 'current-context',
                      'business_domain': '运营分析', 'limit': 1})).structured_content
            self.assertEqual(first['matches'][0]['kind'], 'metric')
            self.assertEqual(first['range']['end'], 1)
            stale = (await client.call_tool('discover_data_context', {'context_ref': 'current-context',
                      'business_domain': '运营分析', 'offset': 1, 'data_context_version': 'old'})).structured_content
            self.assertFalse(stale['ok'])

    async def test_missing_provider_keeps_independent_text_and_visible_failure(self):
        p = plan(); p['sections'][0]['blocks'].append({'id': 'note', 'type': 'text', 'body': '数据暂不可用'})
        result = await self.create(p, replace(dependencies(), source_description=None))
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['modelSummary']['status'], 'partial')
        page = result['artifactEnvelope']['artifact']['document']
        self.assertEqual(page['dataSources'], {})
        self.assertTrue(any('未生成' in c['props'].get('body', '') for c in page['sections'][1]['components']))

    async def test_identical_requests_with_two_ids_reuse_execution(self):
        p = plan(); other = deepcopy(p['dataRequests'][0]); other['dataSourceId'] = 'same'
        p['dataRequests'].append(other); p['sections'][0]['blocks'][1]['source'] = 'same'
        deps = dependencies(); result = await self.create(p, deps)
        self.assertTrue(result['ok'], result); self.assertEqual(len(deps.dqe.calls), 1)

    async def test_duplicate_ids_and_formula_are_rejected_before_execution(self):
        for mutate in [lambda p: p['sections'][0]['blocks'].append(deepcopy(p['sections'][0]['blocks'][0])),
                       lambda p: p['dataRequests'][0]['metrics'].append({'kind': 'formula', 'expression': '1', 'label': 'invented'})]:
            p = plan(); mutate(p); deps = dependencies(); result = await self.create(p, deps)
            self.assertFalse(result['ok']); self.assertEqual(deps.dqe.calls, [])

    def test_mixed_units_single_axis_and_truncated_proportions_rejected(self):
        source = {'fields': {'region': {'type': 'string', 'role': 'dimension'},
                            'amount': {'type': 'number', 'role': 'measure', 'unit': '元'},
                            'ratio': {'type': 'number', 'role': 'measure', 'unit': '%'}},
                  'source': {'type': 'query', 'initial': {'rows': [{'region': 'A', 'amount': 1, 'ratio': 20}], 'totalCount': 1}}}
        b = {**block('mixed'), 'fields': ['region', 'amount', 'ratio']}
        with self.assertRaisesRegex(StructureError, 'STRUCTURE_MIXED_MEASURE_UNITS'):
            block_component(b, {'result': source})
        source['source']['initial']['totalCount'] = 100
        with self.assertRaisesRegex(StructureError, 'STRUCTURE_INCOMPLETE_PROPORTION'):
            block_component({**b, 'component': 'pieChart', 'fields': ['region', 'amount']}, {'result': source})

    async def create(self, request, deps=None):
        deps = deps or dependencies()
        async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=MemoryCandidates())) as client:
            result = await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': '报告',
                                                                   'request': {'plan': request}}, raise_on_error=False)
            self.assertIsNotNone(result.structured_content, str(result))
            return result.structured_content

    async def test_one_source_two_components_in_explicit_section_executes_once(self):
        deps = dependencies()
        result = await self.create(plan(), deps)
        self.assertTrue(result['ok'], result)
        page = result['artifactEnvelope']['artifact']['document']
        self.assertEqual(validate_page_document(page), [])
        self.assertEqual(len(deps.dqe.calls), 1)
        self.assertEqual(page['sections'][1]['id'], 'business')
        self.assertEqual([c['id'] for c in page['sections'][1]['components'] if c['type'] != 'text'], ['chart', 'details'])
        self.assertEqual(page['sections'][1]['title'], '经营表现')
        self.assertTrue(any(c['type'] == 'text' for c in page['sections'][1]['components']))

    async def test_changed_scope_does_not_split_authored_section(self):
        p = plan(); other = deepcopy(p['dataRequests'][0]); other['dataSourceId'] = 'previous'
        other['time']['start'] = other['time']['end'] = '2026-07'; p['dataRequests'].append(other)
        p['sections'][0]['blocks'][1]['source'] = 'previous'
        result = await self.create(p)
        self.assertTrue(result['ok'], result)
        page = result['artifactEnvelope']['artifact']['document']
        self.assertEqual([s['id'] for s in page['sections']], ['header', 'business'])

    async def test_static_custom_plan_does_not_query(self):
        p = plan(); p['dataRequests'] = []; p['sections'][0]['pattern'] = 'custom'
        p['sections'][0]['blocks'] = [{'id': 'note', 'type': 'text', 'body': '本地样例，非生产数据。'}]
        deps = dependencies(); result = await self.create(p, deps)
        self.assertTrue(result['ok'], result); self.assertEqual(deps.dqe.calls, [])

    async def test_dangling_reference_fails_before_query(self):
        p = plan(); p['sections'][0]['blocks'][0]['source'] = 'unknown'
        deps = dependencies(); result = await self.create(p, deps)
        self.assertFalse(result['ok']); self.assertEqual(deps.dqe.calls, [])

    async def test_section_edit_and_source_reuse_do_not_query(self):
        deps = dependencies(); store = MemoryCandidates()
        async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=store)) as client:
            result = (await client.call_tool('create_content_page', {'context_ref': 'current-context', 'title': '报告', 'request': {'plan': plan()}})).structured_content
            ref = result['modelSummary']['candidateRef']
            request = {'operations': [
                {'id': 'section', 'type': 'add_section', 'sectionId': 'appendix', 'title': '附录', 'container': 'card',
                 'blocks': [{'id': 'appendix-note', 'type': 'text', 'body': '核对说明'}]},
                {'id': 'reuse', 'type': 'add_source_component', 'sectionId': 'appendix', 'block': block('reused', 'table'), 'dependsOn': ['section']},
                {'id': 'rename', 'type': 'set_section', 'sectionId': 'business', 'changes': {'title': '业务总览'}},
                {'id': 'move', 'type': 'move_section', 'sectionId': 'appendix', 'beforeId': 'business'}]}
            edited = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'candidate_ref': ref, 'request': request})).structured_content
            self.assertTrue(edited['ok'], edited)
            self.assertEqual(len(deps.dqe.calls), 1)
            page = edited['artifactEnvelope']['artifact']['document']
            self.assertEqual([s['id'] for s in page['sections']], ['header', 'appendix', 'business'])
            self.assertEqual(page['sections'][2]['title'], '业务总览')
            self.assertEqual(page['sections'][2]['components'], result['artifactEnvelope']['artifact']['document']['sections'][1]['components'])


if __name__ == '__main__':
    unittest.main()

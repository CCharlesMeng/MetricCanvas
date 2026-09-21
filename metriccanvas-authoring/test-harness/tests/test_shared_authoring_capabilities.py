"""Public behavior checks for the first architecture migration batch."""
import unittest
from copy import deepcopy
from dataclasses import replace
from unittest.mock import patch

from fastmcp import Client
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_unified_content_mcp import dependencies
from test_unified_data_addition import add, spec
from test_structure_plan import plan
from test_page_editing import title
from metriccanvas_authoring.data.query import create_query_data
from metriccanvas_authoring.application.structure_composition import compose_structure
from metriccanvas_authoring.application.unified_edit_page import edit_unified_page
from metriccanvas_authoring.domain.page_editing import edit_page_document
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server


async def current():
    pass


class SharedAuthoringCapabilitiesTest(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_legacy_spec_returns_validation_error_without_io(self):
        from metriccanvas_authoring.application.compose_page import create_compose_page, ComposePageCommand
        deps = dependencies()
        result = await create_compose_page(deps)(ComposePageCommand('report', None))
        self.assertFalse(result.ok)
        self.assertTrue(result.issues)
        self.assertEqual(deps.dqe.calls, [])

    async def test_query_does_not_select_components_or_assemble_pages(self):
        deps = replace(dependencies(), authoring_scope=Turns().binding)
        with patch('metriccanvas_authoring.application.compose_page.assemble_page_document', side_effect=AssertionError('whole page')):
            result = await create_query_data(deps)(spec())
        self.assertTrue(result.ok, result.issues)
        self.assertEqual(len(result.executions), 1)
        self.assertEqual(len(deps.dqe.calls), 1)
        self.assertFalse(hasattr(result, 'artifact'))

    async def test_structure_and_addition_do_not_construct_temporary_pages(self):
        deps = replace(dependencies(), authoring_scope=Turns().binding)
        with patch('metriccanvas_authoring.application.compose_page.assemble_page_document', side_effect=AssertionError('whole page')):
            built = await compose_structure('report', 'Report', 'report', plan(), deps, current=current)
            edited = await edit_unified_page(Turns().baseline.document, {'operations': [add()]}, deps, current=current)
        self.assertEqual(built['status'], 'changed', built)
        self.assertEqual(edited['status'], 'changed', edited)
        self.assertEqual(edited['document']['sections'][0]['components'][-1]['layout']['span'], 12)

    async def test_unified_entry_does_not_construct_a_compatibility_server(self):
        deps = replace(dependencies(), authoring_scope=Turns().binding)
        with patch('metriccanvas_authoring.entrypoints.compat.content_mcp.create_content_mcp_server', side_effect=AssertionError('nested MCP')):
            async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=MemoryCandidates())) as client:
                output = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec()})).structured_content
        self.assertTrue(output['ok'], output)

    async def test_sync_and_async_batches_have_identical_partial_and_noop_semantics(self):
        page = Turns().baseline.document
        before = deepcopy(page)
        request = {'operations': [title('missing', component='absent'),
            title('dependent', dependsOn=['missing']), title('independent')]}
        sync = edit_page_document(page, request)
        asynchronous = await edit_unified_page(page, request, dependencies(), current=current)
        self.assertEqual(sync, {k: v for k, v in asynchronous.items() if k != 'sourceDescriptions'})
        self.assertEqual(sync['status'], 'partial')
        again = edit_page_document(sync['document'], {'operations': [title('independent')]})
        self.assertEqual(again['status'], 'unchanged')
        self.assertEqual(page, before)

    async def test_data_failure_rolls_back_and_skips_only_dependents(self):
        deps = replace(dependencies(), source_description=None, require_source_description=True)
        page = Turns().baseline.document
        before = deepcopy(page)
        result = await edit_unified_page(page, {'operations': [add(), title('dependent', dependsOn=['new-chart']),
            title('independent')]}, deps, current=current)
        self.assertEqual([op['status'] for op in result['operations']], ['failed', 'skipped', 'applied'])
        self.assertEqual(result['document']['dataSources'], before['dataSources'])
        self.assertEqual(deps.dqe.calls, [])
        self.assertEqual(page, before)

    async def test_addition_rejects_other_page_base_before_query(self):
        deps = replace(dependencies(), authoring_scope=Turns().binding)
        operation = add()
        operation['spec']['baseRevision'] = {'pageId': 'another-page', 'revisionId': 'r1', 'revisionNumber': 1}
        result = await edit_unified_page(Turns().baseline.document, {'operations': [operation]}, deps, current=current)
        self.assertIsNone(result['document'])
        self.assertEqual(result['operations'][0]['issues'][0]['code'], 'BASE_REVISION_PAGE_ID_MISMATCH')
        self.assertEqual(deps.dqe.calls, [])

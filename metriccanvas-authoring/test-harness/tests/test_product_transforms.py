"""Offline product entrypoints and unchanged controlled adapters, synthetic facts only."""
from copy import deepcopy
from dataclasses import replace
import asyncio
import json
from pathlib import Path
import socket
import unittest
from unittest.mock import patch

from metriccanvas_authoring.data import product_operations as data_ops
from metriccanvas_authoring.pages import product_operations as page_ops
from metriccanvas_authoring.work import product_operations as work_ops
from metriccanvas_authoring.data.query import (prepare_query_data, map_query_fields, finalize_query_data,
    create_query_data, QueryDataDependencies)
from metriccanvas_authoring.data.execution import DqeExecutionResult
from metriccanvas_authoring.data.result_rules import check_result_record, project_result_evidence
from metriccanvas_authoring.pages.referenced import compose_candidate, edit_candidate, edit
from metriccanvas_authoring.pages.composition.compose_page import compose_queried_page, ComposePageCommand
from metriccanvas_authoring.bundle_info import load_bundle_info
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.work.rules import reserve_work, finish_work
from metriccanvas_authoring.work.receipt_rules import check_provider_receipt
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
from test_page_editing import page, title

FIXTURES = Path(__file__).resolve().parents[1] / 'fixtures'


def fixture(name):
    return json.loads((FIXTURES / name).read_text())


def query_input():
    return {'spec': fixture('page-build-spec.json'), 'dataContext': fixture('data-context.json')}


def work():
    return {'workVersion': 2, 'active': None, 'lastRequest': 'previous', 'lastResult': None,
            'document': page(), 'binding': {'runId': 'r'}}


class OfflineProductTest(unittest.TestCase):
    def test_fixed_vectors_ban_network_and_keep_inputs(self):
        with patch.object(socket.socket, 'connect', side_effect=AssertionError('network forbidden')):
            for module in (data_ops, page_ops, work_ops):
                for vector in module.SELF_TESTS:
                    before = deepcopy(vector)
                    result = module.invoke(vector['operation'], vector['input'])
                    self.assertEqual(result['status'], vector['expectedStatus'])
                    if 'expectedDiagnostic' in vector:
                        self.assertIn(vector['expectedDiagnostic'], [i['code'] for i in result['diagnostics']])
                    self.assertEqual(vector, before)

    def test_prepare_is_candidate_and_never_executes(self):
        value = query_input()
        before = deepcopy(value)
        result = data_ops.invoke('query.prepare', value)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['data']['execution'], 'not-run')
        self.assertNotIn('sources', result['data'])
        self.assertEqual(value, before)

    def test_normalize_preserves_raw_rows_fields_and_coverage(self):
        value = query_input()
        supplied = fixture('page-build-execution.json')
        supplied['totalCount'] = 12
        value['executions'] = [supplied]
        before = deepcopy(value)
        result = data_ops.invoke('results.normalize', value)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['data']['sources']['result']['source']['initial']['rows'], supplied['rows'])
        self.assertEqual(result['data']['coverage'], [{'returnedCount': 2, 'totalCount': 12, 'complete': False, 'truncated': True}])
        self.assertEqual(value, before)

    def test_empty_unknown_and_missing_execution_are_distinct(self):
        for total, complete in ((0, True), (None, False)):
            value = {**query_input(), 'executions': [{'rows': [], 'totalCount': total}]}
            result = data_ops.invoke('results.normalize', value)
            self.assertEqual(result['status'], 'ok')
            self.assertEqual(result['data']['coverage'][0]['complete'], complete)
        result = data_ops.invoke('results.normalize', {**query_input(), 'executions': []})
        self.assertEqual(result['diagnostics'][0]['code'], 'RESULT_EVIDENCE_MISSING')

    def test_bad_mapping_keeps_rows_and_reports_product_code(self):
        value = {**query_input(), 'executions': [{'rows': [{'wrong': 1}], 'totalCount': 1}]}
        before = deepcopy(value)
        result = data_ops.invoke('results.normalize', value)
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['diagnostics'][0]['stage'], 'presentation')
        self.assertEqual(value, before)

    def test_compose_query_result_and_edit_slice(self):
        normalized = data_ops.invoke('results.normalize', {**query_input(), 'executions': [fixture('page-build-execution.json')]})
        source = normalized['data']['sources']['result']
        fields = list(source['fields'])
        request = {'title': '候选', 'sources': {'result': 'explicit-result'}, 'sections': [
            {'id': 'main', 'pattern': 'custom', 'blocks': [{'id': 'chart', 'type': 'data',
                'source': 'result', 'component': 'barChart', 'fields': fields, 'title': '区域'}]}]}
        value = {'pageId': 'offline-example', 'request': request,
                 'resultRecords': {'result': {'source': source, 'rows': fixture('page-build-execution.json')['rows'], 'totalCount': 2}}}
        before = deepcopy(value)
        result = page_ops.invoke('page.compose', value)
        self.assertEqual(result['status'], 'ok', result['diagnostics'])
        baseline = result['data']['document']
        edited = page_ops.invoke('page.edit', {'baseline': baseline, 'resultRecords': {},
            'request': {'operations': [title(component='chart', value='新标题')]}})
        self.assertEqual(edited['status'], 'ok', edited['diagnostics'])
        self.assertEqual(edited['data']['saveStatus'], 'not_requested')
        self.assertEqual(value, before)
        self.assertEqual(baseline['dataSources'], edited['data']['document']['dataSources'])

    def test_edit_preserves_order_partial_rollback_and_dependencies(self):
        request = {'operations': [title(), title('bad', 'absent'), title('skip', 'chart', dependsOn=['bad']),
                                  title('last', 'table')]}
        before = deepcopy((page(), request))
        result = edit_candidate(before[0], request, {})
        self.assertEqual([o['status'] for o in result['operations']], ['applied', 'failed', 'skipped', 'applied'])
        self.assertEqual([o['id'] for o in result['operations']], ['title', 'bad', 'skip', 'last'])
        self.assertEqual(request, before[1])
        self.assertEqual(before[0], page())

    def test_missing_result_rolls_back_only_affected_operation(self):
        operation = {'id': 'missing', 'type': 'add_result_component', 'sectionId': 'main', 'resultRef': 'absent',
            'block': {'id': 'new-table', 'type': 'data', 'source': 'external', 'component': 'table',
                      'fields': ['amount'], 'title': '明细', 'purpose': 'reconciliation'}}
        result = edit_candidate(page(), {'operations': [operation, title()]}, {})
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['operations'][0]['issues'][0]['code'], 'RESULT_EVIDENCE_MISSING')
        self.assertNotIn('external', result['document']['dataSources'])

    def test_query_assembly_uses_supplied_facts(self):
        value = query_input()
        queried = prepare_query_data(value['spec'], value['dataContext'])
        evidence = fixture('page-build-execution.json')
        queried = finalize_query_data(queried, [DqeExecutionResult(evidence['rows'], evidence['totalCount'], evidence['capturedAt'])])
        result = compose_queried_page(ComposePageCommand('offline-build', value['spec']), queried, load_bundle_info())
        self.assertTrue(result.ok, result.issues)
        self.assertEqual(result.artifact.document['id'], 'offline-build')

    def test_scope_version_policy_and_readiness_checks_do_not_authorize(self):
        record = {'binding': {'runId': 'r'}, 'dataContextVersion': 'v', 'validationPolicy': {'strict': False}, 'status': 'pending'}
        for binding, version, policy, code in [({}, 'v', {'strict': False}, 'RESULT_SCOPE_MISMATCH'),
            ({'runId': 'r'}, 'new', {'strict': False}, 'RESULT_VERSION_STALE'),
            ({'runId': 'r'}, 'v', {'strict': True}, 'RESULT_VALIDATION_POLICY_CHANGED'),
            ({'runId': 'r'}, 'v', {'strict': False}, 'RESULT_NOT_READY')]:
            with self.assertRaises(ContentBaselineError) as error:
                check_result_record(record, binding, version, policy)
            self.assertEqual(error.exception.code, code)
        self.assertEqual(check_result_record(record, record['binding'], 'v', record['validationPolicy'], allow_unready=True), record)

    def test_pending_projection_uses_explicit_clock(self):
        record = {'resultRef': 'result-1', 'request': {'dataSourceId': 'result'}, 'status': 'pending', 'expiresAt': 10}
        self.assertEqual(project_result_evidence(record, now=9)['issues'][0]['code'], 'RESULT_NOT_READY')
        self.assertEqual(project_result_evidence(record, now=11)['issues'][0]['code'], 'QUERY_ATTEMPT_EXPIRED')

    def test_work_unknown_and_busy_block_reservation_without_mutation(self):
        value = work()
        value['lastResult'] = {'status': 'changed', 'saveStatus': 'unknown'}
        before = deepcopy(value)
        with self.assertRaises(ContentBaselineError) as error:
            reserve_work(value, 2, 'new')
        self.assertEqual(error.exception.code, 'SAVE_RECONCILIATION_REQUIRED')
        self.assertEqual(value, before)
        self.assertEqual(reserve_work(value, 99, 'previous')['decision'], 'reuse')

    def test_work_finish_and_stale_versions(self):
        value = work()
        with self.assertRaises(ContentBaselineError):
            reserve_work(value, 1, 'new')
        reserved = reserve_work(value, 2, 'new')
        self.assertIsNone(value['active'])
        self.assertEqual(reserved['work']['active'], 'new')
        with self.assertRaises(ContentBaselineError):
            finish_work(reserved['work'], 'late', {})
        finished = finish_work(reserved['work'], 'new', {'status': 'changed'})
        self.assertEqual(finished['lastRequest'], 'new')

    def test_provider_receipt_requires_exact_document_ref_and_operation(self):
        command = {'context': {'operationId': 'save-1'}, 'pageId': 'edit-example', 'base': None, 'document': page()}
        receipt = {'status': 'saved', 'operationId': 'save-1', 'ref': {'pageId': 'edit-example', 'resourceId': 'draft', 'revisionId': 'revision'},
            'base': None, 'revisionNumber': 1, 'isDraft': True, 'document': page(), 'assurance': 'provider-response'}
        before = deepcopy((command, receipt))
        self.assertEqual(check_provider_receipt(receipt, command), receipt)
        receipt['operationId'] = 'late'
        with self.assertRaises(LifecycleError):
            check_provider_receipt(receipt, command)
        self.assertEqual(command, before[0])


class LegacyDelegationTest(unittest.IsolatedAsyncioTestCase):
    async def test_async_edit_matches_pure_batch_and_checks_each_boundary(self):
        calls = []
        async def current():
            calls.append('current')
        async def resolve(ref):
            raise AssertionError('no result lookup needed')
        request = {'operations': [title(), title('second', 'table')]}
        expected = edit_candidate(page(), request, {})
        actual = await edit(page(), request, resolve, current)
        self.assertEqual(actual, expected)
        self.assertEqual(calls, ['current', 'current', 'current'])


class CompleteEvidenceTest(unittest.IsolatedAsyncioTestCase):
    async def test_query_adapter_delegates_exact_mapping_and_rows(self):
        from test_source_mapping import DescriptorFixture
        from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
        value = query_input()
        raw = fixture('page-build-execution.json')
        execution = DqeExecutionResult(raw['rows'], raw['totalCount'], raw['capturedAt'])
        descriptor = DescriptorFixture()
        dependencies = QueryDataDependencies(FakeDataContextPort(value['dataContext']), FakeDqeExecutionPort(execution),
            source_description=descriptor, authoring_scope={'runId': 'r'}, stable_field_ids=True)
        online = await create_query_data(dependencies)(value['spec'])
        prepared = prepare_query_data(value['spec'], value['dataContext'])
        description = await descriptor.describe({'runId': 'r'}, prepared.data_context_version, prepared.units[0].effective_query())
        offline = finalize_query_data(map_query_fields(prepared, [description]), [execution], validate_rows=True)
        self.assertEqual(online, offline)

    async def test_result_add_delegates_without_reordering_or_mutating_evidence(self):
        normalized = data_ops.invoke('results.normalize', {**query_input(), 'executions': [fixture('page-build-execution.json')]})
        source = normalized['data']['sources']['result']
        record = {'source': source, 'rows': fixture('page-build-execution.json')['rows'], 'totalCount': 2}
        operation = {'id': 'add', 'type': 'add_result_component', 'sectionId': 'main', 'resultRef': 'evidence',
            'block': {'id': 'new-chart', 'type': 'data', 'source': 'result', 'component': 'barChart',
                      'fields': list(source['fields']), 'title': '新增图表', 'purpose': 'comparison'}}
        request = {'operations': [operation, title()]}
        before = deepcopy(record)
        async def current():
            pass
        async def resolve(ref):
            self.assertEqual(ref, 'evidence')
            return record
        self.assertEqual(await edit(page(), request, resolve, current), edit_candidate(page(), request, {'evidence': record}))
        self.assertEqual(record, before)

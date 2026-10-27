"""Public-contract regressions; synthetic authorized adapters, no production claims."""
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from fastmcp import Client
import test_platform_v2 as platform
from authoring_fixtures import dependencies
from test_page_editing import page, edit, title
from metriccanvas_authoring.data.time_range import normalize_time, TimeRangeError
from metriccanvas_authoring.data.query import QueryDataDependencies, create_query_data
from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy
from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
from metriccanvas_authoring.pages.composition.page_structure import block_component, StructureError

ROOT = Path(__file__).resolve().parents[3]
CASES = json.loads((ROOT / 'tools/fixtures/query-time-contract.json').read_text())


def input_time(case):
    value = deepcopy(case['input'])
    value['granularity'] = value.pop('period')
    return {**value, 'providedBy': 'user'}


class TimeContractTest(unittest.IsolatedAsyncioTestCase):
    def test_cross_language_vectors(self):
        for case in CASES:
            with self.subTest(case=case):
                value = input_time(case)
                if 'error' in case:
                    with self.assertRaises(TimeRangeError) as caught:
                        normalize_time(value)
                    self.assertEqual(caught.exception.code, case['error'])
                else:
                    expected = input_time({'input': case['expected']})
                    self.assertEqual(normalize_time(value), expected)

    def test_published_time_schemas_share_the_same_precision_contract(self):
        root = ROOT / 'metriccanvas-authoring/contracts/authored'
        build = json.loads((root / 'page-build-spec.schema.json').read_text())['$defs']['time']
        plan = json.loads((root / 'page-structure-plan.schema.json').read_text())['oneOf'][0]['properties']['dataRequests']['items']['properties']['time']['oneOf'][1]
        self.assertEqual(build, plan)

    async def test_invalid_calendar_precision_and_order_never_execute_in_either_mode(self):
        for strict in (False, True):
            for case in CASES:
                if 'error' not in case:
                    continue
                with self.subTest(strict=strict, case=case):
                    deps = dependencies()
                    spec = json.loads((ROOT / 'metriccanvas-authoring/test-harness/fixtures/page-build-spec.json').read_text())
                    spec['units'][0]['time'] = input_time(case)
                    result = await create_query_data(QueryDataDependencies(deps.data_context, deps.dqe,
                        validation_policy=QueryValidationPolicy(strict=strict)))(spec)
                    self.assertFalse(result.ok)
                    self.assertEqual(result.issues[0].code, case['error'])
                    self.assertEqual(deps.dqe.calls, [])

    def fixture(self):
        case = platform.PlatformV2Test(); case.setUp(); self.addCleanup(case.doCleanups)
        return case

    async def test_mcp_schema_rejects_precision_mismatch_and_runtime_rejects_bad_calendar(self):
        case = self.fixture()
        async with Client(create_platform_mcp_server(case.app)) as client:
            request = platform.query_request()
            request['requests'][0]['time'].update(granularity='month', start='20260401', end='20260930')
            result = await client.call_tool('query_data', {'context_ref': 'current-context', 'request': request})
            issue = result.structured_content['modelSummary']['results'][0]['issues'][0]
            self.assertEqual(issue['code'], 'TIME_VALUE_PRECISION_INVALID')
            from jsonschema import Draft202012Validator
            tools = await client.list_tools()
            schema = next(tool.inputSchema for tool in tools if tool.name == 'query_data')
            self.assertFalse(Draft202012Validator(schema).is_valid({'context_ref': 'current-context', 'request': request}))
            request['requests'][0]['time'].update(granularity='day', start='2026-02-30', end='2026-03-01')
            result = await client.call_tool('query_data', {'context_ref': 'current-context', 'request': request})
        issue = result.structured_content['modelSummary']['results'][0]['issues'][0]
        self.assertEqual(issue['path'], '/requests/0/time/start')
        self.assertEqual(issue['code'], 'TIME_VALUE_CALENDAR_INVALID')
        self.assertEqual(case.deps.dqe.calls, [])

    async def test_partial_batch_rebases_cached_error_and_preserves_valid_scope(self):
        case = self.fixture()
        request = platform.query_request()
        invalid = deepcopy(request['requests'][0]); invalid['dataSourceId'] = 'invalid'
        invalid['metrics'][0]['name'] = 'missing-governed-metric'
        request['requests'].append(invalid)
        first = await case.app.query('current-context', request)
        self.assertEqual(first['status'], 'partial')
        issue = first['results'][1]['issues'][0]
        self.assertTrue(issue['path'].startswith('/requests/1/'))
        self.assertTrue(issue['message'])
        request['requests'] = [invalid]
        second = await case.app.query('current-context', request)
        self.assertTrue(second['results'][0]['issues'][0]['path'].startswith('/requests/0/'))
        self.assertEqual(first['results'][1]['resultRef'], second['results'][0]['resultRef'])
        self.assertEqual(len(case.deps.dqe.calls), 1)

    async def test_equivalent_input_authorization_and_result_identity(self):
        case = self.fixture()
        seen = []
        original = case.auth.authorize
        async def authorize(binding, request, version):
            seen.append(deepcopy(request))
            return await original(binding, request, version)
        case.auth.authorize = authorize
        request = platform.query_request()
        request['requests'][0]['time'].update(granularity='M', start='202604', end='202609')
        first = await case.app.query('current-context', request)
        request['requests'][0]['time'].update(granularity='month', start='2026-04', end='2026-09')
        second = await case.app.query('current-context', request)
        self.assertEqual(first['results'][0]['resultRef'], second['results'][0]['resultRef'])
        self.assertEqual(len(case.deps.dqe.calls), 1)
        self.assertTrue(all(r['time'] == request['requests'][0]['time'] for r in seen))
        self.assertEqual(first['results'][0]['normalizations'][1]['to'], '2026-04')
        self.assertEqual(second['results'][0]['normalizations'], [])

    async def test_saved_artifact_inspects_before_preview_and_rejects_cross_artifact(self):
        import sys
        sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/mc-content/scripts'))
        from mc_content import compile_layout, inspect_artifact
        from mc_resources import value_digest
        case = self.fixture()
        root = ROOT / 'metriccanvas-authoring/mc-content'
        value = {'requestId': 'compile-A', 'templateRef': {'scene': 'business-report', 'variant': 'standard', 'templateVersion': '1'},
                 'plan': platform.text_request()}
        compiled = compile_layout(value, root=root)
        summary, artifact = await case.app.mutate('compose', 'current-context', compiled['plan'])
        self.assertEqual(summary['saveStatus'], 'saved')
        spec = compiled['inspectionSpec']
        association = {'artifactRef': artifact['artifactRef'], 'requestId': value['requestId'], 'compileInput': value,
                       'documentSha256': value_digest(artifact['document']), 'inspectionSpecSha256': value_digest(spec)}
        report = inspect_artifact(artifact, spec, artifact_ref=artifact['artifactRef'], binding=case.turns.binding,
                                  association=association, root=root)
        self.assertEqual(report['status'], 'ok', report)
        self.assertEqual(report['correlation']['status'], 'checked')
        self.assertEqual(case.preview.calls, [])
        _, second = await case.app.mutate('edit', 'current-context', {'operations': [title(component='page-header')]}, summary['workVersion'])
        report = inspect_artifact(second, spec, artifact_ref=artifact['artifactRef'], binding=case.turns.binding,
                                  association=association, root=root)
        self.assertEqual(report['status'], 'not_run')


class CompositionContractTest(unittest.TestCase):
    def test_presentations_share_complete_evidence_and_refuse_ambiguous_rows(self):
        rows = [{'region': 'a', 'amount': 1}, {'region': 'b', 'amount': 2}]
        source = {'fields': {'region': {'type': 'string', 'role': 'dimension'},
                            'amount': {'type': 'number', 'role': 'measure'}},
                  'source': {'type': 'query', 'initial': {'rows': rows[:1], 'totalCount': 2}}}
        block = {'id': 'card', 'type': 'data', 'source': 's', 'component': 'metricCard',
                 'title': 'Amount', 'fields': ['amount'], 'match': {'field': 'region', 'equals': 'a'}}
        for presentation in ({}, {'presentation': {'kind': 'metric-summary', 'metrics': [{'field': 'amount'}]}}):
            current = {**block, **presentation}
            self.assertEqual(block_component(current, {'s': source}, evidence={'rows': rows, 'totalCount': 2})['type'], 'metricCard')
            for evidence in ({'rows': rows[:1], 'totalCount': 2}, {'rows': rows, 'totalCount': None},
                             {'rows': [rows[0], rows[0]], 'totalCount': 2}, {'rows': [], 'totalCount': 0}):
                with self.subTest(presentation=presentation, evidence=evidence), self.assertRaises(StructureError):
                    block_component(current, {'s': source}, evidence=evidence)

    def test_failed_edit_keeps_local_reason_and_dependent_operations_skip(self):
        result = edit(page(), {'id': 'bad', 'type': 'change_component_type', 'componentId': 'header', 'componentType': 'barChart'},
                      title('dependent', dependsOn=['bad']), title('independent'))
        self.assertEqual([r['status'] for r in result['operations']], ['failed', 'skipped', 'applied'])
        issue = result['operations'][0]['issues'][0]
        self.assertEqual(issue['path'], '/operations/0/componentId')
        self.assertEqual(issue['reason'], 'component_type_not_data')
        self.assertEqual(issue['operationId'], 'bad')
        self.assertTrue(issue['message'])

    def test_schema_diagnostics_locate_type_and_do_not_echo_input(self):
        result = edit(page(), title(value={'secret': 'do-not-expose'}))
        issue = result['operations'][0]['issues'][0]
        self.assertEqual(issue['path'], '/operations/0/title')
        self.assertEqual(issue['expected'], 'string')
        self.assertNotIn('do-not-expose', json.dumps(issue))


class DiagnosticsContractTest(unittest.IsolatedAsyncioTestCase):
    async def test_nested_spans_and_failed_stage_do_not_leak_arguments(self):
        from metriccanvas_authoring.work.diagnostics import timed_stage, stage_context
        seen = []
        @timed_stage('child')
        async def child(secret):
            seen.append(stage_context())
            raise ValueError(secret)
        @timed_stage('parent')
        async def parent():
            seen.append(stage_context())
            await child('secret-value')
        with self.assertLogs('metriccanvas_authoring.work.diagnostics', level='INFO') as logs:
            with self.assertRaises(ValueError):
                await parent()
        self.assertEqual(seen[0]['traceId'], seen[1]['traceId'])
        self.assertNotEqual(seen[0]['spanId'], seen[1]['spanId'])
        self.assertIsNone(stage_context()['traceId'])
        self.assertNotIn('secret-value', str(logs.output))
        self.assertIn('completed=False', str(logs.output))

    def test_provider_message_is_never_forwarded(self):
        from metriccanvas_authoring.data.query import QueryDataIssue
        from metriccanvas_authoring.data.request_diagnostics import query_issue
        issue = query_issue(QueryDataIssue('DQE_ITEM_ERROR', '/units/0', 'password=secret SQL private', stage='execution'))
        self.assertNotIn('private', str(issue))
        self.assertEqual(issue['action'], 'inspect_execution_failure')

    def test_domain_candidates_are_exact_bounded_and_do_not_infer_compatibility(self):
        from metriccanvas_authoring.data.request_diagnostics import domain_candidates
        snapshot = {'executionEnvironments': [{'schemas': [
            {'name': 'current', 'metrics': [{'name': 'Amount'}]},
            {'name': 'USD', 'metrics': [{'name': 'Amount', 'unit': 'USD'}]},
            {'name': 'CNY', 'metrics': [{'name': 'Sales', 'aliases': ['Amount'], 'unit': 'CNY'}]},
            {'name': 'derived', 'metrics': [{'name': 'Amount CAGR'}]}]}],
            'metadataCoverage': {'complete': False}}
        result = domain_candidates(snapshot, {'businessDomain': 'current', 'metrics': [{'kind': 'metric', 'name': 'Amount'}]})
        self.assertEqual([c['businessDomain'] for c in result['items']], ['USD', 'CNY'])
        self.assertTrue(all(c['metricCompatibility'] == 'unknown' for c in result['items']))
        self.assertFalse(result['snapshotComplete'])

    def test_adapter_identity_does_not_include_credentials_or_claim_tested(self):
        from metriccanvas_authoring.bootstrap.adapter_diagnostics import implementation_identity
        class Adapter:
            turn_metadata_capability = 'turn-metadata/1'
            auth_token = 'private-token'
        value = implementation_identity(Adapter())
        self.assertEqual(value['turnMetadata'], 'turn-metadata/1')
        self.assertEqual(len(value['moduleSha256']), 64)
        self.assertNotIn('private-token', str(value))
        self.assertTrue(value['verification'].startswith('not_run'))


class QueryDiagnosticPathTest(unittest.TestCase):
    def test_metadata_paths_are_not_rebased_as_request_fields(self):
        from metriccanvas_authoring.data.query import QueryDataIssue
        from metriccanvas_authoring.data.request_diagnostics import query_issue, locate_results
        issues = [query_issue(QueryDataIssue('DATA_CONTEXT_INVALID', '/executionEnvironments/0', 'private', stage='discovery')),
                  query_issue(QueryDataIssue('DATA_CONTEXT_VERSION_CHANGED', '/dataContextVersion', 'private', stage='discovery'))]
        result = locate_results([{'issues': issues}], [])
        self.assertEqual([i['path'] for i in result[0]['issues']], ['/executionEnvironments/0', '/dataContextVersion'])
        self.assertEqual([i['pathScope'] for i in result[0]['issues']], ['dataContext', 'inputEnvelope'])

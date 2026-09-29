"""Small input faults must not discard independent successful work."""
import unittest
from copy import deepcopy
import test_platform_v2 as fixtures
from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
from fastmcp import Client


class AuthoringToleranceTest(unittest.IsolatedAsyncioTestCase):
    setUp = fixtures.PlatformV2Test.setUp
    make = fixtures.PlatformV2Test.make

    async def request(self):
        result = await self.app.query('current-context', fixtures.query_request())
        return {'title': '报告', 'sources': {'result': result['results'][0]['resultRef']},
                'sections': deepcopy(fixtures.plan()['sections'])}

    async def test_optional_display_faults_complete_through_mcp(self):
        request = await self.request()
        request['layout'] = None
        section = request['sections'][0]
        section.pop('pattern', None)
        section['container'] = 'unsupported-decoration'
        for block in section['blocks']:
            if block['type'] == 'data':
                block['width'] = '100%'
                block['purpose'] = None
        async with Client(create_platform_mcp_server(self.app)) as client:
            value = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'request': request})).structured_content
        self.assertEqual(value['modelSummary']['saveStatus'], 'saved', value)
        self.assertTrue(value['modelSummary']['adjustments'])
        self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_bad_block_does_not_reject_good_blocks(self):
        request = await self.request()
        request['sections'][0]['blocks'].append({'id': 'bad-note', 'type': 'text', 'body': 123})
        result, artifact = await self.app.mutate('compose', 'current-context', request)
        self.assertEqual(result['saveStatus'], 'saved', result)
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['operations'][-1]['status'], 'failed')
        self.assertIsNotNone(artifact)
        self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_missing_reference_has_path_and_no_injection_advice(self):
        request = await self.request()
        request['sources']['result'] = 'result-missing'
        async with Client(create_platform_mcp_server(self.app)) as client:
            value = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'request': request})).structured_content
        issue = value['modelSummary']['issues'][0]
        self.assertEqual(issue['path'], '/sources/result')
        self.assertEqual(issue['action'], 'check_current_turn_and_store')
        self.assertIn('resultRef', issue['message'])
        self.assertEqual(len(self.service.calls), 0)

    async def test_invalid_query_item_does_not_block_authorized_item(self):
        request = fixtures.query_request()
        invalid = deepcopy(request['requests'][0])
        invalid.update(dataSourceId='bad', extraFilter='must-not-be-ignored')
        request['requests'].append(invalid)
        result = await self.app.query('current-context', request)
        self.assertEqual(result['status'], 'partial', result)
        self.assertEqual(result['results'][0]['status'], 'ready')
        self.assertEqual(result['results'][1]['status'], 'failed')
        self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_complete_metadata_shared_across_discover_query_and_restart(self):
        from dataclasses import replace
        import test_dataset_metadata_http as metadata
        from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
        t = metadata.DatasetMetadataHttpTest(); t.setUp()
        try:
            provider = t.make(projection=metadata.PROJECTION)
            self.deps = replace(self.deps, data_context=provider)
            def app():
                return self.make(semantic_catalog=SemanticCatalog(provider, self.store))
            first = await app().discover('current-context', 'Tokens')
            ref = next(c['detailRef'] for c in first['matches'] if c['kind'] == 'metric')
            await app().discover('current-context', 'Tokens', detail_refs=[ref])
            request = fixtures.query_request(); request['dataContextVersion'] = first['dataContextVersion']
            result = await app().query('current-context', request)
            self.assertEqual(result['status'], 'ready', result)
            await app().mutate('compose', 'current-context', {'title': '报告',
                'sources': {'result': result['results'][0]['resultRef']}, 'sections': fixtures.plan()['sections']})
            self.assertEqual(len(t.calls), 1)
            self.assertEqual(len(self.deps.dqe.calls), 1)
        finally:
            t.doCleanups()

    async def test_transient_query_is_retried_once_and_success_reused(self):
        from metriccanvas_authoring.data.execution import DqeExecutionError
        delegate = self.deps.dqe
        attempts = []
        class Flaky:
            async def execute(inner, query):
                attempts.append(deepcopy(query))
                if len(attempts) == 1:
                    raise DqeExecutionError('DQE_TIMEOUT', 'temporary')
                return await delegate.execute(query)
        from dataclasses import replace
        self.deps = replace(self.deps, dqe=Flaky()); self.app = self.make()
        first = await self.app.query('current-context', fixtures.query_request())
        second = await self.app.query('current-context', fixtures.query_request())
        self.assertEqual(first['status'], 'ready', first)
        self.assertEqual(first['results'][0]['retryCount'], 1)
        self.assertEqual(first['results'][0]['resultRef'], second['results'][0]['resultRef'])
        self.assertEqual(len(attempts), 2)
        self.assertEqual(attempts[0], attempts[1])

    async def test_transient_retry_rechecks_authorization(self):
        from metriccanvas_authoring.data.execution import DqeExecutionError
        from metriccanvas_authoring.work.content_ports import ContentBaselineError
        from dataclasses import replace
        calls = []
        class Revoked:
            async def execute(inner, query):
                calls.append(query)
                self.auth.allowed = False
                raise DqeExecutionError('DQE_TIMEOUT', 'temporary')
        self.deps = replace(self.deps, dqe=Revoked())
        with self.assertRaisesRegex(ContentBaselineError, 'MODEL_EVIDENCE_UNAVAILABLE'):
            await self.make().query('current-context', fixtures.query_request())
        self.assertEqual(len(calls), 1)

    async def test_permanent_query_rejection_is_not_retried(self):
        from metriccanvas_authoring.data.execution import DqeExecutionError
        from dataclasses import replace
        calls = []
        class Rejected:
            async def execute(inner, query):
                calls.append(query)
                raise DqeExecutionError('DQE_QUERY_REJECTED', 'business rejection')
        self.deps = replace(self.deps, dqe=Rejected()); self.app = self.make()
        first = await self.app.query('current-context', fixtures.query_request())
        await self.app.query('current-context', fixtures.query_request())
        self.assertEqual(first['status'], 'failed')
        self.assertEqual(len(calls), 1)

    async def test_source_unknown_keys_are_not_silently_discarded(self):
        request = await self.request()
        request['filterOverride'] = {'区域': '华东'}
        result = None
        from metriccanvas_authoring.work.content_ports import ContentBaselineError
        with self.assertRaisesRegex(ContentBaselineError, 'COMPOSE_REQUEST_INVALID'):
            result = await self.app.mutate('compose', 'current-context', request)
        self.assertIsNone(result)
        self.assertEqual(len(self.service.calls), 0)

    async def test_dimension_query_binding_uses_name_not_label_or_id(self):
        from metriccanvas_authoring.data.semantic_catalog import dimension_card
        card = dimension_card({'id': 'model', 'name': '域'}, {'id': 'dimension-123', 'name': '区域', 'caption': '业务地域'})
        self.assertEqual(card['queryBinding'], {'groupBy': '区域', 'filterDimension': '区域'})
        self.assertEqual(card['label'], '业务地域')

    async def test_rejected_before_save_can_retry_same_request_after_fix(self):
        from metriccanvas_authoring.work.content_ports import ContentBaselineError
        request = await self.request()
        original = self.app.results.require
        async def unavailable(*args, **kwargs):
            raise ContentBaselineError('RESULT_SCOPE_MISMATCH')
        self.app.results.require = unavailable
        with self.assertRaises(ContentBaselineError):
            await self.app.mutate('compose', 'current-context', request)
        self.app.results.require = original
        result, _ = await self.app.mutate('compose', 'current-context', request)
        self.assertEqual(result['saveStatus'], 'saved', result)
        self.assertEqual(len(self.service.calls), 1)

    async def test_concurrent_identical_queries_reuse_owner(self):
        import asyncio
        one, two = await asyncio.gather(
            self.app.query('current-context', fixtures.query_request()),
            self.app.query('current-context', fixtures.query_request()))
        self.assertEqual(one['status'], 'ready', one)
        self.assertEqual(two['status'], 'ready', two)
        self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_unknown_component_uses_same_fields_in_table(self):
        request = await self.request()
        block = next(b for b in request['sections'][0]['blocks'] if b['type'] == 'data')
        block['component'] = 'unsupported-chart'
        result, artifact = await self.app.mutate('compose', 'current-context', request)
        self.assertEqual(result['saveStatus'], 'saved', result)
        self.assertTrue(any(a['code'] == 'COMPONENT_FALLBACK_TABLE' for a in result['adjustments']))
        shown = next(c for s in artifact['document']['sections'] for c in s['components'] if c['id'] == block['id'])
        self.assertEqual(shown['type'], 'table')
        self.assertEqual(len(shown['props']['columns']), len(block['fields']))

    async def test_partial_metadata_remains_usable_and_new_turn_refreshes(self):
        from dataclasses import replace
        import json
        import httpx
        import test_dataset_metadata_http as metadata
        from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
        t = metadata.DatasetMetadataHttpTest(); t.setUp()
        try:
            def handle(request):
                t.calls.append(request)
                ids = json.loads(request.content).get('datasetIds')
                items = [v for v in t.payload['dataset_details'] if not ids or v['dataset_id'] in ids]
                return httpx.Response(200, json={'retCode': 'CBC.0000', 'dataset_details': items})
            t.transport = httpx.MockTransport(handle)
            provider = t.make(projection=metadata.PROJECTION)
            self.deps = replace(self.deps, data_context=provider)
            app = self.make(semantic_catalog=SemanticCatalog(provider, self.store))
            t.payload['dataset_details'].append({'dataset_id': 'missing', 'ret_code': 'failed'})
            partial = await app.discover('current-context', 'Tokens')
            self.assertEqual(partial['status'], 'partial')
            ref = partial['matches'][0]['detailRef']
            await app.discover('current-context', 'Tokens', detail_refs=[ref])
            request = fixtures.query_request(); request['dataContextVersion'] = partial['dataContextVersion']
            result = await app.query('current-context', request)
            self.assertEqual(result['status'], 'ready', result)
            self.assertIn('DATA_CONTEXT_PARTIAL', str(result))
            composed, _ = await app.mutate('compose', 'current-context', {'title': '报告',
                'sources': {'result': result['results'][0]['resultRef']}, 'sections': fixtures.plan()['sections']})
            self.assertEqual(composed['saveStatus'], 'saved', composed)
            self.assertEqual(len(t.calls), 2)
            self.assertEqual(json.loads(t.calls[1].content)['datasetIds'], ['missing'])
            t.payload['dataset_details'].pop()
            frozen = await app.discover('current-context', 'Tokens')
            self.assertEqual(frozen['dataContextVersion'], partial['dataContextVersion'])
            self.turns.binding['turnId'] = self.turns.scope['turnId'] = 'next-turn'
            refreshed = await app.discover('current-context', 'Tokens')
            self.assertEqual(refreshed['status'], 'ready')
            self.assertEqual(len(t.calls), 3)
            self.assertNotEqual(partial['dataContextVersion'], refreshed['dataContextVersion'])
        finally:
            t.doCleanups()

    async def test_incremental_metadata_recovery_never_refetches_success(self):
        import json
        import httpx
        import test_dataset_metadata_http as metadata
        t = metadata.DatasetMetadataHttpTest(); t.setUp()
        try:
            good = metadata.dataset()
            recovered = deepcopy(good)
            recovered.update(id='recovered', dataset_id='recovered')
            for metric in recovered['logical_schema']['field_schema']['metrics']:
                metric['model_id'] = 'recovered'
            def handle(request):
                t.calls.append(request)
                ids = json.loads(request.content).get('datasetIds')
                items = [recovered] if ids == ['recovered'] else [good, {'dataset_id': 'recovered', 'ret_code': 'failed'}]
                return httpx.Response(200, json={'retCode': 'CBC.0000', 'dataset_details': items})
            t.transport = httpx.MockTransport(handle)
            value = await t.make().search(metadata.BINDING, '', 5)
            self.assertTrue(value['coverage']['complete'])
            self.assertEqual(value['coverage']['recovery']['recoveredDatasets'], 1)
            self.assertEqual(len(value['models']), 2)
            self.assertEqual(len(t.calls), 2)
            self.assertEqual(json.loads(t.calls[-1].content)['datasetIds'], ['recovered'])
            self.assertEqual(value['models'][0], {k: v for k, v in good.items() if k not in {'dataset_id', 'ret_code', 'ret_desc'}})
        finally:
            t.doCleanups()

    async def test_metadata_recovery_transport_failure_keeps_success_but_auth_denial_stops(self):
        import httpx
        import test_dataset_metadata_http as metadata
        from metriccanvas_authoring.data.ports import DataContextError
        t = metadata.DatasetMetadataHttpTest(); t.setUp()
        try:
            for failure in (503, 403):
                calls = []
                def handle(request):
                    calls.append(request)
                    if len(calls) >= 2:
                        return httpx.Response(failure)
                    return httpx.Response(200, json={'retCode': 'CBC.0000', 'dataset_details': [
                        metadata.dataset(), {'dataset_id': 'missing', 'ret_code': 'failed'}]})
                t.transport = httpx.MockTransport(handle)
                if failure == 403:
                    with self.assertRaisesRegex(DataContextError, 'FORBIDDEN'):
                        await t.make().search(metadata.BINDING, '', 5)
                else:
                    value = await t.make().search(metadata.BINDING, '', 5)
                    self.assertEqual(len(value['models']), 1)
                    self.assertFalse(value['coverage']['complete'])
                self.assertEqual(len(calls), 2 if failure == 403 else 3)
        finally:
            t.doCleanups()

    async def test_failed_transient_result_can_resume_in_new_application(self):
        from metriccanvas_authoring.data.execution import DqeExecutionError
        from dataclasses import replace
        calls = []
        delegate = self.deps.dqe
        class Flaky:
            async def execute(inner, query):
                calls.append(query)
                if len(calls) <= 2:
                    raise DqeExecutionError('DQE_TIMEOUT', 'temporary')
                return await delegate.execute(query)
        self.deps = replace(self.deps, dqe=Flaky())
        first = await self.make().query('current-context', fixtures.query_request())
        self.assertEqual(first['status'], 'failed')
        restored = await self.make().query('current-context', fixtures.query_request())
        self.assertEqual(restored['status'], 'ready', restored)
        self.assertEqual(restored['results'][0]['attempt'], 2)
        self.assertEqual(len(calls), 3)
        await self.make().query('current-context', fixtures.query_request())
        self.assertEqual(len(calls), 3)

    async def test_expired_query_claim_can_be_taken_over(self):
        from metriccanvas_authoring.work.state import digest
        from metriccanvas_authoring.data.validation_policy import load_query_validation_policy
        import time
        request = fixtures.query_request(); item = request['requests'][0]
        prepared = await self.app.prepare('current-context')
        policy = load_query_validation_policy()
        signature = digest([self.app.state.key(prepared), request['dataContextVersion'], policy.identity,
                            {k: v for k, v in item.items() if k != 'dataSourceId'}])
        ref = 'result-' + signature
        await self.store.compare_and_swap('query', ref, 0, {'binding': dict(prepared.binding),
            'request': item, 'resultRef': ref, 'status': 'pending', 'attempt': 1, 'expiresAt': time.time() - 1})
        result = await self.make().query('current-context', request)
        self.assertEqual(result['status'], 'ready', result)
        self.assertEqual(result['results'][0]['attempt'], 2)
        self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_late_query_owner_returns_persisted_owner_not_its_local_rows(self):
        original = self.store.compare_and_swap
        async def raced(namespace, key, version, value):
            if namespace == 'query' and value.get('status') == 'ready':
                competitor = deepcopy(value)
                competitor['status'] = 'pending'
                competitor['attempt'] = 2
                self.assertTrue(await original(namespace, key, version, competitor))
                return False
            return await original(namespace, key, version, value)
        self.store.compare_and_swap = raced
        result = await self.app.query('current-context', fixtures.query_request())
        self.assertEqual(result['results'][0]['status'], 'pending')
        self.assertNotIn('rows', result['results'][0])

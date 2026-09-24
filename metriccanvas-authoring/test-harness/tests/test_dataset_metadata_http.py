"""Wire contract and platform discovery tests for Java's raw semantic metadata."""

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str((_Path(__file__).resolve().parent / '../../examples').resolve()))
import asyncio
from copy import deepcopy
from dataclasses import replace
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx
import yaml
from fastmcp import Client

from test_data_context_http import DATASET_DETAIL, PROJECTION
from test_platform_v2 import Identities, Authorization, query_request
from test_authoring_turns import Turns
from authoring_fixtures import dependencies
from adapter_template.firstparty.dataset_metadata_http import JavaDatasetMetadataProvider, QUERY_PATH
from adapter_template.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleIdentity
from adapter_template.environment import configure_data_context
from metriccanvas_authoring.bootstrap.platform import create_platform_server
from metriccanvas_authoring.data.ports import DataContextError
from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
from metriccanvas_authoring.work.content_ports import ContentBaselineError

ROOT = Path(__file__).resolve().parents[2]
BASE = 'https://java.test/rest/cdi/cdinl2databuilderservice/v1'
BINDING = {'actorId': 'alice', 'workspaceId': 'w', 'turnId': 'turn-1'}


def dataset():
    value = deepcopy(DATASET_DETAIL)
    value.update(workspace_id='w', dataset_id=value['id'], ret_code='CBC.0000')
    value['physical_schema'] = {'tables': [{'sql_text': 'PRIVATE SQL MUST NOT REACH MODEL'}]}
    metric = value['logical_schema']['field_schema']['metrics'][0]
    metric.update(id='metric-a', model_id=value['id'], workspace_id='w', is_agg=metric.pop('isAgg'))
    for dimension in value['logical_schema']['field_schema']['dimensions']:
        dimension['dimension_type'] = dimension.pop('dimensionType')
    return value


class DatasetMetadataHttpTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = SqlitePlatformState(Path(self.tmp.name) / 'state.db')
        self.payload = {'retCode': 'CBC.0000', 'dataset_details': [dataset()]}
        self.status = 200
        self.calls = []
        def handle(request):
            self.calls.append(request)
            return httpx.Response(self.status, json=self.payload)
        self.transport = httpx.MockTransport(handle)
        self.provider = self.make()
        self.catalog = SemanticCatalog(self.provider, self.store)

    def make(self, **kwargs):
        return JavaDatasetMetadataProvider(BASE, Identities(), transport=self.transport, **kwargs)

    async def test_batch_post_exact_yaml_parameters_and_safe_discovery(self):
        result = await self.catalog.discover(BINDING, '调用次数', 5, [])
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['matches'][0]['name'], 'Tokens请求量')
        self.assertNotIn('PRIVATE SQL', json.dumps(result))
        self.assertNotIn('physical_schema', json.dumps(result))
        self.assertNotIn('test-only', json.dumps(result))
        request = self.calls[0]
        self.assertEqual(request.method, 'POST')
        self.assertEqual(str(request.url), BASE + QUERY_PATH)
        self.assertEqual(json.loads(request.content), {'workspaceId': 'w'})
        self.assertEqual(request.headers['X-Auth-Token'], 'test-only')
        self.assertEqual(request.headers['x-operator-id'], 'alice')
        self.assertNotIn('X-Workspace-Id', request.headers)
        self.assertNotIn('apiGw-app-code', request.headers)

    async def test_dataset_scope_and_empty_list_match_yaml_all_semantics(self):
        for ids in (['operations-dataset'], []):
            result = await self.make(dataset_ids=ids).search(BINDING, 'Tokens', 1)
            self.assertEqual(len(result['models']), 1)
            self.assertEqual(json.loads(self.calls[-1].content)['datasetIds'], ids)
        for ids in (['x'] * 101, ['x', 'x'], [''], 'x'):
            with self.assertRaises(DataContextError): self.make(dataset_ids=ids)
        with self.assertRaisesRegex(DataContextError, 'SCOPE_MISMATCH'):
            await self.make(dataset_ids=['other']).search(BINDING, '', 1)

    async def test_partial_element_failures_are_visible_not_zero_matches(self):
        self.payload['dataset_details'].append({'dataset_id': 'unavailable', 'ret_code': 'LAB_DENIED',
                                                'ret_desc': 'private SQL or credentials'})
        result = await self.catalog.discover(BINDING, 'Tokens', 5, [])
        self.assertEqual(result['status'], 'partial')
        self.assertFalse(result['coverage']['complete'])
        self.assertEqual(len(result['matches']), 1)
        self.assertEqual(result['issues'][0]['datasetId'], 'unavailable')
        self.assertNotIn('private SQL', json.dumps(result))
        with self.assertRaisesRegex(DataContextError, 'DATA_CONTEXT_PARTIAL'):
            await self.make(projection=PROJECTION).current()
        self.payload['dataset_details'] = self.payload['dataset_details'][1:]
        failed = await self.catalog.discover(BINDING, '', 5, [])
        self.assertFalse(failed['ok'])
        self.assertEqual(failed['status'], 'failed')

    async def test_requested_omitted_dataset_reported_and_success_empty_distinguished(self):
        self.payload['dataset_details'] = []
        result = await self.catalog.discover(BINDING, '', 5, [])
        self.assertTrue(result['ok'])
        self.assertEqual(result['matches'], [])
        self.assertTrue(result['coverage']['complete'])
        missing = await self.make(dataset_ids=['operations-dataset']).search(BINDING, '', 5)
        self.assertEqual(missing['issues'][0]['code'], 'DATASET_METADATA_MISSING')

    async def test_envelope_identity_and_element_status_fail_closed(self):
        original = deepcopy(self.payload)
        variants = [
            {'retCode': 'failure', 'dataset_details': []},
            {'retCode': 'CBC.0000'},
            {'retCode': 'CBC.0000', 'dataset_details': [{**dataset(), 'id': 'wrong'}]},
            {'retCode': 'CBC.0000', 'dataset_details': [{**dataset(), 'workspace_id': 'other'}]},
            {'retCode': 'CBC.0000', 'dataset_details': [{k: v for k, v in dataset().items() if k != 'ret_code'}]},
            {'retCode': 'CBC.0000', 'dataset_details': [dataset(), dataset()]},
        ]
        for payload in variants:
            self.payload = payload
            with self.subTest(payload=payload), self.assertRaises(DataContextError):
                await self.provider.search(BINDING, '', 5)
        self.payload = original
        self.payload['dataset_details'][0]['logical_schema']['field_schema']['metrics'][0]['model_id'] = 'other'
        with self.assertRaisesRegex(DataContextError, 'SCOPE_MISMATCH'):
            await self.provider.search(BINDING, '', 5)

    async def test_http_failures_are_structured_and_no_redirect_or_retry(self):
        for status, code in [(401, 'AUTH_REQUIRED'), (403, 'FORBIDDEN'), (302, 'TRANSPORT_ERROR'), (500, 'TRANSPORT_ERROR')]:
            self.status = status
            with self.assertRaisesRegex(DataContextError, code):
                await self.provider.search(BINDING, '', 5)
        self.assertEqual(len(self.calls), 4)

    async def test_identity_mismatch_before_network_and_late_identity_change(self):
        with self.assertRaisesRegex(DataContextError, 'SCOPE_MISMATCH'):
            await self.provider.search({**BINDING, 'actorId': 'bob'}, '', 5)
        self.assertEqual(self.calls, [])
        class MutableIdentity:
            value = Identities().current()
            def current(self): return self.value
        identities = MutableIdentity()
        def switched(request):
            identities.value = LifecycleIdentity('bob', 'w', 'other-token')
            return httpx.Response(200, json=self.payload)
        provider = JavaDatasetMetadataProvider(BASE, identities, transport=httpx.MockTransport(switched))
        with self.assertRaisesRegex(DataContextError, 'SCOPE_MISMATCH'):
            await provider.search(BINDING, '', 5)

    async def test_timeout_and_cancellation_do_not_trigger_refresh(self):
        async def timeout(request): raise httpx.ReadTimeout('private host detail')
        provider = JavaDatasetMetadataProvider(BASE, Identities(), transport=httpx.MockTransport(timeout))
        with self.assertRaises(DataContextError) as caught:
            await provider.search(BINDING, '', 5)
        self.assertEqual(caught.exception.code, 'DATA_CONTEXT_TIMEOUT')
        entered = asyncio.Event()
        async def wait(request):
            entered.set()
            await asyncio.Event().wait()
        provider = JavaDatasetMetadataProvider(BASE, Identities(), transport=httpx.MockTransport(wait))
        task = asyncio.create_task(provider.search(BINDING, '', 5))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task

    async def test_detail_uses_exact_dataset_metric_and_rejects_changed_model(self):
        result = await self.catalog.discover(BINDING, 'Tokens', 5, [])
        ref = result['matches'][0]['detailRef']
        detailed = await self.catalog.discover(BINDING, 'Tokens', 5, [ref])
        self.assertEqual(detailed['details'][0]['values']['unit'], '次')
        self.assertEqual(json.loads(self.calls[-1].content)['datasetIds'], ['operations-dataset'])
        source = result['matches'][0]['source']
        self.payload['dataset_details'][0]['logical_schema']['field_schema']['metrics'][0]['unit'] = 'changed'
        with self.assertRaisesRegex(DataContextError, 'METRIC_DETAIL_STALE'):
            await self.provider.detail(BINDING, source)
        with self.assertRaisesRegex(ContentBaselineError, 'METRIC_DETAIL_IDENTITY_REQUIRED'):
            await self.catalog.discover(BINDING, 'Tokens', 5, [ref])

    async def test_unknown_fields_and_raw_objects_do_not_become_semantic_facts(self):
        metric = self.payload['dataset_details'][0]['logical_schema']['field_schema']['metrics'][0]
        metric.update(unit=None, frequency='', definition=metric['name'], dimensions=[],
                      synonyms=[{'sql': 'private'}], description={'metricCode': {'sql': 'private'}})
        result = await self.catalog.discover(BINDING, 'Tokens', 5, [])
        card = result['matches'][0]
        for field in ('unit', 'frequency', 'definition', 'dimensions'):
            self.assertEqual(card[field]['status'], 'unknown')
        detailed = await self.catalog.discover(BINDING, 'Tokens', 5, [card['detailRef']])
        self.assertEqual(detailed['details'][0]['status'], 'unknown')
        self.assertNotIn('private', json.dumps(result))

    async def test_discovery_query_share_version_and_no_projection_still_allows_discovery(self):
        with self.assertRaisesRegex(DataContextError, 'Projection is not injected') as missing:
            await self.provider.current()
        self.assertEqual(missing.exception.code, 'DATA_CONTEXT_GOVERNANCE_REQUIRED')
        self.assertEqual(missing.exception.diagnostics['stage'], 'projection_configuration')
        self.assertEqual(self.calls, [])
        projected = self.make(projection=PROJECTION)
        found = await projected.search(BINDING, 'Tokens', 5)
        snapshot = await projected.current()
        self.assertEqual(found['dataContextVersion'], snapshot['version'])
        schemas = snapshot['executionEnvironments'][0]['schemas']
        self.assertEqual(schemas[0]['metrics'][0]['additivity'], '可加')
        self.assertEqual(schemas[0]['objects'][0]['fields'][1]['type'], 'date')
        self.payload['dataset_details'][0]['version'] = 'new-metadata-version'
        self.assertNotEqual((await projected.current())['version'], snapshot['version'])

    async def test_factory_projection_helper_and_diagnostic_command(self):
        import importlib.util
        from dataclasses import asdict
        from adapter_template.firstparty.configuration import create_metadata_provider
        spec = importlib.util.spec_from_file_location('check_data_context', ROOT/'scripts/check_data_context.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        missing = await module.inspect_provider(self.provider)
        self.assertEqual(missing['stage'], 'projection_configuration')
        config = Path(self.tmp.name)/'projection.json'
        config.write_text(json.dumps({'environment': PROJECTION.environment, 'defaults': PROJECTION.defaults,
            'metricGovernance': PROJECTION.metric_governance}))
        provider = create_metadata_provider(BASE, Identities(), projection_path=str(config),
                                             dataset_ids=['operations-dataset'])
        provider.transport = self.transport
        self.assertEqual(asdict(provider.projection), asdict(PROJECTION))
        report = await module.inspect_provider(provider)
        self.assertEqual(report['status'], 'ready')
        self.assertEqual(report['dqe'], 'not_checked')
        found = await provider.search(BINDING, '', 5)
        self.assertEqual(found['dataContextVersion'], report['dataContextVersion'])
        self.assertNotIn('PRIVATE', json.dumps(report))
        self.assertNotIn('test-only', json.dumps(report))
        poisoned = DataContextError('DATA_CONTEXT_GOVERNANCE_REQUIRED', 'token-secret', diagnostics={
            'stage': 'field_governance', 'issues': [{'property': 'isRatio', 'rawResponse': 'secret'}]})
        self.assertNotIn('secret', json.dumps(module.diagnostic_report(poisoned)))
        updated = json.loads(config.read_text()); updated['metricGovernance']['operations-dataset']['Tokens请求量']['isRatio'] = True
        config.write_text(json.dumps(updated))
        changed = create_metadata_provider(BASE, Identities(), projection_path=str(config),
                                            dataset_ids=['operations-dataset'])
        changed.transport = self.transport
        self.assertNotEqual((await changed.search(BINDING, '', 5))['dataContextVersion'], report['dataContextVersion'])
        with self.assertRaises(DataContextError):
            create_metadata_provider(BASE, Identities(), projection_path='', dataset_ids=['operations-dataset'])
        config.write_text('{invalid secret content')
        with self.assertRaises(DataContextError) as invalid:
            create_metadata_provider(BASE, Identities(), projection_path=str(config))
        config_report = module.diagnostic_report(invalid.exception)
        self.assertEqual(config_report['stage'], 'projection_configuration')
        self.assertEqual(config_report['issues'][0]['reason'], 'unreadable_or_invalid')
        self.assertNotIn('secret', json.dumps(config_report))

    async def test_platform_factory_wires_java_discovery_then_query_with_same_version(self):
        provider = self.make(projection=PROJECTION)
        deps = replace(dependencies(), data_context=provider)
        server = create_platform_server(deps, current_turns=Turns('new'), store=self.store,
                                        analysis_authorization=Authorization())
        async with Client(server) as client:
            found = (await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': 'Tokens'})).structured_content
            self.assertTrue(found['ok'], found)
            version = found['modelSummary']['dataContextVersion']
            request = query_request(); request['dataContextVersion'] = version
            result = (await client.call_tool('query_data', {'context_ref': 'current-context', 'request': request})).structured_content
            self.assertEqual(result['modelSummary']['results'][0]['status'], 'ready', result)
            self.assertEqual(result['modelSummary']['dataContextVersion'], version)
            self.status = 401
            error = (await client.call_tool('discover_data_context', {'context_ref': 'current-context'})).structured_content
            self.assertEqual(error['modelSummary']['issues'][0]['code'], 'DATA_CONTEXT_AUTH_REQUIRED')
        self.assertEqual(len(deps.dqe.calls), 1)
        self.assertTrue(all(str(request.url) == BASE + QUERY_PATH for request in self.calls))

    def test_yaml_is_packaged_and_wire_contract_matches_provider(self):
        path = ROOT / 'contract-snapshot/data-context/rest-services-dataset-detail.yaml'
        spec = yaml.safe_load(path.read_text())
        endpoint = '/rest/cdi/cdinl2databuilderservice/v1' + QUERY_PATH
        operation = spec['paths'][endpoint]['post']
        self.assertEqual(operation['operationId'], 'queryLabDatasetDetail')
        self.assertEqual(spec['definitions']['LabDatasetDetailReq']['properties']['datasetIds']['maxItems'], 100)
        source = ROOT.parent / 'service/dataset-detail-java.yaml'
        if source.exists(): self.assertEqual(path.read_bytes(), source.read_bytes())

    def test_environment_selects_java_without_lab_urls_or_app_code(self):
        with patch.dict(os.environ, {'METRICCANVAS_DATASET_DETAIL_BASE_URL': BASE,
                                     'METRICCANVAS_DATASET_IDS': '["operations-dataset"]'}, clear=True):
            provider = configure_data_context(identities=Identities())
        self.assertIsInstance(provider, JavaDatasetMetadataProvider)
        self.assertIsNone(provider.projection)
        self.assertEqual(provider.dataset_ids, ['operations-dataset'])

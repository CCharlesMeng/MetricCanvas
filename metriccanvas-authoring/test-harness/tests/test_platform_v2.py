"""Target public behavior and restart tests, independent of legacy candidates."""
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
from fastmcp import Client
from jsonschema import Draft202012Validator
from test_authoring_turns import Turns
from authoring_fixtures import dependencies
from authoring_fixtures import plan
from test_page_editing import title
from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleCapabilities, LifecycleIdentity
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.work.state import Limits, digest
from metriccanvas_authoring.bootstrap.readiness import platform_readiness, current_turn_readiness
from metriccanvas_authoring.bootstrap.environment import unconfigured_data_context, unconfigured_dqe
from metriccanvas_authoring.bootstrap.platform import create_production_platform_server, DeploymentReadinessError


class Authorization:
    confirmed = True
    allowed = True
    async def authorize(self, binding, request, version):
        return {'binding': binding, 'requestSha256': digest(request), 'dataContextVersion': version,
                'planConfirmed': self.confirmed, 'modelEvidenceAllowed': self.allowed}


class Identities:
    def current(self): return LifecycleIdentity('alice', 'w', 'test-only')


class Service:
    capabilities = LifecycleCapabilities(single_save=True, current_read=True)
    def __init__(self):
        self.calls = []; self.status = 'saved'; self.reads = []
        initial = Turns().baseline
        self.remote = {'ref': deepcopy(initial.ref), 'document': deepcopy(initial.document)}

    async def current_match(self, identity, ref):
        from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError
        self.reads.append(deepcopy(ref))
        if self.remote['ref'] != ref:
            raise LifecycleError('CURRENT_PAGE_STALE')
        return deepcopy(self.remote)
    async def save(self, identity, command):
        self.calls.append(deepcopy(command))
        if self.status == 'timeout': raise TimeoutError()
        if self.status != 'saved': return {'operationId': command['context']['operationId'], 'status': self.status, 'code': 'REVISION_CONFLICT'}
        result = {'status': 'saved', 'operationId': command['context']['operationId'], 'document': deepcopy(command['document']),
                'base': deepcopy(command['base']), 'assurance': 'provider-response', 'isDraft': True, 'revisionNumber': len(self.calls),
                'ref': {'pageId': command['pageId'], 'resourceId': command['base']['resourceId'] if command['base'] else 'draft-1', 'revisionId': 'saved-' + str(len(self.calls))}}
        self.remote = {'ref': deepcopy(result['ref']), 'document': deepcopy(result['document'])}
        return result


class Preview:
    def __init__(self): self.calls = []; self.fail = False
    async def prepare(self, artifact):
        self.calls.append(deepcopy(artifact))
        if self.fail: raise RuntimeError('private provider failure')
        return {'status': 'ready', 'artifactRef': artifact['artifactRef'], 'ref': artifact['ref']}


def text_request():
    return {'title': '说明', 'sources': {}, 'sections': [{'id': 'main', 'title': '说明', 'pattern': 'custom',
        'blocks': [{'id': 'note', 'type': 'text', 'body': '已知说明'}]}]}


def query_request():
    value = plan()
    return {'question': value['question'], 'dataContextVersion': value['dataContextVersion'], 'requests': value['dataRequests']}


class PlatformV2Test(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = SqlitePlatformState(Path(self.tmp.name) / 'state.db')
        self.turns = Turns('new'); self.deps = dependencies(); self.auth = Authorization()
        self.service, self.preview = Service(), Preview()
        self.app = self.make()

    def make(self, **kwargs):
        return PlatformAuthoring(self.deps, self.turns, self.store, analysis_authorization=self.auth,
            lifecycle_service=self.service, lifecycle_identities=Identities(), relay_preview=self.preview, **kwargs)

    async def build_data(self):
        queried = await self.app.query('current-context', query_request())
        ref = queried['results'][0]['resultRef']
        request = {'title': '报告', 'sources': {'result': ref}, 'sections': plan()['sections']}
        return await self.app.mutate('compose', 'current-context', request)

    async def test_static_readiness_distinguishes_provider_and_live_turn(self):
        report = platform_readiness(self.deps, current_turns=self.turns, store=self.store,
            analysis_authorization=self.auth, lifecycle_service=self.service,
            lifecycle_identities=Identities(), relay_preview=self.preview)
        self.assertTrue(report['deploymentReady'])
        self.assertEqual(report['currentTurn']['status'], 'not_checked')
        self.assertEqual(report['parameterCapability'], 'optional_unconfigured')
        self.assertEqual((await current_turn_readiness(report, self.turns, 'current-context'))['currentTurn']['status'], 'valid')
        self.assertEqual((await current_turn_readiness(report, self.turns, 'wrong-context'))['currentTurn']['status'], 'invalid')

    async def test_readiness_reports_all_missing_operations_without_running_them(self):
        deps = replace(self.deps, data_context=unconfigured_data_context('not configured'),
                       dqe=unconfigured_dqe('not configured'))
        report = platform_readiness(deps)
        self.assertFalse(report['deploymentReady'])
        self.assertEqual(set(report['providersAssembled']), {entry['provider'] for entry in report['missing']})
        self.assertFalse(report['operations']['data_query']['available'])
        self.assertEqual(report['connectivity'], 'not_checked')
        self.assertEqual(self.deps.dqe.calls, [])

    async def test_stock_entry_requires_explicit_discovery_or_host_assembly(self):
        with self.assertRaises(DeploymentReadinessError) as caught:
            create_production_platform_server()
        self.assertIn('current_turns', {item['provider'] for item in caught.exception.report['missing']})
        self.assertIsNotNone(create_production_platform_server(protocol_discovery=True))

    async def test_sqlite_record_is_visible_to_another_process_and_cas_conflicts(self):
        self.assertTrue(await self.store.compare_and_swap('work', 'shared', 0, {'value': 1}))
        code = (
            'import asyncio, json, sys; '
            'from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState; '
            's=SqlitePlatformState(sys.argv[1]); '
            'v,x=asyncio.run(s.read("work","shared")); '
            'print(json.dumps([v,x,asyncio.run(s.compare_and_swap("work","shared",v,{"value":2}))]))'
        )
        env = dict(os.environ, PYTHONPATH=str(Path(__file__).resolve().parents[2] / 'tool'))
        child = subprocess.run([sys.executable, '-c', code, self.store.path],
                               capture_output=True, text=True, env=env, check=True)
        self.assertEqual(json.loads(child.stdout), [1, {'value': 1}, True])
        self.assertFalse(await self.store.compare_and_swap('work', 'shared', 1, {'value': 3}))
        self.assertEqual(await self.store.read('work', 'shared'), (2, {'value': 2}))

    async def test_registered_tools_schemas_and_public_text_save_preview(self):
        async with Client(create_platform_mcp_server(self.app)) as client:
            tools = await client.list_tools()
            self.assertEqual({t.name for t in tools}, {'read_page_context','discover_data_context','query_data','compose_page','edit_page','page_metadata_emit_preview','extract_page_parameters','apply_page_parameter_selection','resolve_page_parameters'})
            for tool in tools: Draft202012Validator.check_schema(tool.inputSchema)
            response = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'request': text_request()})).structured_content
            self.assertTrue(response['ok'], response)
            summary = response['modelSummary']
            self.assertEqual(summary['saveStatus'], 'saved')
            self.assertNotIn('document', json.dumps(summary))
            ready = (await client.call_tool('page_metadata_emit_preview', {'context_ref': 'current-context', 'artifact_ref': summary['artifactRef']})).structured_content
            self.assertEqual(ready['modelSummary']['status'], 'ready')
        self.assertEqual(len(self.service.calls), 1)
        self.assertEqual(self.deps.dqe.calls, [])

    async def test_query_then_compose_reuses_result_and_strips_initial_from_save(self):
        summary, value = await self.build_data()
        self.assertEqual(summary['saveStatus'], 'saved', summary)
        self.assertEqual(len(self.deps.dqe.calls), 1)
        self.assertNotIn('initial', self.service.calls[0]['document']['dataSources']['result']['source'])
        self.assertIn('initial', value['previewJson']['dataSources']['result']['source'])
        self.assertEqual(value['document'], self.service.calls[0]['document'])

    async def test_query_without_extra_field_provider_uses_stable_ids_and_validates_rows(self):
        self.deps = replace(self.deps, source_description=None)
        self.app = self.make()
        summary, value = await self.build_data()
        self.assertEqual(summary['saveStatus'], 'saved')
        fields = value['document']['dataSources']['result']['fields']
        self.assertEqual(len(fields), 2)
        self.assertTrue(all(key.startswith('result-field-identity-') for key in fields))
        self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_non_http_adapter_checks_every_returned_row(self):
        from metriccanvas_authoring.data.execution import DqeExecutionResult
        self.deps = replace(self.deps, source_description=None)
        self.app = self.make()
        async def bad(query):
            return DqeExecutionResult(rows=[{'区域': '华东', 'Tokens请求量': 18}] * 20 +
                                      [{'区域': '华南', 'Tokens请求量': None}])
        self.deps.dqe.execute = bad
        result = await self.app.query('current-context', query_request())
        self.assertEqual(result['results'][0]['status'], 'failed')
        self.assertEqual(result['results'][0]['issues'][0]['code'], 'SOURCE_ROW_TYPE_MISMATCH')

    async def test_plan_and_evidence_authorization_fail_before_query(self):
        for field, code in [('confirmed', 'ANALYSIS_PLAN_NOT_CONFIRMED'), ('allowed', 'MODEL_EVIDENCE_UNAVAILABLE')]:
            setattr(self.auth, field, False)
            with self.assertRaisesRegex(ContentBaselineError, code): await self.app.query('current-context', query_request())
            setattr(self.auth, field, True)
        self.assertEqual(self.deps.dqe.calls, [])

    async def test_confirmation_must_echo_exact_binding_request_and_version(self):
        original = self.auth.authorize
        for mismatch in ('binding', 'requestSha256', 'dataContextVersion'):
            async def wrong(binding, request, version, field=mismatch):
                grant = await original(binding, request, version)
                grant[field] = 'other'
                return grant
            self.auth.authorize = wrong
            with self.subTest(field=mismatch), self.assertRaisesRegex(ContentBaselineError, 'ANALYSIS_PLAN_NOT_CONFIRMED'):
                await self.app.query('current-context', query_request())
        self.assertEqual(self.deps.dqe.calls, [])

    async def test_same_query_reuses_success_and_failure_without_dqe_retry(self):
        result = await self.app.query('current-context', query_request())
        again = await self.app.query('current-context', query_request())
        self.assertEqual(result, again); self.assertEqual(len(self.deps.dqe.calls), 1)

    async def test_cross_turn_reference_rejected(self):
        result = await self.app.query('current-context', query_request())
        self.turns.binding['turnId'] = 'next-turn'; self.turns.scope['turnId'] = 'next-turn'
        with self.assertRaisesRegex(ContentBaselineError, 'RESULT_SCOPE_MISMATCH'):
            await self.app.query('current-context', result_ref=result['results'][0]['resultRef'])

    async def test_repeated_save_restart_and_preview_failure_never_resave(self):
        summary, _ = await self.app.mutate('compose', 'current-context', text_request())
        restarted = self.make()
        replay, _ = await restarted.mutate('compose', 'current-context', text_request())
        self.assertEqual(summary, replay)
        self.preview.fail = True
        with self.assertRaises(RuntimeError): await restarted.preview('current-context', summary['artifactRef'])
        self.preview.fail = False
        await restarted.preview('current-context', summary['artifactRef'])
        self.assertEqual(len(self.service.calls), 1)

    async def test_unknown_save_blocks_all_resends_including_changed_request(self):
        self.service.status = 'timeout'
        summary, _ = await self.app.mutate('compose', 'current-context', text_request())
        self.assertEqual(summary['saveStatus'], 'unknown')
        replay, _ = await self.make().mutate('compose', 'current-context', text_request())
        self.assertEqual(replay['saveStatus'], 'unknown')
        different = text_request(); different['title'] = '另一标题'
        with self.assertRaisesRegex(ContentBaselineError, 'SAVE_RECONCILIATION_REQUIRED'):
            await self.make().mutate('compose', 'current-context', different, 1)
        self.assertEqual(len(self.service.calls), 1)

    async def test_partial_edit_saves_success_and_unchanged_does_not_save(self):
        self.turns = Turns(); self.app = self.make(limits=Limits(mutations=4))
        request = {'operations': [title('bad', component='absent'), title('good')]}
        summary, _ = await self.app.mutate('edit', 'current-context', request)
        self.assertEqual(summary['status'], 'partial'); self.assertEqual(summary['saveStatus'], 'saved')
        again, _ = await self.app.mutate('edit', 'current-context', {'operations': [title('again')]}, 1)
        self.assertEqual(again['status'], 'unchanged'); self.assertEqual(again['saveStatus'], 'not_requested')
        self.assertEqual(len(self.service.calls), 1); self.assertEqual(self.deps.dqe.calls, [])

    async def test_work_version_competition_is_rejected(self):
        await self.app.mutate('compose', 'current-context', text_request())
        with self.assertRaisesRegex(ContentBaselineError, 'WORK_VERSION_CONFLICT'):
            await self.app.mutate('edit', 'current-context', {'operations': [title('x')]}, 0)
        self.assertEqual(len(self.service.calls), 1)

    async def test_preview_cannot_fall_back_to_latest_artifact(self):
        await self.app.mutate('compose', 'current-context', text_request())
        with self.assertRaisesRegex(ContentBaselineError, 'PREVIEW_ARTIFACT_MISMATCH'):
            await self.app.preview('current-context', 'artifact-old')
        self.assertEqual(self.preview.calls, [])

    async def test_cancelled_query_cannot_expose_result(self):
        execute = self.deps.dqe.execute
        async def late(query):
            result = await execute(query); self.turns.binding['status'] = 'cancelled'; return result
        self.deps.dqe.execute = late
        with self.assertRaises(ContentBaselineError): await self.app.query('current-context', query_request())
        self.assertEqual(self.service.calls, [])

    async def test_budget_is_persistent_across_application_restart(self):
        self.app = self.make(limits=Limits(calls=1))
        await self.app.read('current-context')
        with self.assertRaisesRegex(ContentBaselineError, 'AUTHORING_BUDGET_EXHAUSTED'):
            await self.make(limits=Limits(calls=1)).read('current-context')

    async def test_bounded_evidence_keeps_truncation_and_does_not_leak_query(self):
        from metriccanvas_authoring.data.execution import DqeExecutionResult
        async def many(query):
            return DqeExecutionResult(rows=[{'区域': '区域' + str(i), 'Tokens请求量': i} for i in range(40)], total_count=100, captured_at='2026-09-20T00:00:00Z')
        self.deps.dqe.execute = many
        result = await self.app.query('current-context', query_request())
        evidence = result['results'][0]
        self.assertEqual(len(evidence['rows']), 20)
        self.assertTrue(evidence['coverage']['truncated']); self.assertFalse(evidence['coverage']['complete'])
        self.assertEqual(evidence['coverage']['totalCount'], 100)
        self.assertNotIn('dsl_list', json.dumps(result)); self.assertNotIn('queryField', json.dumps(result))

    async def test_failure_empty_and_zero_are_distinct_and_failure_is_not_retried(self):
        from metriccanvas_authoring.data.execution import DqeExecutionResult, DqeExecutionError
        async def fail(query):
            self.deps.dqe.calls.append(query)
            raise DqeExecutionError('DQE_QUERY_REJECTED', 'not for model')
        self.deps.dqe.execute = fail
        first = await self.app.query('current-context', query_request())
        self.assertEqual(first['results'][0]['status'], 'failed')
        await self.app.query('current-context', query_request())
        self.assertEqual(len(self.deps.dqe.calls), 1)
        # A new trusted turn may legitimately execute a different request.
        self.turns.binding['turnId'] = 'empty'; self.turns.scope['turnId'] = 'empty'
        async def empty(query): return DqeExecutionResult(rows=[], total_count=0, captured_at='2026-09-20T00:00:00Z')
        self.deps.dqe.execute = empty
        result = await self.app.query('current-context', query_request())
        self.assertEqual(result['results'][0]['status'], 'empty')
        self.turns.binding['turnId'] = 'zero'; self.turns.scope['turnId'] = 'zero'
        async def zero(query): return DqeExecutionResult(rows=[{'区域': 'A', 'Tokens请求量': 0}], total_count=1, captured_at='2026-09-20T00:00:00Z')
        self.deps.dqe.execute = zero
        result = await self.app.query('current-context', query_request())
        self.assertEqual(result['results'][0]['status'], 'ready')
        self.assertIn(0, result['results'][0]['rows'][0].values())

    async def test_existing_page_adds_from_result_without_requery_and_keeps_manual_content(self):
        self.turns = Turns(); self.app = self.make()
        before = deepcopy(self.turns.baseline.document)
        result = await self.app.query('current-context', query_request())
        ref = result['results'][0]['resultRef']
        block = plan()['sections'][0]['blocks'][0]
        block['id'] = 'new-chart'
        summary, value = await self.app.mutate('edit', 'current-context', {'operations': [
            {'id': 'add', 'type': 'add_result_component', 'sectionId': 'main', 'resultRef': ref, 'block': block}]})
        self.assertEqual(summary['saveStatus'], 'saved')
        self.assertEqual(len(self.deps.dqe.calls), 1)
        self.assertEqual(value['document']['sections'][0]['components'][:len(before['sections'][0]['components'])], before['sections'][0]['components'])
        self.assertEqual(value['document']['dataSources']['sales'], before['dataSources']['sales'])

    async def test_concurrent_mutations_and_frozen_send(self):
        entered, release = asyncio.Event(), asyncio.Event()
        save = self.service.save
        async def delayed(identity, command):
            entered.set(); await release.wait(); return await save(identity, command)
        self.service.save = delayed
        request = text_request()
        task = asyncio.create_task(self.app.mutate('compose', 'current-context', request))
        await entered.wait()
        request['title'] = 'mutated caller input'
        with self.assertRaisesRegex(ContentBaselineError, 'WORK_BUSY'):
            await self.make().mutate('compose', 'current-context', text_request())
        release.set(); summary, value = await task
        self.assertEqual(summary['saveStatus'], 'saved')
        self.assertEqual(value['document']['sections'][0]['components'][0]['props']['title'], '说明')
        self.assertEqual(len(self.service.calls), 1)

    async def test_recovery_uses_frozen_submission_not_candidates(self):
        original = self.app.state.finish
        async def fail(*args, **kwargs): raise OSError('simulated crash after receipt')
        self.app.state.finish = fail
        with self.assertRaises(OSError): await self.app.mutate('compose', 'current-context', text_request())
        recovered = await self.make().recover('current-context')
        self.assertEqual(recovered['saveStatus'], 'saved')
        self.assertEqual(len(self.service.calls), 1)
        replay, _ = await self.make().mutate('compose', 'current-context', text_request())
        self.assertEqual(replay['saveStatus'], 'saved'); self.assertEqual(len(self.service.calls), 1)

    async def test_saved_base_is_used_for_next_edit_and_old_preview_is_rejected(self):
        self.turns = Turns(); self.app = self.make()
        first, _ = await self.app.mutate('edit', 'current-context', {'operations':[title(value='first')]})
        second, _ = await self.app.mutate('edit', 'current-context', {'operations':[title(value='second')]}, 1)
        self.assertEqual(self.service.calls[1]['base'], first['ref'])
        self.assertNotEqual(second['ref'], first['ref'])
        with self.assertRaisesRegex(ContentBaselineError, 'PREVIEW_ARTIFACT_MISMATCH'):
            await self.app.preview('current-context', first['artifactRef'])

    async def test_default_lone_chart_fills_row_but_explicit_width_is_preserved(self):
        from metriccanvas_authoring.pages.referenced import pack_default_widths
        for explicit, expected in [(False, 12), (True, 6)]:
            components = [{'id': 'chart', 'layout': {'span': 6}}, {'id': 'table', 'layout': {'span': 12}}]
            blocks = [{'id': 'chart', **({'width': 'half'} if explicit else {})}, {'id': 'table'}]
            pack_default_widths(components, blocks)
            self.assertEqual(components[0]['layout']['span'], expected)
            self.assertEqual(components[1]['layout']['span'], 12)

    async def test_old_cancelled_submission_requires_fresh_recovery_authority(self):
        summary, _ = await self.app.mutate('compose', 'current-context', text_request())
        original_binding = deepcopy(self.turns.binding)
        self.turns.binding['status'] = 'cancelled'
        with self.assertRaisesRegex(ContentBaselineError, 'RECOVERY_AUTHORITY_UNAVAILABLE'):
            await self.app.saver.recover_authorized(original_binding, summary['operationId'], None)
        class Authority:
            calls = 0
            async def authorize(self, binding, command):
                self.calls += 1
                assert binding == original_binding
                assert command['context']['operationId'] == summary['operationId']
        authority = Authority()
        result = await self.app.saver.recover_authorized(original_binding, summary['operationId'], authority)
        self.assertEqual(result['status'], 'saved'); self.assertNotIn('document', result)
        self.assertEqual(authority.calls, 1); self.assertEqual(len(self.service.calls), 1)

    async def test_data_context_change_invalidates_result_before_composition(self):
        result = await self.app.query('current-context', query_request())
        current = self.deps.data_context.current
        async def changed():
            snapshot = deepcopy(await current()); snapshot['version'] = 'changed'; return snapshot
        self.deps.data_context.current = changed
        with self.assertRaisesRegex(ContentBaselineError, 'RESULT_VERSION_STALE'):
            await self.app.query('current-context', result_ref=result['results'][0]['resultRef'])
        self.assertEqual(self.service.calls, [])

    async def test_auxiliary_failure_can_save_a_valid_partial_page(self):
        result = await self.app.query('current-context', query_request())
        request = query_request(); request['requests'][0]['dataSourceId'] = 'other'; request['requests'][0]['filters'] = [{'dimension':'区域','values':['unknown']}]
        # Use a separately scoped failed query with a legitimate request shape.
        from metriccanvas_authoring.data.execution import DqeExecutionError
        async def rejected(query): raise DqeExecutionError('DQE_QUERY_REJECTED', 'rejected')
        self.deps.dqe.execute = rejected
        failed = await self.app.query('current-context', request)
        sources = {'result':result['results'][0]['resultRef'], 'other':failed['results'][0]['resultRef']}
        sections = plan()['sections']; sections[0]['blocks'][1]['source'] = 'other'
        summary, value = await self.app.mutate('compose','current-context',{'title':'Partial report','sources':sources,'sections':sections})
        self.assertEqual(summary['status'],'partial');self.assertEqual(summary['saveStatus'],'saved')
        self.assertIn('未生成', json.dumps(value['document'],ensure_ascii=False))


class CurrentJavaBaselineTest(unittest.IsolatedAsyncioTestCase):
    setUp = PlatformV2Test.setUp
    make = PlatformV2Test.make
    async def test_public_edit_requires_page_id_and_rejects_wrong_page_before_save(self):
        self.turns = Turns(); self.app = self.make()
        async with Client(create_platform_mcp_server(self.app)) as client:
            tools = {t.name: t for t in await client.list_tools()}
            self.assertIn('page_id', tools['edit_page'].inputSchema['required'])
            result = (await client.call_tool('edit_page', {
                'context_ref': 'current-context', 'page_id': 'wrong-page', 'expected_version': 0,
                'request': {'operations': [title()]}})).structured_content
        self.assertEqual(result['modelSummary']['issues'][0]['code'], 'CURRENT_TURN_PAGE_MISMATCH')
        self.assertEqual(self.service.calls, [])
        async with Client(create_platform_mcp_server(self.app)) as client:
            result = (await client.call_tool('edit_page', {
                'context_ref': 'current-context', 'page_id': self.turns.binding['pageId'],
                'expected_version': 0, 'request': {'operations': [title()]}})).structured_content
        self.assertEqual(result['modelSummary']['saveStatus'], 'saved')
        self.assertEqual(len(self.service.reads), 1)
        self.assertEqual(len(self.service.calls), 1)

    async def test_java_revision_changed_after_read_prevents_edit(self):
        self.turns = Turns(); self.app = self.make()
        await self.app.read('current-context')
        self.service.remote['ref']['revisionId'] = 'someone-elses-revision'
        with self.assertRaisesRegex(ContentBaselineError, 'CURRENT_PAGE_STALE'):
            await self.app.mutate('edit', 'current-context', {'operations': [title()]})
        self.assertEqual(len(self.service.reads), 2)
        self.assertEqual(self.service.calls, [])

    async def test_same_revision_different_java_content_rejected(self):
        self.turns = Turns(); self.app = self.make()
        self.service.remote['document']['meta'] = {'title': 'remote modification'}
        with self.assertRaisesRegex(ContentBaselineError, 'CURRENT_PAGE_STALE'):
            await self.app.read('current-context')
        self.assertEqual(self.service.calls, [])

    async def test_missing_current_read_capability_fails_closed(self):
        self.turns = Turns(); self.app = self.make()
        self.service.capabilities = LifecycleCapabilities(single_save=True)
        with self.assertRaisesRegex(ContentBaselineError, 'CURRENT_PAGE_UNAVAILABLE'):
            await self.app.mutate('edit', 'current-context', {'operations': [title()]})
        self.assertEqual(self.service.calls, [])

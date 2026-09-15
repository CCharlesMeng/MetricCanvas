"""Synthetic assembly evidence, not internal provider migration evidence."""
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
import json
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from fastmcp import Client
from adapters.fakes import FakeDataContextPort
from test_unified_content_mcp import dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from metriccanvas_authoring.application.authoring_deployment import (
    RegisteredExtension, DeploymentError, assemble_deployment, AUTHOR, SKILL_PATH, SERVICE,
)
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.authoring_bootstrap import create_deployment_content_server


class DeploymentTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.base = dependencies()
        self.reg = RegisteredExtension('synthetic-data', '1', 'data', 'fixture-a', 'a'*64, '1.0',
                                       {'data_context': self.base.data_context})
        self.registry = {'fixture-a': self.reg}
        self.manifest = {'formatVersion': '1.0', 'registrationName': 'define-report', 'bundleVersion': 'test',
                         'skillSourceSha256': 'b'*64, 'contractsSourceSha256': 'c'*64,
                         'extensions': [{'id': self.reg.id, 'version': '1', 'kind': 'data', 'implementation': 'fixture-a',
                                         'implementationSourceSha256': 'a'*64, 'contractVersion': '1.0', 'priority': 10}]}

    def assemble(self, manifest=None, registry=None):
        return assemble_deployment(self.manifest if manifest is None else manifest,
            self.registry if registry is None else registry, self.base, bundle_version='test',
            skill_source_sha256='b'*64, contracts_source_sha256='c'*64, contract_version='1.0')

    def test_single_author_and_immutable_selection(self):
        deployed = self.assemble()
        self.assertEqual((deployed.canonical_author, deployed.skill_path, deployed.service), (AUTHOR, SKILL_PATH, SERVICE))
        self.assertIs(deployed.dependencies.data_context, self.reg.ports['data_context'])
        self.manifest['extensions'][0]['version'] = 'changed'
        self.assertEqual(deployed.extensions[0]['version'], '1')
        with self.assertRaises(TypeError): deployed.extensions[0]['version'] = 'changed'
        with self.assertRaises(TypeError): self.reg.ports['dqe'] = self.base.dqe
        ordinary = deepcopy(self.manifest); ordinary['extensions'] = []; ordinary['registrationName'] = AUTHOR
        self.assertEqual(self.assemble(ordinary).skill_path, deployed.skill_path)

    def test_closed_metadata_and_core_override_rejections(self):
        cases = []
        def change(fn):
            value = deepcopy(self.manifest); fn(value); cases.append(value)
        for key, val in [('formatVersion', '2'), ('bundleVersion', 'other'), ('skillSourceSha256', 'd'*64),
                         ('contractsSourceSha256', 'd'*64), ('registrationName', ['define-report', AUTHOR]),
                         ('registrationNames', ['define-report', AUTHOR]), ('path', '/etc/passwd')]:
            change(lambda m, k=key, v=val: m.update({k:v}))
        for key, val in [('id', 'unknown'), ('implementation', 'os.system'), ('version', '2'),
                         ('implementationSourceSha256', 'd'*64), ('contractVersion', '2'), ('priority', True),
                         ('kind', 'component'), ('kind', 'business'), ('kind', 'system'), ('kind', 'unknown'),
                         ('capabilities', ['save']), ('coreFields', ['schemaVersion'])]:
            change(lambda m, k=key, v=val: m['extensions'][0].update({k:v}))
        change(lambda m: m['extensions'].append(deepcopy(m['extensions'][0])))
        for value in cases:
            with self.subTest(value=value), self.assertRaises(DeploymentError): self.assemble(value)
        for ports in ({'authoring_scope': {}}, {'require_source_description': False}, {'tools': {}},
                      {'components': {}}, {'data_context': object()}, {}):
            with self.subTest(ports=ports), self.assertRaises(DeploymentError):
                self.assemble(registry={'fixture-a': replace(self.reg, ports=ports)})

    def test_competing_slots_rejected_even_with_different_priorities(self):
        second = replace(self.reg, id='second', implementation='fixture-b')
        manifest = deepcopy(self.manifest)
        selection = dict(manifest['extensions'][0], id='second', implementation='fixture-b', priority=100)
        manifest['extensions'].append(selection)
        with self.assertRaises(DeploymentError): self.assemble(manifest, {**self.registry, 'fixture-b': second})

    async def test_two_injected_data_implementations_same_public_flow(self):
        spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
        for name in ('fixture-a', 'fixture-b'):
            snapshot = deepcopy(self.base.data_context.snapshot)
            snapshot['version'] = 'synthetic-' + name
            spec = dict(spec, dataContextVersion=snapshot['version'])
            port = FakeDataContextPort(snapshot)
            registration = replace(self.reg, implementation=name, ports={'data_context': port})
            manifest = deepcopy(self.manifest); manifest['extensions'][0]['implementation'] = name
            deployed = self.assemble(manifest, {name: registration})
            turns, candidates = Turns(mode='new'), MemoryCandidates()
            async with Client(create_unified_content_mcp_server(deployed.dependencies, turns, candidate_store=candidates)) as client:
                self.assertEqual({t.name for t in await client.list_tools()},
                    {'read_page_context', 'discover_data_context', 'compose_page', 'create_content_page', 'edit_page'})
                discovery = (await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': 'Tokens'})).structured_content
                self.assertTrue(discovery['ok'], discovery)
                stale = (await client.call_tool('compose_page', {'context_ref': 'current-context',
                    'spec': dict(spec, dataContextVersion='stale')})).structured_content
                self.assertFalse(stale['ok'])
                self.assertEqual(len(candidates.records), 0)
                output = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})).structured_content
                self.assertTrue(output['ok'], output)
                artifact = output['artifactEnvelope']['artifact']
                self.assertEqual(artifact['document']['id'], turns.binding['pageId'])
                self.assertEqual(artifact['rootBinding'], turns.binding)
                self.assertEqual(len(candidates.records), 1)
                self.assertEqual(self.base.source_description.calls[-1][1], snapshot['version'])
                self.assertGreaterEqual(port.calls, 2)
                turns.binding['status'] = 'cancelled'
                refused = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})).structured_content
                self.assertFalse(refused['ok'])
                self.assertEqual(len(candidates.records), 1)

    async def system_fixture(self):
        import tempfile
        from test_authoring_submission import SubmissionFixture
        from test_authoring_recovery import RecoveryAuthority
        from metriccanvas_authoring.adapters.outbound.sqlite_authoring_state import (
            SqliteCandidateStore, SqliteExecutionRecords, SqliteLifecyclePrograms)
        from metriccanvas_authoring.application.authoring_deployment import SystemDependencies
        f = await SubmissionFixture.create()
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        path = Path(directory.name) / 'system.sqlite'
        system = SystemDependencies(f.turns, SqliteCandidateStore(path), SqliteExecutionRecords(path),
            f.service, SqliteLifecyclePrograms(path), f.identities, RecoveryAuthority())
        return f, system

    def assemble_system(self, system, *, name='system-a', ports=None, base_system=None):
        from dataclasses import fields
        from metriccanvas_authoring.application.authoring_deployment import SystemDependencies
        selected_ports = {f.name: getattr(system, f.name) for f in fields(SystemDependencies)} if ports is None else ports
        registration = replace(self.reg, id=name, implementation=name, kind='system', ports=selected_ports)
        manifest = deepcopy(self.manifest)
        manifest['extensions'][0].update(id=name, implementation=name, kind='system')
        return assemble_deployment(manifest, {name: registration}, self.base,
            bundle_version='test', skill_source_sha256='b'*64, contracts_source_sha256='c'*64,
            contract_version='1.0', base_system=base_system)

    async def test_two_systems_public_candidate_lost_ack_original_operation_recovery(self):
        from test_page_editing import title
        systems = [await self.system_fixture(), await self.system_fixture()]
        for index, (f, system) in enumerate(systems):
            deployed = self.assemble_system(system, name=f'system-{index}')
            self.assertIs(deployed.system.lifecycle_service, f.service)
            async with Client(create_deployment_content_server(deployed)) as client:
                output = (await client.call_tool('edit_page', {'context_ref': 'current-context',
                    'request': {'operations': [title(value=f'System {index}')]}})).structured_content
                self.assertTrue(output['ok'], output)
                candidate = output['artifactEnvelope']['artifact']
                self.assertEqual(await system.candidate_store.get(candidate['candidateRef']), candidate)
                other = systems[1-index][1]
                with self.assertRaisesRegex(Exception, 'CANDIDATE_NOT_FOUND'): await other.candidate_store.get(candidate['candidateRef'])
                submission = deployed.create_submission(operation_id=lambda: f'operation-{index}')
                f.service.lose_ack = True
                result = await submission.finalize('current-context', candidate['candidateRef'],
                    description='synthetic', retain_dimension_values=False)
                self.assertEqual(result['status'], 'unknown')
                key = tuple(f.prepared.binding[k] for k in ('actorId', 'workspaceId', 'runId', 'turnId', 'pageId'))
                original = await system.execution_records.get(key)
                recovery = deployed.create_recovery(clock_ms=lambda: 0)
                await recovery.cancel(key)
                f.turns.binding['status'] = 'cancelled'
                saved = await recovery.recover(key, f'attempt-{index}')
                self.assertEqual(saved['status'], 'saved')
                self.assertEqual(saved['operationId'], f'operation-{index}')
                self.assertEqual(f.service.save_calls, 1)
                snapshot = await system.execution_records.get(key)
                self.assertEqual(snapshot['record']['command'], original['record']['command'])
                self.assertEqual(saved['ref'], snapshot['saveReceipt']['ref'])
                self.assertEqual(snapshot['verificationState'], 'verified')
                with self.assertRaisesRegex(Exception, 'EXECUTION_CANCELLED'):
                    await recovery.retry_original(key, f'cancelled-attempt-{index}')
                self.assertEqual(f.service.save_calls, 1)
                self.assertEqual(other.lifecycle_service.save_calls, index)

    async def test_system_completeness_capability_and_disjoint_slots(self):
        f, system = await self.system_fixture()
        with self.assertRaisesRegex(DeploymentError, 'Incomplete'):
            self.assemble_system(system, ports={'current_turns': f.turns})
        deployed = self.assemble_system(system, ports={'current_turns': f.turns}, base_system=system)
        self.assertIs(deployed.system.candidate_store, system.candidate_store)
        for ports in ({'data_context': self.base.data_context}, {'current_turns': object()},
                      {'coordinator': object()}, {'business_interpretation': object()}, {'component_policy': object()}):
            with self.subTest(ports=ports), self.assertRaises(DeploymentError):
                self.assemble_system(system, ports=ports, base_system=system)
        for capability in ('stable_save', 'exact_read', 'operation_lookup'):
            previous = f.service.capabilities
            f.service.capabilities = replace(previous, **{capability: False})
            with self.assertRaisesRegex(DeploymentError, 'capabilities'):
                self.assemble_system(system)
            f.service.capabilities = previous
        for kind in ('business', 'component', 'data'):
            registration = replace(self.reg, kind=kind, ports={'current_turns': f.turns})
            manifest = deepcopy(self.manifest); manifest['extensions'][0]['kind'] = kind
            with self.assertRaisesRegex(DeploymentError, 'Core override'):
                self.assemble(manifest, {'fixture-a': registration})
        with self.assertRaisesRegex(DeploymentError, 'unavailable'):
            self.assemble().create_submission()

    def test_business_component_slots_bind_only_their_real_consumer_fields(self):
        class Business:
            async def propose(self, query, data_context, now): return None
        class Component:
            async def choose(self, scope, candidates): return None
        for kind, slot, port in [('business', 'business_interpretation', Business()),
                                 ('component', 'component_policy', Component())]:
            manifest = deepcopy(self.manifest); manifest['extensions'][0]['kind'] = kind
            registration = replace(self.reg, kind=kind, ports={slot: port})
            deployed = self.assemble(manifest, {'fixture-a': registration})
            self.assertIs(getattr(deployed.dependencies, slot), port)
            with self.assertRaisesRegex(DeploymentError, 'claimed port'):
                self.assemble(manifest, {'fixture-a': replace(registration, ports={slot: object()})})
            second = replace(registration, id='second', implementation='fixture-b')
            manifest['extensions'].append(dict(manifest['extensions'][0], id='second', implementation='fixture-b'))
            with self.assertRaisesRegex(DeploymentError, 'Conflicting'):
                self.assemble(manifest, {'fixture-a': registration, 'fixture-b': second})

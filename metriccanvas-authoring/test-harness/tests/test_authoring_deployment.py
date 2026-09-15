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

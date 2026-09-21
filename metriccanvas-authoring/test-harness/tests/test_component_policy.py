"""Replaceable component preferences never replace product capability gates."""
from copy import deepcopy
from dataclasses import replace
import json
from pathlib import Path
import sys
import unittest
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_unified_content_mcp import dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.application.authoring_deployment import RegisteredExtension, assemble_deployment


class Policy:
    def __init__(self, choice): self.choice, self.calls = choice, []
    async def choose(self, scope, candidates):
        self.calls.append((dict(scope), [dict(c) for c in candidates]))
        if isinstance(self.choice, Exception): raise self.choice
        return self.choice


class ComponentPolicyTest(unittest.IsolatedAsyncioTestCase):
    async def call(self, choice, *, pinned=None, existing=False):
        policy = Policy(choice); turns = Turns('existing' if existing else 'new'); store = MemoryCandidates()
        spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
        spec['units'][0].pop('pinnedComponent', None)
        if pinned: spec['units'][0]['pinnedComponent'] = pinned
        registration = RegisteredExtension('policy', '1', 'component', 'synthetic-policy', 'a'*64, '1.0', {'component_policy':policy})
        manifest = {'formatVersion':'1.0','registrationName':'define-report','bundleVersion':'test',
            'skillSourceSha256':'b'*64,'contractsSourceSha256':'c'*64,'extensions':[{'id':'policy','version':'1','kind':'component',
            'implementation':'synthetic-policy','implementationSourceSha256':'a'*64,'contractVersion':'1.0','priority':1}]}
        deployed = assemble_deployment(manifest, {'synthetic-policy':registration}, dependencies(), bundle_version='test',
            skill_source_sha256='b'*64, contracts_source_sha256='c'*64, contract_version='1.0')
        async with Client(create_unified_content_mcp_server(deployed.dependencies, turns, candidate_store=store)) as client:
            if existing:
                args = {'context_ref':'current-context','request':{'operations':[{'id':'add','type':'add_data_component','sectionId':'main','componentId':'policy-chart','spec':spec}]}}
                output = (await client.call_tool('edit_page',args)).structured_content
            else:
                output = (await client.call_tool('compose_page',{'context_ref':'current-context','spec':spec})).structured_content
        return output, policy, store, turns

    async def test_two_preferences_use_existing_builders_and_scope(self):
        for choice in ('barChart','table'):
            output, policy, store, turns = await self.call(choice)
            self.assertTrue(output['ok'], output)
            document = output['artifactEnvelope']['artifact']['document']
            self.assertEqual(validate_page_document(document), [])
            content = [c for s in document['sections'] for c in s['components'] if c['type'] != 'reportHeader']
            self.assertEqual([c['type'] for c in content], [choice])
            self.assertEqual(policy.calls[0][0], turns.binding)
            self.assertTrue(any(c['type']==choice and c['allowed'] for c in policy.calls[0][1]))
            self.assertNotIn('rows', str(policy.calls)); self.assertNotIn('queryField', str(policy.calls))
            self.assertEqual(len(store.records), 1)

    async def test_unknown_hard_rejected_and_exception_never_fallback(self):
        for choice in ('invented-renderer', 'metricCard', {'type':'table'}, RuntimeError('private-secret')):
            output, policy, store, _ = await self.call(choice)
            self.assertFalse(output['ok'], output)
            self.assertEqual(len(store.records), 0)
            self.assertNotIn('private-secret', str(output))

    async def test_explicit_pinned_user_choice_wins(self):
        output, policy, _, _ = await self.call('table', pinned='barChart')
        self.assertTrue(output['ok'],output)
        self.assertEqual(policy.calls, [])
        output, policy, store, _ = await self.call('table', pinned='metricCard')
        self.assertFalse(output['ok']);self.assertEqual(policy.calls, []);self.assertEqual(len(store.records),0)

    async def test_existing_page_addition_preserves_original_components(self):
        output, policy, _, turns = await self.call('table', existing=True)
        self.assertTrue(output['ok'], output)
        document = output['artifactEnvelope']['artifact']['document']
        old = turns.baseline.document
        self.assertEqual(document['sections'][0]['components'][:-1], old['sections'][0]['components'])
        self.assertEqual(document['sections'][0]['components'][-1]['type'], 'table')
        self.assertEqual(document['layout'],old['layout'])

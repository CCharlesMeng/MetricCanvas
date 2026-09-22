"""Synthetic business vocabulary/time extension checks; no internal-company claims."""
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from fastmcp import Client

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from test_unified_content_mcp import dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.assets.authoring_deployment import RegisteredExtension, assemble_deployment
from metriccanvas_authoring.data.discover_data_context import create_discover_data_context, DiscoverDataContextDependencies, DiscoverDataContextCommand


class SyntheticBusiness:
    def __init__(self, variant='one', candidates=None): self.variant, self.candidates = variant, candidates
    async def propose(self, query, data_context, now):
        candidates = deepcopy(self.candidates) if self.candidates is not None else [
            {'matchedTerm': '吞吐口径', 'kind': 'metric', 'businessDomain': '运营分析', 'canonicalName': 'Tokens请求量'},
            {'matchedTerm': '合成期', 'kind': 'time', 'granularity': 'month', 'start': f'{now.year}-01', 'end': f'{now.year}-02' if self.variant == 'two' else f'{now.year}-01'}]
        return {'formatVersion': '1.0', 'providerNamespace': 'synthetic-business-' + self.variant,
                'sourceRef': 'fixture-' + self.variant, 'sourceVersion': '1', 'dataContextVersion': data_context.version, 'candidates': candidates}


class BusinessInterpretationTest(unittest.IsolatedAsyncioTestCase):
    async def test_two_public_extensions_discover_then_compose_canonical_spec(self):
        fixed = datetime(2026, 9, 15, tzinfo=timezone.utc)
        for variant in ('one', 'two'):
            extension = SyntheticBusiness(variant)
            registration = RegisteredExtension('business', '1', 'business', 'synthetic-business', 'a'*64, '1.0', {'business_interpretation': extension})
            manifest = {'formatVersion': '1.0', 'registrationName': 'define-report', 'bundleVersion': 'test',
                'skillSourceSha256': 'b'*64, 'contractsSourceSha256': 'c'*64, 'extensions': [{
                    'id': 'business', 'version': '1', 'kind': 'business', 'implementation': 'synthetic-business',
                    'implementationSourceSha256': 'a'*64, 'contractVersion': '1.0', 'priority': 1}]}
            deployed = assemble_deployment(manifest, {'synthetic-business': registration}, dependencies(),
                bundle_version='test', skill_source_sha256='b'*64, contracts_source_sha256='c'*64, contract_version='1.0')
            deps = deployed.dependencies
            self.assertIs(deps.business_interpretation, extension)
            with patch('metriccanvas_authoring.data.discover_data_context.datetime') as clock:
                clock.now.return_value = fixed
                async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=MemoryCandidates())) as client:
                    result = (await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': '合成期各区域吞吐口径'})).structured_content
                    self.assertTrue(result['ok'], result)
                    selected = result['resolution']['selected']
                    metric = next(c for c in selected if c['kind'] == 'metric')
                    self.assertEqual(metric['canonicalName'], 'Tokens请求量')
                    self.assertEqual(metric['provenance']['sourceRef'], 'fixture-' + variant)
                    self.assertEqual(result['time']['start'], '2026-01')
                    self.assertEqual(result['time']['end'], '2026-02' if variant == 'two' else '2026-01')
                    spec = json.loads((ROOT / 'test-harness/fixtures/page-build-spec.json').read_text())
                    spec['units'][0]['metrics'][0]['name'] = metric['canonicalName']
                    spec['units'][0]['time'] = result['time']
                    output = (await client.call_tool('compose_page', {'context_ref': 'current-context', 'spec': spec})).structured_content
                    self.assertTrue(output['ok'], output)

    async def test_core_conflicts_do_not_replace_selected_or_time(self):
        proposals = [{'matchedTerm': '区域', 'kind': 'dimension', 'businessDomain': '运营分析', 'canonicalName': '统计周期'},
                     {'matchedTerm': '上个月', 'kind': 'time', 'granularity': 'month', 'start': '1999-01', 'end': '1999-01'}]
        deps = dependencies()
        base = create_discover_data_context(DiscoverDataContextDependencies(deps.data_context, now=lambda: datetime(2026,9,15)))
        extended = create_discover_data_context(DiscoverDataContextDependencies(deps.data_context, now=lambda: datetime(2026,9,15), business_interpretation=SyntheticBusiness(candidates=proposals)))
        before = await base(DiscoverDataContextCommand('上个月区域'))
        after = await extended(DiscoverDataContextCommand('上个月区域'))
        self.assertTrue(after.ok)
        self.assertEqual(after.time, before.time)
        self.assertEqual(after.resolution['selected'], before.resolution['selected'])
        self.assertEqual({a['reason'] for a in after.resolution['ambiguities']}, {'business_extension_conflict', 'business_extension_time_conflict'})

    async def test_cross_kind_alias_ambiguity_and_same_identity_deduplication(self):
        proposals = [{'matchedTerm': '口径', 'kind': 'metric', 'businessDomain': '运营分析', 'canonicalName': 'Tokens请求量'},
                     {'matchedTerm': '口径', 'kind': 'dimension', 'businessDomain': '运营分析', 'canonicalName': '区域'}]
        async with Client(create_unified_content_mcp_server(replace(dependencies(), business_interpretation=SyntheticBusiness(candidates=proposals)), Turns())) as client:
            result = (await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': '口径'})).structured_content
            self.assertTrue(result['ok'])
            self.assertFalse(any(c['matchedTerm'] == '口径' for c in result['resolution']['selected']))
            self.assertEqual(len(result['resolution']['ambiguities']), 1)
        repeated = [{'matchedTerm': '区域', 'kind': 'dimension', 'businessDomain': '运营分析', 'canonicalName': '区域'}] * 2
        async with Client(create_unified_content_mcp_server(replace(dependencies(), business_interpretation=SyntheticBusiness(candidates=repeated)), Turns())) as client:
            result = (await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': '区域'})).structured_content
            self.assertEqual(len([c for c in result['resolution']['selected'] if c['matchedTerm'] == '区域']), 1)
            self.assertEqual(result['resolution']['ambiguities'], [])

    async def test_invalid_proposals_governance_context_and_time_rejected(self):
        class Bad(SyntheticBusiness):
            def __init__(self, mutation): self.mutation = mutation; super().__init__(candidates=[])
            async def propose(self, *args):
                value = await super().propose(*args); self.mutation(value); return value
        mutations = [lambda p: p.update(formatVersion='2.0'), lambda p: p.update(dataContextVersion='old'),
                     lambda p: p.update(schema={'override': True}),
                     lambda p: p['candidates'].append({'matchedTerm': '词', 'kind': 'metric', 'businessDomain': '运营分析', 'canonicalName': 'nonexistent'}),
                     lambda p: p['candidates'].append({'matchedTerm': '词', 'kind': 'time', 'granularity': 'month', 'start': '2026-13', 'end': '2026-14'}),
                     lambda p: p['candidates'].append({'matchedTerm': '词', 'kind': 'time', 'granularity': 'week', 'start': '2026-W01', 'end': '2026-W02'})]
        for mutation in mutations:
            async with Client(create_unified_content_mcp_server(replace(dependencies(), business_interpretation=Bad(mutation)), Turns())) as client:
                result = (await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': '词'})).structured_content
                self.assertFalse(result['ok'])
                self.assertTrue(result['issues'][0]['code'].startswith('BUSINESS_'))

    async def test_provider_errors_do_not_leak_and_context_copy_preserves_core(self):
        class Broken:
            async def propose(self, *args): raise RuntimeError('private-business-secret')
        async with Client(create_unified_content_mcp_server(replace(dependencies(), business_interpretation=Broken()), Turns())) as client:
            result = await client.call_tool('discover_data_context', {'context_ref': 'current-context', 'query': '区域'})
            self.assertFalse(result.structured_content['ok'])
            self.assertNotIn('private-business-secret', str(result))
        class Mutating(SyntheticBusiness):
            async def propose(self, query, context, now):
                context.surfaces_by_domain.clear()
                return await super().propose(query, context, now)
        # The provider receives a separate DataContext; its mutation cannot change
        # the already-computed core matches nor compose's subsequent fresh context.
        deps = dependencies()
        base = create_discover_data_context(DiscoverDataContextDependencies(deps.data_context))
        extended = create_discover_data_context(DiscoverDataContextDependencies(deps.data_context, business_interpretation=Mutating(candidates=[])))
        before = await base(DiscoverDataContextCommand('区域'))
        after = await extended(DiscoverDataContextCommand('区域'))
        self.assertEqual(after.matches, before.matches)
        self.assertEqual(after.business_domains, before.business_domains)

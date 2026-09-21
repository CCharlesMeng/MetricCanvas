"""Synthetic descriptor evidence only; does not establish upstream logical IDs."""
from copy import deepcopy
from dataclasses import replace
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'tool'), str(ROOT / 'test-harness')]
from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
from test_authoring_turns import Turns
from metriccanvas_authoring.domain.source_mapping import map_source_description, query_sha256, validate_mapped_rows, SourceMappingError
from metriccanvas_authoring.pages.composition.page_building import derive_executable_units
from metriccanvas_authoring.domain.data_context import parse_data_context
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies, ComposePageCommand, create_compose_page
from metriccanvas_authoring.domain.execution import DqeExecutionResult


def fixture(name): return json.loads((ROOT / 'test-harness/fixtures' / name).read_text())


class DescriptorFixture:
    """Explicit fixed synthetic identities, never inferred production IDs.

    Tests may supply a named identity map for additional fixture fields. Unknown
    selections fail so this helper cannot pretend arbitrary labels are stable IDs.
    """
    def __init__(self, *, logical_ids=None, aliases=None, overrides=None):
        self.logical_ids = logical_ids or {'区域': 'test-dimension-001', 'Tokens请求量': 'test-metric-002'}
        self.aliases, self.overrides = aliases or {}, overrides or {}
        self.calls = []

    async def describe(self, scope, data_context_version, effective_query):
        self.calls.append((deepcopy(scope), data_context_version, deepcopy(effective_query)))
        fields = []
        for original in effective_query['fieldMappings'].values():
            semantic = original['queryField']
            value = {'semanticName': semantic, 'logicalId': self.logical_ids[semantic], 'projectionId': 'test-projection-001',
                     'queryField': self.aliases.get(semantic, semantic), 'type': original['type'], 'role': original['role'],
                     'nullable': original.get('nullable', False), 'scale': 'none', 'label': semantic}
            if 'unit' in original: value['unit'] = original['unit']
            value.update(self.overrides.get(semantic, {}))
            fields.append(value)
        return {'formatVersion': '1.0', 'providerNamespace': 'synthetic-test-only', 'descriptorRef': 'test-descriptor',
                'descriptorVersion': '1', 'querySha256': query_sha256(effective_query), 'dataContextVersion': data_context_version,
                'fields': fields, 'rules': [], 'unresolved': []}


class SourceMappingTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.spec = fixture('page-build-spec.json')
        self.context, issues = parse_data_context(fixture('data-context.json'))
        self.assertFalse(issues)
        self.unit = derive_executable_units(self.spec, self.context)[0]
        self.descriptor = await DescriptorFixture().describe(Turns().binding, self.context.version, self.unit.effective_query())

    async def test_alias_label_reorder_stable_ids_and_exact_query_field(self):
        first = map_source_description(self.unit, self.descriptor, self.context.version)
        description = deepcopy(self.descriptor)
        description['fields'].reverse()
        for field in description['fields']:
            field['label'] = 'new display label'; field['queryField'] = 'alias-' + field['logicalId']
        reordered = replace(self.unit, fields=dict(reversed(list(self.unit.fields.items()))))
        second = map_source_description(reordered, description, self.context.version)
        self.assertEqual(set(first.fields), set(second.fields))
        self.assertEqual(second.query_body, first.query_body)
        self.assertTrue(all(field['queryField'].startswith('alias-') for field in second.fields.values()))
        self.assertTrue(all(key.startswith('field-') and len(key) == 26 for key in second.fields))

    async def test_missing_duplicate_identity_type_context_and_unknown_rules(self):
        variants = []
        def change(fn):
            value = deepcopy(self.descriptor); fn(value); variants.append(value)
        change(lambda d: d['fields'].pop())
        change(lambda d: d['fields'].append(deepcopy(d['fields'][0])))
        change(lambda d: d['fields'][1].update(logicalId=d['fields'][0]['logicalId']))
        change(lambda d: d['fields'][1].update(queryField=d['fields'][0]['queryField']))
        change(lambda d: d['fields'][1].update(type='string'))
        change(lambda d: d.update(querySha256='a'*64))
        change(lambda d: d.update(dataContextVersion='old'))
        change(lambda d: d.update(rules=[{'internalEnum': 'unknown'}]))
        change(lambda d: d.update(unresolved=['source ordering']))
        for value in variants:
            with self.subTest(value=value), self.assertRaises(SourceMappingError):
                map_source_description(self.unit, value, self.context.version)

    async def test_scale_format_acceptance_and_refusal_without_conversion(self):
        cases = [('percent', 'percent-1', True), ('fraction', 'percent-1', False),
                 ('currency-wan', 'compact-wan-1', False), ('currency-base', 'compact-wan-1', True),
                 ('none', 'compact-yi-1', True), ('unknown', 'number-2', True),
                 ('unknown', 'percent-0', False), ('unknown', 'compact-yi-1', False),
                 ('none', 'internal-unverified-format', False)]
        for scale, fmt, accepted in cases:
            value = deepcopy(self.descriptor); value['fields'][1].update(scale=scale, defaultFormat=fmt)
            with self.subTest(scale=scale, fmt=fmt):
                if accepted:
                    mapped = map_source_description(self.unit, value, self.context.version)
                    self.assertEqual(list(mapped.fields.values())[1]['defaultFormat'], fmt)
                else:
                    with self.assertRaises(SourceMappingError): map_source_description(self.unit, value, self.context.version)
        value = deepcopy(self.descriptor); value['fields'][1].update(type='money', currency='CNY', scale='currency-base')
        self.assertEqual(list(map_source_description(self.unit, value, self.context.version).fields.values())[1]['type'], 'money')
        value['fields'][1]['scale'] = 'currency-wan'
        with self.assertRaises(SourceMappingError): map_source_description(self.unit, value, self.context.version)

    async def test_all_rows_mapping_nullable_and_type_validated_without_rescaling(self):
        mapped = map_source_description(self.unit, self.descriptor, self.context.version)
        rows = [{'区域': 'test', 'Tokens请求量': 0.42}]
        validate_mapped_rows(mapped.fields, rows)
        self.assertEqual(rows[0]['Tokens请求量'], 0.42)
        validate_mapped_rows(mapped.fields, [])  # Schema evidence only, not row evidence.
        for bad in ({'区域': 'x'}, {'区域': 'x', 'Tokens请求量': None}, {'区域': 'x', 'Tokens请求量': True}, {'区域': 'x', 'Tokens请求量': float('nan')}):
            with self.assertRaises(SourceMappingError): validate_mapped_rows(mapped.fields, rows * 20 + [bad])

    async def test_compose_new_descriptor_path_and_legacy_default(self):
        execution = fixture('page-build-execution.json')
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=execution['rows'], captured_at=execution.get('capturedAt')))
        deps = ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')), dqe)
        old = await create_compose_page(deps)(ComposePageCommand('test-page', self.spec))
        self.assertTrue(old.ok)
        self.assertIn('field-1', old.artifact.document['dataSources']['result']['fields'])
        self.assertNotIn('sourceDescriptions', old.artifact.to_payload())
        descriptor = DescriptorFixture()
        mapped_deps = replace(deps, source_description=descriptor, authoring_scope=Turns().binding, require_source_description=True)
        new = await create_compose_page(mapped_deps)(ComposePageCommand('test-page', self.spec))
        self.assertTrue(new.ok, new.issues)
        self.assertEqual(len(descriptor.calls), 1)
        evidence = new.artifact.to_payload()['sourceDescriptions']
        self.assertEqual(evidence[0]['descriptorRef'], 'test-descriptor')
        self.assertEqual(evidence[0]['descriptorVersion'], '1')
        self.assertEqual(evidence[0]['querySha256'], query_sha256(descriptor.calls[0][2]))
        evidence[0]['descriptorVersion'] = 'mutated-by-consumer'
        self.assertEqual(new.artifact.to_payload()['sourceDescriptions'][0]['descriptorVersion'], '1')
        self.assertNotIn('field-1', new.artifact.document['dataSources']['result']['fields'])
        self.assertEqual(new.artifact.document['dataSources']['result']['source']['query'], old.artifact.document['dataSources']['result']['source']['query'])
        class NoExecute:
            async def execute(self, query): raise AssertionError('DQE before descriptor gate')
        unavailable = await create_compose_page(replace(deps, dqe=NoExecute(), require_source_description=True))(ComposePageCommand('test-page', self.spec))
        self.assertEqual(unavailable.issues[0].code, 'SOURCE_DESCRIPTION_UNAVAILABLE')

    async def test_compose_uses_query_declared_alias_and_rejects_stale_rows(self):
        from unittest.mock import patch
        # Synthetic controlled query-stage fixture: the query ALREADY declares its
        # alias. Descriptor mapping itself is never permitted to rewrite the body.
        body = deepcopy(self.unit.query_body)
        body['dsl_list'][0]['output_metrics'] = [{'formula': 'Tokens请求量', 'alias': 'actual_amount'}]
        aliased_unit = replace(self.unit, query_body=body)
        descriptor = DescriptorFixture(aliases={'Tokens请求量': 'actual_amount'})
        execution = DqeExecutionResult(rows=[{'区域': 'East', 'actual_amount': 0.42}], captured_at='2026-09-15T00:00:00Z')
        deps = ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')), FakeDqeExecutionPort(execution),
                                       descriptor, Turns().binding, True)
        with patch('metriccanvas_authoring.data.query.derive_executable_units', return_value=[aliased_unit]):
            result = await create_compose_page(deps)(ComposePageCommand('test-page', self.spec))
            self.assertTrue(result.ok, result.issues)
            source = result.artifact.document['dataSources']['result']
            self.assertEqual({field['queryField'] for field in source['fields'].values()}, {'区域', 'actual_amount'})
            self.assertEqual(source['source']['initial']['rows'][0]['actual_amount'], 0.42)
            self.assertEqual(source['source']['query']['body'], body)
            stale = replace(deps, dqe=FakeDqeExecutionPort(DqeExecutionResult(rows=[{'区域': 'East', 'Tokens请求量': 0.42}])))
            rejected = await create_compose_page(stale)(ComposePageCommand('test-page', self.spec))
            self.assertFalse(rejected.ok)
            self.assertEqual(rejected.issues[0].code, 'SOURCE_ROW_MAPPING_MISSING')
        # A descriptor cannot grant an alias that the original query never declared.
        rejected = await create_compose_page(deps)(ComposePageCommand('test-page', self.spec))
        self.assertFalse(rejected.ok)
        self.assertIn('QUERY_MAPPING_ERROR', {issue.code for issue in rejected.issues})

    async def test_provider_failure_and_query_mutation_cannot_leak_or_change_request(self):
        class Broken:
            async def describe(self, *args): raise RuntimeError('private-provider-password')
        class Mutating(DescriptorFixture):
            async def describe(self, scope, version, query):
                query['body']['privateInjected'] = True
                return await super().describe(scope, version, query)
        for provider, expected in [(Broken(), 'SOURCE_DESCRIPTION_UNAVAILABLE'), (Mutating(), 'SOURCE_QUERY_MISMATCH')]:
            class NoExecute:
                async def execute(self, query): raise AssertionError('must not execute')
            deps = ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')), NoExecute(), provider, Turns().binding, True)
            result = await create_compose_page(deps)(ComposePageCommand('test-page', self.spec))
            self.assertEqual(result.issues[0].code, expected)
            self.assertNotIn('private-provider-password', str(result))

    async def test_shared_format_conformance_acceptance(self):
        cases = json.loads((ROOT / 'contracts/authored/source-format.conformance.json').read_text())['cases']
        for case in cases:
            descriptor = deepcopy(self.descriptor)
            descriptor['fields'][1].update(scale=case['scale'], defaultFormat=case['format'])
            with self.subTest(name=case['name']):
                if case['accepted']:
                    result = map_source_description(self.unit, descriptor, self.context.version)
                    self.assertEqual(list(result.fields.values())[1]['defaultFormat'], case['format'])
                else:
                    with self.assertRaises(SourceMappingError): map_source_description(self.unit, descriptor, self.context.version)

    async def test_provider_scope_copy_and_identity_mismatches_precede_dqe(self):
        class MutatingScope(DescriptorFixture):
            async def describe(self, scope, version, query):
                scope['actorId'] = 'changed-by-provider'; scope['baseRef']['revisionId'] = 'changed'
                return await super().describe(scope, version, query)
        scope = deepcopy(Turns().binding); original = deepcopy(scope)
        execution = fixture('page-build-execution.json')
        deps = ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')),
            FakeDqeExecutionPort(DqeExecutionResult(rows=execution['rows'])), MutatingScope(), scope, True)
        await create_compose_page(deps)(ComposePageCommand('test-page', self.spec))
        self.assertEqual(scope, original)
        for attribute, value, code in [('dataContextVersion', 'old', 'SOURCE_CONTEXT_MISMATCH'),
                                       ('querySha256', 'a'*64, 'SOURCE_QUERY_MISMATCH'),
                                       ('formatVersion', '2.0', 'SOURCE_DESCRIPTION_INVALID')]:
            class Invalid(DescriptorFixture):
                async def describe(self, *args):
                    descriptor = await super().describe(*args); descriptor[attribute] = value
                    return descriptor
            class CountExecute:
                calls = 0
                async def execute(self, query):
                    self.calls += 1
                    return DqeExecutionResult(rows=[])
            counter = CountExecute()
            result = await create_compose_page(replace(deps, source_description=Invalid(), dqe=counter))(ComposePageCommand('test-page', self.spec))
            self.assertEqual(result.issues[0].code, code)
            self.assertEqual(counter.calls, 0)

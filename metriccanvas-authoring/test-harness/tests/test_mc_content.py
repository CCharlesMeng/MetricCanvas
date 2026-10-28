"""Exercise the distributed Interface, including replacement and schema evolution."""
from copy import deepcopy
import json
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / 'mc-content'
sys.path[:0] = [str(CONTENT / 'scripts'), str(ROOT / 'tool')]
from mc_content import compile_layout, evaluate, inspect_assembly, inspect_schema, query_content, verify_package
from mc_resources import ContentError
from metriccanvas_authoring.pages.referenced import COMPOSE_SCHEMA


def envelope():
    return {'templateRef': {'scene': 'business-report', 'variant': 'standard', 'templateVersion': '1'},
        'plan': {'title': '合成验收', 'sources': {}, 'sections': [
            {'id': 'summary', 'blocks': [{'id': 'note', 'type': 'text', 'body': '结构验收'}]}]}}


def page():
    version = verify_package(CONTENT)[1]['alignedWith']['pageSchemaVersion']
    return {'id': 'mc-content-layout-demo', 'schemaVersion': version, 'layout': 'dashboard', 'dataSources': {},
        'sections': [{'id': 'header', 'container': 'plain', 'components': [
            {'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': '合成验收'}}]},
            {'id': 'summary', 'components': [{'id': 'note', 'type': 'text', 'layout': {'span': 12}, 'props': {'body': '结构验收'}}]}]}


class McContentTest(unittest.TestCase):
    def test_reviewed_report_compositions_are_queryable(self):
        result = query_content('layout', 'report-composition', root=CONTENT)
        text = result['content']
        self.assertFalse(result['truncated'])
        ids = re.findall(r'^\| (C\d-[A-D]) \|', text, re.MULTILINE)
        self.assertEqual(ids, ['C1-A', 'C1-B', 'C2-A', 'C2-B', 'C3-A', 'C4-A', 'C4-B', 'C4-C', 'C4-D', 'C5-A', 'C5-B'])
        self.assertIn('本期数值使用默认文本色', text)
        self.assertIn('不能只给一半变化值着色', text)
        self.assertIn('单个小环图不独占通栏', text)
        self.assertIn('不支持compositeCard／tabContainer', text)
        self.assertIn('report-composition.md', query_content('layout', 'report', root=CONTENT)['content'])
        self.assertIn('report-composition.md', query_content('layout', 'reading', root=CONTENT)['content'])

    def test_snapshot_matches_actual_compose_contract(self):
        snapshot = json.loads((CONTENT / 'mc-closed-sets/snapshot.json').read_text())
        self.assertEqual(snapshot['composeSchema'], COMPOSE_SCHEMA)
        self.assertIn('pagedJoins', snapshot['composeSchema']['properties'])
        variants = snapshot['composeSchema']['properties']['sections']['items']['properties']['blocks']['items']['oneOf']
        self.assertNotEqual(variants[0]['properties']['purpose']['enum'], variants[1]['properties']['purpose']['enum'])

    def test_query_atom_and_paginated_index(self):
        result = query_content('tool', 'compose_page', root=CONTENT)
        self.assertIn('expected_version', result['content']['parameters'])
        self.assertNotIn('requestSchema', result['content'])
        self.assertFalse(result['truncated'])
        index = query_content('index', 'error', {'limit': 2}, root=CONTENT)['content']
        self.assertEqual(len(index['entries']), 2)
        self.assertEqual(index['nextOffset'], 2)
        self.assertEqual(query_content('error', 'DECLARED_REQUIREMENT_GAP', root=CONTENT)['content']['code'], 'DECLARED_REQUIREMENT_GAP')
        self.assertIsNotNone(query_content('error', 'DECLARED_REQUIREMENT_GAP', root=CONTENT)['content']['guidance'])

    def test_product_error_sets_are_exported_without_becoming_a_deployment_claim(self):
        index = json.loads((CONTENT / 'index.json').read_text())
        snapshot = json.loads((CONTENT / 'mc-closed-sets/snapshot.json').read_text())
        self.assertTrue(set(snapshot['queryErrorCodes']) <= set(index['error']))
        self.assertTrue(set(snapshot['pageErrorTypes']) <= set(index['error']))
        code = snapshot['queryErrorCodes'][0]
        self.assertTrue(query_content('error', code, root=CONTENT)['content']['coverage']['queryClosedSet'])

    def test_oversized_contract_is_not_silently_truncated(self):
        result = query_content('tool', 'compose_page', {'includeSchema': True, 'maxBytes': 128}, root=CONTENT)
        self.assertIsNone(result['content'])
        self.assertTrue(result['truncated'])
        with self.assertRaises(ContentError):
            query_content('tool', '../runtime', root=CONTENT)
        with self.assertRaises(ContentError):
            query_content('tool', 'compose_page', {'includeSchema': 'false'}, root=CONTENT)

    def test_compiler_preserves_explicit_fields_and_never_restores_deleted_nodes(self):
        value = envelope()
        value['plan']['layout'] = 'dashboard'
        original = deepcopy(value)
        result = compile_layout(value, root=CONTENT)
        self.assertEqual(result['status'], 'ok', result)
        self.assertEqual(result['plan']['layout'], 'dashboard')
        self.assertEqual([section['id'] for section in result['plan']['sections']], ['summary'])
        self.assertEqual(result['plan']['sections'][0]['pattern'], 'overview-with-trend')
        self.assertEqual(value, original)

    def test_null_omission_does_not_inherit_template_width(self):
        value = envelope()
        value['plan']['sections'][0]['blocks'][0]['width'] = None
        result = compile_layout(value, root=CONTENT)
        self.assertEqual(result['status'], 'ok', result)
        self.assertNotIn('width', result['plan']['sections'][0]['blocks'][0])
        self.assertIn('OPTIONAL_NULL_OMITTED', [item['code'] for item in result['adjustments']])

    def test_explicit_text_choice_does_not_inherit_an_illegal_data_purpose(self):
        value = envelope()
        value['templateRef']['variant'] = 'rich'
        value['plan']['sections'][0]['id'] = 'distribution'
        value['plan']['sections'][0]['blocks'][0]['id'] = 'ranking'
        result = compile_layout(value, root=CONTENT)
        self.assertEqual(result['status'], 'ok', result)
        block = result['plan']['sections'][0]['blocks'][0]
        self.assertEqual(block['type'], 'text')
        self.assertNotIn('purpose', block)
        self.assertIn('LAYOUT_DEFAULT_NOT_APPLICABLE', [item['code'] for item in result['adjustments']])

    def test_no_hidden_repair_of_bad_fields_or_missing_blocks(self):
        value = envelope()
        value['plan']['sections'][0].pop('blocks')
        self.assertEqual(compile_layout(value, root=CONTENT)['gaps'][0]['code'], 'PLAN_SECTION_BLOCKS_REQUIRED')
        value = envelope()
        value['plan']['sections'][0]['blocks'][0]['width'] = 'giant'
        self.assertIsNone(compile_layout(value, root=CONTENT)['plan'])

    def test_template_reference_and_target_versions_are_explicit(self):
        value = envelope()
        value['templateRef']['templateVersion'] = 'old'
        self.assertEqual(compile_layout(value, root=CONTENT)['gaps'][0]['code'], 'TEMPLATE_VERSION_MISMATCH')
        value = envelope()
        value['targetVersions'] = {'pageSchemaVersion': '999.0'}
        self.assertEqual(compile_layout(value, root=CONTENT)['gaps'][0]['code'], 'CONTENT_VERSION_MISMATCH')

    def test_planned_ioc_does_not_compile(self):
        value = envelope()
        value['templateRef']['scene'] = 'ioc-overview'
        self.assertEqual(compile_layout(value, root=CONTENT)['gaps'][0]['code'], 'TEMPLATE_NOT_EXECUTABLE')

    def test_all_executable_variants_and_unknown_alignment_fields(self):
        for scene, variant in [('business-report', 'compact'), ('business-report', 'standard'), ('business-report', 'rich'), ('usage-report', 'standard')]:
            value = envelope()
            value['templateRef'].update(scene=scene, variant=variant)
            self.assertEqual(compile_layout(value, root=CONTENT)['status'], 'ok')
        value['targetVersions'] = {'inventedVersion': None}
        self.assertEqual(compile_layout(value, root=CONTENT)['gaps'][0]['code'], 'TARGET_VERSIONS_INVALID')

    def test_user_requirement_is_reported_without_changing_plan(self):
        value = envelope()
        value['userRequirements'] = [{'id': 'note', 'mustBe': 'mapChart'}]
        result = compile_layout(value, root=CONTENT)
        self.assertEqual(result['status'], 'gap')
        self.assertEqual(result['plan']['sections'][0]['blocks'][0]['type'], 'text')
        self.assertEqual(result['gaps'][0]['origin'], 'userRequired')

    def test_artifact_checks_do_not_save_or_change_document(self):
        compiled = compile_layout(envelope(), root=CONTENT)
        document = page()
        original = deepcopy(document)
        result = inspect_assembly(document, compiled['inspectionSpec'], root=CONTENT)
        self.assertEqual(result['status'], 'ok', result)
        self.assertEqual(document, original)
        document['sections'][0]['components'][0]['type'] = 'text'
        result = inspect_assembly(document, compiled['inspectionSpec'], root=CONTENT)
        self.assertEqual(result['gaps'][0]['code'], 'MANDATORY_COMPONENT_DEGRADED')

    def test_mixed_inspection_context_reports_unavailable(self):
        compiled = compile_layout(envelope(), root=CONTENT)
        compiled['inspectionSpec']['contentSha256'] = 'different-package'
        result = inspect_assembly(page(), compiled['inspectionSpec'], root=CONTENT)
        self.assertEqual(result['status'], 'not_run')
        self.assertEqual(result['issues'][0]['code'], 'INSPECTION_CONTENT_MISMATCH')

    def test_field_selection_cannot_pass_just_because_source_still_contains_field(self):
        value = envelope()
        value['plan']['sources'] = {'s': 'synthetic'}
        value['plan']['sections'][0]['blocks'] = [{'id': 'note', 'type': 'data', 'component': 'table',
            'title': '合成明细', 'source': 's', 'fields': ['value']}]
        compiled = compile_layout(value, root=CONTENT)
        self.assertEqual(compiled['status'], 'ok', compiled)
        document = page()
        document['dataSources'] = {'s': {'fields': {key: {'type': 'number', 'role': 'measure'} for key in ['value', 'other']},
            'source': {'type': 'inline', 'rows': [{'value': 1, 'other': 2}]}}}
        component = {'id': 'note', 'type': 'table', 'layout': {'span': 12}, 'data': {'main': 's'},
            'props': {'title': '合成明细', 'columns': [{'field': 'value'}]}}
        document['sections'][1]['components'] = [component]
        self.assertEqual(inspect_assembly(document, compiled['inspectionSpec'], root=CONTENT)['status'], 'ok')
        component['props']['columns'][0]['field'] = 'other'
        result = inspect_assembly(document, compiled['inspectionSpec'], root=CONTENT)
        self.assertEqual(result['status'], 'gap', result)
        self.assertEqual(result['gaps'][0]['reason'], 'component_fields_changed')

    def test_evaluation_reports_scope_without_adoption_or_exemptions(self):
        report = evaluate({'checks': [{'id': 'compile', 'operation': 'compile', 'input': envelope(), 'expectedStatus': 'ok'},
            {'id': 'real-save', 'operation': 'deployment', 'expectedStatus': 'ok'}]}, root=CONTENT)
        self.assertEqual(report['conclusion'], {'passed': 1, 'failed': 0, 'not_run': 1})
        self.assertNotIn('evalStatus', report)

    def test_complete_copy_runs_outside_repository_and_detects_tampering(self):
        with tempfile.TemporaryDirectory() as folder:
            installed = Path(folder) / 'mc-content'
            shutil.copytree(CONTENT, installed)
            output = subprocess.run([sys.executable, str(installed / 'scripts/mc_content.py'), 'query', '--topic', 'tool', '--key', 'compose_page'],
                cwd=folder, capture_output=True, text=True, check=False)
            self.assertEqual(output.returncode, 0, output.stderr)
            verify_package(installed)
            (installed / 'layouts/report.md').write_text('changed')
            with self.assertRaises(ContentError):
                verify_package(installed)

    def test_schema_compatibility_is_not_version_string_replacement(self):
        document = page()
        document['schemaVersion'] = '6.1'
        result = inspect_schema(document, root=CONTENT)
        self.assertFalse(result['readable'])
        self.assertTrue(result['upgrade']['possible'])
        self.assertEqual(result['status'], 'upgrade_required')
        document['schemaVersion'] = '6.0'
        self.assertFalse(inspect_schema(document, root=CONTENT)['upgrade']['possible'])
        document['schemaVersion'] = '999.0'
        result = inspect_schema(document, root=CONTENT)
        self.assertFalse(result['upgrade']['possible'])

    def test_future_schema_releases_use_product_policy_without_an_mc_version_copy(self):
        policy = query_content('protocol', 'version-policy', root=CONTENT)['content']
        self.assertEqual(policy['current'], verify_package(CONTENT)[1]['alignedWith']['pageSchemaVersion'])
        current = page()
        minor = int(current['schemaVersion'].split('.')[1])
        current['schemaVersion'] = f'6.{minor + 1}'
        report = inspect_schema(current, root=CONTENT)
        self.assertFalse(report['readable'])
        self.assertFalse(report['upgrade']['possible'])

    def test_known_old_header_semantics_require_explicit_migration(self):
        document = page()
        document['schemaVersion'] = '6.13'
        document['sections'][0]['components'][0]['props']['filterIds'] = ['period']
        report = inspect_schema(document, root=CONTENT)
        self.assertFalse(report['upgrade']['possible'])
        self.assertIn('/sections/0/components/0/props/filterIds', [item['path'] for item in report['upgrade']['errors']])

    def test_manifest_alignment_cannot_be_changed_without_replacing_the_package(self):
        with tempfile.TemporaryDirectory() as folder:
            installed = Path(folder) / 'mc-content'
            shutil.copytree(CONTENT, installed)
            path = installed / 'mc-content.version.json'
            manifest = json.loads(path.read_text())
            manifest['alignedWith']['pageSchemaVersion'] = '999.0'
            path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ContentError, 'CONTENT_ALIGNMENT_MISMATCH'):
                verify_package(installed)

    def test_schema_upgrade_preserves_original_and_refuses_existing_destination(self):
        with tempfile.TemporaryDirectory() as folder:
            original = Path(folder) / 'mc-content-layout-demo.json'
            value = page()
            value['schemaVersion'] = '6.1'
            bytes_before = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
            original.write_bytes(bytes_before)
            target = Path(folder) / 'upgrade'
            command = ['node', str(CONTENT / 'scripts/upgrade-page.mjs'), str(original), '--out-dir', str(target)]
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertEqual(original.read_bytes(), bytes_before)
            self.assertEqual((target / 'original' / original.name).read_bytes(), bytes_before)
            current = json.loads((target / 'page' / original.name).read_text())
            self.assertEqual(current['schemaVersion'], verify_package(CONTENT)[1]['alignedWith']['pageSchemaVersion'])
            self.assertNotEqual(subprocess.run(command, capture_output=True, check=False).returncode, 0)


class McCompletenessTest(unittest.TestCase):
    def test_full_tool_schemas_match_live_registration_and_refs_close(self):
        import asyncio
        from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
        from jsonschema import Draft202012Validator
        tools = asyncio.run(create_platform_mcp_server(None).list_tools())
        for tool in tools:
            actual = query_content('tool', tool.name, {'includeSchema': True, 'maxBytes': 1048576}, root=CONTENT)['content']
            self.assertEqual(actual['inputSchema'], tool.parameters)
            Draft202012Validator.check_schema(actual['inputSchema'])
            self.assert_references(actual['inputSchema'], actual['inputSchema'])

    def assert_references(self, value, schema):
        if isinstance(value, dict):
            if '$ref' in value:
                target = schema
                self.assertTrue(value['$ref'].startswith('#/'))
                for part in value['$ref'][2:].split('/'):
                    target = target[part.replace('~1', '/').replace('~0', '~')]
            for child in value.values():
                self.assert_references(child, schema)
        elif isinstance(value, list):
            for child in value:
                self.assert_references(child, schema)

    def test_common_knowledge_and_tool_fields_are_bounded_with_continuations(self):
        for key in ['table.width', 'fields.format', 'data.query']:
            result = query_content('knowledge', key, root=CONTENT)
            self.assertFalse(result['truncated'], key)
            self.assertTrue(result['content']['semantics'])
        result = query_content('tool', 'edit_page', {'pointer': '#/properties/expected_version'}, root=CONTENT)
        self.assertFalse(result['truncated'])
        self.assertEqual(result['content']['facts']['minimum'], 0)
        self.assertIn('required', result['content']['ancestors'][0]['facts'])
        with self.assertRaises(ContentError):
            query_content('tool', 'edit_page', {'pointer': '#/missing'}, root=CONTENT)
        node = query_content('node', '#/definitions/tableComponent', root=CONTENT)
        self.assertTrue(node['content']['nodes'])

    def test_nested_components_use_product_walk_and_preserve_slot_selection(self):
        value = envelope()
        value['userRequirements'] = [{'id': 'note', 'mustBe': 'text'}]
        compiled = compile_layout(value, root=CONTENT)
        document = page()
        document['sections'][1]['components'] = [{'id': 'container', 'type': 'tabContainer', 'layout': {'span': 12},
            'props': {'tabs': [{'id': 'first', 'label': '合成', 'components': document['sections'][1]['components']}]}}]
        report = inspect_assembly(document, compiled['inspectionSpec'], root=CONTENT)
        self.assertEqual(report['status'], 'ok', report)
        nested = next(item for item in report['schema']['components'] if item['id'] == 'note')
        self.assertIn('/props/tabs/0/components/', nested['path'])
        self.assertIn('compute-business-semantics', report['notVerified'])

    def test_exact_program_association_and_wrong_artifact(self):
        from mc_resources import value_digest
        value = {**envelope(), 'requestId': 'parallel-request-A'}
        compiled = compile_layout(value, root=CONTENT)
        document = page()
        spec = compiled['inspectionSpec']
        association = {'requestId': value['requestId'], 'compileInput': value,
            'documentSha256': value_digest(document), 'inspectionSpecSha256': value_digest(spec)}
        report = inspect_assembly(document, spec, correlation=association, root=CONTENT)
        self.assertEqual(report['correlation']['status'], 'checked')
        association['requestId'] = 'parallel-request-B'
        self.assertEqual(inspect_assembly(document, spec, correlation=association, root=CONTENT)['status'], 'not_run')
        self.assertEqual(inspect_assembly(document, spec, root=CONTENT)['correlation']['status'], 'not_run')

    def test_old_loaded_code_rejects_a_self_consistently_replaced_script(self):
        from mc_resources import digest
        with tempfile.TemporaryDirectory() as folder:
            installed = Path(folder) / 'changed-code'
            shutil.copytree(CONTENT, installed, ignore=shutil.ignore_patterns('__pycache__'))
            changed = installed / 'scripts/mc_layout_compiler.py'
            changed.write_text(changed.read_text() + '\n# replaced implementation\n')
            path = installed / 'mc-content.version.json'
            manifest = json.loads(path.read_text())
            for item in manifest['files']:
                item['sha256'] = digest((installed / item['file']).read_bytes())
            manifest['contentSha256'] = digest((json.dumps(manifest['files'], ensure_ascii=False, indent=2) + '\n').encode())
            path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ContentError, 'Reload all MC modules'):
                verify_package(installed)

    def test_distributed_tool_call_examples_match_full_input_schemas(self):
        from jsonschema import Draft202012Validator
        for example in json.loads((CONTENT / 'examples/tool-calls.json').read_text()):
            schema = json.loads((CONTENT / f"tool-contracts/{example['tool']}.json").read_text())['inputSchema']
            self.assertEqual(list(Draft202012Validator(schema).iter_errors(example['arguments'])), [])

    def test_common_knowledge_is_identical_to_standalone_local_authoring(self):
        mc = (CONTENT / 'references/authoring-knowledge/model.json').read_bytes()
        local = (ROOT / 'skill/metriccanvas-local-authoring/references/authoring-knowledge/model.json').read_bytes()
        self.assertEqual(mc, local)

    def test_standalone_install_knowledge_compile_inspect_and_real_migration(self):
        import os
        from mc_content import upgrade_page
        with tempfile.TemporaryDirectory() as folder:
            installed = Path(folder) / 'only-mc'
            shutil.copytree(CONTENT, installed, ignore=shutil.ignore_patterns('__pycache__'))
            env = {**os.environ, 'PYTHONPATH': '', 'METRICCANVAS_BUNDLE_ROOT': str(Path(folder) / 'missing-repository')}
            command = [sys.executable, str(installed / 'scripts/mc_content.py')]
            result = subprocess.run([*command, 'query', '--topic', 'knowledge', '--key', 'table.width'], cwd=folder, env=env, capture_output=True, text=True, check=True)
            self.assertFalse(json.loads(result.stdout)['truncated'])
            sample = subprocess.run([sys.executable, str(installed / 'examples/program-call.py')], cwd=folder, env=env, capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(sample.stdout)['inspectionStatus'], 'ok')
            compiled = compile_layout(envelope(), root=installed)
            self.assertEqual(inspect_assembly(page(), compiled['inspectionSpec'], root=installed)['status'], 'ok')
            legacy = ROOT.parent / 'tools/fixtures/local-authoring-upgrade/chart-filter.json'
            original = Path(folder) / 'legacy.json'
            original.write_bytes(legacy.read_bytes())
            before = original.read_bytes()
            dry = upgrade_page(original, root=installed)
            self.assertEqual(dry['status'], 'ready', dry)
            output = Path(folder) / 'migrated'
            written = upgrade_page(original, output, root=installed)
            self.assertEqual(written['status'], 'ready', written)
            self.assertTrue(written['output'])
            self.assertEqual((output / 'original/legacy.json').read_bytes(), before)
            target = json.loads(Path(written['output']).read_text())
            self.assertTrue(inspect_schema(target, root=installed)['readable'])
            self.assertTrue(any(item['type'] == 'compositeCard' for section in target['sections'] for item in section['components']))
            self.assertEqual(original.read_bytes(), before)

    def test_catalog_query_refs_and_unique_basename_aliases(self):
        from mc_resources import canonical_key
        catalog = query_content('layout', 'catalog', root=CONTENT)['content']
        ref = catalog['scenes'][0]['variants'][1]['queryRef']
        canonical = query_content(ref['topic'], ref['key'], root=CONTENT)
        aliased = query_content('layout', 'business-report-standard', root=CONTENT)
        self.assertEqual(aliased, canonical)
        self.assertEqual(aliased['key'], 'standards/business-report-standard')
        index = {'layout': {'a/x': 'one', 'b/x': 'two', 'x': 'canonical'}}
        self.assertEqual(canonical_key(index, 'layout', 'x'), 'x')
        del index['layout']['x']
        with self.assertRaises(ContentError) as caught:
            canonical_key(index, 'layout', 'x')
        self.assertEqual(caught.exception.issue['code'], 'CONTENT_KEY_AMBIGUOUS')
        self.assertEqual(caught.exception.issue['candidates'], ['a/x', 'b/x'])

    def test_exact_artifact_adapter_checks_binding_and_immutable_association(self):
        from mc_content import inspect_artifact
        from mc_resources import value_digest
        value = {**envelope(), 'requestId': 'request-A'}
        compiled = compile_layout(value, root=CONTENT)
        spec, document = compiled['inspectionSpec'], page()
        artifact = {'document': document, 'binding': {'turnId': 'A'}, 'operationId': 'op-A'}
        ref = 'artifact-' + value_digest(artifact)
        artifact['artifactRef'] = ref
        association = {'artifactRef': ref, 'requestId': 'request-A', 'compileInput': value,
                       'documentSha256': value_digest(document), 'inspectionSpecSha256': value_digest(spec)}
        def inspect(candidate=artifact, specification=spec, binding=artifact['binding']):
            return inspect_artifact(candidate, specification, artifact_ref=ref, binding=binding, association=association, root=CONTENT)
        self.assertEqual(inspect()['correlation']['status'], 'checked')
        self.assertEqual(inspect(binding={'turnId': 'B'})['status'], 'not_run')
        wrong = deepcopy(artifact); wrong['operationId'] = 'op-B'
        self.assertEqual(inspect(candidate=wrong)['status'], 'not_run')
        stale = deepcopy(spec); stale['requirements'] = []
        self.assertEqual(inspect(specification=stale)['status'], 'not_run')
        self.assertEqual(artifact['document'], document)


if __name__ == '__main__':
    unittest.main()

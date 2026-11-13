"""Exercise explicit product resources from a cwd without a checkout or Bundle."""
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from dataclasses import replace
from functools import partial
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/tool'))
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document, normalize_page_document
from metriccanvas_authoring.pages.validation.node_validator import NodeValidationResources, validate_with_node, compose_validation_session
from metriccanvas_authoring.pages.parameters.parameter_preparation import prepare_parameter_request, accept_parameter_result
from metriccanvas_authoring.pages import referenced
from test_multislot_authoring import record


def load(relative):
    return json.loads((ROOT / relative).read_text())


def compose_input(count=3):
    blocks = [{'id': f'table-{index}', 'type': 'data', 'component': 'table',
               'source': 'current', 'fields': ['region', 'amount'],
               'title': '合成装配回归', 'purpose': 'reconciliation'} for index in range(count)]
    return {'title': '合成装配回归', 'layout': 'dashboard', 'sources': {'current': 'current-ref'},
            'sections': [{'id': 'main', 'pattern': 'custom', 'blocks': blocks}]}


class ExplicitResourcesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='authoring-explicit-')
        cls.root = Path(cls.directory.name)
        build = """import {authoringPageProgramOutputs} from './tools/scripts/build-authoring-page-program.ts';
import {mkdirSync,writeFileSync} from 'node:fs'; import {dirname,join} from 'node:path';
for(const [file,content] of await authoringPageProgramOutputs(process.cwd())) {
const target=join(process.argv[1],file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,content);}
"""
        subprocess.run(['node', '--import', 'tsx', '-e', build, str(cls.root)], cwd=ROOT, check=True)
        cls.program = cls.root / 'scripts/authoring-page-program.mjs'
        cls.schema = load('metriccanvas-authoring/contract-snapshot/page/schema.json')
        cls.version = cls.schema['properties']['schemaVersion']['enum'][-1]
        cls.resources = NodeValidationResources(cls.program, hashlib.sha256(cls.program.read_bytes()).hexdigest(), cls.version, {'instant': '2026-11-03T00:00:00Z', 'timeZone': 'Asia/Shanghai'})

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def run_program(self, operation, value):
        result = subprocess.run(['node', str(self.program)], cwd=self.root,
            input=json.dumps({'operation': operation, 'input': value}), capture_output=True, text=True, check=False)
        self.assertIn(result.returncode, (0, 2), result.stderr)
        return json.loads(result.stdout)

    def test_schema_and_node_resources_do_not_resolve_bundle(self):
        simple = load('packages/page/fixtures/contract-valid/query-dashboard.json')
        advanced = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        before = deepcopy([simple, advanced, self.schema])
        with patch('metriccanvas_authoring.pages.validation.page_validation.bundle_root', side_effect=AssertionError('Bundle lookup forbidden')):
            self.assertEqual(validate_page_document(simple, schema=self.schema), [])
            self.assertEqual(validate_with_node(advanced, resources=self.resources), [])
            normalized = normalize_page_document(advanced, schema=self.schema, node_resources=self.resources)
        self.assertTrue(normalized['ok'], normalized)
        self.assertEqual([simple, advanced, self.schema], before)

    def test_explicit_node_uses_product_rules_instead_of_legacy_python_coverage(self):
        page = load('metriccanvas-authoring/contract-snapshot/page/conformance/valid/ioc-component-paged-union-branches.json')
        before = deepcopy(page)
        expected = self.run_program('page.validate', {'document': page})['diagnostics']
        actual = validate_page_document(page, schema=self.schema, node_resources=self.resources)
        self.assertEqual([item.as_dict() for item in actual], expected)
        self.assertEqual(expected, [])
        self.assertEqual(page, before)

    def test_invalid_complete_ordered_diagnostics_match_program(self):
        page = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        page['id'] = 7
        page['sections'] = 'invalid'
        before = deepcopy(page)
        expected = self.run_program('page.validate', {'document': page})['diagnostics']
        self.assertEqual([item.as_dict() for item in validate_with_node(page, resources=self.resources)], expected)
        self.assertEqual(page, before)

    def test_compose_reuses_process_without_skipping_component_or_final_validation(self):
        request = compose_input()
        records = {'current': record([{'region': 'a', 'amount': 2}])}
        before = deepcopy((request, records))
        with patch.object(subprocess, 'Popen', wraps=subprocess.Popen) as started, patch.object(
                referenced, 'validate_page_document', wraps=referenced.validate_page_document) as checked:
            result = referenced.compose_candidate('process-reuse', self.version, request, records,
                                                 page_schema=self.schema, node_resources=self.resources)
        self.assertEqual(result['status'], 'changed', result)
        self.assertEqual(checked.call_count, 4)
        self.assertEqual(started.call_count, 2, 'one Node version check and one validation process per compose')
        self.assertEqual((request, records), before)

    def test_compose_retains_trial_validation_cause_through_product_receipt(self):
        from metriccanvas_authoring.pages.multislot_operations import invoke
        value = {'pageId': 'compose-diagnostic', 'request': compose_input(1),
                 'resultRecords': {'current': record([{'region': 'a', 'amount': 2}])}}
        value['resultRecords']['current']['source']['source']['query']['body']['dsl_list'][0]['output_dims'] = []
        before = deepcopy(value)
        with patch.object(referenced, 'validate_page_document', wraps=referenced.validate_page_document) as checked:
            result = invoke('page.compose.v2', value, page_schema=self.schema, node_resources=self.resources)
        self.assertEqual(result['status'], 'error')
        self.assertIsNone(result['data']['document'])
        self.assertEqual(result['data']['saveStatus'], 'not_requested')
        issues = result['data']['operations'][0]['issues']
        self.assertEqual((issues[0]['code'], issues[0]['path'], issues[0]['pathScope']),
                         ('STRUCTURE_COMPONENT_INVALID', '/sections/0/blocks/0', 'input'))
        causes = [issue for issue in issues if issue.get('pathScope') == 'document']
        self.assertTrue(causes, issues)
        expected = self.run_program('page.validate', {'document': checked.call_args_list[0].args[0]})['diagnostics']
        self.assertEqual([(i['code'], i['path'], i['message']) for i in causes],
                         [(i['type'], i['path'], i['message']) for i in expected])
        self.assertTrue(any(issue['path'].startswith('/dataSources/current') for issue in causes), causes)
        self.assertTrue(all(issue['message'] and issue['blockId'] == 'table-0' for issue in causes))
        self.assertEqual(result['diagnostics'][1:], issues)
        self.assertEqual(value, before)

    def test_trial_diagnostics_keep_partial_rollback_and_operation_order(self):
        from metriccanvas_authoring.pages.multislot_operations import invoke
        build = referenced.block_component
        def broken_component(block, *args, **kwargs):
            component = build(block, *args, **kwargs)
            if block['id'] == 'table-1':
                component['props']['unexpected'] = True
            return component
        value = {'pageId': 'partial-diagnostic', 'request': compose_input(),
                 'resultRecords': {'current': record([{'region': 'a', 'amount': 2}])}}
        before = deepcopy(value)
        with patch.object(referenced, 'block_component', side_effect=broken_component):
            result = invoke('page.compose.v2', value, page_schema=self.schema, node_resources=self.resources)
        self.assertEqual(result['status'], 'partial')
        self.assertEqual([operation['status'] for operation in result['data']['operations']],
                         ['applied', 'failed', 'applied'])
        self.assertEqual([component['id'] for component in result['data']['document']['sections'][1]['components']],
                         ['table-0', 'structure-missing-table-1', 'table-2'])
        issues = result['data']['operations'][1]['issues']
        self.assertEqual(issues[0]['path'], '/sections/0/blocks/1')
        self.assertTrue(any(i.get('pathScope') == 'document' and i['path'].startswith('/sections/1/components/1')
                            for i in issues), issues)
        self.assertEqual(result['diagnostics'], issues)
        self.assertEqual(validate_page_document(result['data']['document'], schema=self.schema,
                                               node_resources=self.resources), [])
        self.assertEqual(result['data']['saveStatus'], 'not_requested')
        self.assertEqual(value, before)

    def test_final_validation_retains_cause_without_returning_invalid_candidate(self):
        from metriccanvas_authoring.pages.multislot_operations import invoke
        def invalidate_final(document):
            document['id'] = 7
        value = {'pageId': 'final-diagnostic', 'request': compose_input(1),
                 'resultRecords': {'current': record([{'region': 'a', 'amount': 2}])}}
        before = deepcopy(value)
        with patch.object(referenced, 'add_query_table_pagination', side_effect=invalidate_final):
            result = invoke('page.compose.v2', value, page_schema=self.schema, node_resources=self.resources)
        self.assertEqual(result['status'], 'error')
        self.assertIsNone(result['data']['document'])
        self.assertEqual(result['data']['operations'][0]['status'], 'applied')
        self.assertEqual(result['diagnostics'][0]['code'], 'COMPOSE_RESULT_INVALID')
        self.assertTrue(any(i.get('pathScope') == 'document' and i['path'] == '/id' and i['message']
                            for i in result['diagnostics']), result)
        self.assertEqual(result['data']['saveStatus'], 'not_requested')
        self.assertEqual(value, before)

    def test_compose_matches_cold_results_including_partial_and_all_failed(self):
        for failed in ((), (1,), (0, 1, 2)):
            request = compose_input()
            for index in failed:
                request['sections'][0]['blocks'][index]['fields'] = ['absent']
            records = {'current': record([{'region': 'a', 'amount': 2}])}
            before = deepcopy((request, records))
            with patch.object(referenced, 'compose_validation_session', side_effect=nullcontext):
                expected = referenced.compose_candidate('equivalent', self.version, request, records,
                                                       page_schema=self.schema, node_resources=self.resources)
            actual = referenced.compose_candidate('equivalent', self.version, request, records,
                                                 page_schema=self.schema, node_resources=self.resources)
            self.assertEqual(actual, expected)
            self.assertEqual(actual['status'], 'changed' if not failed else 'partial' if len(failed) == 1 else 'failed')
            self.assertEqual((request, records), before)

    def test_session_keeps_complete_ordered_errors_and_continues_after_invalid_page(self):
        valid = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        invalid = {**valid, 'id': 7, 'sections': 'invalid'}
        expected = validate_with_node(invalid, resources=self.resources)
        with compose_validation_session(self.resources) as resources:
            self.assertEqual(validate_with_node(valid, resources=resources), [])
            process = resources.process.process
            self.assertEqual(validate_with_node(invalid, resources=resources), expected)
            self.assertEqual(validate_with_node(valid, resources=resources), [])
            self.assertIs(resources.process.process, process)
        self.assertIsNotNone(process.poll())

    def test_session_retains_schema_and_temporal_refusals(self):
        page = load('packages/page/fixtures/contract-valid/time-point-no-future.json')
        variants = [replace(self.resources, sha256='0' * 64), replace(self.resources, schema_version='0.0'), replace(self.resources, evaluation=None),
                    replace(self.resources, evaluation={'instant': 'invalid', 'timeZone': 'UTC'})]
        for original in variants:
            expected = validate_with_node(page, resources=original)
            with compose_validation_session(original) as resources:
                self.assertEqual(validate_with_node(page, resources=resources), expected)

    def test_session_rechecks_program_bytes_and_cleans_up_on_exception(self):
        page = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        program = self.root / 'tamper-check.mjs'
        original = self.program.read_bytes()
        program.write_bytes(original)
        supplied = replace(self.resources, program=program)
        with compose_validation_session(supplied) as resources:
            self.assertEqual(validate_with_node(page, resources=resources), [])
            process = resources.process.process
            program.write_bytes(original + b'\n')
            self.assertEqual([(i.type, i.path) for i in validate_with_node(page, resources=resources)], [('SCHEMA_ERROR', '/')])
            self.assertIsNotNone(process.poll())
            program.write_bytes(original)
            self.assertEqual(validate_with_node(page, resources=resources), [])
        with self.assertRaisesRegex(RuntimeError, 'cancelled'):
            with compose_validation_session(self.resources) as resources:
                self.assertEqual(validate_with_node(page, resources=resources), [])
                process = resources.process.process
                raise RuntimeError('cancelled')
        self.assertIsNotNone(process.poll())

    def test_session_transport_failure_and_timeout_fail_closed_and_reap_process(self):
        page = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        for index, body in enumerate(("process.exit(3);", "process.stdin.on('data',()=>process.stdout.write('invalid\\n'));",
                                      "process.stdin.resume();",
                                      "process.stdin.on('data',()=>process.stdout.write(JSON.stringify({sequence:0,returncode:0,receipt:{}})+'\\n'));")):
            program = self.root / f'failure-{index}.mjs'
            program.write_text(body)
            supplied = replace(self.resources, program=program, sha256=hashlib.sha256(program.read_bytes()).hexdigest())
            processes = []
            real_popen = subprocess.Popen

            def start(*args, **kwargs):
                process = real_popen(*args, **kwargs)
                processes.append(process)
                return process

            with patch.object(subprocess, 'Popen', side_effect=start):
                with compose_validation_session(supplied) as resources:
                    with patch.object(resources.process, 'request', partial(resources.process.request, timeout=0.1)):
                        issues = validate_with_node(page, resources=resources)
            self.assertEqual([(i.type, i.path) for i in issues], [('SCHEMA_ERROR', '/')])
            self.assertTrue(processes)
            self.assertTrue(all(process.poll() is not None for process in processes))

    def test_session_timeout_also_bounds_writing_to_a_process_not_reading_stdin(self):
        page = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        page['unread'] = 'x' * 1_000_000
        program = self.root / 'not-reading.mjs'
        program.write_text('setInterval(()=>{},1000);')
        supplied = replace(self.resources, program=program, sha256=hashlib.sha256(program.read_bytes()).hexdigest())
        with compose_validation_session(supplied) as resources:
            with patch.object(resources.process, 'request', partial(resources.process.request, timeout=0.1)):
                issues = validate_with_node(page, resources=resources)
            self.assertIsNone(resources.process.process)
        self.assertEqual([(i.type, i.path) for i in issues], [('SCHEMA_ERROR', '/')])

    def test_concurrent_sessions_do_not_share_processes_or_receipts(self):
        page = load('packages/page/fixtures/contract-valid/grouped-params-page.json')

        def validate(index):
            document = deepcopy(page)
            if index:
                document['id'] = 7
            with compose_validation_session(self.resources) as resources:
                first = validate_with_node(document, resources=resources)
                second = validate_with_node(document, resources=resources)
                process = resources.process.process
                self.assertEqual(first, second)
            self.assertIsNotNone(process.poll())
            return process.pid, first

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(validate, (0, 1)))
        self.assertNotEqual(results[0][0], results[1][0])
        self.assertEqual(results[0][1], [])
        self.assertTrue(results[1][1])

    def test_resource_hash_and_schema_mismatch_refuse_without_fallback(self):
        page = load('packages/page/fixtures/contract-valid/grouped-params-page.json')
        for resources in (NodeValidationResources(self.program, '0' * 64, self.version),
                          NodeValidationResources(self.program, self.resources.sha256, '0.0')):
            issues = validate_with_node(page, resources=resources)
            self.assertEqual([(item.type, item.path) for item in issues], [('SCHEMA_ERROR', '/')])

    def test_parameter_request_result_seams_use_explicit_values_and_preserve_originals(self):
        vector = load('metriccanvas-authoring/contract-snapshot/page/conformance/parameter-extraction.json')
        before = deepcopy(vector)
        with patch('metriccanvas_authoring.pages.validation.page_validation.bundle_root', side_effect=AssertionError('Bundle lookup forbidden')):
            request = prepare_parameter_request(vector['input'], vector['context'], vector['selectedIds'], schema=self.schema, node_resources=self.resources)
            receipt = self.run_program('page.parameters', request)
            accepted = accept_parameter_result(vector['input'], vector['context'], receipt['data'], vector['selectedIds'], schema=self.schema, node_resources=self.resources)
        self.assertEqual(accepted['artifact']['document'], vector['template'])
        self.assertNotIn('originalValues', accepted['relay_summary'])
        self.assertEqual(vector, before)
        stale = deepcopy(receipt['data'])
        stale['sourceKey'] = '{}'
        with self.assertRaisesRegex(ValueError, 'PROGRAM_RESULT_MISMATCH'):
            accept_parameter_result(vector['input'], vector['context'], stale, vector['selectedIds'], schema=self.schema, node_resources=self.resources)

    def test_temporal_context_refusals_keep_their_dedicated_codes(self):
        page = load('packages/page/fixtures/contract-valid/time-point-no-future.json')
        resources = NodeValidationResources(self.program, self.resources.sha256, self.version)
        issues = validate_with_node(page, resources=resources)
        self.assertEqual([issue.type for issue in issues], ['EVALUATION_CONTEXT_REQUIRED'])
        bad = NodeValidationResources(self.program, self.resources.sha256, self.version, {'instant': 'invalid', 'timeZone': 'UTC'})
        self.assertEqual([issue.type for issue in validate_with_node(page, resources=bad)], ['INVALID_EVALUATION_CONTEXT'])

    def test_failed_parameter_diagnostics_are_copied_without_execution(self):
        result = {'ok': False, 'issues': [{'code': 'INVALID_PAGE', 'path': '/sections', 'message': 'first'},
                                          {'code': 'MISSING_INPUT', 'path': '/params', 'message': 'second'}]}
        accepted = accept_parameter_result({}, {}, result)
        self.assertEqual(accepted, result)
        accepted['issues'][0]['message'] = 'changed'
        self.assertEqual(result['issues'][0]['message'], 'first')


if __name__ == '__main__':
    unittest.main()

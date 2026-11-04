"""Exercise explicit product resources from a cwd without a checkout or Bundle."""
from copy import deepcopy
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
from metriccanvas_authoring.pages.validation.node_validator import NodeValidationResources, validate_with_node
from metriccanvas_authoring.pages.parameters.parameter_preparation import prepare_parameter_request, accept_parameter_result


def load(relative):
    return json.loads((ROOT / relative).read_text())


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

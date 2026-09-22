import asyncio
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/tool'))
from metriccanvas_authoring.pages.parameters.parameter_preparation import prepare_page_parameters


class NodeProgram:
    async def prepare(self, request):
        child = await asyncio.create_subprocess_exec('node', '--import', 'tsx',
            'packages/page/examples/parameter-program.ts', cwd=ROOT,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await child.communicate(json.dumps(request).encode())
        if child.returncode: raise RuntimeError(err.decode())
        return json.loads(out)


class ParameterPreparationTest(unittest.IsolatedAsyncioTestCase):
    async def test_tokens_selected_template_and_resolution_use_real_ts_program(self):
        source = json.loads((ROOT / 'packages/page/fixtures/parameter-extraction/tokens-parameter-source.json').read_text())
        context = {'baseline': 'tokens-r1', 'dimensionIdentities': {key: {'区域': 'region'} for key in source['dataSources']}}
        result = await prepare_page_parameters(source, context, NodeProgram())
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['relay_summary']['selectedIds'], ['region', 'report-period'])
        artifact = result['artifact']
        resolved = await NodeProgram().prepare({'action': 'resolve', 'document': artifact['document'], 'suppliedValues': artifact['originalValues']})
        self.assertTrue(resolved['ok'], resolved)
        for key, ds in source['dataSources'].items():
            self.assertEqual(resolved['resolvedPage']['dataSources'][key]['source']['query']['body'], ds['source']['query']['body'])
        self.assertNotIn('originalValues', result['relay_summary'])

    async def test_generated_shared_extraction_vector(self):
        vector = json.loads((ROOT / 'metriccanvas-authoring/contract-snapshot/page/conformance/parameter-extraction.json').read_text())
        result = await prepare_page_parameters(vector['input'], vector['context'], NodeProgram(), vector['selectedIds'])
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['artifact']['document'], vector['template'])
        self.assertEqual(result['artifact']['candidates'], vector['candidates'])
        resolved = await NodeProgram().prepare({'action': 'resolve', 'document': vector['template'], 'suppliedValues': vector['originalValues']})
        self.assertEqual(resolved['document'], vector['filled'])
        self.assertEqual(resolved['resolvedPage'], vector['execution'])

    async def test_full_document_flows_between_real_programs_not_through_relay_summary(self):
        source = json.loads((ROOT / 'packages/page/fixtures/contract-valid/query-dashboard.json').read_text())
        result = await prepare_page_parameters(source, {'baseline': 'verified-local-fixture'}, NodeProgram(), [])
        self.assertTrue(result['ok'], result)
        self.assertIn('document', result['artifact'])
        self.assertNotIn('document', result['relay_summary'])
        self.assertTrue(result['relay_summary']['requiresHumanConfirmation'])

    async def test_stale_program_baseline_is_rejected(self):
        source = json.loads((ROOT / 'packages/page/fixtures/contract-valid/query-dashboard.json').read_text())
        class BadProgram:
            async def prepare(self, request): return {'ok': True, 'baseline': 'stale', 'document': source}
        with self.assertRaisesRegex(ValueError, 'PROGRAM_RESULT_MISMATCH'):
            await prepare_page_parameters(source, {'baseline': 'current'}, BadProgram())

    async def test_grouped_resolution_preserves_shape_and_summary_never_contains_values(self):
        from copy import deepcopy
        from metriccanvas_authoring.pages.parameters.page_parameters import parameter_summary
        from metriccanvas_authoring.pages.validation.grouped_params import clear_values
        source = json.loads((ROOT / 'packages/page/fixtures/contract-valid/grouped-params-page.json').read_text())
        template = deepcopy(source)
        clear_values(template)
        summary = parameter_summary(template)
        self.assertEqual([p['id'] for p in summary], ['region', 'report-period', 'report-month'])
        self.assertTrue(all(not p['hasValue'] for p in summary))
        values = {'region': ['欧洲地区部'], 'report-period': {'start': '2026-07', 'end': '2026-09'},
                  'report-month': {'start': '2026-09', 'end': '2026-09'}}
        result = await NodeProgram().prepare({'action': 'resolve', 'document': template, 'suppliedValues': values})
        self.assertTrue(result['ok'], result)
        self.assertIsInstance(result['document']['params'], dict)
        self.assertTrue(all(p['hasValue'] for p in parameter_summary(result['document'])))
        self.assertNotIn('欧洲地区部', json.dumps(parameter_summary(result['document']), ensure_ascii=False))
        stripped = deepcopy(result['document'])
        clear_values(stripped)
        self.assertEqual(stripped, template)
        self.assertEqual(result['resolvedPage']['dataSources']['current']['source']['query']['body']['dsl_list'][0]['filter']['time']['start'], '2026-07')

import asyncio
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/tool'))
from metriccanvas_authoring.application.parameter_preparation import prepare_page_parameters


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

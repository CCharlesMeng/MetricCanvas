"""Creation and adjustment through stdio and real HTTP adapters."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'model-evals'))


class PlatformMainFlowTest(unittest.IsolatedAsyncioTestCase):
    async def test_create_then_adjust_saved_page_through_stdio_http(self):
        from run_platform_v2 import run
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'evidence'
            report = await run(output, scripted=True)
            self.assertTrue(report['passed'], report)
            self.assertEqual([c['id'] for c in report['cases']], [
                'create-report', 'create-dashboard', 'edit-report', 'edit-dashboard', 'edit-add-data'])
            self.assertEqual(report['modelCalls'], 0)
            exchanges = [json.loads(line) for line in (output/'http.jsonl').read_text().splitlines()]
            self.assertTrue(any(e['path'].endswith('/query-dataset-from-lab') for e in exchanges))
            self.assertTrue(any(e['path'].endswith('/dsl/execute') for e in exchanges))
            fixture = json.loads((Path(__file__).resolve().parents[1]/'fixtures/platform-main-flow.json').read_text())
            dqe_bodies = [e['body'] for e in exchanges if e['path'].endswith('/dsl/execute')]
            self.assertIn(fixture['query'], dqe_bodies)
            self.assertIn(fixture['supplementQuery'], dqe_bodies)
            self.assertEqual([e['method'] for e in exchanges if e.get('saved')], ['POST', 'POST', 'PUT', 'PUT', 'PUT'])
            before = json.loads((output/'create-report/artifact.json').read_text())['document']
            after = json.loads((output/'edit-report/artifact.json').read_text())['document']
            before['sections'][0]['components'][0]['props']['title'] = '2026年8月区域运营复盘'
            self.assertEqual(before, after)
            added = json.loads((output/'edit-add-data/artifact.json').read_text())['document']
            self.assertEqual(set(added['dataSources']) - set(after['dataSources']), {'supplement'})
            self.assertTrue(any(component.get('props', {}).get('title') == '华东区域请求量补充明细'
                for section in added['sections'] for component in section['components']))

    async def test_http_fixture_rejects_an_unlisted_dqe_query(self):
        from main_flow_http import DQE_PATH, serve_main_flow
        fixture_path = Path(__file__).resolve().parents[1] / 'fixtures/platform-main-flow.json'
        with tempfile.TemporaryDirectory() as directory:
            with serve_main_flow(fixture_path, Path(directory)/'http.jsonl') as (_, base_url):
                query = json.loads(fixture_path.read_text())['query']
                query['dsl_list'][0]['filter']['time']['start'] = '2026-07'
                async with httpx.AsyncClient(trust_env=False) as client:
                    response = await client.post(base_url.removesuffix('/rest/cdi/cdinl2databuilderservice/v1') + DQE_PATH,
                        json=query, headers={'X-Auth-Token':'test-only', 'X-Operator-Id':'alice', 'X-Workspace-Id':'w'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['results'][0]['code'], 'NO_MATCH')

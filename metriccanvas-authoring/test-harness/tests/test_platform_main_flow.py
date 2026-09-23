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
                'create-report', 'create-dashboard', 'create-complex-report',
                'edit-report', 'edit-dashboard', 'edit-add-data'])
            self.assertEqual(report['modelCalls'], 0)
            exchanges = [json.loads(line) for line in (output/'http.jsonl').read_text().splitlines()]
            self.assertTrue(any(e['path'].endswith('/query-dataset-from-lab') for e in exchanges))
            self.assertTrue(any(e['path'].endswith('/dsl/execute') for e in exchanges))
            fixture = json.loads((Path(__file__).resolve().parents[1]/'fixtures/platform-main-flow.json').read_text())
            dqe_bodies = [e['body'] for e in exchanges if e['path'].endswith('/dsl/execute')]
            self.assertIn(fixture['query'], dqe_bodies)
            self.assertIn(fixture['supplementQuery'], dqe_bodies)
            for query in fixture['complexQueries'].values():
                self.assertIn(query, dqe_bodies)
            self.assertEqual([e['method'] for e in exchanges if e.get('saved')], ['POST', 'POST', 'POST', 'PUT', 'PUT', 'PUT'])
            complex_page = json.loads((output/'create-complex-report/document.json').read_text())
            self.assertGreaterEqual(len(complex_page['sections']), 4)
            self.assertFalse(any(section['id'] != 'header' and all(component['type'] == 'text'
                             for component in section['components'] if not component['id'].startswith('structure-'))
                             for section in complex_page['sections']))
            self.assertEqual(set(complex_page['dataSources']), set(fixture['complexQueries']))
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

    async def test_http_fixture_returns_batched_dqe_results_in_request_order(self):
        from main_flow_http import DQE_PATH, serve_main_flow
        fixture_path = Path(__file__).resolve().parents[1] / 'fixtures/platform-main-flow.json'
        fixture = json.loads(fixture_path.read_text())
        units = [fixture['complexQueries'][source]['dsl_list'][0]
                 for source in ('model', 'summary', 'region', 'trend')]
        with tempfile.TemporaryDirectory() as directory:
            with serve_main_flow(fixture_path, Path(directory)/'http.jsonl') as (_, base_url):
                async with httpx.AsyncClient(trust_env=False) as client:
                    response = await client.post(base_url.removesuffix('/rest/cdi/cdinl2databuilderservice/v1') + DQE_PATH,
                        json={'dsl_list': units}, headers={'X-Auth-Token':'test-only',
                        'X-Operator-Id':'alice', 'X-Workspace-Id':'w'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual([item['data'] for item in response.json()['results']],
                             [fixture['complexRows'][source] for source in ('model', 'summary', 'region', 'trend')])

    async def test_complex_page_score_rejects_missing_analysis_view(self):
        from run_platform_v2 import _assess_complex_report, run
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'evidence'
            report = await run(output, scripted=True, case_ids=['create-complex-report'])
            self.assertTrue(report['passed'], report)
            fixture = json.loads((Path(__file__).resolve().parents[1]/'fixtures/platform-main-flow.json').read_text())
            suite = json.loads((Path(__file__).resolve().parents[1]/'model-evals/platform-authoring.cases.json').read_text())
            case = next(case for case in suite['cases'] if case['id'] == 'create-complex-report')
            artifact = json.loads((output/'create-complex-report/artifact.json').read_text())
            trajectory = json.loads((output/'create-complex-report/trajectory.json').read_text())
            for section in artifact['document']['sections']:
                section['components'] = [component for component in section['components'] if component['id'] != 'model-table']
            self.assertIn('COMPARISON_DETAIL_RELATION_MISSING:model',
                          _assess_complex_report(case, fixture, artifact, trajectory))

    async def test_complex_page_score_keeps_focus_in_region_and_accepts_header_provenance(self):
        from copy import deepcopy
        from run_platform_v2 import _assess_complex_report, run
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'evidence'
            report = await run(output, scripted=True, case_ids=['create-complex-report'])
            self.assertTrue(report['passed'], report)
            fixture = json.loads((Path(__file__).resolve().parents[1]/'fixtures/platform-main-flow.json').read_text())
            suite = json.loads((Path(__file__).resolve().parents[1]/'model-evals/platform-authoring.cases.json').read_text())
            case = next(case for case in suite['cases'] if case['id'] == 'create-complex-report')
            artifact = json.loads((output/'create-complex-report/artifact.json').read_text())
            trajectory = json.loads((output/'create-complex-report/trajectory.json').read_text())

            isolated = deepcopy(artifact)
            region = next(section for section in isolated['document']['sections'] if section['id'] == 'regional-analysis')
            note = next(component for component in region['components'] if component['id'] == 'east-note')
            region['components'].remove(note)
            isolated['document']['sections'].append({'id': 'east-focus', 'title': '华东重点观察', 'components': [note]})
            issues = _assess_complex_report(case, fixture, isolated, trajectory)
            self.assertIn('TEXT_ONLY_SECTION', issues)
            self.assertIn('EAST_FOCUS_NOT_IN_REGION', issues)

            badge = deepcopy(artifact)
            overview = next(section for section in badge['document']['sections'] if section['id'] == 'overview')
            overview['components'] = [component for component in overview['components'] if component['id'] != 'sample-note']
            header = next(component for section in badge['document']['sections'] for component in section['components']
                          if component['type'] == 'reportHeader')
            header['props']['badge'] = '本地样例·非生产'
            self.assertEqual(_assess_complex_report(case, fixture, badge, trajectory), [])

    async def test_complex_page_score_rejects_collapsed_chart_series(self):
        from run_platform_v2 import _assess_complex_report, run
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'evidence'
            report = await run(output, scripted=True, case_ids=['create-complex-report'])
            self.assertTrue(report['passed'], report)
            fixture = json.loads((Path(__file__).resolve().parents[1]/'fixtures/platform-main-flow.json').read_text())
            suite = json.loads((Path(__file__).resolve().parents[1]/'model-evals/platform-authoring.cases.json').read_text())
            case = next(case for case in suite['cases'] if case['id'] == 'create-complex-report')
            artifact = json.loads((output/'create-complex-report/artifact.json').read_text())
            trajectory = json.loads((output/'create-complex-report/trajectory.json').read_text())
            trend = next(component for section in artifact['document']['sections'] for component in section['components']
                         if component['id'] == 'monthly-trend')
            failure_field = next(field_id for field_id, field in artifact['document']['dataSources']['trend']['fields'].items()
                                 if field.get('queryField') == '失败请求量')
            trend['props']['series'].append({'field': failure_field, 'label': '失败请求量'})
            self.assertIn('CHART_SCALE_COLLAPSES_SERIES:monthly-trend',
                          _assess_complex_report(case, fixture, artifact, trajectory))
            note = next(component for section in artifact['document']['sections'] for component in section['components']
                        if component['id'] == 'sample-note')
            note['props']['body'] += '华东占比45%。'
            self.assertIn('UNAPPROVED_DERIVED_PERCENTAGE',
                          _assess_complex_report(case, fixture, artifact, trajectory))

import json
import tempfile
import unittest
from pathlib import Path
from metriccanvas_authoring.data.semantic_catalog import metric_card, SemanticCatalog
from metriccanvas_authoring.adapters.outbound.platform_state import SqlitePlatformState
from metriccanvas_authoring.application.content_ports import ContentBaselineError


class SemanticCatalogTest(unittest.IsolatedAsyncioTestCase):
    async def test_actual_model_keeps_derived_configuration_unknown_units_and_conflict(self):
        path = Path(__file__).resolve().parents[3] / '调查报告/数据/语义层查询结果.json'
        if not path.exists(): self.skipTest('repository evidence is not in standalone bundle')
        model = json.loads(path.read_text())
        cards = [metric_card(model, m) for m in model['logical_schema']['field_schema']['metrics']]
        self.assertEqual(sum(c['executionDefinition'] == 'calculate_conf' for c in cards), 14)
        self.assertTrue(all(c['unit']['status'] == 'unknown' for c in cards))
        self.assertTrue(any(c['conflicts'] for c in cards))
        self.assertNotIn('sql_text', json.dumps(cards))
        self.assertNotIn('formula', json.dumps(cards[0].get('source', {})))

    async def test_unmatched_detail_cannot_fill_units_and_missing_is_cached(self):
        model = {'id': 'model-a', 'workspace_id': 'w', 'logical_schema': {'field_schema': {'metrics': [{'id': 'metric-a', 'name': 'Tokens', 'unit': None}]}}}
        class Provider:
            calls = 0
            async def search(self, binding, query, limit): return {'dataContextVersion': '1', 'models': [model]}
            async def detail(self, binding, source):
                self.calls += 1
                return {'source': {**source, 'metricId': 'opportunities'}, 'unit': '万元'}
        with tempfile.TemporaryDirectory() as tmp:
            provider = Provider(); catalog = SemanticCatalog(provider, SqlitePlatformState(Path(tmp)/'state.db'))
            first = await catalog.discover({'actorId':'a'}, 'Tokens', 5, [])
            ref = first['matches'][0]['metricRef']
            details = await catalog.discover({'actorId':'a'}, 'Tokens', 5, [ref])
            self.assertEqual(details['details'][0]['status'], 'unknown')
            await catalog.discover({'actorId':'a'}, 'Tokens', 5, [ref])
            self.assertEqual(provider.calls, 1)
            with self.assertRaisesRegex(ContentBaselineError, 'METRIC_DETAIL_IDENTITY_REQUIRED'):
                await catalog.discover({'actorId':'b'}, 'unmatched', 5, [ref])

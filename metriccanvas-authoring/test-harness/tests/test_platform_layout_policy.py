import json
import unittest
from copy import deepcopy
from pathlib import Path
from test_page_editing import page, edit, title
from metriccanvas_authoring.domain.layout_policy import apply_creation_layout
from metriccanvas_authoring.domain.page_validation import validate_page_document

ROOT = Path(__file__).resolve().parents[3]

class PlatformLayoutPolicyTest(unittest.TestCase):
    def test_creation_defaults_separate_header_and_keep_all_content(self):
        original = page()
        report = apply_creation_layout(original, 'report')
        self.assertEqual(report, original)
        dashboard = apply_creation_layout(original, 'dashboard')
        self.assertEqual(validate_page_document(dashboard), [])
        self.assertEqual(dashboard['sections'][0]['container'], 'plain')
        self.assertNotIn('container', dashboard['sections'][1])
        self.assertEqual([c for s in dashboard['sections'] for c in s['components']], original['sections'][0]['components'])
        self.assertEqual(dashboard['dataSources'], original['dataSources'])
        self.assertEqual(original, page())

    def test_creation_group_title_and_distinct_component_title_survive(self):
        baseline = page();baseline['sections'][0]['title'] = '集团口径'
        created = apply_creation_layout(baseline, 'dashboard')
        self.assertEqual(created['sections'][1]['container'], 'panel')
        self.assertEqual(created['sections'][1]['title'], '集团口径')
        self.assertEqual(created['sections'][1]['components'][0]['props']['title'], 'Chart')
        self.assertEqual(validate_page_document(created), [])
        cards = deepcopy(baseline)
        cards['sections'][0]['components'] = [cards['sections'][0]['components'][3]]
        self.assertEqual(apply_creation_layout(cards, 'dashboard')['sections'][0]['container'], 'card')
        single = deepcopy(baseline);single['sections'][0]['components'] = [single['sections'][0]['components'][1]]
        single['sections'][0]['title'] = 'Chart'
        result = apply_creation_layout(single, 'dashboard')
        self.assertNotIn('title', result['sections'][0])
        self.assertNotIn('container', result['sections'][0])
        self.assertEqual(result['sections'][0]['components'][0]['props']['title'], 'Chart')

    def test_switch_roundtrip_keeps_panel_and_manual_settings_and_noop_has_no_artifact(self):
        original = page();original['sections'][0]['title'] = '手工分区标题'
        changed = edit(original, {'id':'switch','type':'set_page_layout','layout':'dashboard'})
        self.assertEqual(changed['document'], dict(original, layout='dashboard'))
        self.assertTrue(any('分区标题' in s for s in changed['operations'][0]['adjustments']))
        restored = edit(changed['document'], {'id':'back','type':'set_page_layout','layout':'report'})
        self.assertEqual(restored['document'], original)
        noop = edit(original, {'id':'noop','type':'set_page_layout','layout':'report'})
        self.assertIsNone(noop['document']);self.assertEqual(noop['operations'][0]['adjustments'], [])

    def test_backdrop_tracks_and_toolbar_are_preserved_across_legal_forms(self):
        original = json.loads((ROOT/'packages/page/fixtures/contract-valid/composite-page.json').read_text())
        original['schemaVersion'] = '6.2';original['dashboardToolbar'] = 'hidden'
        original['layout'] = 'dashboard'
        changed = edit(original, {'id':'switch','type':'set_page_layout','layout':'report'})
        self.assertEqual(changed['document'], dict(original, layout='report'))
        self.assertTrue(any('铺底' in s for s in changed['operations'][0]['adjustments']))
        self.assertEqual(validate_page_document(changed['document']), [])
        back = edit(changed['document'], {'id':'back','type':'set_page_layout','layout':'dashboard'})
        self.assertEqual(back['document'], original)

    def test_invalid_target_rolls_back_but_independent_edit_survives(self):
        original = page()
        changed = edit(original, {'id':'bad','type':'set_page_layout','layout':'poster'}, title())
        self.assertEqual(changed['status'], 'partial')
        expected = deepcopy(original);expected['sections'][0]['components'][0]['props']['title'] = 'Changed'
        self.assertEqual(changed['document'], expected)

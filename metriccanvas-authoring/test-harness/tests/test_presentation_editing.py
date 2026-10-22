import json
import unittest
from pathlib import Path
from metriccanvas_authoring.pages.editing.page_editing import edit_page_document
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document

ROOT = Path(__file__).resolve().parents[3]


class PresentationEditingTests(unittest.TestCase):
    def page(self):
        return json.loads((ROOT / 'pages/capabilities/filters/page-visibility-region-linkage.json').read_text())

    def test_same_product_edit_and_hidden_target(self):
        page = self.page()
        result = edit_page_document(page, {'operations': [{'id': 'rule', 'type': 'set_presentation_condition',
            'target': {'kind': 'section', 'id': 'department-norms'}, 'field': 'visibleWhen', 'condition': {'permission': 'read'}}]})
        self.assertEqual(result['status'], 'changed', result)
        self.assertEqual(validate_page_document(result['document']), [])
        self.assertEqual(result['document']['dataSources'], page['dataSources'])

    def test_illegal_row_context_rolls_back(self):
        result = edit_page_document(self.page(), {'operations': [{'id': 'rule', 'type': 'set_presentation_condition',
            'target': {'kind': 'section', 'id': 'department-norms'}, 'field': 'visibleWhen',
            'condition': {'row': 'kind', 'op': 'eq', 'value': 'department'}}]})
        self.assertEqual(result['status'], 'failed', result)
        self.assertIsNone(result['document'])

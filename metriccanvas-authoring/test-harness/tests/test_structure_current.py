"""Current shared structure rules; public behavior is covered by test_result_relations."""
import unittest
from authoring_fixtures import plan
from metriccanvas_authoring.pages.composition.page_structure import validate_plan, StructureError
from metriccanvas_authoring.pages.components.structure_presentation import capabilities
from metriccanvas_authoring.pages.components.structure_presentation import apply_presentation


class CurrentStructureTest(unittest.TestCase):
    def test_record_list_compiles_table_toolbar(self):
        toolbar = {'search': {'fields': ['customer'], 'placeholder': '搜索客户'}, 'export': {'format': 'xlsx'}}
        component = {'type': 'table', 'props': {'columns': [{'field': 'customer'}]}}
        source = {'fields': {'customer': {'type': 'string', 'role': 'dimension', 'queryField': '客户'}}}
        result = apply_presentation({'presentation': {'kind': 'record-list', 'toolbar': toolbar}}, source, component)
        self.assertEqual(result['props']['toolbar'], toolbar)
        result['props']['toolbar']['search']['fields'].append('other')
        self.assertEqual(toolbar['search']['fields'], ['customer'])

    def test_only_current_plan_version_is_accepted(self):
        self.assertEqual(capabilities()['versions'], ['3'])
        validate_plan(plan())
        for version in ('1', '2', None, '4'):
            with self.subTest(version=version):
                value = plan(); value['version'] = version
                with self.assertRaises(StructureError) as raised:
                    validate_plan(value)
                self.assertEqual(raised.exception.code, 'STRUCTURE_PLAN_INVALID')

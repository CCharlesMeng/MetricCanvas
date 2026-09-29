"""Numeric display policy preserves business values and explicit provider intent."""
from copy import deepcopy
from dataclasses import replace
import unittest

from test_source_mapping import fixture
from metriccanvas_authoring.data.data_context import parse_data_context
from metriccanvas_authoring.data.executable_units import derive_executable_units
from metriccanvas_authoring.data.execution import DqeExecutionResult
from metriccanvas_authoring.data.field_presentation import apply_field_presentation


class FieldPresentationTest(unittest.TestCase):
    def setUp(self):
        context, issues = parse_data_context(fixture('data-context.json'))
        self.assertFalse(issues)
        self.unit = derive_executable_units(fixture('page-build-spec.json'), context)[0]

    def present(self, values, **field):
        definition = {'queryField': 'amount', 'type': 'number', 'role': 'measure', **field}
        unit = replace(self.unit, fields={'amount': definition})
        rows = [{'amount': value} for value in values]
        before = deepcopy(rows)
        result = apply_field_presentation(unit, DqeExecutionResult(rows=rows, total_count=len(rows)))
        self.assertEqual(rows, before)
        self.assertEqual(unit.fields, {'amount': definition})
        self.assertEqual(result.query_body, unit.query_body)
        return result.fields['amount'].get('defaultFormat')

    def test_cny_uses_unit_not_caption(self):
        self.assertEqual(self.present([11030729.634, 29729963.323], unit='人民币元'), 'cny-adaptive')
        self.assertEqual(self.present([11030729.634], label='Tokens流水'), 'compact-wan-1')
        self.assertEqual(self.present([11030729.634], unit='美元'), 'compact-wan-1')

    def test_quantities_support_both_scales(self):
        self.assertEqual(self.present([11358989639011.566, 23518208780053.55], unit='Tokens'), 'compact-yi-1')
        self.assertEqual(self.present([0, -20000, 30000], unit='次'), 'compact-wan-1')

    def test_smallest_nonzero_protects_small_values(self):
        self.assertEqual(self.present([0, 0.0001, 1e13]), None)
        self.assertEqual(self.present([0, -10000, 1e13]), 'compact-wan-1')
        self.assertEqual(self.present([0.01, 1e8], unit='元'), None)
        self.assertEqual(self.present([0.0001, 10], unit='%'), None)

    def test_existing_scales_and_empty_values(self):
        for unit in ('万元', '亿元', '百万美元', '千次'):
            self.assertEqual(self.present([1e8], unit=unit), None)
        self.assertEqual(self.present([]), None)
        self.assertEqual(self.present([None, 0]), None)
        self.assertEqual(self.present([12.5], unit='%'), 'percent-2')

    def test_explicit_format_always_wins(self):
        self.assertEqual(self.present([1e13], defaultFormat='number-2'), 'number-2')

    def test_unknown_descriptor_scale_not_compacted(self):
        unit = replace(self.unit, fields={'a': {'queryField':'a','role':'measure','type':'number'}})
        result = apply_field_presentation(unit, DqeExecutionResult(rows=[{'a':1e13}], total_count=1),
                                         {'fields':[{'queryField':'a','scale':'unknown'}]})
        self.assertEqual(result.fields['a'].get('defaultFormat'), None)

    def test_dimension_and_text_unchanged(self):
        fields = {'id':{'queryField':'id','role':'dimension','type':'number'},
                  'text':{'queryField':'text','role':'measure','type':'string'}}
        result = apply_field_presentation(replace(self.unit, fields=fields),
                                         DqeExecutionResult(rows=[{'id':1e13,'text':'100000'}]))
        self.assertEqual(result.fields, fields)

    def test_partial_rows_do_not_choose_a_scale_for_unseen_values(self):
        unit = replace(self.unit, fields={'a': {'queryField':'a','role':'measure','type':'number'}})
        for total in (None, 2):
            result = apply_field_presentation(unit, DqeExecutionResult(rows=[{'a':1e13}], total_count=total))
            self.assertNotIn('defaultFormat', result.fields['a'])

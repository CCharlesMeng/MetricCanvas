"""New authoring profile with legacy output preserved, using synthetic units only."""
from copy import deepcopy
from dataclasses import replace
import unittest
from test_source_mapping import fixture
from metriccanvas_authoring.data.query import prepare_query_data
from metriccanvas_authoring.data.execution import DqeExecutionResult
from metriccanvas_authoring.data.field_presentation import apply_field_presentation


class AuthoringFormatTest(unittest.TestCase):
    def setUp(self):
        self.unit=prepare_query_data(fixture('page-build-spec.json'),fixture('data-context.json')).units[0]

    def present(self, values, total, unit='Tokens', fmt=None, descriptor=None, profile='authoring'):
        field={'queryField':'amount','type':'number','role':'measure','unit':unit}
        if fmt:field['defaultFormat']=fmt
        source=replace(self.unit,fields={'amount':field});execution=DqeExecutionResult([{'amount':v} for v in values],total)
        before=deepcopy((source,execution,descriptor));warnings=[]
        result=apply_field_presentation(source,execution,{'fields':[descriptor]} if descriptor else None,warnings=warnings,profile=profile)
        self.assertEqual((source,execution,descriptor),before)
        self.assertEqual(replace(result,fields=source.fields),source)
        return result.fields['amount']['defaultFormat'],warnings

    def test_complete_partial_unknown_and_legacy_are_separate(self):
        self.assertEqual(self.present([1e12],1)[0],'compact-million-1')
        self.assertEqual(self.present([1e12],2)[0],'number')
        self.assertEqual(self.present([1e12],None)[0],'number')
        self.assertEqual(self.present([1e12],1,profile='legacy')[0],'compact-yi-1')

    def test_tiny_nonzero_empty_zero_negative_and_boundary(self):
        for values,expected in [([1,1e12],'number'),([], 'number'),([0], 'number'),([-2e6], 'compact-million-1'),
                                ([50000],'number'),([50001],'compact-million-1')]:
            self.assertEqual(self.present(values,len(values))[0],expected)

    def test_scaled_unknown_and_fraction_values_are_never_scaled_again(self):
        self.assertEqual(self.present([1e12],1,unit='百万Tokens')[0],'number')
        for scale in ('unknown','fraction','currency-wan'):
            descriptor={'queryField':'amount','scale':scale}
            self.assertEqual(self.present([1e12],1,descriptor=descriptor)[0],'number')

    def test_money_and_other_counts_keep_existing_scale_choices(self):
        self.assertEqual(self.present([1e12],1,unit='元')[0],'compact-yi-1')
        self.assertEqual(self.present([2e4],1,unit='次')[0],'compact-wan-1')
        self.assertEqual(self.present([1e12],1,unit='')[0],'compact-yi-1')

    def test_explicit_and_provider_intent_are_not_conflated(self):
        self.assertEqual(self.present([1e12],1,fmt='number-2')[0],'number-2')
        self.assertEqual(self.present([1e12],None,fmt='compact-million-2')[0],'compact-million-2')
        self.assertEqual(self.present([1e12],1,unit='元',fmt='compact-million-1')[0],'compact-million-1')
        fmt,warnings=self.present([1e12],1,unit='元',fmt='compact-million-1',
            descriptor={'queryField':'amount','scale':'currency-base','defaultFormat':'compact-million-1'})
        self.assertEqual(fmt,'compact-yi-1');self.assertEqual(warnings[0]['code'],'PRESENTATION_FORMAT_ADJUSTED')

    def test_partial_percent_and_small_values_keep_semantics(self):
        fmt,warnings=self.present([0.0001],None,unit='%')
        self.assertEqual(fmt,'percent-2');self.assertEqual(warnings[0]['code'],'PRESENTATION_PRECISION_LIMIT')

    def test_shared_product_policy_boundary_vectors(self):
        import json
        from pathlib import Path
        vectors=json.loads((Path(__file__).resolve().parents[2]/'core/presentation/conformance.json').read_text())
        for vector in vectors:
            fmt,_=self.present(vector['rows'],vector['totalCount'],unit=vector['unit'],fmt=vector.get('explicitFormat'))
            self.assertEqual(fmt,vector['expectedFormat'])

    def test_provider_adaptive_formats_do_not_rescale_pre_scaled_currency(self):
        fmt,warnings=self.present([1e12],1,unit='万元',fmt='cny-adaptive',
            descriptor={'queryField':'amount','scale':'currency-base','defaultFormat':'cny-adaptive'})
        self.assertEqual(fmt,'number');self.assertEqual(warnings[0]['code'],'PRESENTATION_FORMAT_ADJUSTED')

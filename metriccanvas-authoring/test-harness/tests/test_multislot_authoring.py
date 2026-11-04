"""Actual controlled multislot candidates with complete explicit synthetic evidence."""
from copy import deepcopy
import unittest
from metriccanvas_authoring.pages.multislot_operations import invoke
from metriccanvas_authoring.pages.product_operations import invoke as legacy

PERIOD = {'start': '2026-01', 'end': '2026-01', 'granularity': 'month'}


def record(rows, total=None):
    fields = {'region': {'queryField': 'region', 'type': 'string', 'role': 'dimension', 'nullable': False},
              'amount': {'queryField': 'amount', 'type': 'number', 'role': 'measure', 'nullable': False}}
    return {'source': {'fields': fields, 'source': {'type': 'query', 'resultScope': 'complete',
        'query': {'language': 'dqe', 'body': {'dsl_list': [{'output_dims': ['region'], 'output_metrics': ['amount']}]},},
        'initial': {'capturedAt': '2026-02-01T00:00:00Z', 'rows': rows, 'totalCount': len(rows)}}},
        'rows': rows, 'totalCount': len(rows) if total is None else total, 'request': {'time': deepcopy(PERIOD)}}


def request():
    records = {'current': record([{'region': 'a', 'amount': 2}, {'region': 'b', 'amount': 3}]),
               'prior': record([{'region': 'b', 'amount': 1}, {'region': 'c', 'amount': 4}])}
    block = {'id': 'comparison', 'type': 'data', 'component': 'table', 'source': 'current',
        'fields': ['region', 'amount'], 'title': '期间对比', 'purpose': 'reconciliation', 'rowKey': 'region',
        'tableSlots': {'prior': {'source': 'prior', 'fields': ['amount']}},
        'periods': {'main': deepcopy(PERIOD), 'prior': deepcopy(PERIOD)}, 'pagination': {'mode': 'local', 'pageSize': 5}}
    return {'pageId': 'multislot-test', 'request': {'title': '显式合成证据', 'layout': 'dashboard',
        'sources': {'current': 'current-ref', 'prior': 'prior-ref'},
        'sections': [{'id': 'main', 'pattern': 'custom', 'blocks': [block]}]}, 'resultRecords': records}


def block(value):
    return value['request']['sections'][0]['blocks'][0]


class MultislotAuthoringTest(unittest.TestCase):
    def test_native_supported_shape_was_rejected_by_controlled_input(self):
        result = legacy('page.compose', request())
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['data']['operations'][0]['issues'][0]['code'], 'STRUCTURE_BLOCK_INVALID')

    def test_complete_missing_and_extra_keys_do_not_join_or_change_rows(self):
        value = request(); before = deepcopy(value)
        result = invoke('page.compose.v2', value)
        self.assertEqual(result['status'], 'ok', result['diagnostics'])
        component = result['data']['document']['sections'][1]['components'][0]
        self.assertEqual(component['data'], {'main': 'current', 'prior': 'prior'})
        self.assertEqual(component['props']['rowKey'], 'region')
        self.assertEqual(component['props']['columns'][-1]['field'], {'data': 'prior', 'field': 'amount'})
        self.assertEqual(value, before)
        coverage = result['data']['operations'][0]['adjustments'][0]['slots'][1]
        self.assertEqual((coverage['missingKeys'], coverage['extraKeys']), (1, 1))
        self.assertEqual(result['data']['document']['dataSources']['prior'], value['resultRecords']['prior']['source'])

    def test_empty_auxiliary_is_complete_and_preserves_main(self):
        value = request();value['resultRecords']['prior'] = record([])
        result = invoke('page.compose.v2', value)
        self.assertEqual(result['status'], 'ok', result['diagnostics'])
        self.assertEqual(result['data']['operations'][0]['adjustments'][0]['slots'][1]['missingKeys'], 2)

    def test_duplicate_missing_and_wrong_type_keys_reject_only_table(self):
        for rows, code in [([{'region': 'a', 'amount': 1}, {'region': 'a', 'amount': 2}], 'TABLE_SLOT_KEY_DUPLICATE'),
                           ([{'amount': 1}], 'TABLE_SLOT_KEY_INVALID'),
                           ([{'region': 1, 'amount': 1}], 'TABLE_SLOT_KEY_INVALID')]:
            value=request();value['resultRecords']['prior']=record(rows)
            result=invoke('page.compose.v2',value)
            self.assertEqual(result['status'],'error')
            self.assertEqual(result['data']['operations'][0]['issues'][0]['code'],code)

    def test_unknown_incomplete_failed_and_wrong_period_evidence(self):
        for change, code in [('unknown','TABLE_SLOT_INCOMPLETE'),('failed','TABLE_SLOT_EVIDENCE_REQUIRED'),
                             ('period','TABLE_SLOT_PERIOD_MISMATCH')]:
            value=request();record_value=value['resultRecords']['prior']
            if change=='unknown':record_value['totalCount']=None
            if change=='failed':record_value['status']='failed'
            if change=='period':record_value['request']['time']['start']='2025-01'
            result=invoke('page.compose.v2',value)
            self.assertEqual(result['data']['operations'][0]['issues'][0]['code'],code)

    def test_partial_main_requires_verified_query_window(self):
        value=request();main=value['resultRecords']['current'];main['totalCount']=20
        result=invoke('page.compose.v2',value)
        self.assertEqual(result['data']['operations'][0]['issues'][0]['code'],'TABLE_SLOT_INCOMPLETE')
        block(value)['pagination']={'mode':'query'}
        main['source']['source'].pop('resultScope')
        main['source']['source']['initial']['totalCount']=20
        main['source']['source']['query']['body']['dsl_list'][0]['order']={'offset':0,'limit':2}
        result=invoke('page.compose.v2',value)
        self.assertEqual(result['status'],'ok',result['diagnostics'])

    def test_add_edit_is_atomic_and_reuses_same_builder(self):
        value=request();composed=invoke('page.compose.v2',value)
        baseline=deepcopy(composed['data']['document']);baseline['sections'][1]['components']=[{'id':'manual','type':'text','layout':{'span':12},'props':{'body':'保留原文'}}]
        operation={'id':'add','type':'add_multislot_table','sectionId':'main','block':block(value),
            'resultRefs':{'main':'current','prior':'prior'}}
        edited=invoke('page.edit.v2',{'baseline':baseline,'request':{'operations':[operation]},
            'resultRecords':value['resultRecords']})
        self.assertEqual(edited['status'],'ok',edited['diagnostics'])
        self.assertEqual(edited['data']['document']['sections'][1]['components'][1],composed['data']['document']['sections'][1]['components'][0])
        self.assertEqual(edited['data']['document']['sections'][1]['components'][0]['id'],'manual')

    def test_extend_existing_table_preserves_identity_manual_columns_and_layout(self):
        value=request();full=invoke('page.compose.v2',value)['data']['document']
        baseline=deepcopy(full);table=baseline['sections'][1]['components'][0]
        table['data'].pop('prior');table['props']['columns']=table['props']['columns'][:2]
        table['props']['columns'][1].update(title='人工标题',width=180);table['layout']['span']=6
        operation={'id':'extend','type':'extend_multislot_table','componentId':'comparison','block':block(value),
            'resultRefs':{'main':'current','prior':'prior'}}
        before=deepcopy(baseline)
        result=invoke('page.edit.v2',{'baseline':baseline,'request':{'operations':[operation]},'resultRecords':value['resultRecords']})
        self.assertEqual(result['status'],'ok',result['diagnostics'])
        actual=result['data']['document']['sections'][1]['components'][0]
        self.assertEqual(actual['id'],'comparison');self.assertEqual(actual['layout']['span'],6)
        self.assertEqual(actual['props']['columns'][:2],before['sections'][1]['components'][0]['props']['columns'])
        self.assertEqual(actual['props']['columns'][2]['field'],{'data':'prior','field':'amount'})
        self.assertEqual(baseline,before)

    def test_postprocess_merge_preserves_diagnostic_order_and_candidate_boundaries(self):
        from metriccanvas_authoring.pages.multislot_operations import apply_postprocess
        original=invoke('page.compose.v2',request());original['diagnostics']=[{'code':'FIRST','path':'/first'}]
        before=deepcopy(original)
        partial={'status':'partial','data':{'scope':'data-only','findings':[{'code':'PRESENTATION_PERCENT_UNIT_CONFLICT'}]},
                 'diagnostics':[{'code':'PRESENTATION_PERCENT_UNIT_CONFLICT','path':'/binding'}]}
        result=apply_postprocess('page.compose.v2',{},original,partial)
        self.assertEqual(result['status'],'partial')
        self.assertEqual([i['code']for i in result['diagnostics']],['FIRST','PRESENTATION_PERCENT_UNIT_CONFLICT'])
        self.assertEqual(result['data']['document'],original['data']['document'])
        error={'status':'error','data':{},'diagnostics':[{'code':'INVALID_EVALUATION_CONTEXT'}]}
        rejected=apply_postprocess('page.compose.v2',{},original,error)
        self.assertEqual(rejected['status'],'error');self.assertIsNone(rejected['data']['document'])
        self.assertEqual(original,before)

    def test_v2_single_source_uses_same_core_as_frozen_legacy(self):
        value=request()
        for key in ('tableSlots','rowKey','periods','pagination'):block(value).pop(key)
        self.assertEqual(invoke('page.compose.v2',value),legacy('page.compose',value))

    def test_postprocess_frozen_vectors(self):
        from metriccanvas_authoring.pages.multislot_operations import POSTPROCESS_SELF_TESTS, apply_postprocess
        for vector in POSTPROCESS_SELF_TESTS:
            result=apply_postprocess(vector['operation'],vector['input'],vector['result'],vector['auditResult'])
            self.assertEqual(result['status'],vector['expectedStatus'])
            self.assertEqual(result['data']['document'],vector['expectedDocument'])

    def test_empty_main_and_auxiliary_are_not_failure_or_unknown(self):
        value=request();value['resultRecords']['current']=record([]);value['resultRecords']['prior']=record([])
        result=invoke('page.compose.v2',value)
        self.assertEqual(result['status'],'ok',result['diagnostics'])
        self.assertTrue(all(slot['complete']for slot in result['data']['operations'][0]['adjustments'][0]['slots']))
        block(value)['pagination']={'mode':'query'}
        main=value['resultRecords']['current']['source']['source'];main.pop('resultScope');main['query']['body']['dsl_list'][0]['order']={'offset':0,'limit':5}
        result=invoke('page.compose.v2',value)
        self.assertEqual(result['status'],'ok',result['diagnostics'])

import json
import unittest
from copy import deepcopy
from pathlib import Path
from test_text_map_building import content_page
from metriccanvas_authoring.pages.editing.page_editing import edit_page_document
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


def interaction_page():
    document=content_page();document['schemaVersion']='6.5'
    fixture=json.loads((Path(__file__).resolve().parents[3]/'packages/page/fixtures/contract-valid/dimension-params-page.json').read_text())
    source=deepcopy(fixture['dataSources']['sales'])
    source['source']['query'].pop('filterBindings',None);source['source']['query'].pop('paramBindings',None)
    source['fields']={'region':{'type':'string','role':'dimension','queryField':'raw_region'},'amount':{'type':'number','role':'measure','queryField':'gmv'}}
    source['source']['query']['body']['dsl_list'][0]['output_dims']=['raw_region']
    source['source']['initial']={'capturedAt':'2026-09-14T00:00:00Z','rows':[{'raw_region':'上海市','gmv':42},{'raw_region':'浙江省','gmv':18}]}
    document['dataSources']['sales']=source
    document['dataSources']['other-query']=deepcopy(source)
    other=deepcopy(document['sections'][0]['components'][2]);other['id']='other-table';other['data']['main']='other-query'
    document['sections'][0]['components'].append(other)
    document['params']=[{'id':'context','type':'string','required':True,'default':'经营分析'}]
    document['sections'][0]['components'][0]['props']['title']={'param':'context'}
    return document


def add_filter(**kwargs):
    return {'id':'filter','type':'add_dimension_filter','filterId':'region-filter','dimension':'region','label':'地域','display':'tabs',
        'bindings':[{'dataSourceId':'sales','queryField':'raw_region'}],**kwargs}

def link(**kwargs):
    return {'id':'link','type':'set_table_link','componentId':'table','fieldId':'region','navigate':{'href':'/detail?fixed=keep#section',
        'query':{'region':{'source':'row','field':'region'},'context':{'source':'param','id':'context'},'selected':{'source':'filter','id':'region-filter'}}},**kwargs}

def run(document,*operations):return edit_page_document(document,{'operations':list(operations)})


class InteractionEditingTest(unittest.TestCase):
    def test_add_update_remove_bindings_are_atomic_and_preserve_unrelated_sources(self):
        baseline=interaction_page();original=deepcopy(baseline)
        self.assertEqual(validate_page_document(baseline),[])
        added=run(baseline,add_filter())
        self.assertEqual(added['status'],'changed',added)
        doc=added['document'];self.assertEqual(validate_page_document(doc),[])
        self.assertEqual(doc['dataSources']['other-query'],original['dataSources']['other-query'])
        for key in ['body']:
            self.assertEqual(doc['dataSources']['sales']['source']['query'][key],original['dataSources']['sales']['source']['query'][key])
        self.assertEqual(doc['dataSources']['sales']['source']['initial'],original['dataSources']['sales']['source']['initial'])
        update={'id':'update','type':'update_dimension_filter','filterId':'region-filter','changes':{'label':'选地域','default':['浙江省']},'bindings':[{'dataSourceId':'other-query','queryField':'raw_region'}]}
        changed=run(doc,update)['document']
        self.assertNotIn('filterBindings',changed['dataSources']['sales']['source']['query'])
        self.assertIn('region-filter',changed['dataSources']['other-query']['source']['query']['filterBindings'])
        removed=run(changed,{'id':'remove','type':'remove_dimension_filter','filterId':'region-filter'})
        self.assertEqual(removed['document'],original)
        self.assertEqual(baseline,original)

    def test_invalid_bindings_rollback_declaration_and_skip_dependents(self):
        for bindings in [[{'dataSourceId':'total','queryField':'amount'}],[{'dataSourceId':'sales','queryField':'gmv'}],[{'dataSourceId':'missing','queryField':'raw_region'}],[{'dataSourceId':'sales','queryField':'made-up'}],[],[{'dataSourceId':'sales','queryField':'raw_region'}]*2]:
            result=run(interaction_page(),add_filter(bindings=bindings),link(dependsOn=['filter']),{'id':'title','type':'set_title','componentId':'table','title':'Independent'})
            self.assertEqual(result['status'],'partial')
            self.assertEqual([o['status'] for o in result['operations']],['failed','skipped','applied'])
            self.assertNotIn('filters',result['document'])
            self.assertEqual(result['document']['dataSources'],interaction_page()['dataSources'])

    def test_table_link_and_removal_preserve_data_and_column_properties(self):
        baseline=run(interaction_page(),add_filter())['document']
        original=deepcopy(baseline)
        result=run(baseline,link())
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual(result['document']['dataSources'],original['dataSources'])
        column=result['document']['sections'][0]['components'][2]['props']['columns'][0]
        self.assertEqual(column,dict(original['sections'][0]['components'][2]['props']['columns'][0],link=True))
        removed=run(result['document'],{'id':'unlink','type':'remove_table_link','componentId':'table','fieldId':'region'})
        self.assertEqual(removed['document'],original)
        self.assertEqual(baseline,original)

    def test_filter_removal_rejects_surviving_navigation_reference(self):
        baseline=run(interaction_page(),add_filter(),link())['document']
        removed=run(baseline,{'id':'remove','type':'remove_dimension_filter','filterId':'region-filter'})
        self.assertIsNone(removed['document'])
        result=run(baseline,{'id':'unlink','type':'remove_table_link','componentId':'table','fieldId':'region'},
            {'id':'remove','type':'remove_dimension_filter','filterId':'region-filter','dependsOn':['unlink']})
        self.assertEqual(result['document'],interaction_page())

    def test_query_pagination_sort_and_header_filter_remain_closed(self):
        for op in [add_filter(pagination={'mode':'query'}),link(sortable=True),link(navigate={'href':'/detail','query':{},'filterable':{}}),
            {'id':'props','type':'set_properties','componentId':'table','properties':{'pagination':{'mode':'query'}}},
            {'id':'column','type':'set_table_column','componentId':'table','fieldId':'region','properties':{'sortable':True,'filterable':{'mode':'select'}}}]:
            self.assertIsNone(run(interaction_page(),op)['document'])

    def test_unsafe_navigation_or_missing_query_reference_cannot_commit_link_flag(self):
        baseline=run(interaction_page(),add_filter())['document']
        for target in [{'href':'javascript:alert(1)','query':{'r':{'source':'row','field':'region'}}},
            {'href':'/detail','query':{'r':{'source':'row','field':'unknown'}}},
            {'href':'/detail','query':{'r':{'source':'param','id':'unknown'}}},
            {'href':'/detail','query':{'r':{'source':'filter','id':'unknown'}}}]:
            self.assertIsNone(run(baseline,link(navigate=target))['document'])

    def test_shared_navigation_does_not_silently_change_other_linked_columns(self):
        baseline=run(interaction_page(),add_filter(),link())['document']
        both=run(baseline,link(id='amount-link',fieldId='amount'))['document']
        changed=run(both,link(navigate={'href':'/other','query':{'r':{'source':'row','field':'region'}}}))
        self.assertEqual(changed['operations'][0]['issues'][0]['code'],'TABLE_NAVIGATION_SHARED')
        removed=run(both,{'id':'unlink','type':'remove_table_link','componentId':'table','fieldId':'region'})['document']
        self.assertIn('actions',removed['sections'][0]['components'][2]['props'])

    def test_existing_parameter_bindings_and_initial_param_are_preserved(self):
        fixture=json.loads((Path(__file__).resolve().parents[3]/'packages/page/fixtures/contract-valid/dimension-params-page.json').read_text())
        original=deepcopy(fixture)
        bindings=[{'dataSourceId':id,'queryField':'region'} for id,s in fixture['dataSources'].items() if 'region-filter' in s['source']['query'].get('filterBindings',{})]
        result=run(fixture,{'id':'update','type':'update_dimension_filter','filterId':'region-filter','changes':{'label':'地区'},'bindings':bindings})
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual(result['document']['params'],original['params'])
        self.assertEqual(result['document']['dataSources'],original['dataSources'])
        self.assertEqual(result['document']['filters'][0]['initialParam'],original['filters'][0]['initialParam'])

    def test_failed_update_restores_declaration_and_existing_binding_set(self):
        baseline=run(interaction_page(),add_filter())['document'];original=deepcopy(baseline)
        result=run(baseline,{'id':'update','type':'update_dimension_filter','filterId':'region-filter','changes':{'label':'Wrong'},'bindings':[{'dataSourceId':'sales','queryField':'unknown'}]})
        self.assertIsNone(result['document']);self.assertEqual(baseline,original)

    def test_grouped_table_column_and_selection_precedence(self):
        baseline=run(interaction_page(),add_filter())['document']
        table=baseline['sections'][0]['components'][2]
        first=table['props']['columns'][0]
        table['props']['columns'][0]={'kind':'group','id':'names','title':'Names','children':[first]}
        self.assertEqual(run(baseline,link())['status'],'changed')
        first['selection']={'writes':{'region-filter':{'field':'region'}}}
        self.assertEqual(validate_page_document(baseline),[])
        result=run(baseline,link())
        self.assertEqual(result['operations'][0]['issues'][0]['code'],'TABLE_LINK_SELECTION_CONFLICT')
        self.assertIsNone(result['document'])

    def test_filter_removal_cannot_break_surviving_cascade(self):
        baseline=run(interaction_page(),add_filter())['document']
        baseline['filters'].append({'id':'child-filter','type':'dimension','dimension':'region','dependsOn':'region-filter'})
        self.assertEqual(validate_page_document(baseline),[])
        self.assertIsNone(run(baseline,{'id':'remove','type':'remove_dimension_filter','filterId':'region-filter'})['document'])

    def test_explicit_empty_binding_set_detaches_without_deleting_filter(self):
        baseline=run(interaction_page(),add_filter(),link())['document']
        result=run(baseline,{'id':'detach','type':'update_dimension_filter','filterId':'region-filter','changes':{},'bindings':[]})
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual(result['document']['filters'],baseline['filters'])
        self.assertNotIn('filterBindings',result['document']['dataSources']['sales']['source']['query'])
        self.assertEqual(result['document']['sections'],baseline['sections'])

    def test_tab_child_table_link_uses_the_same_reference_checks(self):
        from test_container_building import tabs
        result=run(interaction_page(),add_filter(),tabs(),link(componentId='overview-table'))
        self.assertEqual(result['status'],'changed',result)
        child=result['document']['sections'][0]['components'][-1]['props']['tabs'][0]['components'][0]
        self.assertTrue(child['props']['columns'][0]['link'])
        self.assertEqual(child['props']['actions'][0]['navigate'],link()['navigate'])


class ReportDateEditingTest(unittest.TestCase):
    def page(self):
        p=json.loads((Path(__file__).resolve().parents[3]/'packages/page/fixtures/contract-valid/report-date-filters-page.json').read_text())
        p.pop('params')
        p['filters'][0].pop('initialParam')
        p['filters'][0]['default']={'from':'2026-01','to':'2026-06'}
        return p

    def test_update_and_remove_date_filter_keep_bindings_and_header_references_atomic(self):
        p=self.page();original=deepcopy(p)
        self.assertEqual(validate_page_document(p),[])
        updated=run(p,{'id':'update','type':'update_date_filter','filterId':'period-filter',
            'declaration':{'type':'timePoint','granularity':'month','default':'2026-04','required':True},
            'bindings':[{'dataSourceId':'sales','target':'time','window':{'kind':'yearToDate'}}],'headerId':'page-header'})
        self.assertEqual(updated['status'],'changed',updated)
        self.assertEqual(p,original)
        removed=run(updated['document'],{'id':'remove','type':'remove_date_filter','filterId':'period-filter'})
        self.assertEqual(removed['status'],'changed',removed)
        self.assertNotIn('filterIds',removed['document']['sections'][0]['components'][0]['props'])
        self.assertNotIn('filterBindings',removed['document']['dataSources']['sales']['source']['query'])

    def test_invalid_date_configuration_rolls_back_whole_operation(self):
        p=self.page();original=deepcopy(p)
        result=run(p,{'id':'bad','type':'update_date_filter','filterId':'period-filter',
            'declaration':{'type':'timeRange','precision':'date','default':{'from':'2026-06-30','to':'2026-01-01'}},
            'bindings':[{'dataSourceId':'sales','target':'time'}]})
        self.assertEqual(result['status'],'failed',result)
        self.assertEqual(p,original)

    def test_dashboard_period_add_update_preserves_query_aggregation(self):
        p=json.loads((Path(__file__).resolve().parents[3]/'pages/capabilities/filters/dashboard-period-filter.json').read_text())
        p.pop('filters');p['dataSources']['sales']['source']['query'].pop('filterBindings')
        before=deepcopy(p)
        added=run(p,{'id':'add','type':'add_date_filter','filterId':'test-period',
            'declaration':{'type':'timeRange','display':'period','precision':'date','default':{'mode':'quarter','value':'2026-Q4'}},
            'bindings':[{'dataSourceId':'sales','target':'time'}]})
        self.assertEqual(added['status'],'changed',added)
        self.assertEqual(validate_page_document(added['document']),[])
        self.assertEqual(p,before)
        self.assertEqual(added['document']['dataSources']['fixed'],before['dataSources']['fixed'])
        updated=run(added['document'],{'id':'update','type':'update_date_filter','filterId':'test-period',
            'declaration':{'type':'timeRange','display':'period','precision':'date','default':{'mode':'last12Months'}},
            'bindings':[{'dataSourceId':'sales','target':'time'}]})
        self.assertEqual(updated['status'],'changed',updated)
        self.assertEqual(updated['document']['filters'][0]['default'],{'mode':'last12Months'})
        self.assertEqual(updated['document']['dataSources']['sales']['source']['query']['body'],before['dataSources']['sales']['source']['query']['body'])

    def test_placement_moves_existing_control_without_duplicate_reference(self):
        p=self.page();p['sections'].append({'id':'other-header','components':[{'id':'other-title','type':'reportHeader','layout':{'span':12},'props':{'title':'另一个页头'}}]})
        moved=run(p,{'id':'move','type':'set_report_header_filters','headerId':'other-title','filterIds':['period-filter']})
        self.assertEqual(moved['status'],'changed',moved)
        self.assertNotIn('filterIds',moved['document']['sections'][0]['components'][0]['props'])
        self.assertEqual(moved['document']['sections'][-1]['components'][0]['props']['filterIds'],['period-filter'])


class IocHeaderEditingTest(unittest.TestCase):
    def test_create_edit_and_reopen_acceptance_headers_without_touching_data(self):
        root = Path(__file__).resolve().parents[3]
        for name in ['overview', 'dense-filter', 'detail', 'month-set']:
            original = json.loads((root / f'pages/ioc-header-{name}-demo.json').read_text())
            self.assertEqual(validate_page_document(original), [])
            baseline = deepcopy(original)
            if name not in ['detail']:
                baseline.pop('iocHeader')
            # Detail optional identity references are only consumed by its header;
            # preserve them by editing the complete legal baseline directly.
            header = deepcopy(original['iocHeader'])
            header['presentation'] = {'density': 'compact', 'collapse': 'none'}
            edited = run(baseline, {'id': 'header', 'type': 'set_ioc_header', 'header': header})
            self.assertEqual(edited['status'], 'changed', edited)
            result = edited['document']
            self.assertEqual(result['dataSources'], original['dataSources'])
            self.assertEqual(result['filters'], original['filters'])
            self.assertEqual(result['sections'], original['sections'])
            self.assertEqual(validate_page_document(result), [])
            self.assertEqual(result['iocHeader'], header)

    def test_invalid_header_conflicts_roll_back_the_whole_operation(self):
        root = Path(__file__).resolve().parents[3]
        doc = json.loads((root / 'pages/capabilities/ioc-header/ioc-header-overview-demo.json').read_text())
        for header in [{}, {'filterIds': ['missing']}, {'filterIds': ['period', 'period']}]:
            result = run(doc, {'id': 'invalid', 'type': 'set_ioc_header', 'header': header})
            self.assertEqual(result['status'], 'failed', result)
            self.assertIsNone(result['document'])


class BusinessFilterEditingTest(unittest.TestCase):
    def test_real_business_pages_create_edit_and_reopen(self):
        root = Path(__file__).resolve().parents[3]
        for name in ['options', 'tree', 'detail']:
            page = json.loads((root / f'pages/ioc-header-business-{name}-demo.json').read_text())
            self.assertEqual(validate_page_document(page), [])
            target = 'kind' if name == 'options' else 'model' if name == 'tree' else 'detail-kind'
            declaration = next(item for item in page['filters'] if item['id'] == target)
            bindings = [{'dataSourceId': source_id, **{key: value for key, value in source['source']['query']['filterBindings'][target].items() if key != 'target'}}
                        for source_id, source in page['dataSources'].items()
                        if target in source['source'].get('query', {}).get('filterBindings', {})]
            updated = run(page, {'id': 'update-b2', 'type': 'update_dimension_filter', 'filterId': target,
                                'changes': {'hint': '创作编辑后提示'}, 'bindings': bindings})
            self.assertEqual(updated['status'], 'changed', updated)
            actual = next(item for item in updated['document']['filters'] if item['id'] == target)
            expected = {**declaration, 'hint': '创作编辑后提示'}
            self.assertEqual(actual, expected)
            self.assertEqual(validate_page_document(updated['document']), [])
            self.assertEqual(updated['document']['sections'], page['sections'])

    def test_add_closed_enum_keeps_new_fields_and_invalid_update_rolls_back(self):
        baseline = interaction_page()
        operation = add_filter(selection={'mode': 'single', 'required': True},
            options=[{'value': 'A', 'label': '重点'}, {'value': 'B', 'label': '一般', 'disabled': True}],
            default=['A'], hint='确认后显式封闭枚举')
        result = run(baseline, operation)
        self.assertEqual(result['status'], 'changed', result)
        declaration = result['document']['filters'][0]
        for key in ['selection', 'options', 'hint']:
            self.assertEqual(declaration[key], operation[key])
        failed = run(result['document'], {'id': 'invalid-b2', 'type': 'update_dimension_filter',
            'filterId': 'region-filter', 'changes': {'default': ['B']}, 'bindings': operation['bindings']})
        self.assertEqual(failed['status'], 'failed', failed)
        self.assertIsNone(failed['document'])

    def test_structural_tree_edit_preserves_each_level_binding(self):
        root = Path(__file__).resolve().parents[3]
        page = json.loads((root / 'pages/capabilities/ioc-header/ioc-header-business-tree-demo.json').read_text())
        bindings = [{'dataSourceId': 'bound', 'levelQueryFields': {'department': 'department_code', 'office': 'office_code'}}]
        result = run(page, {'id': 'tree-b2', 'type': 'update_dimension_filter', 'filterId': 'region',
            'changes': {'hint': '显式层级保持'}, 'bindings': bindings})
        self.assertEqual(result['status'], 'changed', result)
        self.assertEqual(result['document']['dataSources']['bound']['source']['query']['filterBindings']['region'],
                         {'target': 'dimension', 'levelQueryFields': bindings[0]['levelQueryFields']})

    def test_date_edit_reopens_with_common_interaction_fields(self):
        root = Path(__file__).resolve().parents[3]
        page = json.loads((root / 'pages/capabilities/ioc-header/ioc-header-business-options-demo.json').read_text())
        declaration = {key: value for key, value in page['filters'][0].items() if key != 'id'}
        declaration.update(hint='分类变更后确认期间', clearOnChangeOf=['kind'])
        result = run(page, {'id': 'date-b2', 'type': 'update_date_filter', 'filterId': 'period',
                           'declaration': declaration, 'bindings': [{'dataSourceId': 'bound', 'target': 'time'}]})
        self.assertEqual(result['status'], 'changed', result)
        self.assertEqual(validate_page_document(result['document']), [])
        self.assertEqual(result['document']['filters'][0]['hint'], declaration['hint'])
        self.assertEqual(result['document']['filters'][0]['clearOnChangeOf'], ['kind'])


class CurrencyRangeEditingTest(unittest.TestCase):
    def page(self):
        return json.loads((Path(__file__).resolve().parents[3]/'pages/capabilities/ioc-header/ioc-header-currency-demo.json').read_text())

    def operation(self, page, kind='update_number_range_filter'):
        declaration=deepcopy(next(f for f in page['filters'] if f['id']=='amount'));declaration.pop('id')
        binding=deepcopy(page['dataSources']['main']['source']['query']['filterBindings']['amount']);binding.pop('target')
        return {'id':'range','type':kind,'filterId':'amount','declaration':declaration,'bindings':[{'dataSourceId':'main',**binding}]}

    def test_amount_update_reopen_and_case_column_edit_preserve_branches(self):
        original=self.page();op=self.operation(original);op['declaration']['presets'].append({'id':'extra-large','label':'大额','range':{'from':300}})
        result=run(original,op,{'id':'column','type':'set_table_column','componentId':'amount-table','fieldId':'base-usd','properties':{'width':180}})
        self.assertEqual(result['status'],'changed',result)
        reopened=json.loads(json.dumps(result['document']));self.assertEqual(validate_page_document(reopened),[])
        column=reopened['sections'][0]['components'][2]['props']['columns'][1]
        self.assertEqual(column['width'],180);self.assertEqual(column['field'],original['sections'][0]['components'][2]['props']['columns'][1]['field'])
        self.assertEqual(reopened['dataSources']['main']['fields'],original['dataSources']['main']['fields'])

    def test_add_amount_and_invalid_update_rollback(self):
        original=self.page();op=self.operation(original,'add_number_range_filter');base=deepcopy(original)
        base['filters']=[f for f in base['filters'] if f['id']!='amount'];base['iocHeader']['filterIds'].remove('amount');del base['dataSources']['main']['source']['query']['filterBindings']['amount']
        added=run(base,op);self.assertEqual(added['status'],'changed',added);self.assertEqual(validate_page_document(added['document']),[])
        wrong=self.operation(original);wrong['declaration']['default']={'from':5,'to':5}
        rejected=run(original,wrong);self.assertIsNone(rejected['document']);self.assertEqual(original,self.page())

class TimeProgramEditingTest(unittest.TestCase):
    def page(self):
        return json.loads((Path(__file__).resolve().parents[3] / 'pages/capabilities/ioc-header/ioc-header-time-modes-demo.json').read_text())

    def test_atomic_time_program_save_reopen_and_invalid_case_rollback(self):
        baseline = self.page()
        declaration = deepcopy(baseline['filters'][0])
        declaration.pop('id')
        declaration['defaultMode'] = 'month'
        query = deepcopy(baseline['dataSources']['bound']['source']['query'])
        changed = run(baseline, {'id': 'time', 'type': 'set_time_program', 'filterId': 'period',
                                 'declaration': declaration, 'queries': {'bound': query}})
        self.assertEqual(changed['status'], 'changed', changed)
        reopened = json.loads(json.dumps(changed['document']))
        self.assertEqual(validate_page_document(reopened), [])
        self.assertEqual(reopened['filters'][0]['defaultMode'], 'month')
        self.assertEqual(set(reopened['dataSources']['bound']['source']['query']['timeModes']['cases']), {'day', 'month', 'isoWeek'})
        del query['timeModes']['cases']['month']
        failed = run(reopened, {'id': 'broken', 'type': 'set_time_program', 'filterId': 'period',
                                'declaration': declaration, 'queries': {'bound': query}})
        self.assertNotEqual(failed['status'], 'changed', failed)
        self.assertEqual(baseline, self.page())

    def test_candidate_window_preserved_in_controlled_dimension_edit(self):
        page = json.loads((Path(__file__).resolve().parents[3] / 'pages/capabilities/ioc-header/ioc-header-calendar-window-demo.json').read_text())
        # One controlled dimension edit updates the common binding in every mode case.
        result = run(page, {'id': 'month-label', 'type': 'update_dimension_filter', 'filterId': 'months',
                            'changes': {'label': '选择月份', 'candidateWindow': {'unit': 'month', 'n': 12, 'includeCurrent': False}},
                            'bindings': [{'dataSourceId': 'bound', 'queryField': 'month_code'}]})
        self.assertEqual(result['status'], 'changed', result)
        reopened = json.loads(json.dumps(result['document']))
        self.assertEqual(validate_page_document(reopened), [])
        self.assertFalse(reopened['filters'][1]['candidateWindow']['includeCurrent'])
        self.assertEqual(page['filters'][1]['candidateWindow']['includeCurrent'], True)

class NavigationInputsEditingTest(unittest.TestCase):
    def test_guarded_table_link_saves_reopens_and_invalid_intention_rolls_back(self):
        baseline = run(interaction_page(), add_filter())['document']
        op = link()
        op['navigate']['validateTargetInputs'] = True
        changed = run(baseline, op)
        self.assertEqual(changed['status'], 'changed', changed)
        reopened = json.loads(json.dumps(changed['document']))
        action = reopened['sections'][0]['components'][2]['props']['actions'][0]
        self.assertTrue(action['navigate']['validateTargetInputs'])
        self.assertEqual(reopened['schemaVersion'], '6.40')
        invalid = deepcopy(op)
        invalid['navigate']['validateTargetInputs'] = False
        failed = run(reopened, invalid)
        self.assertIn(failed['status'], ['failed', 'unchanged'])
        self.assertTrue(action['navigate']['validateTargetInputs'])

    def test_explicit_url_input_policy_survives_save_reopen_and_can_be_removed(self):
        baseline = interaction_page()
        result = run(baseline, {'id': 'policy', 'type': 'set_url_input_validation', 'enabled': True})
        self.assertEqual(result['status'], 'changed', result)
        reopened = json.loads(json.dumps(result['document']))
        self.assertTrue(reopened['strictURLInputs'])
        removed = run(reopened, {'id': 'remove-policy', 'type': 'set_url_input_validation', 'enabled': False})
        self.assertNotIn('strictURLInputs', removed['document'])
        self.assertEqual(baseline, interaction_page())

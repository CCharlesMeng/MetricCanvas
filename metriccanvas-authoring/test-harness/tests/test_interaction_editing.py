import json
import unittest
from copy import deepcopy
from pathlib import Path
from test_text_map_building import content_page
from metriccanvas_authoring.pages.editing.page_editing import edit_page_document
from metriccanvas_authoring.domain.page_validation import validate_page_document


def interaction_page():
    document=content_page();document['schemaVersion']='6.2'
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

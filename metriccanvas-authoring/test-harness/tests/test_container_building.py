import unittest
from copy import deepcopy
from test_text_map_building import content_page, recipe
from metriccanvas_authoring.domain.page_editing import edit_page_document
from metriccanvas_authoring.domain.page_validation import validate_page_document
from metriccanvas_authoring.application.summary_capability import summary_configured


def child(kind='metricCard', id='nested-metric', source='total', **kwargs):
    return {'componentId':id,'componentType':kind,'dataSourceId':source,**kwargs}

def composite(**kwargs):
    return {'id':'composite','type':'add_composite_card','componentId':'composite','sectionId':'main','children':[child()],**kwargs}

def tabs(**kwargs):
    return {'id':'tabs','type':'add_tab_container','componentId':'tabs','sectionId':'main','tabs':[
        {'id':'overview','label':'概览','children':[child('table','overview-table','sales')]},
        {'id':'details','label':'明细','children':[child('table','details-table','sales')]}],**kwargs}

def summary(**kwargs):
    return {'id':'summary','type':'add_ai_summary','componentId':'summary','sectionId':'main','generation':'runtime_sse',
        'promptTemplate':'概括各地域的经营表现。','relatedData':{'sales':{'source':'sales','description':'地域经营数据','fields':[{'field':'region','term':'地域'},{'field':'amount','term':'金额'}]}},**kwargs}

def run(document,*operations,enabled=False):
    return edit_page_document(document,{'operations':list(operations)},summary_enabled=enabled)


class ContainerBuildingTest(unittest.TestCase):
    def test_complete_subtrees_and_deletion_preserve_original_page(self):
        original=content_page();baseline=deepcopy(original)
        result=run(baseline,composite(),tabs(),summary(),enabled=True)
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual(validate_page_document(result['document']),[])
        self.assertEqual(baseline,original)
        self.assertEqual(result['document']['dataSources'],original['dataSources'])
        removed=run(result['document'],*({'id':id,'type':'remove_component','componentId':id} for id in ['composite','tabs','summary']))
        self.assertEqual(removed['document'],original)

    def test_all_five_composite_child_types_use_existing_gated_builders(self):
        recipes=[child(k,'child-'+str(i),'total' if k in {'metricCard','gauge','keyValuePanel'} else 'sales') for i,k in enumerate(['metricCard','gauge','keyValuePanel','pieChart','categoryBreakdown'])]
        result=run(content_page(),composite(children=recipes))
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual({c['type'] for c in result['document']['sections'][0]['components'][-1]['props']['components']},{r['componentType'] for r in recipes})

    def test_invalid_children_empty_duplicate_and_missing_default_tab_roll_back(self):
        operations=[composite(children=[]),composite(children=[child('table')]),composite(children=[child(id='header')]),
            composite(children=[child(),child()]),tabs(defaultTab='absent'),tabs(tabs=[{'id':'empty','label':'Empty','children':[]}]),
            tabs(tabs=[{'id':'one','label':'One','children':[child('metricCard')]}])]
        for operation in operations:
            with self.subTest(operation=operation):
                self.assertIsNone(run(content_page(),operation)['document'])

    def test_cross_tab_and_parent_child_id_collisions_are_validated_atomically(self):
        op=tabs();op['tabs'][1]['children'][0]['componentId']='overview-table'
        self.assertIsNone(run(content_page(),op)['document'])
        self.assertIsNone(run(content_page(),composite(children=[child(id='composite')]))['document'])

    def test_summary_requires_explicit_intent_and_trusted_configuration(self):
        for op,enabled in [(summary(generation='static'),True),(summary(),False),(summary(promptTemplate=' '),True),(summary(relatedData={}),True)]:
            self.assertIsNone(run(content_page(),op,enabled=enabled)['document'])
        static=run(content_page(),recipe('text',title='AI 总结'),enabled=True)['document']
        self.assertEqual(static['sections'][0]['components'][-1]['type'],'text')

    def test_summary_source_and_field_references_validated_without_leaking_values(self):
        for related in [{'x':{'source':'missing','description':'Missing','fields':[{'field':'amount','term':'Amount'}]}},
            {'x':{'source':'sales','description':'Sales','fields':[{'field':'missing','term':'Missing'}]}}]:
            result=run(content_page(),summary(relatedData=related),recipe('text'),enabled=True)
            self.assertEqual(result['status'],'partial')
            self.assertEqual([r['status'] for r in result['operations']],['failed','applied'])
            self.assertEqual(result['document']['sections'][0]['components'][-1]['type'],'text')

    def test_whole_container_delete_rejects_remaining_connection(self):
        document=run(content_page(),composite(),recipe('text'))['document']
        document['sections'][0]['components'][-1]['layout']['connectPrevious']=True
        result=run(document,{'id':'remove','type':'remove_component','componentId':'composite'})
        self.assertIsNone(result['document'])
        self.assertEqual(result['operations'][0]['issues'][0]['code'],'COMPONENT_REFERENCED_BY_CONNECTION')

    def test_config_validation_no_default_or_model_owned_endpoint(self):
        for config in [None,{}, {'conversationBaseUrl':''},{'conversationBaseUrl':'javascript:alert(1)'},{'conversationBaseUrl':'https://user:pass@host/path'},{'conversationBaseUrl':'https://host/path','headers':{}},{'conversationBaseUrl':'http://host:bad'}]:
            self.assertFalse(summary_configured(config))
        self.assertTrue(summary_configured({'conversationBaseUrl':'https://summary.internal/conversations','env':'prod'}))
        self.assertIsNone(run(content_page(),summary(conversationBaseUrl='https://injected.invalid'),enabled=True)['document'])

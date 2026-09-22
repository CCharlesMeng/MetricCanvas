import json
import unittest
from copy import deepcopy
from test_page_editing import page, edit
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


def content_page():
    document = page()
    document['dataSources']['sales']['source']['rows'] = [{'region': '上海市', 'amount': 42}, {'region': '浙江省', 'amount': 18}]
    document['dataSources']['narrative'] = {'fields': {'body': {'type': 'string', 'role': 'dimension'}},
        'source': {'type': 'inline', 'rows': [{'body': '项目运行正常。\n本周完成关键里程碑。'}]}}
    return document


def recipe(kind, **extra):
    base = {'id': kind, 'type': 'add_' + kind, 'componentId': kind.replace('_', '-'), 'sectionId': 'main'}
    if kind == 'text': base.update(body='经营摘要：增长保持稳定。', variant='reportInline')
    if kind == 'field_text': base.update(dataSourceId='narrative', fieldId='body')
    if kind == 'map_chart': base.update(dataSourceId='sales', nameField='region', valueField='amount', map='china')
    return {**base, **extra}


class TextMapBuildingTest(unittest.TestCase):
    def test_add_all_three_preserves_originals_and_remove_is_reversible(self):
        baseline = content_page(); original = deepcopy(baseline)
        added = edit(baseline, *(recipe(k) for k in ('text', 'field_text', 'map_chart')))
        self.assertEqual(added['status'], 'changed', added)
        self.assertEqual(validate_page_document(added['document']), [])
        self.assertEqual(added['document']['sections'][0]['components'][:4], original['sections'][0]['components'])
        self.assertEqual(added['document']['dataSources'], original['dataSources'])
        self.assertEqual(baseline, original)
        removed = edit(added['document'], *({'id': k, 'type': 'remove_component', 'componentId': k.replace('_', '-')} for k in ('text','field_text','map_chart')))
        self.assertEqual(removed['document'], original)

    def test_missing_source_wrong_field_and_multirow_fail_without_changes(self):
        for operation, code in [
            (recipe('field_text', dataSourceId='absent'), 'DATA_SOURCE_NOT_FOUND'),
            (recipe('field_text', dataSourceId='total', fieldId='amount'), 'LONG_TEXT_FIELD_REQUIRED'),
            (recipe('field_text', dataSourceId='sales', fieldId='region'), 'FIELD_TEXT_REQUIRES_SINGLE_ROW'),
            (recipe('map_chart', nameField='amount'), 'GEOGRAPHIC_NAME_FIELD_REQUIRED'),
            (recipe('map_chart', valueField='region'), 'MAP_MEASURE_FIELD_REQUIRED')]:
            with self.subTest(code=code):
                result = edit(content_page(), operation)
                self.assertIsNone(result['document'])
                self.assertEqual(result['operations'][0]['issues'][0]['code'], code)

    def test_geography_requires_real_map_names_and_explicit_mapping(self):
        baseline = content_page(); baseline['dataSources']['sales']['source']['rows'][0]['region'] = 'Shanghai'
        self.assertEqual(edit(baseline, recipe('map_chart'))['operations'][0]['issues'][0]['code'], 'MAP_REGION_UNRESOLVED')
        result = edit(baseline, recipe('map_chart', nameMap={'Shanghai':'上海市'}))
        self.assertEqual(result['status'], 'changed', result)
        self.assertEqual(result['document']['dataSources'], baseline['dataSources'])
        self.assertIsNone(edit(baseline, recipe('map_chart', nameMap={'Shanghai':'not-a-region'}))['document'])

    def test_raw_data_injection_duplicates_and_missing_parent_fail_independently(self):
        result = edit(content_page(), recipe('text', id='injection', rows=[{'x':1}]),
            recipe('text', id='duplicate', componentId='header'),
            recipe('text', id='missing', sectionId='missing'), recipe('text'))
        self.assertEqual([r['status'] for r in result['operations']], ['failed','failed','failed','applied'])
        self.assertEqual(len(result['document']['sections'][0]['components']), 5)

    def test_semantic_html_uses_product_validation_and_delete_preserves_layout_checks(self):
        good = edit(content_page(), recipe('text', body='<p>稳定增长</p>', bodyFormat='semanticHtml'))
        self.assertEqual(good['status'], 'changed', good)
        bad = edit(content_page(), recipe('text', body='<script>alert(1)</script>', bodyFormat='semanticHtml'))
        self.assertEqual(bad['status'], 'changed')  # Runtime sanitizes semantic HTML.
        document = good['document']
        first = document['sections'][0]['components'].pop()
        second = deepcopy(first);second['id']='second';second['layout']['connectPrevious']=True
        document['sections'].append({'id':'notes','components':[first,second]})
        self.assertEqual(validate_page_document(document), [])
        removed=edit(document,{'id':'remove','type':'remove_component','componentId':'text'})
        self.assertIsNone(removed['document'])
        self.assertEqual(removed['operations'][0]['status'],'failed')

    def test_field_text_requires_nonempty_actual_text(self):
        document = content_page()
        document['dataSources']['narrative']['source']['rows'][0]['body'] = None
        result = edit(document, recipe('field_text'))
        self.assertIsNone(result['document'])

    def test_plain_map_section_is_rejected_instead_of_zero_height_success(self):
        document=content_page();document['sections'][0]['container']='plain'
        result=edit(document,recipe('map_chart'))
        self.assertEqual(result['operations'][0]['issues'][0]['code'],'MAP_SECTION_REQUIRES_CHART_HEIGHT')
        self.assertIsNone(result['document'])

    def test_query_evidence_mapping_and_missing_initial_are_explicit(self):
        from pathlib import Path
        document=content_page()
        query_page=json.loads((Path(__file__).resolve().parents[3]/'packages/page/fixtures/contract-valid/dimension-params-page.json').read_text())
        source=deepcopy(query_page['dataSources']['sales'])
        query=source['source']['query']
        query.pop('filterBindings',None);query.pop('paramBindings',None)
        source['fields']['region']['queryField']='raw_region'
        query['body']['dsl_list'][0]['output_dims']=['raw_region']
        source['source']['initial']={'capturedAt':'2026-09-14T00:00:00Z','rows':[{'raw_region':'上海市','gmv':42}]}
        document['dataSources']['governed']=source
        self.assertEqual(validate_page_document(document),[])
        result=edit(document,recipe('map_chart',dataSourceId='governed',valueField='gmv'))
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual(result['document']['dataSources'],document['dataSources'])
        source['source'].pop('initial')
        result=edit(document,recipe('map_chart',dataSourceId='governed',valueField='gmv'))
        self.assertEqual(result['operations'][0]['issues'][0]['code'],'SOURCE_ROW_EVIDENCE_REQUIRED')

    def test_world_map_and_invalid_values(self):
        document=content_page()
        document['dataSources']['sales']['source']['rows']=[{'region':'China','amount':42}]
        self.assertEqual(edit(document,recipe('map_chart',map='world'))['status'],'changed')
        document['dataSources']['sales']['source']['rows'][0]['amount']=None
        self.assertIsNone(edit(document,recipe('map_chart',map='world'))['document'])

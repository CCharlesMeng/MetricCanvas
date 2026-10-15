import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.composition.paged_join import build_paged_join
from metriccanvas_authoring.pages.referenced import compose

class PagedJoinTests(unittest.TestCase):
    def page(self):
        return json.loads((bundle_root()/'contract-snapshot/page/conformance/valid/paged-join-page.json').read_text())

    def test_product_bridge_conformance(self):
        self.assertEqual(validate_page_document(self.page()), [])
        for file in (bundle_root()/'contract-snapshot/page/conformance/invalid').glob('paged-join-*.json'):
            vector=json.loads(file.read_text())
            self.assertEqual([issue.as_dict() for issue in validate_page_document(vector['input'])], vector['expected'], file.name)

    def test_missing_node_is_explicit(self):
        with patch('metriccanvas_authoring.pages.validation.node_validator.shutil.which',return_value=None):
            issues=validate_page_document(self.page())
        self.assertEqual(len(issues),1)
        self.assertIn('Node.js 22+',issues[0].message)

    def test_composition_keeps_definitions_and_independent_table(self):
        page=self.page();spec=page['dataSources']['office-overview']['source']
        sources={key:value for key,value in page['dataSources'].items() if key!='office-overview'}
        for value in sources.values():value['source']['query'].pop('filterBindings',None)
        combination=build_paged_join(sources,spec)
        self.assertEqual(combination['source']['members']['meeting']['source'],'office-meeting')
        self.assertNotIn('query',combination['source'])
        self.assertNotIn('queryField',combination['fields']['analysis-meeting-rate'])
        records={key:{'source':value,'rows':[],'totalCount':0} for key,value in sources.items()}
        request={'title':'组合测试','sources':{key:'verified-'+key for key in sources},'pagedJoins':{'office-overview':spec},'sections':[{'id':'main','pattern':'custom','blocks':[
            {'id':'joined-table','type':'data','source':'office-overview','component':'table','title':'概览','fields':['rep-office-name','bidding-amount','analysis-meeting-rate']},
            {'id':'independent-table','type':'data','source':'office-meeting','component':'table','title':'独立召开率','fields':['rep-office-name','analysis-meeting-rate']}
        ]}]}
        result=compose(SimpleNamespace(binding={'pageId':'paged-join-composed'}),request,records)
        self.assertEqual(result['status'],'changed',result)
        self.assertEqual(validate_page_document(result['document']),[])
        self.assertEqual(result['document']['dataSources']['office-meeting'],sources['office-meeting'])

if __name__=='__main__':unittest.main()

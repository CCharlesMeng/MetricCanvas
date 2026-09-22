import json
import unittest
from pathlib import Path
from fastmcp import Client
from test_interaction_editing import interaction_page,add_filter,link
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
ROOT=Path(__file__).resolve().parents[2]

class ContentInteractionsTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_stdio_creates_bound_filter_and_navigation_without_raw_model_data(self):
        async with Client(ROOT/'test-harness/content_stdio_server.py') as client:
            result=await client.call_tool('edit_page',{'baseline_token':'trusted-interaction-source','request':{'operations':[add_filter(),link(dependsOn=['filter'])]}})
            payload=result.structured_content
            self.assertEqual(payload['modelSummary']['status'],'changed',payload)
            artifact=payload['artifactEnvelope']['artifact'];doc=artifact['document']
            self.assertEqual(validate_page_document(doc),[])
            self.assertEqual(artifact['documentSha256'],document_sha256(doc))
            self.assertEqual(doc['dataSources']['other-query'],interaction_page()['dataSources']['other-query'])
            text=' '.join(c.text for c in result.content if c.type=='text')
            for private in ['dataSources','上海市','dsl_list','raw_region']:
                self.assertNotIn(private,text)

    async def test_partial_failure_and_dependency_skip_keep_query_features_closed(self):
        async with Client(ROOT/'test-harness/content_stdio_server.py') as client:
            result=await client.call_tool('edit_page',{'baseline_token':'trusted-interaction-source','request':{'operations':[
                add_filter(bindings=[{'dataSourceId':'sales','queryField':'missing'}]),link(dependsOn=['filter']),
                {'id':'sort','type':'set_table_column','componentId':'table','fieldId':'region','properties':{'sortable':True}},
                {'id':'independent','type':'set_title','componentId':'table','title':'表格新标题'}]}})
            payload=result.structured_content
            self.assertEqual(payload['modelSummary']['status'],'partial')
            self.assertEqual([o['status'] for o in payload['modelSummary']['operations']],['failed','skipped','failed','applied'])
            doc=payload['artifactEnvelope']['artifact']['document']
            self.assertNotIn('filters',doc)
            self.assertEqual(doc['dataSources'],interaction_page()['dataSources'])

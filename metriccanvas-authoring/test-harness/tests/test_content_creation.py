import json
import unittest
from copy import deepcopy
from pathlib import Path
from fastmcp import Client
from test_text_map_building import content_page, recipe
from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.pages.composition.create_content_page import create_content_page
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.domain.page_validation import validate_page_document

ROOT = Path(__file__).resolve().parents[2]

class Source:
    def __init__(self):
        self.document = content_page()
        self.ref = {'pageId': self.document['id'], 'revisionId': 'exact-r1', 'resourceId': 'exact-resource'}
        self.digest = document_sha256(self.document)
    async def read(self, token):
        if token != 'trusted-content-source': raise ContentBaselineError('BASELINE_NOT_FOUND')
        return ContentBaseline(self.ref, self.document, self.digest)

class ContentCreationTest(unittest.IsolatedAsyncioTestCase):
    async def test_create_three_types_from_verified_source_and_no_raw_data_in_summary(self):
        source = Source(); original = deepcopy(source.document)
        result = await create_content_page(source)('new-page','经营报告','report',{'operations':[recipe(k) for k in ('text','field_text','map_chart')]},'trusted-content-source')
        self.assertTrue(result['ok'], result)
        artifact = result['artifactEnvelope']['artifact']
        self.assertEqual(validate_page_document(artifact['document']), [])
        self.assertEqual(artifact['documentSha256'], document_sha256(artifact['document']))
        self.assertEqual(artifact['sourceRef'], source.ref)
        self.assertEqual(source.document, original)
        self.assertNotIn('dataSources', json.dumps(result['modelSummary']))
        self.assertNotIn('上海', json.dumps(result['modelSummary'], ensure_ascii=False))

    async def test_missing_hash_or_reference_mismatch_fail_before_creation(self):
        for mutation, expected in [('hash','BASELINE_HASH_MISMATCH'),('ref','BASELINE_REF_MISMATCH'),('missing','BASELINE_NOT_FOUND')]:
            source=Source()
            if mutation=='hash': source.document['id']='tampered';source.ref['pageId']='tampered'
            if mutation=='ref': source.ref['revisionId']=''
            result=await create_content_page(source)('new-page','Report','report',{'operations':[recipe('text')]},'missing' if mutation=='missing' else 'trusted-content-source')
            self.assertFalse(result['ok'])
            self.assertEqual(result['modelSummary']['issues'][0]['code'],expected)

    async def test_static_text_without_source_and_independent_partial_success(self):
        create=create_content_page(Source())
        result=await create('static-page','说明','dashboard',{'operations':[recipe('text'),recipe('map_chart')]})
        self.assertTrue(result['ok'])
        self.assertEqual(result['modelSummary']['status'],'partial')
        self.assertEqual(result['artifactEnvelope']['artifact']['document']['dataSources'],{})
        self.assertFalse((await create('bad','标题','report',{'operations':[{'id':'bad','type':'set_title','componentId':'page-header','title':'x'}]}))['ok'])
        self.assertFalse((await create('bad','标题','report',{'operations':[recipe('text')],'document':{}}))['ok'])

    async def test_public_stdio_create_add_remove_validate_and_summary_channel(self):
        async with Client(ROOT/'test-harness/content_stdio_server.py') as client:
            result=await client.call_tool('create_content_page',{'page_id':'new-content','title':'经营报告','source_token':'trusted-content-source','request':{'operations':[recipe(k) for k in ('text','field_text','map_chart')]}})
            self.assertTrue(result.structured_content['ok'],result.structured_content)
            doc=result.structured_content['artifactEnvelope']['artifact']['document']
            self.assertEqual(validate_page_document(doc),[])
            text=' '.join(c.text for c in result.content if c.type=='text')
            self.assertNotIn('上海',text);self.assertNotIn('dataSources',text)
            added=await client.call_tool('edit_page',{'baseline_token':'trusted-content-source','request':{'operations':[recipe('map_chart'),{'id':'remove','type':'remove_component','componentId':'map-chart'},recipe('text')]}})
            self.assertTrue(added.structured_content['ok'])
            self.assertEqual(validate_page_document(added.structured_content['artifactEnvelope']['artifact']['document']),[])

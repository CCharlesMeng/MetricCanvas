import json
import os
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from fastmcp import Client
from test_page_editing import page, title
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.domain.page_validation import validate_page_document

ROOT = Path(__file__).resolve().parents[2]

def record(document):
    if output := os.environ.get('METRICCANVAS_LAYOUT_EVIDENCE_DIR'):
        folder = Path(output);folder.mkdir(parents=True, exist_ok=True)
        (folder/(document['id']+'.json')).write_text(json.dumps(document, ensure_ascii=False))

def publish(directory, token, document):
    (Path(directory)/(token+'.json')).write_text(json.dumps({'ref':{'pageId':document['id'],'revisionId':'r1','resourceId':'resource1'},'document':document,'documentSha256':document_sha256(document)}))

class PlatformAuthoringFlowsTest(unittest.IsolatedAsyncioTestCase):
    def config(self, folder):
        return {'mcpServers':{'content':{'command':sys.executable,'args':['-m','metriccanvas_authoring.entrypoints.compat.content_server'],'env':{'PYTHONPATH':os.environ.get('METRICCANVAS_TEST_INSTALLED_CONTENT',str(ROOT/'tool')),'METRICCANVAS_CONTENT_BASELINES_DIR':folder,'PYTHONDONTWRITEBYTECODE':'1'}}}}

    def artifact(self, result):
        payload = result.structured_content
        self.assertTrue(payload['ok'],payload)
        artifact = payload['artifactEnvelope']['artifact'];document = artifact['document']
        self.assertEqual(validate_page_document(document), [])
        self.assertEqual(artifact['documentSha256'], document_sha256(document))
        text = ' '.join(c.text for c in result.content if c.type=='text')
        self.assertNotIn('dataSources',text);self.assertNotIn('private-region',text)
        record(document)
        return document

    async def test_public_creation_and_manual_then_edit_in_both_forms(self):
        with tempfile.TemporaryDirectory() as folder:
            async with Client(self.config(folder)) as client:
                for layout in ['report','dashboard']:
                    created = self.artifact(await client.call_tool('create_content_page',{'page_id':'created-'+layout,'title':'经营总览','layout':layout,'request':{'operations':[{'id':'text','type':'add_text','componentId':'body','sectionId':'main','title':'业务说明','body':'当前经营情况清晰。'}]}}))
                    self.assertEqual(created['layout'],layout)
                    self.assertEqual(len(created['sections']),1 if layout=='report' else 2)
                    if layout=='dashboard':self.assertNotIn('container',created['sections'][1])
                    manual = page();manual['id']='edited-'+layout;manual['layout']=layout
                    manual['sections'][0]['title']='手工章节'
                    manual['sections'][0]['components'][2]['props']['columns'][0]['width']=230
                    publish(folder,'trusted-manual-baseline',manual)
                    edited = self.artifact(await client.call_tool('edit_page',{'baseline_token':'trusted-manual-baseline','request':{'operations':[title(value='修改后页头')]}}))
                    expected=deepcopy(manual);expected['sections'][0]['components'][0]['props']['title']='修改后页头'
                    self.assertEqual(edited,expected)
                    publish(folder,'trusted-next-baseline',edited)
                    target='dashboard' if layout=='report' else 'report'
                    switched=self.artifact(await client.call_tool('edit_page',{'baseline_token':'trusted-next-baseline','request':{'operations':[{'id':'switch','type':'set_page_layout','layout':target}]}}))
                    self.assertEqual(switched,dict(edited,layout=target))
                    # Same page identity is retained; evidence copy uses its own matching file ID.
                    switched=deepcopy(switched);switched['id']='switched-to-'+target;record(switched)
                    record(edited)

    async def test_missing_baseline_and_bad_layout_cannot_create_or_replace_a_page(self):
        with tempfile.TemporaryDirectory() as folder:
            original=page();publish(folder,'trusted-manual-baseline',original)
            async with Client(self.config(folder)) as client:
                missing=await client.call_tool('edit_page',{'baseline_token':'missing-baseline-token','request':{'operations':[title()]}})
                self.assertEqual(missing.structured_content['modelSummary']['status'],'invalid_baseline')
                self.assertIsNone(missing.structured_content['artifactEnvelope'])
                failed=await client.call_tool('edit_page',{'baseline_token':'trusted-manual-baseline','request':{'operations':[{'id':'switch','type':'set_page_layout','layout':'poster'}]}})
                self.assertIsNone(failed.structured_content['artifactEnvelope'])
                self.assertEqual(json.loads((Path(folder)/'trusted-manual-baseline.json').read_text())['document'],original)

    async def test_backdrop_switch_uses_real_public_entry_and_preserves_all_properties(self):
        original=json.loads((ROOT.parent/'packages/page/fixtures/contract-valid/composite-page.json').read_text())
        original['schemaVersion']='6.2';original['layout']='dashboard'
        with tempfile.TemporaryDirectory() as folder:
            publish(folder,'trusted-backdrop-baseline',original)
            async with Client(self.config(folder)) as client:
                switched=self.artifact(await client.call_tool('edit_page',{'baseline_token':'trusted-backdrop-baseline','request':{'operations':[{'id':'switch','type':'set_page_layout','layout':'report'}]}}))
                self.assertEqual(switched,dict(original,layout='report'))
                switched=deepcopy(switched);switched['id']='backdrop-report';record(switched)

    async def test_public_data_composition_keeps_scope_titles_and_queries_in_both_forms(self):
        spec=json.loads((ROOT/'test-harness/fixtures/page-build-spec.json').read_text())
        async with Client(ROOT/'test-harness/content_stdio_server.py') as client:
            report=self.artifact(await client.call_tool('compose_page',{'page_id':'composed-report','spec':spec,'layout':'report'}))
            dashboard=self.artifact(await client.call_tool('compose_page',{'page_id':'composed-dashboard','spec':spec,'layout':'dashboard'}))
            self.assertEqual(report['dataSources'],dashboard['dataSources'])
            self.assertEqual(report['sections'][1]['title'],dashboard['sections'][1]['title'])
            self.assertEqual(report['sections'][1]['components'],dashboard['sections'][1]['components'])
            self.assertEqual(dashboard['sections'][1]['container'],'panel')

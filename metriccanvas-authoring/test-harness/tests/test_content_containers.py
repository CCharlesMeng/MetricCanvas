import asyncio
import json
import sys
import unittest
from pathlib import Path
from fastmcp import Client
from test_container_building import composite,tabs,summary
from test_text_map_building import recipe
from metriccanvas_authoring.pages.components.capabilities import DATA_COMPONENTS
from metriccanvas_authoring.pages.components.component_editing import walk_components
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
ROOT=Path(__file__).resolve().parents[2]

class ContentContainersTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_stdio_all_17_types_and_complete_subtree_creation(self):
        # Real ephemeral local listener represents deployment-owned configuration.
        # Authoring must never call the runtime summary service.
        calls=[]
        async def forbidden(reader,writer):
            calls.append(True);writer.close()
        server=await asyncio.start_server(forbidden,'127.0.0.1',0)
        try:
            endpoint=f'http://127.0.0.1:{server.sockets[0].getsockname()[1]}/conversations'
            config={'mcpServers':{'content':{'command':sys.executable,'args':[str(ROOT/'test-harness/content_stdio_server.py')],'env':{'METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG':json.dumps({'conversationBaseUrl':endpoint})}}}}
            async with Client(config) as client:
                response=await client.call_tool('create_content_page',{'page_id':'all-content','title':'完整内容','source_token':'trusted-content-source','request':{'operations':[recipe(k) for k in ['text','field_text','map_chart']]+[composite(),tabs(),summary()]}})
                payload=response.structured_content
                self.assertTrue(payload['ok'],payload)
                self.assertEqual(payload['modelSummary']['status'],'changed')
                document=payload['artifactEnvelope']['artifact']['document']
                self.assertEqual(validate_page_document(document),[])
                self.assertEqual(document_sha256(document),payload['artifactEnvelope']['artifact']['documentSha256'])
                seen={c['type'] for c in walk_components(document)}
                for kind in DATA_COMPONENTS:
                    target='metric' if kind in {'metricCard','gauge','keyValuePanel'} else 'chart'
                    result=await client.call_tool('edit_page',{'baseline_token':'trusted-content-source','request':{'operations':[
                        {'id':'convert','type':'change_component_type','componentId':target,'componentType':kind},
                        {'id':'title','type':'set_title','componentId':'header','title':kind}]}})
                    self.assertEqual(result.structured_content['modelSummary']['status'],'changed',result.structured_content)
                    output=result.structured_content['artifactEnvelope']['artifact']['document']
                    self.assertEqual(validate_page_document(output),[])
                    seen.update(c['type'] for c in walk_components(output))
                catalog=json.loads((ROOT/'contract-snapshot/page/component-catalog.json').read_text())
                self.assertEqual(seen,{c['type'] for c in catalog})
                self.assertEqual(len(seen),17)
                text=' '.join(c.text for c in response.content if c.type=='text')
                for secret in ['dataSources','上海市',endpoint,'relatedData','promptTemplate']:
                    self.assertNotIn(secret,text)
            self.assertEqual(calls,[])
        finally:
            server.close();await server.wait_closed()

    async def test_missing_configuration_invalid_children_and_injected_endpoint_fail(self):
        async with Client(ROOT/'test-harness/content_stdio_server.py') as client:
            result=await client.call_tool('create_content_page',{'page_id':'partial-content','title':'部分内容','source_token':'trusted-content-source','request':{'operations':[summary(),composite(children=[]),recipe('text',title='AI 总结')]}})
            payload=result.structured_content
            self.assertEqual(payload['modelSummary']['status'],'partial')
            self.assertEqual(payload['modelSummary']['operations'][0]['issues'][0]['code'],'RUNTIME_SUMMARY_CONFIG_REQUIRED')
            document=payload['artifactEnvelope']['artifact']['document']
            self.assertEqual([c['type'] for c in walk_components(document)],['reportHeader','text'])
            injected=await client.call_tool('edit_page',{'baseline_token':'trusted-content-source','request':{'operations':[summary(conversationBaseUrl='https://model-injection.invalid')]}})
            self.assertIsNone(injected.structured_content['artifactEnvelope'])
